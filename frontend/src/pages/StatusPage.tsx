import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../services/api";
import { EmptyState } from "../components/ui/EmptyState";
import { StatusBadge } from "../components/ui/StatusBadge";
import { Spinner } from "../components/ui/Spinner";

interface PublicService {
  id: string;
  name: string;
  url: string;
  state: "HEALTHY" | "DEGRADED" | "DOWN";
  lastCheckedAt: string | null;
  availability: Array<{
    window: string;
    uptimePercentage: number | null;
  }>;
}

interface PublicIncident {
  id: string;
  title: string;
  summary?: string | null;
  status: string;
  severity: string;
  createdAt: string;
}

interface PublicStatusResponse {
  statusPage: {
    slug: string;
    title: string;
    description?: string | null;
    workspace: {
      name: string;
      slug: string;
    };
  };
  services: PublicService[];
  incidents: PublicIncident[];
}

export const StatusPage: React.FC = () => {
  const { slug } = useParams();
  const [payload, setPayload] = useState<PublicStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) {
      return;
    }

    void api
      .get(`/status-pages/public/${slug}`)
      .then((response) => setPayload(response.data))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="app-layout" style={{ justifyContent: "center", alignItems: "center" }}>
        <Spinner />
      </div>
    );
  }

  if (!slug) {
    return (
      <div className="app-layout" style={{ justifyContent: "center", alignItems: "center" }}>
        <EmptyState
          title="Status page unavailable"
          description="No public slug was provided."
        />
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="app-layout" style={{ justifyContent: "center", alignItems: "center" }}>
        <EmptyState
          title="Status page unavailable"
          description="The requested public status page could not be loaded."
        />
      </div>
    );
  }

  return (
    <div className="app-layout">
      <div className="dashboard-grid" style={{ width: "100%", maxWidth: "1100px", margin: "0 auto" }}>
        <div className="card">
          <h1 className="page-title">{payload.statusPage.title}</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>
            {payload.statusPage.description || `Live service health for ${payload.statusPage.workspace.name}.`}
          </p>
        </div>

        <div className="card">
          <div className="section-header">
            <div>
              <h2>Public Services</h2>
              <p>Current health, recent availability windows and visibility for customers.</p>
            </div>
          </div>
          <div className="endpoint-grid">
            {payload.services.map((service) => (
              <div key={service.id} className="endpoint-overview-card">
                <div className="flex-between mobile-row">
                  <div>
                    <h3>{service.name}</h3>
                    <p>{service.url}</p>
                  </div>
                  <StatusBadge status={service.state} />
                </div>
                <div className="endpoint-overview-meta">
                  {service.availability.map((window) => (
                    <span key={window.window}>
                      {window.window}: {window.uptimePercentage ?? "--"}%
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="section-header">
            <div>
              <h2>Incidents</h2>
              <p>Recent public incidents and ongoing investigations.</p>
            </div>
          </div>

          {payload.incidents.length === 0 ? (
            <EmptyState
              title="No public incidents"
              description="Everything looks stable right now."
            />
          ) : (
            <div className="endpoint-grid">
              {payload.incidents.map((incident) => (
                <div key={incident.id} className="endpoint-overview-card">
                  <div className="flex-between mobile-row">
                    <div>
                      <h3>{incident.title}</h3>
                      <p>{incident.summary || "No additional public note."}</p>
                    </div>
                    <span className="badge badge-warning">{incident.status}</span>
                  </div>
                  <div className="endpoint-overview-meta">
                    <span>Severity {incident.severity}</span>
                    <span>{new Date(incident.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
