-- Migration V5: Enable Realtime on dispatch_messages for live log monitoring
-- Run this in Supabase SQL Editor

-- 1. Enable Realtime on dispatch_messages table
ALTER PUBLICATION supabase_realtime ADD TABLE dispatch_messages;

-- 2. Also enable Realtime on dispatches table (for status updates)
ALTER PUBLICATION supabase_realtime ADD TABLE dispatches;

-- 3. Ensure sent_at column exists (some installs may be missing it)
ALTER TABLE dispatch_messages ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

-- 4. Ensure error_message column exists
ALTER TABLE dispatch_messages ADD COLUMN IF NOT EXISTS error_message TEXT;

-- 5. Ensure cost_usd column exists
ALTER TABLE dispatch_messages ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(10,6);

-- 6. Index for faster realtime filtering by dispatch_id
CREATE INDEX IF NOT EXISTS idx_dispatch_messages_dispatch_status
  ON dispatch_messages(dispatch_id, status);
