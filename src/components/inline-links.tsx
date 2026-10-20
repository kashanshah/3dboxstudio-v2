import Link from 'next/link';

/** Text with light markdown links: "[label](/path)" to site pages, "[label](https://…)" to other sites (new tab). */
export function inlineLinks(text: string) {
  const parts = text.split(/(\[[^\]]+\]\((?:\/|https:\/\/)[^)]+\))/g);
  return parts.map((part, index) => {
    const match = /^\[([^\]]+)\]\(((?:\/|https:\/\/)[^)]+)\)$/.exec(part);
    if (!match) return part;
    return match[2].startsWith('/')
      ? <Link key={index} href={match[2]}>{match[1]}</Link>
      : <a key={index} href={match[2]} target="_blank" rel="noopener">{match[1]}</a>;
  });
}
