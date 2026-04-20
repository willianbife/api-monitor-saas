export interface CheckResult {
  id: string;
  endpointId: string;
  statusCode: number | null;
  responseTime: number;
  totalResponseMs?: number | null;
  dnsLookupMs?: number | null;
  tlsHandshakeMs?: number | null;
  attemptCount?: number;
  failureReason?: string | null;
  validationPassed?: boolean;
  isAnomaly: boolean;
  state?: "HEALTHY" | "DEGRADED" | "DOWN";
  createdAt: string;
}

export interface Endpoint {
  id: string;
  name: string;
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  interval: number;
  isPublic?: boolean;
  currentState?: "HEALTHY" | "DEGRADED" | "DOWN";
  availability?: Array<{
    window: string;
    uptimePercentage: number | null;
  }>;
  createdAt: string;
  updatedAt: string;
  results: CheckResult[];
}
