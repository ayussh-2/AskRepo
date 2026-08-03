"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiCall, getStoredToken } from "@/lib/utils";
import { RepoItem } from "@/components/workspace/sidebar";

interface RepoContextType {
  repos: RepoItem[];
  loadingRepos: boolean;
  checkingSync: Record<string, "checking" | "up-to-date" | "out-of-sync" | "error">;
  loadRepos: () => Promise<void>;
  handleCheckSync: (repoName: string) => Promise<void>;
  handleSyncNow: (repoName: string) => Promise<void>;
}

const RepoContext = createContext<RepoContextType | undefined>(undefined);

export function RepoProvider({ children }: { children: React.ReactNode }) {
  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [loadingRepos, setLoadingRepos] = useState<boolean>(false);
  const [checkingSync, setCheckingSync] = useState<Record<string, "checking" | "up-to-date" | "out-of-sync" | "error">>({});

  const [token] = useState<string | null>(() => getStoredToken());

  const loadRepos = useCallback(async () => {
    const activeToken = token || getStoredToken();
    if (!activeToken) return;
    setLoadingRepos(true);
    try {
      const res = await apiCall("/repos", "GET", null, activeToken);
      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          setRepos(result.data.repos || []);
        }
      }
    } catch {
      console.error("Failed to load repositories.");
    } finally {
      setLoadingRepos(false);
    }
  }, [token]);

  // Fetch repos ONCE when user token is available via microtask async callback
  useEffect(() => {
    let active = true;
    const activeToken = token || getStoredToken();
    if (!activeToken) return;

    apiCall("/repos", "GET", null, activeToken)
      .then((res) => res.json())
      .then((result) => {
        if (result.success && active) {
          setRepos(result.data.repos || []);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [token]);

  // Auto-poll /repos if any repository is currently processing or pending
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
    try {
      const res = await apiCall(`/check-sync?repo_name=${encodeURIComponent(repoName)}`, "GET", null, activeToken);
      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          setCheckingSync((prev) => ({
            ...prev,
            [repoName]: result.data.up_to_date ? "up-to-date" : "out-of-sync",
          }));
        } else {
          setCheckingSync((prev) => ({ ...prev, [repoName]: "error" }));
        }
      } else {
        setCheckingSync((prev) => ({ ...prev, [repoName]: "error" }));
      }
    } catch {
      setCheckingSync((prev) => ({ ...prev, [repoName]: "error" }));
    }
  };

  const handleSyncNow = async (repoName: string) => {
    const activeToken = token || getStoredToken();
    if (!activeToken) return;
    setCheckingSync((prev) => ({ ...prev, [repoName]: "checking" }));
    const repoUrl = `https://github.com/${repoName}`;
    try {
      const res = await apiCall("/ingest", "POST", { repo_url: repoUrl }, activeToken);
      const result = await res.json();
      if (res.ok && result.success) {
        setCheckingSync((prev) => ({ ...prev, [repoName]: "up-to-date" }));
        loadRepos();
      } else {
        setCheckingSync((prev) => ({ ...prev, [repoName]: "error" }));
      }
    } catch {
      setCheckingSync((prev) => ({ ...prev, [repoName]: "error" }));
    }
  };

  return (
    <RepoContext.Provider
      value={{
        repos,
        loadingRepos,
        checkingSync,
        loadRepos,
        handleCheckSync,
        handleSyncNow,
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
      repos: [],
      loadingRepos: false,
      checkingSync: {},
      loadRepos: async () => {},
      handleCheckSync: async () => {},
      handleSyncNow: async () => {},
    };
  }
  return context;
}
