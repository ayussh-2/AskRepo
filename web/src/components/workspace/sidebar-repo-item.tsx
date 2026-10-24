"use client";

import * as React from "react";
import {
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { RepoItem, SyncStatus } from "./sidebar-types";

export interface SidebarRepoItemProps {
  repo: RepoItem;
  isActive: boolean;
  syncStatus?: SyncStatus;
  onSelectRepo: (repoName: string) => void;
  onCheckSync: (repoName: string) => void;
  onSyncNow: (repoName: string) => void;
}

export const SidebarRepoItem: React.FC<SidebarRepoItemProps> = ({
  repo,
  isActive,
  syncStatus,
  onSelectRepo,
  onCheckSync,
  onSyncNow,
}) => {
  const isProcessing = repo.status === "processing" || repo.status === "pending";

  const handleClick = () => {
    if (isProcessing) {
      toast.info(
        `Repository ${repo.repo_name} is currently being processed. Please wait until indexing finishes.`,
      );
    } else {
      onSelectRepo(repo.repo_name);
    }
  };

  return (
    <div
      className={`p-3 rounded-lg border flex flex-col gap-2 transition-all duration-150 group ${
        isProcessing
          ? "opacity-75 bg-[#131416]/30 border-[#23252a] cursor-not-allowed"
          : isActive
            ? "bg-[#202020] border-[#5e6ad2]/40 cursor-pointer"
            : "bg-[#131416]/40 border-[#23252a] hover:bg-[#1a1b1e] cursor-pointer"
      }`}
      onClick={handleClick}
    >
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 truncate">
          <MessageSquare
            size={13}
            className={isActive ? "text-[#5e6ad2]" : "text-[#8a8f98]"}
          />
          <span
            className={`text-[13px] font-medium truncate block ${
              isActive ? "text-[#f7f8f8]" : "text-[#d0d6e0]"
            }`}
          >
            {repo.repo_name}
          </span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onCheckSync(repo.repo_name);
          }}
          disabled={syncStatus === "checking"}
          title="Check sync"
          className="text-[#8a8f98] hover:text-[#f7f8f8] disabled:text-[#62666d] p-1 rounded hover:bg-[#202020] shrink-0 cursor-pointer"
        >
          <RefreshCw
            size={11}
            className={syncStatus === "checking" ? "animate-spin" : ""}
          />
        </button>
      </div>

      {isProcessing ? (
        <div className="flex items-center gap-1.5 text-[11px] bg-[#5e6ad2]/10 border border-[#5e6ad2]/30 px-2 py-1 rounded text-[#5e6ad2]">
          <Loader2 size={10} className="animate-spin" />
          <span className="font-medium">Processing...</span>
        </div>
      ) : (
        syncStatus && (
          <div className="flex items-center justify-between gap-1 text-[11px] bg-[#0d0d0e] px-2 py-1 rounded">
            {syncStatus === "up-to-date" && (
              <span className="text-[#27a644] font-medium flex items-center gap-1">
                <CheckCircle2 size={10} /> Up to date
              </span>
            )}
            {syncStatus === "out-of-sync" && (
              <>
                <span className="text-amber-400 font-medium flex items-center gap-1">
                  <AlertCircle size={10} /> Outdated
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSyncNow(repo.repo_name);
                  }}
                  className="text-[#5e6ad2] hover:text-[#828fff] font-bold underline cursor-pointer"
                >
                  Sync
                </button>
              </>
            )}
            {syncStatus === "error" && (
              <span className="text-red-400 font-medium flex items-center gap-1">
                <AlertCircle size={10} /> Check failed
              </span>
            )}
          </div>
        )
      )}
    </div>
  );
};
