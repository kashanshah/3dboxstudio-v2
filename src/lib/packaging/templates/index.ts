import { baseBoxRuntime } from './base-box/runtime';
import { splitTopRuntime } from './split-top/runtime';
import { reverseTuckRuntime } from './reverse-tuck/runtime';
import { pizzaBoxRuntime } from './pizza-box/runtime';
import { sleeveBoxRuntime } from './sleeve-box/runtime';

export const BUILT_IN_TEMPLATE_RUNTIMES=[
  baseBoxRuntime,
  splitTopRuntime,
  reverseTuckRuntime,
  pizzaBoxRuntime,
  sleeveBoxRuntime,
] as const;
