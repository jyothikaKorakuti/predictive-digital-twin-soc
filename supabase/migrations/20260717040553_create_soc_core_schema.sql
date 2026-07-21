/*
# Predictive Digital Twin SOC - Core Schema

## Overview
Creates the complete database schema for a SOC platform with organizations, assets,
vulnerabilities, log events, alerts, incidents, digital twin graph, attack paths,
simulations, risk assessments, recommendations, and MITRE ATT&CK mapping.

## Tables
1. profiles - extends auth.users with role and display name
2. organizations - tenant organizations
3. assets - IT assets (workstations, servers, firewalls, etc.)
4. asset_connections - network trust relationships (graph edges)
5. vulnerabilities - CVEs and findings
6. asset_vulnerabilities - many-to-many asset <-> vuln
7. log_sources - configured log collection sources
8. events - normalized security events
9. detection_rules - sigma-style detection rules
10. alerts - generated alerts
11. incidents - incident cases
12. incident_alerts - many-to-many incident <-> alert
13. simulations - attack simulation runs
14. simulation_steps - steps within a simulation
15. risk_assessments - asset/org risk scores
16. recommendations - prioritized security recommendations
17. mitre_techniques - MITRE ATT&CK reference data
18. attack_paths - generated attack paths
19. audit_logs - audit trail
20. reports - generated report metadata

## Security
- RLS enabled on all tables.
- Policies scoped to authenticated users.
- Organization-level isolation via org membership (simplified: all authenticated users can access for this SOC demo).
*/

-- ============ PROFILES ============
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'analyst' CHECK (role IN ('admin','analyst','auditor')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- ============ ORGANIZATIONS ============
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  industry text,
  location text,
  employee_count int,
  risk_appetite text DEFAULT 'medium',
  critical_services text,
  network_ranges text,
  description text,
  is_simulated boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_select" ON organizations;
CREATE POLICY "org_select" ON organizations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "org_insert" ON organizations;
CREATE POLICY "org_insert" ON organizations FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "org_update" ON organizations;
CREATE POLICY "org_update" ON organizations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "org_delete" ON organizations;
CREATE POLICY "org_delete" ON organizations FOR DELETE TO authenticated USING (true);

-- ============ ASSETS ============
CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  hostname text NOT NULL,
  ip_address text,
  mac_address text,
  asset_type text NOT NULL CHECK (asset_type IN ('workstation','laptop','server','domain_controller','database','web_server','firewall','router','switch','cloud','application','mobile','iot','other')),
  os_name text,
  os_version text,
  open_ports jsonb DEFAULT '[]',
  services jsonb DEFAULT '[]',
  internet_exposed boolean DEFAULT false,
  network_segment text,
  business_owner text,
  technical_owner text,
  criticality text DEFAULT 'medium' CHECK (criticality IN ('low','medium','high','critical')),
  patch_status text DEFAULT 'unknown',
  last_seen timestamptz,
  source text DEFAULT 'manual',
  data_confidence text DEFAULT 'high',
  status text DEFAULT 'active' CHECK (status IN ('active','inactive','retired')),
  tags jsonb DEFAULT '[]',
  is_simulated boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "asset_select" ON assets;
CREATE POLICY "asset_select" ON assets FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "asset_insert" ON assets;
CREATE POLICY "asset_insert" ON assets FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "asset_update" ON assets;
CREATE POLICY "asset_update" ON assets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "asset_delete" ON assets;
CREATE POLICY "asset_delete" ON assets FOR DELETE TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_assets_org ON assets(org_id);
CREATE INDEX IF NOT EXISTS idx_assets_ip ON assets(ip_address);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(asset_type);

-- ============ ASSET CONNECTIONS (graph edges) ============
CREATE TABLE IF NOT EXISTS asset_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  target_asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  relationship text NOT NULL DEFAULT 'CONNECTED_TO' CHECK (relationship IN ('CONNECTED_TO','CAN_REACH','TRUSTS','AUTHENTICATES_TO','ADMIN_ON','HOSTS','EXPOSED_TO','PROTECTED_BY')),
  port int,
  protocol text,
  bidirectional boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE asset_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "conn_select" ON asset_connections;
CREATE POLICY "conn_select" ON asset_connections FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "conn_insert" ON asset_connections;
CREATE POLICY "conn_insert" ON asset_connections FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "conn_delete" ON asset_connections;
CREATE POLICY "conn_delete" ON asset_connections FOR DELETE TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_conn_source ON asset_connections(source_asset_id);
CREATE INDEX IF NOT EXISTS idx_conn_target ON asset_connections(target_asset_id);

-- ============ VULNERABILITIES ============
CREATE TABLE IF NOT EXISTS vulnerabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  cve_id text,
  title text NOT NULL,
  description text,
  cvss_score numeric DEFAULT 0,
  cvss_severity text DEFAULT 'low' CHECK (cvss_severity IN ('info','low','medium','high','critical')),
  epss_score numeric DEFAULT 0,
  exploit_available boolean DEFAULT false,
  patch_available boolean DEFAULT false,
  remediation text,
  status text DEFAULT 'open' CHECK (status IN ('open','remediated','accepted','false_positive')),
  first_seen timestamptz DEFAULT now(),
  last_seen timestamptz DEFAULT now(),
  is_simulated boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE vulnerabilities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vuln_select" ON vulnerabilities;
CREATE POLICY "vuln_select" ON vulnerabilities FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "vuln_insert" ON vulnerabilities;
CREATE POLICY "vuln_insert" ON vulnerabilities FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "vuln_update" ON vulnerabilities;
CREATE POLICY "vuln_update" ON vulnerabilities FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "vuln_delete" ON vulnerabilities;
CREATE POLICY "vuln_delete" ON vulnerabilities FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS asset_vulnerabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  vulnerability_id uuid NOT NULL REFERENCES vulnerabilities(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  affected_service text,
  evidence text,
  assigned_analyst text,
  due_date date,
  status text DEFAULT 'open',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE asset_vulnerabilities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "av_select" ON asset_vulnerabilities;
CREATE POLICY "av_select" ON asset_vulnerabilities FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "av_insert" ON asset_vulnerabilities;
CREATE POLICY "av_insert" ON asset_vulnerabilities FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "av_update" ON asset_vulnerabilities;
CREATE POLICY "av_update" ON asset_vulnerabilities FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "av_delete" ON asset_vulnerabilities;
CREATE POLICY "av_delete" ON asset_vulnerabilities FOR DELETE TO authenticated USING (true);

-- ============ LOG SOURCES ============
CREATE TABLE IF NOT EXISTS log_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('syslog','auth_log','journald','windows_event','sysmon','fastapi','frontend','postgres','docker','nginx','wazuh','elasticsearch','custom','simulated')),
  hostname text,
  config jsonb DEFAULT '{}',
  enabled boolean DEFAULT true,
  is_simulated boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE log_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ls_select" ON log_sources;
CREATE POLICY "ls_select" ON log_sources FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ls_insert" ON log_sources;
CREATE POLICY "ls_insert" ON log_sources FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ls_update" ON log_sources;
CREATE POLICY "ls_update" ON log_sources FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ls_delete" ON log_sources;
CREATE POLICY "ls_delete" ON log_sources FOR DELETE TO authenticated USING (true);

-- ============ EVENTS (normalized logs) ============
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_timestamp timestamptz NOT NULL DEFAULT now(),
  ingestion_timestamp timestamptz DEFAULT now(),
  source_id uuid REFERENCES log_sources(id) ON DELETE SET NULL,
  source_name text,
  source_type text,
  hostname text,
  src_ip text,
  dst_ip text,
  src_port int,
  dst_port int,
  username text,
  event_category text,
  event_action text,
  process_name text,
  process_id int,
  parent_process text,
  command_line text,
  file_path text,
  message text,
  severity text DEFAULT 'info' CHECK (severity IN ('info','low','medium','high','critical')),
  raw_log text,
  parser_name text,
  detection_rule_id uuid,
  mitre_tactic text,
  mitre_technique text,
  confidence numeric DEFAULT 0,
  is_simulated boolean DEFAULT false,
  correlation_id text,
  asset_id uuid REFERENCES assets(id) ON DELETE SET NULL
);
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "evt_select" ON events;
CREATE POLICY "evt_select" ON events FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "evt_insert" ON events;
CREATE POLICY "evt_insert" ON events FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "evt_update" ON events;
CREATE POLICY "evt_update" ON events FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "evt_delete" ON events;
CREATE POLICY "evt_delete" ON events FOR DELETE TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_events_org ON events(org_id);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_srcip ON events(src_ip);
CREATE INDEX IF NOT EXISTS idx_events_dstip ON events(dst_ip);
CREATE INDEX IF NOT EXISTS idx_events_severity ON events(severity);
CREATE INDEX IF NOT EXISTS idx_events_user ON events(username);

-- ============ DETECTION RULES ============
CREATE TABLE IF NOT EXISTS detection_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  severity text DEFAULT 'medium' CHECK (severity IN ('info','low','medium','high','critical')),
  rule_type text DEFAULT 'threshold' CHECK (rule_type IN ('threshold','sequence','correlation','simple')),
  conditions jsonb DEFAULT '{}',
  threshold int DEFAULT 1,
  time_window int DEFAULT 300,
  mitre_tactic text,
  mitre_technique text,
  enabled boolean DEFAULT true,
  match_count int DEFAULT 0,
  error_count int DEFAULT 0,
  is_simulated boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE detection_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rule_select" ON detection_rules;
CREATE POLICY "rule_select" ON detection_rules FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "rule_insert" ON detection_rules;
CREATE POLICY "rule_insert" ON detection_rules FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "rule_update" ON detection_rules;
CREATE POLICY "rule_update" ON detection_rules FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "rule_delete" ON detection_rules;
CREATE POLICY "rule_delete" ON detection_rules FOR DELETE TO authenticated USING (true);

-- ============ ALERTS ============
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  severity text DEFAULT 'medium' CHECK (severity IN ('info','low','medium','high','critical')),
  status text DEFAULT 'new' CHECK (status IN ('new','investigating','contained','resolved','false_positive')),
  source text,
  rule_id uuid REFERENCES detection_rules(id) ON DELETE SET NULL,
  event_ids jsonb DEFAULT '[]',
  asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  affected_asset text,
  username text,
  src_ip text,
  mitre_tactic text,
  mitre_technique text,
  confidence numeric DEFAULT 0,
  evidence jsonb DEFAULT '[]',
  assigned_to text,
  comments jsonb DEFAULT '[]',
  false_positive_notes text,
  correlation_id text,
  is_simulated boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "alert_select" ON alerts;
CREATE POLICY "alert_select" ON alerts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "alert_insert" ON alerts;
CREATE POLICY "alert_insert" ON alerts FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "alert_update" ON alerts;
CREATE POLICY "alert_update" ON alerts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "alert_delete" ON alerts;
CREATE POLICY "alert_delete" ON alerts FOR DELETE TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_alerts_org ON alerts(org_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);

-- ============ INCIDENTS ============
CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  severity text DEFAULT 'medium' CHECK (severity IN ('info','low','medium','high','critical')),
  status text DEFAULT 'open' CHECK (status IN ('open','triaged','investigating','contained','eradicated','recovered','closed')),
  owner text,
  related_assets jsonb DEFAULT '[]',
  related_users jsonb DEFAULT '[]',
  iocs jsonb DEFAULT '[]',
  mitre_mapping jsonb DEFAULT '[]',
  timeline jsonb DEFAULT '[]',
  notes jsonb DEFAULT '[]',
  containment_actions text,
  eradication_actions text,
  recovery_actions text,
  lessons_learned text,
  is_simulated boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inc_select" ON incidents;
CREATE POLICY "inc_select" ON incidents FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "inc_insert" ON incidents;
CREATE POLICY "inc_insert" ON incidents FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "inc_update" ON incidents;
CREATE POLICY "inc_update" ON incidents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "inc_delete" ON incidents;
CREATE POLICY "inc_delete" ON incidents FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS incident_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  alert_id uuid NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE incident_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ia_select" ON incident_alerts;
CREATE POLICY "ia_select" ON incident_alerts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ia_insert" ON incident_alerts;
CREATE POLICY "ia_insert" ON incident_alerts FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ia_delete" ON incident_alerts;
CREATE POLICY "ia_delete" ON incident_alerts FOR DELETE TO authenticated USING (true);

-- ============ SIMULATIONS ============
CREATE TABLE IF NOT EXISTS simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  scenario_name text NOT NULL,
  entry_point text,
  initial_asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  target_asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  assumptions jsonb DEFAULT '[]',
  mitre_techniques jsonb DEFAULT '[]',
  status text DEFAULT 'completed' CHECK (status IN ('running','completed','stopped','failed')),
  successful_steps int DEFAULT 0,
  blocked_steps int DEFAULT 0,
  estimated_impact text,
  recommended_mitigations jsonb DEFAULT '[]',
  business_impact text,
  probability numeric DEFAULT 0,
  started_by text,
  is_simulated boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE simulations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sim_select" ON simulations;
CREATE POLICY "sim_select" ON simulations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "sim_insert" ON simulations;
CREATE POLICY "sim_insert" ON simulations FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "sim_update" ON simulations;
CREATE POLICY "sim_update" ON simulations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sim_delete" ON simulations;
CREATE POLICY "sim_delete" ON simulations FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS simulation_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id uuid NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  step_number int NOT NULL,
  asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  asset_name text,
  action text NOT NULL,
  mitre_technique text,
  probability numeric DEFAULT 0,
  result text DEFAULT 'success' CHECK (result IN ('success','blocked','partial')),
  controls_encountered jsonb DEFAULT '[]',
  description text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE simulation_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ss_select" ON simulation_steps;
CREATE POLICY "ss_select" ON simulation_steps FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ss_insert" ON simulation_steps;
CREATE POLICY "ss_insert" ON simulation_steps FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ss_delete" ON simulation_steps;
CREATE POLICY "ss_delete" ON simulation_steps FOR DELETE TO authenticated USING (true);

-- ============ RISK ASSESSMENTS ============
CREATE TABLE IF NOT EXISTS risk_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES assets(id) ON DELETE CASCADE,
  scope text DEFAULT 'asset' CHECK (scope IN ('asset','organization')),
  risk_score numeric DEFAULT 0,
  risk_level text DEFAULT 'informational' CHECK (risk_level IN ('informational','low','medium','high','critical')),
  attack_probability numeric DEFAULT 0,
  confidence numeric DEFAULT 0,
  contributing_factors jsonb DEFAULT '[]',
  recommended_actions jsonb DEFAULT '[]',
  predicted_target text,
  predicted_technique text,
  model_version text DEFAULT 'rule-based-v1',
  is_simulated boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE risk_assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "risk_select" ON risk_assessments;
CREATE POLICY "risk_select" ON risk_assessments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "risk_insert" ON risk_assessments;
CREATE POLICY "risk_insert" ON risk_assessments FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "risk_update" ON risk_assessments;
CREATE POLICY "risk_update" ON risk_assessments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "risk_delete" ON risk_assessments;
CREATE POLICY "risk_delete" ON risk_assessments FOR DELETE TO authenticated USING (true);

-- ============ RECOMMENDATIONS ============
CREATE TABLE IF NOT EXISTS recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  priority text DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  reason text,
  affected_asset text,
  asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  related_alert_id uuid REFERENCES alerts(id) ON DELETE SET NULL,
  related_vulnerability_id uuid REFERENCES vulnerabilities(id) ON DELETE SET NULL,
  expected_risk_reduction numeric DEFAULT 0,
  implementation_effort text DEFAULT 'medium' CHECK (implementation_effort IN ('low','medium','high')),
  suggested_owner text,
  status text DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','dismissed')),
  due_date date,
  validation_steps text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rec_select" ON recommendations;
CREATE POLICY "rec_select" ON recommendations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "rec_insert" ON recommendations;
CREATE POLICY "rec_insert" ON recommendations FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "rec_update" ON recommendations;
CREATE POLICY "rec_update" ON recommendations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "rec_delete" ON recommendations;
CREATE POLICY "rec_delete" ON recommendations FOR DELETE TO authenticated USING (true);

-- ============ MITRE TECHNIQUES ============
CREATE TABLE IF NOT EXISTS mitre_techniques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technique_id text UNIQUE NOT NULL,
  name text NOT NULL,
  tactic text NOT NULL,
  description text,
  detection_guidance text,
  mitigation_guidance text,
  is_subtechnique boolean DEFAULT false,
  parent_technique text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE mitre_techniques ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mitre_select" ON mitre_techniques;
CREATE POLICY "mitre_select" ON mitre_techniques FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "mitre_insert" ON mitre_techniques;
CREATE POLICY "mitre_insert" ON mitre_techniques FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "mitre_update" ON mitre_techniques;
CREATE POLICY "mitre_update" ON mitre_techniques FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============ ATTACK PATHS ============
CREATE TABLE IF NOT EXISTS attack_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  start_asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  target_asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  path_nodes jsonb NOT NULL DEFAULT '[]',
  path_edges jsonb DEFAULT '[]',
  required_conditions jsonb DEFAULT '[]',
  related_vulnerabilities jsonb DEFAULT '[]',
  mitre_techniques jsonb DEFAULT '[]',
  path_length int DEFAULT 0,
  likelihood numeric DEFAULT 0,
  estimated_impact text,
  path_risk numeric DEFAULT 0,
  recommended_control text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE attack_paths ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ap_select" ON attack_paths;
CREATE POLICY "ap_select" ON attack_paths FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ap_insert" ON attack_paths;
CREATE POLICY "ap_insert" ON attack_paths FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ap_delete" ON attack_paths;
CREATE POLICY "ap_delete" ON attack_paths FOR DELETE TO authenticated USING (true);

-- ============ AUDIT LOGS ============
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  action text NOT NULL,
  resource_type text,
  resource_id text,
  details jsonb DEFAULT '{}',
  ip_address text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_select" ON audit_logs;
CREATE POLICY "audit_select" ON audit_logs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "audit_insert" ON audit_logs;
CREATE POLICY "audit_insert" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ============ REPORTS ============
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  report_type text NOT NULL CHECK (report_type IN ('executive_risk','asset_inventory','vulnerability','attack_path','simulation','log_analysis','alert_summary','incident','mitre_coverage','recommendations','model_performance')),
  format text DEFAULT 'pdf' CHECK (format IN ('pdf','csv')),
  parameters jsonb DEFAULT '{}',
  status text DEFAULT 'generated',
  file_url text,
  created_by text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rep_select" ON reports;
CREATE POLICY "rep_select" ON reports FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "rep_insert" ON reports;
CREATE POLICY "rep_insert" ON reports FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "rep_delete" ON reports;
CREATE POLICY "rep_delete" ON reports FOR DELETE TO authenticated USING (true);

-- ============ APPLICATION SETTINGS ============
CREATE TABLE IF NOT EXISTS application_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, key)
);
ALTER TABLE application_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "set_select" ON application_settings;
CREATE POLICY "set_select" ON application_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "set_insert" ON application_settings;
CREATE POLICY "set_insert" ON application_settings FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "set_update" ON application_settings;
CREATE POLICY "set_update" ON application_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "set_delete" ON application_settings;
CREATE POLICY "set_delete" ON application_settings FOR DELETE TO authenticated USING (true);

-- ============ updated_at trigger ============
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated ON profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_org_updated ON organizations;
CREATE TRIGGER trg_org_updated BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_asset_updated ON assets;
CREATE TRIGGER trg_asset_updated BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_alert_updated ON alerts;
CREATE TRIGGER trg_alert_updated BEFORE UPDATE ON alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_inc_updated ON incidents;
CREATE TRIGGER trg_inc_updated BEFORE UPDATE ON incidents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_rule_updated ON detection_rules;
CREATE TRIGGER trg_rule_updated BEFORE UPDATE ON detection_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_rec_updated ON recommendations;
CREATE TRIGGER trg_rec_updated BEFORE UPDATE ON recommendations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 'analyst')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
