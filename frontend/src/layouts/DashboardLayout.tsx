import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Activity, LayoutDashboard, LogOut, Settings, Menu, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const DashboardLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="app-layout">
      {/* Mobile Header */}
      <div className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '1.2rem', color: 'var(--primary)' }}>
          <Activity size={24} />
          <span>MonitorSaaS</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
          style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)' }}
        >
          {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Overlay for mobile sidebar */}
      {isMobileMenuOpen && (
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 95 }}
          onClick={closeMobileMenu}
        />
      )}

      <aside className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <Activity size={28} color="var(--primary)" />
          <span>MonitorSaaS</span>
        </div>
        
        <nav className="sidebar-nav">
          <Link 
            to="/" 
            className={`sidebar-link ${location.pathname === '/' ? 'active' : ''}`}
            onClick={closeMobileMenu}
          >
            <LayoutDashboard size={20} />
            Dashboard
          </Link>
          <Link 
            to="/endpoints" 
            className={`sidebar-link ${location.pathname === '/endpoints' ? 'active' : ''}`}
            onClick={closeMobileMenu}
          >
            <Activity size={20} />
            Endpoints
          </Link>
          <Link 
            to="/settings" 
            className={`sidebar-link ${location.pathname === '/settings' ? 'active' : ''}`}
            onClick={closeMobileMenu}
          >
            <Settings size={20} />
            Settings
          </Link>
        </nav>

        <div style={{ marginTop: 'auto', padding: '0 16px' }}>
          <button 
            onClick={handleLogout}
            className="sidebar-link" 
            style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>
      
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};
