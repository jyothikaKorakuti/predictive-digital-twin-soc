import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useOrg } from '../context/OrgContext';
import type {
  Organization, Asset, Vulnerability, Event, Alert, Incident,
  DetectionRule, RiskAssessment, Recommendation, MitreTechnique,
  AttackPath, Simulation, LogSource, AuditLog, Profile, AssetConnection,
  AssetVulnerability, CollectorAgent,
} from '../types';

function useOrgId() {
  const { currentOrg } = useOrg();
  return currentOrg?.id ?? null;
}

function simulatedFilter() {
  const { dataFilter } = useOrg();
  if (dataFilter === 'live') return false;
  if (dataFilter === 'simulated') return true;
  return undefined;
}

export function useOrganizations() {
  return useQuery<Organization[]>({
    queryKey: ['organizations'],
    queryFn: async () => {
      const { data, error } = await supabase.from('organizations').select('*').order('created_at');
      if (error) throw error;
      return data as Organization[];
    },
  });
}

export function useAssets() {
  const orgId = useOrgId();
  const sim = simulatedFilter();
  return useQuery<Asset[]>({
    queryKey: ['assets', orgId, sim],
    queryFn: async () => {
      let q = supabase.from('assets').select('*').eq('org_id', orgId).order('created_at');
      if (sim !== undefined) q = q.eq('is_simulated', sim);
      const { data, error } = await q;
      if (error) throw error;
      return data as Asset[];
    },
    enabled: !!orgId,
  });
}

export function useAssetConnections() {
  const orgId = useOrgId();
  return useQuery<AssetConnection[]>({
    queryKey: ['asset-connections', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from('asset_connections').select('*').eq('org_id', orgId);
      if (error) throw error;
      return data as AssetConnection[];
    },
    enabled: !!orgId,
  });
}

export function useVulnerabilities() {
  const orgId = useOrgId();
  const sim = simulatedFilter();
  return useQuery<Vulnerability[]>({
    queryKey: ['vulnerabilities', orgId, sim],
    queryFn: async () => {
      let q = supabase.from('vulnerabilities').select('*').eq('org_id', orgId).order('cvss_score', { ascending: false });
      if (sim !== undefined) q = q.eq('is_simulated', sim);
      const { data, error } = await q;
      if (error) throw error;
      return data as Vulnerability[];
    },
    enabled: !!orgId,
  });
}

export function useAssetVulnerabilities() {
  const orgId = useOrgId();
  return useQuery<AssetVulnerability[]>({
    queryKey: ['asset-vulnerabilities', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from('asset_vulnerabilities').select('*').eq('org_id', orgId);
      if (error) throw error;
      return data as AssetVulnerability[];
    },
    enabled: !!orgId,
  });
}

export function useEvents(limit = 100) {
  const orgId = useOrgId();
  const sim = simulatedFilter();
  return useQuery<Event[]>({
    queryKey: ['events', orgId, sim, limit],
    queryFn: async () => {
      let q = supabase.from('events').select('*').eq('org_id', orgId).order('event_timestamp', { ascending: false }).limit(limit);
      if (sim !== undefined) q = q.eq('is_simulated', sim);
      const { data, error } = await q;
      if (error) throw error;
      return data as Event[];
    },
    enabled: !!orgId,
  });
}

export function useAlerts() {
  const orgId = useOrgId();
  const sim = simulatedFilter();
  return useQuery<Alert[]>({
    queryKey: ['alerts', orgId, sim],
    queryFn: async () => {
      let q = supabase.from('alerts').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
      if (sim !== undefined) q = q.eq('is_simulated', sim);
      const { data, error } = await q;
      if (error) throw error;
      return data as Alert[];
    },
    enabled: !!orgId,
  });
}

export function useIncidents() {
  const orgId = useOrgId();
  const sim = simulatedFilter();
  return useQuery<Incident[]>({
    queryKey: ['incidents', orgId, sim],
    queryFn: async () => {
      let q = supabase.from('incidents').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
      if (sim !== undefined) q = q.eq('is_simulated', sim);
      const { data, error } = await q;
      if (error) throw error;
      return data as Incident[];
    },
    enabled: !!orgId,
  });
}

export function useDetectionRules() {
  const orgId = useOrgId();
  return useQuery<DetectionRule[]>({
    queryKey: ['detection-rules', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from('detection_rules').select('*').eq('org_id', orgId).order('created_at');
      if (error) throw error;
      return data as DetectionRule[];
    },
    enabled: !!orgId,
  });
}

export function useRiskAssessments() {
  const orgId = useOrgId();
  return useQuery<RiskAssessment[]>({
    queryKey: ['risk-assessments', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from('risk_assessments').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
      if (error) throw error;
      return data as RiskAssessment[];
    },
    enabled: !!orgId,
  });
}

export function useRecommendations() {
  const orgId = useOrgId();
  return useQuery<Recommendation[]>({
    queryKey: ['recommendations', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from('recommendations').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
      if (error) throw error;
      return data as Recommendation[];
    },
    enabled: !!orgId,
  });
}

export function useMitreTechniques() {
  return useQuery<MitreTechnique[]>({
    queryKey: ['mitre-techniques'],
    queryFn: async () => {
      const { data, error } = await supabase.from('mitre_techniques').select('*').order('tactic');
      if (error) throw error;
      return data as MitreTechnique[];
    },
  });
}

export function useAttackPaths() {
  const orgId = useOrgId();
  return useQuery<AttackPath[]>({
    queryKey: ['attack-paths', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from('attack_paths').select('*').eq('org_id', orgId).order('path_risk', { ascending: false });
      if (error) throw error;
      return data as AttackPath[];
    },
    enabled: !!orgId,
  });
}

export function useSimulations() {
  const orgId = useOrgId();
  return useQuery<Simulation[]>({
    queryKey: ['simulations', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from('simulations').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
      if (error) throw error;
      return data as Simulation[];
    },
    enabled: !!orgId,
  });
}

export function useLogSources() {
  const orgId = useOrgId();
  return useQuery<LogSource[]>({
    queryKey: ['log-sources', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from('log_sources').select('*').eq('org_id', orgId).order('created_at');
      if (error) throw error;
      return data as LogSource[];
    },
    enabled: !!orgId,
  });
}

export function useAuditLogs(limit = 100) {
  return useQuery<AuditLog[]>({
    queryKey: ['audit-logs', limit],
    queryFn: async () => {
      const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(limit);
      if (error) throw error;
      return data as AuditLog[];
    },
  });
}

export function useProfiles() {
  return useQuery<Profile[]>({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at');
      if (error) throw error;
      return data as Profile[];
    },
  });
}

export function useReports() {
  const orgId = useOrgId();
  return useQuery({
    queryKey: ['reports', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from('reports').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });
}

export function useCollectorAgents() {
  const orgId = useOrgId();
  return useQuery<CollectorAgent[]>({
    queryKey: ['collector-agents', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collector_agents')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as CollectorAgent[];
    },
    enabled: !!orgId,
  });
}
