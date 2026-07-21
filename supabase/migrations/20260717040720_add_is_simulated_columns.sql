/*
# Add is_simulated columns to remaining tables

Adds is_simulated boolean column to recommendations, attack_paths, incidents, simulations, and events tables
where the seed data references it but the column was missing.
*/

ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS is_simulated boolean DEFAULT false;
ALTER TABLE attack_paths ADD COLUMN IF NOT EXISTS is_simulated boolean DEFAULT false;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS is_simulated boolean DEFAULT false;
ALTER TABLE simulations ADD COLUMN IF NOT EXISTS is_simulated boolean DEFAULT true;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_simulated boolean DEFAULT false;
ALTER TABLE detection_rules ADD COLUMN IF NOT EXISTS is_simulated boolean DEFAULT false;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS is_simulated boolean DEFAULT false;
ALTER TABLE vulnerabilities ADD COLUMN IF NOT EXISTS is_simulated boolean DEFAULT false;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS is_simulated boolean DEFAULT false;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_simulated boolean DEFAULT false;
ALTER TABLE log_sources ADD COLUMN IF NOT EXISTS is_simulated boolean DEFAULT false;
ALTER TABLE risk_assessments ADD COLUMN IF NOT EXISTS is_simulated boolean DEFAULT false;
ALTER TABLE asset_vulnerabilities ADD COLUMN IF NOT EXISTS is_simulated boolean DEFAULT false;
ALTER TABLE asset_connections ADD COLUMN IF NOT EXISTS is_simulated boolean DEFAULT false;
