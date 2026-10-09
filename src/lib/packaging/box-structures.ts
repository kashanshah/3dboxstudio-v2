export type DielinePanel = {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  kind: 'body' | 'flap' | 'glue';
  /**
   * Artwork placed on this panel by itself is turned this much on the sheet,
   * so it reads upright on the folded box (a panel printed upside down).
   */
  artworkRotation?: 0 | 180;
  /** The cut outline when the panel is not a plain rectangle. */
  outline?: { x: number; y: number }[];
  /**
   * Four corners the 3D model folds, when the cut outline has more (rounded
   * tuck corners, a thumb notch): the same panel, simplified to a quad.
   */
  fold?: { x: number; y: number }[];
};

export function dielineBounds(panels:DielinePanel[]){
  return {
    width:Math.max(...panels.map(panel=>panel.x+panel.width)),
    height:Math.max(...panels.map(panel=>panel.y+panel.height)),
  };
}

