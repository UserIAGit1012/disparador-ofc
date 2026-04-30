-- Migration V8: Multiple Meta Business accounts (global, not per Chatwoot account)
-- Replaces V7 (meta_credentials). Run in Supabase SQL Editor.

-- 1. Drop V7 table if it exists (no production data — V7 was just introduced)
DROP TABLE IF EXISTS meta_credentials;

-- 2. New table: list of Meta Business / WABA accounts the user has registered
CREATE TABLE IF NOT EXISTS meta_business_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  business_account_id TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE meta_business_accounts IS 'Meta WhatsApp Business Account credentials. Global (not tied to Chatwoot account) — used across all template/number management flows.';
COMMENT ON COLUMN meta_business_accounts.name IS 'Friendly label like "Business 1 - Peak Performance"';
COMMENT ON COLUMN meta_business_accounts.business_account_id IS 'WhatsApp Business Account ID (WABA) from Meta Business Manager';
COMMENT ON COLUMN meta_business_accounts.access_token IS 'Long-lived System User access token with whatsapp_business_management scope';
