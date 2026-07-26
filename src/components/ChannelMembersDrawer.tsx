import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Drawer } from './ui/motion/drawer'
import { Avatar, IconButton, StatusBadge } from './ui'
import { useClinic } from '../state/ClinicContext'
import { useMessaging } from '../state/MessagingContext'
import type { Channel } from '../types/domain'

const membershipDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
})

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
  const messaging = useMessaging()

  if (messaging.isProduction) {
    const activeMemberIds = new Set(channel.memberIds)
    const channelMembers = messaging.members.filter(
      (member) => (
        member.status === 'active'
        && activeMemberIds.has(member.memberId)
      ),
    )
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
          {channelMembers.map((member) => (
            <article className="member-row" key={member.memberId}>
              <Avatar initials={member.initials} presence={member.presence} />
              <div>
                <h3>{member.fullName}</h3>
                <p>{member.workEmail}</p>
              </div>
              <div className="member-row__meta">
                <StatusBadge tone="neutral">
                  {member.employmentType}
                </StatusBadge>
              </div>
            </article>
          ))}
        </div>
      </Drawer>
    )
  }

  const channelMemberships = channel.memberIds.flatMap((userId) => {
    const user = users.find((item) => item.id === userId)
    return user
      ? [{
          user,
          membership: memberships.find(
            (item) => item.channelId === channel.id && item.userId === userId,
          ),
        }]
      : []
  })

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
                {membership?.expiresAt ? <time dateTime={membership.expiresAt}>{t('common.expires')}: {membershipDateFormatter.format(new Date(membership.expiresAt))}</time> : null}
              </div>
            </article>
          )
        })}
      </div>
    </Drawer>
  )
}
