import React from "react";
import { useAuth } from "../contexts/useAuth";
import { User, Shield, CreditCard, Bell } from "lucide-react";
import { ThemeToggle } from "../components/ui/ThemeToggle";

export const Settings: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="animate-fade-in" style={{ maxWidth: "800px" }}>
      <div className="page-header">
        <h1 className="page-title">Account Settings</h1>
        <p style={{ color: "var(--text-secondary)", marginTop: "4px" }}>
          Manage account preferences, presentation and alert expectations.
        </p>
      </div>

      <div style={{ display: "grid", gap: "24px" }}>
        <div className="card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "24px",
              borderBottom: "1px solid var(--border-color)",
              paddingBottom: "16px",
            }}
          >
            <User size={24} color="var(--primary)" />
            <h2 style={{ fontSize: "1.25rem" }}>Profile Information</h2>
          </div>

          <div className="form-group" style={{ maxWidth: "400px" }}>
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              value={user?.email || ""}
              disabled
              style={{ opacity: 0.7, cursor: "not-allowed" }}
            />
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "8px" }}>
              Your email cannot be changed. Contact support if you need assistance.
            </p>
          </div>
        </div>

        <div className="card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "24px",
              borderBottom: "1px solid var(--border-color)",
              paddingBottom: "16px",
            }}
          >
            <CreditCard size={24} color="var(--primary)" />
            <h2 style={{ fontSize: "1.25rem" }}>Subscription Plan</h2>
          </div>

          <div
            className="flex-between"
            style={{
              backgroundColor: "var(--bg-base)",
              padding: "20px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-color)",
            }}
          >
            <div>
              <h3 style={{ marginBottom: "4px" }}>
                Hobby Tier <span className="badge badge-success" style={{ marginLeft: "8px" }}>Active</span>
              </h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                Up to 10 monitored endpoints
              </p>
            </div>
            <button className="btn btn-primary">Upgrade Plan</button>
          </div>
        </div>

        <div className="card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "24px",
              borderBottom: "1px solid var(--border-color)",
              paddingBottom: "16px",
            }}
          >
            <Shield size={24} color="var(--primary)" />
            <h2 style={{ fontSize: "1.25rem" }}>Security</h2>
          </div>

          <p style={{ color: "var(--text-secondary)", marginBottom: "16px" }}>
            Ensure your account is using a long, random password to stay secure.
          </p>
          <button className="btn btn-outline">Update Password</button>
        </div>

        <div className="card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "24px",
              borderBottom: "1px solid var(--border-color)",
              paddingBottom: "16px",
            }}
          >
            <Bell size={24} color="var(--primary)" />
            <h2 style={{ fontSize: "1.25rem" }}>Alert Preferences</h2>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0" }}>
            <div>
              <div style={{ fontWeight: 500, marginBottom: "4px" }}>Email Notifications</div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                Receive alerts when an API goes down
              </div>
            </div>
            <div
              style={{
                width: "44px",
                height: "24px",
                backgroundColor: "var(--primary)",
                borderRadius: "12px",
                position: "relative",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  backgroundColor: "white",
                  borderRadius: "50%",
                  position: "absolute",
                  right: "2px",
                  top: "2px",
                }}
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "24px",
              borderBottom: "1px solid var(--border-color)",
              paddingBottom: "16px",
            }}
          >
            <Shield size={24} color="var(--primary)" />
            <h2 style={{ fontSize: "1.25rem" }}>Appearance & Accessibility</h2>
          </div>
          <div className="flex-between mobile-row">
            <div>
              <h3 style={{ marginBottom: "4px" }}>Theme preference</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                Persist your preferred color mode across sessions.
              </p>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </div>
  );
};
