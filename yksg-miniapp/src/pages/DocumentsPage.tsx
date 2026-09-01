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

const DocumentList = () => {
  const { t } = useTranslation();
  const locale = getActiveMiniLocale();
  const { snapshot } = useMiniState();
  const [query, setQuery] = useState("");
  const filteredDocuments = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(locale);
    if (!normalized) return snapshot.documents;
    return snapshot.documents.filter((document) =>
      `${copyFor(document.name, locale)} ${copyFor(document.description, locale)}`
        .toLocaleLowerCase(locale)
        .includes(normalized),
    );
  }, [locale, query, snapshot.documents]);

  return (
    <Page className="mini-page">
      <PageHeader
        eyebrow={t("documents.eyebrow")}
        title={t("documents.title")}
        description={t("documents.description")}
      />
      <div className="page-body">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder={t("documents.searchPlaceholder")}
        />
        <section className="content-section">
          <SectionHeading
            title={t("documents.title")}
            meta={String(filteredDocuments.length)}
          />
          {filteredDocuments.length ? (
            <ul className="row-list">
              {filteredDocuments.map((document) => (
                <li key={document.id}>
                  <Link className="list-row" to={`/documents/${document.id}`}>
                    <span className="file-glyph" aria-hidden="true">
                      <AppIcon name="file" size={21} />
                    </span>
                    <span className="list-row__content">
                      <strong>{copyFor(document.name, locale)}</strong>
                      <span className="list-row__description">
                        {copyFor(document.description, locale)}
                      </span>
                      <span className="list-row__meta">
                        {copyFor(document.typeLabel, locale)} · {document.sizeLabel}
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
                snapshot.documents.length
                  ? t("documents.noResults")
                  : t("documents.noDocuments")
              }
            />
          )}
        </section>
      </div>
    </Page>
  );
};

const DocumentDetail = ({ documentId }: { documentId: string }) => {
  const { t } = useTranslation();
  const locale = getActiveMiniLocale();
  const { snapshot, tasks } = useMiniState();
  const document = snapshot.documents.find((item) => item.id === documentId);

  if (!document) {
    return (
      <Page className="mini-page">
        <PageHeader eyebrow={t("documents.eyebrow")} title={t("documents.title")} back />
        <div className="page-body"><NotFound message={t("documents.unavailable")} /></div>
      </Page>
    );
  }

  const sourceChannel = snapshot.channels.find(
    (channel) => channel.id === document.channelId,
  );
  const linkedTask = tasks.find((task) => task.id === document.taskId);

  return (
    <Page className="mini-page">
      <PageHeader
        eyebrow={t("documents.eyebrow")}
        title={copyFor(document.name, locale)}
        description={copyFor(document.description, locale)}
        back
      />
      <div className="page-body detail-body">
        <div className="document-identity" aria-hidden="true">
          <AppIcon name="file" size={30} />
        </div>
        <section className="content-section">
          <SectionHeading title={t("documents.details")} />
          <MetadataList
            items={[
              { label: t("documents.fileType"), value: copyFor(document.typeLabel, locale) },
              { label: t("documents.size"), value: document.sizeLabel },
              { label: t("documents.uploadedBy"), value: document.uploadedBy },
              {
                label: t("documents.uploadedAt"),
                value: copyFor(document.uploadedAtLabel, locale),
              },
              ...(linkedTask
                ? [
                    {
                      label: t("documents.linkedTask"),
                      value: (
                        <Link to={`/tasks/${linkedTask.id}`}>
                          {copyFor(linkedTask.title, locale)}
                        </Link>
                      ),
                    },
                  ]
                : []),
              ...(sourceChannel
                ? [
                    {
                      label: t("documents.sourceChannel"),
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
        <div className="offline-note">
          <span aria-hidden="true"><AppIcon name="lock" size={20} /></span>
          <p>{t("documents.offline")}</p>
        </div>
      </div>
    </Page>
  );
};

export const DocumentsPage = () => {
  const { documentId } = useParams<{ documentId?: string }>();
  return documentId ? (
    <DocumentDetail documentId={documentId} />
  ) : (
    <DocumentList />
  );
};
