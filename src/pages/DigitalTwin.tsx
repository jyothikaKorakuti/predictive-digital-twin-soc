import { useState, useMemo } from 'react';
import { Network, RefreshCw, Search } from 'lucide-react';
import { useAssets, useAssetConnections } from '../hooks/useData';
import { useOrg } from '../context/OrgContext';
import { Card, Badge, Button, EmptyState, LoadingState, ErrorState } from '../components/ui';
import { severityColor, ipOrNa } from '../lib/utils';
import ReactFlow, { Background, Controls, type Node, type Edge } from 'reactflow';
import 'reactflow/dist/style.css';

const TYPE_COLORS: Record<string, string> = {
  workstation: '#3b82f6', laptop: '#3b82f6', server: '#06b6d4', domain_controller: '#ef4444',
  database: '#f97316', web_server: '#eab308', firewall: '#8b5cf6', router: '#10b981',
  switch: '#10b981', cloud: '#6366f1', application: '#ec4899', other: '#64748b',
};

export function DigitalTwin() {
  const { currentOrg } = useOrg();
  const assetsQ = useAssets();
  const connsQ = useAssetConnections();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const { nodes, edges } = useMemo(() => {
    const assets = assetsQ.data ?? [];
    const conns = connsQ.data ?? [];
    const filtered = assets.filter((a) => {
      if (search && !a.hostname.toLowerCase().includes(search.toLowerCase())) return false;
      if (typeFilter !== 'all' && a.asset_type !== typeFilter) return false;
      return true;
    });
    const filteredIds = new Set(filtered.map((a) => a.id));
    const nodes: Node[] = filtered.map((a) => ({
      id: a.id,
      data: { label: a.hostname },
      position: { x: Math.random() * 600, y: Math.random() * 400 },
      style: {
        background: TYPE_COLORS[a.asset_type] ?? '#64748b',
        color: '#fff',
        border: '2px solid',
        borderColor: a.criticality === 'critical' ? '#ef4444' : a.criticality === 'high' ? '#f97316' : 'transparent',
        borderRadius: '8px',
        fontSize: '11px',
        padding: '6px 10px',
      },
    }));
    const edges: Edge[] = conns.filter((c) => filteredIds.has(c.source_asset_id) && filteredIds.has(c.target_asset_id)).map((c) => ({
      id: c.id,
      source: c.source_asset_id,
      target: c.target_asset_id,
      label: c.relationship,
      animated: c.relationship === 'CAN_REACH',
      style: { stroke: '#475569', strokeWidth: 1.5 },
      labelStyle: { fontSize: 9, fill: '#64748b' },
    }));
    return { nodes, edges };
  }, [assetsQ.data, connsQ.data, search, typeFilter]);

  const selectedAsset = (assetsQ.data ?? []).find((a) => a.id === selectedNode);

  if (!currentOrg) return <EmptyState icon={<Network className="w-8 h-8" />} title="No organization selected" />;
  if (assetsQ.isLoading || connsQ.isLoading) return <LoadingState />;
  if (assetsQ.error) return <ErrorState message={assetsQ.error.message} onRetry={() => assetsQ.refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Digital Twin</h1>
          <p className="text-xs text-slate-500">{nodes.length} nodes, {edges.length} relationships - {currentOrg.name}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { assetsQ.refetch(); connsQ.refetch(); }}><RefreshCw className="w-3.5 h-3.5" /> Refresh</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3"><p className="text-[10px] text-slate-500">Total Nodes</p><p className="text-lg font-bold text-cyan-400">{nodes.length}</p></Card>
        <Card className="p-3"><p className="text-[10px] text-slate-500">Relationships</p><p className="text-lg font-bold text-blue-400">{edges.length}</p></Card>
        <Card className="p-3"><p className="text-[10px] text-slate-500">Critical Assets</p><p className="text-lg font-bold text-red-400">{(assetsQ.data ?? []).filter((a) => a.criticality === 'critical').length}</p></Card>
        <Card className="p-3"><p className="text-[10px] text-slate-500">Internet Exposed</p><p className="text-lg font-bold text-orange-400">{(assetsQ.data ?? []).filter((a) => a.internet_exposed).length}</p></Card>
      </div>

      <Card className="p-3">
        <div className="flex gap-2">
          <div className="relative flex-1"><Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" /><input placeholder="Search nodes..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-100" /></div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="bg-slate-800/50 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200"><option value="all">All types</option><option value="workstation">Workstation</option><option value="server">Server</option><option value="database">Database</option><option value="web_server">Web Server</option><option value="firewall">Firewall</option><option value="domain_controller">Domain Controller</option></select>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="lg:col-span-3 h-[500px]">
          {nodes.length === 0 ? <EmptyState icon={<Network className="w-6 h-6" />} title="No nodes to display" /> : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodeClick={(_, n) => setSelectedNode(n.id)}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#1e293b" gap={20} />
              <Controls className="bg-slate-800 border-slate-700" />
            </ReactFlow>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="text-xs font-semibold text-slate-200 mb-3">Node Details</h3>
          {selectedAsset ? (
            <div className="space-y-2 text-xs">
              <div><span className="text-slate-500">Hostname:</span> <span className="text-slate-200">{selectedAsset.hostname}</span></div>
              <div><span className="text-slate-500">IP:</span> <span className="text-slate-300 font-mono">{ipOrNa(selectedAsset.ip_address)}</span></div>
              <div><span className="text-slate-500">Type:</span> <Badge className="text-cyan-400 bg-cyan-500/10 border-cyan-500/20">{selectedAsset.asset_type}</Badge></div>
              <div><span className="text-slate-500">OS:</span> <span className="text-slate-300">{selectedAsset.os_name} {selectedAsset.os_version}</span></div>
              <div><span className="text-slate-500">Criticality:</span> <Badge className={severityColor(selectedAsset.criticality === 'critical' ? 'critical' : 'high')}>{selectedAsset.criticality}</Badge></div>
              <div><span className="text-slate-500">Exposed:</span> <span className="text-slate-300">{selectedAsset.internet_exposed ? 'Yes' : 'No'}</span></div>
              <div><span className="text-slate-500">Ports:</span> <span className="text-slate-300">{selectedAsset.open_ports.join(', ') || 'None'}</span></div>
              <div><span className="text-slate-500">Segment:</span> <span className="text-slate-300">{selectedAsset.network_segment ?? 'N/A'}</span></div>
            </div>
          ) : <p className="text-xs text-slate-600">Click a node to view details</p>}

          <div className="mt-4 pt-3 border-t border-slate-800">
            <h4 className="text-xs font-semibold text-slate-200 mb-2">Legend</h4>
            <div className="space-y-1">
              {Object.entries(TYPE_COLORS).filter(([t]) => ['workstation','server','database','web_server','firewall','domain_controller'].includes(t)).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2 text-xs"><div className="w-3 h-3 rounded" style={{ background: color }} /><span className="text-slate-400 capitalize">{type}</span></div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
