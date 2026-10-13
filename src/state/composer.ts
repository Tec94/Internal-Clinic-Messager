import { useCallback, useRef, useState } from 'react'
import type { FileUploadItem } from '../components/ui/motion/file-upload'
import type { MeetingCandidate } from '../types/domain'
import type { AttachmentUploadUpdate } from './MessagingContext'

export interface ComposerState {
  draft: string
  urgent: boolean
  files: FileUploadItem[]
  attachmentsOpen: boolean
  error: string
  sending: boolean
  /** Trimmed text held while the Patient-information warning or the meeting dialog is open. */
  pendingBody: string
  warningOpen: boolean
  meetingCandidate: MeetingCandidate | null
  /** What the page must do after this event: upload and send, or create the Meeting. */
  effect: 'none' | 'send' | 'createMeeting'
}

export type ComposerEvent =
  | { type: 'draftChanged', draft: string }
  | { type: 'urgentToggled' }
  | { type: 'filesChanged', files: FileUploadItem[] }
  | { type: 'attachmentsToggled' }
  | { type: 'attachmentsClosed' }
  // The page runs the detectors; the reducer only orders their results.
  | { type: 'sendRequested', warning: boolean, candidate: MeetingCandidate | null }
  | { type: 'warningConfirmed', candidate: MeetingCandidate | null, canSend: boolean }
  | { type: 'warningDismissed' }
  | { type: 'meetingDismissed' }
  | { type: 'meetingConfirmed' }
  | { type: 'sendPlain' }
  | { type: 'uploadProgressed', file: File, update: AttachmentUploadUpdate }
  | { type: 'sent' }
  | { type: 'failed', error: string }

export const initialComposerState: ComposerState = {
  draft: '',
  urgent: false,
  files: [],
  attachmentsOpen: false,
  error: '',
  sending: false,
  pendingBody: '',
  warningOpen: false,
  meetingCandidate: null,
  effect: 'none',
}

function startSend(state: ComposerState, body: string): ComposerState {
  return { ...state, pendingBody: body, sending: true, error: '', effect: 'send' }
}

function continueSend(state: ComposerState, body: string, candidate: MeetingCandidate | null): ComposerState {
  return candidate ? { ...state, pendingBody: body, meetingCandidate: candidate } : startSend(state, body)
}

function transition(state: ComposerState, event: ComposerEvent): ComposerState {
  switch (event.type) {
    case 'draftChanged': return { ...state, draft: event.draft }
    case 'urgentToggled': return { ...state, urgent: !state.urgent }
    case 'filesChanged': return { ...state, files: event.files }
    case 'attachmentsToggled': return { ...state, attachmentsOpen: !state.attachmentsOpen }
    case 'attachmentsClosed': return { ...state, attachmentsOpen: false }
    case 'sendRequested': {
      if (state.sending) return state
      const body = state.draft.trim()
      if (!body && state.files.length === 0) return state
      if (event.warning) return { ...state, pendingBody: body, warningOpen: true }
      return continueSend(state, body, event.candidate)
    }
    case 'warningConfirmed': {
      const closed = { ...state, warningOpen: false }
      // canSend may change while the warning is open; a Meeting candidate is still shown, as before.
      if (!event.canSend && !event.candidate) return closed
      return continueSend(closed, state.pendingBody, event.candidate)
    }
    case 'warningDismissed': return { ...state, warningOpen: false }
    case 'meetingDismissed': return { ...state, meetingCandidate: null }
    case 'meetingConfirmed': return state.sending ? state : { ...state, sending: true, error: '', effect: 'createMeeting' }
    case 'sendPlain': return state.sending ? state : startSend(state, state.pendingBody)
    case 'uploadProgressed': return {
      ...state,
      files: state.files.map((item) => (
        item.file === event.file
          ? {
              ...item,
              status: event.update.status,
              progress: event.update.percentage,
              attachmentId: event.update.attachmentId ?? item.attachmentId,
              error: event.update.error,
            }
          : item
      )),
    }
    case 'sent': return { ...initialComposerState }
    case 'failed': return { ...state, sending: false, error: event.error }
  }
}

export function composerReducer(state: ComposerState, event: ComposerEvent): ComposerState {
  // effect lives for one event only, so clear it before the transition.
  return transition(state.effect === 'none' ? state : { ...state, effect: 'none' }, event)
}

/** Like useReducer, but dispatch returns the next state so the page can perform its effect at once. */
export function useComposer() {
  const [state, setState] = useState(initialComposerState)
  const latest = useRef(state)
  const dispatch = useCallback((event: ComposerEvent) => {
    latest.current = composerReducer(latest.current, event)
    setState(latest.current)
    return latest.current
  }, [])
  return [state, dispatch] as const
}
