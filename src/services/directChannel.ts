// A Direct message is titled with the other participant's name, so the stored
// display name is only a fallback.
export function directChannelTitle(
  memberIds: readonly string[],
  currentMemberId: string,
  nameOf: (memberId: string) => string | undefined,
): string | undefined {
  const otherId = memberIds.find((memberId) => memberId !== currentMemberId)
  return otherId ? nameOf(otherId) : undefined
}
