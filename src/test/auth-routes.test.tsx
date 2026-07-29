import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import { AuthProvider } from '../state/AuthContext'
import { ClinicProvider } from '../state/ClinicContext'

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  mfa: {
    getAuthenticatorAssuranceLevel: vi.fn(),
    listFactors: vi.fn(),
    enroll: vi.fn(),
    challengeAndVerify: vi.fn(),
  },
}))

const database = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('../utils/supabase', () => ({
  supabase: { auth, from: database.from, rpc: database.rpc },
}))

describe('Supabase auth routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    })
    auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
    auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal2' },
      error: null,
    })
    auth.mfa.listFactors.mockResolvedValue({
      data: { totp: [], phone: [] },
      error: null,
    })
    auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    })
    auth.signOut.mockResolvedValue({ error: null })
    database.rpc.mockResolvedValue({ data: null, error: null })
    mockMemberships([])
    vi.stubEnv('VITE_ENABLE_MFA_BYPASS', 'false')
  })

  it('redirects signed-out users to the invitation-only login', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/inbox']}>
        <AuthProvider>
          <App requireAuth />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.queryByText(/create account/i)).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Work email'), 'admin@example.test')
    await user.type(screen.getByLabelText('Password'), 'correct horse battery staple')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'admin@example.test',
      password: 'correct horse battery staple',
    })
  })

  it('restores an active AAL2 session only after membership is verified', async () => {
    restoreSession()
    mockMemberships([
      membership({
        onboarding_progress: { status: 'complete' },
      }),
    ])

    renderAuthenticatedApp()

    expect(await screen.findByRole('button', { name: 'Sign out' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Role')).not.toBeInTheDocument()
    expect(database.from).toHaveBeenCalledWith('organization_members')
  })

  it('keeps an AAL1 session on MFA when the client bypass is disabled', async () => {
    restoreSession()
    auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal1' },
      error: null,
    })

    renderAuthenticatedApp()

    expect(
      await screen.findByRole('heading', { name: 'Verify your identity' }),
    ).toBeInTheDocument()
    expect(database.rpc).not.toHaveBeenCalledWith(
      'begin_development_mfa_bypass',
    )
  })

  it('uses an unexpired server allowlist and labels the development bypass', async () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    vi.stubEnv('VITE_ENABLE_MFA_BYPASS', 'true')
    restoreSession()
    auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal1' },
      error: null,
    })
    database.rpc.mockImplementation(async (name: string) => (
      name === 'begin_development_mfa_bypass'
        ? { data: expiresAt, error: null }
        : { data: null, error: null }
    ))
    mockMemberships([
      membership({
        onboarding_progress: { status: 'complete' },
      }),
    ])

    renderAuthenticatedApp()

    expect(await screen.findByRole('button', { name: 'Sign out' })).toBeInTheDocument()
    expect(
      screen.getByText(/MFA bypass active for development testing/i),
    ).toBeInTheDocument()
    expect(database.rpc).toHaveBeenCalledWith(
      'begin_development_mfa_bypass',
    )
  })

  it('keeps suspended members outside the workspace', async () => {
    restoreSession()
    mockMemberships([
      membership({
        status: 'suspended',
        onboarding_progress: null,
      }),
    ])

    renderAuthenticatedApp()

    expect(
      await screen.findByRole('heading', { name: 'Access suspended' }),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Role')).not.toBeInTheDocument()
  })

  it('opens active members without the deferred onboarding flow', async () => {
    restoreSession()
    mockMemberships([
      membership({
        onboarding_progress: { status: 'policies' },
      }),
    ])

    renderAuthenticatedApp()

    expect(await screen.findByRole('button', { name: 'Sign out' }))
      .toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Finish account setup' }))
      .not.toBeInTheDocument()
  })
})

function restoreSession() {
  auth.getSession.mockResolvedValue({
    data: {
      session: {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
        token_type: 'bearer',
        user: {
          id: '10000000-0000-0000-0000-000000000001',
          email: 'member@example.test',
        },
      },
    },
    error: null,
  })
}

function membership(overrides: Record<string, unknown> = {}) {
  return {
    id: '20000000-0000-0000-0000-000000000001',
    organization_id: '00000000-0000-0000-0000-000000000001',
    status: 'active',
    starts_at: '2026-01-01T00:00:00.000Z',
    expires_at: null,
    onboarding_progress: { status: 'complete' },
    ...overrides,
  }
}

function mockMemberships(data: Array<Record<string, unknown>>) {
  const eq = vi.fn().mockResolvedValue({ data, error: null })
  const select = vi.fn().mockReturnValue({ eq })
  database.from.mockReturnValue({ select })
}

function renderAuthenticatedApp() {
  return render(
    <MemoryRouter initialEntries={['/inbox']}>
      <AuthProvider>
        <ClinicProvider>
          <App requireAuth />
        </ClinicProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}
