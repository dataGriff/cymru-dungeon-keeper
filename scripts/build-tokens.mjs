#!/usr/bin/env node
/**
 * Write src/styles/tokens.css from src/design/tokens.ts and themes.ts.
 *   node --experimental-strip-types scripts/build-tokens.mjs   # or: task tokens
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokensCss } from '../src/design/css.ts';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'styles', 'tokens.css');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, tokensCss());
console.log('wrote src/styles/tokens.css');
