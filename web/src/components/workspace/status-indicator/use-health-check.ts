"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { BASE_URL } from "@/lib/utils";
import {
  OverallStatus,
  HealthData,
  CachedHealth,
  STORAGE_KEY,
  POLL_INTERVAL,
  DOWN_TTL,
  REQUEST_TIMEOUT,
  RETRY_DELAY,
  FAILURES_BEFORE_DOWN,
  ttlFor,
} from "./types";

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

export function useHealthCheck() {
  const [status, setStatus] = useState<OverallStatus>("loading");
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const controllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const failureCountRef = useRef(0);

  const schedule = useCallback((delay: number, fn: () => void) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(fn, delay);
  }, []);

  const checkHealth = useCallback(async () => {
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

      let data: HealthData | null = null;
      try {
        data = await res.json();
      } catch {
        /* body wasn't JSON */
      }

      if (requestId !== requestIdRef.current) return;

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
      if (requestId !== requestIdRef.current) return;

      failureCountRef.current += 1;

      if (failureCountRef.current >= FAILURES_BEFORE_DOWN) {
        setStatus("down");
        setHealthData(null);
        writeCache({ status: "down", healthData: null, timestamp: Date.now() });
        schedule(DOWN_TTL, checkHealth);
      } else {
        schedule(RETRY_DELAY, checkHealth);
      }
    } finally {
      clearTimeout(timeout);
      if (requestId === requestIdRef.current) setIsRefreshing(false);
    }
  }, [schedule]);

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
      requestIdRef.current++;
      controllerRef.current?.abort();
    };
  }, [checkHealth, schedule]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const cached = readCache();
      if (!cached) return;

      setStatus(cached.status);
      setHealthData(cached.healthData);
      failureCountRef.current = 0;

      const remaining = ttlFor(cached.status) - (Date.now() - cached.timestamp);
      requestIdRef.current++;
      controllerRef.current?.abort();
      schedule(Math.max(remaining, 0), checkHealth);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [checkHealth, schedule]);

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    failureCountRef.current = FAILURES_BEFORE_DOWN - 1;
    checkHealth();
  }, [checkHealth]);

  return {
    status,
    healthData,
    isRefreshing,
    refresh,
  };
}
