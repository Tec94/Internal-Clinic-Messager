import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Page, useParams } from "zmp-ui";

import { AppIcon } from "@/components/AppIcon";
import { WorkRail } from "@/components/WorkRail";
import { DirectionalLink } from "@/components/DirectionalLink";
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
    <DirectionalLink className="list-row" to={`/meetings/${meeting.id}`}>
      <span className="list-row__content">
        <strong>{copyFor(meeting.title, locale)}</strong>
        <span className="list-row__description">{copyFor(meeting.purpose, locale)}</span>
        <span className="list-row__details">
          <MeetingResponseLabel response={meeting.response} />
          <span>{copyFor(meeting.startLabel, locale)} · {meeting.provider}</span>
        </span>
      </span>
      <span className="list-row__end">
        <span aria-hidden="true"><AppIcon name="arrow-right" size={17} /></span>
      </span>
    </DirectionalLink>
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
                {section === "past" ? (
                  <ul className="row-list">
                    {sectionMeetings.map((meeting) => <li key={meeting.id}><MeetingRow meeting={meeting} /></li>)}
                  </ul>
                ) : <WorkRail entries={sectionMeetings.map((item) => ({ kind: "meeting", item }))} />}
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
  const { snapshot, meetings, actWithUndo } = useMiniState();
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
    if (response === meeting.response) return;
    actWithUndo(
      { type: "meeting/respond", meetingId: meeting.id, response },
      { type: "meeting/respond", meetingId: meeting.id, response: meeting.response },
      t(response === "accepted" ? "meetings.response.accepted" : "meetings.response.declined"),
    );
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
                        <DirectionalLink to={`/chat/${sourceChannel.id}`}>
                          {copyFor(sourceChannel.displayName, locale)}
                        </DirectionalLink>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </section>

        <section className="content-section meeting-actions">
          {meeting.section !== "past" ? (
            <div className={`action-grid ${meeting.response !== "none" ? "rail-actions--segmented" : ""}`} role="group" aria-label={t("meetings.responseGroup")}>
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
