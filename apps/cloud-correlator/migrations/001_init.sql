CREATE TABLE IF NOT EXISTS devices (
  device_id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  hostname TEXT NOT NULL,
  owner_signing_public_key TEXT NOT NULL,
  device_signing_public_key TEXT NOT NULL,
  device_agreement_public_key TEXT NOT NULL,
  hkdf_session_key_id TEXT NOT NULL,
  protocol_version TEXT NOT NULL,
  paired_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS pairing_nonces (
  nonce TEXT PRIMARY KEY,
  seen_at_ms BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  seq BIGSERIAL PRIMARY KEY,
  schema_version TEXT NOT NULL,
  event_id UUID UNIQUE NOT NULL,
  device_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  ciphertext TEXT NOT NULL,
  nonce TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  signature TEXT NOT NULL,
  prev_event_hash CHAR(64),
  event_hash CHAR(64) UNIQUE NOT NULL,
  UNIQUE(device_id, nonce)
);

CREATE INDEX IF NOT EXISTS idx_events_device_seq ON events (device_id, seq DESC);
