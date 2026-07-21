import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, Plus, Download } from 'lucide-react';
import { useIncidents, useAlerts } from '../hooks/useData';
import { useOrg } from '../context/OrgContext';
import { supabase } from '../lib/supabase';
import { Card, Badge, Button, Input, Select, Textarea, Modal, EmptyState, LoadingState, ErrorState, ConfirmDialog } from '../components/ui';
import { severityColor, statusColor, formatTimestamp, exportCsv } from '../lib/utils';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import type { Incident, IncidentStatus } from '../types';

const STATUSES: IncidentStatus[] = ['open', 'triaged', 'investigating', 'contained', 'eradicated', 'recovered', 'closed'];

export function Incidents() {
  const { currentOrg } = useOrg();
  const incQ = useIncidents();
  const alertsQ = useAlerts();
  const { toast } = useToast();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Incident | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Incident | null>(null);
  const [form, setForm] = useState({ title: '', description: '', severity: 'medium', status: 'open', owner: '', containment: '', eradication: '', recovery: '', lessons: '' });
  const [selectedAlerts, setSelectedAlerts] = useState<string[]>([]);
  const [acting, setActing] = useState(false);

  async function createIncident() {
    if (!currentOrg || !form.title.trim()) return;
    setActing(true);
    const { data, error } = await supabase.from('incidents').insert({
      org_id: currentOrg.id,
      title: form.title,
      description: form.description,
      severity: form.severity,
      status: form.status,
      owner: form.owner || profile?.email || null,
      containment_actions: form.containment,
      eradication_actions: form.eradication,
      recovery_actions: form.recovery,
      lessons_learned: form.lessons,
      related_alerts: selectedAlerts,
      is_simulated: false,
    }).select().single();
    if (error) { toast(`Failed: ${error.message}`, 'error'); setActing(false); return; }
    for (const aid of selectedAlerts) {
      await supabase.from('incident_alerts').insert({ incident_id: data.id, alert_id: aid });
    }
    setActing(false);
    setShowCreate(false);
    setForm({ title: '', description: '', severity: 'medium', status: 'open', owner: '', containment: '', eradication: '', recovery: '', lessons: '' });
    setSelectedAlerts([]);
    toast('Incident created', 'success');
    qc.invalidateQueries({ queryKey: ['incidents'] });
  }

  async function updateStatus(inc: Incident, status: string) {
    const { error } = await supabase.from('incidents').update({ status }).eq('id', inc.id);
    if (error) toast(`Failed: ${error.message}`, 'error');
    else { toast('Status updated', 'success'); qc.invalidateQueries({ queryKey: ['incidents'] }); setSelected({ ...inc, status: status as IncidentStatus }); }
  }

  if (!currentOrg) return <EmptyState icon={<ShieldAlert className="w-8 h-8" />} title="No organization selected" />;
  if (incQ.isLoading) return <LoadingState />;
  if (incQ.error) return <ErrorState message={incQ.error.message} onRetry={() => incQ.refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Incidents</h1>
          <p className="text-xs text-slate-500">{(incQ.data ?? []).length} incidents - {currentOrg.name}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => exportCsv('incidents.csv', (incQ.data ?? []) as unknown as Record<string, unknown>[])}><Download className="w-3.5 h-3.5" /> Export</Button>
          <Button size="sm" variant="primary" onClick={() => setShowCreate(true)}><Plus className="w-3.5 h-3.5" /> New Incident</Button>
        </div>
      </div>

      <div className="space-y-2">
        {(incQ.data ?? []).length === 0 ? (
          <EmptyState icon={<ShieldAlert className="w-6 h-6" />} title="No incidents" description="Create an incident from alerts or manually." action={<Button size="sm" variant="primary" onClick={() => setShowCreate(true)}><Plus className="w-3.5 h-3.5" /> New Incident</Button>} />
        ) : (
          (incQ.data ?? []).map((i) => (
            <Card key={i.id} className="p-4 cursor-pointer hover:border-slate-700" >
              <div onClick={() => setSelected(i)}>
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={severityColor(i.severity)}>{i.severity}</Badge>
                  <Badge className={statusColor(i.status)}>{i.status}</Badge>
                  {i.is_simulated && <Badge className="text-amber-400 bg-amber-500/10 border-amber-500/20">SIM</Badge>}
                </div>
                <p className="text-sm font-medium text-slate-100">{i.title}</p>
                <p className="text-xs text-slate-500 mt-1">{i.description}</p>
                <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-500">
                  <span>{formatTimestamp(i.created_at)}</span>
                  <span>Owner: {i.owner ?? 'Unassigned'}</span>
                  <span>IOCs: {i.iocs.length}</span>
                  <span>Assets: {i.related_assets.length}</span>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Incident" size="lg">
        <div className="space-y-3">
          <Input label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} required />
          <Textarea label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Severity" value={form.severity} onChange={(v) => setForm({ ...form, severity: v })} options={[
              { value: 'critical', label: 'Critical' }, { value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }, { value: 'info', label: 'Info' },
            ]} />
            <Select label="Status" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={STATUSES.map((s) => ({ value: s, label: s }))} />
          </div>
          <Input label="Owner" value={form.owner} onChange={(v) => setForm({ ...form, owner: v })} placeholder="analyst email" />
          <Textarea label="Containment Actions" value={form.containment} onChange={(v) => setForm({ ...form, containment: v })} />
          <Textarea label="Eradication Actions" value={form.eradication} onChange={(v) => setForm({ ...form, eradication: v })} />
          <Textarea label="Recovery Actions" value={form.recovery} onChange={(v) => setForm({ ...form, recovery: v })} />
          <Textarea label="Lessons Learned" value={form.lessons} onChange={(v) => setForm({ ...form, lessons: v })} />
          <div>
            <p className="text-xs text-slate-400 mb-2">Link Alerts:</p>
            <div className="max-h-40 overflow-y-auto space-y-1 border border-slate-800 rounded-lg p-2">
              {(alertsQ.data ?? []).map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={selectedAlerts.includes(a.id)} onChange={(e) => {
                    if (e.target.checked) setSelectedAlerts([...selectedAlerts, a.id]);
                    else setSelectedAlerts(selectedAlerts.filter((id) => id !== a.id));
                  }} className="accent-cyan-500" />
                  {a.title}
                </label>
              ))}
              {(alertsQ.data ?? []).length === 0 && <p className="text-xs text-slate-600">No alerts available</p>}
            </div>
          </div>
          <Button variant="primary" onClick={createIncident} loading={acting} disabled={!form.title.trim()}>Create Incident</Button>
        </div>
      </Modal>

      {/* Detail modal */}
      <Modal open={!!selected && !showCreate} onClose={() => setSelected(null)} title="Incident Details" size="lg">
        {selected && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className={severityColor(selected.severity)}>{selected.severity}</Badge>
                <Badge className={statusColor(selected.status)}>{selected.status}</Badge>
                {selected.is_simulated && <Badge className="text-amber-400 bg-amber-500/10 border-amber-500/20">SIM</Badge>}
              </div>
              <h3 className="text-sm font-bold text-slate-100">{selected.title}</h3>
              <p className="text-xs text-slate-400 mt-1">{selected.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><span className="text-slate-500">Owner:</span> <span className="text-slate-300">{selected.owner ?? 'Unassigned'}</span></div>
              <div><span className="text-slate-500">Created:</span> <span className="text-slate-300">{formatTimestamp(selected.created_at)}</span></div>
            </div>
            {selected.iocs.length > 0 && (
              <div><p className="text-xs text-slate-500 mb-1">IOCs:</p><div className="flex flex-wrap gap-1">{selected.iocs.map((ioc, i) => <Badge key={i} className="text-red-400 bg-red-500/10 border-red-500/20">{ioc}</Badge>)}</div></div>
            )}
            {selected.related_assets.length > 0 && (
              <div><p className="text-xs text-slate-500 mb-1">Related Assets:</p><div className="flex flex-wrap gap-1">{selected.related_assets.map((a, i) => <Badge key={i} className="text-blue-400 bg-blue-500/10 border-blue-500/20">{a}</Badge>)}</div></div>
            )}
            {selected.mitre_mapping.length > 0 && (
              <div><p className="text-xs text-slate-500 mb-1">MITRE Mapping:</p>{selected.mitre_mapping.map((m, i) => <div key={i} className="text-xs text-slate-300">{m.tactic} - {m.technique}</div>)}</div>
            )}
            {selected.timeline.length > 0 && (
              <div><p className="text-xs text-slate-500 mb-1">Timeline:</p><div className="space-y-1">{selected.timeline.map((t, i) => <div key={i} className="text-xs text-slate-300"><span className="text-slate-500">{t.time}:</span> {t.event}</div>)}</div></div>
            )}
            {selected.containment_actions && <div><p className="text-xs text-slate-500">Containment:</p><p className="text-xs text-slate-300">{selected.containment_actions}</p></div>}
            {selected.eradication_actions && <div><p className="text-xs text-slate-500">Eradication:</p><p className="text-xs text-slate-300">{selected.eradication_actions}</p></div>}
            {selected.recovery_actions && <div><p className="text-xs text-slate-500">Recovery:</p><p className="text-xs text-slate-300">{selected.recovery_actions}</p></div>}
            {selected.lessons_learned && <div><p className="text-xs text-slate-500">Lessons:</p><p className="text-xs text-slate-300">{selected.lessons_learned}</p></div>}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
              <Select label="" value={selected.status} onChange={(v) => updateStatus(selected, v)} options={STATUSES.map((s) => ({ value: s, label: s }))} />
              <Button size="sm" variant="danger" onClick={() => setConfirmDelete(selected)}>Delete</Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={async () => {
        if (!confirmDelete) return;
        const { error } = await supabase.from('incidents').delete().eq('id', confirmDelete.id);
        if (error) toast(`Failed: ${error.message}`, 'error');
        else { toast('Incident deleted', 'success'); qc.invalidateQueries({ queryKey: ['incidents'] }); setSelected(null); }
      }} title="Delete Incident" message={`Delete "${confirmDelete?.title}"?`} confirmLabel="Delete" danger />
    </div>
  );
}
