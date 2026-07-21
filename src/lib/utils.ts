import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatTimestamp(ts: string | null): string {
  if (!ts) return 'Not available';
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatRelative(ts: string | null): string {
  if (!ts) return 'Not available';
  const diff = Date.now() - new Date(ts).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ipOrNa(ip: string | null | undefined): string {
  if (!ip || ip.trim() === '') return 'Not available';
  if (ip === '127.0.0.1' || ip === '::1') return `${ip} (local)`;
  return ip;
}

export function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'text-red-400 bg-red-500/10 border-red-500/30';
    case 'high': return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
    case 'medium': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
    case 'low': return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
    default: return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
  }
}

export function riskLevelColor(level: string): string {
  switch (level) {
    case 'critical': return 'text-red-400 bg-red-500/15 border-red-500/40';
    case 'high': return 'text-orange-400 bg-orange-500/15 border-orange-500/40';
    case 'medium': return 'text-yellow-400 bg-yellow-500/15 border-yellow-500/40';
    case 'low': return 'text-blue-400 bg-blue-500/15 border-blue-500/40';
    default: return 'text-slate-400 bg-slate-500/15 border-slate-500/40';
  }
}

export function riskScoreColor(score: number): string {
  if (score >= 81) return 'text-red-400';
  if (score >= 61) return 'text-orange-400';
  if (score >= 41) return 'text-yellow-400';
  if (score >= 21) return 'text-blue-400';
  return 'text-slate-400';
}

export function riskLevelFromScore(score: number): string {
  if (score >= 81) return 'critical';
  if (score >= 61) return 'high';
  if (score >= 41) return 'medium';
  if (score >= 21) return 'low';
  return 'informational';
}

export function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (['new', 'open'].includes(s)) return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
  if (['investigating', 'triaged', 'in_progress'].includes(s)) return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
  if (['contained', 'eradicated'].includes(s)) return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
  if (['resolved', 'recovered', 'closed', 'completed'].includes(s)) return 'text-green-400 bg-green-500/10 border-green-500/30';
  if (['false_positive', 'dismissed'].includes(s)) return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
  return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
}

export function exportCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      headers.map((h) => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
        return `"${str.replace(/"/g, '""')}"`;
      }).join(',')
    ),
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadText(filename: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
