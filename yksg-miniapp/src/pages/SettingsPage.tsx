import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Page } from "zmp-ui";

import { AppIcon } from "@/components/AppIcon";
import { PageHeader, SectionHeading } from "@/components/ui";
import { getActiveMiniLocale, setMiniLocale } from "@/i18n";
import { useMiniState } from "@/state/MiniStateContext";
import { MiniLocale } from "@/types";

export const SettingsPage = () => {
  const { t } = useTranslation();
  const locale = getActiveMiniLocale();
  const { scenario, reset } = useMiniState();
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const changeLocale = (nextLocale: MiniLocale) => {
    if (nextLocale !== locale) void setMiniLocale(nextLocale);
  };

  const handleReset = () => {
    if (!confirmingReset) {
      setConfirmingReset(true);
      setAnnouncement("");
      return;
    }
    reset();
    setConfirmingReset(false);
    setAnnouncement(t("settings.resetDone"));
  };

  return (
    <Page className="mini-page">
      <PageHeader
        eyebrow={t("settings.eyebrow")}
        title={t("settings.title")}
        description={t("settings.description")}
      />
      <div className="page-body settings-body">
        <section className="settings-section">
          <SectionHeading title={t("settings.languageTitle")} />
          <p>{t("settings.languageHelp")}</p>
          <div className="language-options" role="group" aria-label={t("locale.groupLabel")}>
            <button
              type="button"
              aria-pressed={locale === "vi-VN"}
              onClick={() => changeLocale("vi-VN")}
            >
              <span>VI</span>
              {t("locale.vietnamese")}
              {locale === "vi-VN" ? (
                <span aria-hidden="true"><AppIcon name="check" size={19} /></span>
              ) : null}
            </button>
            <button
              type="button"
              aria-pressed={locale === "en-US"}
              onClick={() => changeLocale("en-US")}
            >
              <span>EN</span>
              {t("locale.english")}
              {locale === "en-US" ? (
                <span aria-hidden="true"><AppIcon name="check" size={19} /></span>
              ) : null}
            </button>
          </div>
        </section>

        <section className="settings-section">
          <SectionHeading title={t("settings.fixtureTitle")} />
          <div className="fixture-summary">
            <span className="fixture-label">{t(`settings.fixture.${scenario}`)}</span>
            <p>{t(`settings.fixtureDescription.${scenario}`)}</p>
          </div>
        </section>

        <section className="settings-section">
          <SectionHeading title={t("settings.resetTitle")} />
          <p>{t("settings.resetHelp")}</p>
          <button
            className={`button ${confirmingReset ? "button--danger" : "button--secondary"}`}
            type="button"
            onClick={handleReset}
          >
            <span aria-hidden="true"><AppIcon name="reset" size={19} /></span>
            {t(confirmingReset ? "settings.confirmReset" : "settings.reset")}
          </button>
          <p className="live-status" role="status" aria-live="polite">
            {announcement}
          </p>
        </section>

        <section className="settings-section">
          <SectionHeading title={t("settings.offlineTitle")} />
          <div className="offline-note">
            <span aria-hidden="true"><AppIcon name="lock" size={20} /></span>
            <p>{t("settings.offlineBody")}</p>
          </div>
        </section>
      </div>
    </Page>
  );
};
