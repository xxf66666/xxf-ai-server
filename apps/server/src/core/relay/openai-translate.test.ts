import { describe, expect, it } from 'vitest';
import {
  resolveModel,
  translateRequest,
  translateResponse,
  translateStreamEvent,
} from './openai-translate.js';

describe('resolveModel', () => {
  it('maps known OpenAI names to Claude', () => {
    expect(resolveModel('gpt-5.4')).toBe('claude-opus-4-7');
    expect(resolveModel('gpt-5.4-mini')).toBe('claude-sonnet-4-6');
    expect(resolveModel('gpt-5.3-codex')).toBe('claude-sonnet-4-6');
    expect(resolveModel('gpt-5.1-codex-max')).toBe('claude-opus-4-7');
    expect(resolveModel('gpt-5.1-codex-mini')).toBe('claude-haiku-4-5-20251001');
  });

  it('passes claude-* names through', () => {
    expect(resolveModel('claude-sonnet-4-6')).toBe('claude-sonnet-4-6');
    expect(resolveModel('claude-haiku-4-5-20251001')).toBe('claude-haiku-4-5-20251001');
  });

  it('falls back to a default for unknown names', () => {
    expect(resolveModel(undefined)).toBe('claude-sonnet-4-6');
    expect(resolveModel('some-mystery-model')).toBe('claude-sonnet-4-6');
  });
});

describe('translateRequest', () => {
  it('collapses system messages into Anthropic.system', () => {
    const out = translateRequest({
      model: 'gpt-5',
      messages: [
        { role: 'system', content: 'be terse' },
        { role: 'system', content: 'and polite' },
        { role: 'user', content: 'hi' },
      ],
    });
    expect(out.system).toBe('be terse\n\nand polite');
    expect(out.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('preserves user/assistant message ordering', () => {
    const out = translateRequest({
      model: 'gpt-5',
      messages: [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello' },
        { role: 'user', content: 'again' },
      ],
    });
    expect(out.messages).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
      { role: 'user', content: 'again' },
    ]);
  });

  it('extracts text from structured content parts', () => {
    const out = translateRequest({
      model: 'gpt-5',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'first ' },
            { type: 'image_url', text: 'IGNORED' } as unknown as { type: 'text'; text: string },
            { type: 'text', text: 'second' },
          ],
        },
      ],
    });
    expect(out.messages[0]).toEqual({ role: 'user', content: 'first second' });
  });

  it('maps stop → stop_sequences and caps max_tokens', () => {
    const out = translateRequest({
      model: 'gpt-5',
      max_tokens: 999_999,
      stop: ['\\n', 'END'],
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(out.stop_sequences).toEqual(['\\n', 'END']);
    expect(out.max_tokens).toBe(16384);
  });

  it('forwards temperature and top_p', () => {
    const out = translateRequest({
      model: 'gpt-5',
      temperature: 0.3,
      top_p: 0.9,
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(out.temperature).toBe(0.3);
    expect(out.top_p).toBe(0.9);
  });

  it('sets stream flag when requested', () => {
    const out = translateRequest({
      model: 'gpt-5',
      stream: true,
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(out.stream).toBe(true);
  });
});

describe('translateResponse', () => {
  it('assembles OpenAI chat.completion from Anthropic fields', () => {
    const out = translateResponse(
      {
        id: 'msg_1',
        content: [
          { type: 'text', text: 'hello ' },
          { type: 'text', text: 'world' },
        ],
        usage: { input_tokens: 5, output_tokens: 7 },
        stop_reason: 'end_turn',
      },
      'gpt-5',
    ) as {
      id: string;
      object: string;
      model: string;
      choices: Array<{ message: { content: string }; finish_reason: string }>;
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };
    expect(out.object).toBe('chat.completion');
    expect(out.model).toBe('gpt-5');
    const choice = out.choices[0]!;
    expect(choice.message.content).toBe('hello world');
    expect(choice.finish_reason).toBe('stop');
    expect(out.usage).toEqual({ prompt_tokens: 5, completion_tokens: 7, total_tokens: 12 });
  });

  it('maps max_tokens stop reason to length', () => {
    const out = translateResponse(
      { id: 'msg_1', stop_reason: 'max_tokens' },
      'gpt-5',
    ) as { choices: Array<{ finish_reason: string }> };
    expect(out.choices[0]!.finish_reason).toBe('length');
  });
});

describe('translateStreamEvent', () => {
  const ctx = { id: 'id-1', model: 'gpt-5' };

  it('emits a content delta for each content_block_delta', () => {
    const chunks = translateStreamEvent(
      'content_block_delta',
      '{"delta":{"text":"hello"}}',
      ctx,
    );
    expect(chunks).toHaveLength(1);
    const first = chunks[0]!;
    expect(first).toContain('"content":"hello"');
    expect(first.startsWith('data:')).toBe(true);
  });

  it('emits a finish_reason chunk on message_delta with stop_reason', () => {
    const chunks = translateStreamEvent(
      'message_delta',
      '{"delta":{"stop_reason":"end_turn"}}',
      ctx,
    );
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!).toContain('"finish_reason":"stop"');
  });

  it('emits [DONE] on message_stop', () => {
    expect(translateStreamEvent('message_stop', '{}', ctx)).toEqual(['data: [DONE]\n\n']);
  });

  it('ignores unknown events', () => {
    expect(translateStreamEvent('ping', '{}', ctx)).toEqual([]);
  });
});
