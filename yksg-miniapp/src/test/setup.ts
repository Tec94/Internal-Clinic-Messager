import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

import i18n from "@/i18n";

Object.defineProperty(window, "APP_ID", {
  configurable: true,
  writable: true,
  value: "local-test-app",
});
Object.defineProperty(window, "APP_CONFIG", {
  configurable: true,
  writable: true,
  value: {},
});
Object.defineProperty(window, "matchMedia", {
  configurable: true,
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, "ResizeObserver", {
  configurable: true,
  writable: true,
  value: ResizeObserverStub,
});
Object.defineProperty(window, "scrollTo", {
  configurable: true,
  writable: true,
  value: vi.fn(),
});
Object.defineProperty(HTMLElement.prototype, "scrollTo", {
  configurable: true,
  writable: true,
  value: vi.fn(),
});

beforeEach(async () => {
  window.localStorage.clear();
  await i18n.changeLanguage("vi-VN");
  document.documentElement.lang = "vi-VN";
});

afterEach(() => {
  cleanup();
});
