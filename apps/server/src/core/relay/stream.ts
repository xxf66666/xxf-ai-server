// Minimal SSE parser used by the relay to pull `usage` out of Anthropic's
// `message_start` + `message_delta` events while forwarding every byte
// untouched to the client.

export interface UsageAccumulator {
  /** Fresh input tokens — not replayed from cache. */
  inputTokens: number;
  /** Replayed from prompt cache; charged ~10% of input rate. */
  cacheReadTokens: number;
  /** Written into cache this turn; charged ~125% of input rate. */
  cacheCreationTokens: number;
  outputTokens: number;
  /** ms elapsed between start() and first byte seen in ingest(). */
  ttfbMs: number | null;
  start(): void;
  ingest(chunk: Uint8Array): void;
}

export function createUsageAccumulator(): UsageAccumulator {
  let buffer = '';
  const decoder = new TextDecoder();
  let startedAt = 0;
  const acc: UsageAccumulator = {
    inputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    outputTokens: 0,
    ttfbMs: null,
    start() {
      startedAt = Date.now();
    },
    ingest(chunk: Uint8Array) {
      if (acc.ttfbMs === null && startedAt > 0) {
        acc.ttfbMs = Date.now() - startedAt;
      }
      buffer += decoder.decode(chunk, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        consumeFrame(frame, acc);
      }
    },
  };
  return acc;
}

function consumeFrame(frame: string, acc: UsageAccumulator): void {
  let event: string | null = null;
  let data: string | null = null;
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data = line.slice(5).trim();
  }
  if (!data) return;
  if (event !== 'message_start' && event !== 'message_delta') return;
  try {
    const parsed = JSON.parse(data);
    const usage = parsed.usage ?? parsed.message?.usage;
    if (!usage) return;
    // Each field comes from Anthropic's authoritative tokenizer. We keep
    // the three input buckets SEPARATE so billing can charge each at
    // its own rate (Anthropic: read = 10% of input, creation = 125%).
    // `take` only updates when the new value is larger; message_delta
    // may emit only output_tokens and we don't want that event to zero
    // out the input counts captured at message_start.
    const take = (
      key: 'inputTokens' | 'cacheReadTokens' | 'cacheCreationTokens' | 'outputTokens',
      raw: unknown,
    ) => {
      if (typeof raw === 'number' && raw > acc[key]) acc[key] = raw;
    };
    take('inputTokens', usage.input_tokens);
    take('cacheReadTokens', usage.cache_read_input_tokens);
    take('cacheCreationTokens', usage.cache_creation_input_tokens);
    take('outputTokens', usage.output_tokens);
  } catch {
    // Non-JSON payloads are ignored; we never fail the relay on parse errors.
  }
}
