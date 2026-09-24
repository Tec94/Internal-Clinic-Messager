import {
  KeyboardEvent,
  PropsWithChildren,
  RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import { AppIcon, AppIconName } from "@/components/AppIcon";
import { DirectionalLink, DirectionalNavLink } from "@/components/DirectionalLink";
import { getActiveMiniLocale } from "@/i18n";
import { copyFor } from "@/localization";
import { useMiniState } from "@/state/MiniStateContext";

const navItems = [
  { key: "inbox", to: "/", icon: "inbox" },
  { key: "chat", to: "/chat", icon: "chat" },
  { key: "tasks", to: "/tasks", icon: "list" },
  { key: "meetings", to: "/meetings", icon: "calendar" },
] satisfies Array<{ key: string; to: string; icon: AppIconName }>;

const isPathActive = (pathname: string, path: string): boolean =>
  path === "/" ? pathname === "/" : pathname.startsWith(path);

const BottomSheet = ({
  open,
  onClose,
  triggerRef,
}: {
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement>;
}) => {
  const { t } = useTranslation();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
      setHelpOpen(false);
    };
  }, [open, triggerRef]);

  if (!open) return null;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
  };

  const closeAfterNavigation = () => onClose();

  return createPortal(
    <div className="sheet-layer">
      <button
        className="sheet-backdrop"
        type="button"
        aria-label={t("common.close")}
        onClick={onClose}
      />
      <div
        className="more-sheet"
        role="dialog"
        aria-labelledby="more-sheet-title"
        aria-describedby="more-sheet-description"
        onKeyDown={handleKeyDown}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <header className="more-sheet__header">
          <div>
            <h2 id="more-sheet-title">{t("more.title")}</h2>
            <p id="more-sheet-description">{t("more.description")}</p>
          </div>
          <button
            ref={closeRef}
            className="icon-button"
            type="button"
            aria-label={t("common.close")}
            onClick={onClose}
          >
            <span aria-hidden="true">
              <AppIcon name="close" size={22} />
            </span>
          </button>
        </header>

        <nav className="more-links" aria-label={t("more.navigation")}>
          <DirectionalLink to="/documents" onClick={closeAfterNavigation}>
            <span aria-hidden="true"><AppIcon name="file" size={21} /></span>
            <span>{t("nav.documents")}</span>
            <span aria-hidden="true"><AppIcon name="arrow-right" size={17} /></span>
          </DirectionalLink>
          <DirectionalLink to="/people" onClick={closeAfterNavigation}>
            <span aria-hidden="true"><AppIcon name="user" size={21} /></span>
            <span>{t("nav.people")}</span>
            <span aria-hidden="true"><AppIcon name="arrow-right" size={17} /></span>
          </DirectionalLink>
          <button
            type="button"
            aria-expanded={helpOpen}
            aria-controls="mini-help-copy"
            onClick={() => setHelpOpen((value) => !value)}
          >
            <span aria-hidden="true"><AppIcon name="help" size={21} /></span>
            <span>{t("help.title")}</span>
            <span aria-hidden="true">
              <AppIcon name={helpOpen ? "arrow-up" : "arrow-down"} size={17} />
            </span>
          </button>
          {helpOpen ? (
            <div className="help-copy" id="mini-help-copy">
              <p>{t("help.body")}</p>
              <p>{t("help.privacy")}</p>
            </div>
          ) : null}
          <DirectionalLink to="/settings" onClick={closeAfterNavigation}>
            <span aria-hidden="true"><AppIcon name="settings" size={21} /></span>
            <span>{t("nav.settings")}</span>
            <span aria-hidden="true"><AppIcon name="arrow-right" size={17} /></span>
          </DirectionalLink>
        </nav>
      </div>
    </div>,
    document.body,
  );
};

export const AppShell = ({ children }: PropsWithChildren) => {
  const { t } = useTranslation();
  const { snapshot, tasks, meetings, toast } = useMiniState();
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const unreadTotal = snapshot.channels.reduce(
    (total, channel) => total + channel.unreadCount,
    0,
  );
  const moreActive = ["/documents", "/people", "/settings"].some((path) =>
    location.pathname.startsWith(path),
  );

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: "auto" });
    setMoreOpen(false);
  }, [location.pathname]);

  const locale = getActiveMiniLocale();
  const section = location.pathname.split("/")[1];
  const desktopEntries = section === "chat"
    ? snapshot.channels.map((item) => ({ id: item.id, label: copyFor(item.displayName, locale), meta: item.unreadCount ? String(item.unreadCount) : "" }))
    : section === "tasks"
      ? tasks.map((item) => ({ id: item.id, label: copyFor(item.title, locale), meta: copyFor(item.dueLabel, locale) }))
      : section === "meetings"
        ? meetings.map((item) => ({ id: item.id, label: copyFor(item.title, locale), meta: copyFor(item.startLabel, locale) }))
        : section === "documents"
          ? snapshot.documents.map((item) => ({ id: item.id, label: copyFor(item.name, locale), meta: copyFor(item.typeLabel, locale) }))
          : section === "people"
            ? snapshot.people.map((item) => ({ id: item.id, label: item.name, meta: copyFor(item.title, locale) }))
            : [];
  const hasDesktopList = ["chat", "tasks", "meetings", "documents", "people"].includes(section);
  const selectedId = location.pathname.split("/")[2];
  const firstDesktopEntryId = desktopEntries[0]?.id;

  useEffect(() => {
    if (!selectedId && firstDesktopEntryId && window.matchMedia?.("(min-width: 1024px)")?.matches) {
      navigate(`/${section}/${firstDesktopEntryId}`, { replace: true });
    }
  }, [firstDesktopEntryId, navigate, section, selectedId]);

  return (
    <div className={`app-shell ${scrolled ? "is-scrolled" : ""} ${moreOpen ? "is-more-open" : ""}`}>
      <a className="skip-link" href="#main-content">
        {t("common.skipToContent")}
      </a>
      <div className="desktop-tabs">
        <div className="desktop-tabs__inner">
          <DirectionalLink className="desktop-brand" to="/">YKSG</DirectionalLink>
          {[...navItems, { key: "documents", to: "/documents", icon: "file" as AppIconName }, { key: "people", to: "/people", icon: "user" as AppIconName }].map((item) => (
            <DirectionalNavLink key={item.key} to={item.to} className={isPathActive(location.pathname, item.to) ? "is-active" : ""} aria-current={isPathActive(location.pathname, item.to) ? "page" : undefined}>
              {t(`nav.${item.key}`)}
              {item.key === "chat" && unreadTotal ? <span className="desktop-tabs__count">{unreadTotal}</span> : null}
            </DirectionalNavLink>
          ))}
          <DirectionalLink className="desktop-settings" to="/settings" aria-label={t("nav.settings")}><AppIcon name="settings" size={20} /></DirectionalLink>
        </div>
      </div>
      <div className={`workspace ${hasDesktopList ? "workspace--list" : ""} ${hasDesktopList && !selectedId ? "workspace--unselected" : ""}`}>
        {hasDesktopList ? (
          <aside className="desktop-list" aria-label={t(`nav.${section}`)}>
            <h2>{t(`nav.${section}`)}</h2>
            <div className="desktop-list__rows">
              {desktopEntries.map((item) => (
                <DirectionalLink key={item.id} to={`/${section}/${item.id}`} className={`desktop-list__row ${selectedId === item.id ? "is-selected" : ""}`} aria-current={selectedId === item.id ? "page" : undefined}>
                  <strong>{item.label}</strong><span>{item.meta}</span>
                </DirectionalLink>
              ))}
            </div>
          </aside>
        ) : null}
        <main ref={mainRef} id="main-content" className="app-content" tabIndex={-1} onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 40)}>
          {children}
        </main>
        {hasDesktopList && !selectedId ? <div className="desktop-placeholder" aria-hidden="true">{t("common.viewDetails")}</div> : null}
      </div>

      <nav className="bottom-nav" aria-label={t("nav.label")}>
        {navItems.map((item) => {
          const active = isPathActive(location.pathname, item.to);
          const isChat = item.key === "chat";
          const label = t(`nav.${item.key}`);
          const accessibleLabel =
            isChat && unreadTotal > 0
              ? `${label}, ${t("chat.unreadCount", { count: unreadTotal })}`
              : label;
          return (
            <DirectionalNavLink
              key={item.key}
              to={item.to}
              className={`bottom-nav__item ${active ? "is-active" : ""}`}
              aria-label={accessibleLabel}
              aria-current={active ? "page" : undefined}
            >
              <span className="bottom-nav__icon" aria-hidden="true">
                <AppIcon name={item.icon} size={22} />
                {isChat && unreadTotal > 0 ? (
                  <span className="bottom-nav__badge">
                    {unreadTotal > 99 ? "99+" : unreadTotal}
                  </span>
                ) : null}
              </span>
              <span>{label}</span>
            </DirectionalNavLink>
          );
        })}
        <button
          ref={moreTriggerRef}
          className={`bottom-nav__item ${moreActive || moreOpen ? "is-active" : ""}`}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen(true)}
        >
          <span className="bottom-nav__icon" aria-hidden="true">
            <AppIcon name="more" size={22} />
          </span>
          <span>{t("nav.more")}</span>
        </button>
      </nav>

      <BottomSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        triggerRef={moreTriggerRef}
      />
      {toast ? (
        <div className="undo-toast" role="status">
          <span>{toast.message}</span>
          <button type="button" onClick={toast.undo}>{t("common.undo")}</button>
        </div>
      ) : null}
    </div>
  );
};
