-- Migration V9: User profiles for per-user authorization (multi-expert)
-- + dispatches.phone_number_id for filtering history by user
-- Run in Supabase SQL Editor.

-- 1. user_profiles: links each Supabase auth user to a set of allowed phone numbers + WABAs
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  allowed_phone_ids TEXT[] NOT NULL DEFAULT '{}',
  allowed_waba_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE user_profiles IS 'Per-user authorization: which phone numbers / WABAs each Supabase user can manage. Admins see everything.';
COMMENT ON COLUMN user_profiles.allowed_phone_ids IS 'Array of Meta phone_number IDs (the value of phone_numbers.id from Graph API)';
COMMENT ON COLUMN user_profiles.allowed_waba_ids IS 'Array of WABA IDs (parent WhatsApp Business Account IDs) the user is implicitly allowed to manage';

-- 2. Mark default admin
INSERT INTO user_profiles (user_id, name, is_admin)
SELECT id, 'Admin', TRUE
FROM auth.users
WHERE email = 'admin@disparador.local'
ON CONFLICT (user_id) DO UPDATE SET is_admin = TRUE;

-- 3. dispatches: track which phone number originated the dispatch (for per-user filtering)
ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS phone_number_id TEXT;
COMMENT ON COLUMN dispatches.phone_number_id IS 'Meta phone_number ID inferred from the Chatwoot inbox at dispatch creation; used to filter history per user.';

-- 4. Helpful index for filtering
CREATE INDEX IF NOT EXISTS idx_dispatches_phone_number_id ON dispatches(phone_number_id);
