import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Building2, Globe, Users, Shield } from 'lucide-react';
import { useOrganizations } from '../hooks/useData';
import { useOrg } from '../context/OrgContext';
import { supabase } from '../lib/supabase';
import { Card, Badge, Button, Input, Textarea, Modal, EmptyState, LoadingState, ErrorState, ConfirmDialog } from '../components/ui';
import { useToast } from '../context/ToastContext';
import type { Organization } from '../types';

export function Organizations() {
  const orgsQ = useOrganizations();
  const { setCurrentOrg, orgs, setOrgs } = useOrg();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Organization | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Organization | null>(null);
  const [form, setForm] = useState({ name: '', industry: '', location: '', employee_count: '', risk_appetite: 'medium', critical_services: '', network_ranges: '', description: '' });
  const [acting, setActing] = useState(false);

  function openCreate() { setEditing(null); setForm({ name: '', industry: '', location: '', employee_count: '', risk_appetite: 'medium', critical_services: '', network_ranges: '', description: '' }); setShowForm(true); }
  function openEdit(org: Organization) { setEditing(org); setForm({ name: org.name, industry: org.industry ?? '', location: org.location ?? '', employee_count: String(org.employee_count ?? ''), risk_appetite: org.risk_appetite, critical_services: org.critical_services ?? '', network_ranges: org.network_ranges ?? '', description: org.description ?? '' }); setShowForm(true); }

  async function save() {
    if (!form.name.trim()) return;
    setActing(true);
    const payload = { ...form, employee_count: form.employee_count ? parseInt(form.employee_count) : null };
    if (editing) {
      const { error } = await supabase.from('organizations').update(payload).eq('id', editing.id);
      setActing(false);
      if (error) toast(`Failed: ${error.message}`, 'error');
      else { toast('Organization updated', 'success'); setShowForm(false); qc.invalidateQueries({ queryKey: ['organizations'] }); }
    } else {
      const { data, error } = await supabase.from('organizations').insert({ ...payload, is_simulated: false }).select().single();
      setActing(false);
      if (error) toast(`Failed: ${error.message}`, 'error');
      else { toast('Organization created', 'success'); setShowForm(false); setOrgs([...orgs, data as Organization]); setCurrentOrg(data as Organization); }
    }
  }

  async function del(org: Organization) {
    const { error } = await supabase.from('organizations').delete().eq('id', org.id);
    if (error) toast(`Failed: ${error.message}`, 'error');
    else { toast('Organization deleted', 'success'); qc.invalidateQueries({ queryKey: ['organizations'] }); setOrgs(orgs.filter((o) => o.id !== org.id)); }
  }

  if (orgsQ.isLoading) return <LoadingState />;
  if (orgsQ.error) return <ErrorState message={orgsQ.error.message} onRetry={() => orgsQ.refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Organizations</h1>
          <p className="text-xs text-slate-500">{(orgsQ.data ?? []).length} organizations</p>
        </div>
        <Button size="sm" variant="primary" onClick={openCreate}><Plus className="w-3.5 h-3.5" /> Add Organization</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(orgsQ.data ?? []).length === 0 ? (
          <div className="col-span-full"><EmptyState icon={<Building2 className="w-8 h-8" />} title="No organizations" description="Create your first organization to get started." action={<Button size="sm" variant="primary" onClick={openCreate}><Plus className="w-3.5 h-3.5" /> Add Organization</Button>} /></div>
        ) : (
          (orgsQ.data ?? []).map((org) => (
            <Card key={org.id} className="p-4 hover:border-slate-700 cursor-pointer" >
              <div onClick={() => setCurrentOrg(org)}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-cyan-400" />
                    <h3 className="text-sm font-bold text-slate-100">{org.name}</h3>
                  </div>
                  {org.is_simulated && <Badge className="text-amber-400 bg-amber-500/10 border-amber-500/20">SIM</Badge>}
                </div>
                <div className="space-y-1 text-xs text-slate-400">
                  {org.industry && <p><Globe className="w-3 h-3 inline mr-1" /> {org.industry} - {org.location}</p>}
                  {org.employee_count && <p><Users className="w-3 h-3 inline mr-1" /> {org.employee_count} employees</p>}
                  <p><Shield className="w-3 h-3 inline mr-1" /> Risk appetite: {org.risk_appetite}</p>
                  {org.critical_services && <p className="truncate">Services: {org.critical_services}</p>}
                  {org.network_ranges && <p className="truncate font-mono">Networks: {org.network_ranges}</p>}
                </div>
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t border-slate-800">
                <Button size="sm" variant="ghost" onClick={() => openEdit(org)}><Edit className="w-3.5 h-3.5" /> Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(org)}><Trash2 className="w-3.5 h-3.5" /> Delete</Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Organization' : 'Add Organization'} size="lg">
        <div className="space-y-3">
          <Input label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Industry" value={form.industry} onChange={(v) => setForm({ ...form, industry: v })} />
            <Input label="Location" value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Employee Count" type="number" value={form.employee_count} onChange={(v) => setForm({ ...form, employee_count: v })} />
            <Input label="Risk Appetite" value={form.risk_appetite} onChange={(v) => setForm({ ...form, risk_appetite: v })} />
          </div>
          <Input label="Critical Services" value={form.critical_services} onChange={(v) => setForm({ ...form, critical_services: v })} placeholder="e.g. Web Portal, ERP" />
          <Input label="Network Ranges" value={form.network_ranges} onChange={(v) => setForm({ ...form, network_ranges: v })} placeholder="e.g. 10.0.0.0/8" />
          <Textarea label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
          <Button variant="primary" onClick={save} loading={acting} disabled={!form.name.trim()}>{editing ? 'Update' : 'Create'}</Button>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={() => del(confirmDelete!)} title="Delete Organization" message={`Delete "${confirmDelete?.name}" and all associated data?`} confirmLabel="Delete" danger />
    </div>
  );
}
