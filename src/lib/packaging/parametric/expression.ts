// A small, safe arithmetic language for parametric template definitions, so a
// template can be stored as plain data (JSON, a database row) and still say
// "the panel is one board wider than the inside width": `width + t`.
//
// Numbers, named values (`depth`, `front.x`), + - * / %, comparisons, && || !,
// `a ? b : c` and a fixed set of functions, including `stage(value, start,
// end)`, the eased 0 → 1 the fold timings use. Comparisons and logic give 1 or 0.
// Nothing else is reachable: no property access, no globals, no eval.

export type Expr = number | string;
export type Scope = Readonly<Record<string, number>>;

type Node =
  | { k: 'num'; v: number }
  | { k: 'var'; name: string }
  | { k: 'unary'; op: '-' | '!'; a: Node }
  | { k: 'binary'; op: string; a: Node; b: Node }
  | { k: 'cond'; test: Node; a: Node; b: Node }
  | { k: 'call'; fn: string; args: Node[] };

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  min: Math.min,
  max: Math.max,
  abs: Math.abs,
  sqrt: Math.sqrt,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan2: Math.atan2,
  pow: Math.pow,
  clamp: (value, low, high) => Math.min(high, Math.max(low, value)),
  /** Eases 0 → 1 as `value` runs from `start` to `end`, for fold timing. */
  stage: (value, start, end) => {
    const x = Math.min(1, Math.max(0, (value - start) / (end - start)));
    return x * x * (3 - 2 * x);
  },
};

const CONSTANTS: Record<string, number> = { pi: Math.PI, sqrt1_2: Math.SQRT1_2 };

const BINARY_PRECEDENCE: Record<string, number> = {
  '||': 1, '&&': 2,
  '==': 3, '!=': 3,
  '<': 4, '<=': 4, '>': 4, '>=': 4,
  '+': 5, '-': 5,
  '*': 6, '/': 6, '%': 6,
};

export class ExpressionError extends Error {}

function tokenize(source: string) {
  const tokens: string[] = [];
  const pattern = /\s*(?:(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+(?:e[+-]?\d+)?)|([A-Za-z_][\w.]*)|(<=|>=|==|!=|&&|\|\||[-+*/%<>!?:(),]))/iy;
  let index = 0;
  while (index < source.length) {
    if (/^\s*$/.test(source.slice(index))) break;
    pattern.lastIndex = index;
    const match = pattern.exec(source);
    if (!match) throw new ExpressionError(`Unexpected "${source.slice(index).trim()[0]}" in "${source}"`);
    tokens.push(match[1] ?? match[2] ?? match[3]);
    index = pattern.lastIndex;
  }
  return tokens;
}

function parse(source: string): Node {
  const tokens = tokenize(source);
  let position = 0;
  const peek = () => tokens[position];
  const take = (expected?: string) => {
    const token = tokens[position++];
    if (token === undefined) throw new ExpressionError(`"${source}" ends too early`);
    if (expected !== undefined && token !== expected) throw new ExpressionError(`Expected "${expected}" but found "${token}" in "${source}"`);
    return token;
  };

  const primary = (): Node => {
    const token = take();
    if (token === '(') {
      const inner = conditional();
      take(')');
      return inner;
    }
    if (token === '-' || token === '!') return { k: 'unary', op: token, a: primary() };
    if (token === '+') return primary();
    if (/^[\d.]/.test(token)) return { k: 'num', v: Number(token) };
    if (/^[A-Za-z_]/.test(token)) {
      if (peek() !== '(') return { k: 'var', name: token };
      if (!(token in FUNCTIONS)) throw new ExpressionError(`Unknown function "${token}" in "${source}"`);
      take('(');
      const args: Node[] = [];
      if (peek() !== ')') {
        do args.push(conditional());
        while (peek() === ',' && take(','));
      }
      take(')');
      return { k: 'call', fn: token, args };
    }
    throw new ExpressionError(`Unexpected "${token}" in "${source}"`);
  };

  const binary = (minimum: number): Node => {
    let left = primary();
    for (let op = peek(); op in BINARY_PRECEDENCE && BINARY_PRECEDENCE[op] >= minimum; op = peek()) {
      take();
      left = { k: 'binary', op, a: left, b: binary(BINARY_PRECEDENCE[op] + 1) };
    }
    return left;
  };

  const conditional = (): Node => {
    const test = binary(1);
    if (peek() !== '?') return test;
    take('?');
    const a = conditional();
    take(':');
    return { k: 'cond', test, a, b: conditional() };
  };

  const tree = conditional();
  if (position < tokens.length) throw new ExpressionError(`Unexpected "${tokens[position]}" in "${source}"`);
  return tree;
}

function run(node: Node, scope: Scope, source: string): number {
  switch (node.k) {
    case 'num': return node.v;
    case 'var': {
      if (Object.hasOwn(scope, node.name)) return scope[node.name];
      if (Object.hasOwn(CONSTANTS, node.name)) return CONSTANTS[node.name];
      throw new ExpressionError(`Unknown value "${node.name}" in "${source}"`);
    }
    case 'unary': {
      const a = run(node.a, scope, source);
      return node.op === '-' ? -a : Number(!a);
    }
    case 'cond': return run(node.test, scope, source) ? run(node.a, scope, source) : run(node.b, scope, source);
    case 'call': return FUNCTIONS[node.fn](...node.args.map(arg => run(arg, scope, source)));
    case 'binary': {
      const a = run(node.a, scope, source);
      if (node.op === '&&') return a ? Number(Boolean(run(node.b, scope, source))) : 0;
      if (node.op === '||') return a ? 1 : Number(Boolean(run(node.b, scope, source)));
      const b = run(node.b, scope, source);
      switch (node.op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return a / b;
        case '%': return a % b;
        case '<': return Number(a < b);
        case '<=': return Number(a <= b);
        case '>': return Number(a > b);
        case '>=': return Number(a >= b);
        case '==': return Number(a === b);
        default: return Number(a !== b);
      }
    }
  }
}

const parsed = new Map<string, Node>();

/** Parses once and caches, so a definition is checked on its first use. */
export function compileExpression(source: string) {
  let tree = parsed.get(source);
  if (!tree) {
    tree = parse(source);
    parsed.set(source, tree);
  }
  return tree;
}

export function evaluate(expr: Expr, scope: Scope): number {
  if (typeof expr === 'number') return expr;
  const value = run(compileExpression(expr), scope, expr);
  if (!Number.isFinite(value)) throw new ExpressionError(`"${expr}" is not a finite number`);
  return value;
}

/** Fills each `{expression}` in a message with its value: "at least {joint + 5} mm". */
export function interpolate(message: string, scope: Scope) {
  return message.replace(/\{([^{}]+)\}/g, (_, source: string) => String(evaluate(source, scope)));
}
