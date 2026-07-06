import { describe, expect, it } from 'vitest'
import { en } from '../i18n/locales/en'
import { vi } from '../i18n/locales/vi'

function flatten(value: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, item]) => {
    const next = prefix ? `${prefix}.${key}` : key
    return typeof item === 'object' && item !== null
      ? flatten(item as Record<string, unknown>, next)
      : [next]
  })
}

describe('localization catalogs', () => {
  it('keeps English and Vietnamese keys in complete parity', () => {
    expect(flatten(vi).sort()).toEqual(flatten(en).sort())
  })
})
