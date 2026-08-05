#!/usr/bin/env node
/**
 * AGENTS.md and CLAUDE.md share one core of project rules and then diverge into
 * role-specific protocols — Securex (security owner) and Claude (implementation).
 *
 * That shared core is duplicated rather than extracted into a third file on
 * purpose: both agents load their own file directly, so neither can lose the
 * rules by failing to follow a pointer. The cost of that choice is drift, which
 * is silent — on 2026-07-21 the two copies had disagreed about the canonical git
 * order long enough that Securex was reading a stale rule. This check turns that
 * class of drift into a loud failure.
 *
 * Run: npm run check:rules
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Where each file stops being shared and starts being role-specific. */
const FILES = [
  { name: 'AGENTS.md', role: 'Securex', boundary: '## Securex Security Owner Rules' },
  { name: 'CLAUDE.md', role: 'Claude', boundary: '## AI Agent Workflow' },
]

/**
 * Lines that are meant to differ between the two copies. Each entry is applied
 * to both files before comparing, so a genuinely role-specific rule does not
 * register as drift. Keep this list as short as it can possibly be — every entry
 * is a rule the check can no longer protect.
 */
const INTENTIONAL_DIFFERENCES = [
  {
    why: 'commit trailer names the agent that wrote the change',
    pattern: /`Co-Authored-By: (?:Securex|Claude)`/g,
    placeholder: '`Co-Authored-By: <agent>`',
  },
]

function normalise(lines) {
  const normalised = lines.map((line) =>
    INTENTIONAL_DIFFERENCES.reduce(
      (acc, { pattern, placeholder }) => acc.replace(pattern, placeholder),
      line.trimEnd(),
    ),
  )
  while (normalised.length > 0 && normalised.at(-1) === '') normalised.pop()
  return normalised
}

async function readSharedCore({ name, boundary }) {
  const raw = await readFile(join(repoRoot, name), 'utf8')
  const lines = raw.split(/\r?\n/)
  const boundaryIndex = lines.findIndex((line) => line.trim() === boundary)

  if (boundaryIndex === -1) {
    throw new Error(
      `${name}: could not find the boundary heading "${boundary}".\n` +
        'If that section was renamed, update FILES in scripts/check-rules-sync.mjs\n' +
        'so the check keeps comparing the right region.',
    )
  }

  // Trailing "---" belongs to the boundary, not to the shared core.
  const core = lines.slice(0, boundaryIndex)
  while (core.length > 0 && (core.at(-1).trim() === '' || core.at(-1).trim() === '---')) core.pop()

  return normalise(core)
}

const [agents, claude] = await Promise.all(FILES.map(readSharedCore))

const drift = []
for (let i = 0; i < Math.max(agents.length, claude.length); i += 1) {
  if (agents[i] !== claude[i]) {
    drift.push({ line: i + 1, agents: agents[i], claude: claude[i] })
  }
}

if (drift.length === 0) {
  console.log(`Rules in sync — ${agents.length} shared lines match across AGENTS.md and CLAUDE.md.`)
  process.exit(0)
}

console.error(`Shared rules have drifted: ${drift.length} line(s) differ.\n`)
for (const { line, agents: a, claude: c } of drift.slice(0, 20)) {
  console.error(`  line ${line}`)
  console.error(`    AGENTS.md (Securex):  ${a ?? '<missing>'}`)
  console.error(`    CLAUDE.md (Claude): ${c ?? '<missing>'}\n`)
}
if (drift.length > 20) console.error(`  ...and ${drift.length - 20} more.\n`)

console.error('Decide which copy is current, propagate it to the other, and re-run.')
console.error('If the difference is genuinely role-specific, add it to')
console.error('INTENTIONAL_DIFFERENCES in scripts/check-rules-sync.mjs with a reason.')
process.exit(1)
