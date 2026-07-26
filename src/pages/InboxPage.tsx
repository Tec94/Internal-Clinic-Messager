import { BellRing, FileUp, Plus, SquareCheckBig, SunMedium } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { useClinic } from '../state/ClinicContext'
import { useMessaging } from '../state/MessagingContext'
import { Avatar, Button, ChannelGlyph, StatusBadge } from '../components/ui'

export function InboxPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { currentUser, announcements, users } = useClinic()
  const {
    channels,
    members,
    currentMemberId,
    isProduction,
    isLoading,
    error,
    supportsChannelCreation,
  } = useMessaging()
  const { openCreateChannel } = useOutletContext<{ openCreateChannel: () => void }>()
  const recentChannels = channels
    .filter((channel) => (
      isProduction
      || channel.memberIds.includes(currentUser.id)
      || channel.visibility === 'public'
    ))
    .slice(0, 3)
  const signedInMember = members.find(
    (member) => member.memberId === currentMemberId,
  )
  const greetingName = (
    signedInMember?.fullName
    ?? currentUser.name
  ).split(' ').at(-1)
  const unreadContact = users.find((user) => user.id === 'user-float') ?? users[0]

  return (
    <div className="inbox-page page-scroll">
      <header className="page-intro inbox-intro">
        <SunMedium aria-hidden="true" />
        <div><h1>{t('inbox.greeting', { name: greetingName })}</h1><p>{t('inbox.caughtUp')}</p></div>
      </header>

      <div className="inbox-layout">
        <section className="inbox-section recent-section">
          <header><h2>{t('inbox.recentChannels')}</h2></header>
          <div className="recent-channel-list">
            {isLoading ? <p>{t('common.loading')}</p> : null}
            {error ? <p role="alert">{error}</p> : null}
            {recentChannels.map((channel) => (
              <Link to={`/channels/${channel.id}`} key={channel.id}>
                <ChannelGlyph channel={channel} />
                <span><strong># {channel.name}</strong><small>{channel.purpose}</small></span>
                {channel.unreadCount > 0 ? <span className="unread-badge">{channel.unreadCount}</span> : null}
              </Link>
            ))}
            {!isLoading && !error && recentChannels.length === 0
              ? <p>{t('common.noResults')}</p>
              : null}
          </div>
        </section>

        {!isProduction ? <div className="inbox-side-stack">
          <section className="inbox-section">
            <header><h2>{t('inbox.unreadMessages')}</h2></header>
            <button type="button" className="unread-contact">
              <Avatar initials={unreadContact.initials} presence={unreadContact.presence} />
              <span><strong>{unreadContact.name}</strong><small>Bạn xác nhận giúp thời gian bàn giao nhé?</small></span>
              <span className="unread-dot" />
            </button>
          </section>
          <section className="quick-actions-section">
            <h2>{t('inbox.quickActions')}</h2>
            <div>
              {supportsChannelCreation ? <Button icon={<Plus size={18} />} onClick={openCreateChannel}>{t('sidebar.createChannel')}</Button> : null}
              <Button icon={<SquareCheckBig size={18} />} onClick={() => navigate('/tasks')}>{t('inbox.createTask')}</Button>
              <Button icon={<FileUp size={18} />} onClick={() => navigate('/documents')}>{t('inbox.uploadFile')}</Button>
            </div>
          </section>
        </div> : null}

        {!isProduction ? <section className="inbox-section announcement-section">
          <header><h2>{t('inbox.announcements')}</h2><StatusBadge tone="neutral">{announcements.length}</StatusBadge></header>
          {announcements.slice(0, 2).map((announcement) => (
            <article key={announcement.id}>
              <BellRing size={20} aria-hidden="true" />
              <div><strong>{announcement.title}</strong><p>{announcement.body}</p></div>
            </article>
          ))}
        </section> : null}
      </div>
    </div>
  )
}
