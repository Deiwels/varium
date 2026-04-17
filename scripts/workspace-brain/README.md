# Workspace Brain Scripts

These scripts support the `local brain -> repo export` workflow for VuriumBook.

## Brain Root

By default the scripts use:

`~/Obsidian/Vurium-Brain`

Override it with:

```bash
VURIUM_BRAIN_ROOT=/absolute/path/to/Vurium-Brain
```

## Commands

### Build migration inventory

Scans `docs/` and writes a conservative inventory into the local brain:

```bash
npm run brain:inventory
```

Output:

- `~/Obsidian/Vurium-Brain/System/Migration-Inventory.md`

### Export selected brain notes back to repo

Reads the local export map and copies selected notes into `docs/`:

```bash
npm run brain:export
```

Dry run:

```bash
node scripts/workspace-brain/export-to-repo.mjs --dry-run
```

The export map lives at:

- `~/Obsidian/Vurium-Brain/System/Export-Map.json`

## Current export scope

- `Projects/VuriumBook/Project-Brain.md`
- `Projects/VuriumBook/Current-State.md`
- `Projects/VuriumBook/Execution-Checklist.md`
- `Projects/VuriumBook/Topics/SMS-Notifications-Brain.md`
- `Projects/VuriumBook/Topics/SMS-Notifications-Migration-Review.md`
- `Projects/VuriumBook/Topics/Onboarding-Brain.md`
- `Projects/VuriumBook/Topics/Billing-Brain.md`

## Guardrails

- Do not mass-delete repo notes based on the migration inventory alone.
- Edit local brain notes first, then rerun export.
- Keep repo `docs/` for canonical exported truth, not full chat memory.
