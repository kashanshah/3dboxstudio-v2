// Die lines with curves or tapers come from sin, cos and tan, whose last
// digit can differ between the server and the browser. Drawn to the
// thousandth of a millimetre, both render the same markup, so pages that
// show a die hydrate cleanly.

export function svgNumber(value: number) {
  return Math.round(value * 1000) / 1000;
}

/** An SVG `points` list for an outline. */
export function svgPoints(outline: { x: number; y: number }[]) {
  return outline.map(point => `${svgNumber(point.x)},${svgNumber(point.y)}`).join(' ');
}

/** SVG `<line>` attributes for a segment. */
export function svgLine(line: { start: { x: number; y: number }; end: { x: number; y: number } }) {
  return { x1: svgNumber(line.start.x), y1: svgNumber(line.start.y), x2: svgNumber(line.end.x), y2: svgNumber(line.end.y) };
}

/** A CSS percentage, for panel boxes and clip paths placed on the sheet. */
export function cssPercent(value: number) {
  return `${Math.round(value * 10000) / 10000}%`;
}
