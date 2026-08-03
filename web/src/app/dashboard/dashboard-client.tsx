"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  getUserName,
  getStoredToken,
  isValidRepoUrl,
  normalizeRepoUrl,
} from "@/lib/utils";
import { Sidebar } from "@/components/workspace/sidebar";
import { IngestScreen } from "@/components/workspace/ingest-screen";
import { ProgressScreen } from "@/components/workspace/progress-screen";
import { RepoGrid } from "@/components/workspace/repo-grid";
import { AuthModal } from "@/components/workspace/auth-modal";
import { toast } from "sonner";
import { useRepos } from "@/context/repo-context";
import { useIngest } from "@/hooks/use-ingest";

export default function DashboardClientPage() {
  const router = useRouter();

  const { repos, loadingRepos, checkingSync, loadRepos, handleCheckSync, clearSession } =
    useRepos();

  const [token, setToken] = useState<string | null>(() => getStoredToken());

  const [userName] = useState<string>(() => {
    const savedToken = token || getStoredToken();
    return savedToken ? getUserName(savedToken) : "User";
  });

  const [screen, setScreen] = useState<"dashboard" | "ingest" | "progress">(
    "dashboard",
  );

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");

  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleUnauthorized = useCallback(() => {
    setShowAuthModal(true);
  }, []);

  const {
    jobId,
    repoUrlInput,
    setRepoUrlInput,
    ingestLoading,
    ingestError,
    progressData,
    startIngest,
  } = useIngest(token, handleUnauthorized, loadRepos);

  const handleLogout = () => {
    clearSession();
    setToken(null);
    router.push("/");
  };

  useEffect(() => {
    if (!token && typeof window !== "undefined") {
      router.push("/login");
    }
  }, [token, router]);

  useEffect(() => {
    if (typeof window === "undefined" || !token) return;
    const pendingRepo = localStorage.getItem("pending_repo_url");
    if (pendingRepo) {
      localStorage.removeItem("pending_repo_url");

      if (!isValidRepoUrl(pendingRepo)) {
        toast.error("Invalid repository URL passed from landing page.");
        return;
      }

      const targetUrl = normalizeRepoUrl(pendingRepo);
      toast.info(`Analyzing repository: ${targetUrl}`);
      startIngest(targetUrl, true);
    }
  }, [token, startIngest]);

  const handleIndexRepository = async () => {
    if (!token || !repoUrlInput.trim()) return;

    if (
      jobId &&
      (progressData?.status === "pending" ||
        progressData?.status === "processing")
    ) {
      toast.warning(
        `An ingestion job for "${progressData?.repo_name || "a repository"}" is currently active. Please wait for it to finish.`,
      );
      return;
    }

    await startIngest(repoUrlInput);
    setScreen("dashboard");
  };

  const activeJobRepoName =
    typeof window !== "undefined"
      ? localStorage.getItem("active_ingest_repo_name") ||
        progressData?.repo_name ||
        null
      : null;

  const isJobActive =
    Boolean(jobId) &&
    (progressData === null ||
      progressData.status === "pending" ||
      progressData.status === "processing");

  const isNewRepoBeingIngested =
    isJobActive &&
    Boolean(activeJobRepoName) &&
    !repos.some(
      (r) =>
        r.repo_name.toLowerCase() === (activeJobRepoName || "").toLowerCase(),
    );

  const filteredRepos = repos.filter((r) =>
    r.repo_name.toLowerCase().includes(searchFilter.toLowerCase()),
  );

  if (!token) return null;

  return (
    <div className="flex bg-[#010102] text-[#f7f8f8] h-screen w-full font-sans antialiased overflow-hidden relative">
      <Sidebar
        repos={repos}
        activeRepo={null}
        sidebarOpen={sidebarOpen}
        mobileSidebarOpen={mobileSidebarOpen}
        loadingRepos={loadingRepos}
        checkingSync={checkingSync}
        userName={userName}
        onSelectRepo={(name) =>
          router.push(`/chat?repo=${encodeURIComponent(name)}`)
        }
        onNewIngest={() => {
          if (isJobActive) {
            toast.warning(
              `An ingestion job for "${activeJobRepoName || "a repository"}" is currently active. Please wait for it to complete.`,
            );
          } else {
            setScreen("ingest");
          }
        }}
        onCheckSync={handleCheckSync}
        onSyncNow={(name) => {
          if (isJobActive) {
            toast.warning(
              `An ingestion job is currently running in the background.`,
            );
            return;
          }
          const repoUrl = `https://github.com/${name}`;
          setRepoUrlInput(repoUrl);
          setScreen("ingest");
        }}
        onReloadRepos={loadRepos}
        onCloseSidebar={() => setSidebarOpen(false)}
        onOpenSidebar={() => setSidebarOpen(true)}
        onCloseMobileSidebar={() => setMobileSidebarOpen(false)}
        onLogout={handleLogout}
      />

      <main className="flex-1 flex flex-col min-w-0 h-full bg-[#010102] relative z-10 w-full overflow-y-auto custom-scrollbar">
        <div className="flex-1 flex flex-col pt-4">
          {screen === "ingest" ? (
            <div className="p-6 max-w-4xl mx-auto w-full">
              <Button
                variant="ghost"
                onClick={() => setScreen("dashboard")}
                className="mb-4 text-xs text-[#8a8f98] hover:text-[#f7f8f8]"
              >
                ← Back to Dashboard
              </Button>
              <IngestScreen
                repoUrlInput={repoUrlInput}
                ingestLoading={ingestLoading}
                ingestError={ingestError}
                repos={repos}
                isJobActive={isJobActive}
                activeJobRepoName={activeJobRepoName}
                onChangeUrl={setRepoUrlInput}
                onIndexRepo={handleIndexRepository}
                onSelectRepo={(name) =>
                  router.push(`/chat?repo=${encodeURIComponent(name)}`)
                }
              />
            </div>
          ) : screen === "progress" ? (
            <div className="p-6 max-w-4xl mx-auto w-full">
              <ProgressScreen
                progressData={progressData}
                onStartChat={() => {
                  if (repos[0]?.repo_name) {
                    router.push(
                      `/chat?repo=${encodeURIComponent(repos[0].repo_name)}`,
                    );
                  } else {
                    setScreen("dashboard");
                  }
                }}
                onBackHome={() => {
                  setScreen("dashboard");
                }}
              />
            </div>
          ) : (
            <RepoGrid
              repos={repos}
              filteredRepos={filteredRepos}
              searchFilter={searchFilter}
              onSearchChange={setSearchFilter}
              loadingRepos={loadingRepos}
              onLoadRepos={loadRepos}
              isJobActive={isJobActive}
              activeJobRepoName={activeJobRepoName}
              isNewRepoBeingIngested={isNewRepoBeingIngested}
              progressDataStatus={progressData?.status}
              checkingSync={checkingSync}
              onIndexNew={() => {
                if (isJobActive) {
                  toast.warning(
                    `An ingestion job for "${activeJobRepoName || "a repository"}" is currently active. Please wait for it to complete.`,
                  );
                } else {
                  setScreen("ingest");
                }
              }}
              onSelectRepo={(name) => {
                const targetRepo = repos.find((r) => r.repo_name === name);
                if (
                  targetRepo?.status === "processing" ||
                  targetRepo?.status === "pending"
                ) {
                  toast.info(
                    `Repository ${name} is currently being processed.`,
                  );
                } else {
                  router.push(`/chat?repo=${encodeURIComponent(name)}`);
                }
              }}
              onCheckSync={(name) => {
                if (isJobActive) {
                  toast.warning(
                    `An ingestion job is currently running for "${activeJobRepoName}".`,
                  );
                } else {
                  handleCheckSync(name);
                }
              }}
            />
          )}
        </div>
      </main>

      {/* 401 Re-Login Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onLoginAgain={() => {
          setShowAuthModal(false);
          handleLogout();
        }}
      />
    </div>
  );
}
