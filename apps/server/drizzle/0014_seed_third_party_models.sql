-- Seed pricing for the third-party providers Nexa now relays through.
-- Prices are per 1M tokens in micro-USD. Sources: each vendor's public
-- pricing page (snapshot 2026-04). Cache rates use the standard 10% /
-- 125% ratio Anthropic established; vendors that don't support caching
-- still get the columns set so computeCost has a uniform fallback.
--
-- For domestic Chinese vendors quoted in CNY, prices are converted at
-- a static USD rate (¥7.2 = $1) baked in here — when the live rate
-- diverges materially, refresh via UPDATE.

INSERT INTO "model_pricing"
  ("model_id", "provider", "input_mud_per_m", "output_mud_per_m",
   "cache_read_mud_per_m", "cache_creation_mud_per_m", "tier") VALUES
  -- DeepSeek (officially USD-priced)
  ('deepseek-chat',           'deepseek',  140000,  280000,   14000,   175000, 'flagship'),
  ('deepseek-reasoner',       'deepseek',  550000, 2190000,   55000,   687500, 'reasoning'),

  -- Qwen (CNY → USD @ 7.2; prices from Aliyun DashScope)
  ('qwen3-max',               'qwen',     800000, 3200000,   80000, 1000000, 'flagship'),
  ('qwen3-plus',              'qwen',     400000, 1200000,   40000,  500000, 'mid'),
  ('qwen3-coder-plus',        'qwen',     600000, 1800000,   60000,  750000, 'codex'),
  ('qwen3-flash',             'qwen',     150000,  600000,   15000,  187500, 'small'),

  -- Kimi (Moonshot)
  ('kimi-k2-0905-preview',    'kimi',     600000, 2500000,   60000,  750000, 'flagship'),
  ('moonshot-v1-32k',         'kimi',     200000,  500000,   20000,  250000, 'mid'),

  -- Zhipu GLM
  ('glm-4.6',                 'zhipu',    400000, 1600000,   40000,  500000, 'flagship'),
  ('glm-4.5-air',             'zhipu',    100000,  300000,   10000,  125000, 'small'),

  -- Doubao (Volcengine ByteDance)
  ('doubao-1-5-pro-256k',     'doubao',   500000, 1100000,   50000,  625000, 'flagship'),
  ('doubao-1-5-lite-32k',     'doubao',   100000,  200000,   10000,  125000, 'small'),

  -- Mistral
  ('mistral-large-latest',    'mistral', 2000000, 6000000,  200000, 2500000, 'flagship'),
  ('codestral-latest',        'mistral',  300000,  900000,   30000,  375000, 'codex'),
  ('magistral-medium-latest', 'mistral', 2000000, 5000000,  200000, 2500000, 'reasoning'),

  -- Gemini (Google AI Studio openai-compat endpoint)
  ('gemini-2.5-pro',          'gemini',  1250000, 10000000, 125000, 1562500, 'flagship'),
  ('gemini-2.5-flash',        'gemini',   300000,  2500000,  30000,  375000, 'mid'),
  ('gemini-2.5-flash-lite',   'gemini',   100000,   400000,  10000,  125000, 'small')
ON CONFLICT ("model_id") DO NOTHING;
