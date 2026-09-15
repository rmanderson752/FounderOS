// src/lib/chat/thread.test.ts
import { describe, expect, it } from 'vitest'
import { replayable, type ThreadMessage } from './thread'

const msg = (role: 'user' | 'assistant', content: unknown, i: number): ThreadMessage =>
  ({ id: String(i), role, content: content as ThreadMessage['content'], created_at: new Date(i).toISOString() })

describe('replayable', () => {
  it('drops a tool_result whose tool_use is not in the previous assistant message', () => {
    const history = [
      msg('user', 'hello', 0),
      msg('user', [{ type: 'tool_result', tool_use_id: 'x', content: 'ok' }], 1), // shuffled ahead of its tool_use
      msg('assistant', [{ type: 'text', text: 'calling' }, { type: 'tool_use', id: 'x', name: 't', input: {} }], 2),
      msg('assistant', [{ type: 'text', text: 'done' }], 3),
    ]
    const out = replayable(history)
    expect(out.map((m) => m.role)).toEqual(['user', 'assistant', 'assistant'])
    // the unanswered tool_use was stripped, its text kept
    expect(JSON.stringify(out[1].content)).not.toContain('tool_use')
  })

  it('keeps a properly paired exchange intact', () => {
    const history = [
      msg('user', 'hello', 0),
      msg('assistant', [{ type: 'tool_use', id: 'a', name: 't', input: {} }], 1),
      msg('user', [{ type: 'tool_result', tool_use_id: 'a', content: 'ok' }], 2),
      msg('assistant', [{ type: 'text', text: 'done' }], 3),
    ]
    const out = replayable(history)
    expect(out).toHaveLength(4)
  })

  it('starts at the first plain user message', () => {
    const history = [
      msg('user', [{ type: 'tool_result', tool_use_id: 'a', content: 'ok' }], 0),
      msg('assistant', [{ type: 'text', text: 'done' }], 1),
      msg('user', 'next question', 2),
      msg('assistant', [{ type: 'text', text: 'answer' }], 3),
    ]
    const out = replayable(history)
    expect(out[0]).toEqual({ role: 'user', content: 'next question' })
    expect(out).toHaveLength(2)
  })
})
