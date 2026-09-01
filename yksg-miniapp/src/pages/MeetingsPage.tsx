import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Page, useParams } from "zmp-ui";

import { AppIcon } from "@/components/AppIcon";
import {
  EmptyState,
  MeetingResponseLabel,
  MetadataList,
  NotFound,
  PageHeader,
  SectionHeading,
} from "@/components/ui";
import { getActiveMiniLocale } from "@/i18n";
import { copyFor } from "@/localization";
import { useMiniState } from "@/state/MiniStateContext";
import { MeetingSection, MiniMeeting } from "@/types";

const meetingSections: MeetingSection[] = ["invitations", "upcoming", "past"];

const MeetingRow = ({ meeting }: { meeting: MiniMeeting }) => {
  const locale = getActiveMiniLocale();
  return (
    <Link className="list-row" to={`/meetings/${meeting.id}`}>
      <span className="list-row__content">
        <strong>{copyFor(meeting.title, locale)}</strong>
        <span className="list-row__description">{copyFor(meeting.purpose, locale)}</span>
        <span className="list-row__meta">
          {copyFor(meeting.startLabel, locale)} · {meeting.provider}
        </span>
      </span>
      <span className="list-row__end">
        <MeetingResponseLabel response={meeting.response} />
        <span aria-hidden="true"><AppIcon name="arrow-right" size={17} /></span>
      </span>
    </Link>
  );
};

const MeetingList = () => {
  const { t } = useTranslation();
  const { meetings } = useMiniState();

  return (
    <Page className="mini-page">
      <PageHeader
        eyebrow={t("meetings.eyebrow")}
        title={t("meetings.title")}
        description={t("meetings.description")}
      />
      <div className="page-body">
        {meetings.length ? (
          meetingSections.map((section) => {
            const sectionMeetings = meetings.filter(
              (meeting) => meeting.section === section,
            );
            if (!sectionMeetings.length) return null;
            return (
              <section className="content-section" key={section}>
                <SectionHeading
                  title={t(`meetings.sections.${section}`)}
                  meta={String(sectionMeetings.length)}
                />
                <ul className="row-list">
                  {sectionMeetings.map((meeting) => (
                    <li key={meeting.id}><MeetingRow meeting={meeting} /></li>
                  ))}
                </ul>
              </section>
            );
          })
        ) : (
          <EmptyState title={t("meetings.noMeetings")} detail={t("inbox.noInvitations")} />
        )}
      </div>
    </Page>
  );
};

const MeetingDetail = ({ meetingId }: { meetingId: string }) => {
  const { t } = useTranslation();
  const locale = getActiveMiniLocale();
  const { snapshot, meetings, dispatch } = useMiniState();
  const meeting = meetings.find((item) => item.id === meetingId);
  const [announcement, setAnnouncement] = useState("");

  if (!meeting) {
    return (
      <Page className="mini-page">
        <PageHeader eyebrow={t("meetings.eyebrow")} title={t("meetings.title")} back />
        <div className="page-body"><NotFound message={t("meetings.unavailable")} /></div>
      </Page>
    );
  }

  const sourceChannel = snapshot.channels.find(
    (channel) => channel.id === meeting.channelId,
  );
  const respond = (response: "accepted" | "declined") => {
    dispatch({ type: "meeting/respond", meetingId: meeting.id, response });
    setAnnouncement(t("meetings.updated"));
  };

  return (
    <Page className="mini-page">
      <PageHeader
        eyebrow={t("meetings.eyebrow")}
        title={copyFor(meeting.title, locale)}
        description={copyFor(meeting.purpose, locale)}
        back
      />
      <div className="page-body detail-body">
        <div className="detail-state-line">
          <MeetingResponseLabel response={meeting.response} />
          <span>{copyFor(meeting.startLabel, locale)}</span>
        </div>

        <section className="content-section">
          <SectionHeading title={t("meetings.title")} />
          <MetadataList
            items={[
              { label: t("meetings.organizer"), value: meeting.organizerName },
              { label: t("meetings.provider"), value: meeting.provider },
              {
                label: t("meetings.duration"),
                value: copyFor(meeting.durationLabel, locale),
              },
              { label: t("meetings.timezone"), value: meeting.timezone },
              ...(sourceChannel
                ? [
                    {
                      label: t("meetings.sourceChannel"),
                      value: (
                        <Link to={`/chat/${sourceChannel.id}`}>
                          {copyFor(sourceChannel.displayName, locale)}
                        </Link>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </section>

        <section className="content-section meeting-actions">
          {meeting.section !== "past" ? (
            <div className="action-grid">
              <button
                className="button button--primary"
                type="button"
                aria-pressed={meeting.response === "accepted"}
                onClick={() => respond("accepted")}
              >
                {t("meetings.accept")}
              </button>
              <button
                className="button button--secondary"
                type="button"
                aria-pressed={meeting.response === "declined"}
                onClick={() => respond("declined")}
              >
                {t("meetings.decline")}
              </button>
            </div>
          ) : null}
          <div className="offline-note">
            <span aria-hidden="true"><AppIcon name="lock" size={20} /></span>
            <p>{t("meetings.joinUnavailable")}</p>
          </div>
          <p className="live-status" role="status" aria-live="polite">
            {announcement}
          </p>
        </section>
      </div>
    </Page>
  );
};

export const MeetingsPage = () => {
  const { meetingId } = useParams<{ meetingId?: string }>();
  return meetingId ? <MeetingDetail meetingId={meetingId} /> : <MeetingList />;
};
