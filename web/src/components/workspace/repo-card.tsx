import * as React from "react";
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export interface RepoCardItem {
  repo_name: string;
  status?: string;
}

export interface RepoCardProps {
  repo: RepoCardItem;
  syncState?: "checking" | "up-to-date" | "out-of-sync" | "error";
  isUpdating: boolean;
  isJobActive: boolean;
  activeJobRepoName: string | null;
  onSelect: (repoName: string) => void;
  onCheckSync: (repoName: string) => void;
}

export const RepoCard: React.FC<RepoCardProps> = ({
  repo,
  syncState,
  isUpdating,
  onSelect,
  onCheckSync,
}) => {
  return (
    <Card
      className={`border-[#23252a] bg-[#0d0d0e] hover:border-[#3a3f47] transition-all duration-150 flex flex-col justify-between group cursor-pointer ${
        isUpdating
          ? "border-[#5e6ad2]/60 shadow-[0_0_16px_rgba(94,106,210,0.12)]"
          : ""
      }`}
      onClick={() => onSelect(repo.repo_name)}
    >
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          {isUpdating && (
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#5e6ad2]/20 text-[#5e6ad2] border border-[#5e6ad2]/40 font-medium flex items-center gap-1.5">
              <Loader2 className="animate-spin size-3" />
              Processing...
            </span>
          )}
        </div>
        <CardTitle className="text-base font-semibold text-[#f7f8f8] group-hover:text-white transition-colors truncate">
          {repo.repo_name}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onCheckSync(repo.repo_name);
          }}
          className="h-7 px-2 text-[11px] text-[#8a8f98] hover:text-[#f7f8f8] -ml-2"
        >
          {syncState === "checking" ? (
            <RefreshCw size={12} className="animate-spin" />
          ) : syncState === "up-to-date" ? (
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={11} /> Up to date
            </span>
          ) : syncState === "out-of-sync" ? (
            <span className="text-amber-400 flex items-center gap-1">
              <AlertCircle size={11} /> Out of sync
            </span>
          ) : syncState === "error" ? (
            <span className="text-red-400 flex items-center gap-1">
              <AlertCircle size={11} /> Sync error
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <RefreshCw size={11} /> Check Sync
            </span>
          )}
        </Button>

        <ArrowRight
          size={14}
          className="text-[#8a8f98] group-hover:translate-x-1 group-hover:text-[#f7f8f8] transition-all"
        />
      </CardContent>
    </Card>
  );
};
