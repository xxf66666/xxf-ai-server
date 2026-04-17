import { describe, expect, it } from 'vitest';
import { createUsageAccumulator } from './stream.js';

function feed(acc: ReturnType<typeof createUsageAccumulator>, chunks: string[]) {
  const enc = new TextEncoder();
  for (const c of chunks) acc.ingest(enc.encode(c));
}

describe('createUsageAccumulator', () => {
  it('reads input_tokens from message_start and output_tokens from message_delta', () => {
    const acc = createUsageAccumulator();
    feed(acc, [
      'event: message_start\n',
      'data: {"type":"message_start","message":{"usage":{"input_tokens":42,"output_tokens":0}}}\n\n',
      'event: content_block_delta\n',
      'data: {"type":"content_block_delta","delta":{"text":"hi"}}\n\n',
      'event: message_delta\n',
      'data: {"type":"message_delta","usage":{"output_tokens":17}}\n\n',
    ]);
    expect(acc.inputTokens).toBe(42);
    expect(acc.outputTokens).toBe(17);
  });

  it('tolerates frames split across chunks', () => {
    const acc = createUsageAccumulator();
    feed(acc, [
      'event: message_start\ndata: {"type":"message_start","message":{"usa',
      'ge":{"input_tokens":7,"output_tokens":0}}}\n\n',
    ]);
    expect(acc.inputTokens).toBe(7);
  });

  it('ignores frames with unrecognized events', () => {
    const acc = createUsageAccumulator();
    feed(acc, ['event: ping\ndata: {}\n\n']);
    expect(acc.inputTokens).toBe(0);
    expect(acc.outputTokens).toBe(0);
  });

  it('never throws on malformed JSON payload', () => {
    const acc = createUsageAccumulator();
    expect(() =>
      feed(acc, ['event: message_delta\ndata: {not json}\n\n']),
    ).not.toThrow();
  });
});
