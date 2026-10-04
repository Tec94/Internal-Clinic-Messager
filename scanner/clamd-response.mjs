export function isCleanScanResult(reply) {
  // zINSTREAM replies end in NUL, which String.trim() does not remove.
  return reply === 'stream: OK\0'
}
