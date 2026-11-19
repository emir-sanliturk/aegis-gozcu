CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'owner',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO users (user_id, role, status)
VALUES ('usr-owner-default', 'owner', 'active')
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS owner_user_id TEXT NOT NULL DEFAULT 'usr-owner-default';

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS owner_user_id TEXT NOT NULL DEFAULT 'usr-owner-default';

DO $$ BEGIN
  ALTER TABLE devices
    ADD CONSTRAINT fk_devices_owner_user
    FOREIGN KEY (owner_user_id) REFERENCES users(user_id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE events
    ADD CONSTRAINT fk_events_owner_user
    FOREIGN KEY (owner_user_id) REFERENCES users(user_id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE events
    ADD CONSTRAINT fk_events_device
    FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_devices_owner ON devices (owner_user_id, paired_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_owner_seq ON events (owner_user_id, seq DESC);

CREATE TABLE IF NOT EXISTS shares (
  share_id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  access_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE shares
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_shares_owner_active ON shares (owner_user_id, active, expires_at DESC);

CREATE TABLE IF NOT EXISTS commands (
  command_id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  target_device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('lock_session')),
  event_id UUID REFERENCES events(event_id) ON DELETE SET NULL,
  explicit_user_confirmation BOOLEAN NOT NULL CHECK (explicit_user_confirmation = TRUE),
  status TEXT NOT NULL DEFAULT 'queued_for_device',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE commands
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_commands_owner_created ON commands (owner_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  target_id TEXT,
  outcome TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  ip_hash CHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);
