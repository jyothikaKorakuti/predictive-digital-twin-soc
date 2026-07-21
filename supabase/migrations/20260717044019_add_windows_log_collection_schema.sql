/*
# Windows Event Log Collection Schema

## Purpose
Adds support for real-time Windows Event Log collection from remote collector agents.
This enables the Live Logs page to display actual ingested Windows events (is_simulated = false)
instead of only simulated seed data.

## Changes

### 1. New columns on `events` table
- `record_id` (bigint) — Windows EventRecordID (per-channel sequential record number). Used for deduplication.
- `event_id` (integer) — Windows EventID (4624, 4625, 4688, 1102, Sysmon 1/3/7...).
- `provider` (text) — Windows ProviderName / source channel.
- `channel` (text) — Windows log channel (Security, System, Application, Sysmon/Operational, etc.).
- `log_level` (integer) — Windows Level (0=Info, 1=Critical, 2=Error, 3=Warning, 4=Info).

### 2. New table `collector_agents`
Tracks remote collector agents authorized to push logs. Each agent has an API key (stored hashed) and belongs to one org.
Columns: id, org_id, name, hostname, agent_type, api_key_hash (unique), api_key_prefix, status, last_seen_at, events_ingested, version, created_at.

### 3. Unique dedup index on `events`
`UNIQUE (org_id, hostname, source_name, record_id) WHERE record_id IS NOT NULL`.

### 4. Performance indexes on `events`
- (org_id, event_timestamp DESC) for Live Logs polling.
- (org_id, ingestion_timestamp DESC) for "events since last poll".

### 5. RLS on `collector_agents`
Authenticated users can manage agents. The Edge Function uses the service role key (bypasses RLS) for collector writes.

## Security
- API keys stored ONLY as SHA-256 hashes. Plaintext returned once at generation.
- Edge Function validates API key before any insert.
- All additions are additive; no existing data modified or dropped.
*/

-- 1. Add Windows-specific columns to events
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS record_id bigint,
  ADD COLUMN IF NOT EXISTS event_id integer,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS channel text,
  ADD COLUMN IF NOT EXISTS log_level integer;

-- 2. Create collector_agents table
CREATE TABLE IF NOT EXISTS collector_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  hostname text,
  agent_type text NOT NULL DEFAULT 'windows',
  api_key_hash text UNIQUE NOT NULL,
  api_key_prefix text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  last_seen_at timestamptz,
  events_ingested bigint NOT NULL DEFAULT 0,
  version text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE collector_agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ca_select" ON collector_agents;
CREATE POLICY "ca_select" ON collector_agents
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "ca_insert" ON collector_agents;
CREATE POLICY "ca_insert" ON collector_agents
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "ca_update" ON collector_agents;
CREATE POLICY "ca_update" ON collector_agents
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ca_delete" ON collector_agents;
CREATE POLICY "ca_delete" ON collector_agents
  FOR DELETE TO authenticated USING (true);

-- 3. Dedup unique index (partial: only rows with record_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_dedup
  ON events (org_id, hostname, source_name, record_id)
  WHERE record_id IS NOT NULL;

-- 4. Performance indexes
CREATE INDEX IF NOT EXISTS idx_events_org_ts ON events (org_id, event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_org_ingested ON events (org_id, ingestion_timestamp DESC);

-- Index for collector_agents lookups by API key hash
CREATE INDEX IF NOT EXISTS idx_collector_agents_keyhash ON collector_agents (api_key_hash) WHERE status = 'active';
