import * as React from "react";
import {
  Plus,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  ChevronLeft,
  LogOut,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export interface RepoItem {
  repo_name: string;
  status: string;
  latest_commit_sha: string;
}

export interface SidebarProps {
  repos: RepoItem[];
  activeRepo: string | null;
  sidebarOpen: boolean;
  mobileSidebarOpen: boolean;
  loadingRepos: boolean;
  checkingSync: Record<
    string,
    "checking" | "up-to-date" | "out-of-sync" | "error"
  >;
  userName: string;
  onSelectRepo: (repoName: string) => void;
  onNewIngest: () => void;
  onCheckSync: (repoName: string) => void;
  onSyncNow: (repoName: string) => void;
  onReloadRepos: () => void;
  onCloseSidebar: () => void;
  onCloseMobileSidebar: () => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  repos,
  activeRepo,
  sidebarOpen,
  mobileSidebarOpen,
  loadingRepos,
  checkingSync,
  userName,
  onSelectRepo,
  onNewIngest,
  onCheckSync,
  onSyncNow,
  onReloadRepos,
  onCloseSidebar,
  onCloseMobileSidebar,
  onLogout,
}) => {
  const sidebarReposList = () => (
    <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1">
      <div className="flex justify-between items-center px-1 mb-2">
        <h3 className="text-[11px] font-bold text-[#8a8f98] uppercase tracking-widest font-mono">
          Your Repositories
        </h3>
        {repos.length > 0 && (
          <button
            onClick={onReloadRepos}
            className="text-xs text-[#8a8f98] hover:text-[#f7f8f8] flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RefreshCw
              size={11}
              className={loadingRepos ? "animate-spin" : ""}
            />
          </button>
        )}
      </div>

      {loadingRepos && repos.length === 0 ? (
        <div className="flex items-center gap-2 text-[#8a8f98] text-xs py-3 px-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#5e6ad2]" />
          <span>Fetching workspaces...</span>
        </div>
      ) : repos.length === 0 ? (
        <div className="text-[#8a8f98] text-xs italic py-3 px-2 text-center border border-dashed border-[#23252a] rounded-lg">
          No repos indexed yet.
        </div>
      ) : (
        <div className="space-y-1.5">
          {repos.map((repo) => {
            const syncStatus = checkingSync[repo.repo_name];
            const isActive = activeRepo === repo.repo_name;
            const isProcessing =
              repo.status === "processing" || repo.status === "pending";

            return (
              <div
                key={repo.repo_name}
                className={`p-3 rounded-lg border flex flex-col gap-2 transition-all duration-150 group ${
                  isProcessing
                    ? "opacity-75 bg-[#131416]/30 border-[#23252a] cursor-not-allowed"
                    : isActive
                      ? "bg-[#202020] border-[#5e6ad2]/40 cursor-pointer"
                      : "bg-[#131416]/40 border-[#23252a] hover:bg-[#1a1b1e] cursor-pointer"
                }`}
                onClick={() => {
                  if (isProcessing) {
                    toast.info(
                      `Repository ${repo.repo_name} is currently being processed. Please wait until indexing finishes.`
                    );
                  } else {
                    onSelectRepo(repo.repo_name);
                  }
                }}
              >
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2 truncate">
                    <MessageSquare
                      size={13}
                      className={isActive ? "text-[#5e6ad2]" : "text-[#8a8f98]"}
                    />
                    <span
                      className={`text-[13px] font-medium truncate block ${isActive ? "text-[#f7f8f8]" : "text-[#d0d6e0]"}`}
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
                      className={
                        syncStatus === "checking" ? "animate-spin" : ""
                      }
                    />
                  </button>
                </div>

                {repo.status === "processing" || repo.status === "pending" ? (
                  <div className="flex items-center gap-1.5 text-[11px] bg-[#5e6ad2]/10 border border-[#5e6ad2]/30 px-2 py-1 rounded text-[#5e6ad2]  ">
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
          })}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* 1. Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col justify-between shrink-0 bg-[#0d0d0e] border-r border-[#23252a] transition-all duration-300 relative ${
          sidebarOpen ? "w-[280px]" : "w-0 overflow-hidden border-r-0"
        }`}
      >
        <div className="p-4 flex flex-col gap-5 flex-1 overflow-hidden">
          <div className="flex items-center justify-between px-1">
            <span
              onClick={onNewIngest}
              className="text-[15px] font-semibold text-[#f7f8f8] tracking-tight cursor-pointer"
            >
              askRepo Workspace
            </span>

            <Button
              variant="ghost"
              size="icon"
              onClick={onCloseSidebar}
              className="h-7 w-7 text-[#8a8f98] hover:text-[#f7f8f8]"
              title="Close sidebar"
            >
              <ChevronLeft size={16} />
            </Button>
          </div>

          <Button
            variant="secondary"
            onClick={onNewIngest}
            className="w-full flex items-center justify-center gap-2 text-xs font-medium"
          >
            <Plus size={14} />
            <span>Index New Repository</span>
          </Button>

          {sidebarReposList()}
        </div>

        <div className="p-4 border-t border-[#23252a] bg-[#0d0d0e] flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold text-[#8a8f98] uppercase tracking-widest font-mono block">
                Account
              </span>
              <span
                className="text-[13px] text-[#d0d6e0] font-medium truncate block mt-0.5"
                title={userName}
              >
                {userName}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onLogout}
              className="h-7 w-7 text-[#8a8f98] hover:text-red-400"
              title="Sign Out"
            >
              <LogOut size={14} />
            </Button>
          </div>
        </div>
      </aside>

      {/* 2. Mobile Sidebar Drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            onClick={onCloseMobileSidebar}
            className="fixed inset-0 bg-black/70 transition-opacity duration-300"
          />

          <aside className="relative flex flex-col justify-between w-[280px] h-full bg-[#0d0d0e] border-r border-[#23252a] p-4 shadow-2xl z-10">
            <div className="flex flex-col gap-5 flex-1 overflow-hidden">
              <div className="flex items-center justify-between px-1">
                <span className="text-[15px] font-semibold text-[#f7f8f8] tracking-tight">
                  askRepo Workspace
                </span>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onCloseMobileSidebar}
                  className="h-7 w-7 text-[#8a8f98] hover:text-[#f7f8f8]"
                >
                  <X size={16} />
                </Button>
              </div>

              <Button
                variant="secondary"
                onClick={onNewIngest}
                className="w-full flex items-center justify-center gap-2 text-xs font-medium"
              >
                <Plus size={14} />
                <span>Index New Repository</span>
              </Button>

              {sidebarReposList()}
            </div>

            <div className="p-2 border-t border-[#23252a] flex items-center justify-between gap-2 mt-4">
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-[#8a8f98] uppercase tracking-widest font-mono block">
                  Account
                </span>
                <span className="text-[13px] text-[#d0d6e0] font-medium truncate block mt-0.5">
                  {userName}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onLogout}
                className="h-7 w-7 text-[#8a8f98] hover:text-red-400"
              >
                <LogOut size={14} />
              </Button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
};
