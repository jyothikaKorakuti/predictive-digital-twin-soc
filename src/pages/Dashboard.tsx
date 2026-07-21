import { useMemo } from 'react';
import {
  Server, ShieldAlert, Bug, Bell, Activity, TrendingUp, Network,
  Cpu, Globe, AlertTriangle, ArrowRight, Zap,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useAssets, useVulnerabilities, useAlerts, useIncidents, useEvents, useRiskAssessments, useRecommendations, useAttackPaths } from '../hooks/useData';
import { useOrg } from '../context/OrgContext';
import { Card, CardHeader, StatCard, LoadingState, ErrorState, Badge, EmptyState } from '../components/ui';
import { severityColor, riskScoreColor, formatRelative, ipOrNa } from '../lib/utils';
import { Link } from 'react-router-dom';

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#3b82f6', info: '#64748b',
};

export function Dashboard() {
  const { currentOrg, loading: orgLoading } = useOrg();
  const assetsQ = useAssets();
  const vulnsQ = useVulnerabilities();
  const alertsQ = useAlerts();
  const incidentsQ = useIncidents();
  const eventsQ = useEvents(200);
  const riskQ = useRiskAssessments();
  const recsQ = useRecommendations();
  const pathsQ = useAttackPaths();

  const loading = assetsQ.isLoading || vulnsQ.isLoading || alertsQ.isLoading || incidentsQ.isLoading;
  const error = assetsQ.error || vulnsQ.error || alertsQ.error || incidentsQ.error;

  const stats = useMemo(() => {
    const assets = assetsQ.data ?? [];
    const vulns = vulnsQ.data ?? [];
    const alerts = alertsQ.data ?? [];
    const incidents = incidentsQ.data ?? [];
    return {
      totalAssets: assets.length,
      criticalAssets: assets.filter((a) => a.criticality === 'critical').length,
      highRiskAssets: assets.filter((a) => {
        const r = (riskQ.data ?? []).find((r) => r.asset_id === a.id);
        return r && r.risk_score >= 61;
      }).length,
      openVulns: vulns.filter((v) => v.status === 'open').length,
      criticalVulns: vulns.filter((v) => v.cvss_severity === 'critical' && v.status === 'open').length,
      activeAlerts: alerts.filter((a) => !['resolved', 'false_positive'].includes(a.status)).length,
      criticalAlerts: alerts.filter((a) => a.severity === 'critical' && !['resolved', 'false_positive'].includes(a.status)).length,
      openIncidents: incidents.filter((i) => !['closed', 'recovered'].includes(i.status)).length,
      eventsToday: (eventsQ.data ?? []).filter((e) => {
        const d = new Date(e.event_timestamp);
        return d.toDateString() === new Date().toDateString();
      }).length,
      attackPaths: (pathsQ.data ?? []).length,
    };
  }, [assetsQ.data, vulnsQ.data, alertsQ.data, incidentsQ.data, eventsQ.data, riskQ.data, pathsQ.data]);

  const orgRisk = useMemo(() => {
    const r = (riskQ.data ?? []).find((r) => r.scope === 'organization');
    return r;
  }, [riskQ.data]);

  const severityData = useMemo(() => {
    const events = eventsQ.data ?? [];
    const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    events.forEach((e) => { counts[e.severity] = (counts[e.severity] ?? 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [eventsQ.data]);

  const vulnBySeverity = useMemo(() => {
    const vulns = vulnsQ.data ?? [];
    const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    vulns.forEach((v) => { counts[v.cvss_severity] = (counts[v.cvss_severity] ?? 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [vulnsQ.data]);

  const assetsByType = useMemo(() => {
    const assets = assetsQ.data ?? [];
    const counts: Record<string, number> = {};
    assets.forEach((a) => { counts[a.asset_type] = (counts[a.asset_type] ?? 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [assetsQ.data]);

  const topSourceIps = useMemo(() => {
    const events = eventsQ.data ?? [];
    const counts: Record<string, number> = {};
    events.forEach((e) => {
      if (e.src_ip) counts[e.src_ip] = (counts[e.src_ip] ?? 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([ip, count]) => ({ ip, count }));
  }, [eventsQ.data]);

  const topFailedUsers = useMemo(() => {
    const events = eventsQ.data ?? [];
    const counts: Record<string, number> = {};
    events.forEach((e) => {
      if (e.event_action === 'failed_login' && e.username) counts[e.username] = (counts[e.username] ?? 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([user, count]) => ({ user, count }));
  }, [eventsQ.data]);

  const riskTrend = useMemo(() => {
    const assessments = riskQ.data ?? [];
    const byDay: Record<string, { date: string; score: number; count: number }> = {};
    assessments.forEach((a) => {
      const d = new Date(a.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      if (!byDay[d]) byDay[d] = { date: d, score: 0, count: 0 };
      byDay[d].score += a.risk_score;
      byDay[d].count += 1;
    });
    return Object.values(byDay).map((d) => ({ date: d.date, score: Math.round(d.score / d.count) }));
  }, [riskQ.data]);

  if (orgLoading) return <LoadingState />;
  if (!currentOrg) return <EmptyState icon={<Network className="w-8 h-8" />} title="No organization selected" description="Create or select an organization to view the dashboard." />;
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error.message} onRetry={() => assetsQ.refetch()} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">SOC Dashboard</h1>
          <p className="text-xs text-slate-500">{currentOrg.name} - Security Operations Overview</p>
        </div>
        {orgRisk && (
          <div className="flex items-center gap-3 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            <div>
              <p className="text-xs text-slate-500">Org Risk Score</p>
              <p className={`text-xl font-bold ${riskScoreColor(orgRisk.risk_score)}`}>
                {Math.round(orgRisk.risk_score)} <span className="text-xs capitalize">({orgRisk.risk_level})</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total Assets" value={stats.totalAssets} icon={<Server className="w-5 h-5 text-cyan-400" />} color="text-cyan-400" />
        <StatCard label="Critical Assets" value={stats.criticalAssets} icon={<Cpu className="w-5 h-5 text-red-400" />} color="text-red-400" />
        <StatCard label="Open Vulns" value={stats.openVulns} icon={<Bug className="w-5 h-5 text-orange-400" />} color="text-orange-400" sub={`${stats.criticalVulns} critical`} />
        <StatCard label="Active Alerts" value={stats.activeAlerts} icon={<Bell className="w-5 h-5 text-yellow-400" />} color="text-yellow-400" sub={`${stats.criticalAlerts} critical`} />
        <StatCard label="Open Incidents" value={stats.openIncidents} icon={<ShieldAlert className="w-5 h-5 text-red-400" />} color="text-red-400" />
        <StatCard label="Events Today" value={stats.eventsToday} icon={<Activity className="w-5 h-5 text-blue-400" />} color="text-blue-400" />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Risk Trend" subtitle="Organization risk score over time" />
          <div className="p-4 h-64">
            {riskTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={riskTrend}>
                  <defs>
                    <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="score" stroke="#06b6d4" fill="url(#riskGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={<TrendingUp className="w-6 h-6" />} title="No risk data yet" />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Event Severity Distribution" subtitle="Recent events by severity" />
          <div className="p-4 h-64">
            {severityData.some((d) => d.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={severityData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {severityData.map((entry) => (
                      <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name] ?? '#64748b'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={<Activity className="w-6 h-6" />} title="No events yet" />
            )}
          </div>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader title="Vulnerabilities by Severity" />
          <div className="p-4 h-56">
            {vulnBySeverity.some((d) => d.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vulnBySeverity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {vulnBySeverity.map((entry) => (
                      <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name] ?? '#64748b'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={<Bug className="w-6 h-6" />} title="No vulnerabilities" />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Assets by Type" />
          <div className="p-4 h-56">
            {assetsByType.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={assetsByType} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis type="number" stroke="#64748b" fontSize={11} />
                  <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={80} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={<Server className="w-6 h-6" />} title="No assets" />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Top Source IPs" subtitle="From recent events" />
          <div className="p-4 h-56">
            {topSourceIps.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topSourceIps} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis type="number" stroke="#64748b" fontSize={11} />
                  <YAxis dataKey="ip" type="category" stroke="#64748b" fontSize={9} width={100} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" fill="#f97316" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={<Globe className="w-6 h-6" />} title="No source IPs in events" />
            )}
          </div>
        </Card>
      </div>

      {/* Live event stream + recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Live Event Stream" subtitle="Most recent security events" action={<Link to="/logs" className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>} />
          <div className="divide-y divide-slate-800 max-h-80 overflow-y-auto">
            {(eventsQ.data ?? []).slice(0, 10).map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                <Badge className={severityColor(e.severity)}>{e.severity}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-200 truncate">{e.message}</p>
                  <p className="text-[10px] text-slate-500">{formatRelative(e.event_timestamp)} - {e.hostname} - {ipOrNa(e.src_ip)}</p>
                </div>
                {e.is_simulated && <Badge className="text-amber-400 bg-amber-500/10 border-amber-500/20">SIM</Badge>}
              </div>
            ))}
            {(eventsQ.data ?? []).length === 0 && <EmptyState icon={<Activity className="w-6 h-6" />} title="No events" />}
          </div>
        </Card>

        <Card>
          <CardHeader title="Latest Recommendations" subtitle="Prioritized security actions" action={<Link to="/recommendations" className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>} />
          <div className="divide-y divide-slate-800 max-h-80 overflow-y-auto">
            {(recsQ.data ?? []).slice(0, 6).map((r) => (
              <div key={r.id} className="px-4 py-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-200">{r.title}</p>
                  <Badge className={severityColor(r.priority === 'critical' ? 'critical' : r.priority === 'high' ? 'high' : 'medium')}>{r.priority}</Badge>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">{r.affected_asset} - {r.reason?.slice(0, 80)}...</p>
              </div>
            ))}
            {(recsQ.data ?? []).length === 0 && <EmptyState icon={<Zap className="w-6 h-6" />} title="No recommendations" />}
          </div>
        </Card>
      </div>

      {/* Attack paths + failed users */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Active Attack Paths" subtitle="Generated from digital twin" action={<Link to="/attack-graph" className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>} />
          <div className="divide-y divide-slate-800 max-h-64 overflow-y-auto">
            {(pathsQ.data ?? []).slice(0, 5).map((p) => {
              const nodes = p.path_nodes as { id: string; type: string }[];
              return (
                <div key={p.id} className="px-4 py-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-200">{nodes.map((n) => n.id).join(' -> ')}</p>
                    <Badge className={severityColor(p.path_risk >= 81 ? 'critical' : p.path_risk >= 61 ? 'high' : 'medium')}>Risk: {p.path_risk}</Badge>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">Likelihood: {(p.likelihood * 100).toFixed(0)}% - {p.estimated_impact}</p>
                </div>
              );
            })}
            {(pathsQ.data ?? []).length === 0 && <EmptyState icon={<AlertTriangle className="w-6 h-6" />} title="No attack paths generated" />}
          </div>
        </Card>

        <Card>
          <CardHeader title="Top Failed Login Users" subtitle="Potential brute-force targets" />
          <div className="p-4 h-64">
            {topFailedUsers.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topFailedUsers}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="user" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={<AlertTriangle className="w-6 h-6" />} title="No failed logins" />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
