import React, { useState, useEffect } from "react";
import axios from "axios";
import api from "../services/api";
import { Plus, Clock, DatabaseZap, Trash2 } from "lucide-react";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { Spinner } from "../components/ui/Spinner";
import { emitToast } from "../lib/app-events";
import type { Endpoint } from "../types/monitoring";
import { getMonitoringStatus, getRelativeTimestamp } from "../utils/monitoring";
import { StatusBadge } from "../components/ui/StatusBadge";

const EndpointsSkeleton = () => (
  <div style={{ display: "grid", gap: "16px" }}>
    {Array.from({ length: 3 }).map((_, index) => (
      <div key={index} className="card">
        <Skeleton className="skeleton-title" />
        <Skeleton className="skeleton-subtitle" />
        <Skeleton className="skeleton-subtitle" />
      </div>
    ))}
  </div>
);

export const Endpoints: React.FC = () => {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [interval, setInterval] = useState(60);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchEndpoints = async () => {
    try {
      const response = await api.get("/endpoints");
      setEndpoints(response.data.endpoints);
    } catch (err) {
      console.error("Failed to fetch endpoints", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    void api
      .get("/endpoints")
      .then((response) => {
        if (mounted) {
          setEndpoints(response.data.endpoints);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch endpoints", err);
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await api.post("/endpoints", { name, url, interval: Number(interval) });
      setIsModalOpen(false);
      setName("");
      setUrl("");
      setInterval(60);
      await fetchEndpoints();
      emitToast({
        kind: "success",
        title: "Endpoint created",
        description: "Monitoring is live and the first checks are on the way.",
      });
    } catch (err) {
      if (axios.isAxiosError<{ error?: string }>(err)) {
        setError(err.response?.data?.error || "Failed to create endpoint");
      } else {
        setError("Failed to create endpoint");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this endpoint?")) return;
    setDeletingId(id);

    try {
      await api.delete(`/endpoints/${id}`);
      await fetchEndpoints();
      emitToast({
        kind: "success",
        title: "Endpoint removed",
        description: "The monitor has been removed from your workspace.",
      });
    } catch (err) {
      console.error("Failed to delete endpoint", err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Monitored Endpoints</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: "4px" }}>
            Manage your checks, intervals and health snapshots without losing context.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> New Endpoint
        </button>
      </div>

      {loading ? (
        <EndpointsSkeleton />
      ) : endpoints.length === 0 ? (
        <EmptyState
          title="No endpoints in this workspace"
          description="Create a monitor to unlock real-time charts, error history and anomaly insights."
          action={
            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
              <Plus size={16} /> Add your first endpoint
            </button>
          }
          illustration={
            <svg width="130" height="92" viewBox="0 0 130 92" fill="none">
              <rect x="8" y="10" width="114" height="72" rx="18" fill="var(--empty-illustration-bg)" />
              <path
                d="M34 54h18l8-20 11 28 13-16 12 8"
                stroke="var(--primary)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
        />
      ) : (
        <div style={{ display: "grid", gap: "16px" }}>
          {endpoints.map((ep) => (
            <div key={ep.id} className="card flex-between" style={{ padding: "20px" }}>
              <div>
                <h3
                  style={{
                    fontSize: "1.1rem",
                    marginBottom: "4px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  {ep.name}
                  <StatusBadge status={getMonitoringStatus(ep.results[0])} />
                </h3>
                <p
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: "0.9rem",
                    marginBottom: "12px",
                  }}
                >
                  {ep.url}
                </p>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "16px",
                    fontSize: "0.85rem",
                    color: "var(--text-muted)",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <Clock size={14} /> Interval: {ep.interval}s
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <DatabaseZap size={14} /> Last check: {getRelativeTimestamp(ep.results[0]?.createdAt || null)}
                  </span>
                </div>
              </div>
              <div>
                <button
                  className="btn btn-outline"
                  style={{
                    color: "var(--danger)",
                    borderColor: "var(--border-color)",
                    padding: "8px",
                  }}
                  onClick={() => void handleDelete(ep.id)}
                  title="Delete Endpoint"
                  aria-label={`Delete endpoint ${ep.name}`}
                  disabled={deletingId === ep.id}
                >
                  {deletingId === ep.id ? <Spinner size="sm" /> : <Trash2 size={18} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div className="card animate-fade-in" style={{ width: "100%", maxWidth: "500px", margin: "20px" }}>
            <h2 style={{ marginBottom: "24px" }}>Add New Endpoint</h2>

            {error && (
              <div
                className="badge badge-error"
                style={{ width: "100%", padding: "12px", marginBottom: "20px" }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">API Name</label>
                <input
                  className="form-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Production Payment API"
                  required
                  maxLength={100}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Target URL</label>
                <input
                  className="form-input"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://api.example.com/health"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Check Interval (seconds)</label>
                <input
                  className="form-input"
                  type="number"
                  min="60"
                  max="86400"
                  value={interval}
                  onChange={(e) => setInterval(Number(e.target.value))}
                  required
                />
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "32px" }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ flex: 1 }}
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isSubmitting}>
                  {isSubmitting ? <Spinner size="sm" /> : null}
                  {isSubmitting ? "Saving..." : "Save Endpoint"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
