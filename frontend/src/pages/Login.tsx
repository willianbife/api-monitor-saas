import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { Activity } from "lucide-react";
import api, { initializeCsrf } from "../services/api";
import { useAuth } from "../contexts/useAuth";
import { Spinner } from "../components/ui/Spinner";
import { emitToast } from "../lib/app-events";

export const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await initializeCsrf();
      const response = await api.post("/auth/login", { email, password });
      login(response.data.user);
      emitToast({
        kind: "success",
        title: "Welcome back",
        description: "You are signed in and monitoring is live.",
      });
      navigate("/");
    } catch (err) {
      if (axios.isAxiosError<{ error?: string }>(err)) {
        setError(err.response?.data?.error || "Failed to login");
      } else {
        setError("Failed to login");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-layout" style={{ alignItems: "center", justifyContent: "center" }}>
      <div className="card animate-fade-in" style={{ width: "100%", maxWidth: "400px" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: "32px",
          }}
        >
          <Activity size={48} color="var(--primary)" style={{ marginBottom: "16px" }} />
          <h1 className="page-title">Welcome Back</h1>
          <p style={{ color: "var(--text-secondary)" }}>Sign in to your dashboard</p>
        </div>

        {error && (
          <div
            className="badge badge-error"
            style={{
              width: "100%",
              padding: "12px",
              marginBottom: "20px",
              borderRadius: "var(--radius-sm)",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Password"
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", padding: "12px" }}
            disabled={loading}
          >
            {loading ? <Spinner size="sm" /> : null}
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p
          style={{
            marginTop: "24px",
            textAlign: "center",
            color: "var(--text-secondary)",
            fontSize: "0.9rem",
          }}
        >
          Don't have an account? <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
};
