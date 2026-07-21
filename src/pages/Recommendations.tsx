import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Lightbulb, Download, CheckCircle, X, RefreshCw, Zap } from 'lucide-react';
import { useRecommendations, useAssets, useVulnerabilities, useAlerts } from '../hooks/useData';
import { useOrg } from '../context/OrgContext';
import { supabase } from '../lib/supabase';
import { Card, Badge, Button, EmptyState, LoadingState, ErrorState, StatCard } from '../components/ui';
import { severityColor, statusColor, exportCsv } from '../lib/utils';
import { useToast } from '../context/ToastContext';
import type { Recommendation } from '../types';

export function Recommendations() {
  const { currentOrg } = useOrg();
  const recsQ = useRecommendations();
  const assetsQ = useAssets();
  const vulnsQ = useVulnerabilities();
  const alertsQ = useAlerts();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [generating, setGenerating] = useState(false);

  async function generate() {
    if (!currentOrg) return;
    setGenerating(true);
    const assets = assetsQ.data ?? [];
    const vulns = vulnsQ.data ?? [];
    const alerts = alertsQ.data ?? [];

    const recs: object[] = [];

    // Generate from critical vulnerabilities
    for (const v of vulns.filter((v) => v.status === 'open' && v.cvss_severity === 'critical')) {
      recs.push({
        org_id: currentOrg.id, title: `Patch ${v.cve_id ?? v.title}`, priority: 'critical',
        reason: `${v.cve_id ?? v.title} has CVSS ${v.cvss_score} and ${v.exploit_available ? 'exploit is available' : 'no known exploit'}.`,
        affected_asset: 'Multiple assets', asset_id: null,
        expected_risk_reduction: 25, implementation_effort: 'low', suggested_owner: 'IT Security',
        status: 'open', validation_steps: `Verify ${v.cve_id ?? 'vulnerability'} is patched via scan.`,
        is_simulated: v.is_simulated,
      });
    }

    // Generate from exposed assets
    for (const a of assets.filter((a) => a.internet_exposed)) {
      recs.push({
        org_id: currentOrg.id, title: `Restrict internet exposure on ${a.hostname}`, priority: 'high',
        reason: `${a.hostname} is exposed to the internet with ${a.open_ports.length} open ports.`,
        affected_asset: a.hostname, asset_id: a.id,
        expected_risk_reduction: 20, implementation_effort: 'medium', suggested_owner: 'Network Team',
        status: 'open', validation_steps: `Verify ${a.hostname} is not reachable from external networks.`,
        is_simulated: a.is_simulated,
      });
    }

    // Generate from active alerts
    for (const alert of alerts.filter((a) => a.severity === 'critical' && !['resolved', 'false_positive'].includes(a.status))) {
      recs.push({
        org_id: currentOrg.id, title: `Investigate: ${alert.title}`, priority: 'critical',
        reason: `Critical alert requires investigation: ${alert.description ?? ''}`,
        affected_asset: alert.affected_asset ?? 'N/A', asset_id: alert.asset_id,
        related_alert_id: alert.id, expected_risk_reduction: 15, implementation_effort: 'medium',
        suggested_owner: 'SOC Team', status: 'open', validation_steps: 'Review alert evidence and contain threat.',
        is_simulated: alert.is_simulated,
      });
    }

    // Generate from patch status
    for (const a of assets.filter((a) => a.patch_status === 'pending')) {
      recs.push({
        org_id: currentOrg.id, title: `Apply pending patches on ${a.hostname}`, priority: 'high',
        reason: `${a.hostname} has pending patches and ${a.criticality} criticality.`,
        affected_asset: a.hostname, asset_id: a.id,
        expected_risk_reduction: 15, implementation_effort: 'low', suggested_owner: 'IT Operations',
        status: 'open', validation_steps: `Verify patch level on ${a.hostname}.`,
        is_simulated: a.is_simulated,
      });
    }

    // Clear and insert
    await supabase.from('recommendations').delete().eq('org_id', currentOrg.id);
    if (recs.length > 0) {
      const { error } = await supabase.from('recommendations').insert(recs);
      if (error) { toast(`Failed: ${error.message}`, 'error'); setGenerating(false); return; }
    }
    setGenerating(false);
    toast(`Generated ${recs.length} recommendations`, 'success');
    qc.invalidateQueries({ queryKey: ['recommendations'] });
  }

  async function updateStatus(r: Recommendation, status: string) {
    const { error } = await supabase.from('recommendations').update({ status }).eq('id', r.id);
    if (error) toast(`Failed: ${error.message}`, 'error');
    else { toast('Status updated', 'success'); qc.invalidateQueries({ queryKey: ['recommendations'] }); }
  }

  const sorted = useMemo(() => (recsQ.data ?? []).slice().sort((a, b) => {
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return (order[a.priority] ?? 4) - (order[b.priority] ?? 4);
  }), [recsQ.data]);

  if (!currentOrg) return <EmptyState icon={<Lightbulb className="w-8 h-8" />} title="No organization selected" />;
  if (recsQ.isLoading) return <LoadingState />;
  if (recsQ.error) return <ErrorState message={recsQ.error.message} onRetry={() => recsQ.refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Recommendations</h1>
          <p className="text-xs text-slate-500">{(recsQ.data ?? []).length} recommendations - {currentOrg.name}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => exportCsv('recommendations.csv', (recsQ.data ?? []) as unknown as Record<string, unknown>[])}><Download className="w-3.5 h-3.5" /> Export</Button>
          <Button size="sm" variant="primary" onClick={generate} loading={generating}><RefreshCw className="w-3.5 h-3.5" /> Generate Recommendations</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Critical" value={sorted.filter((r) => r.priority === 'critical').length} icon={<Zap className="w-5 h-5 text-red-400" />} color="text-red-400" />
        <StatCard label="High" value={sorted.filter((r) => r.priority === 'high').length} icon={<Zap className="w-5 h-5 text-orange-400" />} color="text-orange-400" />
        <StatCard label="Medium" value={sorted.filter((r) => r.priority === 'medium').length} icon={<Lightbulb className="w-5 h-5 text-yellow-400" />} color="text-yellow-400" />
        <StatCard label="Completed" value={sorted.filter((r) => r.status === 'completed').length} icon={<CheckCircle className="w-5 h-5 text-green-400" />} color="text-green-400" />
      </div>

      <div className="space-y-2">
        {sorted.length === 0 ? (
          <EmptyState icon={<Lightbulb className="w-6 h-6" />} title="No recommendations" description="Generate recommendations from stored findings." action={<Button size="sm" variant="primary" onClick={generate} loading={generating}><RefreshCw className="w-3.5 h-3.5" /> Generate</Button>} />
        ) : (
          sorted.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={severityColor(r.priority === 'critical' ? 'critical' : r.priority === 'high' ? 'high' : 'medium')}>{r.priority}</Badge>
                    <Badge className={statusColor(r.status)}>{r.status}</Badge>
                    {r.is_simulated && <Badge className="text-amber-400 bg-amber-500/10 border-amber-500/20">SIM</Badge>}
                  </div>
                  <p className="text-sm font-medium text-slate-100">{r.title}</p>
                  <p className="text-xs text-slate-500 mt-1">{r.reason}</p>
                  <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-500">
                    <span>Asset: {r.affected_asset ?? 'N/A'}</span>
                    <span>Risk reduction: {r.expected_risk_reduction}%</span>
                    <span>Effort: {r.implementation_effort}</span>
                    <span>Owner: {r.suggested_owner ?? 'Unassigned'}</span>
                    <span>Due: {r.due_date ?? 'N/A'}</span>
                  </div>
                  {r.validation_steps && <p className="text-[10px] text-slate-600 mt-1">Validation: {r.validation_steps}</p>}
                </div>
                <div className="flex gap-1 ml-2">
                  {r.status !== 'completed' && <button onClick={() => updateStatus(r, 'completed')} className="text-slate-400 hover:text-green-400" title="Mark completed"><CheckCircle className="w-4 h-4" /></button>}
                  {r.status !== 'dismissed' && <button onClick={() => updateStatus(r, 'dismissed')} className="text-slate-400 hover:text-red-400" title="Dismiss"><X className="w-4 h-4" /></button>}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
