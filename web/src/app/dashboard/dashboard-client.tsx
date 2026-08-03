"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  RefreshCw,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Lock,
  ArrowRight,
  Database,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  apiCall,
  getUserName,
  getStoredToken,
  isValidRepoUrl,
  normalizeRepoUrl,
} from "@/lib/utils";
import { Sidebar } from "@/components/workspace/sidebar";
import { IngestScreen } from "@/components/workspace/ingest-screen";
import { ProgressScreen } from "@/components/workspace/progress-screen";
import { toast } from "sonner";
import { useRepos } from "@/context/repo-context";

export default function DashboardClientPage() {
  const router = useRouter();

  // Use global repo context
  const { repos, loadingRepos, checkingSync, loadRepos, handleCheckSync } =
    useRepos();

  // Token & user state (Protected route)
  const [token, setToken] = useState<string | null>(() => getStoredToken());

  const [userName] = useState<string>(() => {
    const savedToken = token || getStoredToken();
    return savedToken ? getUserName(savedToken) : "User";
  });

  const [screen, setScreen] = useState<"dashboard" | "ingest" | "progress">(
    "dashboard",
  );

  // Synchronous state initializers for jobId and repoUrlInput
  const [jobId, setJobId] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const saved = localStorage.getItem("active_ingest_job_id");
    return saved ? Number(saved) : null;
  });

  const [repoUrlInput, setRepoUrlInput] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    const repoParam = params.get("repo");
    return repoParam ? decodeURIComponent(repoParam) : "";
  });

  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestError, setIngestError] = useState("");

  // Sidebar states
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");

  // Progress monitoring
  const [progressData, setProgressData] = useState<{
    status: string;
    error_message: string | null;
    repo_name?: string;
  } | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleUnauthorized = useCallback(() => {
    setShowAuthModal(true);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("google_auth_token");
    setToken(null);
    router.push("/");
  };

  useEffect(() => {
    if (!token && typeof window !== "undefined") {
      router.push("/login");
    }
  }, [token, router]);

  // Check for carried-forward repo query parameter from Home page or Login redirect
  useEffect(() => {
    if (typeof window === "undefined" || !token) return;
    const params = new URLSearchParams(window.location.search);
    const repoParam = params.get("repo");
    if (repoParam) {
      window.history.replaceState(null, "", window.location.pathname);

      if (!isValidRepoUrl(repoParam)) {
        toast.error("Invalid repository URL passed from landing page.");
        return;
      }

      const targetUrl = normalizeRepoUrl(repoParam);
      toast.info(`Analyzing repository: ${targetUrl}`);

      const triggerAutoIngest = async () => {
        setIngestLoading(true);
        setIngestError("");
        try {
          const res = await apiCall(
            "/ingest",
            "POST",
            { repo_url: targetUrl },
            token,
            handleUnauthorized,
          );
          const result = await res.json();
          if (res.ok && result.success) {
            const repoName = result.data.repo_name;
            if (
              result.data.already_indexed ||
              result.data.status === "completed"
            ) {
              if (repoName) {
                toast.success(
                  `Repository ${repoName} is ready! Opening chat session...`,
                );
                router.push(`/chat?repo=${encodeURIComponent(repoName)}`);
                return;
              }
            }
            if (result.data.job_id) {
              localStorage.setItem(
                "active_ingest_job_id",
                String(result.data.job_id),
              );
              if (repoName) {
                localStorage.setItem("active_ingest_repo_name", repoName);
              }
              setJobId(result.data.job_id);
            }
            setProgressData({
              status: result.data.status || "pending",
              error_message: null,
              repo_name: repoName,
            });
          } else {
            setIngestError(result.message || "Failed to trigger ingestion.");
            toast.error(result.message || "Failed to trigger ingestion.");
          }
        } catch {
          setIngestError("Failed to connect to backend server.");
          toast.error("Failed to connect to backend server.");
        } finally {
          setIngestLoading(false);
        }
      };

      triggerAutoIngest();
    }
  }, [token, router, handleUnauthorized]);

  // Monitor active progress job
  useEffect(() => {
    if (!jobId || !token) return;
    let active = true;
    let timerId: NodeJS.Timeout | null = null;
    let isInitialFetch = true;

    async function checkStatus() {
      try {
        const res = await apiCall(
          `/status?job_id=${jobId}`,
          "GET",
          null,
          token,
          handleUnauthorized,
        );
        if (!active) return;
        if (res.ok) {
          const result = await res.json();
          if (result.success && result.data) {
            const currentStatus = result.data.status;
            setProgressData(result.data);

            if (currentStatus === "completed") {
              localStorage.removeItem("active_ingest_job_id");
              localStorage.removeItem("active_ingest_repo_name");
              setJobId(null);
              setProgressData(null);
              loadRepos();

              // Only show completion toast if this wasn't a stale finished job on initial mount
              if (!isInitialFetch) {
                toast.success(
                  `Repository ${result.data.repo_name || ""} ingestion complete!`,
                );
              }
              return;
            } else if (currentStatus === "failed") {
              localStorage.removeItem("active_ingest_job_id");
              localStorage.removeItem("active_ingest_repo_name");
              setJobId(null);
              setProgressData(null);
              if (!isInitialFetch) {
                toast.error("Repository ingestion failed.");
              }
              return;
            }

            isInitialFetch = false;
            timerId = setTimeout(checkStatus, 2000);
          }
        }
      } catch (err) {
        console.error("Error checking ingestion status:", err);
      }
    }

    checkStatus();

    return () => {
      active = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [jobId, token, loadRepos, handleUnauthorized]);

  const handleIndexRepository = async () => {
    if (!token) return;
    if (!repoUrlInput.trim()) return;

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

    if (!isValidRepoUrl(repoUrlInput)) {
      const msg =
        "Please enter a valid GitHub or GitLab URL (e.g. github.com/owner/repo or owner/repo)";
      setIngestError(msg);
      toast.error(msg);
      return;
    }

    const targetUrl = normalizeRepoUrl(repoUrlInput);
    setIngestLoading(true);
    setIngestError("");
    try {
      const res = await apiCall(
        "/ingest",
        "POST",
        { repo_url: targetUrl },
        token,
        handleUnauthorized,
      );
      const result = await res.json();
      if (res.ok && result.success) {
        const repoName = result.data.repo_name;
        setRepoUrlInput("");

        if (result.data.already_indexed || result.data.status === "completed") {
          await loadRepos();
          if (repoName) {
            toast.success(
              `Repository ${repoName} is ready! Opening chat session...`,
            );
            router.push(`/chat?repo=${encodeURIComponent(repoName)}`);
            return;
          }
        }

        if (result.data.job_id) {
          localStorage.setItem(
            "active_ingest_job_id",
            String(result.data.job_id),
          );
          if (repoName) {
            localStorage.setItem("active_ingest_repo_name", repoName);
          }
          setJobId(result.data.job_id);
        }
        setScreen("dashboard");
        setProgressData({
          status: result.data.status || "pending",
          error_message: null,
          repo_name: repoName,
        });
        toast.success("Repository ingestion started in background!");
      } else {
        setIngestError(result.message || "Failed to trigger ingestion.");
        toast.error(result.message || "Failed to trigger ingestion.");
      }
    } catch {
      setIngestError("Failed to connect to backend server.");
      toast.error("Failed to connect to backend server.");
    } finally {
      setIngestLoading(false);
    }
  };

  const activeJobRepoName =
    progressData?.repo_name ||
    (typeof window !== "undefined"
      ? localStorage.getItem("active_ingest_repo_name")
      : null);

  const isJobActive = Boolean(
    jobId &&
    (progressData === null ||
      progressData.status === "pending" ||
      progressData.status === "processing"),
  );

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
      {/* Sidebar - Always visible for authenticated dashboard users */}
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
            /* Clean Dashboard Content */
            <div className="p-6 max-w-5xl mx-auto w-full space-y-10 pb-16">
              {/* Indexed Repositories */}
              <div className="space-y-4">
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
                        onChange={(e) => setSearchFilter(e.target.value)}
                        className="w-full bg-[#131416] border border-[#23252a] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#f7f8f8] placeholder-[#62666d] focus:outline-none"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={loadRepos}
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
                      onClick={() => {
                        if (isJobActive) {
                          toast.warning(
                            `An ingestion job for "${activeJobRepoName || "a repository"}" is currently active. Please wait for it to complete.`,
                          );
                        } else {
                          setScreen("ingest");
                        }
                      }}
                      className="px-3.5 py-1.5 bg-[#5e6ad2] text-white hover:bg-[#4e58b5] text-xs font-medium rounded-lg flex items-center gap-1"
                    >
                      <Plus size={14} />
                      Index New
                    </Button>
                  </div>
                </div>

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
                    {/* Brand new repository being indexed card */}
                    {isNewRepoBeingIngested && (
                      <Card className="border-[#5e6ad2]/60 bg-[#0d0d0e] shadow-[0_0_24px_rgba(94,106,210,0.15)] flex flex-col justify-between relative overflow-hidden">
                        {/* <div className="absolute top-0 left-0 right-0 h-1 bg-[#5e6ad2]  " /> */}
                        <CardHeader className="p-4 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-mono text-[#8a8f98] truncate">
                              {activeJobRepoName?.includes("gitlab")
                                ? "gitlab"
                                : "github"}
                            </span>
                            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#5e6ad2]/20 text-[#5e6ad2] border border-[#5e6ad2]/40 font-medium flex items-center gap-1.5">
                              <Loader2 className="animate-spin size-3" />
                              Indexing...
                            </span>
                          </div>
                          <CardTitle className="text-base font-semibold text-[#f7f8f8] truncate">
                            {activeJobRepoName}
                          </CardTitle>
                          <CardDescription className="text-xs text-[#8a8f98]">
                            {progressData?.status === "processing"
                              ? "Processing AST & embedding vectors..."
                              : "Queued for indexing in background..."}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 flex items-center justify-between border-t border-[#1e2024] mt-2">
                          <span className="text-[11px] text-[#62666d]">
                            Indexing in progress...
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setScreen("progress")}
                            className="h-7 px-2 text-[11px] text-[#5e6ad2] hover:text-white"
                          >
                            View Progress
                          </Button>
                        </CardContent>
                      </Card>
                    )}

                    {/* Existing repositories */}
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
                        <Card
                          key={r.repo_name}
                          className={`border-[#23252a] bg-[#0d0d0e] hover:border-[#3a3f47] transition-all duration-150 flex flex-col justify-between group cursor-pointer ${
                            isUpdating
                              ? "border-[#5e6ad2]/60 shadow-[0_0_16px_rgba(94,106,210,0.12)]"
                              : ""
                          }`}
                          onClick={() => {
                            if (
                              r.status === "processing" ||
                              r.status === "pending"
                            ) {
                              toast.info(
                                `Repository ${r.repo_name} is currently being processed.`,
                              );
                            } else {
                              router.push(
                                `/chat?repo=${encodeURIComponent(r.repo_name)}`,
                              );
                            }
                          }}
                        >
                          <CardHeader className="p-4 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-mono text-[#8a8f98] truncate">
                                {r.repo_name.includes("gitlab")
                                  ? "gitlab"
                                  : "github"}
                              </span>
                              {isUpdating ? (
                                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#5e6ad2]/20 text-[#5e6ad2] border border-[#5e6ad2]/40 font-medium flex items-center gap-1.5  ">
                                  <Loader2 className="animate-spin size-3" />
                                  Processing...
                                </span>
                              ) : (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-[#1e2024] text-[#8a8f98] border border-[#23252a] font-mono">
                                  Indexed
                                </span>
                              )}
                            </div>
                            <CardTitle className="text-base font-semibold text-[#f7f8f8] group-hover:text-white transition-colors truncate">
                              {r.repo_name}
                            </CardTitle>
                            <CardDescription className="text-xs text-[#8a8f98]">
                              {isUpdating
                                ? "Updating & re-embedding repository..."
                                : "Indexed and active in vector store"}
                            </CardDescription>
                          </CardHeader>

                          <CardContent className="p-4 pt-0 flex items-center justify-between border-t border-[#1e2024] mt-2">
                            <div className="flex items-center gap-1.5 text-xs text-[#8a8f98]">
                              <MessageSquare
                                size={13}
                                className="text-[#8a8f98]"
                              />
                              <span>Start Chat</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isJobActive) {
                                    toast.warning(
                                      `An ingestion job is currently running for "${activeJobRepoName}".`,
                                    );
                                  } else {
                                    handleCheckSync(r.repo_name);
                                  }
                                }}
                                className="h-7 px-2 text-[11px] text-[#8a8f98] hover:text-[#f7f8f8]"
                              >
                                {syncState === "checking" ? (
                                  <RefreshCw
                                    size={12}
                                    className="animate-spin"
                                  />
                                ) : syncState === "up-to-date" ? (
                                  <span className="text-emerald-400 flex items-center gap-1">
                                    <CheckCircle2 size={11} /> Up to date
                                  </span>
                                ) : syncState === "out-of-sync" ? (
                                  <span className="text-amber-400 flex items-center gap-1">
                                    <AlertCircle size={11} /> Out of sync
                                  </span>
                                ) : (
                                  "Check Sync"
                                )}
                              </Button>

                              <ArrowRight
                                size={14}
                                className="text-[#8a8f98] group-hover:translate-x-1 group-hover:text-[#f7f8f8] transition-all"
                              />
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 401 Re-Login Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <Card className="w-full max-w-sm p-6 text-center border-[#23252a] bg-[#0d0d0e] shadow-2xl">
            <CardHeader className="p-0 mb-4 space-y-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-[#1e2024] border border-[#23252a] flex items-center justify-center mb-2">
                <Lock className="w-6 h-6 text-[#8a8f98]" />
              </div>
              <CardTitle className="text-xl font-semibold text-[#f7f8f8]">
                Session Expired
              </CardTitle>
              <CardDescription className="text-sm text-[#8a8f98]">
                Your session has expired. Please sign in again to continue.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex flex-col gap-3">
              <Button
                variant="default"
                onClick={() => {
                  setShowAuthModal(false);
                  handleLogout();
                }}
                className="w-full py-2.5 text-sm font-medium bg-[#5e6ad2] text-white hover:bg-[#4e58b5]"
              >
                Log In Again
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
