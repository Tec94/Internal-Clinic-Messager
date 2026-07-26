import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev -- --mode test --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 1024 } },
    },
    {
      name: 'compact-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 } },
    },
    {
      name: 'tablet',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 }, hasTouch: true },
    },
    {
      name: 'phone-portrait',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
    },
    {
      name: 'phone-small',
      use: { ...devices['Desktop Chrome'], viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true },
    },
    {
      name: 'phone-landscape',
      use: { ...devices['Desktop Chrome'], viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true },
    },
  ],
})
