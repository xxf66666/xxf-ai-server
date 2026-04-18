-- Remove retired OpenAI model pricing rows. The 2026 catalogue (gpt-5
-- family + o3 family, seeded in migration 0009) is the only thing we
-- still quote prices for. Usage_log rows that reference these model_ids
-- are NOT touched — model is a free-text column, not a foreign key, so
-- historical rows stay readable.
DELETE FROM "model_pricing"
 WHERE "provider" = 'openai'
   AND "model_id" IN (
     'gpt-4o',
     'gpt-4o-mini',
     'gpt-4-turbo',
     'gpt-4',
     'gpt-3.5-turbo',
     'o1',
     'o1-mini'
   );
