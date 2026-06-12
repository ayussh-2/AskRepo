import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Typography } from "@/components/typography/Typography";
import { Spinner } from "@/components/ui/spinner";
import { api, IngestionStatusData } from "@/lib/api";
import { CheckCircle2, AlertCircle } from "lucide-react";
import GitHubIcon from "@/components/icons/Github";
import { cn } from "@/lib/utils";

interface ProgressScreenProps {
  jobId: number;
  onBack: () => void;
}

interface ProgressCardProps {
  title: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
  isError?:boolean
}

function ProgressCard({ title, icon, children,isError }: ProgressCardProps) {
  return (
    <div>
      <Typography
        variant="body-sm"
        className={`font-semibold ${isError && "text-destructive"}`}
      >
        <div className="flex items-center gap-1">

        {icon}
        {title}
        </div>
      </Typography>
      <Typography
        variant="caption"
className={cn(
  "block mt-2 break-inside-auto", 
  isError ? "text-destructive/80" : "text-muted-foreground"
)}      >
        {children && children}
      </Typography>
    </div>
  );
}

export default function ProgressScreen({ jobId, onBack }: ProgressScreenProps) {
  const [data, setData] = useState<IngestionStatusData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let timerId: NodeJS.Timeout | number | null = null; // Typed the timer ID

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
          {isCompleted
            ? "Index Complete"
            : isFailed
              ? "Index Failed"
              : "Indexing Repository"}
        </Typography>
        <Typography variant="caption" className="text-muted-foreground block">
          {isCompleted
            ? "Your repository is ready to be queried."
            : isFailed
              ? "Something went wrong during the indexing process."
              : "We are cloning and parsing your codebase."}
        </Typography>
      </div>

      <div className="rounded-xl text-card-foreground space-y-5 relative">
        {data && (
          <div className="flex items-center gap-3 border-b pb-4">
            <div className="p-2 bg-secondary rounded-lg border">
              <GitHubIcon className="size-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <Typography
                variant="mono"
                className="text-foreground text-sm font-semibold truncate block"
              >
                {data.repo_name}
              </Typography>
            </div>
          </div>
        )}

        <div className="space-y-3">

          {isPending && (
            <ProgressCard
              title="Parsing Codebase"
              icon={<Spinner className="size-4  shrink-0" />}
            >
              
            </ProgressCard>
          )}

          {isCompleted && (
            <ProgressCard
              title="Successfully Indexed"
              icon={<CheckCircle2 className="size-4 shrink-0 mt-0.5" />}
            >
              <div className="flex flex-col gap-2">
                Codebase has been parsed and it is ready!
                <Button className="mt-5" variant="default">
                  Start Chat Session
                </Button>
              </div>
            </ProgressCard>
          )}

          {isFailed && (
            <ProgressCard
            isError={true}
              title="Error Occurred"
              icon={<AlertCircle className="size-4 shrink-0 mt-0.5 text-destructive" />}
            >
              {error ||
                data?.error_message ||
                "Unknown error during ingestion."}
            </ProgressCard>
          )}

         
        </div>
      </div>

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
