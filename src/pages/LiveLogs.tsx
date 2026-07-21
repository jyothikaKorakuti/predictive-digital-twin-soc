import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import {
  Activity, Pause, Play, Search, Download, ChevronDown, ChevronRight,
  Wifi, WifiOff, Filter, X, Terminal, Copy, Check,
} from 'lucide-react';
import { useEvents } from '../hooks/useData';
import { useOrg } from '../context/OrgContext';
import { supabase } from '../lib/supabase';
import { Card, Badge, Button, EmptyState, LoadingState, ErrorState } from '../components/ui';
import { severityColor, formatTimestamp, ipOrNa, exportCsv } from '../lib/utils';
import type { Event } from '../types';

const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];

export function LiveLogs() {
  const { currentOrg } = useOrg();
  const [streaming, setStreaming] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [hostFilter, setHostFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('');
  const [ipFilter, setIpFilter] = useState('');
  const [simFilter, setSimFilter] = useState('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [totalIngested, setTotalIngested] = useState(0);
  const [eventsPerSec, setEventsPerSec] = useState(0);
  const [parserErrors] = useState(0);
  const [droppedEvents] = useState(0);
  const [showConsole, setShowConsole] = useState(false);
  const [consoleInput, setConsoleInput] = useState('');
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const eventsQ = useEvents(200);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevIdsRef = useRef<Set<string>>(new Set());
  const pollCountRef = useRef(0);

  const orgId = currentOrg?.id;

  // Polling for real-time updates
  useEffect(() => {
    if (!streaming) return;
    const interval = setInterval(() => {
      eventsQ.refetch();
      pollCountRef.current++;
    }, 3000);
    return () => clearInterval(interval);
  }, [streaming, eventsQ]);

  // Fetch total ingested count once on mount and when org changes
  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const { count } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId);
      if (count !== null) setTotalIngested(count);
    })();
  }, [orgId]);

  // Calculate events/sec from new event IDs between polls
  useEffect(() => {
    const data = eventsQ.data ?? [];
    const currentIds = new Set(data.map((e) => e.id));
    const prevIds = prevIdsRef.current;

    if (prevIds.size > 0) {
      let newCount = 0;
      for (const id of currentIds) {
        if (!prevIds.has(id)) newCount++;
      }
      if (newCount > 0) {
        setEventsPerSec(newCount / 3);
        setTotalIngested((prev) => prev + newCount);
      } else if (pollCountRef.current > 0) {
        setEventsPerSec(0);
      }
    }
    prevIdsRef.current = currentIds;
  }, [eventsQ.data]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [eventsQ.data, autoScroll]);

  const filtered = useCallback((events: Event[]) => {
    return events.filter((e) => {
      if (search && !e.message?.toLowerCase().includes(search.toLowerCase()) && !e.raw_log?.toLowerCase().includes(search.toLowerCase())) return false;
      if (severityFilter !== 'all' && e.severity !== severityFilter) return false;
      if (hostFilter !== 'all' && e.hostname !== hostFilter) return false;
      if (userFilter && e.username !== userFilter) return false;
      if (ipFilter && e.src_ip !== ipFilter && e.dst_ip !== ipFilter) return false;
      if (simFilter === 'live' && e.is_simulated) return false;
      if (simFilter === 'simulated' && !e.is_simulated) return false;
      return true;
    });
  }, [search, severityFilter, hostFilter, userFilter, ipFilter, simFilter]);

  const events = filtered(eventsQ.data ?? []);
  const hosts = Array.from(new Set((eventsQ.data ?? []).map((e) => e.hostname).filter(Boolean))) as string[];

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function resetFilters() {
    setSearch('');
    setSeverityFilter('all');
    setHostFilter('all');
    setUserFilter('');
    setIpFilter('');
    setSimFilter('all');
  }

  function handleExport() {
    const rows = events.map((e) => ({
      timestamp: e.event_timestamp,
      severity: e.severity,
      event_id: e.event_id ?? '',
      record_id: e.record_id ?? '',
      provider: e.provider ?? '',
      channel: e.channel ?? '',
      hostname: e.hostname,
      src_ip: e.src_ip,
      dst_ip: e.dst_ip,
      username: e.username,
      action: e.event_action,
      process: e.process_name,
      message: e.message,
      mitre_tactic: e.mitre_tactic,
      mitre_technique: e.mitre_technique,
      is_simulated: e.is_simulated,
    }));
    exportCsv(`events-${Date.now()}.csv`, rows);
  }

  function runConsoleCommand() {
    const cmd = consoleInput.trim();
    if (!cmd) return;
    const output = [`> ${cmd}`];

    if (cmd.startsWith('help')) {
      output.push('Commands: help, count, severity <level>, host <name>, clear, export');
    } else if (cmd.startsWith('count')) {
      output.push(`Total events loaded: ${events.length} / ${(eventsQ.data ?? []).length} fetched`);
    } else if (cmd.startsWith('severity ')) {
      const level = cmd.split(' ')[1];
      if (SEVERITIES.includes(level)) {
        const count = events.filter((e) => e.severity === level).length;
        output.push(`${count} events at severity '${level}'`);
      } else {
        output.push(`Invalid severity. Valid: ${SEVERITIES.join(', ')}`);
      }
    } else if (cmd.startsWith('host ')) {
      const host = cmd.split(' ').slice(1).join(' ');
      const count = events.filter((e) => e.hostname === host).length;
      output.push(`${count} events from host '${host}'`);
    } else if (cmd === 'clear') {
      setConsoleOutput([]);
      setConsoleInput('');
      return;
    } else if (cmd === 'export') {
      handleExport();
      output.push('Export triggered.');
    } else {
      output.push(`Unknown command: ${cmd}. Type 'help' for available commands.`);
    }

    setConsoleOutput((prev) => [...prev, ...output]);
    setConsoleInput('');
  }

  async function copyToClipboard(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  }

  if (!currentOrg) return <EmptyState icon={<Activity className="w-8 h-8" />} title="No organization selected" />;
  if (eventsQ.isLoading) return <LoadingState />;
  if (eventsQ.error) return <ErrorState message={eventsQ.error.message} onRetry={() => eventsQ.refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Live Logs</h1>
          <p className="text-xs text-slate-500">Real-time security event stream - {currentOrg.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs">
            {streaming ? <Wifi className="w-4 h-4 text-green-400" /> : <WifiOff className="w-4 h-4 text-slate-500" />}
            <span className={streaming ? 'text-green-400' : 'text-slate-500'}>{streaming ? 'Connected' : 'Paused'}</span>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setShowConsole(!showConsole)}>
            <Terminal className="w-3.5 h-3.5" /> Console
          </Button>
          <Button size="sm" variant={streaming ? 'danger' : 'primary'} onClick={() => setStreaming(!streaming)}>
            {streaming ? <><Pause className="w-3.5 h-3.5" /> Pause</> : <><Play className="w-3.5 h-3.5" /> Start</>}
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="w-3.5 h-3.5" /> Export
          </Button>
        </div>
      </div>

      {/* Metrics bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <p className="text-[10px] text-slate-500">Events/sec</p>
          <p className="text-lg font-bold text-cyan-400">{eventsPerSec.toFixed(1)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[10px] text-slate-500">Total ingested</p>
          <p className="text-lg font-bold text-blue-400">{totalIngested.toLocaleString()}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[10px] text-slate-500">Parser errors</p>
          <p className="text-lg font-bold text-yellow-400">{parserErrors}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[10px] text-slate-500">Dropped events</p>
          <p className="text-lg font-bold text-red-400">{droppedEvents}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              placeholder="Search events..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
            />
          </div>
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="bg-slate-800/50 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200">
            <option value="all">All severities</option>
            {SEVERITIES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <select value={hostFilter} onChange={(e) => setHostFilter(e.target.value)} className="bg-slate-800/50 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200">
            <option value="all">All hosts</option>
            {hosts.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
          <input placeholder="User" value={userFilter} onChange={(e) => setUserFilter(e.target.value)} className="bg-slate-800/50 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 w-24" />
          <input placeholder="IP" value={ipFilter} onChange={(e) => setIpFilter(e.target.value)} className="bg-slate-800/50 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 w-28" />
          <select value={simFilter} onChange={(e) => setSimFilter(e.target.value)} className="bg-slate-800/50 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200">
            <option value="all">All data</option>
            <option value="live">Live only</option>
            <option value="simulated">Simulated only</option>
          </select>
          <Button size="sm" variant="ghost" onClick={resetFilters}><X className="w-3.5 h-3.5" /> Reset</Button>
          <label className="flex items-center gap-1.5 text-xs text-slate-400">
            <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} className="accent-cyan-500" />
            Auto-scroll
          </label>
        </div>
      </Card>

      {/* Event table */}
      <Card>
        <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between">
          <p className="text-xs text-slate-400">{events.length} events {streaming && <span className="text-green-400">(live)</span>}</p>
          <Filter className="w-3.5 h-3.5 text-slate-500" />
        </div>
        <div ref={scrollRef} className="max-h-[55vh] overflow-y-auto">
          {events.length === 0 ? (
            <EmptyState icon={<Activity className="w-6 h-6" />} title="No events match filters" description="Adjust filters or wait for new events to arrive from the collector." />
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-900 z-10">
                <tr className="text-left text-slate-500 border-b border-slate-800">
                  <th className="px-3 py-2 font-medium w-8"></th>
                  <th className="px-3 py-2 font-medium">Timestamp</th>
                  <th className="px-3 py-2 font-medium">Sev</th>
                  <th className="px-3 py-2 font-medium">Host</th>
                  <th className="px-3 py-2 font-medium">EID</th>
                  <th className="px-3 py-2 font-medium">Source IP</th>
                  <th className="px-3 py-2 font-medium">User</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                  <th className="px-3 py-2 font-medium">Message</th>
                  <th className="px-3 py-2 font-medium">MITRE</th>
                  <th className="px-3 py-2 font-medium">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {events.map((e) => (
                  <Fragment key={e.id}>
                    <tr className="hover:bg-slate-800/30 cursor-pointer" onClick={() => toggleExpand(e.id)}>
                      <td className="px-3 py-2">
                        {expanded.has(e.id) ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
                      </td>
                      <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{formatTimestamp(e.event_timestamp)}</td>
                      <td className="px-3 py-2"><Badge className={severityColor(e.severity)}>{e.severity}</Badge></td>
                      <td className="px-3 py-2 text-slate-300">{e.hostname ?? 'N/A'}</td>
                      <td className="px-3 py-2 text-slate-300 font-mono">{e.event_id ?? '-'}</td>
                      <td className="px-3 py-2 text-slate-300 font-mono">{ipOrNa(e.src_ip)}</td>
                      <td className="px-3 py-2 text-slate-300">{e.username ?? 'N/A'}</td>
                      <td className="px-3 py-2 text-slate-300">{e.event_action ?? 'N/A'}</td>
                      <td className="px-3 py-2 text-slate-300 max-w-xs truncate">{e.message}</td>
                      <td className="px-3 py-2 text-slate-400">{e.mitre_technique ?? '-'}</td>
                      <td className="px-3 py-2">{e.is_simulated ? <Badge className="text-amber-400 bg-amber-500/10 border-amber-500/20">SIM</Badge> : <Badge className="text-green-400 bg-green-500/10 border-green-500/20">LIVE</Badge>}</td>
                    </tr>
                    {expanded.has(e.id) && (
                      <tr className="bg-slate-800/20">
                        <td colSpan={11} className="px-6 py-3">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                            <div><span className="text-slate-500">Event UUID:</span> <span className="text-slate-300 font-mono">{e.id}</span></div>
                            <div><span className="text-slate-500">Source:</span> <span className="text-slate-300">{e.source_name}</span></div>
                            <div><span className="text-slate-500">Source Type:</span> <span className="text-slate-300">{e.source_type}</span></div>
                            <div><span className="text-slate-500">Parser:</span> <span className="text-slate-300">{e.parser_name ?? 'N/A'}</span></div>
                            <div><span className="text-slate-500">Windows EID:</span> <span className="text-slate-300 font-mono">{e.event_id ?? 'N/A'}</span></div>
                            <div><span className="text-slate-500">Record ID:</span> <span className="text-slate-300 font-mono">{e.record_id ?? 'N/A'}</span></div>
                            <div><span className="text-slate-500">Provider:</span> <span className="text-slate-300">{e.provider ?? 'N/A'}</span></div>
                            <div><span className="text-slate-500">Channel:</span> <span className="text-slate-300">{e.channel ?? 'N/A'}</span></div>
                            <div><span className="text-slate-500">Log Level:</span> <span className="text-slate-300">{e.log_level ?? 'N/A'}</span></div>
                            <div><span className="text-slate-500">Dest IP:</span> <span className="text-slate-300 font-mono">{ipOrNa(e.dst_ip)}</span></div>
                            <div><span className="text-slate-500">Ports:</span> <span className="text-slate-300">{e.src_port ?? 'N/A'} {'->'} {e.dst_port ?? 'N/A'}</span></div>
                            <div><span className="text-slate-500">Process:</span> <span className="text-slate-300">{e.process_name ?? 'N/A'} (PID: {e.process_id ?? 'N/A'})</span></div>
                            <div><span className="text-slate-500">Parent Proc:</span> <span className="text-slate-300">{e.parent_process ?? 'N/A'}</span></div>
                            <div><span className="text-slate-500">File Path:</span> <span className="text-slate-300">{e.file_path ?? 'N/A'}</span></div>
                            <div><span className="text-slate-500">Confidence:</span> <span className="text-slate-300">{(Number(e.confidence) * 100).toFixed(0)}%</span></div>
                            <div><span className="text-slate-500">MITRE Tactic:</span> <span className="text-slate-300">{e.mitre_tactic ?? 'N/A'}</span></div>
                            <div><span className="text-slate-500">Correlation ID:</span> <span className="text-slate-300">{e.correlation_id ?? 'N/A'}</span></div>
                          </div>
                          {e.command_line && (
                            <div className="mt-2">
                              <p className="text-slate-500 text-xs mb-1">Command Line:</p>
                              <div className="flex items-start gap-2">
                                <code className="flex-1 bg-slate-950 border border-slate-800 rounded p-2 text-xs text-amber-300 overflow-x-auto">{e.command_line}</code>
                                <button onClick={() => copyToClipboard(e.command_line!, e.id + '-cmd')} className="text-slate-400 hover:text-cyan-400 mt-1">
                                  {copiedId === e.id + '-cmd' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>
                          )}
                          <div className="mt-2">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-slate-500 text-xs">Raw log:</p>
                              <button onClick={() => copyToClipboard(e.raw_log ?? '', e.id + '-raw')} className="text-slate-400 hover:text-cyan-400">
                                {copiedId === e.id + '-raw' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                            <pre className="bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-400 overflow-x-auto max-h-48">{e.raw_log ?? 'Not available'}</pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Console */}
      {showConsole && (
        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <p className="text-xs font-medium text-slate-200">Event Console</p>
            </div>
            <button onClick={() => setShowConsole(false)} className="text-slate-400 hover:text-slate-200"><X className="w-4 h-4" /></button>
          </div>
          <div className="bg-slate-950 p-3 max-h-48 overflow-y-auto font-mono text-xs">
            {consoleOutput.length === 0 && <p className="text-slate-600">Type 'help' for available commands.</p>}
            {consoleOutput.map((line, i) => (
              <p key={i} className={line.startsWith('>') ? 'text-cyan-400' : 'text-slate-400'}>{line}</p>
            ))}
          </div>
          <div className="flex items-center gap-2 px-3 py-2 border-t border-slate-800 bg-slate-900">
            <span className="text-cyan-400 text-xs font-mono">$</span>
            <input
              value={consoleInput}
              onChange={(e) => setConsoleInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runConsoleCommand()}
              placeholder="enter command..."
              className="flex-1 bg-transparent text-xs text-slate-100 font-mono focus:outline-none placeholder-slate-600"
            />
          </div>
        </Card>
      )}
    </div>
  );
}
