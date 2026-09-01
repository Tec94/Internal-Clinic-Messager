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
import { Link, NavLink, useLocation } from "react-router-dom";

import { AppIcon, AppIconName } from "@/components/AppIcon";
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
  const dialogRef = useRef<HTMLDivElement>(null);
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
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex="0"]',
      ) ?? [],
    );
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
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
        ref={dialogRef}
        className="more-sheet"
        role="dialog"
        aria-modal="true"
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
          <Link to="/documents" onClick={closeAfterNavigation}>
            <span aria-hidden="true"><AppIcon name="file" size={21} /></span>
            <span>{t("nav.documents")}</span>
            <span aria-hidden="true"><AppIcon name="arrow-right" size={17} /></span>
          </Link>
          <Link to="/people" onClick={closeAfterNavigation}>
            <span aria-hidden="true"><AppIcon name="user" size={21} /></span>
            <span>{t("nav.people")}</span>
            <span aria-hidden="true"><AppIcon name="arrow-right" size={17} /></span>
          </Link>
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
          <Link to="/settings" onClick={closeAfterNavigation}>
            <span aria-hidden="true"><AppIcon name="settings" size={21} /></span>
            <span>{t("nav.settings")}</span>
            <span aria-hidden="true"><AppIcon name="arrow-right" size={17} /></span>
          </Link>
        </nav>
      </div>
    </div>,
    document.body,
  );
};

export const AppShell = ({ children }: PropsWithChildren) => {
  const { t } = useTranslation();
  const { snapshot } = useMiniState();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  const unreadTotal = snapshot.channels.reduce(
    (total, channel) => total + channel.unreadCount,
    0,
  );
  const moreActive = ["/documents", "/people", "/settings"].some((path) =>
    location.pathname.startsWith(path),
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t("common.skipToContent")}
      </a>
      <main id="main-content" className="app-content" tabIndex={-1}>
        {children}
      </main>

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
            <NavLink
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
            </NavLink>
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
    </div>
  );
};
