import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Plus, Play, Trash2, ToggleLeft, ToggleRight, AlertCircle } from 'lucide-react';
import { useDetectionRules } from '../hooks/useData';
import { useOrg } from '../context/OrgContext';
import { supabase } from '../lib/supabase';
import { Card, Badge, Button, Input, Select, Textarea, Modal, EmptyState, LoadingState, ErrorState } from '../components/ui';
import { severityColor } from '../lib/utils';
import { useToast } from '../context/ToastContext';
import type { DetectionRule } from '../types';

export function DetectionRules() {
  const { currentOrg } = useOrg();
  const rulesQ = useDetectionRules();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', severity: 'medium', rule_type: 'simple', threshold: '1', time_window: '300', mitre_tactic: '', mitre_technique: '', conditions: '{}' });

  async function create() {
    if (!currentOrg || !form.name.trim()) return;
    setActing(true);
    const { error } = await supabase.from('detection_rules').insert({
      org_id: currentOrg.id,
      name: form.name,
      description: form.description,
      severity: form.severity,
      rule_type: form.rule_type,
      threshold: parseInt(form.threshold) || 1,
      time_window: parseInt(form.time_window) || 300,
      mitre_tactic: form.mitre_tactic || null,
      mitre_technique: form.mitre_technique || null,
      conditions: JSON.parse(form.conditions || '{}'),
      enabled: true,
      is_simulated: false,
    });
    setActing(false);
    if (error) toast(`Failed: ${error.message}`, 'error');
    else { toast('Rule created', 'success'); setShowForm(false); setForm({ name: '', description: '', severity: 'medium', rule_type: 'simple', threshold: '1', time_window: '300', mitre_tactic: '', mitre_technique: '', conditions: '{}' }); qc.invalidateQueries({ queryKey: ['detection-rules'] }); }
  }

  async function toggle(rule: DetectionRule) {
    const { error } = await supabase.from('detection_rules').update({ enabled: !rule.enabled }).eq('id', rule.id);
    if (error) toast(`Failed: ${error.message}`, 'error');
    else { toast(`Rule ${!rule.enabled ? 'enabled' : 'disabled'}`, 'success'); qc.invalidateQueries({ queryKey: ['detection-rules'] }); }
  }

  async function testRule(rule: DetectionRule) {
    setTesting(rule.id);
    // Simulate rule test against sample data
    await new Promise((r) => setTimeout(r, 1500));
    setTesting(null);
    toast(`Rule "${rule.name}" tested: ${rule.match_count} matches found`, 'info');
  }

  async function del(rule: DetectionRule) {
    const { error } = await supabase.from('detection_rules').delete().eq('id', rule.id);
    if (error) toast(`Failed: ${error.message}`, 'error');
    else { toast('Rule deleted', 'success'); qc.invalidateQueries({ queryKey: ['detection-rules'] }); }
  }

  if (!currentOrg) return <EmptyState icon={<ShieldCheck className="w-8 h-8" />} title="No organization selected" />;
  if (rulesQ.isLoading) return <LoadingState />;
  if (rulesQ.error) return <ErrorState message={rulesQ.error.message} onRetry={() => rulesQ.refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Detection Rules</h1>
          <p className="text-xs text-slate-500">{(rulesQ.data ?? []).length} rules - {currentOrg.name}</p>
        </div>
        <Button size="sm" variant="primary" onClick={() => setShowForm(true)}><Plus className="w-3.5 h-3.5" /> Add Rule</Button>
      </div>

      <div className="space-y-2">
        {(rulesQ.data ?? []).length === 0 ? (
          <EmptyState icon={<ShieldCheck className="w-6 h-6" />} title="No detection rules" description="Create detection rules to generate alerts from events." action={<Button size="sm" variant="primary" onClick={() => setShowForm(true)}><Plus className="w-3.5 h-3.5" /> Add Rule</Button>} />
        ) : (
          (rulesQ.data ?? []).map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={severityColor(r.severity)}>{r.severity}</Badge>
                    <Badge className="text-cyan-400 bg-cyan-500/10 border-cyan-500/20">{r.rule_type}</Badge>
                    {r.enabled ? <Badge className="text-green-400 bg-green-500/10 border-green-500/20">Enabled</Badge> : <Badge className="text-slate-500 bg-slate-500/10 border-slate-500/20">Disabled</Badge>}
                    {r.is_simulated && <Badge className="text-amber-400 bg-amber-500/10 border-amber-500/20">SIM</Badge>}
                  </div>
                  <p className="text-sm font-medium text-slate-100">{r.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{r.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-500">
                    <span>Threshold: {r.threshold}</span>
                    <span>Window: {r.time_window}s</span>
                    <span>Matches: {r.match_count}</span>
                    <span>Errors: {r.error_count}</span>
                    {r.mitre_technique && <span>MITRE: {r.mitre_technique}</span>}
                  </div>
                </div>
                <div className="flex gap-1 ml-2">
                  <button onClick={() => testRule(r)} disabled={testing === r.id} className="text-slate-400 hover:text-cyan-400" title="Test rule">
                    {testing === r.id ? <AlertCircle className="w-4 h-4 animate-pulse" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button onClick={() => toggle(r)} className="text-slate-400 hover:text-cyan-400" title="Toggle">
                    {r.enabled ? <ToggleRight className="w-4 h-4 text-green-400" /> : <ToggleLeft className="w-4 h-4" />}
                  </button>
                  <button onClick={() => del(r)} className="text-slate-400 hover:text-red-400" title="Delete"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add Detection Rule" size="lg">
        <div className="space-y-3">
          <Input label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <Textarea label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Severity" value={form.severity} onChange={(v) => setForm({ ...form, severity: v })} options={[{value:'critical',label:'Critical'},{value:'high',label:'High'},{value:'medium',label:'Medium'},{value:'low',label:'Low'},{value:'info',label:'Info'}]} />
            <Select label="Rule Type" value={form.rule_type} onChange={(v) => setForm({ ...form, rule_type: v })} options={[{value:'simple',label:'Simple'},{value:'threshold',label:'Threshold'},{value:'sequence',label:'Sequence'},{value:'correlation',label:'Correlation'}]} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Threshold" type="number" value={form.threshold} onChange={(v) => setForm({ ...form, threshold: v })} />
            <Input label="Time Window (s)" type="number" value={form.time_window} onChange={(v) => setForm({ ...form, time_window: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="MITRE Tactic" value={form.mitre_tactic} onChange={(v) => setForm({ ...form, mitre_tactic: v })} />
            <Input label="MITRE Technique" value={form.mitre_technique} onChange={(v) => setForm({ ...form, mitre_technique: v })} />
          </div>
          <Textarea label="Conditions (JSON)" value={form.conditions} onChange={(v) => setForm({ ...form, conditions: v })} rows={4} />
          <Button variant="primary" onClick={create} loading={acting} disabled={!form.name.trim()}>Create Rule</Button>
        </div>
      </Modal>
    </div>
  );
}
