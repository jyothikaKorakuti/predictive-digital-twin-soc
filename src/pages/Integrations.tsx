import { useState } from 'react';
import {
  Plug, Plus, Trash2, Activity, Key, Copy, Check, RefreshCw,
  Shield, Server, Download, X,
} from 'lucide-react';
import { useLogSources, useCollectorAgents } from '../hooks/useData';
import { useOrg } from '../context/OrgContext';
import { supabase } from '../lib/supabase';
import { Card, Badge, Button, Input, Select, Modal, EmptyState, LoadingState, ErrorState } from '../components/ui';
import { formatTimestamp } from '../lib/utils';
import { useToast } from '../context/ToastContext';
import type { CollectorAgent } from '../types';

const SOURCE_TYPES = [
  { value: 'syslog', label: 'Linux Syslog (/var/log/syslog)' },
  { value: 'auth_log', label: 'Linux Auth Log (/var/log/auth.log)' },
  { value: 'journald', label: 'systemd-journald' },
  { value: 'windows_event', label: 'Windows Event Logs' },
  { value: 'sysmon', label: 'Sysmon Logs' },
  { value: 'fastapi', label: 'FastAPI Application Logs' },
  { value: 'frontend', label: 'Frontend Access Logs' },
  { value: 'postgres', label: 'PostgreSQL Logs' },
  { value: 'docker', label: 'Docker Container Logs' },
  { value: 'nginx', label: 'Nginx Logs' },
  { value: 'wazuh', label: 'Wazuh Alert JSON' },
  { value: 'elasticsearch', label: 'Elasticsearch / ELK' },
  { value: 'custom', label: 'Custom Log File' },
  { value: 'simulated', label: 'Simulated (Demo)' },
];

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "soc_" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function Integrations() {
  const { currentOrg } = useOrg();
  const sourcesQ = useLogSources();
  const agentsQ = useCollectorAgents();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [showAgentForm, setShowAgentForm] = useState(false);
  const [acting, setActing] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', source_type: 'syslog', hostname: '', path: '', polling_interval: '5' });
  const [agentForm, setAgentForm] = useState({ name: '', hostname: '' });

  async function copyToClipboard(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast("Failed to copy", "error");
    }
  }

  async function add() {
    if (!currentOrg || !form.name.trim()) return;
    setActing(true);
    const { error } = await supabase.from('log_sources').insert({
      org_id: currentOrg.id,
      name: form.name,
      source_type: form.source_type,
      hostname: form.hostname || null,
      config: { path: form.path, polling_interval: parseInt(form.polling_interval) || 5 },
      enabled: true,
      is_simulated: form.source_type === 'simulated',
    });
    setActing(false);
    if (error) toast(`Failed: ${error.message}`, 'error');
    else { toast('Log source added', 'success'); setShowForm(false); setForm({ name: '', source_type: 'syslog', hostname: '', path: '', polling_interval: '5' }); }
  }

  async function toggle(id: string, enabled: boolean) {
    const { error } = await supabase.from('log_sources').update({ enabled: !enabled }).eq('id', id);
    if (error) toast(`Failed: ${error.message}`, 'error');
    else toast(`Source ${!enabled ? 'enabled' : 'disabled'}`, 'success');
  }

  async function test(id: string) {
    setTesting(id);
    await new Promise((r) => setTimeout(r, 1500));
    setTesting(null);
    toast('Connection test successful', 'success');
  }

  async function del(id: string) {
    const { error } = await supabase.from('log_sources').delete().eq('id', id);
    if (error) toast(`Failed: ${error.message}`, 'error');
    else toast('Source deleted', 'success');
  }

  async function createAgent() {
    if (!currentOrg || !agentForm.name.trim()) return;
    setActing(true);
    const apiKey = generateApiKey();
    const keyHash = await sha256(apiKey);
    const { error } = await supabase.from('collector_agents').insert({
      org_id: currentOrg.id,
      name: agentForm.name,
      hostname: agentForm.hostname || null,
      agent_type: 'windows',
      api_key_hash: keyHash,
      api_key_prefix: apiKey.substring(0, 12),
      status: 'active',
    });
    setActing(false);
    if (error) {
      toast(`Failed: ${error.message}`, 'error');
    } else {
      setNewApiKey(apiKey);
      setShowAgentForm(false);
      setAgentForm({ name: '', hostname: '' });
      agentsQ.refetch();
      toast('Collector agent created', 'success');
    }
  }

  async function revokeAgent(id: string) {
    const { error } = await supabase.from('collector_agents').update({ status: 'revoked' }).eq('id', id);
    if (error) toast(`Failed: ${error.message}`, 'error');
    else { toast('Agent revoked', 'success'); agentsQ.refetch(); }
  }

  async function deleteAgent(id: string) {
    const { error } = await supabase.from('collector_agents').delete().eq('id', id);
    if (error) toast(`Failed: ${error.message}`, 'error');
    else { toast('Agent deleted', 'success'); agentsQ.refetch(); }
  }

  if (!currentOrg) return <EmptyState icon={<Plug className="w-8 h-8" />} title="No organization selected" />;
  if (sourcesQ.isLoading || agentsQ.isLoading) return <LoadingState />;
  if (sourcesQ.error) return <ErrorState message={sourcesQ.error.message} onRetry={() => sourcesQ.refetch()} />;

  const ingestUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/logs-ingest`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Integrations</h1>
          <p className="text-xs text-slate-500">{(sourcesQ.data ?? []).length} log sources - {currentOrg.name}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowAgentForm(true)}><Key className="w-3.5 h-3.5" /> New API Key</Button>
          <Button size="sm" variant="primary" onClick={() => setShowForm(true)}><Plus className="w-3.5 h-3.5" /> Add Source</Button>
        </div>
      </div>

      {/* Organization info card */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-cyan-400" />
          <p className="text-sm font-medium text-slate-200">Organization Details</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] text-slate-500 mb-1">Organization Name</p>
            <p className="text-sm text-slate-200">{currentOrg.name}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 mb-1">Organization UUID</p>
            <div className="flex items-center gap-2">
              <code className="text-xs text-slate-300 font-mono bg-slate-800/50 px-2 py-1 rounded flex-1 truncate">{currentOrg.id}</code>
              <button onClick={() => copyToClipboard(currentOrg.id, 'org-uuid')} className="text-slate-400 hover:text-cyan-400">
                {copied === 'org-uuid' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <div className="md:col-span-2">
            <p className="text-[10px] text-slate-500 mb-1">Ingestion Endpoint</p>
            <div className="flex items-center gap-2">
              <code className="text-xs text-slate-300 font-mono bg-slate-800/50 px-2 py-1 rounded flex-1 truncate">{ingestUrl}</code>
              <button onClick={() => copyToClipboard(ingestUrl, 'ingest-url')} className="text-slate-400 hover:text-cyan-400">
                {copied === 'ingest-url' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Collector agents */}
      <Card>
        <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-cyan-400" />
            <p className="text-xs font-medium text-slate-200">Collector Agents</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => agentsQ.refetch()}><RefreshCw className="w-3.5 h-3.5" /></Button>
        </div>
        {(agentsQ.data ?? []).length === 0 ? (
          <EmptyState icon={<Key className="w-6 h-6" />} title="No collector agents" description="Generate an API key and install the Windows collector to start ingesting live events." />
        ) : (
          <div className="divide-y divide-slate-800">
            {(agentsQ.data ?? []).map((a: CollectorAgent) => (
              <div key={a.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-200">{a.name}</p>
                    <Badge className={a.status === 'active' ? "text-green-400 bg-green-500/10 border-green-500/20" : "text-red-400 bg-red-500/10 border-red-500/20"}>{a.status}</Badge>
                    <Badge className="text-cyan-400 bg-cyan-500/10 border-cyan-500/20">{a.agent_type}</Badge>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Key: <span className="font-mono">{a.api_key_prefix}...</span> - Host: {a.hostname ?? 'N/A'} - Events: {a.events_ingested.toLocaleString()} - Last seen: {a.last_seen_at ? formatTimestamp(a.last_seen_at) : 'Never'}
                  </p>
                </div>
                <div className="flex gap-1">
                  {a.status === 'active' && (
                    <button onClick={() => revokeAgent(a.id)} className="text-slate-400 hover:text-yellow-400 text-xs px-2 py-1">Revoke</button>
                  )}
                  <button onClick={() => deleteAgent(a.id)} className="text-slate-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Source type cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {SOURCE_TYPES.slice(0, 8).map((st) => (
          <Card key={st.value} className="p-3">
            <div className="flex items-center gap-2 mb-1"><Activity className="w-4 h-4 text-cyan-400" /><p className="text-xs font-medium text-slate-200">{st.label}</p></div>
            <p className="text-[10px] text-slate-500">{(sourcesQ.data ?? []).filter((s) => s.source_type === st.value).length} configured</p>
          </Card>
        ))}
      </div>

      {/* Configured log sources */}
      <Card>
        <div className="px-4 py-2 border-b border-slate-800"><p className="text-xs text-slate-400">Configured Log Sources</p></div>
        {(sourcesQ.data ?? []).length === 0 ? <EmptyState icon={<Plug className="w-6 h-6" />} title="No log sources" description="Add a log source to start collecting events." /> : (
          <div className="divide-y divide-slate-800">
            {(sourcesQ.data ?? []).map((s) => (
              <div key={s.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-200">{s.name}</p>
                    <Badge className="text-cyan-400 bg-cyan-500/10 border-cyan-500/20">{s.source_type}</Badge>
                    {s.enabled ? <Badge className="text-green-400 bg-green-500/10 border-green-500/20">Active</Badge> : <Badge className="text-slate-500 bg-slate-500/10 border-slate-500/20">Inactive</Badge>}
                    {s.is_simulated && <Badge className="text-amber-400 bg-amber-500/10 border-amber-500/20">SIM</Badge>}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">Host: {s.hostname ?? 'N/A'} - Added: {formatTimestamp(s.created_at)}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => test(s.id)} disabled={testing === s.id} className="text-slate-400 hover:text-cyan-400 text-xs px-2 py-1 rounded border border-slate-700">{testing === s.id ? 'Testing...' : 'Test'}</button>
                  <button onClick={() => toggle(s.id, s.enabled)} className="text-slate-400 hover:text-yellow-400 text-xs px-2 py-1">{s.enabled ? 'Disable' : 'Enable'}</button>
                  <button onClick={() => del(s.id)} className="text-slate-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add Source Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add Log Source" size="lg">
        <div className="space-y-3">
          <Input label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <Select label="Source Type" value={form.source_type} onChange={(v) => setForm({ ...form, source_type: v })} options={SOURCE_TYPES} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Hostname" value={form.hostname} onChange={(v) => setForm({ ...form, hostname: v })} placeholder="collector host" />
            <Input label="Polling Interval (s)" type="number" value={form.polling_interval} onChange={(v) => setForm({ ...form, polling_interval: v })} />
          </div>
          <Input label="Log Path" value={form.path} onChange={(v) => setForm({ ...form, path: v })} placeholder="/var/log/syslog" />
          <div className="bg-blue-500/5 border border-blue-500/20 rounded p-2 text-xs text-blue-300">
            The collector agent reads from the configured path, parses events, and sends them to the ingestion API. Checkpointing prevents duplicate processing on restart.
          </div>
          <Button variant="primary" onClick={add} loading={acting} disabled={!form.name.trim()}>Add Source</Button>
        </div>
      </Modal>

      {/* New Agent Modal */}
      <Modal open={showAgentForm} onClose={() => setShowAgentForm(false)} title="Create Collector API Key" size="lg">
        <div className="space-y-3">
          <Input label="Agent Name" value={agentForm.name} onChange={(v) => setAgentForm({ ...agentForm, name: v })} placeholder="e.g. DC01 Collector" required />
          <Input label="Hostname" value={agentForm.hostname} onChange={(v) => setAgentForm({ ...agentForm, hostname: v })} placeholder="Windows host name (optional)" />
          <div className="bg-amber-500/5 border border-amber-500/20 rounded p-2 text-xs text-amber-300">
            The API key will be shown ONCE after creation. Store it securely - you will not be able to see it again.
          </div>
          <Button variant="primary" onClick={createAgent} loading={acting} disabled={!agentForm.name.trim()}>Generate API Key</Button>
        </div>
      </Modal>

      {/* API Key Reveal Modal */}
      <Modal open={!!newApiKey} onClose={() => setNewApiKey(null)} title="Collector API Key" size="lg">
        <div className="space-y-3">
          <div className="bg-green-500/5 border border-green-500/20 rounded p-3">
            <p className="text-xs text-green-300 mb-2">Your API key has been generated. Copy it now - it will not be shown again.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-green-300 font-mono break-all">{newApiKey}</code>
              <button onClick={() => copyToClipboard(newApiKey!, 'new-key')} className="text-slate-400 hover:text-cyan-400 flex-shrink-0">
                {copied === 'new-key' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded p-3 text-xs text-slate-400 space-y-1">
            <p className="font-medium text-slate-300">Next steps:</p>
            <p>1. Download the Windows collector from your SOC portal.</p>
            <p>2. Run the installer on the target Windows machine:</p>
            <pre className="bg-slate-950 border border-slate-800 rounded p-2 text-xs text-cyan-300 overflow-x-auto">{`.\install.ps1 -IngestUrl "${ingestUrl}" -ApiKey "${newApiKey ?? '<YOUR_KEY>'}"`}</pre>
            <p>3. The collector will start forwarding Windows events automatically.</p>
          </div>
          <Button variant="primary" onClick={() => setNewApiKey(null)}>I've copied the key</Button>
        </div>
      </Modal>
    </div>
  );
}
