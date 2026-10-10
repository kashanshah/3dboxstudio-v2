// Autofill and IME can dispatch keydown events without a key.
export function shortcutKey(event: Pick<KeyboardEvent, 'key'>): string {
  return typeof event.key === 'string' ? event.key.toLowerCase() : '';
}
