import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OrgProvider } from './context/OrgContext';
import { QueryProvider } from './context/QueryProvider';
import { ToastProvider } from './context/ToastContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { LiveLogs } from './pages/LiveLogs';
import { Alerts } from './pages/Alerts';
import { Incidents } from './pages/Incidents';
import { Organizations } from './pages/Organizations';
import { Assets } from './pages/Assets';
import { Vulnerabilities } from './pages/Vulnerabilities';
import { DigitalTwin } from './pages/DigitalTwin';
import { AttackGraph } from './pages/AttackGraph';
import { Simulations } from './pages/Simulations';
import { RiskPredictions } from './pages/RiskPredictions';
import { Recommendations } from './pages/Recommendations';
import { Mitre } from './pages/Mitre';
import { Reports } from './pages/Reports';
import { DetectionRules } from './pages/DetectionRules';
import { Integrations } from './pages/Integrations';
import { Users } from './pages/Users';
import { AuditLogs } from './pages/AuditLogs';
import { Settings } from './pages/Settings';
import { Loader2 } from 'lucide-react';
import type { JSX } from 'react';

function Protected({ children }: { children: JSX.Element }) {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  return <OrgProvider>{children}</OrgProvider>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <Protected>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/logs" element={<LiveLogs />} />
                <Route path="/alerts" element={<Alerts />} />
                <Route path="/incidents" element={<Incidents />} />
                <Route path="/organizations" element={<Organizations />} />
                <Route path="/assets" element={<Assets />} />
                <Route path="/vulnerabilities" element={<Vulnerabilities />} />
                <Route path="/digital-twin" element={<DigitalTwin />} />
                <Route path="/attack-graph" element={<AttackGraph />} />
                <Route path="/simulations" element={<Simulations />} />
                <Route path="/risk" element={<RiskPredictions />} />
                <Route path="/recommendations" element={<Recommendations />} />
                <Route path="/mitre" element={<Mitre />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/rules" element={<DetectionRules />} />
                <Route path="/integrations" element={<Integrations />} />
                <Route path="/users" element={<Users />} />
                <Route path="/audit" element={<AuditLogs />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </Layout>
          </Protected>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <QueryProvider>
        <AuthProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </AuthProvider>
      </QueryProvider>
    </BrowserRouter>
  );
}
