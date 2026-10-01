/** Normalize path/query IDs that may arrive still percent-encoded (e.g. `v1%3Aid`). */
export function decodeRouteParam(value: string): string {
  let current = value;
  for (let i = 0; i < 2; i++) {
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) break;
      current = decoded;
    } catch {
      break;
    }
  }
  return current;
}
