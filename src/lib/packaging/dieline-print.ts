import type { FullDielineArtworkLayer } from './full-dieline-artwork';

/** Physical page bounds in mm, including every rotated artwork corner. */
export function dielinePrintBounds(bounds: { width: number; height: number }, layers: FullDielineArtworkLayer[], margin = 3) {
  let left = 0, top = 0, right = bounds.width, bottom = bounds.height;
  for (const { transform: t } of layers) {
    const cx = bounds.width * t.x / 100, cy = bounds.height * t.y / 100;
    const w = bounds.width * t.width / 100, h = bounds.height * t.height / 100;
    const angle = t.rotation * Math.PI / 180;
    const dx = (Math.abs(w * Math.cos(angle)) + Math.abs(h * Math.sin(angle))) / 2;
    const dy = (Math.abs(w * Math.sin(angle)) + Math.abs(h * Math.cos(angle))) / 2;
    left = Math.min(left, cx - dx); right = Math.max(right, cx + dx);
    top = Math.min(top, cy - dy); bottom = Math.max(bottom, cy + dy);
  }
  return { left: left - margin, top: top - margin, width: right - left + 2 * margin, height: bottom - top + 2 * margin };
}

/** Browser print dialog supports Save as PDF without rasterizing the whole sheet. */
export async function printDielineLayout(board: HTMLElement, bounds: { width: number; height: number }, layers: FullDielineArtworkLayer[]) {
  const popup = window.open('', '_blank');
  if (!popup) throw new Error('Allow popups to print the 2D layout.');
  try {
    popup.opener = null;
    const page = dielinePrintBounds(bounds, layers);
    const doc = popup.document;
    doc.title = '3D Box Studio — 2D artwork layout';
    const style = doc.createElement('style');
    style.textContent = `
      @page{size:${page.width}mm ${page.height}mm;margin:0}
      *{box-sizing:border-box}
      html,body{margin:0;padding:0;background:white}
      body{width:${page.width}mm;height:${page.height}mm;position:relative;print-color-adjust:exact;-webkit-print-color-adjust:exact}
      .pro-dieline{position:absolute;left:${-page.left}mm;top:${-page.top}mm;width:${bounds.width}mm!important;height:${bounds.height}mm!important;max-width:none!important;max-height:none!important;transform:none!important;overflow:visible!important}
      .pro-full-artwork-print-surface{position:absolute;inset:0;overflow:visible;pointer-events:none}
      .pro-printed-artwork-layer{position:absolute;transform-origin:center}
      .pro-printed-artwork-layer img{display:block;width:100%;height:100%;object-fit:fill}
      .dl-live{position:absolute;border:.2mm solid #0075c4;background:transparent;z-index:30;display:flex;align-items:center;justify-content:center;overflow:hidden}
      .dl-glue{border-style:dashed}
      .dl-label{font:8pt sans-serif;color:#0075c4;position:relative;z-index:2}
      .artwork-layer{position:absolute;inset:0}
    `;
    doc.head.append(style);
    const clone = board.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.pro-full-artwork-transform, svg').forEach(element => element.remove());
    // Remove editor-only inline scale/pan; layout coordinates remain percentages.
    clone.style.transform = 'none';
    doc.body.append(clone);
    // Wait for the complete artwork before opening the print dialog.
    await Promise.all(Array.from(doc.images).map(image => image.decode()));
    await new Promise<void>(resolve => popup.requestAnimationFrame(() => popup.requestAnimationFrame(() => resolve())));
    popup.focus();
    popup.print();
  } catch (error) {
    popup.close();
    throw error;
  }
}
