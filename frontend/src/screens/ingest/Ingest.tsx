import { Button } from "@/components/ui/button";
import { Typography } from "@/components/typography/Typography";
import { browser } from "wxt/browser";
import { useState, useEffect } from "react";
import {parseRepoUrl} from "@/utils/url-parser"
import LoadingButton from "@/components/LoadingButton";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui/spinner";

interface IngestScreenProps {
  onIngestStarted: (jobId: number) => void;
}

export default function IngestScreen({ onIngestStarted }: IngestScreenProps) {
  const [repoName, setRepoName] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadPageUrl() {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      const url = tab.url;

      if (!url) {
        if (isMounted) setError("Please open a GitHub repository");
        return;
      }

      if (tab.status !== "complete") {
        if (isMounted) setError("Page is still loading, try again");
        return;
      }

      if (tab.title?.toLowerCase().includes("page not found")) {
        if (isMounted) setError("This GitHub repository doesn't exist");
        return;
      }

      const result = parseRepoUrl(url);

      if (!result.valid) {
        if (isMounted) setError(result.reason);
        return;
      }

      if (isMounted) {
        setRepoName(result.fullName);
        setRepoUrl(url);
        setError("");
        setCheckingStatus(true);
      }

      try {
        const res = await api.checkRepoStatus(result.fullName);
        if (!isMounted) return;
        if (res.ok) {
          const status = res.data.status;
          if (status === "pending" || status === "completed") {
            onIngestStarted(res.data.job_id);
            return;
          }
        }
      } catch (err) {
        console.error("Failed to check repository status:", err);
      } finally {
        if (isMounted) {
          setCheckingStatus(false);
        }
      }
    }

    loadPageUrl();

    return () => {
      isMounted = false;
    };
  }, [onIngestStarted]);

  async function handleClick() {
    if (!repoUrl) return;
    setLoading(true);
    setError("");
    setSuccess(false);
    try {
      const res = await api.ingest(repoUrl);
      if (res.ok) {
        setSuccess(true);
        console.log("Ingestion started with job_id:", res.data.job_id);
        setTimeout(() => {
          onIngestStarted(res.data.job_id);
        }, 800);
      } else {
        setError(res.message);
      }
    } catch (err) {
      setError("Failed to start ingestion");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Typography
          variant="headline"
          className="tracking-tight text-foreground font-semibold"
        >
          askRepo
        </Typography>
        <Typography
          variant="body-sm"
          className="text-muted-foreground leading-normal"
        >
          An AI-powered browser extension that lets you chat with any GitHub
          repository. Index it once, ask anything.
        </Typography>
      </div>

      <div className="p-4 rounded-lg border bg-card text-card-foreground min-h-[74px] flex flex-col justify-center">
        {checkingStatus ? (
          <div className="flex items-center gap-2">
            <Spinner className="h-4 w-4 text-primary" />
            <Typography variant="body-sm" className="text-muted-foreground font-medium">
              Checking repository status...
            </Typography>
          </div>
        ) : !error ? (
          <div className="space-y-2">
            <Typography
              variant="eyebrow"
              className="text-muted-foreground font-bold font-mono"
            >
              Detected Repository
            </Typography>
            <Typography
              variant="mono"
              className="text-foreground truncate block"
            >
              {repoName}
            </Typography>
          </div>
        ) : (
          <div>
            <Typography variant={"mono"} className="text-destructive">Error: {error}</Typography>
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-6">
        <LoadingButton loading={loading} className="w-full font-medium" onClick={handleClick} disabled={error !== "" || loading || checkingStatus}>
          {success ? "Indexing started" : "Index Repository"}
        </LoadingButton>
      </div>
    </div>
  );
}
