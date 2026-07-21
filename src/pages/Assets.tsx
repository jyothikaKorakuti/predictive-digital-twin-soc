import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Server, Plus, Edit, Trash2, Search, Download, Upload } from 'lucide-react';
import { useAssets } from '../hooks/useData';
import { useOrg } from '../context/OrgContext';
import { supabase } from '../lib/supabase';
import { Card, Badge, Button, Input, Select, Modal, EmptyState, LoadingState, ErrorState, ConfirmDialog } from '../components/ui';
import { severityColor, statusColor, ipOrNa, exportCsv } from '../lib/utils';
import { useToast } from '../context/ToastContext';
import type { Asset, AssetType, Criticality } from '../types';

const ASSET_TYPES: AssetType[] = ['workstation','laptop','server','domain_controller','database','web_server','firewall','router','switch','cloud','application','mobile','iot','other'];
const CRITICALITIES: Criticality[] = ['low','medium','high','critical'];

export function Assets() {
  const { currentOrg } = useOrg();
  const assetsQ = useAssets();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Asset | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importData, setImportData] = useState('');
  const [acting, setActing] = useState(false);
  const [form, setForm] = useState({
    hostname: '', ip_address: '', mac_address: '', asset_type: 'server' as AssetType, os_name: '', os_version: '',
    open_ports: '', services: '', internet_exposed: false, network_segment: '', business_owner: '', technical_owner: '',
    criticality: 'medium' as Criticality, patch_status: 'unknown', tags: '',
  });

  function openCreate() { setEditing(null); setForm({ hostname: '', ip_address: '', mac_address: '', asset_type: 'server', os_name: '', os_version: '', open_ports: '', services: '', internet_exposed: false, network_segment: '', business_owner: '', technical_owner: '', criticality: 'medium', patch_status: 'unknown', tags: '' }); setShowForm(true); }
  function openEdit(a: Asset) {
    setEditing(a);
    setForm({
      hostname: a.hostname, ip_address: a.ip_address ?? '', mac_address: a.mac_address ?? '', asset_type: a.asset_type,
      os_name: a.os_name ?? '', os_version: a.os_version ?? '', open_ports: a.open_ports.join(', '), services: a.services.join(', '),
      internet_exposed: a.internet_exposed, network_segment: a.network_segment ?? '', business_owner: a.business_owner ?? '',
      technical_owner: a.technical_owner ?? '', criticality: a.criticality, patch_status: a.patch_status, tags: a.tags.join(', '),
    });
    setShowForm(true);
  }

  async function save() {
    if (!currentOrg || !form.hostname.trim()) return;
    setActing(true);
    const payload = {
      ...form,
      org_id: currentOrg.id,
      open_ports: form.open_ports.split(',').map((p) => parseInt(p.trim())).filter((n) => !isNaN(n)),
      services: form.services.split(',').map((s) => s.trim()).filter(Boolean),
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      is_simulated: false,
    };
    if (editing) {
      const { error } = await supabase.from('assets').update(payload).eq('id', editing.id);
      setActing(false);
      if (error) toast(`Failed: ${error.message}`, 'error');
      else { toast('Asset updated', 'success'); setShowForm(false); qc.invalidateQueries({ queryKey: ['assets'] }); }
    } else {
      const { error } = await supabase.from('assets').insert(payload);
      setActing(false);
      if (error) toast(`Failed: ${error.message}`, 'error');
      else { toast('Asset created', 'success'); setShowForm(false); qc.invalidateQueries({ queryKey: ['assets'] }); }
    }
  }

  async function del(a: Asset) {
    const { error } = await supabase.from('assets').delete().eq('id', a.id);
    if (error) toast(`Failed: ${error.message}`, 'error');
    else { toast('Asset deleted', 'success'); qc.invalidateQueries({ queryKey: ['assets'] }); }
  }

  async function importCsv() {
    if (!currentOrg || !importData.trim()) return;
    setActing(true);
    const lines = importData.trim().split('\n');
    const headers = lines[0].split(',').map((h) => h.trim());
    let count = 0;
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(',').map((v) => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = vals[idx] ?? ''; });
      const { error } = await supabase.from('assets').insert({
        org_id: currentOrg.id,
        hostname: row.hostname || 'unknown',
        ip_address: row.ip_address || null,
        asset_type: row.asset_type || 'other',
        os_name: row.os_name || null,
        criticality: row.criticality || 'medium',
        network_segment: row.network_segment || null,
        is_simulated: false,
      });
      if (!error) count++;
    }
    setActing(false);
    setShowImport(false);
    setImportData('');
    toast(`Imported ${count} assets`, 'success');
    qc.invalidateQueries({ queryKey: ['assets'] });
  }

  const filtered = (assetsQ.data ?? []).filter((a) => {
    if (search && !a.hostname.toLowerCase().includes(search.toLowerCase()) && !(a.ip_address ?? '').includes(search)) return false;
    if (typeFilter !== 'all' && a.asset_type !== typeFilter) return false;
    return true;
  });

  if (!currentOrg) return <EmptyState icon={<Server className="w-8 h-8" />} title="No organization selected" />;
  if (assetsQ.isLoading) return <LoadingState />;
  if (assetsQ.error) return <ErrorState message={assetsQ.error.message} onRetry={() => assetsQ.refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Assets</h1>
          <p className="text-xs text-slate-500">{filtered.length} assets - {currentOrg.name}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => exportCsv('assets.csv', filtered as unknown as Record<string, unknown>[])}><Download className="w-3.5 h-3.5" /> Export</Button>
          <Button size="sm" variant="outline" onClick={() => setShowImport(true)}><Upload className="w-3.5 h-3.5" /> Import CSV</Button>
          <Button size="sm" variant="primary" onClick={openCreate}><Plus className="w-3.5 h-3.5" /> Add Asset</Button>
        </div>
      </div>

      <Card className="p-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input placeholder="Search by hostname or IP..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-100" />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="bg-slate-800/50 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200">
            <option value="all">All types</option>
            {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </Card>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState icon={<Server className="w-6 h-6" />} title="No assets" description="Add assets manually or import from CSV/Nmap." action={<Button size="sm" variant="primary" onClick={openCreate}><Plus className="w-3.5 h-3.5" /> Add Asset</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-800">
                  <th className="px-4 py-2 font-medium">Hostname</th>
                  <th className="px-4 py-2 font-medium">IP</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">OS</th>
                  <th className="px-4 py-2 font-medium">Criticality</th>
                  <th className="px-4 py-2 font-medium">Exposed</th>
                  <th className="px-4 py-2 font-medium">Segment</th>
                  <th className="px-4 py-2 font-medium">Patch</th>
                  <th className="px-4 py-2 font-medium">Data</th>
                  <th className="px-4 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filtered.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-2 text-slate-200 font-medium">{a.hostname}</td>
                    <td className="px-4 py-2 text-slate-300 font-mono">{ipOrNa(a.ip_address)}</td>
                    <td className="px-4 py-2"><Badge className="text-cyan-400 bg-cyan-500/10 border-cyan-500/20">{a.asset_type}</Badge></td>
                    <td className="px-4 py-2 text-slate-400">{a.os_name} {a.os_version}</td>
                    <td className="px-4 py-2"><Badge className={severityColor(a.criticality === 'critical' ? 'critical' : a.criticality === 'high' ? 'high' : 'medium')}>{a.criticality}</Badge></td>
                    <td className="px-4 py-2">{a.internet_exposed ? <Badge className="text-red-400 bg-red-500/10 border-red-500/20">Yes</Badge> : <span className="text-slate-600">No</span>}</td>
                    <td className="px-4 py-2 text-slate-400">{a.network_segment ?? 'N/A'}</td>
                    <td className="px-4 py-2"><Badge className={statusColor(a.patch_status)}>{a.patch_status}</Badge></td>
                    <td className="px-4 py-2">{a.is_simulated && <Badge className="text-amber-400 bg-amber-500/10 border-amber-500/20">SIM</Badge>}</td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(a)} className="text-slate-400 hover:text-cyan-400"><Edit className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setConfirmDelete(a)} className="text-slate-400 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Asset' : 'Add Asset'} size="lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Hostname" value={form.hostname} onChange={(v) => setForm({ ...form, hostname: v })} required />
            <Input label="IP Address" value={form.ip_address} onChange={(v) => setForm({ ...form, ip_address: v })} placeholder="actual IP from source" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="MAC Address" value={form.mac_address} onChange={(v) => setForm({ ...form, mac_address: v })} />
            <Select label="Asset Type" value={form.asset_type} onChange={(v) => setForm({ ...form, asset_type: v as AssetType })} options={ASSET_TYPES.map((t) => ({ value: t, label: t }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="OS Name" value={form.os_name} onChange={(v) => setForm({ ...form, os_name: v })} />
            <Input label="OS Version" value={form.os_version} onChange={(v) => setForm({ ...form, os_version: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Open Ports (comma-sep)" value={form.open_ports} onChange={(v) => setForm({ ...form, open_ports: v })} placeholder="22, 80, 443" />
            <Input label="Services (comma-sep)" value={form.services} onChange={(v) => setForm({ ...form, services: v })} placeholder="ssh, http" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Criticality" value={form.criticality} onChange={(v) => setForm({ ...form, criticality: v as Criticality })} options={CRITICALITIES.map((c) => ({ value: c, label: c }))} />
            <Input label="Patch Status" value={form.patch_status} onChange={(v) => setForm({ ...form, patch_status: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Network Segment" value={form.network_segment} onChange={(v) => setForm({ ...form, network_segment: v })} />
            <Input label="Tags (comma-sep)" value={form.tags} onChange={(v) => setForm({ ...form, tags: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Business Owner" value={form.business_owner} onChange={(v) => setForm({ ...form, business_owner: v })} />
            <Input label="Technical Owner" value={form.technical_owner} onChange={(v) => setForm({ ...form, technical_owner: v })} />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={form.internet_exposed} onChange={(e) => setForm({ ...form, internet_exposed: e.target.checked })} className="accent-cyan-500" />
            Internet Exposed
          </label>
          <Button variant="primary" onClick={save} loading={acting} disabled={!form.hostname.trim()}>{editing ? 'Update' : 'Create'}</Button>
        </div>
      </Modal>

      <Modal open={showImport} onClose={() => setShowImport(false)} title="Import Assets from CSV" size="lg">
        <div className="space-y-3">
          <p className="text-xs text-slate-500">CSV format: hostname,ip_address,asset_type,os_name,criticality,network_segment</p>
          <textarea value={importData} onChange={(e) => setImportData(e.target.value)} rows={8} placeholder="hostname,ip_address,asset_type,os_name,criticality,network_segment&#10;web-srv-02,10.10.0.81,web_server,Ubuntu,high,DMZ" className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono" />
          <Button variant="primary" onClick={importCsv} loading={acting} disabled={!importData.trim()}>Import</Button>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={() => del(confirmDelete!)} title="Delete Asset" message={`Delete "${confirmDelete?.hostname}"?`} confirmLabel="Delete" danger />
    </div>
  );
}
