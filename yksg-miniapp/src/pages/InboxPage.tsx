import { useTranslation } from "react-i18next";
import { Page } from "zmp-ui";

import { DirectionalLink } from "@/components/DirectionalLink";
import { EmptyState, SectionHeading, UnreadBadge } from "@/components/ui";
import { WorkRail } from "@/components/WorkRail";
import { getActiveMiniLocale } from "@/i18n";
import { copyFor } from "@/localization";
import { useMiniState } from "@/state/MiniStateContext";
import { MiniChannel, MiniMeeting, MiniTask } from "@/types";

const timeOf = (label: string): string => label.match(/\d{1,2}:\d{2}/)?.[0] ?? "";

export const InboxPage = () => {
  const { t } = useTranslation();
  const locale = getActiveMiniLocale();
  const { snapshot, tasks, meetings } = useMiniState();
  const unreadChannels = snapshot.channels.filter((channel) => channel.unreadCount > 0);
  const todayTasks = tasks.filter((task) => task.agenda === "needsAttention" || task.agenda === "today");
  const todayMeetings = meetings.filter((meeting) => meeting.section === "invitations");
  const entries: Array<{ kind: "task"; item: MiniTask } | { kind: "meeting"; item: MiniMeeting }> = [
    ...todayMeetings.map((item) => ({ kind: "meeting" as const, item })),
    ...todayTasks.map((item) => ({ kind: "task" as const, item })),
  ].sort((a, b) => timeOf(copyFor(a.kind === "task" ? a.item.dueLabel : a.item.startLabel, locale)).localeCompare(timeOf(copyFor(b.kind === "task" ? b.item.dueLabel : b.item.startLabel, locale))));
  const waitingCount = todayTasks.filter((item) => item.status === "pendingAcceptance").length + todayMeetings.filter((item) => item.response === "none").length;

  return (
    <Page className="mini-page">
      <header className="page-header inbox-header">
        <div className="page-header__inner">
          <div className="page-header__copy">
            <h1>{t("inbox.greeting", { name: snapshot.userDisplayName.split(" ").at(-1) })}</h1>
            <p>{copyFor(snapshot.scope, locale)}</p>
          </div>
        </div>
      </header>
      <div className="page-body inbox-body">
        {entries.length ? (
          <section className="content-section">
            <SectionHeading title={t("tasks.sections.today")} meta={waitingCount ? t("inbox.waitingCount", { count: waitingCount }) : undefined} />
            <WorkRail entries={entries} />
          </section>
        ) : null}
        {unreadChannels.length ? (
          <section className="content-section">
            <SectionHeading title={t("common.unread")} action={{ label: t("inbox.viewAll"), to: "/chat" }} />
            <ul className="channel-list">
              {unreadChannels.map((channel: MiniChannel) => {
                const message = channel.messages.find((item) => item.unread) ?? channel.messages[0];
                return (
                  <li key={channel.id}>
                    <DirectionalLink className="channel-row" to={`/chat/${channel.id}`}>
                      <span className="channel-row__avatar" aria-hidden="true">{copyFor(channel.displayName, locale).slice(0, 2).toLocaleUpperCase(locale)}</span>
                      <span className="channel-row__copy">
                        <strong>{copyFor(channel.displayName, locale)}</strong>
                        {message ? <span>{message.senderName.split(" ").at(-1)}: {copyFor(message.body, locale)}</span> : null}
                      </span>
                      <span className="channel-row__end">
                        {message ? <time>{timeOf(copyFor(message.timeLabel, locale))}</time> : null}
                        <UnreadBadge count={channel.unreadCount} />
                      </span>
                    </DirectionalLink>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
        {!entries.length && !unreadChannels.length ? <EmptyState title={t("inbox.summaryEmpty")} /> : null}
      </div>
    </Page>
  );
};
