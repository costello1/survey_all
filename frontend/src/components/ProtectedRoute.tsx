import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { firebaseAuth } from '../firebase';

export default function ProtectedRoute() {
  const location = useLocation();
  const [status, setStatus] = useState<'checking' | 'ready' | 'unauthorized'>('checking');

  useEffect(() => {
    setStatus('checking');
    return onAuthStateChanged(firebaseAuth, (user) => {
      setStatus(user ? 'ready' : 'unauthorized');
    });
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
