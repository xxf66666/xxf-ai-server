// Static catalog of known upstream providers. The DB row in
// `provider_configs` only carries the secret + per-deploy overrides;
// everything else (URL, model prefix, brand name) lives here so the
// admin UI and the dispatcher both read from one source of truth.
//
// Adding a new vendor = add a row here + one new row per model in
// model_pricing. No code changes elsewhere.

export interface ProviderDef {
  /** Stable identifier; matches provider_configs.slug + model_pricing.provider. */
  slug: string;
  /** Human-readable display name for UI. */
  displayName: string;
  /** Default upstream base URL (operators can override per-deploy). */
  baseUrl: string;
  /** Path appended to baseUrl for chat completions (OpenAI-compatible). */
  chatPath: string;
  /** Used by the dispatcher: a request whose model id starts with one
   * of these prefixes is routed to this provider. The first match wins. */
  modelPrefixes: ReadonlyArray<string>;
  /** True if this provider speaks the OpenAI /chat/completions schema
   * out of the box. We send everything through the openai-compat relay
   * when this is true. */
  openaiCompat: boolean;
  /** Some providers want their own auth header instead of Authorization
   * Bearer (Gemini sends `x-goog-api-key`, etc). null = standard Bearer. */
  authHeader?: string;
  /** Marketing tagline shown on /console/models grouping. */
  tagline: string;
}

export const PROVIDERS: ReadonlyArray<ProviderDef> = [
  {
    slug: 'claude',
    displayName: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com',
    chatPath: '/v1/messages',
    modelPrefixes: ['claude-'],
    openaiCompat: false, // handled by the existing OAuth pool relay
    tagline: 'Claude Opus / Sonnet / Haiku · OAuth pool',
  },
  {
    slug: 'openai',
    displayName: 'OpenAI',
    baseUrl: 'https://api.openai.com',
    chatPath: '/v1/chat/completions',
    modelPrefixes: ['gpt-', 'o1', 'o3', 'o4'],
    openaiCompat: true,
    tagline: 'GPT-5 family · o-series reasoning',
  },
  {
    slug: 'deepseek',
    displayName: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    chatPath: '/chat/completions',
    modelPrefixes: ['deepseek-'],
    openaiCompat: true,
    tagline: 'V3 / V3.1 · best $/token in the catalog',
  },
  {
    slug: 'qwen',
    displayName: 'Qwen (Alibaba)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    chatPath: '/chat/completions',
    modelPrefixes: ['qwen-', 'qwen3-', 'qwq-'],
    openaiCompat: true,
    tagline: 'Qwen 3 series · strong on Chinese',
  },
  {
    slug: 'kimi',
    displayName: 'Kimi (Moonshot)',
    baseUrl: 'https://api.moonshot.cn/v1',
    chatPath: '/chat/completions',
    modelPrefixes: ['kimi-', 'moonshot-'],
    openaiCompat: true,
    tagline: 'Kimi K2 · 1M context, agentic',
  },
  {
    slug: 'zhipu',
    displayName: 'Zhipu GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    chatPath: '/chat/completions',
    modelPrefixes: ['glm-', 'cogvideox'],
    openaiCompat: true,
    tagline: 'GLM-4.5 / 4.5-Air',
  },
  {
    slug: 'doubao',
    displayName: 'Doubao (Volcengine)',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    chatPath: '/chat/completions',
    modelPrefixes: ['doubao-', 'ep-'],
    openaiCompat: true,
    tagline: 'ByteDance Doubao · domestic flagship',
  },
  {
    slug: 'mistral',
    displayName: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    chatPath: '/chat/completions',
    modelPrefixes: ['mistral-', 'codestral-', 'magistral-', 'pixtral-'],
    openaiCompat: true,
    tagline: 'Mistral Large / Codestral · EU-hosted',
  },
  {
    slug: 'gemini',
    displayName: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    chatPath: '/chat/completions',
    modelPrefixes: ['gemini-'],
    openaiCompat: true,
    tagline: 'Gemini 2.5 Pro / Flash · multimodal',
  },
];

const PREFIX_LOOKUP: ReadonlyArray<{ prefix: string; provider: ProviderDef }> = (() => {
  const out: { prefix: string; provider: ProviderDef }[] = [];
  for (const p of PROVIDERS) {
    for (const px of p.modelPrefixes) out.push({ prefix: px, provider: p });
  }
  // Sort longest-first so `qwen3-` matches before `qwen-`.
  out.sort((a, b) => b.prefix.length - a.prefix.length);
  return out;
})();

/** Find the provider that owns a given model id by prefix. Returns null
 * if no provider claims the prefix; caller decides whether to fall back
 * to translation or reject. */
export function providerForModel(modelId: string): ProviderDef | null {
  for (const { prefix, provider } of PREFIX_LOOKUP) {
    if (modelId.startsWith(prefix)) return provider;
  }
  return null;
}

export function getProviderBySlug(slug: string): ProviderDef | null {
  return PROVIDERS.find((p) => p.slug === slug) ?? null;
}
