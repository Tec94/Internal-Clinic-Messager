import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Page, useParams } from "zmp-ui";

import { AppIcon } from "@/components/AppIcon";
import {
  EmptyState,
  MetadataList,
  NotFound,
  PageHeader,
  SectionHeading,
  TaskStatusLabel,
  UrgencyLabel,
} from "@/components/ui";
import { copyFor } from "@/localization";
import { getActiveMiniLocale } from "@/i18n";
import { useMiniState } from "@/state/MiniStateContext";
import { MiniStateAction, MiniTask, TaskAgendaSection } from "@/types";

const taskSections: TaskAgendaSection[] = [
  "needsAttention",
  "today",
  "upcoming",
  "history",
];

const TaskRow = ({ task }: { task: MiniTask }) => {
  const { t } = useTranslation();
  const locale = getActiveMiniLocale();
  const completed = task.checklist.filter((item) => item.completed).length;

  return (
    <Link className="list-row" to={`/tasks/${task.id}`}>
      <span className="list-row__content">
        <span className="list-row__title-line">
          <strong>{copyFor(task.title, locale)}</strong>
          {task.urgent ? <UrgencyLabel /> : null}
        </span>
        <span className="list-row__description">{copyFor(task.summary, locale)}</span>
        <span className="list-row__meta">
          {copyFor(task.dueLabel, locale)}
          {task.checklist.length
            ? ` · ${t("tasks.progress", {
                completed,
                total: task.checklist.length,
              })}`
            : ""}
        </span>
      </span>
      <span className="list-row__end">
        <TaskStatusLabel status={task.status} />
        <span aria-hidden="true"><AppIcon name="arrow-right" size={17} /></span>
      </span>
    </Link>
  );
};

const TaskList = () => {
  const { t } = useTranslation();
  const { tasks } = useMiniState();

  return (
    <Page className="mini-page">
      <PageHeader
        eyebrow={t("tasks.eyebrow")}
        title={t("tasks.title")}
        description={t("tasks.description")}
      />
      <div className="page-body">
        {tasks.length ? (
          taskSections.map((section) => {
            const sectionTasks = tasks.filter((task) => task.agenda === section);
            if (!sectionTasks.length) return null;
            return (
              <section className="content-section" key={section}>
                <SectionHeading
                  title={t(`tasks.sections.${section}`)}
                  meta={String(sectionTasks.length)}
                />
                <ul className="row-list">
                  {sectionTasks.map((task) => (
                    <li key={task.id}><TaskRow task={task} /></li>
                  ))}
                </ul>
              </section>
            );
          })
        ) : (
          <EmptyState title={t("tasks.noTasks")} detail={t("inbox.summaryEmpty")} />
        )}
      </div>
    </Page>
  );
};

const TaskDetail = ({ taskId }: { taskId: string }) => {
  const { t } = useTranslation();
  const locale = getActiveMiniLocale();
  const { snapshot, tasks, dispatch } = useMiniState();
  const task = tasks.find((item) => item.id === taskId);
  const [formMode, setFormMode] = useState<"decline" | "blocker" | null>(null);
  const [reason, setReason] = useState("");
  const [announcement, setAnnouncement] = useState("");

  if (!task) {
    return (
      <Page className="mini-page">
        <PageHeader eyebrow={t("tasks.eyebrow")} title={t("tasks.title")} back />
        <div className="page-body"><NotFound message={t("tasks.unavailable")} /></div>
      </Page>
    );
  }

  const sourceChannel = snapshot.channels.find(
    (channel) => channel.id === task.channelId,
  );
  const completed = task.checklist.filter((item) => item.completed).length;
  const checklistComplete = task.checklist.every((item) => item.completed);
  const checklistEditable = ["accepted", "inProgress", "blocked"].includes(task.status);

  const perform = (action: MiniStateAction) => {
    dispatch(action);
    setAnnouncement(t("tasks.updated"));
    setFormMode(null);
    setReason("");
  };

  const submitReason = (event: FormEvent) => {
    event.preventDefault();
    if (!reason.trim()) return;
    perform(
      formMode === "decline"
        ? { type: "task/decline", taskId: task.id, reason }
        : { type: "task/report-blocker", taskId: task.id, reason },
    );
  };

  return (
    <Page className="mini-page">
      <PageHeader
        eyebrow={t("tasks.eyebrow")}
        title={copyFor(task.title, locale)}
        description={copyFor(task.summary, locale)}
        back
      />
      <div className="page-body detail-body">
        <div className="detail-state-line">
          <TaskStatusLabel status={task.status} />
          {task.urgent ? <UrgencyLabel /> : null}
          <span>{copyFor(task.dueLabel, locale)}</span>
        </div>

        <section className="content-section">
          <SectionHeading
            title={t("tasks.checklist")}
            meta={t("tasks.progress", { completed, total: task.checklist.length })}
          />
          {task.checklist.length ? (
            <ul className="checklist">
              {task.checklist.map((item) => (
                <li key={item.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={item.completed}
                      disabled={!checklistEditable}
                      onChange={() =>
                        perform({
                          type: "task/toggle-checklist",
                          taskId: task.id,
                          itemId: item.id,
                        })
                      }
                    />
                    <span>{copyFor(item.label, locale)}</span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className="inline-empty">{t("tasks.completeHelp")}</p>
          )}
        </section>

        <section className="content-section">
          <SectionHeading title={t("tasks.details")} />
          <MetadataList
            items={[
              { label: t("tasks.owner"), value: task.ownerName },
              { label: t("tasks.creator"), value: task.creatorName },
              { label: t("tasks.due"), value: copyFor(task.dueLabel, locale) },
              ...(sourceChannel
                ? [
                    {
                      label: t("tasks.sourceChannel"),
                      value: (
                        <Link to={`/chat/${sourceChannel.id}`}>
                          {copyFor(sourceChannel.displayName, locale)}
                        </Link>
                      ),
                    },
                  ]
                : []),
              ...(task.blockerReason
                ? [{ label: t("tasks.blockerReason"), value: task.blockerReason }]
                : []),
              ...(task.declineReason
                ? [{ label: t("tasks.declineReason"), value: task.declineReason }]
                : []),
            ]}
          />
        </section>

        <section className="content-section task-actions" aria-label={t("tasks.title")}>
          <div className="action-grid">
            {task.status === "pendingAcceptance" ? (
              <>
                <button
                  className="button button--primary"
                  type="button"
                  onClick={() => perform({ type: "task/accept", taskId: task.id })}
                >
                  {t("tasks.actions.accept")}
                </button>
                <button
                  className="button button--secondary"
                  type="button"
                  aria-expanded={formMode === "decline"}
                  onClick={() => {
                    setFormMode("decline");
                    setReason("");
                  }}
                >
                  {t("tasks.actions.decline")}
                </button>
              </>
            ) : null}
            {task.status === "accepted" ? (
              <button
                className="button button--primary"
                type="button"
                onClick={() => perform({ type: "task/start", taskId: task.id })}
              >
                {t("tasks.actions.start")}
              </button>
            ) : null}
            {task.status === "accepted" || task.status === "inProgress" ? (
              <button
                className="button button--secondary"
                type="button"
                aria-expanded={formMode === "blocker"}
                onClick={() => {
                  setFormMode("blocker");
                  setReason("");
                }}
              >
                {t("tasks.actions.reportBlocker")}
              </button>
            ) : null}
            {task.status === "inProgress" ? (
              <button
                className="button button--primary"
                type="button"
                disabled={!checklistComplete}
                onClick={() => perform({ type: "task/complete", taskId: task.id })}
              >
                {t("tasks.actions.complete")}
              </button>
            ) : null}
            {task.status === "blocked" ? (
              <button
                className="button button--primary"
                type="button"
                onClick={() => perform({ type: "task/clear-blocker", taskId: task.id })}
              >
                {t("tasks.actions.clearBlocker")}
              </button>
            ) : null}
            {task.status === "done" ? (
              <button
                className="button button--secondary"
                type="button"
                onClick={() => perform({ type: "task/reopen", taskId: task.id })}
              >
                {t("tasks.actions.reopen")}
              </button>
            ) : null}
          </div>

          {task.status === "inProgress" && !checklistComplete ? (
            <p className="action-help">{t("tasks.completeHelp")}</p>
          ) : null}

          {formMode ? (
            <form className="reason-form" onSubmit={submitReason}>
              <label htmlFor="task-reason">{t("tasks.reasonLabel")}</label>
              <textarea
                id="task-reason"
                value={reason}
                placeholder={t(
                  formMode === "decline"
                    ? "tasks.declinePlaceholder"
                    : "tasks.blockerPlaceholder",
                )}
                required
                onChange={(event) => setReason(event.target.value)}
              />
              <div className="action-grid">
                <button className="button button--primary" type="submit">
                  {t(
                    formMode === "decline"
                      ? "tasks.submitDecline"
                      : "tasks.submitBlocker",
                  )}
                </button>
                <button
                  className="button button--ghost"
                  type="button"
                  onClick={() => {
                    setFormMode(null);
                    setReason("");
                  }}
                >
                  {t("common.cancel")}
                </button>
              </div>
            </form>
          ) : null}
          <p className="live-status" role="status" aria-live="polite">
            {announcement}
          </p>
        </section>
      </div>
    </Page>
  );
};

export const TasksPage = () => {
  const { taskId } = useParams<{ taskId?: string }>();
  return taskId ? <TaskDetail taskId={taskId} /> : <TaskList />;
};
