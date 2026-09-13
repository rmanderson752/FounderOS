#!/usr/bin/env node
// tools/fos/index.mjs
//
// The local half of Founder OS. One file, no dependencies, Node 18+.
//
// It does three things:
//   1. Prints the Start Card when a Claude Code session starts (SessionStart
//      hook) or when you run `fos start`.
//   2. Pushes observations the moment they happen: a git post-commit hook
//      posts the commit; a Claude Code SessionEnd hook posts the session.
//      Offline, signals queue in ~/.founder/queue.jsonl and flush next time.
//   3. Carries the few corrections a card can need: done / partial / skip /
//      no "…" / milestone done / pause, and `fos goal` to state a new goal.
//
// Install once:  node tools/fos/index.mjs init --url https://… --token fos_…
// Then map repos: node tools/fos/index.mjs map "HNRY=/Users/you/hnry"
//
// Everything talks to the app over HTTPS with a bearer token minted in
// Settings. Nothing here reads more than: git metadata for mapped repos, and
// the first user message of a Claude Code session (600 chars, secrets
// redacted) plus its timestamps.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, chmodSync, statSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline'

const SELF = fileURLToPath(import.meta.url)
const HOME = homedir()
const DIR = join(HOME, '.founder')
const CONFIG_PATH = join(DIR, 'config.json')
const QUEUE_PATH = join(DIR, 'queue.jsonl')
const CLAUDE_SETTINGS = join(HOME, '.claude', 'settings.json')
const FETCH_TIMEOUT_MS = 40_000

// ---------------------------------------------------------------------------
// config
// ---------------------------------------------------------------------------
function loadConfig() {
  if (!existsSync(CONFIG_PATH)) return null
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
  } catch {
    return null
  }
}

function saveConfig(config) {
  mkdirSync(DIR, { recursive: true })
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 })
}

function requireConfig() {
  const config = loadConfig()
  if (!config?.url || !config?.token) {
    fail('Not configured. Run: fos init --url <app url> --token <token from Settings>')
  }
  return config
}

function fail(message, code = 1) {
  process.stderr.write(`fos: ${message}\n`)
  process.exit(code)
}

// ---------------------------------------------------------------------------
// http
// ---------------------------------------------------------------------------
async function api(config, path, { method = 'GET', body, text = false } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(`${config.url.replace(/\/$/, '')}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${config.token}`,
        'content-type': 'application/json',
        'user-agent': 'fos-cli',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
    const payload = text ? await response.text() : await response.json().catch(() => ({}))
    if (!response.ok) {
      const detail = text ? payload : payload.error ?? JSON.stringify(payload)
      throw new Error(`${response.status} ${detail}`)
    }
    return payload
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// queue (offline signals)
// ---------------------------------------------------------------------------
function enqueue(signal) {
  mkdirSync(DIR, { recursive: true })
  appendFileSync(QUEUE_PATH, JSON.stringify(signal) + '\n')
}

async function flushQueue(config) {
  if (!existsSync(QUEUE_PATH)) return 0
  const lines = readFileSync(QUEUE_PATH, 'utf8').split('\n').filter(Boolean)
  if (lines.length === 0) return 0
  const signals = lines.map((l) => {
    try {
      return JSON.parse(l)
    } catch {
      return null
    }
  }).filter(Boolean)
  try {
    await api(config, '/api/signals', { method: 'POST', body: { signals } })
    writeFileSync(QUEUE_PATH, '')
    return signals.length
  } catch {
    return 0
  }
}

async function postSignal(config, signal) {
  try {
    await api(config, '/api/signals', { method: 'POST', body: signal })
    return true
  } catch {
    enqueue(signal)
    return false
  }
}

// ---------------------------------------------------------------------------
// git helpers
// ---------------------------------------------------------------------------
function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
}

function repoRoot(cwd) {
  try {
    return git(['rev-parse', '--show-toplevel'], cwd)
  } catch {
    return null
  }
}

function mappedProject(config, cwd) {
  const target = resolve(cwd).toLowerCase().replace(/\/+$/, '')
  let best = null
  for (const [name, root] of Object.entries(config.projects ?? {})) {
    const r = resolve(root).toLowerCase().replace(/\/+$/, '')
    if (target === r || target.startsWith(r + '/')) {
      if (!best || r.length > best.root.length) best = { name, root: r }
    }
  }
  return best
}

// ---------------------------------------------------------------------------
// redaction — the session hook sends one short message; never a secret
// ---------------------------------------------------------------------------
const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]{8,}/g,
  /ghp_[A-Za-z0-9]{20,}/g,
  /gh[ousr]_[A-Za-z0-9]{20,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /xox[baprs]-[A-Za-z0-9-]{10,}/g,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /fos_[a-f0-9]{20,}/g,
  /\b[A-Fa-f0-9]{32,}\b/g,
  /Bearer\s+[A-Za-z0-9._-]{16,}/gi,
  /(password|passwd|secret|token|api[_-]?key)\s*[:=]\s*\S+/gi,
]

function redact(text) {
  let out = text
  for (const pattern of SECRET_PATTERNS) out = out.replace(pattern, '[redacted]')
  return out
}

// ---------------------------------------------------------------------------
// transcript — narrow read: first user message + timestamps, nothing else
// ---------------------------------------------------------------------------
function readTranscriptSummary(transcriptPath) {
  try {
    const raw = readFileSync(transcriptPath, 'utf8')
    let first = null
    let firstTs = null
    let lastTs = null
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue
      let entry
      try {
        entry = JSON.parse(line)
      } catch {
        continue
      }
      const ts = entry.timestamp ? Date.parse(entry.timestamp) : NaN
      if (!Number.isNaN(ts)) {
        if (firstTs === null) firstTs = ts
        lastTs = ts
      }
      if (first === null && entry.type === 'user') {
        const content = entry.message?.content
        let text = null
        if (typeof content === 'string') text = content
        else if (Array.isArray(content)) {
          const block = content.find((b) => b && b.type === 'text' && typeof b.text === 'string')
          text = block?.text ?? null
        }
        // Skip harness-injected messages (slash commands, tool results).
        if (text && !text.trimStart().startsWith('<') && !text.includes('tool_result')) {
          first = redact(text.replace(/\s+/g, ' ').trim()).slice(0, 600)
        }
      }
    }
    return { first, firstTs, lastTs }
  } catch {
    return { first: null, firstTs: null, lastTs: null }
  }
}

function readStdinJson() {
  try {
    const raw = readFileSync(0, 'utf8')
    return raw.trim() ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

// ---------------------------------------------------------------------------
// hooks install
// ---------------------------------------------------------------------------
const POST_COMMIT_MARK = '# founder-os: post signal (installed by fos)'

function installGitHook(root) {
  const hooksDir = join(root, '.git', 'hooks')
  if (!existsSync(hooksDir)) return false
  const hookPath = join(hooksDir, 'post-commit')
  const line = `${POST_COMMIT_MARK}\nnode "${SELF}" commit >/dev/null 2>&1 &\n`
  if (existsSync(hookPath)) {
    const current = readFileSync(hookPath, 'utf8')
    if (current.includes(POST_COMMIT_MARK)) return true
    appendFileSync(hookPath, `\n${line}`)
  } else {
    writeFileSync(hookPath, `#!/bin/sh\n${line}`)
  }
  chmodSync(hookPath, 0o755)
  return true
}

function installClaudeHooks() {
  let settings = {}
  if (existsSync(CLAUDE_SETTINGS)) {
    try {
      settings = JSON.parse(readFileSync(CLAUDE_SETTINGS, 'utf8'))
    } catch {
      fail(`${CLAUDE_SETTINGS} is not valid JSON; fix it before installing hooks`)
    }
  }
  settings.hooks = settings.hooks ?? {}
  const ensure = (event, command, extra = {}) => {
    const list = Array.isArray(settings.hooks[event]) ? settings.hooks[event] : []
    const already = list.some((entry) => (entry.hooks ?? []).some((h) => typeof h.command === 'string' && h.command.includes('tools/fos/index.mjs')))
    if (!already) list.push({ hooks: [{ type: 'command', command, ...extra }] })
    settings.hooks[event] = list
  }
  ensure('SessionStart', `node "${SELF}" session-start`, { timeout: 45 })
  ensure('SessionEnd', `node "${SELF}" session-end`, { timeout: 20 })
  mkdirSync(dirname(CLAUDE_SETTINGS), { recursive: true })
  writeFileSync(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2) + '\n')
}

// ---------------------------------------------------------------------------
// commands
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const positional = []
  const flags = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next
        i++
      } else flags[key] = true
    } else positional.push(a)
  }
  return { positional, flags }
}

async function cmdInit(flags) {
  const config = loadConfig() ?? {}
  if (flags.url) config.url = String(flags.url)
  if (flags.token) config.token = String(flags.token)
  if (!config.url || !config.token) fail('init needs --url <app url> and --token <token from Settings>')
  config.projects = config.projects ?? {}
  saveConfig(config)
  installClaudeHooks()
  process.stdout.write(`Configured ${config.url}. Claude Code hooks installed in ${CLAUDE_SETTINGS}.\n`)
  const maps = [].concat(flags.map ?? [])
  for (const m of maps) await cmdMap({ positional: [m] })
  process.stdout.write('Next: map your repos with  fos map "Name=/absolute/path"\n')
}

async function cmdMap({ positional }) {
  const config = requireConfig()
  const spec = positional[0]
  if (!spec || !spec.includes('=')) fail('usage: fos map "Name=/absolute/path"')
  const [name, rawPath] = spec.split('=')
  const path = resolve(rawPath.replace(/^~/, HOME))
  if (!existsSync(path)) fail(`${path} does not exist`)
  config.projects[name] = path
  saveConfig(config)
  const root = repoRoot(path)
  const hooked = root ? installGitHook(root) : false
  await api(config, '/api/projects', {
    method: 'POST',
    body: { name, repo_path: root ?? null, folder_paths: root ? [] : [path], kind: root ? 'code' : 'docs' },
  })
  process.stdout.write(`${name} → ${path}${hooked ? ' (post-commit hook installed)' : root ? '' : ' (no git repo; folder activity only)'}\n`)
}

async function cmdStart(flags, stdin = null) {
  const config = requireConfig()
  const cwd = flags.cwd ? resolve(String(flags.cwd)) : stdin?.cwd ?? process.cwd()
  const flushed = await flushQueue(config)
  // A mapped, non-git folder reports "touched since last time" as a signal.
  await folderActivity(config, cwd)
  try {
    const text = await api(config, `/api/card?cwd=${encodeURIComponent(cwd)}&source=hook&format=text`, { text: true })
    process.stdout.write(text.endsWith('\n') ? text : text + '\n')
  } catch (error) {
    process.stdout.write(`Start card unavailable: ${error.message}\n`)
  }
  if (flushed) process.stdout.write(`(flushed ${flushed} queued signal${flushed === 1 ? '' : 's'})\n`)
}

async function folderActivity(config, cwd) {
  const project = mappedProject(config, cwd)
  if (!project || repoRoot(project.root)) return
  const stamp = config.watermarks?.[project.name] ?? 0
  let newest = stamp
  let touched = []
  const walk = (dir, depth) => {
    if (depth > 3) return
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full, depth + 1)
      else {
        const m = statSync(full).mtimeMs
        if (m > stamp) {
          touched.push(full.slice(project.root.length + 1))
          if (m > newest) newest = m
        }
      }
    }
  }
  try {
    walk(project.root, 0)
  } catch {
    return
  }
  if (touched.length === 0) return
  config.watermarks = { ...(config.watermarks ?? {}), [project.name]: Date.now() }
  saveConfig(config)
  await postSignal(config, {
    source: 'fs',
    kind: 'files_touched',
    summary: `${touched.length} file${touched.length === 1 ? '' : 's'} changed`,
    paths: touched.slice(0, 30),
    occurred_at: new Date(newest).toISOString(),
    cwd: project.root,
    project: project.name,
  })
}

async function cmdCommit() {
  const config = requireConfig()
  const root = repoRoot(process.cwd())
  if (!root) return
  const project = mappedProject(config, root)
  if (!project) return
  const [hash, subject, epoch] = git(['log', '-1', '--format=%H%n%s%n%ct'], root).split('\n')
  const paths = git(['show', '--name-only', '--format=', 'HEAD'], root).split('\n').filter(Boolean)
  await postSignal(config, {
    source: 'git',
    kind: 'commit',
    summary: subject,
    paths,
    occurred_at: new Date(Number(epoch) * 1000).toISOString(),
    external_id: `git:${hash}`,
    cwd: root,
    project: project.name,
    metadata: { hash: hash.slice(0, 12), branch: safe(() => git(['rev-parse', '--abbrev-ref', 'HEAD'], root)) },
  })
}

function safe(fn) {
  try {
    return fn()
  } catch {
    return null
  }
}

async function cmdSessionStart() {
  const stdin = readStdinJson()
  if (stdin.source === 'compact') return
  await cmdStart({}, stdin)
}

async function cmdSessionEnd() {
  const config = requireConfig()
  const stdin = readStdinJson()
  const cwd = stdin.cwd ?? process.cwd()
  const project = mappedProject(config, cwd)
  if (!project) return
  const { first, firstTs, lastTs } = stdin.transcript_path ? readTranscriptSummary(stdin.transcript_path) : { first: null, firstTs: null, lastTs: null }
  const ended = lastTs ?? Date.now()
  const started = firstTs ?? ended
  const minutes = Math.max(1, Math.round((ended - started) / 60_000))
  await postSignal(config, {
    source: 'session',
    kind: 'claude_code_session',
    summary: first ?? '',
    paths: [],
    occurred_at: new Date(ended).toISOString(),
    duration_minutes: minutes,
    external_id: stdin.session_id ? `session:${stdin.session_id}` : null,
    cwd,
    project: project.name,
    metadata: { reason: stdin.reason ?? null },
  })
}

async function currentBlock(config) {
  const card = await api(config, `/api/card?cwd=${encodeURIComponent(process.cwd())}&source=hook`)
  if (card.status !== 'ok') fail(card.text ?? `no current block (${card.status})`)
  return card
}

async function cmdResolve(status, note) {
  const config = requireConfig()
  const card = await currentBlock(config)
  await api(config, `/api/blocks/${card.block.id}`, { method: 'PATCH', body: { status, note } })
  process.stdout.write(`${status}: ${card.block.deliverable}\n`)
}

async function cmdNo(positional) {
  const config = requireConfig()
  const note = positional.join(' ').trim()
  if (!note) fail('usage: fos no "what actually happened or what to do instead"')
  const text = await api(config, `/api/card?cwd=${encodeURIComponent(process.cwd())}&source=hook&format=text&note=${encodeURIComponent(note)}`, { text: true })
  process.stdout.write(text)
}

async function cmdMilestoneDone() {
  const config = requireConfig()
  const card = await currentBlock(config)
  if (!card.milestone) fail('the current card has no milestone')
  await api(config, `/api/milestones/${card.milestone.id}`, { method: 'PATCH', body: { status: 'done' } })
  process.stdout.write(`milestone done: ${card.milestone.title}\n`)
}

async function cmdPause(positional, paused) {
  const config = requireConfig()
  const name = positional[0]
  if (!name) fail(`usage: fos ${paused ? 'pause' : 'resume'} <project>`)
  await api(config, '/api/projects', { method: 'POST', body: { name, paused } })
  process.stdout.write(`${name}: ${paused ? 'paused' : 'active'}\n`)
}

function gatherDocs(root) {
  const candidates = ['README.md', 'ARCHITECTURE.md', 'PLAN.md', 'DECISIONS.md', 'CLAUDE.md']
  let out = ''
  try {
    const extra = readdirSync(root).filter((f) => f.toUpperCase().endsWith('.MD') && !candidates.includes(f)).slice(0, 4)
    for (const f of [...candidates, ...extra]) {
      const p = join(root, f)
      if (!existsSync(p)) continue
      out += `\n\n===== ${f} =====\n` + readFileSync(p, 'utf8').slice(0, 12_000)
      if (out.length > 30_000) break
    }
  } catch {
    // no docs is fine
  }
  return out.trim() || null
}

function gatherCommits(root) {
  try {
    const raw = git(['log', '--since=60.days', '--format=%h %s', '--name-only', '-n', '150'], root)
    const lines = []
    let current = null
    for (const line of raw.split('\n')) {
      if (/^[0-9a-f]{7,} /.test(line)) {
        if (current) lines.push(current.subject + (current.paths.length ? ` | ${current.paths.slice(0, 5).join(', ')}` : ''))
        current = { subject: line, paths: [] }
      } else if (line.trim() && current) current.paths.push(line.trim())
    }
    if (current) lines.push(current.subject + (current.paths.length ? ` | ${current.paths.slice(0, 5).join(', ')}` : ''))
    return lines
  } catch {
    return []
  }
}

async function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((res) => rl.question(question, (answer) => { rl.close(); res(answer.trim()) }))
}

async function cmdGoal(positional, flags) {
  const config = requireConfig()
  const title = positional.join(' ').trim()
  if (!title) fail('usage: fos goal "HNRY TestFlight beta to 5 testers" --by 2026-10-24 [--project HNRY]')
  const cwd = process.cwd()
  const mapped = mappedProject(config, cwd)
  const projectName = flags.project ? String(flags.project) : mapped?.name ?? null
  const root = projectName ? (config.projects[projectName] ?? null) : repoRoot(cwd)
  const docs = root ? gatherDocs(root) : null
  const commits = root && repoRoot(root) ? gatherCommits(root) : []

  process.stdout.write(`Reverse-engineering "${title}"${projectName ? ` for ${projectName}` : ''} from ${commits.length} commits${docs ? ' and your docs' : ''}…\n`)
  const body = {
    title,
    target_date: flags.by ? String(flags.by) : null,
    project: projectName ? { name: projectName, repo_path: root && repoRoot(root) ? root : null } : null,
    weight: flags.weight ? Number(flags.weight) : 2,
    docs,
    commits,
  }
  const draft = await api(config, '/api/goals', { method: 'POST', body: { ...body, dry_run: true } })
  const ladder = draft.ladder
  process.stdout.write('\n')
  ladder.milestones.forEach((m, i) => {
    const mark = m.already_done ? '✓' : i === ladder.milestones.findIndex((x) => !x.already_done) ? '▶' : '○'
    process.stdout.write(`${mark} ${i + 1}. ${m.title}  (${Math.round((m.estimated_minutes / 60) * 10) / 10}h)\n`)
    for (const c of m.candidates) process.stdout.write(`     · ${c.deliverable} (${c.estimated_minutes}m)\n`)
  })
  process.stdout.write(`\nDone when: ${ladder.definition_of_done}\n`)
  if (ladder.assumptions.length) process.stdout.write(`Assumed: ${ladder.assumptions.join('; ')}\n`)
  if (draft.rejected?.length) process.stdout.write(`Server notes: ${draft.rejected.join('; ')}\n`)

  const answer = flags.yes ? 'y' : await ask('\nSave this ladder? [y/N] ')
  if (!/^y/i.test(answer)) {
    process.stdout.write('Not saved.\n')
    return
  }
  const saved = await api(config, '/api/goals', { method: 'POST', body: { ...body, ladder } })
  process.stdout.write(`Saved. ${config.url}/goals/${saved.goal.outcome.id}\n`)
}

async function cmdLadder(positional) {
  const config = requireConfig()
  if (positional[0]) {
    process.stdout.write(await api(config, `/api/goals/${positional[0]}?format=text`, { text: true }))
    return
  }
  const { goals } = await api(config, '/api/goals')
  for (const g of goals) {
    const done = g.milestones.filter((m) => m.status === 'done').length
    process.stdout.write(`${g.outcome.status === 'active' ? '●' : '○'} ${g.outcome.project?.name ?? '—'} → ${g.outcome.title}  ${done}/${g.milestones.length}  ${g.pace_line}\n   ${g.outcome.id}\n`)
  }
}

async function cmdDoctor() {
  const config = loadConfig()
  const out = []
  out.push(`config: ${config ? CONFIG_PATH : 'missing (run fos init)'}`)
  if (config) {
    out.push(`url: ${config.url}`)
    try {
      const status = await api(config, '/api/calendar/status')
      out.push(`api: ok · calendar ${status.connected ? `connected (${status.timezone})` : 'NOT connected'}`)
    } catch (error) {
      out.push(`api: FAILED (${error.message})`)
    }
    for (const [name, root] of Object.entries(config.projects ?? {})) {
      const r = repoRoot(root)
      const hook = r ? existsSync(join(r, '.git', 'hooks', 'post-commit')) && readFileSync(join(r, '.git', 'hooks', 'post-commit'), 'utf8').includes(POST_COMMIT_MARK) : null
      out.push(`project ${name}: ${root} ${r ? (hook ? '· hook ok' : '· HOOK MISSING (fos map again)') : '· folder (no git)'}`)
    }
  }
  let claude = 'no ~/.claude/settings.json'
  if (existsSync(CLAUDE_SETTINGS)) {
    const s = readFileSync(CLAUDE_SETTINGS, 'utf8')
    claude = s.includes('tools/fos/index.mjs') ? 'installed' : 'NOT installed (fos init)'
  }
  out.push(`claude code hooks: ${claude}`)
  const queued = existsSync(QUEUE_PATH) ? readFileSync(QUEUE_PATH, 'utf8').split('\n').filter(Boolean).length : 0
  out.push(`queued signals: ${queued}`)
  process.stdout.write(out.join('\n') + '\n')
}

function usage() {
  process.stdout.write(`fos — the local half of Founder OS

  fos init --url <app> --token <token>   configure + install Claude Code hooks
  fos map "Name=/abs/path"               map a repo/folder, install post-commit hook
  fos start [--cwd DIR]                  print the Start Card now
  fos goal "…" --by YYYY-MM-DD [--project N] [--yes]
  fos done | partial | skip              resolve the current block yourself
  fos no "what to do instead"            redirect: a fresh card
  fos milestone done                     advance the ladder now
  fos pause <project> | resume <project>
  fos ladder [goal id]                   show the ladder(s)
  fos doctor                             check config, api, hooks, queue
`)
}

// ---------------------------------------------------------------------------
async function main() {
  const [, , command, ...rest] = process.argv
  const { positional, flags } = parseArgs(rest)
  switch (command) {
    case 'init': return cmdInit(flags)
    case 'map': return cmdMap({ positional })
    case 'start': return cmdStart(flags)
    case 'commit': return cmdCommit()
    case 'session-start': return cmdSessionStart()
    case 'session-end': return cmdSessionEnd()
    case 'goal': return cmdGoal(positional, flags)
    case 'done': return cmdResolve('done', positional.join(' ') || undefined)
    case 'partial': return cmdResolve('partial', positional.join(' ') || undefined)
    case 'skip': return cmdResolve('skipped', positional.join(' ') || undefined)
    case 'no': return cmdNo(positional)
    case 'milestone': return positional[0] === 'done' ? cmdMilestoneDone() : usage()
    case 'pause': return cmdPause(positional, true)
    case 'resume': return cmdPause(positional, false)
    case 'ladder': return cmdLadder(positional)
    case 'doctor': return cmdDoctor()
    default: return usage()
  }
}

// Exported for tests; main runs only when invoked directly.
export { redact, readTranscriptSummary, mappedProject, parseArgs }

if (process.argv[1] && resolve(process.argv[1]) === SELF) {
  main().catch((error) => {
    // Hooks must never break a commit or a session start.
    const quiet = ['commit', 'session-start', 'session-end'].includes(process.argv[2])
    if (quiet) process.exit(0)
    fail(error.message)
  })
}
