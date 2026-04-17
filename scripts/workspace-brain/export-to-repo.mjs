#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const repoRoot = process.cwd();
const brainRoot = process.env.VURIUM_BRAIN_ROOT
  ? path.resolve(process.env.VURIUM_BRAIN_ROOT)
  : path.join(os.homedir(), 'Obsidian', 'Vurium-Brain');
const exportMapPath = path.join(brainRoot, 'System', 'Export-Map.json');
const dryRun = process.argv.includes('--dry-run');

function ensureInside(root, target) {
  return target === root || target.startsWith(root + path.sep);
}

function normalizeLocalBrainLinks(content) {
  return String(content || '')
    .replace(/\[\[Projects\/VuriumBook\/([^|\]]+)\|([^\]]+)\]\]/g, '$2 (local workspace brain)')
    .replace(/\[\[Projects\/VuriumBook\/([^\]]+)\]\]/g, '$1 (local workspace brain)')
    .replace(/\/Users\/nazarii\/Obsidian\/Vurium-Brain\//g, '~/Obsidian/Vurium-Brain/');
}

function buildExportHeader(entry) {
  const generatedAt = new Date().toISOString();
  return [
    '---',
    'type: exported-brain-note',
    'status: active',
    `updated: ${generatedAt.slice(0, 10)}`,
    `brain_source: ${entry.source}`,
    'doc_class: canonical',
    '---',
    '',
    '> Auto-exported from the local workspace brain. Edit the local brain note first, then rerun the export sync.',
    '',
  ].join('\n');
}

const rawMap = await fs.readFile(exportMapPath, 'utf8');
const exportMap = JSON.parse(rawMap);
if (!Array.isArray(exportMap) || !exportMap.length) {
  throw new Error(`Export map is empty: ${exportMapPath}`);
}

for (const entry of exportMap) {
  const sourceRel = String(entry.source || '').trim().replace(/\\/g, '/');
  const targetRel = String(entry.target || '').trim().replace(/\\/g, '/');
  if (!sourceRel || !targetRel) continue;

  const sourceAbs = path.resolve(brainRoot, sourceRel);
  const targetAbs = path.resolve(repoRoot, targetRel);
  if (!ensureInside(brainRoot, sourceAbs)) throw new Error(`Source escapes brain root: ${sourceRel}`);
  if (!ensureInside(repoRoot, targetAbs)) throw new Error(`Target escapes repo root: ${targetRel}`);

  const rawContent = await fs.readFile(sourceAbs, 'utf8');
  const exported = `${buildExportHeader(entry)}${normalizeLocalBrainLinks(rawContent)}`.trimEnd() + '\n';

  if (!dryRun) {
    await fs.mkdir(path.dirname(targetAbs), { recursive: true });
    await fs.writeFile(targetAbs, exported, 'utf8');
  }

  console.log(`${dryRun ? '[dry-run] ' : ''}${sourceRel} -> ${targetRel}`);
}
