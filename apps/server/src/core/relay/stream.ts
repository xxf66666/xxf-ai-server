// Minimal SSE parser used by the relay to pull `usage` out of Anthropic's
// `message_delta` event while forwarding every byte untouched to the client.

export interface UsageDelta {
  inputTokens?: number;
  outputTokens?: number;
}

export interface UsageAccumulator {
  inputTokens: number;
  outputTokens: number;
  ingest(chunk: Uint8Array): void;
}

export function createUsageAccumulator(): UsageAccumulator {
  let buffer = '';
  const decoder = new TextDecoder();
  const acc: UsageAccumulator = {
    inputTokens: 0,
    outputTokens: 0,
    ingest(chunk: Uint8Array) {
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
    if (typeof usage.input_tokens === 'number') acc.inputTokens = usage.input_tokens;
    if (typeof usage.output_tokens === 'number') acc.outputTokens = usage.output_tokens;
  } catch {
    // Non-JSON payloads are ignored; we never fail the relay on parse errors.
  }
}
