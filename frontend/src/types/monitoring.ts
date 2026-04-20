export interface CheckResult {
  id: string;
  endpointId: string;
  statusCode: number | null;
  responseTime: number;
  isAnomaly: boolean;
  createdAt: string;
}

export interface Endpoint {
  id: string;
  name: string;
  url: string;
  interval: number;
  createdAt: string;
  updatedAt: string;
  results: CheckResult[];
}
