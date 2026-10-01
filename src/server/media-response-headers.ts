/** Encode user filenames without putting Unicode or control characters in headers. */
export function inlineContentDisposition(name: string): string {
  const filename = name.toWellFormed().replace(/[\r\n\x00-\x1f\x7f]/g, '_');
  const fallback = filename.replace(/[^\x20-\x7e]|["\\]/g, '_') || 'artwork';
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `inline; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
