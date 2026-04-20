import React, { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  LayoutDashboard,
  LogOut,
  Settings,
  Menu,
  X,
  Bell,
  MonitorSmartphone,
} from "lucide-react";
import { useAuth } from "../contexts/useAuth";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { Spinner } from "../components/ui/Spinner";

export const DashboardLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate("/login");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="app-layout">
      <div className="mobile-header">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontWeight: 700,
            fontSize: "1.2rem",
            color: "var(--primary)",
          }}
        >
          <Activity size={24} />
          <span>MonitorSaaS</span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          style={{ background: "transparent", border: "none", color: "var(--text-primary)" }}
        >
          {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {isMobileMenuOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            zIndex: 95,
          }}
          onClick={closeMobileMenu}
        />
      )}

      <aside className={`sidebar ${isMobileMenuOpen ? "open" : ""}`}>
        <div className="sidebar-logo">
          <Activity size={28} color="var(--primary)" />
          <span>MonitorSaaS</span>
        </div>

        <div className="sidebar-utility-row">
          <div className="sidebar-chip">
            <MonitorSmartphone size={14} />
            Responsive ready
          </div>
          <ThemeToggle />
        </div>

        <nav className="sidebar-nav">
          <Link
            to="/"
            className={`sidebar-link ${location.pathname === "/" ? "active" : ""}`}
            onClick={closeMobileMenu}
          >
            <LayoutDashboard size={20} />
            Dashboard
          </Link>
          <Link
            to="/endpoints"
            className={`sidebar-link ${location.pathname === "/endpoints" ? "active" : ""}`}
            onClick={closeMobileMenu}
          >
            <Activity size={20} />
            Endpoints
          </Link>
          <Link
            to="/settings"
            className={`sidebar-link ${location.pathname === "/settings" ? "active" : ""}`}
            onClick={closeMobileMenu}
          >
            <Settings size={20} />
            Settings
          </Link>
        </nav>

        <div style={{ marginTop: "auto", padding: "0 16px" }}>
          <div className="sidebar-chip" style={{ marginBottom: "12px" }}>
            <Bell size={14} />
            Live alerts enabled
          </div>
          <button
            onClick={() => void handleLogout()}
            className="sidebar-link"
            aria-label="Log out of your account"
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
            }}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? <Spinner size="sm" /> : <LogOut size={20} />}
            {isLoggingOut ? "Signing out..." : "Logout"}
          </button>
        </div>
      </aside>

      <main className="main-content">
        <div className="page-toolbar">
          <ThemeToggle />
        </div>
        <Outlet />
      </main>
    </div>
  );
};
