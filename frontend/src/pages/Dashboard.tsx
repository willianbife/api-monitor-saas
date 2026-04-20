import React, { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, AlertTriangle, Clock3, Gauge, RefreshCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { useAuth } from "../contexts/useAuth";
import api from "../services/api";
import { EmptyState } from "../components/ui/EmptyState";
import { StatusBadge } from "../components/ui/StatusBadge";
import { DashboardSkeleton } from "../components/dashboard/DashboardSkeleton";
import type { Endpoint, CheckResult } from "../types/monitoring";
import {
  getAllResults,
  getAverageLatency24h,
  getLastFailure,
  getLatencySeries,
  getMonitoringStatus,
  getRelativeTimestamp,
  getUptimeSeries,
} from "../utils/monitoring";

type HistoryFilter = "all" | "failures" | "anomalies";
type EndpointUpdate = CheckResult;

interface MonitoringStatus {
  enabled: boolean;
  available: boolean;
  reason?: string | null;
}

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [historyPage, setHistoryPage] = useState(1);
  const [monitoringStatus, setMonitoringStatus] = useState<MonitoringStatus | null>(null);
  const pageSize = 6;

  const fetchEndpoints = async (showRefreshState = false) => {
    if (showRefreshState) {
      setIsRefreshing(true);
    }

    try {
      const response = await api.get("/endpoints");
      setEndpoints(response.data.endpoints);
      setMonitoringStatus(response.data.monitoring ?? null);
    } catch (err) {
      console.error("Failed to fetch endpoints", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    void api
      .get("/endpoints")
      .then((response) => {
        if (!mounted) return;
        setEndpoints(response.data.endpoints);
        setMonitoringStatus(response.data.monitoring ?? null);
      })
      .catch((err) => {
        console.error("Failed to fetch endpoints", err);
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    const socketUrl = import.meta.env.VITE_API_URL.replace(/\/api$/, "");
    const newSocket = io(socketUrl);
    socketRef.current = newSocket;

    return () => {
      mounted = false;
      socketRef.current = null;
      newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void fetchEndpoints();
    }, 20000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || endpoints.length === 0) return;

    endpoints.forEach((endpoint) => {
      socket.on(`endpoint_update_${endpoint.id}`, (result: EndpointUpdate) => {
        setEndpoints((current) =>
          current.map((item) =>
            item.id === endpoint.id
              ? { ...item, results: [result, ...item.results].slice(0, 20) }
              : item
          )
        );
      });
    });

    return () => {
      endpoints.forEach((endpoint) => {
        socket.off(`endpoint_update_${endpoint.id}`);
      });
    };
  }, [endpoints]);

  const latestResults = useMemo(() => getAllResults(endpoints), [endpoints]);
  const primaryEndpoint = endpoints[0] || null;
  const primaryResults = useMemo(() => primaryEndpoint?.results ?? [], [primaryEndpoint]);
  const uptimeSeries = useMemo(() => getUptimeSeries(primaryResults), [primaryResults]);
  const latencySeries = useMemo(() => getLatencySeries(primaryResults), [primaryResults]);
  const avgLatency = getAverageLatency24h(latestResults);
  const lastCheck = latestResults[0]?.createdAt || null;
  const lastFailure = getLastFailure(latestResults);

  const filteredHistory = useMemo(() => {
    const source = latestResults.map((result) => {
      const endpoint = endpoints.find((item) => item.id === result.endpointId);
      return { ...result, endpointName: endpoint?.name || "Unknown endpoint" };
    });

    switch (historyFilter) {
      case "failures":
        return source.filter((result) => result.statusCode === null || result.statusCode >= 400);
      case "anomalies":
        return source.filter((result) => result.isAnomaly);
      default:
        return source;
    }
  }, [endpoints, historyFilter, latestResults]);

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / pageSize));
  const currentHistoryPage = Math.min(historyPage, totalPages);
  const paginatedHistory = filteredHistory.slice(
    (currentHistoryPage - 1) * pageSize,
    currentHistoryPage * pageSize
  );

  const endpointCards = endpoints.map((endpoint) => {
    const lastResult = endpoint.results[0] || null;
    const status = getMonitoringStatus(lastResult);
    return { endpoint, status, lastResult };
  });

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="animate-fade-in dashboard-grid">
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: "4px" }}>
            Welcome back, {user?.email}. Your uptime watchtower is live.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => void fetchEndpoints(true)}
          aria-label="Refresh monitoring data"
        >
          <RefreshCcw size={16} className={isRefreshing ? "icon-spin" : ""} />
          {isRefreshing ? "Refreshing..." : "Refresh now"}
        </button>
      </div>

      {monitoringStatus && (!monitoringStatus.enabled || !monitoringStatus.available) ? (
        <div
          className="card"
          style={{ borderColor: "var(--degraded)", backgroundColor: "var(--warning-bg)" }}
        >
          <h3 style={{ marginBottom: "8px" }}>Monitoring temporarily unavailable</h3>
          <p style={{ color: "var(--text-secondary)" }}>
            {monitoringStatus.reason || "The worker is not processing checks right now."}
          </p>
        </div>
      ) : null}

      <div className="summary-grid">
        <div className="card">
          <div className="metric-icon">
            <Activity size={18} />
          </div>
          <h3 className="metric-label">Total Endpoints</h3>
          <div className="metric-value">{endpoints.length}</div>
          <p className="metric-copy">Actively monitored services across your workspace.</p>
        </div>

        <div className="card">
          <div className="metric-icon">
            <Gauge size={18} />
          </div>
          <h3 className="metric-label">Avg Latency</h3>
          <div className="metric-value">{avgLatency ? `${avgLatency} ms` : "--"}</div>
          <p className="metric-copy">Average response time across the last 24 hours.</p>
        </div>

        <div className="card">
          <div className="metric-icon">
            <Clock3 size={18} />
          </div>
          <h3 className="metric-label">Last Check</h3>
          <div className="metric-value">{getRelativeTimestamp(lastCheck)}</div>
          <p className="metric-copy">
            {lastCheck ? format(new Date(lastCheck), "MMM d, HH:mm:ss") : "No checks recorded yet."}
          </p>
        </div>

        <div className="card">
          <div className="metric-icon metric-icon-warning">
            <AlertTriangle size={18} />
          </div>
          <h3 className="metric-label">Last Error</h3>
          <div className="metric-value metric-value-sm">
            {lastFailure ? `${lastFailure.statusCode || "Network"} issue` : "No failures"}
          </div>
          <p className="metric-copy">
            {lastFailure
              ? `${getRelativeTimestamp(lastFailure.createdAt)} on ${
                  endpoints.find((item) => item.id === lastFailure.endpointId)?.name || "an endpoint"
                }`
              : "Everything looks stable right now."}
          </p>
        </div>
      </div>

      {primaryEndpoint ? (
        <div className="chart-grid">
          <div className="card chart-card">
            <div className="chart-header">
              <div>
                <h3>Uptime Trend</h3>
                <p>{primaryEndpoint.name}</p>
              </div>
              <StatusBadge status={getMonitoringStatus(primaryResults[0] || null)} />
            </div>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={uptimeSeries}>
                  <defs>
                    <linearGradient id="uptimeFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--healthy)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--healthy)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="time" stroke="var(--text-secondary)" tick={{ fill: "var(--text-secondary)" }} />
                  <YAxis domain={[0, 100]} stroke="var(--text-secondary)" tick={{ fill: "var(--text-secondary)" }} />
                  <Tooltip contentStyle={{ backgroundColor: "var(--bg-surface-elevated)", border: "1px solid var(--border-color)" }} />
                  <Area type="monotone" dataKey="uptime" stroke="var(--healthy)" fill="url(#uptimeFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card chart-card">
            <div className="chart-header">
              <div>
                <h3>Latency & Anomalies</h3>
                <p>Spikes beyond the expected threshold are highlighted.</p>
              </div>
            </div>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={latencySeries}>
                  <CartesianGrid stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="time" stroke="var(--text-secondary)" tick={{ fill: "var(--text-secondary)" }} />
                  <YAxis stroke="var(--text-secondary)" tick={{ fill: "var(--text-secondary)" }} />
                  <Tooltip contentStyle={{ backgroundColor: "var(--bg-surface-elevated)", border: "1px solid var(--border-color)" }} />
                  <Legend />
                  <Line type="monotone" dataKey="latency" name="Latency" stroke="var(--primary)" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="anomalyThreshold" name="Anomaly threshold" stroke="var(--degraded)" strokeDasharray="6 6" dot={false} />
                  <Line type="monotone" dataKey="anomalyHit" name="Spike" stroke="var(--danger)" strokeWidth={0} dot={{ r: 4, fill: "var(--danger)" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        <EmptyState
          title="No monitoring data yet"
          description="Add your first endpoint to start generating uptime, latency and anomaly insights."
          action={
            <Link to="/endpoints" className="btn btn-primary">
              Add endpoint
            </Link>
          }
          illustration={
            <svg width="140" height="100" viewBox="0 0 140 100" fill="none">
              <rect x="8" y="16" width="124" height="68" rx="18" fill="var(--empty-illustration-bg)" />
              <path d="M24 60h18l10-24 15 34 14-22 9 12h16" stroke="var(--primary)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
      )}

      <div className="card">
        <div className="section-header">
          <div>
            <h2>Endpoints Overview</h2>
            <p>Real-time health state, latency mood and last execution snapshot.</p>
          </div>
        </div>
        <div className="endpoint-grid">
          {endpointCards.map(({ endpoint, status, lastResult }) => (
            <div key={endpoint.id} className="endpoint-overview-card">
              <div className="flex-between mobile-row">
                <div>
                  <h3>{endpoint.name}</h3>
                  <p>{endpoint.url}</p>
                </div>
                <StatusBadge status={status} />
              </div>
              <div className="endpoint-overview-meta">
                <span>Interval {endpoint.interval}s</span>
                <span>Last check {getRelativeTimestamp(lastResult?.createdAt || null)}</span>
                <span>{lastResult ? `${lastResult.responseTime} ms` : "No latency yet"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="section-header">
          <div>
            <h2>Recent Execution History</h2>
            <p>Track the latest checks, status changes and anomaly hits.</p>
          </div>
          <div className="filter-row" role="tablist" aria-label="History filters">
            {[
              { key: "all", label: "All" },
              { key: "failures", label: "Failures" },
              { key: "anomalies", label: "Anomalies" },
            ].map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={`filter-pill ${historyFilter === filter.key ? "active" : ""}`}
                onClick={() => {
                  setHistoryFilter(filter.key as HistoryFilter);
                  setHistoryPage(1);
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <EmptyState
            title="No matching executions"
            description="Try another quick filter or wait for the next run to populate this table."
            illustration={
              <svg width="120" height="90" viewBox="0 0 120 90" fill="none">
                <rect x="12" y="12" width="96" height="66" rx="14" fill="var(--empty-illustration-bg)" />
                <path d="M34 32h52M34 46h34M34 60h24" stroke="var(--text-muted)" strokeWidth="6" strokeLinecap="round" />
              </svg>
            }
          />
        ) : (
          <>
            <div className="history-table-wrapper" role="region" aria-label="Recent execution history">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Endpoint</th>
                    <th>Status</th>
                    <th>Latency</th>
                    <th>Timestamp</th>
                    <th>Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedHistory.map((result) => {
                    const status = getMonitoringStatus(result);
                    return (
                      <tr key={result.id}>
                        <td data-label="Endpoint">{result.endpointName}</td>
                        <td data-label="Status"><StatusBadge status={status} /></td>
                        <td data-label="Latency">{result.responseTime} ms</td>
                        <td data-label="Timestamp">{getRelativeTimestamp(result.createdAt)}</td>
                        <td data-label="Flags">
                          <div className="history-flags">
                            {result.isAnomaly ? <span className="flag-chip flag-anomaly">Anomaly</span> : null}
                            {result.statusCode === null || result.statusCode >= 400 ? <span className="flag-chip flag-error">Error</span> : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="pagination-row">
              <button type="button" className="btn btn-outline" onClick={() => setHistoryPage((page) => Math.max(1, page - 1))} disabled={currentHistoryPage === 1}>
                Previous
              </button>
              <span>Page {currentHistoryPage} of {totalPages}</span>
              <button type="button" className="btn btn-outline" onClick={() => setHistoryPage((page) => Math.min(totalPages, page + 1))} disabled={currentHistoryPage === totalPages}>
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
