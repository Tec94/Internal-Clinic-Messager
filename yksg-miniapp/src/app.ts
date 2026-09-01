// ZaUI stylesheet
import "zmp-ui/zaui.css";
// YKSG typefaces
import "@fontsource-variable/hanken-grotesk/wght.css";
import "@fontsource-variable/manrope/wght.css";
// Tailwind stylesheet
import "@/css/tailwind.scss";
// Your stylesheet
import "@/css/app.scss";
// Local-only language setup
import "@/i18n";

// React core
import React from "react";
import { createRoot } from "react-dom/client";

// Mount the app
import Layout from "@/components/layout";

// Expose app configuration
import appConfig from "../app-config.json";

if (!window.APP_CONFIG) {
  window.APP_CONFIG = appConfig as any;
}

const root = createRoot(document.getElementById("app")!);
root.render(React.createElement(Layout));
