"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getStoredToken, clearUserSession } from "@/lib/utils";
import { fetchReposApi, checkRepoSyncApi, triggerIngestApi } from "@/lib/api";
import { RepoItem } from "@/components/workspace/sidebar";

interface RepoContextType {
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

  const [token] = useState<string | null>(() => getStoredToken());

  const clearSession = useCallback(() => {
    setRepos([]);
    setCheckingSync({});
    clearUserSession();
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
