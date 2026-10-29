#!/usr/bin/env node
/**
 * Validate every Mermaid diagram in docs/diagrams/src/*.mmd.
 *
 * Mermaid parses diagrams before rendering, so a syntax error here is exactly
 * the error a reader would see as an empty box on GitHub.
 *
 * Setup (one-off, nothing is committed):
 *   npm install --no-save mermaid@11 jsdom
 *
 * Run:
 *   node docs/scripts/validate_diagrams.mjs
 *
 * Exit code 1 if any diagram fails to parse, so it can gate a pull request.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, '..', 'diagrams', 'src');

const { JSDOM } = await import('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.SVGElement = dom.window.SVGElement;
globalThis.DOMParser = dom.window.DOMParser;

const { default: mermaid } = await import('mermaid');
mermaid.initialize({ startOnLoad: false });

const HEADER = /^%%@\s+(?!note:)(\S+)\s+::\s+(.*)$/;
const NOTE = /^%%@\s+note:\s?(.*)$/;

function blocksOf(text) {
  const blocks = [];
  let current = null;
  for (const line of text.split('\n')) {
    const header = line.match(HEADER);
    if (header) {
      current = { id: header[1], title: header[2].trim(), body: [] };
      blocks.push(current);
      continue;
    }
    if (NOTE.test(line)) continue;
    if (current) current.body.push(line);
  }
  return blocks.map((b) => ({ ...b, definition: b.body.join('\n').trim() }));
}

const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.mmd')).sort();
if (!files.length) {
  console.error(`No .mmd sources found in ${SRC}`);
  process.exit(2);
}

let total = 0;
let failed = 0;

for (const file of files) {
  const blocks = blocksOf(fs.readFileSync(path.join(SRC, file), 'utf8'));
  for (const block of blocks) {
    total += 1;
    if (!block.definition) {
      failed += 1;
      console.log(`FAIL ${file} ${block.id} — empty definition`);
      continue;
    }
    try {
      const parsed = await mermaid.parse(block.definition);
      console.log(`OK   ${file.padEnd(18)} ${block.id.padEnd(6)} ${String(parsed.diagramType).padEnd(14)} ${block.title.slice(0, 64)}`);
    } catch (error) {
      failed += 1;
      console.log(`FAIL ${file.padEnd(18)} ${block.id}  ${block.title}`);
      console.log(`     ${String(error.message).split('\n').slice(0, 6).join('\n     ')}`);
    }
  }
}

console.log(`\n${total - failed}/${total} diagrams parsed`);
process.exit(failed ? 1 : 0);
