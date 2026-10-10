import type { Expr } from '../expression';
import type { LineSpec, OutlineEntry, PanelSpec, ParametricTemplate } from '../format';

// The die every tuck end carton shares, as die makers draw them today (ECMA
// A20.20 reverse tuck, A15.20 straight tuck): one strip of glue flap, left,
// front, right and back, a lid at each end hinged on one of the four walls
// with a tuck tongue, and a dust flap on each of the two walls beside it.
// Width, depth and height are the inside of the carton; each panel is creased
// one board wider so the folded carton keeps that inside. The closures lock:
// slits at the tuck creases catch on the dust flaps' shoulders, the dust
// flaps crease one board below the lid so it closes flat over them, and the
// wall the tuck slides into is cut one board short, with a thumb notch.
//
// This builds the shared part of a definition. The top lid's wall is read
// from four values, `topOnFront`, `topOnBack`, `topOnLeft` and `topOnRight`
// (one of them 1), which a template sets from an option or as constants; the
// bottom lid's wall is fixed per template. Each template adds its own fold.

export type TuckWall = 'front' | 'back' | 'left' | 'right';

const STRIP: TuckWall[] = ['left', 'front', 'right', 'back'];
const DUST_ORDER: TuckWall[] = ['left', 'right', 'front', 'back'];
const OPPOSITE: Record<TuckWall, TuckWall> = { front: 'back', back: 'front', left: 'right', right: 'left' };
const BESIDE: Record<TuckWall, TuckWall[]> = { front: ['left', 'right'], back: ['left', 'right'], left: ['front', 'back'], right: ['front', 'back'] };
const ENDS = ['top', 'bottom'] as const;

const cap = (word: string) => word[0].toUpperCase() + word.slice(1);
/** A value for whichever wall the top lid is on. */
const topLidWall = (value: (wall: TuckWall) => string) =>
  `(topOnFront ? ${value('front')} : topOnBack ? ${value('back')} : topOnLeft ? ${value('left')} : ${value('right')})`;
/** Whether `wall` stands beside the top lid, so carries a top dust flap. */
const besideTopLid = (wall: TuckWall) => (wall === 'left' || wall === 'right' ? 'topOnFront || topOnBack' : 'topOnLeft || topOnRight');

/**
 * The tuck tongue's fold: pre-folded by `prefold`, then curled past square
 * just enough for its tip to clear the opposite wall while the lid (`lid`,
 * 0 upright to π/2 closed) comes down, and back to square inside it.
 */
export function tongueCurl(prefold: Expr, lid: Expr, reach: Expr, tongue: Expr, clearance: Expr) {
  return `min(pi * 0.85, max(${prefold}, ${prefold} > 0 ? pi - ${lid} - asin(clamp((${reach} * (1 - sin(${lid})) - ${clearance}) / ${tongue}, -1, 1)) : 0))`;
}

type Corner = [Expr, Expr];

export function tuckEndDie(config: {
  bottom: TuckWall;
  topRotation?: 0 | 180;
  bottomRotation?: 0 | 180;
  notes: ParametricTemplate['notes'];
}): Pick<ParametricTemplate, 'parameters' | 'derived' | 'panels' | 'slits' | 'validations' | 'notes'> {
  const B = cap(config.bottom);
  const lid = (end: 'top' | 'bottom', width: string, insideWidth: string, insideLength: string): [string, Expr][] => [
    [`${end}Width`, width],
    [`${end}InsideWidth`, insideWidth],
    // The lid reaches across the opening to the opposite wall.
    [`${end}InsideLength`, insideLength],
    [`${end}Length`, `${end}InsideLength + t`],
    // The tuck tongue slides down inside the opposite wall.
    [`${end}Tongue`, `max(4, min(clamp(0.4 * ${end}InsideLength, 12, 25), height / 3))`],
    [`${end}Shoulder`, `min(3, ${end}Tongue / 3)`],
    [`${end}Radius`, `max(1, min(clamp(0.6 * ${end}Tongue, 5, 15), ${end}Tongue - ${end}Shoulder, (${end}Width - 2 * tuckInset) / 2 - 1))`],
    [`${end}Slit`, `max(tuckInset + 1, min(clamp(0.04 * ${end}InsideWidth, 3, 6), ${end}Width / 4))`],
    [`${end}Bevel`, `${end}Radius * (1 - sqrt1_2)`],
  ];
  // Dust flaps leave room between their tips across the opening.
  const dust = (end: 'top' | 'bottom', wall: TuckWall): [string, Expr][] => {
    const name = `dust${cap(end)}${cap(wall)}`;
    return [
      [`${name}Height`, `max(4, min(${end}InsideWidth / 2 - t - 1.5, max(0.6 * inside${cap(wall)}, 12)))`],
      [`${name}Shoulder`, `min(3, ${name}Height / 3)`],
      [`${name}Taper`, `max(0, min((${name}Height - ${name}Shoulder) * tan(20 * pi / 180), (wall${cap(wall)} - 2 * dustRelief) / 2 - 2))`],
    ];
  };

  const derived: [string, Expr][] = [
    ['t', 'thickness'],
    ['glue', 'clamp(0.3 * min(width, depth) + 4, 10, 15)'],
    // Crease to crease; the back, which the glue flap is stuck to, takes half a board less.
    ['wallFront', 'width + t'], ['wallBack', 'width + t / 2'], ['wallLeft', 'depth + t'], ['wallRight', 'depth + t'],
    ['insideFront', 'width'], ['insideBack', 'width'], ['insideLeft', 'depth'], ['insideRight', 'depth'],
    ['bodyHeight', 'height + t'],
    ['glueSetback', 't + 1'],
    ['glueTaper', 'glue * tan(15 * pi / 180)'],
    ['dustRelief', 't + 0.5'],
    ['tuckInset', 't + 0.5'],
    ...lid('top', topLidWall(wall => `wall${cap(wall)}`), topLidWall(wall => `inside${cap(wall)}`), 'topOnFront || topOnBack ? depth : width'),
    ...lid('bottom', `wall${B}`, `inside${B}`, config.bottom === 'front' || config.bottom === 'back' ? 'depth' : 'width'),
    ...STRIP.flatMap(wall => dust('top', wall)),
    ...BESIDE[config.bottom].flatMap(wall => dust('bottom', wall)),
    ['topDust', 'topOnFront || topOnBack ? max(dustTopLeftHeight, dustTopRightHeight) : max(dustTopFrontHeight, dustTopBackHeight)'],
    ['top', 'max(topTongue + topLength, topDust)'],
    ['bottomCrease', 'top + bodyHeight'],
    ['xLeft', 'glue'], ['xFront', 'xLeft + wallLeft'], ['xRight', 'xFront + wallFront'], ['xBack', 'xRight + wallRight'],
    // Each wall runs from crease to crease where its lid hinges, and stops one
    // board short at an end where it has a dust flap or takes the tuck.
    ...STRIP.flatMap((wall): [string, Expr][] => [
      [`wallTop${cap(wall)}`, `top + (topOn${cap(wall)} ? 0 : t)`],
      [`wallBottom${cap(wall)}`, wall === config.bottom ? 'bottomCrease' : 'bottomCrease - t'],
    ]),
    ['topX', topLidWall(wall => `x${cap(wall)}`)],
    ['topHinge', 'top - topLength'],
    ['topTip', 'topHinge - topTongue'],
    ['topL', 'topX + tuckInset'],
    ['topR', 'topX + topWidth - tuckInset'],
    ['bottomHinge', 'bottomCrease + bottomLength'],
    ['bottomTip', 'bottomHinge + bottomTongue'],
    ['bottomL', `x${B} + tuckInset`],
    ['bottomR', `x${B} + bottomWidth - tuckInset`],
    ['glueTop', 'wallTopLeft + glueSetback'],
    ['glueBottom', 'wallBottomLeft - glueSetback'],
  ];

  const walled = (id: string) => ['glue', 'left', 'front', 'right', 'back', 'top', 'bottom'].includes(id);
  const layer = (id: string) => (id === 'top' || id === 'bottom' ? 2 : walled(id) && id !== 'glue' ? 1 : 0);
  const panel = (spec: PanelSpec): PanelSpec => ({ ...spec, layer: layer(spec.id), ...(walled(spec.id) ? {} : { closureFlap: true }) });

  const walls = STRIP.flatMap((wall): PanelSpec[] => {
    const W = cap(wall);
    const [x, y0, right, y1] = [`x${W}`, `wallTop${W}`, `x${W} + wall${W}`, `wallTop${W} + (wallBottom${W} - wallTop${W})`];
    const corners: [Corner, Corner, Corner, Corner] = [[x, y0], [right, y0], [right, y1], [x, y1]];
    // The wall the top tuck slides into has a thumb notch to open the carton.
    const notched = `topOn${cap(OPPOSITE[wall])}`;
    return [
      panel({ id: wall, label: wall.toUpperCase(), kind: 'body', when: `!${notched}`, rect: [x, y0, `wall${W}`, `wallBottom${W} - wallTop${W}`] }),
      panel({
        id: wall, label: wall.toUpperCase(), kind: 'body', when: notched, fold: corners,
        outline: [[x, y0], { arc: { center: [`x${W} + wall${W} / 2`, y0], radius: `min(10, inside${W} / 6)`, from: 180, to: 0, segments: 12 } }, ...corners.slice(1)],
      }),
    ];
  });

  // Straight shoulders below the crease, then rounded corners to the tip.
  const tuck = (end: 'top' | 'bottom'): PanelSpec => {
    const [h, tip, l, r, radius, shoulder, bevel] = ['Hinge', 'Tip', 'L', 'R', 'Radius', 'Shoulder', 'Bevel'].map(key => `${end}${key}`);
    const [sign, along] = end === 'top' ? ['-', '+'] : ['+', '-'];
    const [from, mid, to] = end === 'top' ? [0, -90, -180] : [0, 90, 180];
    return panel({
      id: `${end}-tuck`, label: `${end.toUpperCase()} TUCK`, kind: 'flap',
      outline: [
        [l, h], [r, h], [r, `${h} ${sign} ${shoulder}`],
        { arc: { center: [`${r} - ${radius}`, `${tip} ${along} ${radius}`], radius, from, to: mid } },
        { arc: { center: [`${l} + ${radius}`, `${tip} ${along} ${radius}`], radius, from: mid, to } },
        [l, `${h} ${sign} ${shoulder}`],
      ] as OutlineEntry[],
      fold: [[l, h], [r, h], [`${r} - ${bevel}`, tip], [`${l} + ${bevel}`, tip]],
    });
  };

  // A straight shoulder that the tuck's slit catches on, then a taper.
  const dustFlaps = DUST_ORDER.flatMap(wall => ENDS.flatMap((end): PanelSpec[] => {
    if (end === 'bottom' && !BESIDE[config.bottom].includes(wall)) return [];
    const name = `dust${cap(end)}${cap(wall)}`;
    const sign = end === 'top' ? '-' : '+';
    const h = `${end === 'top' ? 'wallTop' : 'wallBottom'}${cap(wall)}`;
    const [l, r] = [`x${cap(wall)} + dustRelief`, `x${cap(wall)} + wall${cap(wall)} - dustRelief`];
    const [tip, shoulder, taper] = [`${h} ${sign} ${name}Height`, `${h} ${sign} ${name}Shoulder`, `${name}Taper`];
    return [panel({
      id: `${end}-${wall}-dust`, label: `${end.toUpperCase()} ${wall.toUpperCase()} DUST FLAP`, kind: 'flap',
      ...(end === 'top' ? { when: besideTopLid(wall) } : {}),
      outline: [[l, h], [r, h], [r, shoulder], [`${r} - ${taper}`, tip], [`${l} + ${taper}`, tip], [l, shoulder]],
      fold: [[l, h], [r, h], [`${r} - ${taper}`, tip], [`${l} + ${taper}`, tip]],
    })];
  }));

  // Slit locks: the crease stops short of the tuck's ends.
  const slits: LineSpec[] = [
    { from: ['topL', 'topHinge'], to: ['topX + topSlit', 'topHinge'] },
    { from: ['topX + topWidth - topSlit', 'topHinge'], to: ['topR', 'topHinge'] },
    { from: ['bottomL', 'bottomHinge'], to: [`x${B} + bottomSlit`, 'bottomHinge'] },
    { from: [`x${B} + bottomWidth - bottomSlit`, 'bottomHinge'], to: ['bottomR', 'bottomHinge'] },
  ];

  return {
    parameters: {
      width: { fallback: 120, min: 1 },
      height: { fallback: 180, min: 1 },
      depth: { fallback: 55, min: 1 },
      thickness: { fallback: 0.5, min: 0.3, max: 2 },
    },
    derived,
    panels: [
      panel({ id: 'glue', label: 'GLUE', kind: 'glue', outline: [['glue', 'glueTop'], ['glue', 'glueBottom'], [0, 'glueBottom - glueTaper'], [0, 'glueTop + glueTaper']] }),
      ...walls,
      panel({ id: 'top', label: 'TOP', kind: 'flap', rect: ['topX', 'top - topLength', 'topWidth', 'topLength'], ...(config.topRotation ? { artworkRotation: config.topRotation } : {}) }),
      panel({ id: 'bottom', label: 'BOTTOM', kind: 'flap', rect: [`x${B}`, 'bottomCrease', 'bottomWidth', 'bottomLength'], ...(config.bottomRotation ? { artworkRotation: config.bottomRotation } : {}) }),
      tuck('top'),
      tuck('bottom'),
      ...dustFlaps,
    ],
    slits,
    validations: [
      { require: 'width >= 20', message: 'The width is too small for the glue flap, tucks and thumb notch. Use a width of at least 20 mm.' },
      { require: 'depth >= 10', message: 'The depth is too small for the glue flap and tuck. Use a depth of at least 10 mm.' },
      // The tuck tongue is at most a third of the height and needs about 8 mm to lock.
      { require: 'height >= 24', message: 'The height is too small for the tuck tongues to lock. Use a height of at least 24 mm.' },
    ],
    notes: config.notes,
  };
}

/** The hinge holding each dust flap the die has, in die order. */
export function dustFlapHinges(bottom: TuckWall, angle: (end: 'top' | 'bottom') => Expr, setback: Expr) {
  return DUST_ORDER.flatMap(wall => ENDS.flatMap(end => (end === 'bottom' && !BESIDE[bottom].includes(wall)
    ? []
    : [{ child: `${end}-${wall}-dust`, parent: wall, angle: angle(end), setback }])));
}

export const TUCK_END_FOLD = {
  root: 'front',
  thickness: 'max(0.05, min(thickness, min(width, depth) * 0.08))',
  offset: ['-(front.x + front.width / 2)', 'front.y + front.height / 2', 'depth / 2'] as [Expr, Expr, Expr],
};
