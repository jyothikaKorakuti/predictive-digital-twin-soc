import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { Organization } from '../types';

interface OrgContextValue {
  currentOrg: Organization | null;
  orgs: Organization[];
  loading: boolean;
  setOrgs: (orgs: Organization[]) => void;
  setCurrentOrg: (org: Organization | null) => void;
  dataFilter: 'all' | 'live' | 'simulated';
  setDataFilter: (f: 'all' | 'live' | 'simulated') => void;
}

const OrgContext = createContext<OrgContextValue | undefined>(undefined);

export function OrgProvider({ children }: { children: ReactNode }) {
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataFilter, setDataFilter] = useState<'all' | 'live' | 'simulated'>('all');

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from('organizations').select('*').order('created_at');
      if (error) { console.error('Failed to load orgs:', error.message); setLoading(false); return; }
      const orgList = data as Organization[];
      setOrgs(orgList);
      if (orgList.length > 0 && !currentOrg) setCurrentOrg(orgList[0]);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <OrgContext.Provider value={{ currentOrg, orgs, loading, setOrgs, setCurrentOrg, dataFilter, setDataFilter }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrg must be used within OrgProvider');
  return ctx;
}
