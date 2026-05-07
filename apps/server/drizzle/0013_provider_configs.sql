-- Single-row-per-vendor credential store for OpenAI-compatible APIs
-- (DeepSeek, Qwen, Kimi, Zhipu, Doubao, Mistral, Gemini, plus a real
-- OpenAI key when the operator chooses to configure one). Distinct
-- from the `accounts` table, which holds per-user OAuth pool entries
-- for Claude Code and Codex CLI.
CREATE TABLE "provider_configs" (
    "slug" varchar(32) PRIMARY KEY NOT NULL,
    "api_key_sealed" text,
    "base_url_override" text,
    "enabled" boolean DEFAULT true NOT NULL,
    "last_tested_at" timestamp with time zone,
    "last_tested_ok" boolean,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
