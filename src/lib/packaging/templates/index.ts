import { baseBoxRuntime } from './base-box/runtime';
import { splitTopRuntime } from './split-top/runtime';
import { reverseTuckRuntime } from './reverse-tuck/runtime';

export const BUILT_IN_TEMPLATE_RUNTIMES=[
  baseBoxRuntime,
  splitTopRuntime,
  reverseTuckRuntime,
] as const;
