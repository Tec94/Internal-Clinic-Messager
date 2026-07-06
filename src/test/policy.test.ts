import { describe, expect, it } from 'vitest'
import { inspectOperationalContent } from '../services/mockClinicService'

describe('operational-only content warnings', () => {
  it('does not warn for ordinary operational coordination', () => {
    expect(
      inspectOperationalContent(
        'Front desk needs one additional coordinator at 2:00 PM.',
      ),
    ).toEqual([])
  })

  it('warns without blocking when likely identifiers are present', () => {
    const warnings = inspectOperationalContent(
      'The patient record has MRN 123456 and needs review.',
    )
    expect(warnings.map((warning) => warning.ruleId)).toContain('possible-mrn')
    expect(warnings[0].field).toBe('message')
  })

  it('supports warnings in channel metadata', () => {
    const warnings = inspectOperationalContent(
      'Discuss patient named in referral',
      'purpose',
    )
    expect(warnings[0].field).toBe('purpose')
  })
})
