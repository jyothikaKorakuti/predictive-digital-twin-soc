import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Bug, Plus, Download, Search, AlertTriangle, Shield } from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useVulnerabilities, useAssetVulnerabilities, useAssets } from '../hooks/useData';
import { useOrg } from '../context/OrgContext';
import { supabase } from '../lib/supabase';
import { Card, CardHeader, Badge, Button, Input, Select, Textarea, Modal, EmptyState, LoadingState, ErrorState, StatCard } from '../components/ui';
import { severityColor, statusColor, exportCsv } from '../lib/utils';
import { useToast } from '../context/ToastContext';
import type { Vulnerability } from '../types';

const SEV_COLORS: Record<string, string> = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#3b82f6', info: '#64748b' };

export function Vulnerabilities() {
  const { currentOrg } = useOrg();
  const vulnsQ = useVulnerabilities();
  const avQ = useAssetVulnerabilities();
  const assetsQ = useAssets();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [sevFilter, setSevFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [acting, setActing] = useState(false);
  const [form, setForm] = useState({ cve_id: '', title: '', description: '', cvss_score: '', cvss_severity: 'medium', epss_score: '', exploit_available: false, patch_available: false, remediation: '', asset_id: '' });

  async function create() {
    if (!currentOrg || !form.title.trim()) return;
    setActing(true);
    const { data: vuln, error } = await supabase.from('vulnerabilities').insert({
      org_id: currentOrg.id,
      cve_id: form.cve_id || null,
      title: form.title,
      description: form.description,
      cvss_score: parseFloat(form.cvss_score) || 0,
      cvss_severity: form.cvss_severity,
      epss_score: parseFloat(form.epss_score) || 0,
      exploit_available: form.exploit_available,
      patch_available: form.patch_available,
      remediation: form.remediation || null,
      status: 'open',
      is_simulated: false,
    }).select().single();
    if (error) { toast(`Failed: ${error.message}`, 'error'); setActing(false); return; }
    if (form.asset_id) {
      await supabase.from('asset_vulnerabilities').insert({
        asset_id: form.asset_id, vulnerability_id: vuln.id, org_id: currentOrg.id, status: 'open',
      });
    }
    setActing(false);
    setShowForm(false);
    setForm({ cve_id: '', title: '', description: '', cvss_score: '', cvss_severity: 'medium', epss_score: '', exploit_available: false, patch_available: false, remediation: '', asset_id: '' });
    toast('Vulnerability created', 'success');
    qc.invalidateQueries({ queryKey: ['vulnerabilities'] });
    qc.invalidateQueries({ queryKey: ['asset-vulnerabilities'] });
  }

  async function updateStatus(v: Vulnerability, status: string) {
    const { error } = await supabase.from('vulnerabilities').update({ status }).eq('id', v.id);
    if (error) toast(`Failed: ${error.message}`, 'error');
    else { toast('Status updated', 'success'); qc.invalidateQueries({ queryKey: ['vulnerabilities'] }); }
  }

  const filtered = useMemo(() => (vulnsQ.data ?? []).filter((v) => {
    if (search && !v.title.toLowerCase().includes(search.toLowerCase()) && !(v.cve_id ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    if (sevFilter !== 'all' && v.cvss_severity !== sevFilter) return false;
    if (statusFilter !== 'all' && v.status !== statusFilter) return false;
    return true;
  }), [vulnsQ.data, search, sevFilter, statusFilter]);

  const bySeverity = useMemo(() => {
    const counts: Record<string, number> = {};
    (vulnsQ.data ?? []).forEach((v) => { counts[v.cvss_severity] = (counts[v.cvss_severity] ?? 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [vulnsQ.data]);

  const byAsset = useMemo(() => {
    const counts: Record<string, number> = {};
    (avQ.data ?? []).forEach((av) => {
      const asset = (assetsQ.data ?? []).find((a) => a.id === av.asset_id);
      if (asset) counts[asset.hostname] = (counts[asset.hostname] ?? 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));
  }, [avQ.data, assetsQ.data]);

  if (!currentOrg) return <EmptyState icon={<Bug className="w-8 h-8" />} title="No organization selected" />;
  if (vulnsQ.isLoading) return <LoadingState />;
  if (vulnsQ.error) return <ErrorState message={vulnsQ.error.message} onRetry={() => vulnsQ.refetch()} />;

  const open = (vulnsQ.data ?? []).filter((v) => v.status === 'open');
  const critical = open.filter((v) => v.cvss_severity === 'critical');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Vulnerabilities</h1>
          <p className="text-xs text-slate-500">{open.length} open, {critical.length} critical - {currentOrg.name}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => exportCsv('vulnerabilities.csv', filtered as unknown as Record<string, unknown>[])}><Download className="w-3.5 h-3.5" /> Export</Button>
          <Button size="sm" variant="primary" onClick={() => setShowForm(true)}><Plus className="w-3.5 h-3.5" /> Add Vulnerability</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Open Vulns" value={open.length} icon={<Bug className="w-5 h-5 text-orange-400" />} color="text-orange-400" />
        <StatCard label="Critical" value={critical.length} icon={<AlertTriangle className="w-5 h-5 text-red-400" />} color="text-red-400" />
        <StatCard label="Exploit Available" value={open.filter((v) => v.exploit_available).length} icon={<AlertTriangle className="w-5 h-5 text-yellow-400" />} color="text-yellow-400" />
        <StatCard label="Patch Available" value={open.filter((v) => v.patch_available).length} icon={<Shield className="w-5 h-5 text-green-400" />} color="text-green-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Vulnerabilities by Severity" />
          <div className="p-4 h-56">
            {bySeverity.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={bySeverity} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70}>{bySeverity.map((e) => <Cell key={e.name} fill={SEV_COLORS[e.name] ?? '#64748b'} />)}</Pie><Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} /></PieChart>
              </ResponsiveContainer>
            ) : <EmptyState icon={<Bug className="w-6 h-6" />} title="No data" />}
          </div>
        </Card>
        <Card>
          <CardHeader title="Vulnerabilities by Asset" />
          <div className="p-4 h-56">
            {byAsset.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byAsset} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#1e293b" /><XAxis type="number" stroke="#64748b" fontSize={11} /><YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={80} /><Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} /><Bar dataKey="value" fill="#f97316" radius={[0, 4, 4, 0]} /></BarChart>
              </ResponsiveContainer>
            ) : <EmptyState icon={<Bug className="w-6 h-6" />} title="No data" />}
          </div>
        </Card>
      </div>

      <Card className="p-3">
        <div className="flex gap-2">
          <div className="relative flex-1"><Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" /><input placeholder="Search by title or CVE..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-100" /></div>
          <select value={sevFilter} onChange={(e) => setSevFilter(e.target.value)} className="bg-slate-800/50 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200"><option value="all">All severities</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option><option value="info">Info</option></select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-slate-800/50 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200"><option value="all">All statuses</option><option value="open">Open</option><option value="remediated">Remediated</option><option value="accepted">Accepted</option><option value="false_positive">False Positive</option></select>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          {filtered.length === 0 ? <EmptyState icon={<Bug className="w-6 h-6" />} title="No vulnerabilities" /> : (
            <table className="w-full text-xs">
              <thead><tr className="text-left text-slate-500 border-b border-slate-800"><th className="px-4 py-2">CVE</th><th className="px-4 py-2">Title</th><th className="px-4 py-2">CVSS</th><th className="px-4 py-2">Severity</th><th className="px-4 py-2">EPSS</th><th className="px-4 py-2">Exploit</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-800/50">
                {filtered.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-2 text-slate-300 font-mono">{v.cve_id ?? 'N/A'}</td>
                    <td className="px-4 py-2 text-slate-200">{v.title}</td>
                    <td className="px-4 py-2 text-slate-300">{v.cvss_score}</td>
                    <td className="px-4 py-2"><Badge className={severityColor(v.cvss_severity)}>{v.cvss_severity}</Badge></td>
                    <td className="px-4 py-2 text-slate-300">{(v.epss_score * 100).toFixed(0)}%</td>
                    <td className="px-4 py-2">{v.exploit_available ? <Badge className="text-red-400 bg-red-500/10 border-red-500/20">Yes</Badge> : <span className="text-slate-600">No</span>}</td>
                    <td className="px-4 py-2"><Badge className={statusColor(v.status)}>{v.status}</Badge></td>
                    <td className="px-4 py-2"><select value={v.status} onChange={(e) => updateStatus(v, e.target.value)} className="bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-xs text-slate-200"><option value="open">open</option><option value="remediated">remediated</option><option value="accepted">accepted</option><option value="false_positive">false_positive</option></select></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add Vulnerability" size="lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="CVE ID" value={form.cve_id} onChange={(v) => setForm({ ...form, cve_id: v })} placeholder="CVE-2024-XXXX" />
            <Input label="CVSS Score" type="number" value={form.cvss_score} onChange={(v) => setForm({ ...form, cvss_score: v })} />
          </div>
          <Input label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} required />
          <Textarea label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Severity" value={form.cvss_severity} onChange={(v) => setForm({ ...form, cvss_severity: v })} options={[{value:'critical',label:'Critical'},{value:'high',label:'High'},{value:'medium',label:'Medium'},{value:'low',label:'Low'},{value:'info',label:'Info'}]} />
            <Input label="EPSS Score" type="number" value={form.epss_score} onChange={(v) => setForm({ ...form, epss_score: v })} placeholder="0.0-1.0" />
          </div>
          <Select label="Affected Asset" value={form.asset_id} onChange={(v) => setForm({ ...form, asset_id: v })} options={[{value:'',label:'None'},...(assetsQ.data ?? []).map((a) => ({value:a.id,label:a.hostname}))]} />
          <Textarea label="Remediation" value={form.remediation} onChange={(v) => setForm({ ...form, remediation: v })} />
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={form.exploit_available} onChange={(e) => setForm({ ...form, exploit_available: e.target.checked })} className="accent-cyan-500" /> Exploit Available</label>
            <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={form.patch_available} onChange={(e) => setForm({ ...form, patch_available: e.target.checked })} className="accent-cyan-500" /> Patch Available</label>
          </div>
          <Button variant="primary" onClick={create} loading={acting} disabled={!form.title.trim()}>Create</Button>
        </div>
      </Modal>
    </div>
  );
}
