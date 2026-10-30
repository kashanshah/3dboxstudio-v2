import type { QuoteBox } from '@/content/print-quote';
import type { CartonDimensions } from '@/lib/packaging/reverse-tuck';
import { styleForTemplate } from '@/lib/dieline/styles';
import { MATERIALS } from '@/lib/dieline/state';

/**
 * A Studio box as the print quote form describes it: the generator's style,
 * its inside size and board, and a generator link that redraws the same
 * dieline for whoever answers the request (the Studio project is private).
 * The Studio's width × height × depth are the generator's length × depth ×
 * width, as on the template pages. Null for a box with no generator style.
 */
export function studioQuoteBox(templateId: string, dimensions: CartonDimensions, finish?: string | null): QuoteBox | null {
  const style = styleForTemplate(templateId);
  if (!style) return null;
  const size = { length: dimensions.width, width: dimensions.depth, depth: dimensions.height };
  const material = MATERIALS.find(item => Math.abs(item.thickness - dimensions.thickness) < 1e-6)?.label ?? 'Custom board';
  const query = new URLSearchParams({ style: style.id, l: String(size.length), w: String(size.width), d: String(size.depth), u: 'mm', mode: 'inner', t: String(dimensions.thickness) });
  return {
    style: style.id, styleName: style.name, ...size, units: 'mm', mode: 'inside', material, thickness: dimensions.thickness,
    link: `/box-dieline-generator?${query}`, source: 'studio', ...(finish ? { finish } : {}),
  };
}
