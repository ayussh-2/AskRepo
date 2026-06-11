import { Button } from "@/components/ui/button";
import { Typography } from "@/components/typography/Typography";
import { browser } from "wxt/browser";
import { useState, useEffect } from "react";
import {parseRepoUrl} from "@/utils/url-parser"
import LoadingButton from "@/components/LoadingButton";
import { api } from "@/lib/api";

export default function IngestScreen() {
  const [repoName, setRepoName] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadPageUrl();
  }, []);

  async function loadPageUrl() {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    const url = tab.url;

    if (!url) {
      setError("Please open a GitHub repository");
      return;
    }

    if (tab.status !== "complete") {
      setError("Page is still loading, try again");
      return;
    }

    if (tab.title?.toLowerCase().includes("page not found")) {
      setError("This GitHub repository doesn't exist");
      return;
    }

    const result = parseRepoUrl(url);

    if (!result.valid) {
      setError(result.reason);
      return;
    }

    setRepoName(result.fullName);
    setRepoUrl(url);
    setError("");
  }

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

      <div className="p-4 rounded-lg border bg-card text-card-foreground space-y-2">
        {!error ? (
          <>
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
          </>
        ) : (
          <>
            <Typography variant={"mono"} className="text-destructive">Error: {error}</Typography>
          </>
        )}
      </div>

      <div className="flex gap-2 mt-6">
        <LoadingButton loading={loading} className="w-full font-medium" onClick={handleClick} disabled={error !== "" || loading}>
          {success ? "Indexing started" : "Index Repository"}
        </LoadingButton>
      </div>
    </div>
  );
}
