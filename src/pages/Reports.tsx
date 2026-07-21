import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FileText, Download, Plus, FileBarChart } from 'lucide-react';
import { useReports, useAssets, useVulnerabilities, useAlerts, useIncidents, useRiskAssessments, useRecommendations, useAttackPaths } from '../hooks/useData';
import { useOrg } from '../context/OrgContext';
import { supabase } from '../lib/supabase';
import { Card, Badge, Button, Select, Modal, EmptyState, LoadingState, ErrorState } from '../components/ui';
import { formatTimestamp, downloadText } from '../lib/utils';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

const REPORT_TYPES = [
  { value: 'executive_risk', label: 'Executive Risk Summary' },
  { value: 'asset_inventory', label: 'Asset Inventory' },
  { value: 'vulnerability', label: 'Vulnerability Assessment' },
  { value: 'attack_path', label: 'Attack Path Analysis' },
  { value: 'alert_summary', label: 'Alert Summary' },
  { value: 'incident', label: 'Incident Report' },
  { value: 'mitre_coverage', label: 'MITRE Coverage' },
  { value: 'recommendations', label: 'Security Recommendations' },
];

export function Reports() {
  const { currentOrg } = useOrg();
  const reportsQ = useReports();
  const assetsQ = useAssets();
  const vulnsQ = useVulnerabilities();
  const alertsQ = useAlerts();
  const incidentsQ = useIncidents();
  const riskQ = useRiskAssessments();
  const recsQ = useRecommendations();
  const pathsQ = useAttackPaths();
  const { toast } = useToast();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [showGen, setShowGen] = useState(false);
  const [type, setType] = useState('executive_risk');
  const [format, setFormat] = useState('csv');
  const [generating, setGenerating] = useState(false);

  async function generate() {
    if (!currentOrg) return;
    setGenerating(true);

    const assets = assetsQ.data ?? [];
    const vulns = vulnsQ.data ?? [];
    const alerts = alertsQ.data ?? [];
    const incidents = incidentsQ.data ?? [];
    const risks = riskQ.data ?? [];
    const recs = recsQ.data ?? [];
    const paths = pathsQ.data ?? [];
    const orgRisk = risks.find((r) => r.scope === 'organization');

    let content = '';
    let filename = '';
    let mime = 'text/plain';

    if (format === 'csv') {
      switch (type) {
        case 'asset_inventory':
          content = ['hostname,ip_address,asset_type,os,criticality,status,internet_exposed,patch_status',
            ...assets.map((a) => `${a.hostname},${a.ip_address ?? ''},${a.asset_type},${a.os_name ?? ''} ${a.os_version ?? ''},${a.criticality},${a.status},${a.internet_exposed},${a.patch_status}`)].join('\n');
          break;
        case 'vulnerability':
          content = ['cve_id,title,cvss_score,severity,status,exploit_available,patch_available',
            ...vulns.map((v) => `${v.cve_id ?? ''},${v.title},${v.cvss_score},${v.cvss_severity},${v.status},${v.exploit_available},${v.patch_available}`)].join('\n');
          break;
        case 'alert_summary':
          content = ['title,severity,status,affected_asset,src_ip,created_at',
            ...alerts.map((a) => `"${a.title}",${a.severity},${a.status},${a.affected_asset ?? ''},${a.src_ip ?? ''},${a.created_at}`)].join('\n');
          break;
        case 'recommendations':
          content = ['title,priority,status,affected_asset,reason,expected_risk_reduction',
            ...recs.map((r) => `"${r.title}",${r.priority},${r.status},${r.affected_asset ?? ''},"${r.reason ?? ''}",${r.expected_risk_reduction}`)].join('\n');
          break;
        case 'attack_path':
          content = ['start,target,risk,likelihood,impact,techniques',
            ...paths.map((p) => {
              const nodes = p.path_nodes as { id: string }[];
              return `${nodes[0]?.id ?? ''},${nodes[nodes.length - 1]?.id ?? ''},${p.path_risk},${(p.likelihood * 100).toFixed(0)}%,"${p.estimated_impact ?? ''}",${p.mitre_techniques.join(';')}`;
            })].join('\n');
          break;
        default:
          content = ['metric,value', `Total Assets,${assets.length}`, `Open Vulnerabilities,${vulns.filter((v) => v.status === 'open').length}`, `Critical Vulnerabilities,${vulns.filter((v) => v.cvss_severity === 'critical' && v.status === 'open').length}`, `Active Alerts,${alerts.filter((a) => !['resolved', 'false_positive'].includes(a.status)).length}`, `Open Incidents,${incidents.filter((i) => !['closed', 'recovered'].includes(i.status)).length}`, `Attack Paths,${paths.length}`, `Org Risk Score,${orgRisk?.risk_score ?? 'N/A'}`, `Org Risk Level,${orgRisk?.risk_level ?? 'N/A'}`, `Recommendations,${recs.length}`].join('\n');
      }
      filename = `${type}-${Date.now()}.csv`;
      mime = 'text/csv';
    } else {
      // Generate a text-based PDF-like report
      content = `PREDICTIVE DIGITAL TWIN SOC - SECURITY REPORT\n\nOrganization: ${currentOrg.name}\nReport Type: ${REPORT_TYPES.find((t) => t.value === type)?.label}\nGenerated: ${new Date().toISOString()}\n\n=== EXECUTIVE SUMMARY ===\nOrganization Risk Score: ${orgRisk?.risk_score ?? 'N/A'} (${orgRisk?.risk_level ?? 'N/A'})\nTotal Assets: ${assets.length}\nOpen Vulnerabilities: ${vulns.filter((v) => v.status === 'open').length}\nCritical Vulnerabilities: ${vulns.filter((v) => v.cvss_severity === 'critical' && v.status === 'open').length}\nActive Alerts: ${alerts.filter((a) => !['resolved', 'false_positive'].includes(a.status)).length}\nOpen Incidents: ${incidents.filter((i) => !['closed', 'recovered'].includes(i.status)).length}\nAttack Paths: ${paths.length}\nRecommendations: ${recs.length}\n\n=== CRITICAL ASSETS ===\n${assets.filter((a) => a.criticality === 'critical').map((a) => `- ${a.hostname} (${a.ip_address ?? 'N/A'}) - ${a.asset_type}`).join('\n')}\n\n=== CRITICAL VULNERABILITIES ===\n${vulns.filter((v) => v.cvss_severity === 'critical' && v.status === 'open').map((v) => `- ${v.cve_id ?? v.title} (CVSS: ${v.cvss_score})`).join('\n')}\n\n=== MAJOR ALERTS ===\n${alerts.filter((a) => a.severity === 'critical').map((a) => `- ${a.title} [${a.status}]`).join('\n')}\n\n=== ATTACK PATHS ===\n${paths.slice(0, 5).map((p) => {
  const nodes = p.path_nodes as { id: string }[];
  return `- ${nodes.map((n) => n.id).join(' -> ')} (Risk: ${p.path_risk}, Likelihood: ${(p.likelihood * 100).toFixed(0)}%)`;
}).join('\n')}\n\n=== RECOMMENDATIONS ===\n${recs.slice(0, 10).map((r) => `- [${r.priority}] ${r.title}`).join('\n')}\n\n=== LIMITATIONS ===\nThis report is generated from stored findings. Risk scores use a transparent weighted model (rule-based-v1). No ML model has been trained. Simulated data is clearly labeled.\n\nGenerated by: ${profile?.email ?? 'unknown'}\n`;
      filename = `${type}-${Date.now()}.txt`;
      mime = 'text/plain';
    }

    // Store report metadata
    const { error } = await supabase.from('reports').insert({
      org_id: currentOrg.id,
      title: `${REPORT_TYPES.find((t) => t.value === type)?.label} - ${new Date().toLocaleDateString()}`,
      report_type: type,
      format,
      parameters: {},
      status: 'generated',
      created_by: profile?.email ?? null,
    });

    // Download the file
    downloadText(filename, content, mime);

    setGenerating(false);
    setShowGen(false);
    if (error) toast(`Report saved but metadata error: ${error.message}`, 'warning');
    else toast('Report generated and downloaded', 'success');
    qc.invalidateQueries({ queryKey: ['reports'] });
  }

  if (!currentOrg) return <EmptyState icon={<FileText className="w-8 h-8" />} title="No organization selected" />;
  if (reportsQ.isLoading) return <LoadingState />;
  if (reportsQ.error) return <ErrorState message={reportsQ.error.message} onRetry={() => reportsQ.refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Reports</h1>
          <p className="text-xs text-slate-500">{(reportsQ.data ?? []).length} reports - {currentOrg.name}</p>
        </div>
        <Button size="sm" variant="primary" onClick={() => setShowGen(true)}><Plus className="w-3.5 h-3.5" /> Generate Report</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {REPORT_TYPES.map((rt) => (
          <Card key={rt.value} className="p-3 cursor-pointer hover:border-slate-700" >
            <div onClick={() => { setType(rt.value); setShowGen(true); }}>
              <FileBarChart className="w-5 h-5 text-cyan-400 mb-2" />
              <p className="text-xs font-medium text-slate-200">{rt.label}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="px-4 py-2 border-b border-slate-800"><p className="text-xs text-slate-400">Generated Reports</p></div>
        {(reportsQ.data ?? []).length === 0 ? <EmptyState icon={<FileText className="w-6 h-6" />} title="No reports generated" /> : (
          <div className="divide-y divide-slate-800">
            {(reportsQ.data ?? []).map((r) => (
              <div key={r.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-200">{r.title}</p>
                  <p className="text-[10px] text-slate-500">{formatTimestamp(r.created_at)} - {r.format.toUpperCase()} - by {r.created_by ?? 'N/A'}</p>
                </div>
                <Badge className="text-green-400 bg-green-500/10 border-green-500/20">{r.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={showGen} onClose={() => setShowGen(false)} title="Generate Report" size="md">
        <div className="space-y-3">
          <Select label="Report Type" value={type} onChange={setType} options={REPORT_TYPES} />
          <Select label="Format" value={format} onChange={setFormat} options={[{value:'csv',label:'CSV'},{value:'pdf',label:'PDF (Text)'}]} />
          <Button variant="primary" onClick={generate} loading={generating}><Download className="w-3.5 h-3.5" /> Generate & Download</Button>
        </div>
      </Modal>
    </div>
  );
}
