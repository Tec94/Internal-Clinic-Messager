import { forwardRef, type ButtonHTMLAttributes, type PropsWithChildren, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, LockKeyhole } from 'lucide-react'
import type { Channel, Presence } from '../types/domain'

type ButtonVariant = 'primary' | 'secondary'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  icon?: ReactNode
}

export function Button({
  children,
  className = '',
  variant = 'secondary',
  icon,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`button button--${variant} ${className}`}
      {...props}
    >
      {icon}
      <span>{children}</span>
    </button>
  )
}

export const IconButton = forwardRef<HTMLButtonElement, PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>>(function IconButton({
  children,
  className = '',
  ...props
}, ref) {
  return (
    <button ref={ref} type="button" className={`icon-button ${className}`} {...props}>
      {children}
    </button>
  )
})

export function Avatar({
  initials,
  presence,
  size = 'medium',
}: {
  initials: string
  presence?: Presence
  size?: 'small' | 'medium' | 'large'
}) {
  return (
    <span className={`avatar avatar--${size}`} aria-hidden="true">
      {initials}
      {presence ? <span className={`presence presence--${presence}`} /> : null}
    </span>
  )
}

export function StatusBadge({
  tone,
  children,
}: PropsWithChildren<{ tone: 'neutral' | 'active' | 'urgent' | 'critical' | 'success' }>) {
  return <span className={`status-badge status-badge--${tone}`}>{children}</span>
}

export function ChannelGlyph({ channel }: { channel: Channel }) {
  if (channel.type === 'leadership') return <LockKeyhole size={16} aria-hidden="true" />
  if (channel.isUrgent) return <AlertTriangle size={16} aria-hidden="true" />
  if (channel.type === 'incident') return <Clock3 size={16} aria-hidden="true" />
  if (channel.type === 'announcement') return <CheckCircle2 size={16} aria-hidden="true" />
  return <span className="channel-hash" aria-hidden="true">#</span>
}

export function ProgressBar({ value, tone = 'primary' }: { value: number; tone?: 'primary' | 'warning' }) {
  const normalized = Math.min(100, Math.max(0, value))
  return (
    <span className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={normalized} aria-label={`${normalized}%`}>
      <span
        className={`progress__value progress__value--${tone}`}
        style={{ inlineSize: `${normalized}%` }}
      />
    </span>
  )
}
