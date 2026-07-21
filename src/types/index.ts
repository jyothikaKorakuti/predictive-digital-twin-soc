export type UserRole = 'admin' | 'analyst' | 'auditor';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  industry: string | null;
  location: string | null;
  employee_count: number | null;
  risk_appetite: string;
  critical_services: string | null;
  network_ranges: string | null;
  description: string | null;
  is_simulated: boolean;
  created_at: string;
  updated_at: string;
}

export type AssetType =
  | 'workstation' | 'laptop' | 'server' | 'domain_controller'
  | 'database' | 'web_server' | 'firewall' | 'router' | 'switch'
  | 'cloud' | 'application' | 'mobile' | 'iot' | 'other';

export type Criticality = 'low' | 'medium' | 'high' | 'critical';

export interface Asset {
  id: string;
  org_id: string;
  hostname: string;
  ip_address: string | null;
  mac_address: string | null;
  asset_type: AssetType;
  os_name: string | null;
  os_version: string | null;
  open_ports: number[];
  services: string[];
  internet_exposed: boolean;
  network_segment: string | null;
  business_owner: string | null;
  technical_owner: string | null;
  criticality: Criticality;
  patch_status: string;
  last_seen: string | null;
  source: string;
  data_confidence: string;
  status: string;
  tags: string[];
  is_simulated: boolean;
  created_at: string;
  updated_at: string;
}

export interface AssetConnection {
  id: string;
  org_id: string;
  source_asset_id: string;
  target_asset_id: string;
  relationship: string;
  port: number | null;
  protocol: string | null;
  bidirectional: boolean;
  created_at: string;
}

export interface Vulnerability {
  id: string;
  org_id: string;
  cve_id: string | null;
  title: string;
  description: string | null;
  cvss_score: number;
  cvss_severity: string;
  epss_score: number;
  exploit_available: boolean;
  patch_available: boolean;
  remediation: string | null;
  status: string;
  first_seen: string;
  last_seen: string;
  is_simulated: boolean;
  created_at: string;
}

export interface AssetVulnerability {
  id: string;
  asset_id: string;
  vulnerability_id: string;
  org_id: string;
  affected_service: string | null;
  evidence: string | null;
  assigned_analyst: string | null;
  due_date: string | null;
  status: string;
  created_at: string;
}

export interface LogSource {
  id: string;
  org_id: string;
  name: string;
  source_type: string;
  hostname: string | null;
  config: Record<string, unknown>;
  enabled: boolean;
  is_simulated: boolean;
  created_at: string;
}

export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface Event {
  id: string;
  org_id: string;
  event_timestamp: string;
  ingestion_timestamp: string | null;
  source_id: string | null;
  source_name: string | null;
  source_type: string | null;
  hostname: string | null;
  src_ip: string | null;
  dst_ip: string | null;
  src_port: number | null;
  dst_port: number | null;
  username: string | null;
  event_category: string | null;
  event_action: string | null;
  process_name: string | null;
  process_id: number | null;
  parent_process: string | null;
  command_line: string | null;
  file_path: string | null;
  message: string | null;
  severity: Severity;
  raw_log: string | null;
  parser_name: string | null;
  detection_rule_id: string | null;
  mitre_tactic: string | null;
  mitre_technique: string | null;
  confidence: number;
  is_simulated: boolean;
  correlation_id: string | null;
  asset_id: string | null;
  record_id: number | null;
  event_id: number | null;
  provider: string | null;
  channel: string | null;
  log_level: number | null;
}

export interface CollectorAgent {
  id: string;
  org_id: string;
  name: string;
  hostname: string | null;
  agent_type: string;
  api_key_hash: string;
  api_key_prefix: string;
  status: string;
  last_seen_at: string | null;
  events_ingested: number;
  version: string | null;
  created_at: string;
}

export interface DetectionRule {
  id: string;
  org_id: string | null;
  name: string;
  description: string | null;
  severity: Severity;
  rule_type: string;
  conditions: Record<string, unknown>;
  threshold: number;
  time_window: number;
  mitre_tactic: string | null;
  mitre_technique: string | null;
  enabled: boolean;
  match_count: number;
  error_count: number;
  is_simulated: boolean;
  created_at: string;
  updated_at: string;
}

export type AlertStatus = 'new' | 'investigating' | 'contained' | 'resolved' | 'false_positive';

export interface Alert {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  severity: Severity;
  status: AlertStatus;
  source: string | null;
  rule_id: string | null;
  event_ids: string[];
  asset_id: string | null;
  affected_asset: string | null;
  username: string | null;
  src_ip: string | null;
  mitre_tactic: string | null;
  mitre_technique: string | null;
  confidence: number;
  evidence: Record<string, unknown>[];
  assigned_to: string | null;
  comments: Record<string, unknown>[];
  false_positive_notes: string | null;
  correlation_id: string | null;
  is_simulated: boolean;
  created_at: string;
  updated_at: string;
}

export type IncidentStatus = 'open' | 'triaged' | 'investigating' | 'contained' | 'eradicated' | 'recovered' | 'closed';

export interface Incident {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  severity: Severity;
  status: IncidentStatus;
  owner: string | null;
  related_assets: string[];
  related_users: string[];
  iocs: string[];
  mitre_mapping: Record<string, string>[];
  timeline: Record<string, string>[];
  notes: Record<string, unknown>[];
  containment_actions: string | null;
  eradication_actions: string | null;
  recovery_actions: string | null;
  lessons_learned: string | null;
  is_simulated: boolean;
  created_at: string;
  updated_at: string;
}

export interface Simulation {
  id: string;
  org_id: string;
  scenario_name: string;
  entry_point: string | null;
  initial_asset_id: string | null;
  target_asset_id: string | null;
  assumptions: string[];
  mitre_techniques: string[];
  status: string;
  successful_steps: number;
  blocked_steps: number;
  estimated_impact: string | null;
  recommended_mitigations: string[];
  business_impact: string | null;
  probability: number;
  started_by: string | null;
  is_simulated: boolean;
  created_at: string;
}

export interface SimulationStep {
  id: string;
  simulation_id: string;
  step_number: number;
  asset_id: string | null;
  asset_name: string | null;
  action: string;
  mitre_technique: string | null;
  probability: number;
  result: string;
  controls_encountered: string[];
  description: string | null;
  created_at: string;
}

export interface RiskAssessment {
  id: string;
  org_id: string;
  asset_id: string | null;
  scope: string;
  risk_score: number;
  risk_level: string;
  attack_probability: number;
  confidence: number;
  contributing_factors: Record<string, unknown>[];
  recommended_actions: string[];
  predicted_target: string | null;
  predicted_technique: string | null;
  model_version: string;
  is_simulated: boolean;
  created_at: string;
}

export interface Recommendation {
  id: string;
  org_id: string;
  title: string;
  priority: string;
  reason: string | null;
  affected_asset: string | null;
  asset_id: string | null;
  related_alert_id: string | null;
  related_vulnerability_id: string | null;
  expected_risk_reduction: number;
  implementation_effort: string;
  suggested_owner: string | null;
  status: string;
  due_date: string | null;
  validation_steps: string | null;
  is_simulated: boolean;
  created_at: string;
  updated_at: string;
}

export interface MitreTechnique {
  id: string;
  technique_id: string;
  name: string;
  tactic: string;
  description: string | null;
  detection_guidance: string | null;
  mitigation_guidance: string | null;
  is_subtechnique: boolean;
  parent_technique: string | null;
  created_at: string;
}

export interface AttackPath {
  id: string;
  org_id: string;
  start_asset_id: string | null;
  target_asset_id: string | null;
  path_nodes: Record<string, unknown>[];
  path_edges: Record<string, unknown>[];
  required_conditions: string[];
  related_vulnerabilities: string[];
  mitre_techniques: string[];
  path_length: number;
  likelihood: number;
  estimated_impact: string | null;
  path_risk: number;
  recommended_control: string | null;
  is_simulated: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  org_id: string | null;
  user_id: string | null;
  user_email: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

export interface Report {
  id: string;
  org_id: string;
  title: string;
  report_type: string;
  format: string;
  parameters: Record<string, unknown>;
  status: string;
  file_url: string | null;
  created_by: string | null;
  created_at: string;
}
