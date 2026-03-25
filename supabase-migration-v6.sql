-- Migration V6: Add external_id column to track WhatsApp Message ID (wamid)
-- Run this in Supabase SQL Editor

ALTER TABLE dispatch_messages ADD COLUMN IF NOT EXISTS external_id TEXT;

COMMENT ON COLUMN dispatch_messages.external_id IS 'WhatsApp Message ID (wamid) returned by Meta API - proves message was accepted';
