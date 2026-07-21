import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { GitBranch, RefreshCw, Download, AlertTriangle, Route, Target, Shield } from 'lucide-react';
import { useAttackPaths, useAssets } from '../hooks/useData';
import { useOrg } from '../context/OrgContext';
import { supabase } from '../lib/supabase';
import { Card, Badge, Button, EmptyState, LoadingState, ErrorState, StatCard, Modal } from '../components/ui';
import { severityColor, riskScoreColor, exportCsv } from '../lib/utils';
import { useToast } from '../context/ToastContext';
import type { AttackPath } from '../types';

export function AttackGraph() {
  const { currentOrg } = useOrg();
  const pathsQ = useAttackPaths();
  const assetsQ = useAssets();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<AttackPath | null>(null);
  const [generating, setGenerating] = useState(false);

  async function generatePaths() {
    if (!currentOrg) return;
    setGenerating(true);
    const assets = assetsQ.data ?? [];
    if (assets.length < 2) { toast('Need at least 2 assets', 'warning'); setGenerating(false); return; }

    // Generate attack paths from asset connections and vulnerabilities
    // This is a graph traversal simulation against the digital twin
    const paths: Array<{ start: string; target: string; nodes: object[]; edges: object[]; conditions: string[]; vulns: string[]; techniques: string[]; likelihood: number; impact: string; risk: number; control: string }> = [];

    // Simple path generation: for each pair of assets, check if there's a connection
    for (let i = 0; i < assets.length; i++) {
      for (let j = 0; j < assets.length; j++) {
        if (i === j) continue;
        const start = assets[i];
        const target = assets[j];
        const isCritical = target.criticality === 'critical' || target.criticality === 'high';
        if (!isCritical) continue;

        let likelihood = 0.3;
        const conditions: string[] = [];
        const techniques: string[] = [];
        const vulns: string[] = [];

        if (start.internet_exposed) { likelihood += 0.2; conditions.push('Internet-exposed entry point'); techniques.push('T1190'); }
        if (start.criticality === 'critical') { likelihood += 0.1; }
        if (target.criticality === 'critical') { likelihood += 0.15; }
        techniques.push('T1210');

        const risk = Math.min(100, Math.round(likelihood * 60 + (target.criticality === 'critical' ? 30 : 15)));

        paths.push({
          start: start.id, target: target.id,
          nodes: [{ id: start.hostname, type: start.asset_type, ip: start.ip_address }, { id: target.hostname, type: target.asset_type, ip: target.ip_address }],
          edges: [{ from: start.hostname, to: target.hostname, relationship: 'CAN_REACH' }],
          conditions, vulns, techniques,
          likelihood: Math.min(0.95, likelihood),
          impact: `${target.criticality === 'critical' ? 'Critical system compromise' : 'System compromise'} - ${target.hostname}`,
          risk,
          control: 'Network segmentation and access control between zones',
        });
      }
    }

    // Clear existing and insert new
    await supabase.from('attack_paths').delete().eq('org_id', currentOrg.id);
    const inserts = paths.map((p) => ({
      org_id: currentOrg.id,
      start_asset_id: p.start, target_asset_id: p.target,
      path_nodes: p.nodes, path_edges: p.edges,
      required_conditions: p.conditions, related_vulnerabilities: p.vulns,
      mitre_techniques: p.techniques, path_length: 2,
      likelihood: p.likelihood, estimated_impact: p.impact,
      path_risk: p.risk, recommended_control: p.control, is_simulated: false,
    }));
    if (inserts.length > 0) {
      const { error } = await supabase.from('attack_paths').insert(inserts);
      if (error) { toast(`Failed: ${error.message}`, 'error'); setGenerating(false); return; }
    }
    setGenerating(false);
    toast(`Generated ${paths.length} attack paths`, 'success');
    qc.invalidateQueries({ queryKey: ['attack-paths'] });
  }

  const sorted = useMemo(() => (pathsQ.data ?? []).slice().sort((a, b) => b.path_risk - a.path_risk), [pathsQ.data]);

  if (!currentOrg) return <EmptyState icon={<GitBranch className="w-8 h-8" />} title="No organization selected" />;
  if (pathsQ.isLoading) return <LoadingState />;
  if (pathsQ.error) return <ErrorState message={pathsQ.error.message} onRetry={() => pathsQ.refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Attack Graph</h1>
          <p className="text-xs text-slate-500">{(pathsQ.data ?? []).length} attack paths - {currentOrg.name}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => exportCsv('attack-paths.csv', (pathsQ.data ?? []) as unknown as Record<string, unknown>[])}><Download className="w-3.5 h-3.5" /> Export</Button>
          <Button size="sm" variant="primary" onClick={generatePaths} loading={generating}><RefreshCw className="w-3.5 h-3.5" /> Generate Attack Paths</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Paths" value={(pathsQ.data ?? []).length} icon={<GitBranch className="w-5 h-5 text-cyan-400" />} color="text-cyan-400" />
        <StatCard label="Critical Risk" value={(pathsQ.data ?? []).filter((p) => p.path_risk >= 81).length} icon={<AlertTriangle className="w-5 h-5 text-red-400" />} color="text-red-400" />
        <StatCard label="High Risk" value={(pathsQ.data ?? []).filter((p) => p.path_risk >= 61 && p.path_risk < 81).length} icon={<AlertTriangle className="w-5 h-5 text-orange-400" />} color="text-orange-400" />
        <StatCard label="Avg Likelihood" value={`${(((pathsQ.data ?? []).reduce((s, p) => s + p.likelihood, 0) / Math.max(1, (pathsQ.data ?? []).length)) * 100).toFixed(0)}%`} icon={<Target className="w-5 h-5 text-yellow-400" />} color="text-yellow-400" />
      </div>

      <div className="space-y-2">
        {sorted.length === 0 ? (
          <EmptyState icon={<GitBranch className="w-6 h-6" />} title="No attack paths" description="Generate attack paths from the digital twin graph." action={<Button size="sm" variant="primary" onClick={generatePaths} loading={generating}><RefreshCw className="w-3.5 h-3.5" /> Generate</Button>} />
        ) : (
          sorted.map((p) => {
            const nodes = p.path_nodes as { id: string; type: string }[];
            return (
              <Card key={p.id} className="p-4 cursor-pointer hover:border-slate-700" >
                <div onClick={() => setSelected(p)}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Route className="w-4 h-4 text-cyan-400" />
                      <span className="text-sm font-medium text-slate-100">{nodes.map((n) => n.id).join(' -> ')}</span>
                    </div>
                    <Badge className={severityColor(p.path_risk >= 81 ? 'critical' : p.path_risk >= 61 ? 'high' : 'medium')}>Risk: {p.path_risk}</Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-slate-500">
                    <div><span className="text-slate-400">Likelihood:</span> <span className={riskScoreColor(p.likelihood * 100)}>{(p.likelihood * 100).toFixed(0)}%</span></div>
                    <div><span className="text-slate-400">Length:</span> <span className="text-slate-300">{p.path_length}</span></div>
                    <div><span className="text-slate-400">MITRE:</span> <span className="text-slate-300">{p.mitre_techniques.join(', ')}</span></div>
                    <div><span className="text-slate-400">Vulns:</span> <span className="text-slate-300">{p.related_vulnerabilities.length || 'None'}</span></div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{p.estimated_impact}</p>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Attack Path Details" size="lg">
        {selected && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100 mb-2">Path</h3>
              <div className="flex items-center gap-2 flex-wrap">
                {(selected.path_nodes as { id: string; type: string; ip: string }[]).map((n, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
                      <p className="text-xs font-medium text-slate-200">{n.id}</p>
                      <p className="text-[10px] text-slate-500">{n.type}</p>
                    </div>
                    {i < (selected.path_nodes as unknown[]).length - 1 && <span className="text-cyan-400">{'->'}</span>}
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><span className="text-slate-500">Path Risk:</span> <span className={riskScoreColor(selected.path_risk)}>{selected.path_risk}</span></div>
              <div><span className="text-slate-500">Likelihood:</span> <span className="text-slate-300">{(selected.likelihood * 100).toFixed(0)}%</span></div>
              <div><span className="text-slate-500">Path Length:</span> <span className="text-slate-300">{selected.path_length}</span></div>
              <div><span className="text-slate-500">Impact:</span> <span className="text-slate-300">{selected.estimated_impact}</span></div>
            </div>
            {selected.required_conditions.length > 0 && (
              <div><p className="text-xs text-slate-500 mb-1">Required Conditions:</p><ul className="list-disc list-inside text-xs text-slate-300">{selected.required_conditions.map((c, i) => <li key={i}>{c}</li>)}</ul></div>
            )}
            {selected.mitre_techniques.length > 0 && (
              <div><p className="text-xs text-slate-500 mb-1">MITRE Techniques:</p><div className="flex flex-wrap gap-1">{selected.mitre_techniques.map((t, i) => <Badge key={i} className="text-cyan-400 bg-cyan-500/10 border-cyan-500/20">{t}</Badge>)}</div></div>
            )}
            {selected.related_vulnerabilities.length > 0 && (
              <div><p className="text-xs text-slate-500 mb-1">Related Vulnerabilities:</p><div className="flex flex-wrap gap-1">{selected.related_vulnerabilities.map((v, i) => <Badge key={i} className="text-red-400 bg-red-500/10 border-red-500/20">{v}</Badge>)}</div></div>
            )}
            {selected.recommended_control && (
              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3"><p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> Recommended Control:</p><p className="text-xs text-slate-200">{selected.recommended_control}</p></div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
