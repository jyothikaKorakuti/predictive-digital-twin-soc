import { useState } from 'react';
import { ScrollText, Search, Download } from 'lucide-react';
import { useAuditLogs } from '../hooks/useData';
import { Card, Badge, Button, EmptyState, LoadingState, ErrorState } from '../components/ui';
import { formatTimestamp, exportCsv } from '../lib/utils';

export function AuditLogs() {
  const auditQ = useAuditLogs(200);
  const [search, setSearch] = useState('');

  const filtered = (auditQ.data ?? []).filter((a) => {
    if (search && !a.action.toLowerCase().includes(search.toLowerCase()) && !(a.user_email ?? '').toLowerCase().includes(search.toLowerCase()) && !(a.resource_type ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (auditQ.isLoading) return <LoadingState />;
  if (auditQ.error) return <ErrorState message={auditQ.error.message} onRetry={() => auditQ.refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Audit Logs</h1>
          <p className="text-xs text-slate-500">{filtered.length} audit entries</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => exportCsv('audit-logs.csv', filtered as unknown as Record<string, unknown>[])}><Download className="w-3.5 h-3.5" /> Export</Button>
      </div>

      <Card className="p-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input placeholder="Search audit logs..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-100" />
        </div>
      </Card>

      <Card>
        {filtered.length === 0 ? <EmptyState icon={<ScrollText className="w-6 h-6" />} title="No audit logs" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-slate-500 border-b border-slate-800"><th className="px-4 py-2">Timestamp</th><th className="px-4 py-2">User</th><th className="px-4 py-2">Action</th><th className="px-4 py-2">Resource</th><th className="px-4 py-2">Details</th></tr></thead>
              <tbody className="divide-y divide-slate-800/50">
                {filtered.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-2 text-slate-400 whitespace-nowrap">{formatTimestamp(a.created_at)}</td>
                    <td className="px-4 py-2 text-slate-300">{a.user_email ?? 'System'}</td>
                    <td className="px-4 py-2"><Badge className="text-cyan-400 bg-cyan-500/10 border-cyan-500/20">{a.action}</Badge></td>
                    <td className="px-4 py-2 text-slate-400">{a.resource_type ?? 'N/A'} {a.resource_id ? `(${a.resource_id.slice(0, 8)})` : ''}</td>
                    <td className="px-4 py-2 text-slate-500 max-w-xs truncate">{Object.keys(a.details).length > 0 ? JSON.stringify(a.details) : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
