// src/lib/card/live.test.ts
//
// Live checks against the Anthropic API. Skipped unless RUN_LIVE=1 so the
// normal suite stays free and offline. Costs a few cents per run.
//
//   RUN_LIVE=1 npx vitest run src/lib/card/live.test.ts

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function loadEnvLocal() {
  try {
    for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
    }
  } catch {
    // no .env.local
  }
}
loadEnvLocal()

const live = process.env.RUN_LIVE === '1' && !!process.env.ANTHROPIC_API_KEY

describe.skipIf(!live)('card turn (live)', () => {
  it('proposes a validated block, sized to the window, with cached prefix on the second call', async () => {
    const { runCardTurn } = await import('./turn')
    const start = new Date('2026-09-14T13:04:00Z')
    const window = { start, end: new Date('2026-09-14T15:14:00Z'), kind: 'now' as const, minutes: 130 }
    const input = {
      context: {
        timeZone: 'America/New_York',
        window,
        outcome: {
          id: 'o1', title: 'HNRY TestFlight beta to 5 testers', projectId: 'p1', projectName: 'HNRY', weight: 3,
          targetDate: '2026-10-24', status: 'active' as const, definitionOfDone: 'Five external testers have the build installed via TestFlight and can sign in.',
        },
        milestone: {
          id: 'm2', outcomeId: 'o1', title: 'Auth + onboarding complete', estimatedMinutes: 480, position: 1, status: 'active' as const, focusWeek: null,
          candidates: [
            { deliverable: 'Wire Supabase sign-in on app/(auth)/SignInScreen.tsx and verify the happy path on the simulator', estimated_minutes: 90, expected_paths: ['app/(auth)/SignInScreen.tsx'] },
            { deliverable: 'Build the three-step onboarding flow with persisted progress in app/(onboarding)', estimated_minutes: 150, expected_paths: ['app/(onboarding)'] },
          ],
        },
        milestoneIndex: 1,
        milestoneCount: 5,
        recentSignals: [
          { id: 's1', projectId: 'p1', source: 'git' as const, occurredAt: new Date('2026-09-12T20:00:00Z'), paths: ['app/(auth)/AuthStack.tsx'], summary: 'AuthStack scaffold', durationMinutes: null },
          { id: 's2', projectId: 'p1', source: 'session' as const, occurredAt: new Date('2026-09-13T03:00:00Z'), paths: [], summary: 'continue: set up auth stack navigation', durationMinutes: 95 },
        ],
        lastBlock: null,
        paceLine: 'needs ~22h; at ~5h/wk that lands Oct 30, target Oct 24.',
        repoPath: '/Users/ryananderson/hnry',
        userNote: null,
        scheduledThisWeek: [],
      },
      forbiddenTitles: ['HNRY', 'HNRY TestFlight beta to 5 testers', 'Auth + onboarding complete'],
      existingBlocks: [],
    }

    const first = await runCardTurn(input)
    console.log('\n--- first turn ---')
    console.log(JSON.stringify({ source: first.source, attempts: first.attempts, usage: first.usage, latencyMs: first.latencyMs, stop: first.stopReason }, null, 1))
    console.log(first.proposal)

    expect(first.source).toBe('model')
    expect(first.proposal.minutes).toBeGreaterThanOrEqual(30)
    expect(first.proposal.minutes).toBeLessThanOrEqual(130)
    expect(first.proposal.deliverable.toLowerCase()).not.toBe('hnry')
    expect(first.messages.length).toBeGreaterThanOrEqual(3)

    const second = await runCardTurn(input)
    console.log('\n--- second turn (cache) ---')
    console.log(JSON.stringify({ source: second.source, attempts: second.attempts, usage: second.usage, latencyMs: second.latencyMs }, null, 1))
    expect(second.usage.cache_read_input_tokens).toBeGreaterThan(0)
  }, 120_000)
})

describe.skipIf(!live)('decomposition (live)', () => {
  it('returns a schema-valid ladder grounded in the commit history', async () => {
    const { decomposeOutcome } = await import('@/lib/decompose/decompose')
    const result = await decomposeOutcome(
      {
        goal: 'HNRY TestFlight beta to 5 testers',
        targetDate: '2026-10-24',
        projectName: 'HNRY',
        docs: '# HNRY\nA creator commitments app. React Native (Expo), Supabase. Screens: Home, Commitments, Profile. Auth via Supabase.',
        commits: [
          '6419a28 fix(commitments): sanitize punctuation instead of rejecting the line | src/commitments/parse.ts',
          'a1b2c3d feat(auth): AuthStack scaffold with SignIn and SignUp routes | app/(auth)/AuthStack.tsx, app/(auth)/SignInScreen.tsx',
          'd4e5f6a chore: expo sdk 55 upgrade | package.json, app.json',
          'b7c8d9e feat: commitments feed list and detail | src/commitments/Feed.tsx',
        ],
        paceHoursPerWeek: 5,
        today: '2026-09-14',
      },
      ['HNRY', 'HNRY TestFlight beta to 5 testers']
    )
    console.log('\n--- ladder ---')
    console.log(JSON.stringify({ usage: result.usage, latencyMs: result.latencyMs, rejected: result.rejected }, null, 1))
    for (const m of result.ladder.milestones) {
      console.log(`${m.already_done ? '✓' : '○'} ${m.title} (${m.estimated_minutes}m) evidence=${JSON.stringify(m.evidence)}`)
      for (const c of m.candidates) console.log(`   · ${c.deliverable} [${c.estimated_minutes}m] ${c.expected_paths.join(',')}`)
    }
    console.log('assumptions:', result.ladder.assumptions)
    expect(result.ladder.milestones.length).toBeGreaterThanOrEqual(3)
    expect(result.ladder.milestones.every((m) => m.candidates.length >= 2)).toBe(true)
    expect(result.ladder.milestones.every((m) => !m.already_done || m.evidence.length > 0)).toBe(true)
  }, 180_000)
})
