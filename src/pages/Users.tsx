import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Users as UsersIcon, Plus, Shield } from 'lucide-react';
import { useProfiles } from '../hooks/useData';
import { supabase } from '../lib/supabase';
import { Card, Badge, Button, Input, Select, Modal, EmptyState, LoadingState, ErrorState } from '../components/ui';
import { formatTimestamp } from '../lib/utils';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'analyst', label: 'SOC Analyst' },
  { value: 'auditor', label: 'Read-Only Auditor' },
];

function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Email is required';
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!re.test(email)) return 'Please enter a valid email address';
  return null;
}

function validatePassword(password: string): string | null {
  if (!password) return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[a-zA-Z]/.test(password)) return 'Password must contain at least one letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
  return null;
}

export function Users() {
  const profilesQ = useProfiles();
  const { toast } = useToast();
  const { profile: currentUser, hasRole } = useAuth();
  const qc = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [acting, setActing] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role: 'analyst' as UserRole });
  const [errors, setErrors] = useState<{ email?: string; password?: string; full_name?: string }>({});

  function resetForm() {
    setForm({ email: '', password: '', full_name: '', role: 'analyst' });
    setErrors({});
  }

  async function invite() {
    const emailErr = validateEmail(form.email);
    const passErr = validatePassword(form.password);
    if (emailErr || passErr) {
      setErrors({ email: emailErr ?? undefined, password: passErr ?? undefined });
      return;
    }

    setActing(true);
    setErrors({});

    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: {
            full_name: form.full_name.trim() || form.email.trim(),
            role: form.role,
          },
        },
      });

      if (error) {
        const msg = error.message;
        if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) {
          toast('A user with this email already exists.', 'error');
        } else if (msg.includes('password')) {
          toast('Password does not meet requirements.', 'error');
        } else if (msg.includes('Database error')) {
          toast('Unable to create the user. Please try again.', 'error');
        } else {
          toast(msg, 'error');
        }
        return;
      }

      if (!data.user) {
        toast('Unable to create the user.', 'error');
        return;
      }

      // If the selected role is not the default 'analyst', update the profile
      // The trigger creates with the role from metadata, but if that fails
      // (e.g. RLS), we attempt a direct update as admin
      if (form.role !== 'analyst' && currentUser?.role === 'admin') {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ role: form.role })
          .eq('id', data.user.id);

        if (updateError) {
          console.error('Failed to set role:', updateError.message);
          toast('User created but role assignment failed. Please set the role manually.', 'warning');
        }
      }

      setShowInvite(false);
      resetForm();
      toast('User created successfully', 'success');
      qc.invalidateQueries({ queryKey: ['profiles'] });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to create the user.';
      toast(message, 'error');
    } finally {
      setActing(false);
    }
  }

  async function updateRole(userId: string, role: string) {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
    if (error) {
      toast(`Failed to update role: ${error.message}`, 'error');
    } else {
      toast('Role updated successfully', 'success');
      qc.invalidateQueries({ queryKey: ['profiles'] });
    }
  }

  if (profilesQ.isLoading) return <LoadingState />;
  if (profilesQ.error) return <ErrorState message={profilesQ.error.message} onRetry={() => profilesQ.refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Users</h1>
          <p className="text-xs text-slate-500">{(profilesQ.data ?? []).length} users</p>
        </div>
        {hasRole('admin') && <Button size="sm" variant="primary" onClick={() => setShowInvite(true)}><Plus className="w-3.5 h-3.5" /> Invite User</Button>}
      </div>

      <Card>
        {(profilesQ.data ?? []).length === 0 ? <EmptyState icon={<UsersIcon className="w-6 h-6" />} title="No users" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-slate-500 border-b border-slate-800"><th className="px-4 py-2">User</th><th className="px-4 py-2">Email</th><th className="px-4 py-2">Role</th><th className="px-4 py-2">Created</th><th className="px-4 py-2">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-800/50">
                {(profilesQ.data ?? []).map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-2"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-cyan-500/20 flex items-center justify-center text-xs font-bold text-cyan-300">{p.email[0]?.toUpperCase()}</div><span className="text-slate-200">{p.full_name ?? p.email}</span></div></td>
                    <td className="px-4 py-2 text-slate-400">{p.email}</td>
                    <td className="px-4 py-2">
                      {hasRole('admin') && p.id !== currentUser?.id ? (
                        <select value={p.role} onChange={(e) => updateRole(p.id, e.target.value)} className="bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-xs text-slate-200">
                          <option value="admin">admin</option><option value="analyst">analyst</option><option value="auditor">auditor</option>
                        </select>
                      ) : (
                        <Badge className={p.role === 'admin' ? 'text-red-400 bg-red-500/10 border-red-500/20' : p.role === 'analyst' ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' : 'text-slate-400 bg-slate-500/10 border-slate-500/20'}>{p.role}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-400">{formatTimestamp(p.created_at)}</td>
                    <td className="px-4 py-2">{p.role === 'admin' && <Shield className="w-3.5 h-3.5 text-red-400" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={showInvite} onClose={() => { setShowInvite(false); resetForm(); }} title="Invite User" size="md">
        <div className="space-y-3">
          <div>
            <Input label="Full Name" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} placeholder="John Doe" />
            {errors.full_name && <p className="text-xs text-red-400 mt-1">{errors.full_name}</p>}
          </div>
          <div>
            <Input label="Email" type="email" value={form.email} onChange={(v) => { setForm({ ...form, email: v }); if (errors.email) setErrors({ ...errors, email: undefined }); }} required />
            {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email}</p>}
          </div>
          <div>
            <Input label="Password" type="password" value={form.password} onChange={(v) => { setForm({ ...form, password: v }); if (errors.password) setErrors({ ...errors, password: undefined }); }} required />
            {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password}</p>}
            <p className="text-[10px] text-slate-600 mt-1">Minimum 8 characters with at least one letter and one number.</p>
          </div>
          <Select label="Role" value={form.role} onChange={(v) => setForm({ ...form, role: v as UserRole })} options={ROLE_OPTIONS} />
          <Button
            variant="primary"
            onClick={invite}
            loading={acting}
            disabled={acting || !form.email.trim() || !form.password.trim()}
          >
            {acting ? 'Creating...' : 'Invite User'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
