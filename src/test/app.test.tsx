import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import i18n from '../i18n'
import { ClinicProvider, useClinic } from '../state/ClinicContext'

function renderApp(path: string) {
  document.documentElement.dataset.theme = 'graphite-indigo'
  localStorage.setItem('clinic-theme', 'graphite-indigo')
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <ClinicProvider>
          <App />
        </ClinicProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function DirectChannelProbe() {
  const { channels, ensureDirectChannel } = useClinic()
  const [openedIds, setOpenedIds] = useState<string[]>([])
  const directCount = channels.filter((channel) => channel.type === 'direct').length
  return (
    <div>
      <button type="button" onClick={() => {
        const channel = ensureDirectChannel('user-manager')
        setOpenedIds((items) => [...items, channel?.id ?? 'none'])
      }}>Open manager DM</button>
      <output aria-label="direct-count">{directCount}</output>
      <output aria-label="opened-ids">{openedIds.join(',')}</output>
    </div>
  )
}

describe('clinic messenger application', () => {
  beforeEach(async () => {
    localStorage.clear()
    await i18n.changeLanguage('en-US')
  })

  it('renders the employee inbox with the shared shell', () => {
    renderApp('/inbox')
    expect(screen.getByRole('heading', { name: /good morning, linh/i })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /primary/i })).toBeInTheDocument()
    expect(screen.getByText(/recent channels/i)).toBeInTheDocument()
  })

  it('opens the managed Zalo side panel from the sidebar without leaving the workspace', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({ closed: false, focus: vi.fn() } as unknown as Window)
    renderApp('/inbox')
    const navigation = screen.getByRole('navigation', { name: /primary/i })
    fireEvent.click(within(navigation).getByRole('button', { name: /open personal zalo messages/i }))
    expect(openSpy).toHaveBeenCalledWith('https://chat.zalo.me/', 'yksg-zalo-panel', expect.stringContaining('width=440'))
    openSpy.mockRestore()
  })

  it('keeps regular employees out of owner settings', async () => {
    renderApp('/admin/settings')
    expect(await screen.findByRole('heading', { name: /do not have access/i })).toBeInTheDocument()
  })

  it('allows the owner to open the administrative location view', async () => {
    localStorage.setItem('clinic-persona', 'user-owner')
    renderApp('/admin/locations')
    expect(await screen.findByRole('heading', { name: 'Locations' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add location/i })).toBeInTheDocument()
  })

  it('opens and cancels the authoritative channel creation dialog', async () => {
    const user = userEvent.setup()
    renderApp('/inbox')
    const createButtons = screen.getAllByRole('button', { name: /create channel/i })
    createButtons[0].focus()
    await user.click(createButtons[0])

    const dialog = screen.getByRole('dialog', {
      name: /create cross-department channel/i,
    })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByLabelText(/channel name/i)).toHaveValue(
      'same-day-schedule-dr-nguyen',
    )
    expect(screen.getAllByText(/no patient details/i)).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(dialog).not.toBeInTheDocument())
    await waitFor(() => expect(createButtons[0]).toHaveFocus())
  })

  it('uses the agreed primary navigation order and fixed graphite theme', () => {
    localStorage.setItem('clinic-theme', 'mineral-petrol')
    renderApp('/inbox')
    const navigation = screen.getByRole('navigation', { name: /primary navigation/i })
    expect(within(navigation).getAllByRole('link').map((link) => link.textContent)).toEqual(['Inbox', 'Chat', 'Tasks', 'Meetings', 'Documents', 'People'])
    expect(screen.queryByRole('radiogroup', { name: /appearance/i })).not.toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('data-theme', 'graphite-indigo')
    expect(localStorage.getItem('clinic-theme')).toBe('graphite-indigo')
  })

  it('offers the approved mobile destinations and permission-aware More menu', async () => {
    localStorage.setItem('clinic-persona', 'user-owner')
    const user = userEvent.setup()
    renderApp('/inbox')
    const mobileNavigation = screen.getByRole('navigation', { name: 'Mobile navigation' })
    expect(within(mobileNavigation).getByRole('link', { name: 'Inbox' })).toBeInTheDocument()
    expect(within(mobileNavigation).getByRole('link', { name: 'Chat' })).toBeInTheDocument()
    expect(within(mobileNavigation).getByRole('link', { name: 'Tasks' })).toBeInTheDocument()
    expect(within(mobileNavigation).getByRole('link', { name: 'Meetings' })).toBeInTheDocument()

    await user.click(within(mobileNavigation).getByRole('button', { name: 'More' }))

    const moreSheet = screen.getByRole('dialog', { name: 'More' })
    expect(within(moreSheet).getByRole('link', { name: 'Documents' })).toBeInTheDocument()
    expect(within(moreSheet).getByRole('link', { name: 'People' })).toBeInTheDocument()
    expect(within(moreSheet).getByRole('link', { name: 'Admin' })).toBeInTheDocument()
    expect(within(moreSheet).getByRole('link', { name: 'Settings' }))
      .toHaveAttribute('href', '/settings')
    expect(within(moreSheet).queryByRole('button', { name: 'EN' }))
      .not.toBeInTheDocument()
  })

  it('opens module-specific task search and task details', async () => {
    renderApp('/tasks/task-terminal')
    expect(await screen.findByPlaceholderText('Search tasks, owners, or chats')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Kiểm tra máy check-in B' })).toBeInTheDocument()
    expect(screen.getAllByText('Lễ tân — công việc chung').length).toBeGreaterThan(0)
  })

  it('confirms a detected meeting before posting it', async () => {
    const user = userEvent.setup()
    renderApp('/channels/front-desk-home')
    const composer = await screen.findByPlaceholderText(/Message #front-desk-home/i)
    await user.type(composer, 'Team sync July 7, 2026 at 10:00 AM https://meet.google.com/abc-defg-hij')
    await user.click(screen.getByRole('button', { name: 'Send message' }))
    const dialog = screen.getByRole('dialog', { name: 'Confirm meeting details' })
    await user.clear(within(dialog).getByLabelText('Meeting title'))
    await user.type(within(dialog).getByLabelText('Meeting title'), 'Front desk team sync')
    await user.click(within(dialog).getByRole('button', { name: 'Post invitation' }))
    expect(await screen.findByRole('heading', { name: 'Front desk team sync' })).toBeInTheDocument()
  })

  it('sends with Enter, keeps Shift+Enter as a newline, and ignores IME Enter', async () => {
    const user = userEvent.setup()
    renderApp('/channels/front-desk-home')
    const composer = await screen.findByPlaceholderText(/Message #front-desk-home/i)

    await user.type(composer, 'First line')
    await user.keyboard('{Shift>}{Enter}{/Shift}Second line')
    expect(composer).toHaveValue('First line\nSecond line')

    fireEvent.keyDown(composer, { key: 'Enter', isComposing: true })
    expect(composer).toHaveValue('First line\nSecond line')

    await user.keyboard('{Enter}')
    expect(await screen.findByText('First line Second line')).toBeInTheDocument()
    expect(composer).toHaveValue('')
  })

  it('shows the workspace menu outside messages and preserves the native composer menu', async () => {
    renderApp('/channels/front-desk-home')
    const composer = await screen.findByPlaceholderText(/Message #front-desk-home/i)

    expect(fireEvent.contextMenu(composer)).toBe(true)
    expect(screen.queryByRole('menu', { name: 'Workspace navigation' })).not.toBeInTheDocument()

    fireEvent.contextMenu(document.getElementById('main-content')!)
    const menu = screen.getByRole('menu', { name: 'Workspace navigation' })
    expect(within(menu).getByRole('menuitem', { name: 'Inbox' })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: 'Chat' })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: 'Tasks' })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: 'Documents' })).toBeInTheDocument()
  })

  it('opens the workspace menu after a touch long-press', async () => {
    renderApp('/inbox')
    const target = await screen.findByRole('heading', { name: /good morning, linh/i })

    fireEvent.pointerDown(target, { pointerType: 'touch', clientX: 32, clientY: 32 })
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 720))
    })

    expect(screen.getByRole('menu', { name: 'Workspace navigation' })).toBeInTheDocument()
    fireEvent.pointerUp(target, { pointerType: 'touch' })
  })

  it('uses message-specific copy and assignment actions', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    renderApp('/channels/front-desk-home')
    const messageBody = 'Chào buổi sáng. Hướng dẫn bàn giao mới đã được cập nhật để mọi người cùng sử dụng.'
    const message = (await screen.findByText(messageBody)).closest('article')!

    fireEvent.contextMenu(message)
    const copyMenu = screen.getByRole('menu', { name: 'Message actions' })
    expect(screen.queryByRole('menu', { name: 'Workspace navigation' })).not.toBeInTheDocument()
    await user.click(within(copyMenu).getByRole('menuitem', { name: 'Copy message' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(messageBody))

    fireEvent.contextMenu(message)
    await user.click(within(screen.getByRole('menu', { name: 'Message actions' })).getByRole('menuitem', { name: 'Assign task' }))
    expect(await screen.findByRole('dialog', { name: 'Assign task' })).toBeInTheDocument()
  })

  it('opens a direct message from the people page', async () => {
    const user = userEvent.setup()
    renderApp('/people')
    const peopleButtons = await screen.findAllByRole('button', { name: /Trần Thu Hà/i })
    await user.click(peopleButtons[peopleButtons.length - 1])
    expect(await screen.findByRole('heading', { level: 1, name: 'Trần Thu Hà' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Message #dm-/i)).toBeInTheDocument()
  })

  it('shows members and translated roles in the channel drawer', async () => {
    const user = userEvent.setup()
    renderApp('/channels/front-desk-home')
    await user.click(await screen.findByRole('button', { name: 'View members and roles' }))
    const dialog = screen.getByRole('dialog', { name: 'Channel members and roles' })
    expect(within(dialog).getByText('Phạm Ngọc Linh')).toBeInTheDocument()
    expect(within(dialog).getByText('Department lead')).toBeInTheDocument()
  })

  it('disables sending when a scoped viewer is not a channel member', async () => {
    localStorage.setItem('clinic-persona', 'user-owner')
    renderApp('/channels/front-desk-coverage')
    expect(await screen.findByPlaceholderText('View-only conversation')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
    expect(screen.getByText(/only active members/i)).toBeInTheDocument()
  })

  it('creates a task from a chat message assignment drawer', async () => {
    const user = userEvent.setup()
    renderApp('/channels/front-desk-home')
    const source = await screen.findByText('Chào buổi sáng. Hướng dẫn bàn giao mới đã được cập nhật để mọi người cùng sử dụng.')
    await user.hover(source.closest('article')!)
    await user.click((await screen.findAllByRole('button', { name: 'Assign this message as a task' }))[0])
    const dialog = screen.getByRole('dialog', { name: 'Assign task' })
    await user.clear(within(dialog).getByLabelText('Task title'))
    await user.type(within(dialog).getByLabelText('Task title'), 'Call facilities')
    await user.click(within(dialog).getByRole('button', { name: 'Create for myself' }))
    expect(await screen.findByText('Call facilities')).toBeInTheDocument()
  })

  it('uploads an attachment and links it to a sent chat message', async () => {
    const user = userEvent.setup()
    renderApp('/channels/front-desk-home')
    await user.click(await screen.findByRole('button', { name: 'Attach file' }))
    const file = new File(['handoff'], 'handoff.pdf', { type: 'application/pdf' })
    await user.upload(screen.getByLabelText('Upload files'), file)
    await user.type(screen.getByPlaceholderText(/Message #front-desk-home/i), 'Shared the handoff file')
    await user.click(screen.getByRole('button', { name: 'Send message' }))
    expect(await screen.findByText('handoff.pdf')).toBeInTheDocument()
  })

  it('displays event counters on the meetings mini schedule', async () => {
    renderApp('/meetings')
    expect(await screen.findByLabelText('July 7, 1 events')).toBeInTheDocument()
  })

  it('reuses an existing direct channel for repeated person opens', async () => {
    const user = userEvent.setup()
    render(<ClinicProvider><DirectChannelProbe /></ClinicProvider>)
    await user.click(screen.getByRole('button', { name: 'Open manager DM' }))
    expect(screen.getByLabelText('direct-count')).toHaveTextContent('1')
    await user.click(screen.getByRole('button', { name: 'Open manager DM' }))
    expect(screen.getByLabelText('direct-count')).toHaveTextContent('1')
    expect(screen.getByLabelText('opened-ids').textContent?.split(',')).toEqual(['dm-user-employee-user-manager', 'dm-user-employee-user-manager'])
  })

  it('traps the compact task sheet and restores focus when it closes', async () => {
    const originalMatchMedia = window.matchMedia
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({ matches: query.includes('1180'), media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }))
    const user = userEvent.setup()
    renderApp('/channels/same-day-schedule')
    const trigger = await screen.findByRole('button', { name: 'Open channel tasks' })
    await user.click(trigger)
    const sheet = await screen.findByRole('dialog', { name: /tasks.*documents/i })
    await user.click(within(sheet).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /tasks.*documents/i })).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())
    window.matchMedia = originalMatchMedia
  })

  it('limits the contextual document sheet to the current chat', async () => {
    const user = userEvent.setup()
    renderApp('/channels/same-day-schedule')
    await user.click(await screen.findByRole('button', { name: 'Open channel documents' }))
    const sheet = screen.getByRole('complementary', { name: /tasks.*documents/i })
    expect(within(sheet).getByText('Quy trình điều chỉnh lịch.pdf')).toBeInTheDocument()
    expect(within(sheet).queryByText('Hướng dẫn bàn giao lễ tân.pdf')).not.toBeInTheDocument()
  })
})
