import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Drawer } from './ui/motion/drawer'
import { Avatar, IconButton, StatusBadge } from './ui'
import { useClinic } from '../state/ClinicContext'
import type { Channel } from '../types/domain'

export function ChannelMembersDrawer({
  channel,
  open,
  onOpenChange,
}: {
  channel: Channel
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const { users, roleBindings, assignments, departments, locations, memberships } = useClinic()
  const channelMemberships = channel.memberIds.map((userId) => ({
    user: users.find((user) => user.id === userId),
    membership: memberships.find((item) => item.channelId === channel.id && item.userId === userId),
  })).filter((item) => item.user)

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      ariaLabel={t('channel.membersDrawer')}
      className="workspace-drawer member-drawer"
      backdropClassName="workspace-drawer-backdrop"
    >
      <header className="drawer-header">
        <div>
          <span>{t('common.members')}</span>
          <h2>{channel.displayName}</h2>
        </div>
        <IconButton onClick={() => onOpenChange(false)} aria-label={t('common.close')}><X size={20} /></IconButton>
      </header>
      <div className="member-drawer__list">
        {channelMemberships.map(({ user, membership }) => {
          if (!user) return null
          const binding = roleBindings.find((item) => user.roleBindingIds.includes(item.id))
          const primaryAssignment = assignments.find((item) => item.userId === user.id && item.isPrimary)
          const department = departments.find((item) => item.id === primaryAssignment?.departmentId)
          const location = locations.find((item) => item.id === primaryAssignment?.locationId)
          return (
            <article className="member-row" key={user.id}>
              <Avatar initials={user.initials} presence={user.presence} />
              <div>
                <h3>{user.name}</h3>
                <p>{user.title}</p>
                <small>{department?.name ?? t('common.department')} · {location?.shortName ?? t('common.location')}</small>
              </div>
              <div className="member-row__meta">
                <StatusBadge tone={binding?.expiresAt ? 'urgent' : 'neutral'}>{t(`roles.${binding?.role ?? 'staff'}`)}</StatusBadge>
                <span>{t(`membership.${membership?.source ?? 'invitation'}`)}</span>
                {membership?.expiresAt ? <time dateTime={membership.expiresAt}>{t('common.expires')}: {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(membership.expiresAt))}</time> : null}
              </div>
            </article>
          )
        })}
      </div>
    </Drawer>
  )
}
