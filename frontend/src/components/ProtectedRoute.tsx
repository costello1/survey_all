import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getAdminMe } from '../utils/api';
import { clearAuthToken, getAuthToken } from '../utils/auth';

export default function ProtectedRoute() {
  const location = useLocation();
  const [status, setStatus] = useState<'checking' | 'ready' | 'unauthorized'>(
    getAuthToken() ? 'checking' : 'unauthorized',
  );

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setStatus('unauthorized');
      return;
    }

    let active = true;
    getAdminMe()
      .then(() => {
        if (active) {
          setStatus('ready');
        }
      })
      .catch(() => {
        clearAuthToken();
        if (active) {
          setStatus('unauthorized');
        }
      });

    return () => {
      active = false;
    };
  }, [location.pathname]);

  if (status === 'checking') {
    return (
      <main className="fullscreen-panel">
        <div className="glass-card centered-card">
          <p className="eyebrow">Checking session</p>
          <h1>Opening the admin workspace...</h1>
        </div>
      </main>
    );
  }

  if (status === 'unauthorized') {
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet />;
}
