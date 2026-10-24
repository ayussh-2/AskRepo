import * as React from "react";
import {
  Plus,
  RefreshCw,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarRepoItem } from "./sidebar-repo-item";
import { RepoItem, SyncStatus, SidebarProps } from "./sidebar-types";

export type { RepoItem, SyncStatus, SidebarProps };

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
  onOpenSidebar,
  onCloseMobileSidebar,
  onLogout,
}) => {
  const renderRepoList = () => (
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
          {repos.map((repo) => (
            <SidebarRepoItem
              key={repo.repo_name}
              repo={repo}
              isActive={activeRepo === repo.repo_name}
              syncStatus={checkingSync[repo.repo_name]}
              onSelectRepo={onSelectRepo}
              onCheckSync={onCheckSync}
              onSyncNow={onSyncNow}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Floating Toggle Button when Sidebar is closed */}
      {!sidebarOpen && (
        <Button
          variant="ghost"
          size="sm"
          className="fixed top-3 left-3 z-30 h-8 w-8 p-0 bg-[#0d0d0e]/80 border border-[#23252a] text-[#8a8f98] hover:text-[#f7f8f8] hover:bg-[#1a1b1e] backdrop-blur-sm shadow-md"
          onClick={onOpenSidebar}
          title="Open Sidebar"
        >
          <PanelLeftOpen size={16} />
        </Button>
      )}

      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col border-r border-[#23252a] bg-[#0d0d0e] transition-all duration-300 relative z-20 ${
          sidebarOpen ? "w-64 min-w-[16rem] p-4" : "w-0 min-w-0 p-0 overflow-hidden border-none"
        }`}
      >
        <div className="flex items-center justify-between pb-4 border-b border-[#23252a]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-lg bg-[#5e6ad2]/20 border border-[#5e6ad2]/30 flex items-center justify-center font-bold text-xs text-[#5e6ad2] shrink-0">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs font-semibold text-[#f7f8f8] truncate">
              {userName}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onCloseSidebar}
              className="text-[#8a8f98] hover:text-[#f7f8f8] p-1.5 rounded-md hover:bg-[#1a1b1e] transition-colors cursor-pointer"
              title="Close sidebar"
            >
              <PanelLeftClose size={15} />
            </button>
            <button
              onClick={onLogout}
              className="text-[#8a8f98] hover:text-red-400 p-1.5 rounded-md hover:bg-red-950/20 transition-colors cursor-pointer"
              title="Log out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>

        <div className="py-4">
          <Button
            onClick={onNewIngest}
            className="w-full text-xs font-medium py-2 flex items-center justify-center gap-1.5 bg-[#5e6ad2] hover:bg-[#4b55be] text-white rounded-lg shadow-sm"
          >
            <Plus size={14} /> Index New Repo
          </Button>
        </div>

        {renderRepoList()}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobileSidebar}
          />
          <aside className="relative flex-1 flex flex-col max-w-xs w-full bg-[#0d0d0e] border-r border-[#23252a] p-4 z-50">
            <div className="flex items-center justify-between pb-4 border-b border-[#23252a]">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-7 w-7 rounded-lg bg-[#5e6ad2]/20 border border-[#5e6ad2]/30 flex items-center justify-center font-bold text-xs text-[#5e6ad2] shrink-0">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-semibold text-[#f7f8f8] truncate">
                  {userName}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={onCloseMobileSidebar}
                  className="text-[#8a8f98] hover:text-[#f7f8f8] p-1.5 rounded-md hover:bg-[#1a1b1e] transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
                <button
                  onClick={onLogout}
                  className="text-[#8a8f98] hover:text-red-400 p-1.5 rounded-md hover:bg-red-950/20 transition-colors cursor-pointer"
                  title="Log out"
                >
                  <LogOut size={15} />
                </button>
              </div>
            </div>

            <div className="py-4">
              <Button
                onClick={() => {
                  onCloseMobileSidebar();
                  onNewIngest();
                }}
                className="w-full text-xs font-medium py-2 flex items-center justify-center gap-1.5 bg-[#5e6ad2] hover:bg-[#4b55be] text-white rounded-lg shadow-sm"
              >
                <Plus size={14} /> Index New Repo
              </Button>
            </div>

            {renderRepoList()}
          </aside>
        </div>
      )}
    </>
  );
};
