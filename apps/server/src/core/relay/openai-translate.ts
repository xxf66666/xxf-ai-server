// Translate between OpenAI's /v1/chat/completions shape and Anthropic's
// /v1/messages shape. This is deliberately minimal — the field set is only
// what AI coding tools (Cursor, Cline's OpenAI mode, Roo, …) actually send.
//
// Flow at the gateway:
//
//   client (OpenAI-speaking)  ──► /v1/chat/completions
//     ──► translateRequest ──► Claude /v1/messages (our Anthropic relay)
//     ──► translateResponse ◄── Anthropic response
//   response (OpenAI-shaped) ◄─── client
//
// Streaming is translated event-by-event: message_delta → chunk with
// `choices[0].delta.content`, message_stop → final chunk with stop reason.

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | Array<{ type: string; text?: string }>;
  name?: string;
}

interface OpenAIRequest {
  model?: string;
  messages: OpenAIMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  stop?: string | string[];
  // tools + function_call are not translated for P4 — reject if present.
  tools?: unknown;
}

export interface AnthropicRequest {
  model: string;
  max_tokens: number;
  system?: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  temperature?: number;
  top_p?: number;
  stop_sequences?: string[];
  stream?: boolean;
}

// Default model mapping when client requests an OpenAI model name. Can be
// overridden via `system_settings.models.allow` + a mapping table later.
const DEFAULT_MODEL_MAP: Record<string, string> = {
  'gpt-4o': 'claude-sonnet-4-6',
  'gpt-4o-mini': 'claude-haiku-4-5-20251001',
  'gpt-4-turbo': 'claude-sonnet-4-6',
  'gpt-4': 'claude-sonnet-4-6',
  'gpt-3.5-turbo': 'claude-haiku-4-5-20251001',
  'o1': 'claude-opus-4-7',
  'o1-mini': 'claude-sonnet-4-6',
};

export function resolveModel(requested: string | undefined): string {
  if (!requested) return 'claude-sonnet-4-6';
  if (requested.startsWith('claude-')) return requested;
  return DEFAULT_MODEL_MAP[requested] ?? 'claude-sonnet-4-6';
}

export function translateRequest(body: OpenAIRequest): AnthropicRequest {
  const systemParts: string[] = [];
  const messages: AnthropicRequest['messages'] = [];
  for (const m of body.messages ?? []) {
    const text = extractText(m.content);
    if (!text) continue;
    if (m.role === 'system') {
      systemParts.push(text);
    } else if (m.role === 'user' || m.role === 'assistant') {
      messages.push({ role: m.role, content: text });
    } else if (m.role === 'tool') {
      // Collapse tool outputs into user context for now.
      messages.push({ role: 'user', content: `[tool:${m.name ?? '?'}] ${text}` });
    }
  }

  const out: AnthropicRequest = {
    model: resolveModel(body.model),
    max_tokens: Math.min(body.max_tokens ?? 4096, 16384),
    messages,
  };
  if (systemParts.length) out.system = systemParts.join('\n\n');
  if (typeof body.temperature === 'number') out.temperature = body.temperature;
  if (typeof body.top_p === 'number') out.top_p = body.top_p;
  if (body.stop) out.stop_sequences = Array.isArray(body.stop) ? body.stop : [body.stop];
  if (body.stream) out.stream = true;
  return out;
}

function extractText(content: OpenAIMessage['content']): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  return content
    .filter((p) => p.type === 'text' && typeof p.text === 'string')
    .map((p) => p.text!)
    .join('');
}

// ---------- non-streaming response translation ----------

interface AnthropicFullResponse {
  id: string;
  model?: string;
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  stop_reason?: string;
}

export function translateResponse(anthropic: AnthropicFullResponse, requestedModel: string): unknown {
  const text = (anthropic.content ?? [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('');
  return {
    id: anthropic.id,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: requestedModel,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: text },
        finish_reason: mapStopReason(anthropic.stop_reason),
      },
    ],
    usage: {
      prompt_tokens: anthropic.usage?.input_tokens ?? 0,
      completion_tokens: anthropic.usage?.output_tokens ?? 0,
      total_tokens:
        (anthropic.usage?.input_tokens ?? 0) + (anthropic.usage?.output_tokens ?? 0),
    },
  };
}

function mapStopReason(reason: string | undefined): string {
  switch (reason) {
    case 'end_turn':
    case 'stop_sequence':
      return 'stop';
    case 'max_tokens':
      return 'length';
    case 'tool_use':
      return 'tool_calls';
    default:
      return 'stop';
  }
}

// ---------- streaming event translation ----------

/**
 * Returns the OpenAI chunks to emit for each Anthropic SSE event.
 * Caller feeds in event+data as strings; receives array of chunk objects.
 */
export function translateStreamEvent(
  event: string,
  data: string,
  ctx: { id: string; model: string },
): string[] {
  if (event === 'content_block_delta') {
    try {
      const parsed = JSON.parse(data);
      const text = parsed?.delta?.text ?? parsed?.delta?.partial_json ?? '';
      if (!text) return [];
      return [openaiChunk(ctx, { content: text })];
    } catch {
      return [];
    }
  }
  if (event === 'message_delta') {
    try {
      const parsed = JSON.parse(data);
      const reason = parsed?.delta?.stop_reason;
      if (!reason) return [];
      return [openaiChunk(ctx, {}, mapStopReason(reason))];
    } catch {
      return [];
    }
  }
  if (event === 'message_stop') {
    return ['data: [DONE]\n\n'];
  }
  return [];
}

function openaiChunk(
  ctx: { id: string; model: string },
  delta: { role?: string; content?: string },
  finishReason: string | null = null,
): string {
  const payload = {
    id: ctx.id,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: ctx.model,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  };
  return `data: ${JSON.stringify(payload)}\n\n`;
}
