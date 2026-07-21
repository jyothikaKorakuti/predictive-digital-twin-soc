import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FlaskConical, Plus, Play, Download } from 'lucide-react';
import { useSimulations, useAssets } from '../hooks/useData';
import { useOrg } from '../context/OrgContext';
import { supabase } from '../lib/supabase';
import { Card, Badge, Button, Select, Textarea, Modal, EmptyState, LoadingState, ErrorState } from '../components/ui';
import { statusColor, formatTimestamp, exportCsv } from '../lib/utils';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import type { Simulation, SimulationStep } from '../types';

const SCENARIOS = [
  { name: 'Phishing Attack', techniques: ['T1566', 'T1078'], steps: ['Phishing email received', 'User clicks link', 'Credentials harvested', 'Attacker authenticates'] },
  { name: 'Credential Brute Force', techniques: ['T1110', 'T1078'], steps: ['Brute force SSH', 'Password cracked', 'Attacker logs in', 'Establishes persistence'] },
  { name: 'Lateral Movement', techniques: ['T1021', 'T1210'], steps: ['Compromised host', 'Scans internal network', 'Exploits remote service', 'Reaches target'] },
  { name: 'Privilege Escalation', techniques: ['T1068', 'T1053'], steps: ['Initial access', 'Discovers vulnerability', 'Exploits for privilege escalation', 'Gains admin'] },
  { name: 'Ransomware Propagation', techniques: ['T1486', 'T1210'], steps: ['Initial compromise', 'Lateral movement', 'Deploy ransomware', 'Encrypt data'] },
  { name: 'Data Exfiltration', techniques: ['T1041', 'T1071'], steps: ['Access sensitive data', 'Stage data', 'Exfiltrate via C2', 'Data leaves network'] },
  { name: 'Insider Misuse', techniques: ['T1078', 'T1041'], steps: ['Insider uses valid access', 'Accesses unauthorized data', 'Downloads sensitive files', 'Exfiltrates data'] },
  { name: 'Cloud Account Compromise', techniques: ['T1078', 'T1210'], steps: ['Credentials leaked', 'Attacker accesses cloud', 'Enumerates resources', 'Exfiltrates data'] },
];

export function Simulations() {
  const { currentOrg } = useOrg();
  const simsQ = useSimulations();
  const assetsQ = useAssets();
  const { toast } = useToast();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Simulation | null>(null);
  const [steps, setSteps] = useState<SimulationStep[]>([]);
  const [acting, setActing] = useState(false);
  const [form, setForm] = useState({ scenario: SCENARIOS[0].name, initialAsset: '', targetAsset: '', assumptions: '' });

  async function runSimulation() {
    if (!currentOrg || !form.initialAsset || !form.targetAsset) { toast('Select start and target assets', 'warning'); return; }
    setActing(true);
    const scenario = SCENARIOS.find((s) => s.name === form.scenario)!;
    const startAsset = (assetsQ.data ?? []).find((a) => a.id === form.initialAsset);
    const targetAsset = (assetsQ.data ?? []).find((a) => a.id === form.targetAsset);

    // Simulate attack path against digital twin
    const probability = 0.3 + (startAsset?.internet_exposed ? 0.2 : 0) + (targetAsset?.criticality === 'critical' ? 0.15 : 0) + Math.random() * 0.15;
    const simSteps = scenario.steps.map((action, i) => ({
      step_number: i + 1,
      asset_id: i === 0 ? form.initialAsset : i === scenario.steps.length - 1 ? form.targetAsset : null,
      asset_name: i === 0 ? startAsset?.hostname : i === scenario.steps.length - 1 ? targetAsset?.hostname : 'intermediate',
      action,
      mitre_technique: scenario.techniques[i % scenario.techniques.length],
      probability: Math.max(0.3, probability - i * 0.1),
      result: Math.random() > 0.15 ? 'success' : 'blocked',
      controls_encountered: [],
      description: `Simulated step: ${action} against ${i === 0 ? startAsset?.hostname : targetAsset?.hostname}`,
    }));

    const { data: sim, error } = await supabase.from('simulations').insert({
      org_id: currentOrg.id,
      scenario_name: scenario.name,
      entry_point: startAsset?.internet_exposed ? 'Internet-exposed service' : 'Internal access',
      initial_asset_id: form.initialAsset,
      target_asset_id: form.targetAsset,
      assumptions: form.assumptions ? form.assumptions.split('\n').filter(Boolean) : ['Default assumptions'],
      mitre_techniques: scenario.techniques,
      status: 'completed',
      successful_steps: simSteps.filter((s) => s.result === 'success').length,
      blocked_steps: simSteps.filter((s) => s.result === 'blocked').length,
      estimated_impact: `${targetAsset?.criticality === 'critical' ? 'Critical' : 'High'} impact - ${targetAsset?.hostname} compromise`,
      recommended_mitigations: ['Patch vulnerabilities', 'Enable MFA', 'Network segmentation', 'Monitor for suspicious activity'],
      business_impact: 'Potential data breach and service disruption',
      probability,
      started_by: profile?.email ?? 'analyst',
      is_simulated: true,
    }).select().single();

    if (error) { toast(`Failed: ${error.message}`, 'error'); setActing(false); return; }

    await supabase.from('simulation_steps').insert(simSteps.map((s) => ({ ...s, simulation_id: sim.id })));

    setActing(false);
    setShowForm(false);
    setForm({ scenario: SCENARIOS[0].name, initialAsset: '', targetAsset: '', assumptions: '' });
    toast('Simulation completed', 'success');
    qc.invalidateQueries({ queryKey: ['simulations'] });
  }

  async function loadSteps(simId: string) {
    const { data, error } = await supabase.from('simulation_steps').select('*').eq('simulation_id', simId).order('step_number');
    if (error) { toast(`Failed: ${error.message}`, 'error'); return; }
    setSteps(data as SimulationStep[]);
  }

  if (!currentOrg) return <EmptyState icon={<FlaskConical className="w-8 h-8" />} title="No organization selected" />;
  if (simsQ.isLoading) return <LoadingState />;
  if (simsQ.error) return <ErrorState message={simsQ.error.message} onRetry={() => simsQ.refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Simulations</h1>
          <p className="text-xs text-slate-500">{(simsQ.data ?? []).length} simulations - {currentOrg.name}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => exportCsv('simulations.csv', (simsQ.data ?? []) as unknown as Record<string, unknown>[])}><Download className="w-3.5 h-3.5" /> Export</Button>
          <Button size="sm" variant="primary" onClick={() => setShowForm(true)}><Plus className="w-3.5 h-3.5" /> New Simulation</Button>
        </div>
      </div>

      <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-3 text-xs text-cyan-300">
        All simulations run against the internal digital-twin graph. No real exploitation, credential theft, or destructive actions are performed. Data is labeled as SIMULATED.
      </div>

      <div className="space-y-2">
        {(simsQ.data ?? []).length === 0 ? (
          <EmptyState icon={<FlaskConical className="w-6 h-6" />} title="No simulations" description="Run a safe attack simulation against the digital twin." action={<Button size="sm" variant="primary" onClick={() => setShowForm(true)}><Plus className="w-3.5 h-3.5" /> New Simulation</Button>} />
        ) : (
          (simsQ.data ?? []).map((s) => (
            <Card key={s.id} className="p-4 cursor-pointer hover:border-slate-700" >
              <div onClick={async () => { setSelected(s); await loadSteps(s.id); }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-slate-100">{s.scenario_name}</p>
                  <div className="flex items-center gap-2">
                    <Badge className={statusColor(s.status)}>{s.status}</Badge>
                    <Badge className="text-amber-400 bg-amber-500/10 border-amber-500/20">SIM</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-slate-500">
                  <div><span className="text-slate-400">Probability:</span> <span className="text-slate-300">{(s.probability * 100).toFixed(0)}%</span></div>
                  <div><span className="text-slate-400">Success:</span> <span className="text-green-400">{s.successful_steps}</span> / <span className="text-red-400">{s.blocked_steps}</span></div>
                  <div><span className="text-slate-400">Started by:</span> <span className="text-slate-300">{s.started_by ?? 'N/A'}</span></div>
                  <div><span className="text-slate-400">Date:</span> <span className="text-slate-300">{formatTimestamp(s.created_at)}</span></div>
                </div>
                <p className="text-xs text-slate-500 mt-1">{s.estimated_impact}</p>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="New Simulation" size="lg">
        <div className="space-y-3">
          <Select label="Scenario" value={form.scenario} onChange={(v) => setForm({ ...form, scenario: v })} options={SCENARIOS.map((s) => ({ value: s.name, label: s.name }))} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Initial Asset" value={form.initialAsset} onChange={(v) => setForm({ ...form, initialAsset: v })} options={[{value:'',label:'Select...'},...(assetsQ.data ?? []).map((a) => ({value:a.id,label:a.hostname}))]} />
            <Select label="Target Asset" value={form.targetAsset} onChange={(v) => setForm({ ...form, targetAsset: v })} options={[{value:'',label:'Select...'},...(assetsQ.data ?? []).map((a) => ({value:a.id,label:a.hostname}))]} />
          </div>
          <Textarea label="Assumptions (one per line)" value={form.assumptions} onChange={(v) => setForm({ ...form, assumptions: v })} rows={4} placeholder="SSH exposed to internet&#10;No MFA enabled&#10;Weak password policy" />
          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded p-2 text-xs text-yellow-300">
            This simulation operates against the digital twin graph only. No real systems are contacted.
          </div>
          <Button variant="primary" onClick={runSimulation} loading={acting} disabled={!form.initialAsset || !form.targetAsset}><Play className="w-3.5 h-3.5" /> Run Simulation</Button>
        </div>
      </Modal>

      <Modal open={!!selected} onClose={() => { setSelected(null); setSteps([]); }} title="Simulation Details" size="lg">
        {selected && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100">{selected.scenario_name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={statusColor(selected.status)}>{selected.status}</Badge>
                <Badge className="text-amber-400 bg-amber-500/10 border-amber-500/20">SIMULATED</Badge>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><span className="text-slate-500">Probability:</span> <span className="text-slate-300">{(selected.probability * 100).toFixed(0)}%</span></div>
              <div><span className="text-slate-500">Entry:</span> <span className="text-slate-300">{selected.entry_point ?? 'N/A'}</span></div>
              <div><span className="text-slate-500">Success:</span> <span className="text-green-400">{selected.successful_steps}</span></div>
              <div><span className="text-slate-500">Blocked:</span> <span className="text-red-400">{selected.blocked_steps}</span></div>
            </div>
            {selected.assumptions.length > 0 && (
              <div><p className="text-xs text-slate-500 mb-1">Assumptions:</p><ul className="list-disc list-inside text-xs text-slate-300">{selected.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul></div>
            )}
            {steps.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-2">Simulation Steps:</p>
                <div className="space-y-2">
                  {steps.map((step) => (
                    <div key={step.id} className="flex items-start gap-3 bg-slate-800/50 rounded p-2">
                      <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-xs text-cyan-300 shrink-0">{step.step_number}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-slate-200">{step.action}</p>
                          <Badge className={step.result === 'success' ? 'text-green-400 bg-green-500/10 border-green-500/20' : 'text-red-400 bg-red-500/10 border-red-500/20'}>{step.result}</Badge>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">{step.asset_name} - {step.mitre_technique} - {(step.probability * 100).toFixed(0)}% probability</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selected.recommended_mitigations.length > 0 && (
              <div><p className="text-xs text-slate-500 mb-1">Recommended Mitigations:</p><ul className="list-disc list-inside text-xs text-slate-300">{selected.recommended_mitigations.map((m, i) => <li key={i}>{m}</li>)}</ul></div>
            )}
            {selected.business_impact && <div><p className="text-xs text-slate-500">Business Impact:</p><p className="text-xs text-slate-300">{selected.business_impact}</p></div>}
          </div>
        )}
      </Modal>
    </div>
  );
}
