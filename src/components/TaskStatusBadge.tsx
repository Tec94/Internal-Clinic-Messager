import { useTranslation } from 'react-i18next'
import type { TaskStatus } from '../types/domain'
import { StatusBadge } from './ui'

const tones: Record<TaskStatus, 'neutral' | 'active' | 'urgent' | 'critical' | 'success'> = {
  pendingAcceptance: 'urgent',
  accepted: 'active',
  inProgress: 'active',
  blocked: 'critical',
  done: 'success',
  declined: 'urgent',
  canceled: 'neutral',
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const { t } = useTranslation()
  return <StatusBadge tone={tones[status]}>{t(`task.status.${status}`)}</StatusBadge>
}
