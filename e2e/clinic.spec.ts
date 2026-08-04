import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const hideZaloForDesktopBaseline = async (page: Page) => {
  await page.addStyleTag({ content: '.zalo-widget-shell { visibility: hidden !important; }' })
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('clinic-persona', 'user-owner')
    localStorage.setItem('clinic-locale', 'en-US')
    localStorage.setItem('clinic-theme', 'mineral-petrol')
  })
})

test('shared shell and channel layout fit without horizontal overflow', async ({ page }, testInfo) => {
  await page.goto('/channels/same-day-schedule')
  await expect(page.getByRole('heading', { name: 'same-day-schedule-dr-nguyen' })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
  if (!testInfo.project.name.startsWith('phone-')) {
    await hideZaloForDesktopBaseline(page)
    await expect(page).toHaveScreenshot('channel-workspace.png')
  }
})

test('channel creation matches the intended modal structure', async ({ page }, testInfo) => {
  await page.goto('/inbox')
  const createButton = page.getByRole('button', { name: 'Create channel' }).last()
  await createButton.click()
  const dialog = page.getByRole('dialog', { name: 'Create cross-department channel' })
  await expect(dialog).toBeVisible()
  await expect(page.getByText('No patient details.', { exact: true })).toBeVisible()
  await expect(dialog.getByLabel('Channel name')).toHaveValue('same-day-schedule-dr-nguyen')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
  if (!testInfo.project.name.startsWith('phone-')) {
    await hideZaloForDesktopBaseline(page)
    await expect(page).toHaveScreenshot('create-channel-dialog.png', {
      maxDiffPixelRatio: 0.015,
    })
  }
})

test('task panel opens on demand, restores focus, and preserves viewport width', async ({ page }) => {
  await page.goto('/channels/same-day-schedule')
  const trigger = page.getByRole('button', { name: 'Open channel tasks' })
  await expect(page.getByRole('heading', { name: 'Xác nhận thay đổi lịch bác sĩ Nguyễn' })).not.toBeVisible()
  await trigger.click()
  await expect(page.getByRole('heading', { name: 'Xác nhận thay đổi lịch bác sĩ Nguyễn' })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
  await page.getByRole('button', { name: 'Close' }).last().click()
  await expect(page.getByRole('heading', { name: 'Xác nhận thay đổi lịch bác sĩ Nguyễn' })).not.toBeVisible()
  await expect(trigger).toBeFocused()
})

test('manager assigns from message hover and the worker accepts the task', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Fine-pointer assignment workflow')
  await page.goto('/channels/front-desk-home')
  const source = page.getByText('Chào buổi sáng. Hướng dẫn bàn giao mới đã được cập nhật để mọi người cùng sử dụng.')
  const message = source.locator('xpath=ancestor::article[1]')
  await message.hover()
  const assignAction = message.getByRole('button', { name: 'Assign this message as a task' })
  await expect(assignAction).toBeVisible()
  await assignAction.click()

  const dialog = page.getByRole('dialog', { name: 'Assign task' })
  await expect(dialog.getByLabel('Owner')).toHaveText('Choose an assignee')
  await expect(dialog.getByLabel('Due')).toHaveValue('')
  await dialog.getByLabel('Task title').fill('Confirm tomorrow opening coverage')
  await dialog.getByLabel('Owner').click()
  await page.getByRole('option', { name: 'Phạm Ngọc Linh' }).click()
  await dialog.getByLabel('Due').fill(new Date(Date.now() + 86_400_000).toISOString().slice(0, 16))
  await dialog.getByRole('button', { name: 'Assign task' }).click()

  const linkedTask = page.getByText('Confirm tomorrow opening coverage').last()
  await expect(linkedTask).toBeVisible()
  await page.getByRole('button', { name: 'Preview role' }).click()
  await page.getByRole('combobox', { name: 'Role' }).click()
  await page.getByRole('option', { name: 'Phạm Ngọc Linh — Staff' }).click()
  await page.getByRole('link', { name: 'Tasks' }).first().click()
  await page.getByRole('link', { name: /Confirm tomorrow opening coverage/ }).first().click()
  await expect(page).toHaveURL(/\/tasks\/task-/)
  await expect(page.getByText('Response required')).toBeVisible()
  await page.getByRole('button', { name: 'Accept task' }).click()
  await expect(page.getByText('Accepted', { exact: true }).first()).toBeVisible()
})

test('message assignment is available from the keyboard context menu', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Keyboard context-menu workflow')
  await page.goto('/channels/front-desk-home')
  const message = page.getByText('Chào buổi sáng. Hướng dẫn bàn giao mới đã được cập nhật để mọi người cùng sử dụng.').locator('xpath=ancestor::article[1]')
  await message.focus()
  await page.keyboard.press('Shift+F10')
  await expect(page.getByRole('menu', { name: 'Message actions' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Assign task' })).toBeVisible()
})

test('touch long-press exposes the message assignment action', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'tablet', 'Touch long-press workflow')
  await page.goto('/channels/front-desk-home')
  const message = page.getByText('Chào buổi sáng. Hướng dẫn bàn giao mới đã được cập nhật để mọi người cùng sử dụng.').locator('xpath=ancestor::article[1]')
  await message.dispatchEvent('pointerdown', { pointerType: 'touch', button: 0, buttons: 1 })
  await page.waitForTimeout(750)
  await message.dispatchEvent('pointerup', { pointerType: 'touch', button: 0, buttons: 0 })
  await expect(page.getByRole('menu', { name: 'Message actions' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Assign task' })).toBeVisible()
})

test('primary navigation order and module searches are consistent', async ({ page }, testInfo) => {
  await page.goto('/tasks')
  const isPhone = testInfo.project.name.startsWith('phone-')
  if (isPhone) {
    const mobileNavigation = page.getByRole('navigation', { name: 'Mobile navigation' })
    await expect(mobileNavigation).toBeVisible()
    await expect(mobileNavigation.getByText('Inbox', { exact: true })).toBeVisible()
    await expect(mobileNavigation.getByText('Chat', { exact: true })).toBeVisible()
    await expect(mobileNavigation.getByText('Tasks', { exact: true })).toBeVisible()
    await expect(mobileNavigation.getByText('Meetings', { exact: true })).toBeVisible()
  } else {
    const primaryNavigation = page.getByRole('navigation', { name: 'Primary navigation' })
    await expect(primaryNavigation).toBeVisible()
    const primaryLinks = await primaryNavigation.getByRole('link').allTextContents()
    expect(primaryLinks).toEqual(['Inbox', 'Chat', 'Tasks', 'Documents', 'Meetings', 'People', 'Admin'])
  }
  if (testInfo.project.name === 'tablet' || isPhone) await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('button', { name: 'Team in scope' }).click()
  await page.getByPlaceholder('Search tasks, owners, or chats').fill('thay đổi')
  await expect(page.getByText('Xác nhận thay đổi lịch bác sĩ Nguyễn').first()).toBeVisible()
  if (isPhone) {
    await page.locator('.workspace-sidebar').getByRole('button', { name: 'Close' }).click()
    await page.getByRole('button', { name: 'More' }).click()
    await page.getByRole('dialog', { name: 'More' }).getByRole('link', { name: 'Documents' }).click()
    await page.getByRole('button', { name: 'Open navigation' }).click()
  } else {
    await page.getByRole('link', { name: 'Documents' }).click()
  }
  await page.getByPlaceholder('Search files, uploaders, or chats').fill('quy trình')
  await expect(page.getByText('Quy trình điều chỉnh lịch.pdf').first()).toBeVisible()
})

test('meeting links require confirmation and accepted meetings reach the agenda', async ({ page }) => {
  await page.goto('/channels/front-desk-home')
  const message = 'Team sync July 7, 2026 at 10:00 AM https://meet.google.com/abc-defg-hij'
  await page.getByPlaceholder(/Message #front-desk-home/i).fill(message)
  await page.getByRole('button', { name: 'Send message' }).click()
  const dialog = page.getByRole('dialog', { name: 'Confirm meeting details' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Meeting title').fill('Front desk team sync')
  await dialog.getByRole('button', { name: 'Post invitation' }).click()
  await expect(page.getByRole('heading', { name: 'Front desk team sync' })).toBeVisible()
  await page.getByRole('button', { name: 'Accept' }).last().click()
  await page.getByRole('link', { name: 'Meetings' }).click()
  await expect(page.getByText('Front desk team sync').first()).toBeVisible()
})

test('meetings module calendar and agenda stay within their containers', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('clinic-persona', 'user-lead'))
  await page.goto('/meetings')
  await expect(page.locator('.meeting-agenda__row').first()).toBeVisible()
  const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(pageOverflow).toBe(false)
  const agendaTimeFits = await page.locator('.meeting-agenda__time').first().evaluate((element) => element.scrollWidth <= element.clientWidth)
  expect(agendaTimeFits).toBe(true)
  if (testInfo.project.name === 'tablet' || testInfo.project.name.startsWith('phone-')) await page.getByRole('button', { name: 'Open navigation' }).click()
  await expect(page.locator('.mini-calendar')).toBeVisible()
  await expect(page.locator('.mini-calendar__dot').first()).toBeVisible()
  const calendarFits = await page.locator('.mini-calendar').evaluate((element) => element.scrollWidth <= element.clientWidth)
  const eventDayFits = await page.locator('.mini-calendar__day.has-work').first().evaluate((element) => element.scrollWidth <= element.clientWidth)
  expect(calendarFits).toBe(true)
  expect(eventDayFits).toBe(true)
})

test('workspace uses the fixed graphite theme without an appearance switcher', async ({ page }) => {
  await page.goto('/inbox')
  await expect(page.locator('[title="Graphite + Indigo"]')).toHaveCount(0)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'graphite-indigo')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'graphite-indigo')
})

test('Vietnamese admin labels remain visible', async ({ page }) => {
  await page.goto('/settings')
  await page.getByRole('combobox', { name: 'Preferred language' }).click()
  await page.getByRole('option', { name: 'Tiếng Việt' }).click()
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi-VN')
  await page.locator('a[href="/admin/overview"]').first()
    .evaluate((element: HTMLElement) => element.click())
  await page.locator('a[href="/admin/people"]').first()
    .evaluate((element: HTMLElement) => element.click())
  await expect(page.getByRole('heading', { name: 'Nhân sự & vai trò' })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
})

test('employee workspace has no serious WCAG violations', async ({ page }) => {
  await page.goto('/inbox')
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze()
  const blockingViolations = results.violations.filter((violation) =>
    violation.impact === 'critical' || violation.impact === 'serious',
  )
  expect(blockingViolations).toEqual([])
})

test('admin overview uses snapshot governance rather than intake monitoring', async ({ page }) => {
  await page.goto('/admin/overview')
  await expect(page.getByRole('heading', { name: 'Active assignments' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Governance items' })).toBeVisible()
  await expect(page.locator('body')).not.toContainText(/intake capacity|divert|throughput|coordination volume/i)
})

test('module workspace visual', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Desktop module baseline only')
  await page.goto('/tasks')
  await page.getByRole('button', { name: 'Team in scope' }).click()
  await page.getByText('Xác nhận thay đổi lịch bác sĩ Nguyễn').first().click()
  await expect(page.getByRole('heading', { name: 'Xác nhận thay đổi lịch bác sĩ Nguyễn' })).toBeVisible()
  await hideZaloForDesktopBaseline(page)
  await expect(page).toHaveScreenshot('tasks-workspace.png')
})

test('graphite desktop workspace visual', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Desktop comparison only')
  await page.addInitScript(() => localStorage.setItem('clinic-theme', 'graphite-indigo'))
  await page.goto('/channels/same-day-schedule')
  await hideZaloForDesktopBaseline(page)
  await expect(page).toHaveScreenshot('channel-workspace-graphite.png')
})

test('phone shell uses full-width content, bottom navigation, and a permission-aware More sheet', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('phone-'), 'Phone adaptation only')
  await page.goto('/inbox')
  await expect(page.locator('.icon-rail')).toBeHidden()
  const mobileNavigation = page.getByRole('navigation', { name: 'Mobile navigation' })
  await expect(mobileNavigation).toBeVisible()
  const contentWidth = await page.locator('.app-main').evaluate((element) => Math.round(element.getBoundingClientRect().width))
  expect(contentWidth).toBe(page.viewportSize()?.width)

  await page.getByRole('button', { name: 'More' }).click()
  const moreSheet = page.getByRole('dialog', { name: 'More' })
  await expect(moreSheet).toBeVisible()
  await expect(moreSheet.getByRole('link', { name: 'Documents' })).toBeVisible()
  await expect(moreSheet.getByRole('link', { name: 'People' })).toBeVisible()
  await expect(moreSheet.getByRole('link', { name: 'Admin' })).toBeVisible()
  await page.keyboard.press('Tab')
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true)

  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Preview role' }).click()
  await page.getByRole('combobox', { name: 'Role' }).click()
  await page.getByRole('option', { name: 'Phạm Ngọc Linh — Staff' }).click()
  await page.getByRole('button', { name: 'More' }).click()
  await expect(page.getByRole('dialog', { name: 'More' }).getByRole('link', { name: 'Admin' })).toHaveCount(0)
})

test('phone routes, composer, admin rows, and Zalo launcher remain inside the usable viewport', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('phone-'), 'Phone adaptation only')
  const routes = ['/inbox', '/channels/front-desk-home', '/tasks', '/documents', '/meetings', '/people', '/admin/people']
  for (const route of routes) {
    await page.goto(route)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(overflow, `${route} must not overflow`).toBe(false)
  }

  await page.goto('/channels/front-desk-home')
  const composer = page.locator('.composer-region')
  const mobileNavigation = page.locator('.mobile-bottom-nav')
  const [composerBox, navigationBox] = await Promise.all([composer.boundingBox(), mobileNavigation.boundingBox()])
  expect(composerBox?.y && composerBox.height ? composerBox.y + composerBox.height : 0).toBeLessThanOrEqual(navigationBox?.y ?? Number.POSITIVE_INFINITY)

  await page.goto('/admin/people')
  await expect(page.locator('td[data-label]').first()).toBeVisible()

  const launcher = page.getByRole('link', {
    name: 'Open personal Zalo messages in a separate window',
  })
  await expect(launcher).toHaveAttribute('href', 'https://chat.zalo.me/')
  const [triggerBox, navBox] = await Promise.all([
    page.locator('.zalo-widget-trigger').boundingBox(),
    page.locator('.mobile-bottom-nav').boundingBox(),
  ])
  expect(triggerBox?.y && triggerBox.height ? triggerBox.y + triggerBox.height : 0).toBeLessThan(navBox?.y ?? Number.POSITIVE_INFINITY)
})
