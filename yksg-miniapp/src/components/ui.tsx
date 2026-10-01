import { ChangeEvent, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "zmp-ui";

import { AppIcon } from "@/components/AppIcon";
import { DirectionalLink } from "@/components/DirectionalLink";
import { MeetingResponse, TaskStatus } from "@/types";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  back?: boolean;
}

export const PageHeader = ({
  eyebrow,
  title,
  description,
  back = false,
}: PageHeaderProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <header className={`page-header ${back ? "page-header--detail" : ""}`}>
      <div className="page-header__inner">
        {back ? (
          <button
            className="icon-button page-header__back"
            type="button"
            aria-label={t("common.back")}
            onClick={() => navigate(-1)}
          >
            <span aria-hidden="true">
              <AppIcon name="arrow-left" size={22} />
            </span>
          </button>
        ) : (
          <div className="brand-mark" aria-label={t("brand.label")}>
            <span className="brand-mark__name">YKSG</span>
          </div>
        )}

        <div className="page-header__copy">
          <span className="page-header__eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
    </header>
  );
};

export const SectionHeading = ({
  title,
  meta,
  action,
}: {
  title: string;
  meta?: string;
  action?: { label: string; to: string };
}) => (
  <div className="section-heading">
    <h2>{title}</h2>
    {action ? (
      <DirectionalLink className="section-heading__action" to={action.to}>
        {action.label}
        <span aria-hidden="true">
          <AppIcon name="arrow-right" size={16} />
        </span>
      </DirectionalLink>
    ) : meta ? (
      <span className="section-heading__meta">{meta}</span>
    ) : null}
  </div>
);

export const UrgencyLabel = () => {
  const { t } = useTranslation();
  return <span className="urgency-label">{t("common.urgent")}</span>;
};

export const UnreadBadge = ({ count }: { count: number }) => {
  const { t } = useTranslation();
  const label = t("chat.unreadCount", { count });
  return (
    <span className="unread-badge" aria-label={label}>
      {count > 99 ? "99+" : count}
    </span>
  );
};

export const TaskStatusLabel = ({ status }: { status: TaskStatus }) => {
  const { t } = useTranslation();
  return (
    <span className={`status-label status-label--${status}`}>
      {t(`tasks.status.${status}`)}
    </span>
  );
};

export const MeetingResponseLabel = ({
  response,
}: {
  response: MeetingResponse;
}) => {
  const { t } = useTranslation();
  return (
    <span className={`status-label status-label--meeting-${response}`}>
      {t(`meetings.response.${response}`)}
    </span>
  );
};

export const EmptyState = ({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}) => (
  <div className="empty-state" role="status">
    <span aria-hidden="true">
      <AppIcon name="inbox" size={26} />
    </span>
    <p>{title}</p>
    {detail ? <span>{detail}</span> : null}
  </div>
);

export const SearchField = ({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) => {
  const { t } = useTranslation();
  const handleChange = (event: ChangeEvent<HTMLInputElement>) =>
    onChange(event.target.value);

  return (
    <label className="search-field">
      <span className="visually-hidden">{t("common.search")}</span>
      <span className="search-field__icon" aria-hidden="true">
        <AppIcon name="search" size={20} />
      </span>
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={handleChange}
      />
    </label>
  );
};

export const MetadataList = ({
  items,
}: {
  items: Array<{ label: string; value: ReactNode }>;
}) => (
  <dl className="metadata-list">
    {items.map((item) => (
      <div key={item.label}>
        <dt>{item.label}</dt>
        <dd>{item.value}</dd>
      </div>
    ))}
  </dl>
);

export const NotFound = ({ message }: { message: string }) => (
  <div className="not-found" role="alert">
    <span aria-hidden="true">
      <AppIcon name="info" size={26} />
    </span>
    <p>{message}</p>
  </div>
);
