import { type ReactNode, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Activity, Bell, ShieldAlert, FolderKanban, Server,
  Bug, Network, GitBranch, FlaskConical, TrendingUp, Lightbulb,
  FileText, BookOpen, Plug, Users, ScrollText, Settings, ChevronLeft,
  ChevronRight, LogOut, Search, Menu, X, ShieldCheck, Globe,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOrg } from '../context/OrgContext';
import { cn } from '../lib/utils';
import { Badge } from './ui';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/logs', label: 'Live Logs', icon: Activity },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/incidents', label: 'Incidents', icon: ShieldAlert },
  { to: '/organizations', label: 'Organizations', icon: FolderKanban },
  { to: '/assets', label: 'Assets', icon: Server },
  { to: '/vulnerabilities', label: 'Vulnerabilities', icon: Bug },
  { to: '/digital-twin', label: 'Digital Twin', icon: Network },
  { to: '/attack-graph', label: 'Attack Graph', icon: GitBranch },
  { to: '/simulations', label: 'Simulations', icon: FlaskConical },
  { to: '/risk', label: 'Risk Predictions', icon: TrendingUp },
  { to: '/recommendations', label: 'Recommendations', icon: Lightbulb },
  { to: '/mitre', label: 'MITRE ATT&CK', icon: BookOpen },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/rules', label: 'Detection Rules', icon: ShieldCheck },
  { to: '/integrations', label: 'Integrations', icon: Plug },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/audit', label: 'Audit Logs', icon: ScrollText },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Layout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { profile, signOut } = useAuth();
  const { currentOrg, orgs, setCurrentOrg, dataFilter, setDataFilter } = useOrg();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col bg-slate-900 border-r border-slate-800 transition-all duration-200',
          collapsed ? 'w-16' : 'w-60',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex items-center justify-between h-14 px-3 border-b border-slate-800 shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                <ShieldCheck className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-100 leading-tight">Digital Twin SOC</p>
                <p className="text-[10px] text-slate-500 leading-tight">Predictive Threat Prevention</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex text-slate-400 hover:text-slate-200 p-1"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          <button onClick={() => setMobileOpen(false)} className="lg:hidden text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 mx-2 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50',
                  collapsed && 'justify-center'
                )
              }
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {!collapsed && (
          <div className="px-3 py-3 border-t border-slate-800 shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-xs font-bold text-cyan-300">
                {profile?.email?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-200 truncate">{profile?.full_name ?? profile?.email}</p>
                <p className="text-[10px] text-slate-500 capitalize">{profile?.role}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-red-400 w-full"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        )}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main */}
      <div className={cn('flex-1 flex flex-col min-w-0', collapsed ? 'lg:ml-16' : 'lg:ml-60')}>
        {/* Topbar */}
        <header className="h-14 border-b border-slate-800 bg-slate-900/80 backdrop-blur flex items-center justify-between px-4 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden text-slate-400">
              <Menu className="w-5 h-5" />
            </button>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                placeholder="Search..."
                className="bg-slate-800/50 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-200 w-48 md:w-64 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Org selector */}
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-slate-500" />
              <select
                value={currentOrg?.id ?? ''}
                onChange={(e) => {
                  const org = orgs.find((o) => o.id === e.target.value);
                  if (org) setCurrentOrg(org);
                }}
                className="bg-slate-800/50 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
              >
                {orgs.length === 0 && <option value="">No org</option>}
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Data filter */}
            <div className="flex items-center gap-1 bg-slate-800/50 border border-slate-700 rounded-lg p-0.5">
              {(['all', 'live', 'simulated'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setDataFilter(f)}
                  className={cn(
                    'px-2 py-1 text-xs rounded capitalize transition-colors',
                    dataFilter === f ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                  )}
                >
                  {f}
                </button>
              ))}
            </div>

            {currentOrg?.is_simulated && (
              <Badge className="text-amber-400 bg-amber-500/10 border-amber-500/30">SIMULATED DATA</Badge>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
