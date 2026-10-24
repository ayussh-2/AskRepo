"use client";

import { useState, useEffect, useRef } from "react";
import { STATUS_CONFIG, ServiceStatus } from "./status-indicator/types";
import { useHealthCheck } from "./status-indicator/use-health-check";

function ServiceRow({ name, svc }: { name: string; svc: ServiceStatus | undefined }) {
  if (!svc) return null;
  const isHealthy = svc.status === "healthy";

  return (
    <div className="flex items-center justify-between gap-3 py-1">
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
}

export function StatusIndicator({
  placement = "bottom",
}: {
  placement?: "top" | "bottom";
}) {
  const { status, healthData, isRefreshing, refresh } = useHealthCheck();
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

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

      {showTooltip && (
        <div
          className={`absolute right-0 w-[220px] bg-white dark:bg-[#0d0d0e] border border-zinc-200 dark:border-[#23252a] rounded-xl shadow-2xl p-3 z-[100] text-zinc-900 dark:text-[#f7f8f8] animate-in fade-in zoom-in-95 duration-100 ${
            isPlacementTop ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-zinc-100 dark:border-[#23252a]">
            <span className={`h-2 w-2 rounded-full ${config.color}`} />
            <span className="text-[12px] font-medium text-zinc-900 dark:text-[#f7f8f8]">
              {config.label}
            </span>
          </div>

          {healthData ? (
            <div className="space-y-0.5">
              <ServiceRow name="Database" svc={healthData.services.postgres} />
              <ServiceRow name="Redis" svc={healthData.services.redis} />
              {healthData.services.llm?.providers &&
                Object.entries(healthData.services.llm.providers).map(
                  ([name, prov]) =>
                    prov.status !== "not_configured" && (
                      <ServiceRow key={name} name={name} svc={prov} />
                    ),
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

          <button
            onClick={(e) => {
              e.stopPropagation();
              refresh();
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
