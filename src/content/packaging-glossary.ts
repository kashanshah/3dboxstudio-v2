// Packaging and dieline terms for /packaging-glossary, alphabetical. Each
// definition answers first, in a sentence or two, then gives a number or an
// example. Links use [text](/path). Keep claims to what is standard across
// the trade; anything that varies by printer says so.

export type GlossaryTerm = { term: string; id: string; aka?: string[]; definition: string };

export const GLOSSARY: GlossaryTerm[] = [
  { term: 'Auto lock bottom', id: 'auto-lock-bottom', aka: ['crash lock bottom'], definition: 'A carton bottom whose flaps are glued at the factory so it springs into place, locked, when the flat carton is opened. Faster to pack and stronger than a tuck bottom; see the [auto lock bottom box](/box-templates/auto-lock-bottom-box).' },
  { term: 'Bleed', id: 'bleed', definition: 'Artwork that runs past the cut line, usually 3 mm (1/8 in), so a slightly misaligned cut still leaves colour to the edge. On a dieline it is drawn as a line outside the cut.' },
  { term: 'Board', id: 'board', aka: ['paperboard'], definition: 'The sheet material a box is made from: folding boxboard and SBS for cartons, corrugated board for shipping boxes, greyboard for rigid boxes.' },
  { term: 'Caliper', id: 'caliper', definition: 'The thickness of a board, in millimetres, microns or points. Caliper, not weight, decides how much a box\'s panels must allow for folding: a dieline is drawn for one caliper.' },
  { term: 'Crease', id: 'crease', aka: ['score', 'fold line'], definition: 'A line pressed into the board so it folds cleanly there. Drawn dashed on a dieline, often in blue or green, on its own layer.' },
  { term: 'Cut line', id: 'cut-line', aka: ['knife line'], definition: 'Where the die cuts through the board: the outline of the box and any slots or windows. Drawn solid on a dieline, often in red, on its own layer.' },
  { term: 'Die', id: 'die', aka: ['cutting die', 'steel rule die'], definition: 'The tool that cuts and creases the board in one press: steel rules for cuts and blunter rules for creases, set in a board in the shape of the dieline.' },
  { term: 'Dieline', id: 'dieline', aka: ['die line', 'cutting template'], definition: 'The flat drawing of a box: every cut, crease and glue area at full size, used to make the die and to place the artwork. Make one in any size with the [dieline generator](/box-dieline-generator).' },
  { term: 'Dust flap', id: 'dust-flap', definition: 'The small flaps at the ends of a tuck end carton that fold in under the tuck, closing the corners and keeping dust out.' },
  { term: 'ECMA codes', id: 'ecma', definition: 'The European Carton Makers Association\'s numbering of folding carton styles, such as A20.20 for a reverse tuck end carton. Useful for telling a printer exactly which structure you mean.' },
  { term: 'FEFCO codes', id: 'fefco', definition: 'The European Federation of Corrugated Board Manufacturers\' numbering of corrugated box styles: 0201 is the regular slotted carton, 0427 the roll end tuck front mailer.' },
  { term: 'Flute', id: 'flute', definition: 'The wavy middle layer of corrugated board, and its size. E-flute is about 1.5 mm thick and B-flute about 3 mm, give or take by mill; finer flutes print better, bigger flutes cushion more.' },
  { term: 'Folding boxboard', id: 'fbb', aka: ['FBB'], definition: 'Multi-layer board with bleached outer layers and a mechanical pulp middle, light and stiff for its weight; a common board for retail cartons.' },
  { term: 'Glue flap', id: 'glue-flap', aka: ['manufacturer\'s joint'], definition: 'The narrow flap along one side of a carton that is glued to the opposite panel to close the tube. Usually 12–15 mm wide, with angled ends.' },
  { term: 'Grain direction', id: 'grain', definition: 'The direction the board\'s fibres run. Board folds more cleanly across the grain and is stiffer along it, so printers lay cartons out with the grain in a chosen direction.' },
  { term: 'gsm', id: 'gsm', aka: ['grams per square metre'], definition: 'The weight of paper or board: grams per square metre. It does not convert directly to thickness, because boards of the same weight differ in density.' },
  { term: 'Imposition', id: 'imposition', aka: ['nesting', 'step and repeat'], definition: 'Arranging several dielines on one press sheet to use as much of it as possible. Shapes that interlock save board.' },
  { term: 'Inside dimensions', id: 'inside-dimensions', aka: ['I.D.'], definition: 'The space inside the box, length × width × depth: the size the product needs. The usual way to order a box. See [inside vs outside dimensions](/blog/how-to-measure-a-box-inside-vs-outside-dimensions).' },
  { term: 'Kiss cut', id: 'kiss-cut', definition: 'A cut through only the top layer of a material, such as a label from its backing; on board, a partial cut that weakens a line for tearing or folding.' },
  { term: 'Manufacture dimensions', id: 'manufacture-dimensions', definition: 'The crease-to-crease sizes of the panels on the flat dieline, as a printer quotes them. They sit between the inside and outside sizes.' },
  { term: 'Outside dimensions', id: 'outside-dimensions', aka: ['O.D.'], definition: 'The size of the closed box including its board: what carriers measure for shipping and what fits on a shelf.' },
  { term: 'Perforation', id: 'perforation', definition: 'A line of short cuts with gaps between them, so the board tears along it: tear strips, display windows, easy-open tops.' },
  { term: 'Pillow box', id: 'pillow-box', definition: 'A box with two bowed faces and curved ends that fold in to close, needing no glue for the ends. See the [pillow box template](/box-templates/pillow-box).' },
  { term: 'Point (pt)', id: 'point', definition: 'A thousandth of an inch, the North American measure of board thickness: 18 pt board is 0.018 in, about 0.46 mm.' },
  { term: 'Regular slotted carton', id: 'rsc', aka: ['RSC', 'FEFCO 0201'], definition: 'The standard shipping box: four flaps top and bottom of equal length, the outer flaps meeting in the middle. Cheapest corrugated box per unit.' },
  { term: 'Reverse tuck end', id: 'reverse-tuck-end', aka: ['RTE', 'ECMA A20.20'], definition: 'A folding carton whose top and bottom tucks close from opposite sides. The most common retail carton; see the [reverse tuck end box](/box-templates/reverse-tuck-end-box).' },
  { term: 'Rigid box', id: 'rigid-box', aka: ['set-up box'], definition: 'A box made from thick greyboard wrapped in printed paper, assembled before shipping rather than folded flat. Used for premium gifts, jewellery and electronics.' },
  { term: 'Safe zone', id: 'safe-zone', aka: ['live area'], definition: 'The area inside the cut and crease lines, usually 3 mm in, where text and logos should stay so the cut or a fold never clips them.' },
  { term: 'SBS', id: 'sbs', aka: ['solid bleached sulphate'], definition: 'Board made from bleached pulp all the way through: bright white on both sides, used for cosmetics, pharmaceutical and food cartons.' },
  { term: 'Snap lock bottom', id: 'snap-lock-bottom', aka: ['1-2-3 bottom'], definition: 'A carton bottom of four flaps that interlock by hand, in order, without glue. Stronger than a tuck bottom; see the [snap lock bottom box](/box-templates/snap-lock-bottom-box).' },
  { term: 'Straight tuck end', id: 'straight-tuck-end', aka: ['STE', 'ECMA A15.20'], definition: 'A folding carton whose top and bottom tucks both close from the same side, leaving the front panel clean.' },
  { term: 'Telescope box', id: 'telescope-box', definition: 'A two-piece box whose lid slides down over the base; a full telescope lid reaches the bottom. See the [telescope box template](/box-templates/telescope-box).' },
  { term: 'Tuck flap', id: 'tuck-flap', definition: 'The flap on a carton\'s lid that slides inside the opposite wall to hold the lid shut, often with slits at its shoulders that lock it.' },
];
