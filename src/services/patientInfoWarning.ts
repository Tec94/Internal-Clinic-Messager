import type { PolicyWarning } from '../types/domain'

const warningPatterns = [
  { ruleId: 'possible-mrn', expression: /\b(?:mrn|medical record)\s*[:#-]?\s*\d{4,}\b/i },
  { ruleId: 'possible-date-of-birth', expression: /\b(?:dob|date of birth)\s*[:#-]?/i },
  { ruleId: 'patient-language', expression: /\bpatient\s+(?:named|name|case|record)\b/i },
]

export function inspectOperationalContent(
  value: string,
  field: PolicyWarning['field'] = 'message',
): PolicyWarning[] {
  return warningPatterns.flatMap((pattern, index) => {
    const match = value.match(pattern.expression)
    if (!match) return []
    return [
      {
        id: `warning-${Date.now()}-${index}`,
        field,
        ruleId: pattern.ruleId,
        messageKey: 'policy.possiblePhi',
        matchedText: match[0],
        createdAt: new Date().toISOString(),
      },
    ]
  })
}
