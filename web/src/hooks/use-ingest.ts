"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { isValidRepoUrl, normalizeRepoUrl } from "@/lib/utils";
import { triggerIngestApi, checkIngestStatusApi, IngestStatusData } from "@/lib/api";

export function useIngest(
  token: string | null,
  handleUnauthorized: () => void,
  onIngestSuccess?: () => void
) {
  const router = useRouter();

  const [jobId, setJobId] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const saved = localStorage.getItem("active_ingest_job_id");
    return saved ? Number(saved) : null;
  });

  const [repoUrlInput, setRepoUrlInput] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const pendingRepo = localStorage.getItem("pending_repo_url");
    if (!pendingRepo) return "";
    const decoded = decodeURIComponent(pendingRepo);
    return isValidRepoUrl(decoded) ? normalizeRepoUrl(decoded) : decoded;
  });

  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestError, setIngestError] = useState("");

  const [progressData, setProgressData] = useState<IngestStatusData | null>(null);

  const startIngest = useCallback(
    async (rawUrl: string, autoRedirectOnComplete = false) => {
      if (!token) return;
      if (!isValidRepoUrl(rawUrl)) {
        const msg =
          "Please enter a valid GitHub or GitLab URL (e.g. github.com/owner/repo or owner/repo)";
        setIngestError(msg);
        toast.error(msg);
        return;
      }

      const targetUrl = normalizeRepoUrl(rawUrl);
      setIngestLoading(true);
      setIngestError("");

      const res = await triggerIngestApi(targetUrl, token, handleUnauthorized);
      if (res.success && res.data) {
        const repoName = res.data.repo_name;
        setRepoUrlInput("");

        if (res.data.already_indexed || res.data.status === "completed") {
          if (onIngestSuccess) onIngestSuccess();
          if (repoName) {
            toast.success(
              `Repository ${repoName} is ready! Opening chat session...`
            );
            router.push(`/chat?repo=${encodeURIComponent(repoName)}`);
            setIngestLoading(false);
            return;
          }
        }

        if (res.data.job_id) {
          localStorage.setItem("active_ingest_job_id", String(res.data.job_id));
          if (repoName) {
            localStorage.setItem("active_ingest_repo_name", repoName);
          }
          setJobId(res.data.job_id);
        }

        setProgressData({
          job_id: res.data.job_id || 0,
          status: res.data.status || "pending",
          error_message: null,
          repo_name: repoName,
        });

        if (!autoRedirectOnComplete) {
          toast.success("Repository ingestion started in background!");
        }
      } else {
        setIngestError(res.error || "Failed to trigger ingestion.");
        toast.error(res.error || "Failed to trigger ingestion.");
      }
      setIngestLoading(false);
    },
    [token, handleUnauthorized, onIngestSuccess, router]
  );

  useEffect(() => {
    if (!jobId || !token) return;
    let active = true;
    let timerId: NodeJS.Timeout | null = null;
    let isInitialFetch = true;

    async function checkStatus() {
      const res = await checkIngestStatusApi(jobId!, token!, handleUnauthorized);
      if (!active) return;
      if (res.success && res.data) {
        const currentStatus = res.data.status;
        setProgressData(res.data);

        if (currentStatus === "completed") {
          localStorage.removeItem("active_ingest_job_id");
          localStorage.removeItem("active_ingest_repo_name");
          setJobId(null);
          setProgressData(null);
          if (onIngestSuccess) onIngestSuccess();

          if (!isInitialFetch) {
            toast.success(
              `Repository ${res.data.repo_name || ""} ingestion complete!`
            );
          }
          return;
        } else if (currentStatus === "failed") {
          localStorage.removeItem("active_ingest_job_id");
          localStorage.removeItem("active_ingest_repo_name");
          setJobId(null);
          setProgressData(null);
          if (!isInitialFetch) {
            toast.error("Repository ingestion failed.");
          }
          return;
        }

        isInitialFetch = false;
        timerId = setTimeout(checkStatus, 2000);
      }
    }

    checkStatus();

    return () => {
      active = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [jobId, token, handleUnauthorized, onIngestSuccess]);

  return {
    jobId,
    repoUrlInput,
    setRepoUrlInput,
    ingestLoading,
    ingestError,
    progressData,
    startIngest,
  };
}
