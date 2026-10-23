"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getStoredToken, clearUserSession, getTokenExp, triggerSilentGoogleRefresh } from "@/lib/utils";
import { fetchReposApi, checkRepoSyncApi, triggerIngestApi } from "@/lib/api";
import { RepoItem } from "@/components/workspace/sidebar";

interface RepoContextType {
  token: string | null;
  repos: RepoItem[];
  loadingRepos: boolean;
  checkingSync: Record<string, "checking" | "up-to-date" | "out-of-sync" | "error">;
  loadRepos: () => Promise<void>;
  handleCheckSync: (repoName: string) => Promise<void>;
  handleSyncNow: (repoName: string) => Promise<void>;
  clearSession: () => void;
}

const RepoContext = createContext<RepoContextType | undefined>(undefined);

export function RepoProvider({ children }: { children: React.ReactNode }) {
  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [loadingRepos, setLoadingRepos] = useState<boolean>(false);
  const [checkingSync, setCheckingSync] = useState<Record<string, "checking" | "up-to-date" | "out-of-sync" | "error">>({});

  const [token, setToken] = useState<string | null>(() => getStoredToken());

  // Listen for token updates (e.g. from silent refresh or other tabs)
  useEffect(() => {
    const handleTokenUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ token: string | null }>;
      const nextToken = customEvent.detail?.token ?? null;
      setToken(nextToken);
    };

    window.addEventListener("askrepo_token_updated", handleTokenUpdated);
    return () => {
      window.removeEventListener("askrepo_token_updated", handleTokenUpdated);
    };
  }, []);

  // 55-minute silent Google token refresh
  useEffect(() => {
    if (!token) return;

    const expMs = getTokenExp(token);
    if (!expMs) return;

    // Refresh 5 minutes before expiry (55 minutes into a 60-minute token), or minimum 10 seconds
    const timeUntilRefresh = Math.max(expMs - Date.now() - 5 * 60 * 1000, 10000);

    const timer = setTimeout(() => {
      triggerSilentGoogleRefresh((newToken) => {
        setToken(newToken);
      });
    }, timeUntilRefresh);

    return () => clearTimeout(timer);
  }, [token]);

  const clearSession = useCallback(() => {
    setToken(null);
    setRepos([]);
    setCheckingSync({});
    clearUserSession();
    window.dispatchEvent(
      new CustomEvent("askrepo_token_updated", { detail: { token: null } }),
    );
  }, []);

  const loadRepos = useCallback(async () => {
    const activeToken = token || getStoredToken();
    if (!activeToken) return;
    setLoadingRepos(true);
    const res = await fetchReposApi(activeToken);
    if (res.success && res.data) {
      setRepos(res.data.repos || []);
    }
    setLoadingRepos(false);
  }, [token]);

  useEffect(() => {
    let active = true;
    const activeToken = token || getStoredToken();
    if (!activeToken) return;

    fetchReposApi(activeToken).then((res) => {
      if (res.success && active && res.data) {
        setRepos(res.data.repos || []);
      }
    });

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    const hasProcessingRepo = repos.some(
      (r) => r.status === "processing" || r.status === "pending",
    );
    if (!hasProcessingRepo || !token) return;

    const timer = setInterval(() => {
      loadRepos();
    }, 3000);

    return () => clearInterval(timer);
  }, [repos, token, loadRepos]);

  const handleCheckSync = async (repoName: string) => {
    const activeToken = token || getStoredToken();
    if (!activeToken) return;
    setCheckingSync((prev) => ({ ...prev, [repoName]: "checking" }));

    const res = await checkRepoSyncApi(repoName, activeToken);
    if (res.success && res.data) {
      const isUpToDate = res.data.up_to_date ?? res.data.is_up_to_date ?? false;
      setCheckingSync((prev) => ({
        ...prev,
        [repoName]: isUpToDate ? "up-to-date" : "out-of-sync",
      }));
    } else {
      setCheckingSync((prev) => ({ ...prev, [repoName]: "error" }));
    }
  };

  const handleSyncNow = async (repoName: string) => {
    const activeToken = token || getStoredToken();
    if (!activeToken) return;
    setCheckingSync((prev) => ({ ...prev, [repoName]: "checking" }));
    const repoUrl = `https://github.com/${repoName}`;

    const res = await triggerIngestApi(repoUrl, activeToken);
    if (res.success) {
      setCheckingSync((prev) => ({ ...prev, [repoName]: "up-to-date" }));
      loadRepos();
    } else {
      setCheckingSync((prev) => ({ ...prev, [repoName]: "error" }));
    }
  };

  return (
    <RepoContext.Provider
      value={{
        token,
        repos,
        loadingRepos,
        checkingSync,
        loadRepos,
        handleCheckSync,
        handleSyncNow,
        clearSession,
      }}
    >
      {children}
    </RepoContext.Provider>
  );
}

export function useRepos() {
  const context = useContext(RepoContext);
  if (!context) {
    return {
      token: null,
      repos: [],
      loadingRepos: false,
      checkingSync: {},
      loadRepos: async () => {},
      handleCheckSync: async () => {},
      handleSyncNow: async () => {},
      clearSession: () => {},
    };
  }
  return context;
}
