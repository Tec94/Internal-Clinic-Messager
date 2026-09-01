import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Page, useParams } from "zmp-ui";

import { AppIcon } from "@/components/AppIcon";
import {
  EmptyState,
  NotFound,
  PageHeader,
  SectionHeading,
  UnreadBadge,
  UrgencyLabel,
} from "@/components/ui";
import { getActiveMiniLocale } from "@/i18n";
import { copyFor } from "@/localization";
import { useMiniState } from "@/state/MiniStateContext";

const ChannelList = () => {
  const { t } = useTranslation();
  const locale = getActiveMiniLocale();
  const { snapshot } = useMiniState();

  return (
    <Page className="mini-page">
      <PageHeader
        eyebrow={t("chat.eyebrow")}
        title={t("chat.title")}
        description={t("chat.description")}
      />
      <div className="page-body">
        <section className="content-section content-section--first">
          <SectionHeading
            title={t("chat.title")}
            meta={t("chat.channelCount", { count: snapshot.channels.length })}
          />
          {snapshot.channels.length ? (
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
                      <span className="list-row__meta">
                        {t("common.members", { count: channel.memberCount })}
                      </span>
                    </span>
                    <span className="list-row__end">
                      {channel.unreadCount ? (
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
          ) : (
            <EmptyState title={t("chat.noChannels")} />
          )}
        </section>
      </div>
    </Page>
  );
};

const ChannelDetail = ({ channelId }: { channelId: string }) => {
  const { t } = useTranslation();
  const locale = getActiveMiniLocale();
  const { snapshot } = useMiniState();
  const channel = snapshot.channels.find((item) => item.id === channelId);

  if (!channel) {
    return (
      <Page className="mini-page">
        <PageHeader eyebrow={t("chat.eyebrow")} title={t("chat.title")} back />
        <div className="page-body"><NotFound message={t("chat.unavailable")} /></div>
      </Page>
    );
  }

  return (
    <Page className="mini-page">
      <PageHeader
        eyebrow={t("chat.eyebrow")}
        title={copyFor(channel.displayName, locale)}
        description={copyFor(channel.purpose, locale)}
        back
      />
      <div className="page-body">
        <div className="context-strip">
          <span>{t("common.members", { count: channel.memberCount })}</span>
          {channel.isUrgent ? <UrgencyLabel /> : null}
          <span>{t("chat.readOnly")}</span>
        </div>
        <section className="content-section">
          <SectionHeading title={t("chat.messages")} />
          {channel.messages.length ? (
            <ol className="message-thread">
              {channel.messages.map((message) => (
                <li key={message.id}>
                  <article className={`thread-message ${message.unread ? "is-unread" : ""}`}>
                    <span className="avatar" aria-hidden="true">{message.senderInitials}</span>
                    <div className="thread-message__content">
                      <div className="thread-message__heading">
                        <strong>{message.senderName}</strong>
                        <time>{copyFor(message.timeLabel, locale)}</time>
                      </div>
                      <div className="thread-message__states">
                        {message.urgent ? <UrgencyLabel /> : null}
                        {message.unread ? <span className="unread-state">{t("common.unread")}</span> : null}
                      </div>
                      <p>{copyFor(message.body, locale)}</p>
                    </div>
                  </article>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState title={t("chat.emptyThread")} />
          )}
        </section>
      </div>
    </Page>
  );
};

export const ChatPage = () => {
  const { channelId } = useParams<{ channelId?: string }>();
  return channelId ? <ChannelDetail channelId={channelId} /> : <ChannelList />;
};
