-- Migration V7: Meta Business credentials per Chatwoot account
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS meta_credentials (
  account_id BIGINT PRIMARY KEY,
  business_account_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE meta_credentials IS 'Meta WhatsApp Business credentials (BM ID + access token) per Chatwoot account, used to list phone numbers and manage templates directly via Graph API.';
COMMENT ON COLUMN meta_credentials.business_account_id IS 'WhatsApp Business Account ID (WABA) from Meta Business Manager';
COMMENT ON COLUMN meta_credentials.access_token IS 'Long-lived System User access token with whatsapp_business_management scope';
