import { useState, useMemo } from 'react';
import { BookOpen, Search, Download } from 'lucide-react';
import { useMitreTechniques, useAlerts, useEvents } from '../hooks/useData';
import { Card, CardHeader, Badge, Button, EmptyState, LoadingState, ErrorState, StatCard, Modal } from '../components/ui';
import { exportCsv } from '../lib/utils';
import type { MitreTechnique } from '../types';

export function Mitre() {
  const mitreQ = useMitreTechniques();
  const alertsQ = useAlerts();
  const eventsQ = useEvents(200);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<MitreTechnique | null>(null);

  const coverage = useMemo(() => {
    const techniques = mitreQ.data ?? [];
    const alerts = alertsQ.data ?? [];
    const events = eventsQ.data ?? [];
    const covered = new Set<string>();
    alerts.forEach((a) => { if (a.mitre_technique) covered.add(a.mitre_technique); });
    events.forEach((e) => { if (e.mitre_technique) covered.add(e.mitre_technique); });
    return {
      total: techniques.length,
      covered: techniques.filter((t) => covered.has(t.technique_id)).length,
      uncovered: techniques.filter((t) => !covered.has(t.technique_id)).length,
      detectionCounts: techniques.map((t) => ({
        technique: t,
        detectionCount: alerts.filter((a) => a.mitre_technique === t.technique_id).length + events.filter((e) => e.mitre_technique === t.technique_id).length,
      })),
    };
  }, [mitreQ.data, alertsQ.data, eventsQ.data]);

  const filtered = useMemo(() => {
    return coverage.detectionCounts.filter((t) => {
      if (search && !t.technique.name.toLowerCase().includes(search.toLowerCase()) && !t.technique.technique_id.toLowerCase().includes(search.toLowerCase()) && !t.technique.tactic.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [coverage.detectionCounts, search]);

  const byTactic = useMemo(() => {
    const groups: Record<string, { technique: MitreTechnique; detectionCount: number }[]> = {};
    filtered.forEach((t) => {
      const tactic = t.technique.tactic.split(',')[0].trim();
      if (!groups[tactic]) groups[tactic] = [];
      groups[tactic].push(t);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  if (mitreQ.isLoading) return <LoadingState />;
  if (mitreQ.error) return <ErrorState message={mitreQ.error.message} onRetry={() => mitreQ.refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">MITRE ATT&CK</h1>
          <p className="text-xs text-slate-500">Coverage and detection mapping</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => exportCsv('mitre-coverage.csv', coverage.detectionCounts.map((d) => ({ technique_id: d.technique.technique_id, name: d.technique.name, tactic: d.technique.tactic, detections: d.detectionCount })) as unknown as Record<string, unknown>[])}><Download className="w-3.5 h-3.5" /> Export</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Techniques" value={coverage.total} icon={<BookOpen className="w-5 h-5 text-cyan-400" />} color="text-cyan-400" />
        <StatCard label="Covered" value={coverage.covered} icon={<BookOpen className="w-5 h-5 text-green-400" />} color="text-green-400" />
        <StatCard label="Uncovered" value={coverage.uncovered} icon={<BookOpen className="w-5 h-5 text-red-400" />} color="text-red-400" />
        <StatCard label="Coverage %" value={`${coverage.total > 0 ? Math.round((coverage.covered / coverage.total) * 100) : 0}%`} icon={<BookOpen className="w-5 h-5 text-yellow-400" />} color="text-yellow-400" />
      </div>

      <Card className="p-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input placeholder="Search techniques, tactics..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-100" />
        </div>
      </Card>

      {byTactic.length === 0 ? <EmptyState icon={<BookOpen className="w-6 h-6" />} title="No techniques found" /> : (
        <div className="space-y-4">
          {byTactic.map(([tactic, techs]) => (
            <Card key={tactic}>
              <CardHeader title={tactic} subtitle={`${techs.length} techniques`} />
              <div className="p-3 space-y-1">
                {techs.map((t) => (
                  <div key={t.technique.id} className="flex items-center justify-between px-3 py-2 rounded hover:bg-slate-800/50 cursor-pointer" onClick={() => setSelected(t.technique)}>
                    <div className="flex items-center gap-3">
                      <Badge className="text-cyan-400 bg-cyan-500/10 border-cyan-500/20">{t.technique.technique_id}</Badge>
                      <span className="text-xs text-slate-200">{t.technique.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {t.detectionCount > 0 ? (
                        <Badge className="text-green-400 bg-green-500/10 border-green-500/20">{t.detectionCount} detections</Badge>
                      ) : (
                        <Badge className="text-slate-500 bg-slate-500/10 border-slate-500/20">No coverage</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title="MITRE Technique" size="lg">
        {selected && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className="text-cyan-400 bg-cyan-500/10 border-cyan-500/20">{selected.technique_id}</Badge>
                <Badge className="text-slate-300 bg-slate-500/10 border-slate-500/20">{selected.tactic}</Badge>
              </div>
              <h3 className="text-sm font-bold text-slate-100">{selected.name}</h3>
            </div>
            {selected.description && <div><p className="text-xs text-slate-500 mb-1">Description:</p><p className="text-xs text-slate-300">{selected.description}</p></div>}
            {selected.detection_guidance && <div><p className="text-xs text-slate-500 mb-1">Detection Guidance:</p><p className="text-xs text-slate-300">{selected.detection_guidance}</p></div>}
            {selected.mitigation_guidance && <div><p className="text-xs text-slate-500 mb-1">Mitigation Guidance:</p><p className="text-xs text-slate-300">{selected.mitigation_guidance}</p></div>}
          </div>
        )}
      </Modal>
    </div>
  );
}
