import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Page, useParams } from "zmp-ui";

import { AppIcon } from "@/components/AppIcon";
import {
  EmptyState,
  MetadataList,
  NotFound,
  PageHeader,
  SearchField,
  SectionHeading,
} from "@/components/ui";
import { getActiveMiniLocale } from "@/i18n";
import { copyFor } from "@/localization";
import { useMiniState } from "@/state/MiniStateContext";

const PeopleList = () => {
  const { t } = useTranslation();
  const locale = getActiveMiniLocale();
  const { snapshot } = useMiniState();
  const [query, setQuery] = useState("");
  const filteredPeople = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(locale);
    if (!normalized) return snapshot.people;
    return snapshot.people.filter((person) =>
      `${person.name} ${copyFor(person.title, locale)} ${copyFor(
        person.department,
        locale,
      )} ${copyFor(person.location, locale)}`
        .toLocaleLowerCase(locale)
        .includes(normalized),
    );
  }, [locale, query, snapshot.people]);

  return (
    <Page className="mini-page">
      <PageHeader
        eyebrow={t("people.eyebrow")}
        title={t("people.title")}
        description={t("people.description")}
      />
      <div className="page-body">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder={t("people.searchPlaceholder")}
        />
        <section className="content-section">
          <SectionHeading title={t("people.title")} meta={String(filteredPeople.length)} />
          {filteredPeople.length ? (
            <ul className="row-list">
              {filteredPeople.map((person) => (
                <li key={person.id}>
                  <Link className="list-row person-row" to={`/people/${person.id}`}>
                    <span className="avatar" aria-hidden="true">{person.initials}</span>
                    <span className="list-row__content">
                      <span className="list-row__title-line">
                        <strong>{person.name}</strong>
                        <span className={`presence presence--${person.status}`}>
                          {t(`people.${person.status}`)}
                        </span>
                      </span>
                      <span className="list-row__description">
                        {copyFor(person.title, locale)}
                      </span>
                      <span className="list-row__meta">
                        {copyFor(person.location, locale)}
                      </span>
                    </span>
                    <span className="list-row__end" aria-hidden="true">
                      <AppIcon name="arrow-right" size={17} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title={
                snapshot.people.length ? t("people.noResults") : t("people.noPeople")
              }
            />
          )}
        </section>
      </div>
    </Page>
  );
};

const PersonDetail = ({ personId }: { personId: string }) => {
  const { t } = useTranslation();
  const locale = getActiveMiniLocale();
  const { snapshot } = useMiniState();
  const person = snapshot.people.find((item) => item.id === personId);

  if (!person) {
    return (
      <Page className="mini-page">
        <PageHeader eyebrow={t("people.eyebrow")} title={t("people.title")} back />
        <div className="page-body"><NotFound message={t("people.unavailable")} /></div>
      </Page>
    );
  }

  const channel = snapshot.channels.find((item) => item.id === person.channelId);

  return (
    <Page className="mini-page">
      <PageHeader
        eyebrow={t("people.eyebrow")}
        title={person.name}
        description={copyFor(person.title, locale)}
        back
      />
      <div className="page-body detail-body">
        <div className="person-identity">
          <span className="avatar avatar--large" aria-hidden="true">{person.initials}</span>
          <span className={`presence presence--${person.status}`}>
            {t(`people.${person.status}`)}
          </span>
        </div>
        <section className="content-section">
          <SectionHeading title={t("people.title")} />
          <MetadataList
            items={[
              { label: t("people.role"), value: copyFor(person.title, locale) },
              {
                label: t("people.department"),
                value: copyFor(person.department, locale),
              },
              { label: t("people.location"), value: copyFor(person.location, locale) },
            ]}
          />
        </section>
        {channel ? (
          <Link className="button button--secondary button--full" to={`/chat/${channel.id}`}>
            <span aria-hidden="true"><AppIcon name="chat" size={19} /></span>
            {t("people.viewConversation")}
          </Link>
        ) : null}
      </div>
    </Page>
  );
};

export const PeoplePage = () => {
  const { personId } = useParams<{ personId?: string }>();
  return personId ? <PersonDetail personId={personId} /> : <PeopleList />;
};
