"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { BASE_URL } from "@/lib/utils";

type OverallStatus = "healthy" | "degraded" | "down" | "loading";

interface ServiceStatus {
  status: string;
  latency_ms?: number;
}

interface HealthData {
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

interface CachedHealth {
  status: Exclude<OverallStatus, "loading">;
  healthData: HealthData | null;
  timestamp: number;
}

const STATUS_CONFIG: Record<
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

const STORAGE_KEY = "app:health-status";
const POLL_INTERVAL = 10 * 60_000; // 10 minutes
const DOWN_TTL = 60_000; // re-check "down" after 1 minute
const REQUEST_TIMEOUT = 10_000; // 10 seconds
const RETRY_DELAY = 3_000; // quick retry after the first failure
const FAILURES_BEFORE_DOWN = 2; // don't flip to "down" on a single blip

const ttlFor = (status: OverallStatus) =>
  status === "down" ? DOWN_TTL : POLL_INTERVAL;

function readCache(): CachedHealth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedHealth;
    if (!parsed?.status || typeof parsed.timestamp !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(entry: CachedHealth) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    /* storage full or unavailable - ignore */
  }
}

export function StatusIndicator({
  placement = "bottom",
}: {
  placement?: "top" | "bottom";
}) {
  const [status, setStatus] = useState<OverallStatus>("loading");
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const tooltipRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const failureCountRef = useRef(0);

  const schedule = useCallback((delay: number, fn: () => void) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(fn, delay);
  }, []);

  const checkHealth = useCallback(async () => {
    // Cancel any in-flight request and pending timer
    controllerRef.current?.abort();
    if (timerRef.current) clearTimeout(timerRef.current);

    const controller = new AbortController();
    controllerRef.current = controller;
    const requestId = ++requestIdRef.current;
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const res = await fetch(`${BASE_URL}/health`, {
        signal: controller.signal,
        cache: "no-store",
      });

      // Read the body even on non-2xx (e.g. 503 with degraded details)
      let data: HealthData | null = null;
      try {
        data = await res.json();
      } catch {
        /* body wasn't JSON */
      }

      if (requestId !== requestIdRef.current) return; // stale response

      if (!data?.services) {
        throw new Error(`Health check failed (HTTP ${res.status})`);
      }

      const next = data.status === "healthy" ? "healthy" : "degraded";
      failureCountRef.current = 0;
      setHealthData(data);
      setStatus(next);
      writeCache({ status: next, healthData: data, timestamp: Date.now() });
      schedule(POLL_INTERVAL, checkHealth);
    } catch {
      if (requestId !== requestIdRef.current) return; // aborted by newer request / unmount

      failureCountRef.current += 1;

      if (failureCountRef.current >= FAILURES_BEFORE_DOWN) {
        setStatus("down");
        setHealthData(null);
        writeCache({ status: "down", healthData: null, timestamp: Date.now() });
        schedule(DOWN_TTL, checkHealth);
      } else {
        // First failure: keep the last known state and retry soon
        schedule(RETRY_DELAY, checkHealth);
      }
    } finally {
      clearTimeout(timeout);
      if (requestId === requestIdRef.current) setIsRefreshing(false);
    }
  }, [schedule]);

  // Initial load: use the cache if it's still fresh, otherwise fetch
  useEffect(() => {
    const cached = readCache();

    if (cached) {
      setStatus(cached.status);
      setHealthData(cached.healthData);

      const remaining = ttlFor(cached.status) - (Date.now() - cached.timestamp);
      if (remaining > 0) {
        schedule(remaining, checkHealth);
      } else {
        checkHealth();
      }
    } else {
      checkHealth();
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      requestIdRef.current++; // invalidate anything still in flight
      controllerRef.current?.abort();
    };
  }, [checkHealth, schedule]);

  // Sync with other tabs / pages that update the cache
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const cached = readCache();
      if (!cached) return;

      setStatus(cached.status);
      setHealthData(cached.healthData);
      failureCountRef.current = 0;

      const remaining = ttlFor(cached.status) - (Date.now() - cached.timestamp);
      // Another tab just checked, so push our next poll out accordingly
      requestIdRef.current++;
      controllerRef.current?.abort();
      schedule(Math.max(remaining, 0), checkHealth);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [checkHealth, schedule]);

  // Close tooltip on outside click
  useEffect(() => {
    if (!showTooltip) return;
    const handler = (e: MouseEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node)
      ) {
        setShowTooltip(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showTooltip]);

  const config = STATUS_CONFIG[status];

  const renderServiceRow = (name: string, svc: ServiceStatus | undefined) => {
    if (!svc) return null;
    const isHealthy = svc.status === "healthy";
    return (
      <div key={name} className="flex items-center justify-between gap-3 py-1">
        <div className="flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 rounded-full ${isHealthy ? "bg-emerald-400" : "bg-red-400"}`}
          />
          <span className="text-[11px] text-zinc-700 dark:text-[#d0d6e0] capitalize">
            {name}
          </span>
        </div>
        {svc.latency_ms !== undefined && isHealthy && (
          <span className="text-[10px] text-zinc-400 dark:text-[#8a8f98] font-mono">
            {svc.latency_ms}ms
          </span>
        )}
        {!isHealthy && (
          <span className="text-[10px] text-red-500 dark:text-red-400 font-medium">
            Down
          </span>
        )}
      </div>
    );
  };

  const isPlacementTop = placement === "top";

  return (
    <div className="relative" ref={tooltipRef}>
      <button
        onClick={() => setShowTooltip(!showTooltip)}
        className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-zinc-100 dark:hover:bg-[#1a1b1e] transition-colors cursor-pointer text-zinc-600 dark:text-[#8a8f98]"
        title={config.label}
      >
        <span className="relative flex h-2 w-2">
          <span
            className={`absolute inset-0 rounded-full animate-ping ${config.pulse}`}
            style={{ animationDuration: "2s" }}
          />
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${config.color}`}
          />
        </span>
        <span className="text-[11px] font-medium hidden sm:inline">
          {status === "healthy"
            ? "Operational"
            : status === "degraded"
              ? "Degraded"
              : status === "down"
                ? "Offline"
                : "..."}
        </span>
      </button>

      {/* Tooltip dropdown */}
      {showTooltip && (
        <div
          className={`absolute right-0 w-[220px] bg-white dark:bg-[#0d0d0e] border border-zinc-200 dark:border-[#23252a] rounded-xl shadow-2xl p-3 z-[100] text-zinc-900 dark:text-[#f7f8f8] animate-in fade-in zoom-in-95 duration-100 ${
            isPlacementTop ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {/* Header */}
          <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-zinc-100 dark:border-[#23252a]">
            <span className={`h-2 w-2 rounded-full ${config.color}`} />
            <span className="text-[12px] font-medium text-zinc-900 dark:text-[#f7f8f8]">
              {config.label}
            </span>
          </div>

          {/* Services */}
          {healthData ? (
            <div className="space-y-0.5">
              {renderServiceRow("Database", healthData.services.postgres)}
              {renderServiceRow("Redis", healthData.services.redis)}

              {/* LLM Providers */}
              {healthData.services.llm?.providers &&
                Object.entries(healthData.services.llm.providers).map(
                  ([name, prov]) =>
                    prov.status !== "not_configured" &&
                    renderServiceRow(name, prov),
                )}
            </div>
          ) : status === "down" ? (
            <p className="text-[11px] text-zinc-500 dark:text-[#8a8f98]">
              Cannot reach the backend server.
            </p>
          ) : (
            <p className="text-[11px] text-zinc-500 dark:text-[#8a8f98]">
              Loading...
            </p>
          )}

          {/* Refresh (always bypasses the cache) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsRefreshing(true);
              // On a manual refresh, one failure is enough to show "down"
              failureCountRef.current = FAILURES_BEFORE_DOWN - 1;
              checkHealth();
            }}
            disabled={isRefreshing}
            className="mt-2.5 pt-2 border-t border-zinc-100 dark:border-[#23252a] w-full text-center text-[10px] text-zinc-500 hover:text-zinc-900 dark:text-[#8a8f98] dark:hover:text-[#f7f8f8] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-default"
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      )}
    </div>
  );
}
