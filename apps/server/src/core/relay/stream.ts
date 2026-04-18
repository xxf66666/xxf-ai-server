// Minimal SSE parser used by the relay to pull `usage` out of Anthropic's
// `message_delta` event while forwarding every byte untouched to the client.

export interface UsageDelta {
  inputTokens?: number;
  outputTokens?: number;
}

export interface UsageAccumulator {
  /** Total billable input = input + cache_read + cache_creation. */
  inputTokens: number;
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
      // SSE frames are separated by blank lines. Parse complete frames only,
      // leave partial tail in buffer for the next ingest.
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
  // Anthropic emits `message_start` with initial usage, and `message_delta`
  // with final usage (including output_tokens once the stream is done).
  if (event !== 'message_start' && event !== 'message_delta') return;
  try {
    const parsed = JSON.parse(data);
    const usage = parsed.usage ?? parsed.message?.usage;
    if (!usage) return;
    // With prompt caching + 1M context, real input is split across three
    // fields; charge the user for all of them. output_tokens is monotonic
    // per event so overwrite, but input we combine once on message_start.
    const fresh =
      (typeof usage.input_tokens === 'number' ? usage.input_tokens : 0) +
      (typeof usage.cache_read_input_tokens === 'number'
        ? usage.cache_read_input_tokens
        : 0) +
      (typeof usage.cache_creation_input_tokens === 'number'
        ? usage.cache_creation_input_tokens
        : 0);
    // Only update if the new number is larger — stops message_delta with
    // only output_tokens from zeroing out the input count captured at
    // message_start.
    if (fresh > acc.inputTokens) acc.inputTokens = fresh;
    if (typeof usage.output_tokens === 'number') acc.outputTokens = usage.output_tokens;
  } catch {
    // Non-JSON payloads are ignored; we never fail the relay on parse errors.
  }
}
