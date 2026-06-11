import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Typography } from "@/components/typography/Typography";
import { Spinner } from "@/components/ui/spinner";
import { api, IngestionStatusData } from "@/lib/api";
import { CheckCircle2, AlertCircle, HardDrive, FileCode } from "lucide-react";
import GitHubIcon from "@/components/icons/Github";

interface ProgressScreenProps {
  jobId: number;
  onBack: () => void;
}

export default function ProgressScreen({ jobId, onBack }: ProgressScreenProps) {
  const [data, setData] = useState<IngestionStatusData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let timerId: any = null;

    async function fetchStatus() {
      try {
        const res = await api.status(jobId);
        if (!active) return;

        if (res.ok) {
          setData(res.data);
          setError("");

          if (res.data.status === "completed" || res.data.status === "failed") {
            return;
          }

          timerId = setTimeout(fetchStatus, 2000);
        } else {
          setError(res.message);
        }
      } catch (err) {
        if (active) {
          setError("Failed to fetch ingestion status");
        }
      }
    }

    fetchStatus();

    return () => {
      active = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [jobId]);

  const isPending = data?.status === "pending" || (!data && !error);
  const isCompleted = data?.status === "completed";
  const isFailed = data?.status === "failed" || !!error;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="space-y-1">
        <Typography variant="headline" className="font-semibold tracking-tight">
          {isCompleted ? "Index Complete" : isFailed ? "Index Failed" : "Indexing Repository"}
        </Typography>
        <Typography variant="caption" className="text-muted-foreground block">
          {isCompleted 
            ? "Your repository is ready to be queried." 
            : isFailed 
            ? "Something went wrong during the indexing process." 
            : "We are cloning and parsing your codebase."
          }
        </Typography>
      </div>

      <div className="rounded-xl text-card-foreground space-y-5 relative">
        {/* Repo details row */}
        {data && (
          <div className="flex items-center gap-3 border-b pb-4">
            <div className="p-2 bg-secondary rounded-lg border">
              <GitHubIcon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <Typography variant="mono" className="text-foreground text-sm font-semibold truncate block">
                {data.repo_name}
              </Typography>
              
            </div>
          </div>
        )}

        <div className="space-y-3">
          {isPending && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Spinner className="h-5 w-5 text-primary shrink-0" />
                <Typography variant="body-sm" className="font-medium text-foreground">
                  Parsing codebase
                </Typography>
              </div>
             
            </div>
          )}

          {isCompleted && (
            <div className="flex items-start gap-3 bg-emerald-500/10 p-4 rounded-lg border border-emerald-500/20">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <Typography variant="body-sm" className="font-semibold text-emerald-500 block">
                  Successfully Indexed
                </Typography>
                <Typography variant="caption" className="text-muted-foreground block mt-1 break-inside-auto">
                  Codebase has been parsed and it is ready!
                </Typography>
              </div>
            </div>
          )}

          {isFailed && (
            <div className="flex items-start gap-3 bg-destructive/10 p-4 rounded-lg border border-destructive/20">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <Typography variant="body-sm" className="font-semibold text-destructive block">
                  Error Occurred
                </Typography>
                <Typography variant="caption" className="text-destructive-foreground/80 block mt-1 font-mono text-xs max-h-24 overflow-y-auto break-inside-auto">
                  {error || data?.error_message || "Unknown error during ingestion."}
                </Typography>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Back/Home button - ONLY shown on error/failure */}
      {isFailed && (
        <div className="pt-2">
          <Button variant="outline" className="w-full" onClick={onBack}>
            Back to Home
          </Button>
        </div>
      )}
    </div>
  );
}
