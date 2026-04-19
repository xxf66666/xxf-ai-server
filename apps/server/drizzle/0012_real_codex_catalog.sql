-- Replace the speculative gpt-5 / o3 seed with the actual Codex CLI
-- 2026-04 catalogue (screenshot from the /model picker).
--
-- Pricing estimates: OpenAI doesn't publish per-model rates for every
-- point release so we extrapolate from publicly known gpt-5 base prices
-- ($2/$10 per M). Each entry also gets the 10% / 125% cache rates that
-- we apply to every Anthropic-translated call.

DELETE FROM "model_pricing"
 WHERE "provider" = 'openai'
   AND "model_id" IN (
     'gpt-5',
     'gpt-5-mini',
     'gpt-5-nano',
     'gpt-5-codex',
     'o3',
     'o3-mini'
   );

INSERT INTO "model_pricing"
  ("model_id", "provider", "input_mud_per_m", "output_mud_per_m",
   "cache_read_mud_per_m", "cache_creation_mud_per_m", "tier") VALUES
  -- current flagship (Apr 2026)
  ('gpt-5.4',             'openai', 2000000, 10000000,  200000, 2500000,  'flagship'),
  ('gpt-5.4-mini',        'openai',  400000,  2000000,   40000,  500000,  'mid'),
  -- codex-optimized line
  ('gpt-5.3-codex',       'openai', 1500000,  6000000,  150000, 1875000,  'codex'),
  ('gpt-5.2-codex',       'openai', 1250000,  5000000,  125000, 1562500,  'codex'),
  ('gpt-5.1-codex-max',   'openai', 2000000, 10000000,  200000, 2500000,  'codex'),
  ('gpt-5.1-codex-mini',  'openai',  300000,  1500000,   30000,  375000,  'small'),
  -- professional / long-running agent work
  ('gpt-5.2',             'openai', 1500000,  7500000,  150000, 1875000,  'mid')
ON CONFLICT ("model_id") DO NOTHING;
