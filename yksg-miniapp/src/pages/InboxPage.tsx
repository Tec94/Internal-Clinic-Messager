import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Page } from "zmp-ui";

import { AppIcon } from "@/components/AppIcon";
import {
  LocaleSwitcher,
  MeetingResponseLabel,
  PageHeader,
  SectionHeading,
  TaskStatusLabel,
  UnreadBadge,
  UrgencyLabel,
} from "@/components/ui";
import { getActiveMiniLocale } from "@/i18n";
import { copyFor } from "@/localization";
import { useMiniState } from "@/state/MiniStateContext";

export const InboxPage = () => {
  const { t } = useTranslation();
  const locale = getActiveMiniLocale();
  const { snapshot, tasks, meetings } = useMiniState();
  const hasUnread = snapshot.channels.some((channel) => channel.unreadCount > 0);
  const attentionTasks = tasks.filter((task) => task.agenda === "needsAttention");
  const invitations = meetings.filter((meeting) => meeting.section === "invitations");
  const latestUnread = snapshot.channels.reduce<
    { channelId: string; message: (typeof snapshot.channels)[number]["messages"][number] }
      | undefined
  >((found, channel) => {
    if (found) return found;
    const message = channel.messages.find((item) => item.unread);
    return message ? { channelId: channel.id, message } : undefined;
  }, undefined);

  return (
    <Page className="mini-page">
      <PageHeader
        eyebrow={t("inbox.eyebrow")}
        title={t("inbox.greeting", { name: snapshot.userDisplayName })}
        trailing={<LocaleSwitcher />}
      />

      <div className="page-body inbox-body">
        <section className="scope-summary" aria-label={copyFor(snapshot.scope, locale)}>
          <span className="scope-summary__marker" aria-hidden="true" />
          <div>
            <strong>{copyFor(snapshot.scope, locale)}</strong>
            <p>{hasUnread ? t("inbox.summaryDefault") : t("inbox.summaryEmpty")}</p>
          </div>
        </section>

        <section className="content-section">
          <SectionHeading
            title={t("inbox.channels")}
            action={{ label: t("inbox.viewAll"), to: "/chat" }}
          />
          <ul className="row-list">
            {snapshot.channels.map((channel) => (
              <li key={channel.id}>
                <Link className="list-row" to={`/chat/${channel.id}`}>
                  <span className="list-row__content">
                    <span className="list-row__title-line">
                      <strong>{copyFor(channel.displayName, locale)}</strong>
                      {channel.isUrgent ? <UrgencyLabel /> : null}
                    </span>
                    <span className="list-row__description">
                      {copyFor(channel.purpose, locale)}
                    </span>
                  </span>
                  <span className="list-row__end">
                    {channel.unreadCount > 0 ? (
                      <UnreadBadge count={channel.unreadCount} />
                    ) : (
                      <span className="quiet-label">{t("common.caughtUp")}</span>
                    )}
                    <span aria-hidden="true"><AppIcon name="arrow-right" size={17} /></span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {latestUnread ? (
          <section className="content-section">
            <SectionHeading title={t("inbox.latestMessage")} />
            <Link
              className="message-preview"
              to={`/chat/${latestUnread.channelId}`}
            >
              <span className="avatar" aria-hidden="true">
                {latestUnread.message.senderInitials}
              </span>
              <span className="message-preview__content">
                <span className="message-preview__title">
                  <strong>{latestUnread.message.senderName}</strong>
                  <span className="unread-state">{t("common.unread")}</span>
                </span>
                <span>{copyFor(latestUnread.message.body, locale)}</span>
              </span>
              <span aria-hidden="true"><AppIcon name="arrow-right" size={17} /></span>
            </Link>
          </section>
        ) : null}

        <section className="content-section">
          <SectionHeading
            title={t("inbox.tasks")}
            action={{ label: t("inbox.viewAll"), to: "/tasks" }}
          />
          {attentionTasks.length ? (
            <ul className="row-list">
              {attentionTasks.map((task) => (
                <li key={task.id}>
                  <Link className="list-row" to={`/tasks/${task.id}`}>
                    <span className="list-row__content">
                      <span className="list-row__title-line">
                        <strong>{copyFor(task.title, locale)}</strong>
                        {task.urgent ? <UrgencyLabel /> : null}
                      </span>
                      <span className="list-row__description">{copyFor(task.dueLabel, locale)}</span>
                    </span>
                    <span className="list-row__end">
                      <TaskStatusLabel status={task.status} />
                      <span aria-hidden="true"><AppIcon name="arrow-right" size={17} /></span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="inline-empty">{t("inbox.noAttentionTasks")}</p>
          )}
        </section>

        <section className="content-section">
          <SectionHeading
            title={t("inbox.meetings")}
            action={{ label: t("inbox.viewAll"), to: "/meetings" }}
          />
          {invitations.length ? (
            <ul className="row-list">
              {invitations.map((meeting) => (
                <li key={meeting.id}>
                  <Link className="list-row" to={`/meetings/${meeting.id}`}>
                    <span className="list-row__content">
                      <strong>{copyFor(meeting.title, locale)}</strong>
                      <span className="list-row__description">
                        {copyFor(meeting.startLabel, locale)}
                      </span>
                    </span>
                    <span className="list-row__end">
                      <MeetingResponseLabel response={meeting.response} />
                      <span aria-hidden="true"><AppIcon name="arrow-right" size={17} /></span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="inline-empty" id="inbox-meetings-title">{t("inbox.noInvitations")}</p>
          )}
        </section>
      </div>
    </Page>
  );
};
