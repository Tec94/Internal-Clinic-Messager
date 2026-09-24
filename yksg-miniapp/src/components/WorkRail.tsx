import { useState } from "react";
import { useTranslation } from "react-i18next";

import { DirectionalLink } from "@/components/DirectionalLink";
import { MeetingResponseLabel, TaskStatusLabel, UrgencyLabel } from "@/components/ui";
import { getActiveMiniLocale } from "@/i18n";
import { copyFor } from "@/localization";
import { useMiniState } from "@/state/MiniStateContext";
import { MiniMeeting, MiniTask, TaskMutableState } from "@/types";

type RailEntry = { kind: "task"; item: MiniTask } | { kind: "meeting"; item: MiniMeeting };

const timeFromLabel = (label: string): string => label.match(/\d{1,2}:\d{2}/)?.[0] ?? label.split(" · ").pop() ?? label;

const taskState = (task: MiniTask): TaskMutableState => ({
  status: task.status,
  checklist: task.checklist.reduce<Record<string, boolean>>((state, item) => {
    state[item.id] = item.completed;
    return state;
  }, {}),
  declineReason: task.declineReason,
  blockerReason: task.blockerReason,
});

export const WorkRail = ({ entries }: { entries: RailEntry[] }) => {
  const { t } = useTranslation();
  const locale = getActiveMiniLocale();
  const { actWithUndo } = useMiniState();
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);

  const respond = (meeting: MiniMeeting, response: "accepted" | "declined") => {
    if (meeting.response === response) return;
    actWithUndo(
      { type: "meeting/respond", meetingId: meeting.id, response },
      { type: "meeting/respond", meetingId: meeting.id, response: meeting.response },
      t(response === "accepted" ? "meetings.response.accepted" : "meetings.response.declined"),
    );
  };

  const accept = (task: MiniTask) => actWithUndo(
    { type: "task/accept", taskId: task.id },
    { type: "task/restore", taskId: task.id, task: taskState(task) },
    t("tasks.status.accepted"),
  );

  const decline = (task: MiniTask) => {
    if (!reason) return;
    actWithUndo(
      { type: "task/decline", taskId: task.id, reason },
      { type: "task/restore", taskId: task.id, task: taskState(task) },
      t("tasks.status.declined"),
    );
    setDecliningId(null);
    setReason(null);
  };

  return (
    <ol className="work-rail">
      {entries.map((entry, index) => {
        const item = entry.item;
        const task = entry.kind === "task" ? entry.item : null;
        const meeting = entry.kind === "meeting" ? entry.item : null;
        const waiting = task ? task.status === "pendingAcceptance" : meeting?.response === "none" && meeting.section !== "past";
        const label = copyFor(task ? task.dueLabel : meeting!.startLabel, locale);
        const title = copyFor(item.title, locale);
        const detailPath = task ? `/tasks/${item.id}` : `/meetings/${item.id}`;
        const showActions = task ? waiting : meeting?.section !== "past";

        return (
          <li key={`${entry.kind}-${item.id}`} className={`work-rail__item ${waiting ? "is-waiting" : ""}`} style={{ "--row-index": Math.min(index, 6) } as React.CSSProperties}>
            <span className="work-rail__time" title={label}>{timeFromLabel(label)}</span>
            <span className="work-rail__track" aria-hidden="true"><span /></span>
            <div className="work-rail__content">
              <DirectionalLink className="work-rail__title" to={detailPath}>{title}</DirectionalLink>
              <div className="work-rail__meta">
                {task ? (
                  <>
                    {task.urgent ? <UrgencyLabel /> : null}
                    {task.status !== "pendingAcceptance" ? <TaskStatusLabel status={task.status} /> : null}
                    <span>{task.creatorName}</span>
                    {task.checklist.length ? <span className="mono">{task.checklist.filter((part) => part.completed).length}/{task.checklist.length}</span> : null}
                  </>
                ) : (
                  <>
                    {meeting!.response !== "none" || meeting!.section === "past" ? <MeetingResponseLabel response={meeting!.response} /> : null}
                    <span>{meeting!.organizerName}</span>
                    <span>{copyFor(meeting!.durationLabel, locale)}</span>
                  </>
                )}
              </div>
              {showActions ? (
                task ? (
                  decliningId === task.id ? (
                    <div className="rail-decline">
                      <span>{t("tasks.reasonLabel")}</span>
                      <div className="rail-decline__options">
                        {[t("tasks.quickReason.schedule"), t("tasks.quickReason.shift"), t("tasks.quickReason.info")].map((choice) => (
                          <button key={choice} type="button" aria-pressed={reason === choice} onClick={() => setReason(choice)}>{choice}</button>
                        ))}
                      </div>
                      <div className="rail-actions">
                        <button type="button" className="button button--primary" disabled={!reason} onClick={() => decline(task)}>{t("tasks.submitDecline")}</button>
                        <button type="button" className="button button--ghost" onClick={() => { setDecliningId(null); setReason(null); }}>{t("common.cancel")}</button>
                      </div>
                    </div>
                  ) : (
                    <div className="rail-actions">
                      <button type="button" className="button button--primary" onClick={() => accept(task)}>{t("tasks.actions.accept")}</button>
                      <button type="button" className="button button--secondary" onClick={() => { setDecliningId(task.id); setReason(null); }}>{t("tasks.actions.decline")}</button>
                    </div>
                  )
                ) : (
                  <div className={`rail-actions ${meeting!.response !== "none" ? "rail-actions--segmented" : ""}`} role="group" aria-label={t("meetings.responseGroup")}>
                    <button type="button" className="button button--primary" aria-pressed={meeting!.response === "accepted"} onClick={() => respond(meeting!, "accepted")}>{t("meetings.accept")}</button>
                    <button type="button" className="button button--secondary" aria-pressed={meeting!.response === "declined"} onClick={() => respond(meeting!, "declined")}>{t("meetings.decline")}</button>
                  </div>
                )
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
};
