import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { TrendingUp, Calculator, Download, Target, Zap, Activity } from 'lucide-react';
import { useRiskAssessments, useAssets, useVulnerabilities, useAlerts, useEvents } from '../hooks/useData';
import { useOrg } from '../context/OrgContext';
import { supabase } from '../lib/supabase';
import { Card, CardHeader, Badge, Button, EmptyState, LoadingState, ErrorState, StatCard, Modal } from '../components/ui';
import { riskScoreColor, riskLevelColor, riskLevelFromScore, exportCsv } from '../lib/utils';
import { useToast } from '../context/ToastContext';
import type { RiskAssessment } from '../types';

export function RiskPredictions() {
  const { currentOrg } = useOrg();
  const riskQ = useRiskAssessments();
  const assetsQ = useAssets();
  const vulnsQ = useVulnerabilities();
  const alertsQ = useAlerts();
  const eventsQ = useEvents(100);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [calculating, setCalculating] = useState(false);
  const [selected, setSelected] = useState<RiskAssessment | null>(null);

  async function calculateRisk() {
    if (!currentOrg) return;
    setCalculating(true);
    const assets = assetsQ.data ?? [];
    const vulns = vulnsQ.data ?? [];
    const alerts = alertsQ.data ?? [];
    const events = eventsQ.data ?? [];

    // Transparent weighted risk scoring engine
    // Formula: weighted sum of factors normalized to 0-100
    const assessments: object[] = [];

    for (const asset of assets) {
      const assetVulns = vulns.filter((v) => v.status === 'open');
      const assetAlerts = alerts.filter((a) => a.asset_id === asset.id && !['resolved', 'false_positive'].includes(a.status));
      const assetEvents = events.filter((e) => e.asset_id === asset.id);
      const failedLogins = assetEvents.filter((e) => e.event_action === 'failed_login').length;

      const factors = [
        { factor: 'Internet Exposure', weight: 15, value: asset.internet_exposed ? 100 : 0 },
        { factor: 'Critical Vulnerabilities', weight: 25, value: Math.min(100, assetVulns.filter((v) => v.cvss_severity === 'critical').length * 30) },
        { factor: 'High Vulnerabilities', weight: 15, value: Math.min(100, assetVulns.filter((v) => v.cvss_severity === 'high').length * 20) },
        { factor: 'Open Ports', weight: 10, value: Math.min(100, asset.open_ports.length * 15) },
        { factor: 'Recent Alerts', weight: 20, value: Math.min(100, assetAlerts.length * 25) },
        { factor: 'Failed Logins', weight: 10, value: Math.min(100, failedLogins * 10) },
        { factor: 'Patch Status', weight: 5, value: asset.patch_status === 'pending' ? 80 : asset.patch_status === 'unknown' ? 50 : 10 },
      ];

      const score = Math.min(100, Math.round(factors.reduce((sum, f) => sum + (f.value * f.weight / 100), 0)));
      const level = riskLevelFromScore(score);
      const attackProb = Math.min(0.95, score / 100 * 0.9 + 0.05);

      const criticalAssets = assets.filter((a) => a.criticality === 'critical' && a.id !== asset.id);
      const predictedTarget = criticalAssets.length > 0 ? criticalAssets[0].hostname : 'N/A';

      assessments.push({
        org_id: currentOrg.id,
        asset_id: asset.id,
        scope: 'asset',
        risk_score: score,
        risk_level: level,
        attack_probability: attackProb,
        confidence: 0.75,
        contributing_factors: factors,
        recommended_actions: score >= 61 ? ['Patch critical vulnerabilities', 'Restrict network access', 'Enable MFA', 'Monitor for suspicious activity'] : ['Continue monitoring'],
        predicted_target: predictedTarget,
        predicted_technique: asset.internet_exposed ? 'T1190' : 'T1210',
        model_version: 'rule-based-v1',
        is_simulated: asset.is_simulated,
      });
    }

    // Org-level assessment
    const orgScore = Math.min(100, Math.round(assessments.length > 0 ? (assessments as { risk_score: number }[]).reduce((s, a) => s + a.risk_score, 0) / assessments.length : 0));
    assessments.push({
      org_id: currentOrg.id,
      asset_id: null,
      scope: 'organization',
      risk_score: orgScore,
      risk_level: riskLevelFromScore(orgScore),
      attack_probability: Math.min(0.95, orgScore / 100 * 0.85 + 0.05),
      confidence: 0.78,
      contributing_factors: [
        { factor: 'Exposed Assets', weight: 15, value: Math.min(100, assets.filter((a) => a.internet_exposed).length * 30) },
        { factor: 'Critical Vulnerabilities', weight: 25, value: Math.min(100, vulns.filter((v) => v.cvss_severity === 'critical' && v.status === 'open').length * 25) },
        { factor: 'Active Alerts', weight: 20, value: Math.min(100, alerts.filter((a) => !['resolved', 'false_positive'].includes(a.status)).length * 20) },
      ],
      recommended_actions: ['Patch critical vulnerabilities', 'Enable MFA', 'Segment network'],
      predicted_target: 'Critical infrastructure',
      predicted_technique: 'T1210',
      model_version: 'rule-based-v1',
      is_simulated: false,
    });

    // Clear old and insert new
    await supabase.from('risk_assessments').delete().eq('org_id', currentOrg.id);
    if (assessments.length > 0) {
      const { error } = await supabase.from('risk_assessments').insert(assessments);
      if (error) { toast(`Failed: ${error.message}`, 'error'); setCalculating(false); return; }
    }
    setCalculating(false);
    toast(`Calculated risk for ${assessments.length} entities`, 'success');
    qc.invalidateQueries({ queryKey: ['risk-assessments'] });
  }

  const orgRisk = useMemo(() => (riskQ.data ?? []).find((r) => r.scope === 'organization'), [riskQ.data]);
  const assetRisks = useMemo(() => (riskQ.data ?? []).filter((r) => r.scope === 'asset').sort((a, b) => b.risk_score - a.risk_score), [riskQ.data]);

  if (!currentOrg) return <EmptyState icon={<TrendingUp className="w-8 h-8" />} title="No organization selected" />;
  if (riskQ.isLoading) return <LoadingState />;
  if (riskQ.error) return <ErrorState message={riskQ.error.message} onRetry={() => riskQ.refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Risk Predictions</h1>
          <p className="text-xs text-slate-500">AI risk scoring and attack forecasting - {currentOrg.name}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => exportCsv('risk-assessments.csv', (riskQ.data ?? []) as unknown as Record<string, unknown>[])}><Download className="w-3.5 h-3.5" /> Export</Button>
          <Button size="sm" variant="primary" onClick={calculateRisk} loading={calculating}><Calculator className="w-3.5 h-3.5" /> Calculate Risk</Button>
        </div>
      </div>

      <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-300">
        Using transparent weighted risk-scoring engine (rule-based-v1). No ML model trained yet. Scores are calculated from stored findings using documented factor weights.
      </div>

      {orgRisk && (
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Organization Risk Score</p>
              <p className={`text-4xl font-bold ${riskScoreColor(orgRisk.risk_score)}`}>{Math.round(orgRisk.risk_score)}</p>
              <Badge className={riskLevelColor(orgRisk.risk_level) + ' mt-2'}>{orgRisk.risk_level}</Badge>
            </div>
            <div className="text-right space-y-1 text-xs">
              <div><span className="text-slate-500">Attack Probability:</span> <span className="text-slate-200">{(orgRisk.attack_probability * 100).toFixed(0)}%</span></div>
              <div><span className="text-slate-500">Confidence:</span> <span className="text-slate-200">{(orgRisk.confidence * 100).toFixed(0)}%</span></div>
              <div><span className="text-slate-500">Model:</span> <span className="text-slate-200">{orgRisk.model_version}</span></div>
              <div><span className="text-slate-500">Predicted Target:</span> <span className="text-slate-200">{orgRisk.predicted_target}</span></div>
              <div><span className="text-slate-500">Predicted Technique:</span> <span className="text-slate-200">{orgRisk.predicted_technique}</span></div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Critical Risk" value={assetRisks.filter((r) => r.risk_score >= 81).length} icon={<Target className="w-5 h-5 text-red-400" />} color="text-red-400" />
        <StatCard label="High Risk" value={assetRisks.filter((r) => r.risk_score >= 61 && r.risk_score < 81).length} icon={<TrendingUp className="w-5 h-5 text-orange-400" />} color="text-orange-400" />
        <StatCard label="Medium Risk" value={assetRisks.filter((r) => r.risk_score >= 41 && r.risk_score < 61).length} icon={<Activity className="w-5 h-5 text-yellow-400" />} color="text-yellow-400" />
        <StatCard label="Low Risk" value={assetRisks.filter((r) => r.risk_score < 41).length} icon={<Zap className="w-5 h-5 text-blue-400" />} color="text-blue-400" />
      </div>

      <Card>
        <CardHeader title="Asset Risk Scores" subtitle="Ranked by risk score" />
        {assetRisks.length === 0 ? <EmptyState icon={<TrendingUp className="w-6 h-6" />} title="No risk assessments" description="Click Calculate Risk to generate assessments." /> : (
          <div className="divide-y divide-slate-800">
            {assetRisks.map((r) => {
              const asset = (assetsQ.data ?? []).find((a) => a.id === r.asset_id);
              return (
                <div key={r.id} className="px-4 py-3 cursor-pointer hover:bg-slate-800/30" onClick={() => setSelected(r)}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-200">{asset?.hostname ?? 'Unknown'}</p>
                      <p className="text-[10px] text-slate-500">Probability: {(r.attack_probability * 100).toFixed(0)}% - Predicted: {r.predicted_target} via {r.predicted_technique}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-32 h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full ${r.risk_score >= 81 ? 'bg-red-500' : r.risk_score >= 61 ? 'bg-orange-500' : r.risk_score >= 41 ? 'bg-yellow-500' : 'bg-blue-500'}`} style={{ width: `${r.risk_score}%` }} />
                      </div>
                      <span className={`text-lg font-bold ${riskScoreColor(r.risk_score)}`}>{Math.round(r.risk_score)}</span>
                      <Badge className={riskLevelColor(r.risk_level)}>{r.risk_level}</Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Risk Assessment Details" size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <p className={`text-3xl font-bold ${riskScoreColor(selected.risk_score)}`}>{Math.round(selected.risk_score)}</p>
              <Badge className={riskLevelColor(selected.risk_level)}>{selected.risk_level}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><span className="text-slate-500">Attack Probability:</span> <span className="text-slate-300">{(selected.attack_probability * 100).toFixed(0)}%</span></div>
              <div><span className="text-slate-500">Confidence:</span> <span className="text-slate-300">{(selected.confidence * 100).toFixed(0)}%</span></div>
              <div><span className="text-slate-500">Model:</span> <span className="text-slate-300">{selected.model_version}</span></div>
              <div><span className="text-slate-500">Predicted Target:</span> <span className="text-slate-300">{selected.predicted_target}</span></div>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-2">Contributing Factors:</p>
              <div className="space-y-2">
                {(selected.contributing_factors as { factor: string; weight: number; value: number }[]).map((f, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300">{f.factor} <span className="text-slate-600">(weight: {f.weight}%)</span></span>
                      <span className="text-slate-400">{f.value}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full mt-1"><div className="h-full bg-cyan-500 rounded-full" style={{ width: `${f.value}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
            {selected.recommended_actions.length > 0 && (
              <div><p className="text-xs text-slate-500 mb-1">Recommended Actions:</p><ul className="list-disc list-inside text-xs text-slate-300">{selected.recommended_actions.map((a, i) => <li key={i}>{a}</li>)}</ul></div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
