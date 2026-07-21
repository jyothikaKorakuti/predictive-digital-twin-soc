import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, Search, Download, User, CheckCircle, AlertTriangle, FileText, MessageSquare } from 'lucide-react';
import { useAlerts } from '../hooks/useData';
import { useOrg } from '../context/OrgContext';
import { supabase } from '../lib/supabase';
import { Card, Badge, Button, Input, Modal, EmptyState, LoadingState, ErrorState, ConfirmDialog } from '../components/ui';
import { severityColor, statusColor, formatTimestamp, ipOrNa, exportCsv } from '../lib/utils';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import type { Alert, AlertStatus } from '../types';

const STATUSES: AlertStatus[] = ['new', 'investigating', 'contained', 'resolved', 'false_positive'];

export function Alerts() {
  const { currentOrg } = useOrg();
  const alertsQ = useAlerts();
  const { toast } = useToast();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<Alert | null>(null);
  const [comment, setComment] = useState('');
  const [assignTo, setAssignTo] = useState('');
  const [showAssign, setShowAssign] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Alert | null>(null);
  const [acting, setActing] = useState(false);

  async function updateAlert(id: string, updates: Partial<Alert>) {
    setActing(true);
    const { error } = await supabase.from('alerts').update(updates).eq('id', id);
    setActing(false);
    if (error) {
      toast(`Failed: ${error.message}`, 'error');
    } else {
      toast('Alert updated', 'success');
      qc.invalidateQueries({ queryKey: ['alerts'] });
      if (selected?.id === id) setSelected({ ...selected, ...updates } as Alert);
    }
  }

  async function addComment() {
    if (!selected || !comment.trim()) return;
    const newComment = { user: profile?.email ?? 'unknown', text: comment, timestamp: new Date().toISOString() };
    const comments = [...(selected.comments as Record<string, unknown>[] ?? []), newComment as unknown as Record<string, unknown>];
    await updateAlert(selected.id, { comments });
    setComment('');
  }

  async function createIncidentFromAlert(alert: Alert) {
    if (!currentOrg) return;
    setActing(true);
    const { data, error } = await supabase.from('incidents').insert({
      org_id: currentOrg.id,
      title: `Incident from: ${alert.title}`,
      description: alert.description,
      severity: alert.severity,
      status: 'open',
      owner: profile?.email ?? null,
      related_assets: alert.affected_asset ? [alert.affected_asset] : [],
      related_users: alert.username ? [alert.username] : [],
      iocs: alert.src_ip ? [alert.src_ip] : [],
      mitre_mapping: [{ tactic: alert.mitre_tactic ?? '', technique: alert.mitre_technique ?? '' }],
      timeline: [{ time: new Date().toISOString(), event: `Alert: ${alert.title}` }],
      is_simulated: alert.is_simulated,
    }).select().single();
    setActing(false);
    if (error) { toast(`Failed: ${error.message}`, 'error'); return; }
    await supabase.from('incident_alerts').insert({ incident_id: data.id, alert_id: alert.id });
    await updateAlert(alert.id, { status: 'investigating' });
    toast('Incident created from alert', 'success');
    qc.invalidateQueries({ queryKey: ['incidents'] });
  }

  const filtered = (alertsQ.data ?? []).filter((a) => {
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    return true;
  });

  if (!currentOrg) return <EmptyState icon={<Bell className="w-8 h-8" />} title="No organization selected" />;
  if (alertsQ.isLoading) return <LoadingState />;
  if (alertsQ.error) return <ErrorState message={alertsQ.error.message} onRetry={() => alertsQ.refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Alerts</h1>
          <p className="text-xs text-slate-500">{filtered.length} alerts - {currentOrg.name}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => exportCsv('alerts.csv', filtered as unknown as Record<string, unknown>[])}>
          <Download className="w-3.5 h-3.5" /> Export CSV
        </Button>
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input placeholder="Search alerts..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-100" />
          </div>
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="bg-slate-800/50 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200">
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="info">Info</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-slate-800/50 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200">
            <option value="all">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </Card>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <EmptyState icon={<Bell className="w-6 h-6" />} title="No alerts" description="No alerts match the current filters." />
        ) : (
          filtered.map((a) => (
            <Card key={a.id} className="p-4 hover:border-slate-700 cursor-pointer" >
              <div className="flex items-start justify-between" onClick={() => setSelected(a)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={severityColor(a.severity)}>{a.severity}</Badge>
                    <Badge className={statusColor(a.status)}>{a.status}</Badge>
                    {a.is_simulated && <Badge className="text-amber-400 bg-amber-500/10 border-amber-500/20">SIM</Badge>}
                  </div>
                  <p className="text-sm font-medium text-slate-100">{a.title}</p>
                  <p className="text-xs text-slate-500 mt-1">{a.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-500">
                    <span>{formatTimestamp(a.created_at)}</span>
                    <span>Asset: {a.affected_asset ?? 'N/A'}</span>
                    <span>IP: {ipOrNa(a.src_ip)}</span>
                    <span>User: {a.username ?? 'N/A'}</span>
                    <span>MITRE: {a.mitre_technique ?? 'N/A'}</span>
                    {a.assigned_to && <span>Assigned: {a.assigned_to}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-800">
                <Button size="sm" variant="outline" onClick={() => updateAlert(a.id, { status: 'investigating', assigned_to: a.assigned_to ?? profile?.email ?? null })} disabled={acting}>Acknowledge</Button>
                <Button size="sm" variant="ghost" onClick={() => { setSelected(a); setShowAssign(true); }}><User className="w-3.5 h-3.5" /> Assign</Button>
                <Button size="sm" variant="ghost" onClick={() => createIncidentFromAlert(a)} disabled={acting}><FileText className="w-3.5 h-3.5" /> Create Incident</Button>
                <Button size="sm" variant="ghost" onClick={() => updateAlert(a.id, { status: 'resolved' })} disabled={acting}><CheckCircle className="w-3.5 h-3.5" /> Resolve</Button>
                <Button size="sm" variant="ghost" onClick={() => updateAlert(a.id, { status: 'false_positive', false_positive_notes: 'Marked as false positive by analyst' })} disabled={acting}><AlertTriangle className="w-3.5 h-3.5" /> False Positive</Button>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Alert detail modal */}
      <Modal open={!!selected && !showAssign} onClose={() => setSelected(null)} title="Alert Details" size="lg">
        {selected && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className={severityColor(selected.severity)}>{selected.severity}</Badge>
                <Badge className={statusColor(selected.status)}>{selected.status}</Badge>
              </div>
              <h3 className="text-sm font-bold text-slate-100">{selected.title}</h3>
              <p className="text-xs text-slate-400 mt-1">{selected.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><span className="text-slate-500">Affected Asset:</span> <span className="text-slate-300">{selected.affected_asset ?? 'N/A'}</span></div>
              <div><span className="text-slate-500">Source IP:</span> <span className="text-slate-300 font-mono">{ipOrNa(selected.src_ip)}</span></div>
              <div><span className="text-slate-500">User:</span> <span className="text-slate-300">{selected.username ?? 'N/A'}</span></div>
              <div><span className="text-slate-500">Assigned:</span> <span className="text-slate-300">{selected.assigned_to ?? 'Unassigned'}</span></div>
              <div><span className="text-slate-500">MITRE Tactic:</span> <span className="text-slate-300">{selected.mitre_tactic ?? 'N/A'}</span></div>
              <div><span className="text-slate-500">MITRE Technique:</span> <span className="text-slate-300">{selected.mitre_technique ?? 'N/A'}</span></div>
              <div><span className="text-slate-500">Confidence:</span> <span className="text-slate-300">{(selected.confidence * 100).toFixed(0)}%</span></div>
              <div><span className="text-slate-500">Created:</span> <span className="text-slate-300">{formatTimestamp(selected.created_at)}</span></div>
            </div>
            {selected.evidence && selected.evidence.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-1">Evidence:</p>
                <pre className="bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-400 overflow-x-auto">{JSON.stringify(selected.evidence, null, 2)}</pre>
              </div>
            )}
            {selected.false_positive_notes && (
              <div className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded p-2">
                FP Notes: {selected.false_positive_notes}
              </div>
            )}
            <div>
              <p className="text-xs text-slate-500 mb-2 flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" /> Comments</p>
              <div className="space-y-1.5 mb-2">
                {(selected.comments as { user: string; text: string; timestamp: string }[] ?? []).map((c, i) => (
                  <div key={i} className="bg-slate-800/50 rounded p-2 text-xs">
                    <span className="text-cyan-400">{c.user}</span> <span className="text-slate-500">{formatTimestamp(c.timestamp)}</span>
                    <p className="text-slate-300 mt-1">{c.text}</p>
                  </div>
                ))}
                {(selected.comments ?? []).length === 0 && <p className="text-xs text-slate-600">No comments yet</p>}
              </div>
              <div className="flex gap-2">
                <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment..." className="flex-1 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100" />
                <Button size="sm" variant="primary" onClick={addComment}>Add</Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
              <Button size="sm" variant="outline" onClick={() => updateAlert(selected.id, { status: 'investigating' })}>Acknowledge</Button>
              <Button size="sm" variant="outline" onClick={() => { setShowAssign(true); }}>Assign</Button>
              <Button size="sm" variant="outline" onClick={() => updateAlert(selected.id, { status: 'contained' })}>Contain</Button>
              <Button size="sm" variant="outline" onClick={() => updateAlert(selected.id, { status: 'resolved' })}>Resolve</Button>
              <Button size="sm" variant="outline" onClick={() => updateAlert(selected.id, { status: 'false_positive' })}>Mark FP</Button>
              <Button size="sm" variant="danger" onClick={() => setConfirmDelete(selected)}>Delete</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Assign modal */}
      <Modal open={showAssign} onClose={() => setShowAssign(false)} title="Assign Alert" size="sm">
        <div className="space-y-3">
          <Input label="Assign to" value={assignTo} onChange={setAssignTo} placeholder="analyst name or email" />
          <Button variant="primary" onClick={async () => {
            if (selected) await updateAlert(selected.id, { assigned_to: assignTo, status: 'investigating' });
            setShowAssign(false);
            setAssignTo('');
          }}>Assign</Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return;
          const { error } = await supabase.from('alerts').delete().eq('id', confirmDelete.id);
          if (error) toast(`Failed: ${error.message}`, 'error');
          else { toast('Alert deleted', 'success'); qc.invalidateQueries({ queryKey: ['alerts'] }); }
        }}
        title="Delete Alert"
        message={`Delete "${confirmDelete?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
