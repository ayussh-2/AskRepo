import * as React from "react";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RepoItem } from "./sidebar";

const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
  </svg>
);

export interface IngestScreenProps {
  repoUrlInput: string;
  ingestLoading: boolean;
  ingestError: string;
  repos: RepoItem[];
  onChangeUrl: (url: string) => void;
  onIndexRepo: () => void;
  onSelectRepo: (repoName: string) => void;
}

export const IngestScreen: React.FC<IngestScreenProps> = ({
  repoUrlInput,
  ingestLoading,
  ingestError,
  repos,
  onChangeUrl,
  onIndexRepo,
  onSelectRepo,
}) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 w-full max-w-3xl mx-auto">
      <div className="text-center space-y-2 mb-8 mt-4 max-w-md">
        <h1 className="text-3xl font-semibold text-[#f7f8f8] tracking-tight">
          askRepo
        </h1>
        <p className="text-[#8a8f98] text-sm leading-relaxed">
          An AI workspace to chat with any GitHub repository. Index it once, ask
          anything.
        </p>
      </div>

      <Card className="w-full max-w-md p-6 border-[#23252a] bg-[#0d0d0e]">
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-[#8a8f98] uppercase tracking-widest font-mono">
              Target Repository URL
            </label>
            <Input
              type="text"
              placeholder="https://github.com/owner/repo"
              value={repoUrlInput}
              onChange={(e) => onChangeUrl(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  repoUrlInput.trim() &&
                  !ingestLoading
                ) {
                  onIndexRepo();
                }
              }}
            />
          </div>

          {ingestError && (
            <div className="flex items-center gap-2 text-red-400 text-xs bg-red-950/20 px-3 py-2 rounded border border-red-900/30">
              <AlertCircle size={13} />
              <span>{ingestError}</span>
            </div>
          )}

          <Button
            variant="default"
            onClick={onIndexRepo}
            disabled={!repoUrlInput.trim() || ingestLoading}
            className="w-full py-2.5 text-sm"
          >
            {ingestLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            <span>Index Repository</span>
          </Button>
        </div>
      </Card>

      {repos.length > 0 && (
        <div className="w-full max-w-md mt-8 space-y-3">
          <h3 className="text-[11px] font-bold text-[#8a8f98] uppercase tracking-widest font-mono">
            Indexed Workspaces
          </h3>

          <div className="grid grid-cols-1 gap-2.5">
            {repos.map((repo) => (
              <div
                key={repo.repo_name}
                onClick={() => onSelectRepo(repo.repo_name)}
                className="p-3.5 rounded-lg border border-[#23252a] bg-[#0d0d0e] hover:bg-[#131416] transition-colors cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <GithubIcon className="size-4 text-[#8a8f98] shrink-0" />
                  <span className="font-semibold text-sm text-[#f7f8f8] truncate">
                    {repo.repo_name}
                  </span>
                </div>
                <Badge variant="success">
                  <CheckCircle2 size={11} /> Ready
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
