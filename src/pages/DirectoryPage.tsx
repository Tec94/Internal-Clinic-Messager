import { UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Avatar, StatusBadge } from '../components/ui'
import { useClinic } from '../state/ClinicContext'

export function DirectoryPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { users, currentUser, assignments, locations, departments, roleBindings, ensureDirectChannel } = useClinic()

  const openDirectMessage = (userId: string) => {
    const channel = ensureDirectChannel(userId)
    if (channel) navigate(`/channels/${channel.id}`)
  }

  return (
    <div className="directory-page page-scroll">
      <header className="page-intro">
        <UserRound size={38} aria-hidden="true" />
        <div><h1>{t('nav.people')}</h1><p>{t('sidebar.searchPlaceholder')}</p></div>
      </header>
      <div className="directory-grid">
        {users.map((user) => {
          const assignment = assignments.find((item) => item.userId === user.id && item.isPrimary)
          const binding = roleBindings.find((item) => user.roleBindingIds.includes(item.id))
          return (
            <button className={`directory-person ${user.id === currentUser.id ? 'is-self' : ''}`} key={user.id} type="button" onClick={() => openDirectMessage(user.id)} disabled={user.id === currentUser.id}>
              <Avatar initials={user.initials} presence={user.presence} size="large" />
              <div><h2>{user.name}</h2><p>{user.title}</p><small>{departments.find((item) => item.id === assignment?.departmentId)?.name} · {locations.find((item) => item.id === assignment?.locationId)?.shortName}</small></div>
              <div className="directory-person__status"><StatusBadge tone={binding?.expiresAt ? 'urgent' : 'neutral'}>{t(`roles.${binding?.role ?? 'staff'}`)}</StatusBadge>{user.id === currentUser.id ? <span>{t('people.self')}</span> : null}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
