import assert from 'node:assert/strict'
import test from 'node:test'
import { isCleanScanResult } from './clamd-response.mjs'

test('accepts the complete clean zINSTREAM reply', () => {
  assert.equal(isCleanScanResult('stream: OK\0'), true)
})

test('rejects infected, failed, incomplete, and unexpected scanner replies', () => {
  for (const reply of [
    'stream: Eicar-Signature FOUND\0',
    'INSTREAM size limit exceeded. ERROR\0',
    'stream: OK',
    'stream: OK\n',
    'unexpected OK\0',
    'stream: Eicar-Signature FOUND\0stream: OK\0',
    '',
  ]) {
    assert.equal(isCleanScanResult(reply), false, JSON.stringify(reply))
  }
})
