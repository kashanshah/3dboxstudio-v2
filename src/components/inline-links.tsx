import Link from 'next/link';

/** Text with light markdown links to site pages: "[label](/path)". */
export function inlineLinks(text: string) {
  const parts = text.split(/(\[[^\]]+\]\(\/[^)]+\))/g);
  return parts.map((part, index) => {
    const match = /^\[([^\]]+)\]\((\/[^)]+)\)$/.exec(part);
    return match ? <Link key={index} href={match[2]}>{match[1]}</Link> : part;
  });
}
