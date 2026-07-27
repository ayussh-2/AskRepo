"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Plus, 
  Send, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  MessageSquare,
  ArrowLeft,
  LogOut
} from "lucide-react";

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

const BASE_URL = "http://localhost:8000";

// API call helper
async function apiCall(path: string, method: string = "GET", body?: any, token?: string | null) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

// Client-side JWT decoder to fetch Google username
function getUserName(token: string): string {
  if (token === "mock_google_id_token") return "Mock User";
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload));
    return decoded.name || decoded.email.split("@")[0] || "User";
  } catch (e) {
    return "User";
  }
}

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [userName, setUserName] = useState("User");
  const [screen, setScreen] = useState<"ingest" | "progress" | "chat">("ingest");
  const [jobId, setJobId] = useState<number | null>(null);
  const [activeRepo, setActiveRepo] = useState<string | null>(null);
  
  // Custom repo inputs
  const [repoUrlInput, setRepoUrlInput] = useState("");
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestError, setIngestError] = useState("");

  // Sidebar and sync states
  const [repos, setRepos] = useState<Array<{ repo_name: string; status: string; latest_commit_sha: string }>>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [checkingSync, setCheckingSync] = useState<Record<string, "checking" | "up-to-date" | "out-of-sync" | "error">>({});
  const [loadingRepos, setLoadingRepos] = useState(false);

  // Chat states
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "model"; content: string }>>([]);
  const [streamingText, setStreamingText] = useState("");

  // Progress monitoring
  const [progressData, setProgressData] = useState<{ status: string; error_message: string | null } | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Load auth token
  useEffect(() => {
    // 1. Check if we have an ID Token in the URL hash (returned from Google redirect)
    if (typeof window !== "undefined" && window.location.hash) {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const idToken = params.get("id_token");
      
      if (idToken) {
        localStorage.setItem("google_auth_token", idToken);
        setToken(idToken);
        setUserName(getUserName(idToken));
        // Clean URL hash
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        return;
      }
    }

    // 2. Otherwise check localStorage
    const savedToken = localStorage.getItem("google_auth_token");
    if (savedToken) {
      setToken(savedToken);
      setUserName(getUserName(savedToken));
    }
  }, []);

  // Fetch repos on login
  useEffect(() => {
    if (token) {
      loadRepos();
    }
  }, [token]);

  // Scroll to chat bottom
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, streamingText]);

  // Poll Ingestion Status if on progress screen
  useEffect(() => {
    if (screen !== "progress" || !jobId || !token) return;
    let active = true;
    let timerId: NodeJS.Timeout | null = null;

    async function checkStatus() {
      try {
        const res = await apiCall(`/status?job_id=${jobId}`, "GET", null, token);
        if (!active) return;
        if (res.ok) {
          const result = await res.json();
          if (result.success) {
            setProgressData(result.data);
            if (result.data.status === "completed") {
              // Reload repos sidebar list
              loadRepos();
            }
            if (result.data.status === "completed" || result.data.status === "failed") {
              return;
            }
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
  }, [screen, jobId, token]);

  const loadRepos = async () => {
    if (!token) return;
    setLoadingRepos(true);
    try {
      const res = await apiCall("/repos", "GET", null, token);
      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          setRepos(result.data.repos || []);
        }
      }
    } catch (err) {
      console.error("Failed to load repositories:", err);
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleLogin = () => {
    // Redirect to Google OAuth Consent Screen
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com";
    const redirectUri = window.location.origin;
    const nonce = Math.random().toString(36).substring(2);
    
    const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + 
      `client_id=${encodeURIComponent(clientId)}&` + 
      `redirect_uri=${encodeURIComponent(redirectUri)}&` + 
      `response_type=id_token&` + 
      `scope=${encodeURIComponent("openid email profile")}&` + 
      `nonce=${encodeURIComponent(nonce)}`;
      
    window.location.href = oauthUrl;
  };

  const handleLogout = () => {
    localStorage.removeItem("google_auth_token");
    setToken(null);
    setScreen("ingest");
    setJobId(null);
    setActiveRepo(null);
    setRepos([]);
    setMessages([]);
    setStreamingText("");
  };

  const handleIndexRepository = async () => {
    if (!repoUrlInput.trim() || !token) return;
    setIngestLoading(true);
    setIngestError("");
    try {
      const res = await apiCall("/ingest", "POST", { repo_url: repoUrlInput }, token);
      const result = await res.json();
      if (res.ok && result.success) {
        setScreen("progress");
        setJobId(result.data.job_id);
        setProgressData({ status: result.data.status || "pending", error_message: null });
        setRepoUrlInput("");
      } else {
        setIngestError(result.message || "Failed to trigger ingestion.");
      }
    } catch (err) {
      setIngestError("Failed to connect to backend server.");
    } finally {
      setIngestLoading(false);
    }
  };

  const handleCheckSync = async (repoName: string) => {
    if (!token) return;
    setCheckingSync((prev) => ({ ...prev, [repoName]: "checking" }));
    try {
      const res = await apiCall(`/check-sync?repo_name=${encodeURIComponent(repoName)}`, "GET", null, token);
      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          setCheckingSync((prev) => ({
            ...prev,
            [repoName]: result.data.up_to_date ? "up-to-date" : "out-of-sync"
          }));
        } else {
          setCheckingSync((prev) => ({ ...prev, [repoName]: "error" }));
        }
      } else {
        setCheckingSync((prev) => ({ ...prev, [repoName]: "error" }));
      }
    } catch (err) {
      setCheckingSync((prev) => ({ ...prev, [repoName]: "error" }));
    }
  };

  const handleSyncNow = async (repoName: string) => {
    if (!token) return;
    setCheckingSync((prev) => ({ ...prev, [repoName]: "checking" }));
    const repoUrl = `https://github.com/${repoName}`;
    try {
      const res = await apiCall("/ingest", "POST", { repo_url: repoUrl }, token);
      const result = await res.json();
      if (res.ok && result.success) {
        setScreen("progress");
        setJobId(result.data.job_id);
        setProgressData({ status: result.data.status || "pending", error_message: null });
      } else {
        setCheckingSync((prev) => ({ ...prev, [repoName]: "error" }));
      }
    } catch (err) {
      setCheckingSync((prev) => ({ ...prev, [repoName]: "error" }));
    }
  };

  const handleStartChatSession = (repoName: string) => {
    setActiveRepo(repoName);
    setMessages([]);
    setStreamingText("");
    setScreen("chat");
  };

  const handleSubmitQuery = async () => {
    if (!query.trim() || !activeRepo || !token) return;

    const userMessage = { role: "user" as const, content: query };
    setMessages((prev) => [...prev, userMessage]);
    const currentQuery = query;
    setQuery("");
    setStreamingText("Thinking...");

    try {
      const response = await fetch(`${BASE_URL}/query?repo_name=${encodeURIComponent(activeRepo)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: currentQuery,
          session_id: "web-session-123",
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        setStreamingText(`Error: ${errData.message || "Failed to get response."}`);
        return;
      }

      setStreamingText("");
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        setStreamingText((prev) => (prev === "Thinking..." ? text : prev + text));
      }

      setStreamingText((finalText) => {
        setMessages((prev) => [...prev, { role: "model", content: finalText }]);
        return "";
      });
    } catch (err) {
      console.error("Streaming error:", err);
      setStreamingText("Error: Connection lost.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmitQuery();
    }
  };

  const renderMessageContent = (text: string) => {
    if (text === "Thinking...") {
      return (
        <div className="flex items-center gap-2 text-zinc-500 font-mono text-xs py-1">
          <Loader2 className="h-4 w-4 animate-spin text-[#5e6ad2]" />
          <span>Gemini is thinking...</span>
        </div>
      );
    }

    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, index) => {
      if (part.startsWith("```")) {
        const lines = part.split("\n");
        const language = lines[0].replace("```", "").trim();
        const code = lines.slice(1, -1).join("\n");
        return (
          <pre
            key={index}
            className="bg-[#1b1b1c] border border-[#23252a] rounded-xl p-4 my-3 overflow-x-auto font-mono text-[13px] text-[#d0d6e0]"
          >
            {language && (
              <div className="text-[11px] text-zinc-500 font-bold uppercase mb-1 font-sans">
                {language}
              </div>
            )}
            <code>{code}</code>
          </pre>
        );
      }
      return (
        <span key={index} className="whitespace-pre-wrap leading-relaxed text-[#d0d6e0]">
          {part}
        </span>
      );
    });
  };

  // Sign-in Screen (Full screen modal layout matching extension design rules)
  if (!token) {
    return (
      <div className="flex-1 flex justify-center items-center bg-[#010102] text-[#f7f8f8] p-4 min-h-screen relative font-sans antialiased">
        {/* Background Radial Glow */}
        <div className="absolute inset-0 overflow-hidden flex items-center justify-center pointer-events-none z-0">
          <div className="w-[600px] h-[600px] rounded-full bg-[#5e6ad2]/5 opacity-60 blur-[130px]" />
        </div>

        {/* Auth Dialog Panel */}
        <div className="z-10 w-full max-w-sm bg-[#0d0d0e] border border-[#23252a] rounded-2xl p-8 shadow-2xl flex flex-col gap-6 text-center">
          <div className="space-y-2">
            <h2 className="text-[28px] font-semibold text-[#f7f8f8] tracking-tight leading-tight">
              Welcome to askRepo
            </h2>
            <p className="text-[14px] text-[#8a8f98] leading-relaxed max-w-[280px] mx-auto">
              Please sign in with your Google account to index and chat with your repositories.
            </p>
          </div>

          <button
            onClick={handleLogin}
            className="w-full bg-[#5e6ad2] hover:bg-[#828fff] text-white font-medium py-3 rounded-lg transition-colors duration-150 text-[14px] shadow-lg shadow-blue-900/10 cursor-pointer"
          >
            Sign In with Google
          </button>
        </div>
      </div>
    );
  }

  // Loaded Workspace
  return (
    <div className="flex-1 flex bg-[#010102] text-[#f7f8f8] min-h-screen font-sans antialiased relative overflow-hidden w-full">
      
      {/* Mobile Sidebar Backdrop Overlay */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 z-20 md:hidden transition-opacity duration-300 cursor-pointer"
        />
      )}

      {/* 1. Left Collapsible Sidebar */}
      <div 
        className={`fixed md:relative top-0 left-0 h-screen bg-[#0d0d0e] border-r border-[#23252a] flex flex-col justify-between transition-all duration-300 z-30 shrink-0 ${
          sidebarOpen ? "w-[280px] translate-x-0" : "w-0 -translate-x-full overflow-hidden border-r-0"
        }`}
      >
        <div className="p-5 flex flex-col gap-6 overflow-y-auto custom-scrollbar flex-1">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-semibold text-[#f7f8f8] tracking-tight">
              askRepo Workspace
            </span>
          </div>

          {/* List of Indexed Repos */}
          <div className="space-y-4">
            <h3 className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest font-mono">
              Your Repositories
            </h3>

            {loadingRepos && repos.length === 0 ? (
              <div className="flex items-center gap-2 text-zinc-500 text-xs py-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Loading...</span>
              </div>
            ) : repos.length === 0 ? (
              <div className="text-zinc-600 text-xs italic py-2">
                No indexed repositories. Index one on the right to get started.
              </div>
            ) : (
              <div className="space-y-2">
                {repos.map((repo) => {
                  const syncStatus = checkingSync[repo.repo_name];
                  return (
                    <div 
                      key={repo.repo_name}
                      className={`p-3 rounded-xl border flex flex-col gap-2 transition-all duration-150 ${
                        activeRepo === repo.repo_name 
                          ? "bg-[#202020]/40 border-[#5e6ad2]/30" 
                          : "bg-[#131416]/40 border-[#23252a]/60 hover:bg-[#1a1b1e]/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <span className="text-xs font-semibold text-zinc-300 truncate block flex-1">
                          {repo.repo_name}
                        </span>
                        
                        {/* Check Sync Button */}
                        <button
                          onClick={() => handleCheckSync(repo.repo_name)}
                          disabled={syncStatus === "checking"}
                          title="Check sync with remote"
                          className="text-zinc-500 hover:text-zinc-300 disabled:text-zinc-700 transition-colors duration-150 p-1 rounded hover:bg-zinc-800/40 shrink-0 cursor-pointer"
                        >
                          <RefreshCw size={12} className={syncStatus === "checking" ? "animate-spin" : ""} />
                        </button>
                      </div>

                      {/* Sync Indicator / Sync Trigger */}
                      {syncStatus && (
                        <div className="flex items-center justify-between gap-1 text-[11px]">
                          {syncStatus === "up-to-date" && (
                            <span className="text-[#27a644] font-medium flex items-center gap-1">
                              <CheckCircle2 size={10} /> Up to date
                            </span>
                          )}
                          {syncStatus === "out-of-sync" && (
                            <>
                              <span className="text-amber-400 font-medium flex items-center gap-1">
                                <AlertCircle size={10} /> Out of sync
                              </span>
                              <button 
                                onClick={() => handleSyncNow(repo.repo_name)}
                                className="text-[#5e6ad2] hover:text-[#828fff] font-bold underline cursor-pointer"
                              >
                                Sync Now
                              </button>
                            </>
                          )}
                          {syncStatus === "error" && (
                            <span className="text-red-400 font-medium flex items-center gap-1">
                              <AlertCircle size={10} /> Sync check failed
                            </span>
                          )}
                        </div>
                      )}

                      <button
                        onClick={() => handleStartChatSession(repo.repo_name)}
                        className={`w-full py-1.5 rounded-lg text-xs font-medium text-center transition-colors duration-150 cursor-pointer ${
                          activeRepo === repo.repo_name
                            ? "bg-[#5e6ad2] hover:bg-[#828fff] text-white"
                            : "bg-[#202020] hover:bg-zinc-800 text-zinc-300"
                        }`}
                      >
                        Start Chat
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-[#23252a] flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-bold text-zinc-600 uppercase tracking-widest font-mono">
              Account
            </span>
            <span className="text-xs text-zinc-300 font-medium truncate block">
              Hi {userName}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-[#202020] hover:bg-zinc-800 text-zinc-400 hover:text-red-400 py-2 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer border border-[#23252a]"
          >
            <LogOut size={12} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Sidebar Toggle Handle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className={`absolute top-5 transition-all duration-300 z-40 p-2 bg-[#131416]/80 hover:bg-[#202020] text-zinc-400 border border-[#23252a] rounded-full transition-colors duration-150 cursor-pointer shadow-lg ${
          sidebarOpen ? "left-[295px]" : "left-5"
        }`}
      >
        {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      {/* 2. Main Work Content (Centered layout matching extension style sheets) */}
      <div className="flex-1 flex flex-col justify-center items-center p-4 md:p-6 relative z-10 w-full">
        {/* Background Radial Glow */}
        <div className="absolute inset-0 overflow-hidden flex items-center justify-center pointer-events-none z-0">
          <div className="w-[500px] h-[500px] rounded-full bg-blue-900/5 opacity-50 blur-[130px]" />
        </div>

        {/* Center Card Container resembling the Extension Popup */}
        <div 
          className={`w-full bg-[#0d0d0e] border border-[#23252a] rounded-2xl shadow-2xl transition-all duration-300 z-10 flex flex-col relative ${
            screen === "chat" 
              ? "max-w-[760px] h-[calc(100vh-32px)] md:h-[640px] max-h-[640px]" 
              : "max-w-[380px] min-h-[420px] max-h-[calc(100vh-32px)]"
          }`}
        >
          {/* A. INGEST SCREEN */}
          {screen === "ingest" && (
            <div className="p-6 flex flex-col justify-between flex-1 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <h1 className="text-[28px] font-semibold text-[#f7f8f8] tracking-tight">
                    askRepo
                  </h1>
                  <p className="text-[14px] text-[#8a8f98] leading-relaxed">
                    An AI-powered workspace that lets you chat with any GitHub repository. Index it once, ask anything.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest font-mono">
                      Target Repository URL
                    </span>
                    <input
                      type="text"
                      placeholder="GitHub URL (e.g. owner/repo)"
                      value={repoUrlInput}
                      onChange={(e) => setRepoUrlInput(e.target.value)}
                      className="w-full bg-[#131416] border border-[#23252a] rounded-xl px-4 py-3 text-sm text-[#f7f8f8] placeholder-zinc-600 outline-none focus:border-zinc-700"
                    />
                  </div>
                  {ingestError && (
                    <span className="text-red-400 text-xs block">{ingestError}</span>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleIndexRepository}
                  disabled={!repoUrlInput.trim() || ingestLoading}
                  className="w-full bg-[#5e6ad2] hover:bg-[#828fff] disabled:bg-zinc-800 text-white font-medium py-3 rounded-lg transition-colors duration-150 text-[14px] cursor-pointer shadow-lg flex items-center justify-center gap-2"
                >
                  {ingestLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>Index Repository</span>
                </button>
              </div>
            </div>
          )}

          {/* B. PROGRESS SCREEN */}
          {screen === "progress" && (
            <div className="p-6 flex flex-col justify-between flex-1 gap-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-[22px] font-semibold text-[#f7f8f8] tracking-tight">
                    {progressData?.status === "completed"
                      ? "Index Complete"
                      : progressData?.status === "failed"
                        ? "Index Failed"
                        : "Indexing Repository"}
                  </h2>
                  <p className="text-xs text-zinc-500 leading-normal">
                    {progressData?.status === "completed"
                      ? "Your repository is ready to be queried."
                      : progressData?.status === "failed"
                        ? "Something went wrong during the indexing process."
                        : "We are cloning and parsing your codebase."}
                  </p>
                </div>

                <div className="border-t border-[#23252a] pt-4 flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#131416] border border-[#23252a] rounded-lg">
                      <GithubIcon className="size-4 text-zinc-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-semibold text-zinc-300 truncate block">
                        Indexing Target
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 mt-1">
                    {/* Parsing Codebase Status Block */}
                    {progressData?.status === "pending" && (
                      <div className="flex items-center gap-2 text-zinc-400 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin text-[#5e6ad2]" />
                        <span>Parsing Codebase...</span>
                      </div>
                    )}

                    {progressData?.status === "completed" && (
                      <div className="flex flex-col gap-1 text-sm text-[#27a644]">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="size-4 text-[#27a644] shrink-0" />
                          <span className="font-semibold">Successfully Indexed</span>
                        </div>
                        <span className="text-zinc-500 text-xs mt-1 block leading-normal">
                          Codebase has been parsed and is ready for vector querying!
                        </span>
                      </div>
                    )}

                    {progressData?.status === "failed" && (
                      <div className="flex flex-col gap-1 text-sm text-red-400">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="size-4 text-red-400 shrink-0" />
                          <span className="font-semibold">Error Occurred</span>
                        </div>
                        <span className="text-zinc-500 text-xs mt-1 block leading-normal">
                          {progressData?.error_message || "Unknown error during ingestion."}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {progressData?.status === "completed" && (
                  <button
                    onClick={() => handleStartChatSession(repos[0]?.repo_name || activeRepo || "")}
                    className="w-full bg-[#5e6ad2] hover:bg-[#828fff] text-white font-medium py-3 rounded-lg transition-colors duration-150 text-[14px] cursor-pointer"
                  >
                    Start Chat Session
                  </button>
                )}

                {(progressData?.status === "failed" || !progressData) && (
                  <button
                    onClick={() => {
                      setScreen("ingest");
                      setJobId(null);
                    }}
                    className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium py-3 rounded-lg transition-colors duration-150 text-[14px] cursor-pointer"
                  >
                    Back to Home
                  </button>
                )}
              </div>
            </div>
          )}

          {/* C. CHAT SCREEN */}
          {screen === "chat" && (
            <div className="flex flex-col h-full justify-between flex-1">
              
              {/* Chat Header */}
              <div className="p-4 border-b border-[#23252a] flex items-center justify-between gap-4 bg-[#0d0d0e]/60">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setScreen("ingest")}
                    className="text-zinc-500 hover:text-zinc-300 p-1.5 rounded hover:bg-zinc-800/40 transition-colors duration-150 cursor-pointer"
                    title="Back to Home"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-[#f7f8f8] truncate max-w-[280px]">
                      {activeRepo}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      Querying indexed vectors
                    </span>
                  </div>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 p-5 overflow-y-auto custom-scrollbar flex flex-col gap-4">
                {messages.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-zinc-600 gap-2">
                    <MessageSquare size={32} className="text-zinc-700" />
                    <span className="text-sm font-medium">No messages yet.</span>
                    <span className="text-xs max-w-[240px]">
                      Ask anything about this repository. Gemini will extract relevant code fragments and explain.
                    </span>
                  </div>
                ) : (
                  messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex flex-col max-w-[85%] ${
                        msg.role === "user" ? "self-end items-end" : "self-start items-start"
                      }`}
                    >
                      <div
                        className={`text-[10px] font-mono font-bold tracking-wider uppercase mb-1 ${
                          msg.role === "user" ? "text-zinc-500" : "text-[#5e6ad2]"
                        }`}
                      >
                        {msg.role === "user" ? "You" : "Gemini"}
                      </div>
                      <div
                        className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-[#202020] text-[#f7f8f8] rounded-tr-none border border-zinc-800/20"
                            : "bg-[#131416]/50 border border-[#23252a]/40 rounded-tl-none"
                        }`}
                      >
                        {renderMessageContent(msg.content)}
                      </div>
                    </div>
                  ))
                )}

                {streamingText && (
                  <div className="flex flex-col max-w-[85%] self-start items-start">
                    <div className="text-[10px] font-mono font-bold tracking-wider uppercase text-[#5e6ad2] mb-1">
                      Gemini
                    </div>
                    <div className="bg-[#131416]/50 border border-[#23252a]/40 rounded-2xl rounded-tl-none px-4 py-3 text-sm leading-relaxed">
                      {renderMessageContent(streamingText)}
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input Bar */}
              <div className="p-4 border-t border-[#23252a] bg-[#0d0d0e]/60">
                <div className="h-[52px] bg-[#202020] rounded-full px-4 flex items-center border border-zinc-800/10 shadow-inner">
                  {/* Plus Icon toggles Home screen */}
                  <button
                    onClick={() => setScreen("ingest")}
                    className="p-1.5 text-zinc-400 hover:text-zinc-200 transition-colors duration-150 cursor-pointer"
                    title="Index another repository"
                  >
                    <Plus size={18} strokeWidth={2} />
                  </button>

                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Ask Gemini about ${activeRepo}...`}
                    className="flex-1 bg-transparent text-[#f7f8f8] placeholder-zinc-500 text-sm px-3 font-normal border-none outline-none focus:outline-none"
                  />

                  {query.trim() && (
                    <button
                      onClick={handleSubmitQuery}
                      className="p-1.5 text-[#5e6ad2] hover:text-[#828fff] transition-colors duration-150 cursor-pointer"
                    >
                      <Send size={16} strokeWidth={2.5} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
