import React, { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import api from "../services/api";
import { io, Socket } from "socket.io-client";
import { useAuth } from "../contexts/AuthContext";

interface Endpoint {
  id: string;
  name: string;
  url: string;
  interval: number;
  status: "ACTIVE" | "PAUSED" | "ERROR";
}

interface EndpointUpdate {
  id: string;
  endpointId: string;
  statusCode: number | null;
  responseTime: number;
  isAnomaly: boolean;
  createdAt: string;
}

interface ChartPoint {
  name: string;
  latency: number;
  status: number | null;
}

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [liveData, setLiveData] = useState<Record<string, ChartPoint[]>>({});
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const fetchEndpoints = async () => {
      try {
        const response = await api.get("/endpoints");
        setEndpoints(response.data.endpoints);
      } catch (err) {
        console.error("Failed to fetch endpoints", err);
      }
    };

    fetchEndpoints();

    const socketUrl = import.meta.env.VITE_API_URL.replace(/\/api$/, "");
    const newSocket = io(socketUrl);
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!socket || endpoints.length === 0) return;

    endpoints.forEach((ep) => {
      socket.on(`endpoint_update_${ep.id}`, (result: EndpointUpdate) => {
        setLiveData((prev) => {
          const current = prev[ep.id] || [];
          const time = new Date(result.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });

          const newData = [
            ...current,
            {
              name: time,
              latency: result.responseTime,
              status: result.statusCode,
            },
          ];

          if (newData.length > 20) newData.shift();

          return { ...prev, [ep.id]: newData };
        });
      });
    });

    return () => {
      endpoints.forEach((ep) => {
        socket.off(`endpoint_update_${ep.id}`);
      });
    };
  }, [socket, endpoints]);

  return (
    <div className="animate-fade-in">
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: "4px" }}>
            Welcome back, {user?.email}
          </p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "24px",
        }}
      >
        <div className="card">
          <h3 style={{ marginBottom: "16px", color: "var(--text-secondary)" }}>
            Total Endpoints
          </h3>
          <div style={{ fontSize: "2.5rem", fontWeight: "700" }}>{endpoints.length}</div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: "16px", color: "var(--text-secondary)" }}>
            Live Tracking
          </h3>
          <div style={{ fontSize: "2.5rem", fontWeight: "700", color: "var(--success)" }}>
            Active
          </div>
        </div>
      </div>

      {endpoints.map((ep) => {
        const data = liveData[ep.id] || [];

        return (
          <div key={ep.id} className="card" style={{ marginTop: "32px" }}>
            <div className="flex-between" style={{ marginBottom: "24px" }}>
              <h3>
                {ep.name}{" "}
                <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                  ({ep.url})
                </span>
              </h3>
              <span className="badge badge-success">Live</span>
            </div>

            {data.length === 0 ? (
              <div
                style={{
                  height: "300px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-muted)",
                }}
              >
                Waiting for next check...
              </div>
            ) : (
              <div style={{ height: "300px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border-color)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      stroke="var(--text-secondary)"
                      tick={{ fill: "var(--text-secondary)" }}
                    />
                    <YAxis
                      stroke="var(--text-secondary)"
                      tick={{ fill: "var(--text-secondary)" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--bg-surface)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "8px",
                      }}
                      itemStyle={{ color: "var(--primary)" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="latency"
                      name="Latency (ms)"
                      stroke="var(--primary)"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "var(--bg-surface)", strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
