import { useState } from 'react';
import { Save, Shield, Bell, Database, Palette } from 'lucide-react';
import { useOrg } from '../context/OrgContext';
import { supabase } from '../lib/supabase';
import { Card, CardHeader, Button, Input, Select } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

export function Settings() {
  const { currentOrg } = useOrg();
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [password, setPassword] = useState('');
  const [theme, setTheme] = useState('dark');
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifCritical, setNotifCritical] = useState(true);

  async function saveProfile() {
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', profile?.id);
    setSaving(false);
    if (error) toast(`Failed: ${error.message}`, 'error');
    else { toast('Profile updated', 'success'); refreshProfile(); }
  }

  async function changePassword() {
    if (password.length < 8) { toast('Password must be 8+ characters', 'warning'); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) toast(`Failed: ${error.message}`, 'error');
    else { toast('Password changed', 'success'); setPassword(''); }
  }

  async function saveSettings() {
    if (!currentOrg) return;
    setSaving(true);
    const { error } = await supabase.from('application_settings').upsert({
      org_id: currentOrg.id,
      key: 'ui_settings',
      value: { theme, notifEmail, notifCritical },
    });
    setSaving(false);
    if (error) toast(`Failed: ${error.message}`, 'error');
    else toast('Settings saved', 'success');
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-100">Settings</h1>
        <p className="text-xs text-slate-500">Manage your profile and application settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Profile" subtitle="Update your account information" />
          <div className="p-4 space-y-3">
            <Input label="Email" value={profile?.email ?? ''} onChange={() => {}} />
            <Input label="Full Name" value={fullName} onChange={setFullName} />
            <Button variant="primary" onClick={saveProfile} loading={saving}><Save className="w-3.5 h-3.5" /> Save Profile</Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Change Password" subtitle="Update your password" action={<Shield className="w-4 h-4 text-slate-500" />} />
          <div className="p-4 space-y-3">
            <Input label="New Password" type="password" value={password} onChange={setPassword} placeholder="Min 8 characters" />
            <Button variant="primary" onClick={changePassword} loading={saving}><Save className="w-3.5 h-3.5" /> Change Password</Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Appearance" subtitle="Customize the interface" action={<Palette className="w-4 h-4 text-slate-500" />} />
          <div className="p-4 space-y-3">
            <Select label="Theme" value={theme} onChange={setTheme} options={[{value:'dark',label:'Dark (Default)'},{value:'light',label:'Light'}]} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Notifications" subtitle="Configure alert notifications" action={<Bell className="w-4 h-4 text-slate-500" />} />
          <div className="p-4 space-y-3">
            <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={notifEmail} onChange={(e) => setNotifEmail(e.target.checked)} className="accent-cyan-500" /> Email notifications</label>
            <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={notifCritical} onChange={(e) => setNotifCritical(e.target.checked)} className="accent-cyan-500" /> Critical alerts only</label>
            <Button variant="primary" onClick={saveSettings} loading={saving}><Save className="w-3.5 h-3.5" /> Save Settings</Button>
          </div>
        </Card>
      </div>

      {currentOrg && (
        <Card>
          <CardHeader title="System Information" subtitle="Platform status" action={<Database className="w-4 h-4 text-slate-500" />} />
          <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <div><span className="text-slate-500">Organization:</span> <span className="text-slate-300">{currentOrg.name}</span></div>
            <div><span className="text-slate-500">Database:</span> <span className="text-green-400">PostgreSQL (Connected)</span></div>
            <div><span className="text-slate-500">Backend:</span> <span className="text-green-400">Supabase Edge Functions</span></div>
            <div><span className="text-slate-500">Auth:</span> <span className="text-green-400">Supabase Auth (JWT)</span></div>
            <div><span className="text-slate-500">Real-time:</span> <span className="text-green-400">Polling (3s)</span></div>
            <div><span className="text-slate-500">Risk Model:</span> <span className="text-cyan-400">rule-based-v1</span></div>
          </div>
        </Card>
      )}
    </div>
  );
}
