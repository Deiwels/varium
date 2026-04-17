#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const repoRoot = process.cwd();
const docsRoot = path.join(repoRoot, 'docs');
const brainRoot = process.env.VURIUM_BRAIN_ROOT
  ? path.resolve(process.env.VURIUM_BRAIN_ROOT)
  : path.join(os.homedir(), 'Obsidian', 'Vurium-Brain');
const outputPath = path.join(brainRoot, 'System', 'Migration-Inventory.md');

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    if (!entry.isFile()) return [];
    return [full];
  }));
  return nested.flat();
}

function classifyCluster(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/');
  if (normalized.startsWith('.obsidian/') || normalized.startsWith('.claude/')) return 'local-config';
  if (normalized.startsWith('00-System/') || normalized.startsWith('AI-') || normalized.startsWith('AI-Profiles/')) return 'system-governance';
  if (normalized.startsWith('04-Tasks/TASK-') || normalized.startsWith('07-Research/AI5-Research-Brief-') || normalized.startsWith('07-Research/R-')) return 'runtime-generated';
  if (normalized.startsWith('Tasks/')) return 'project-workstreams';
  if (normalized.startsWith('Compliance/')) return 'compliance';
  if (normalized.startsWith('Growth/')) return 'growth';
  if (normalized.startsWith('DevLog/')) return 'devlog';
  if (normalized.startsWith('Architecture/') || normalized.startsWith('Backend/') || normalized.startsWith('Frontend/')) return 'technical-reference';
  if (normalized.startsWith('Features/')) return 'feature-reference';
  if (normalized.startsWith('08-Runbooks/')) return 'runbooks';
  if (normalized.startsWith('10-Decisions/')) return 'decisions';
  if (normalized.startsWith('11-Reference/')) return 'reference';
  if (normalized.startsWith('12-Archive/')) return 'archive';
  return 'general';
}

function classifyStatus(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/');
  if (normalized.startsWith('.obsidian/') || normalized.startsWith('.claude/')) return 'archive';
  if (normalized.startsWith('04-Tasks/TASK-') || normalized.startsWith('07-Research/AI5-Research-Brief-') || normalized.startsWith('07-Research/R-')) {
    return 'brain-only';
  }
  if (normalized.startsWith('DevLog/')) return 'archive';
  if (normalized.startsWith('12-Archive/')) return 'archive';
  if (normalized.startsWith('00-System/') || normalized.startsWith('10-Decisions/') || normalized.startsWith('11-Reference/') || normalized.startsWith('08-Runbooks/')) {
    return 'canonical';
  }
  if (normalized.startsWith('Tasks/') || normalized.startsWith('Compliance/') || normalized.startsWith('Architecture/') || normalized.startsWith('Features/') || normalized.startsWith('Growth/')) {
    return 'supporting';
  }
  return 'manual-review';
}

function noteFor(relativePath, status, cluster) {
  const normalized = relativePath.replace(/\\/g, '/');
  if (status === 'brain-only') return 'Move into topic/project brain and archive repo copy after links are preserved.';
  if (status === 'archive') return 'Keep for audit/backlinks only; do not treat as current working memory.';
  if (status === 'canonical') return 'Stays in repo and should be linked from the local brain.';
  if (cluster === 'project-workstreams') return 'Likely should feed a project/topic brain, then keep only the canonical subset in repo.';
  if (cluster === 'growth') return 'Needs topic-brain rollup before deciding canonical vs supporting.';
  if (cluster === 'technical-reference') return 'Keep as repo technical reference unless superseded by a decision note.';
  return 'Needs manual review to decide canonical vs supporting vs archive.';
}

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function markdownTable(rows) {
  return [
    '| Path | Cluster | Proposed status | Note |',
    '|---|---|---|---|',
    ...rows.map((row) => `| \`${row.path}\` | ${row.cluster} | ${row.status} | ${row.note.replace(/\|/g, '\\|')} |`),
  ].join('\n');
}

const files = (await walk(docsRoot))
  .filter((file) => file.endsWith('.md') || file.endsWith('.json'))
  .map((file) => path.relative(docsRoot, file))
  .sort((a, b) => a.localeCompare(b));

const records = files.map((file) => {
  const cluster = classifyCluster(file);
  const status = classifyStatus(file);
  return {
    path: file.replace(/\\/g, '/'),
    cluster,
    status,
    note: noteFor(file, status, cluster),
  };
});

const byStatus = groupBy(records, (record) => record.status);
const byCluster = groupBy(records, (record) => record.cluster);

const lines = [
  '---',
  'type: migration-inventory',
  'status: active',
  `updated: ${new Date().toISOString()}`,
  'project: VuriumBook',
  '---',
  '',
  '# Workspace Brain Migration Inventory',
  '',
  'This is the first full inventory pass over the repo `docs/` tree.',
  '',
  'Important:',
  '- This is a **manual-review-first** inventory with scripted clustering.',
  '- The proposed statuses are intentionally conservative.',
  '- Nothing should be mass-deleted from the repo based on this file alone.',
  '',
  '## Totals',
  '',
  `- Files scanned: **${records.length}**`,
  `- Canonical candidates: **${(byStatus.get('canonical') || []).length}**`,
  `- Supporting candidates: **${(byStatus.get('supporting') || []).length}**`,
  `- Brain-only candidates: **${(byStatus.get('brain-only') || []).length}**`,
  `- Archive candidates: **${(byStatus.get('archive') || []).length}**`,
  `- Manual-review items: **${(byStatus.get('manual-review') || []).length}**`,
  '',
  '## Cluster Summary',
  '',
  '| Cluster | Files |',
  '|---|---:|',
  ...Array.from(byCluster.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([cluster, items]) => `| ${cluster} | ${items.length} |`),
];

for (const [cluster, items] of Array.from(byCluster.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
  lines.push(
    '',
    `## ${cluster}`,
    '',
    markdownTable(items),
  );
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${lines.join('\n')}\n`, 'utf8');

console.log(`Wrote migration inventory to ${outputPath}`);
