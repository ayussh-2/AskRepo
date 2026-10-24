export interface RepoItem {
  repo_name: string;
  status: string;
  latest_commit_sha: string;
}

export type SyncStatus = "checking" | "up-to-date" | "out-of-sync" | "error";

export interface SidebarProps {
  repos: RepoItem[];
  activeRepo: string | null;
  sidebarOpen: boolean;
  mobileSidebarOpen: boolean;
  loadingRepos: boolean;
  checkingSync: Record<string, SyncStatus>;
  userName: string;
  onSelectRepo: (repoName: string) => void;
  onNewIngest: () => void;
  onCheckSync: (repoName: string) => void;
  onSyncNow: (repoName: string) => void;
  onReloadRepos: () => void;
  onCloseSidebar: () => void;
  onOpenSidebar?: () => void;
  onCloseMobileSidebar: () => void;
  onLogout: () => void;
}
