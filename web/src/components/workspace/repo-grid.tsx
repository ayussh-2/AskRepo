import * as React from "react";
import { Search, RefreshCw, Plus, Database, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { RepoCard, RepoCardItem } from "./repo-card";

export interface RepoGridProps {
  repos: RepoCardItem[];
  filteredRepos: RepoCardItem[];
  searchFilter: string;
  onSearchChange: (value: string) => void;
  loadingRepos: boolean;
  onLoadRepos: () => void;
  isJobActive: boolean;
  activeJobRepoName: string | null;
  isNewRepoBeingIngested: boolean;
  progressDataStatus?: string | null;
  checkingSync: Record<
    string,
    "checking" | "up-to-date" | "out-of-sync" | "error"
  >;
  onIndexNew: () => void;
  onSelectRepo: (repoName: string) => void;
  onCheckSync: (repoName: string) => void;
}

export const RepoGrid: React.FC<RepoGridProps> = ({
  filteredRepos,
  searchFilter,
  onSearchChange,
  loadingRepos,
  onLoadRepos,
  isJobActive,
  activeJobRepoName,
  isNewRepoBeingIngested,
  progressDataStatus,
  checkingSync,
  onIndexNew,
  onSelectRepo,
  onCheckSync,
}) => {
  return (
    <div className="p-6 max-w-5xl mx-auto w-full space-y-10 pb-16">
      <div className="space-y-4">
        {/* Header Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#f7f8f8]">
              Indexed Repositories
            </h2>
            <p className="text-xs text-[#8a8f98]">
              Select a repository to open its chat session
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#62666d]" />
              <input
                type="text"
                placeholder="Search repositories..."
                value={searchFilter}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full bg-[#131416] border border-[#23252a] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#f7f8f8] placeholder-[#62666d] focus:outline-none"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onLoadRepos}
              disabled={loadingRepos}
              className="h-8 w-8 text-[#8a8f98] hover:text-[#f7f8f8]"
              title="Reload Repositories"
            >
              <RefreshCw
                size={14}
                className={loadingRepos ? "animate-spin" : ""}
              />
            </Button>
            <Button
              onClick={onIndexNew}
              className="px-3.5 py-1.5 bg-[#5e6ad2] text-white hover:bg-[#4e58b5] text-xs font-medium rounded-lg flex items-center gap-1"
            >
              <Plus size={14} />
              Index New
            </Button>
          </div>
        </div>

        {/* Empty State */}
        {filteredRepos.length === 0 && !isNewRepoBeingIngested ? (
          <Card className="p-8 text-center border-[#23252a] bg-[#0d0d0e]">
            <CardContent className="p-0 space-y-3">
              <Database className="size-10 text-[#62666d] mx-auto opacity-50" />
              <h3 className="text-base font-semibold text-[#f7f8f8]">
                No Repositories Found
              </h3>
              <p className="text-xs text-[#8a8f98] max-w-sm mx-auto">
                {searchFilter
                  ? "No indexed repositories match your search filter."
                  : "You haven't indexed any repositories yet. Click 'Index New' above to get started!"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Active indexing card */}
            {isNewRepoBeingIngested && (
              <Card className="border-[#5e6ad2]/60 bg-[#0d0d0e] shadow-[0_0_24px_rgba(94,106,210,0.15)] flex flex-col justify-between relative overflow-hidden">
                <CardHeader className="p-4 space-y-2">
                  <CardTitle className="text-base font-semibold text-[#f7f8f8] truncate">
                    {activeJobRepoName}
                  </CardTitle>
                  <CardDescription className="text-xs text-[#8a8f98]">
                    {progressDataStatus === "processing"
                      ? "Processing AST & embedding vectors..."
                      : "Queued for indexing in background..."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 flex items-center justify-between mt-2">
                  {/* <span className="text-[11px] text-[#62666d]">
                    Indexing in progress...
                  </span> */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#5e6ad2]/20 text-[#5e6ad2] border border-[#5e6ad2]/40 font-medium flex items-center gap-1.5">
                      <Loader2 className="animate-spin size-3" />
                      Indexing in progress...
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Existing repository cards */}
            {filteredRepos.map((r) => {
              const syncState = checkingSync[r.repo_name];
              const isUpdating =
                (isJobActive &&
                  Boolean(activeJobRepoName) &&
                  r.repo_name.toLowerCase() ===
                    (activeJobRepoName || "").toLowerCase()) ||
                r.status === "processing" ||
                r.status === "pending";

              return (
                <RepoCard
                  key={r.repo_name}
                  repo={r}
                  syncState={syncState}
                  isUpdating={isUpdating}
                  isJobActive={isJobActive}
                  activeJobRepoName={activeJobRepoName}
                  onSelect={onSelectRepo}
                  onCheckSync={onCheckSync}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
