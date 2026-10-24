export type OverallStatus = "healthy" | "degraded" | "down" | "loading";

export interface ServiceStatus {
  status: string;
  latency_ms?: number;
}

export interface HealthData {
  status: string;
  services: {
    postgres: ServiceStatus;
    redis: ServiceStatus;
    llm: {
      active_order: string[];
      providers: Record<string, ServiceStatus & { model?: string }>;
    };
  };
}

export interface CachedHealth {
  status: Exclude<OverallStatus, "loading">;
  healthData: HealthData | null;
  timestamp: number;
}

export const STATUS_CONFIG: Record<
  OverallStatus,
  { color: string; pulse: string; label: string }
> = {
  healthy: {
    color: "bg-emerald-400",
    pulse: "bg-emerald-400/40",
    label: "All systems operational",
  },
  degraded: {
    color: "bg-amber-400",
    pulse: "bg-amber-400/40",
    label: "Partial outage",
  },
  down: {
    color: "bg-red-400",
    pulse: "bg-red-400/40",
    label: "Service unavailable",
  },
  loading: {
    color: "bg-[#8a8f98]",
    pulse: "bg-[#8a8f98]/40",
    label: "Checking...",
  },
};

export const STORAGE_KEY = "app:health-status";
export const POLL_INTERVAL = 10 * 60_000; // 10 minutes
export const DOWN_TTL = 60_000; // re-check "down" after 1 minute
export const REQUEST_TIMEOUT = 10_000; // 10 seconds
export const RETRY_DELAY = 3_000; // quick retry after the first failure
export const FAILURES_BEFORE_DOWN = 2; // don't flip to "down" on a single blip

export const ttlFor = (status: OverallStatus) =>
  status === "down" ? DOWN_TTL : POLL_INTERVAL;
