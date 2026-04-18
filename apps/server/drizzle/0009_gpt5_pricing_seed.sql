-- 2026-era OpenAI models. Pricing here is OpenAI's public list price in
-- micro-USD per 1M tokens (input, output). We charge users these with
-- the site-wide markupRate applied. Data-only migration; safe to re-run
-- because of the ON CONFLICT DO NOTHING guard.
INSERT INTO "model_pricing" ("model_id", "provider", "input_mud_per_m", "output_mud_per_m", "tier") VALUES
  ('gpt-5',           'openai',  2000000, 10000000, 'flagship'),
  ('gpt-5-mini',      'openai',   400000,  2000000, 'mid'),
  ('gpt-5-nano',      'openai',    50000,   400000, 'small'),
  ('gpt-5-codex',     'openai',  1250000,  5000000, 'codex'),
  ('o3',              'openai',  2000000,  8000000, 'reasoning'),
  ('o3-mini',         'openai',   300000,  1500000, 'small')
ON CONFLICT ("model_id") DO NOTHING;
