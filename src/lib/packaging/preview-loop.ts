/** Hold at both ends, with a slow eased opening and closing between them. */
export function previewLoopProgress(elapsedMs: number, openProgress = 0) {
  const hold = 800, travel = 3000, cycle = 2 * (hold + travel);
  const time = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) % cycle : 0;
  const open = Math.max(0, Math.min(100, openProgress));
  const ease = (t: number) => t * t * (3 - 2 * t);
  if (time < hold) return 100;
  if (time < hold + travel) return 100 - (100 - open) * ease((time - hold) / travel);
  if (time < 2 * hold + travel) return open;
  return open + (100 - open) * ease((time - 2 * hold - travel) / travel);
}
