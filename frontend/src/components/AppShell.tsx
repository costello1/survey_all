import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clearAuthToken } from '../utils/auth';

export default function AppShell() {
  const navigate = useNavigate();

  function handleLogout() {
    clearAuthToken();
    navigate('/admin/login');
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <p className="eyebrow">Pulse Survey Studio</p>
          <h1 className="sidebar-title">Admin Console</h1>
        </div>

        <nav className="sidebar-nav">
          <NavLink className="sidebar-link" to="/admin" end>
            Dashboard
          </NavLink>
          <NavLink className="sidebar-link" to="/admin/surveys/new">
            New Survey
          </NavLink>
        </nav>

        <button className="ghost-button sidebar-logout" onClick={handleLogout} type="button">
          Log Out
        </button>
      </aside>

      <main className="app-main">
        <div className="app-main-inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
