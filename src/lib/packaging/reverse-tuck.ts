export type CartonDimensions = {
  width: number;
  height: number;
  depth: number;
  thickness: number;
  /**
   * Sizes the user set in place of the template's own, by key (a glue flap's
   * width, a tuck's length), in mm. Templates ignore keys they don't know.
   */
  adjustments?: Record<string, number>;
};

export type FoldStage = {
  id: 'walls' | 'back' | 'bottom' | 'top';
  label: string;
  start: number;
  end: number;
};

export type CartonPanel = {
  id: 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom' | 'glue';
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  kind: 'body' | 'flap' | 'glue';
};

export const REVERSE_TUCK_FOLD_STAGES: FoldStage[] = [
  { id: 'walls', label: 'Raise side walls', start: 0.08, end: 0.52 },
  { id: 'back', label: 'Wrap back panel', start: 0.26, end: 0.68 },
  { id: 'bottom', label: 'Close bottom', start: 0.54, end: 0.84 },
  { id: 'top', label: 'Close top', start: 0.70, end: 1.0 },
];

export function reverseTuckFoldState(progressPercent: number) {
  const progress = clamp(progressPercent / 100, 0, 1);
  const stage = (id: FoldStage['id']) => {
    const item = REVERSE_TUCK_FOLD_STAGES.find(entry => entry.id === id)!;
    const local = clamp((progress - item.start) / Math.max(0.001, item.end - item.start), 0, 1);
    return easeInOutCubic(local);
  };

  return {
    progress,
    walls: stage('walls'),
    back: stage('back'),
    bottom: stage('bottom'),
    top: stage('top'),
  };
}

export const DEFAULT_CARTON_DIMENSIONS: CartonDimensions = {
  width: 120,
  height: 180,
  depth: 55,
  thickness: 0.5,
};

export function sanitizeCartonDimensions(value: CartonDimensions): CartonDimensions {
  return {
    // Keep the entered physical size. The former UI-era maxima changed only
    // the dieline, while the renderer retained the original dimensions.
    width: Number.isFinite(value.width) ? Math.max(1,value.width) : DEFAULT_CARTON_DIMENSIONS.width,
    height: Number.isFinite(value.height) ? Math.max(1,value.height) : DEFAULT_CARTON_DIMENSIONS.height,
    depth: Number.isFinite(value.depth) ? Math.max(1,value.depth) : DEFAULT_CARTON_DIMENSIONS.depth,
    thickness: Number.isFinite(value.thickness) ? clamp(value.thickness, 0.3, 2) : DEFAULT_CARTON_DIMENSIONS.thickness,
  };
}

export function reverseTuckPanels(input: CartonDimensions): CartonPanel[] {
  const d = sanitizeCartonDimensions(input);
  const glue = Math.max(12, Math.min(24, d.depth * 0.35));
  const bodyY = d.depth;
  const body = [
    { id: 'glue' as const, label: 'GLUE', x: 0, width: glue, kind: 'glue' as const },
    { id: 'left' as const, label: 'LEFT', x: glue, width: d.depth, kind: 'body' as const },
    { id: 'front' as const, label: 'FRONT', x: glue + d.depth, width: d.width, kind: 'body' as const },
    { id: 'right' as const, label: 'RIGHT', x: glue + d.depth + d.width, width: d.depth, kind: 'body' as const },
    { id: 'back' as const, label: 'BACK', x: glue + d.depth + d.width + d.depth, width: d.width, kind: 'body' as const },
  ];

  const panels: CartonPanel[] = body.map(panel => ({
    ...panel,
    y: bodyY,
    height: d.height,
  }));

  panels.push(
    {
      id: 'top',
      label: 'TOP',
      x: glue + d.depth,
      y: 0,
      width: d.width,
      height: d.depth,
      kind: 'flap',
    },
    {
      id: 'bottom',
      label: 'BOTTOM',
      x: glue + d.depth,
      y: bodyY + d.height,
      width: d.width,
      height: d.depth,
      kind: 'flap',
    },
  );

  return panels;
}

export function reverseTuckBounds(input: CartonDimensions) {
  const panels = reverseTuckPanels(input);
  return {
    width: Math.max(...panels.map(p => p.x + p.width)),
    height: Math.max(...panels.map(p => p.y + p.height)),
  };
}

function easeInOutCubic(value: number) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}
