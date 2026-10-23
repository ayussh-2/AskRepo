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

const POLL_INTERVAL = 60_000; // 60 seconds

export function StatusIndicator() {
  const [status, setStatus] = useState<OverallStatus>("loading");
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const checkHealth = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(`${BASE_URL}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        setStatus("down");
        setHealthData(null);
        return;
      }

      const data: HealthData = await res.json();
      setHealthData(data);

      if (data.status === "healthy") {
        setStatus("healthy");
      } else {
        setStatus("degraded");
      }
    } catch {
      setStatus("down");
      setHealthData(null);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [checkHealth]);

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

  const renderServiceRow = (
    name: string,
    svc: ServiceStatus | undefined
  ) => {
    if (!svc) return null;
    const isHealthy = svc.status === "healthy";
    return (
      <div
        key={name}
        className="flex items-center justify-between gap-3 py-1"
      >
        <div className="flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 rounded-full ${isHealthy ? "bg-emerald-400" : "bg-red-400"}`}
          />
          <span className="text-[11px] text-[#d0d6e0] capitalize">
            {name}
          </span>
        </div>
        {svc.latency_ms !== undefined && isHealthy && (
          <span className="text-[10px] text-[#8a8f98] font-mono">
            {svc.latency_ms}ms
          </span>
        )}
        {!isHealthy && (
          <span className="text-[10px] text-red-400 font-medium">Down</span>
        )}
      </div>
    );
  };

  return (
    <div className="relative" ref={tooltipRef}>
      <button
        onClick={() => setShowTooltip(!showTooltip)}
        className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-[#1a1b1e] transition-colors cursor-pointer"
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
        <span className="text-[11px] text-[#8a8f98] hidden sm:inline">
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
        <div className="absolute top-full right-0 mt-2 w-[220px] bg-[#0d0d0e] border border-[#23252a] rounded-xl shadow-2xl p-3 z-[100]">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-[#23252a]">
            <span
              className={`h-2 w-2 rounded-full ${config.color}`}
            />
            <span className="text-[12px] font-medium text-[#f7f8f8]">
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
                    renderServiceRow(name, prov)
                )}
            </div>
          ) : status === "down" ? (
            <p className="text-[11px] text-[#8a8f98]">
              Cannot reach the backend server.
            </p>
          ) : (
            <p className="text-[11px] text-[#8a8f98]">Loading...</p>
          )}

          {/* Refresh */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setStatus("loading");
              checkHealth();
            }}
            className="mt-2.5 pt-2 border-t border-[#23252a] w-full text-center text-[10px] text-[#8a8f98] hover:text-[#f7f8f8] transition-colors cursor-pointer"
          >
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}
