import { describe, expect, it } from 'vitest'
import { type ComposerEvent, type ComposerState, composerReducer, initialComposerState } from '../state/composer'
import type { MeetingCandidate } from '../types/domain'

const candidate: MeetingCandidate = { provider: 'googleMeet', joinUrl: 'https://meet.google.com/abc-defg-hij', timezone: 'Asia/Ho_Chi_Minh' }
const file = new File(['x'], 'roster.pdf')
const fileItem = { id: 'f1', name: 'roster.pdf', size: 1, file }

const run = (...events: ComposerEvent[]) => events.reduce(composerReducer, initialComposerState)
const typed = (draft: string): ComposerEvent => ({ type: 'draftChanged', draft })
const request = (warning = false, found: MeetingCandidate | null = null): ComposerEvent => ({ type: 'sendRequested', warning, candidate: found })

describe('composerReducer', () => {
  it('sends a plain message and clears the composer', () => {
    const sending = run(typed('  Room 2 is ready  '), request())
    expect(sending).toMatchObject({ effect: 'send', sending: true, pendingBody: 'Room 2 is ready' })
    expect(composerReducer(sending, { type: 'sent' })).toEqual(initialComposerState)
  })

  it('ignores an empty draft and a second request while sending', () => {
    const empty = run(typed('   '))
    expect(composerReducer(empty, request())).toBe(empty)
    const sending = run(typed('Hi'), request())
    expect(composerReducer(sending, request())).toMatchObject({ effect: 'none', sending: true })
  })

  it('shows the Patient-information warning before sending, then sends on confirm', () => {
    const warned = run(typed('Check bed 4'), request(true, candidate))
    expect(warned).toMatchObject({ warningOpen: true, effect: 'none', sending: false, meetingCandidate: null })
    expect(composerReducer(warned, { type: 'warningConfirmed', candidate: null, canSend: true }))
      .toMatchObject({ warningOpen: false, effect: 'send', pendingBody: 'Check bed 4' })
  })

  it('checks for a Meeting after the warning is confirmed', () => {
    const warned = run(typed('Sync'), request(true))
    expect(composerReducer(warned, { type: 'warningConfirmed', candidate, canSend: true }))
      .toMatchObject({ warningOpen: false, meetingCandidate: candidate, effect: 'none' })
  })

  it('keeps the draft when the warning is dismissed', () => {
    const state = run(typed('Check bed 4'), request(true), { type: 'warningDismissed' })
    expect(state).toMatchObject({ warningOpen: false, draft: 'Check bed 4', sending: false, effect: 'none' })
  })

  it('creates a Meeting from a meeting candidate', () => {
    const meeting = run(typed('Sync'), request(false, candidate))
    expect(meeting).toMatchObject({ meetingCandidate: candidate, effect: 'none', pendingBody: 'Sync' })
    const creating = composerReducer(meeting, { type: 'meetingConfirmed' })
    expect(creating).toMatchObject({ sending: true, effect: 'createMeeting' })
    expect(composerReducer(creating, { type: 'sent' })).toEqual(initialComposerState)
  })

  it('sends a meeting candidate as a plain message', () => {
    const state = run(typed('Sync'), request(false, candidate), { type: 'sendPlain' })
    expect(state).toMatchObject({ effect: 'send', sending: true, pendingBody: 'Sync', meetingCandidate: candidate })
  })

  it('keeps the draft and files when the upload fails', () => {
    const sending = run(typed('Roster'), { type: 'filesChanged', files: [fileItem] }, request())
    const progressed = composerReducer(sending, { type: 'uploadProgressed', file, update: { status: 'failed', percentage: 40, error: 'Network' } })
    const failed = composerReducer(progressed, { type: 'failed', error: 'Upload failed' })
    expect(failed).toMatchObject({ draft: 'Roster', sending: false, error: 'Upload failed', effect: 'none' })
    expect(failed.files).toEqual([{ ...fileItem, status: 'failed', progress: 40, error: 'Network', attachmentId: undefined }])
  })

  it('clears the urgent flag after a send', () => {
    const urgent: ComposerState = run(typed('Fire drill now'), { type: 'urgentToggled' }, request())
    expect(urgent).toMatchObject({ urgent: true, effect: 'send' })
    expect(composerReducer(urgent, { type: 'sent' }).urgent).toBe(false)
  })

  it('does not send on warning confirm when the user can no longer send', () => {
    const warned = run(typed('Check bed 4'), request(true))
    expect(composerReducer(warned, { type: 'warningConfirmed', candidate: null, canSend: false }))
      .toMatchObject({ warningOpen: false, sending: false, effect: 'none', draft: 'Check bed 4' })
    expect(composerReducer(warned, { type: 'warningConfirmed', candidate, canSend: false }))
      .toMatchObject({ meetingCandidate: candidate, effect: 'none' })
  })

  it('ignores a second sendPlain while sending', () => {
    const sending = run(typed('Sync'), request(false, candidate), { type: 'sendPlain' })
    expect(composerReducer(sending, { type: 'sendPlain' })).toMatchObject({ sending: true, effect: 'none' })
  })

  it('ignores a second meetingConfirmed while sending', () => {
    const creating = run(typed('Sync'), request(false, candidate), { type: 'meetingConfirmed' })
    expect(composerReducer(creating, { type: 'meetingConfirmed' })).toMatchObject({ sending: true, effect: 'none' })
  })
})
