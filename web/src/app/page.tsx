"use client";

import { useState, useEffect, useCallback } from "react";
import { Menu, Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Message } from "@/components/ai-sdk/types";
import { apiCall, getUserName, BASE_URL } from "@/lib/utils";
import { Sidebar, RepoItem } from "@/components/workspace/sidebar";
import { AuthScreen } from "@/components/workspace/auth-screen";
import { IngestScreen } from "@/components/workspace/ingest-screen";
import { ProgressScreen } from "@/components/workspace/progress-screen";
import { ChatScreen } from "@/components/workspace/chat-screen";

export default function Home() {
  // Synchronous state initializer to avoid setState inside mount effects
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    if (window.location.hash) {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const idToken = params.get("id_token");
      if (idToken) {
        localStorage.setItem("google_auth_token", idToken);
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        return idToken;
      }
    }
    return localStorage.getItem("google_auth_token");
  });

  const [userName, setUserName] = useState<string>(() => {
    if (typeof window === "undefined") return "User";
    const savedToken = token || localStorage.getItem("google_auth_token");
    return savedToken ? getUserName(savedToken) : "User";
  });

  const [screen, setScreen] = useState<"ingest" | "progress" | "chat">("ingest");
  const [jobId, setJobId] = useState<number | null>(null);
  const [activeRepo, setActiveRepo] = useState<string | null>(null);
  
  // Custom repo inputs
  const [repoUrlInput, setRepoUrlInput] = useState("");
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestError, setIngestError] = useState("");

  // Sidebar and sync states
  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [checkingSync, setCheckingSync] = useState<Record<string, "checking" | "up-to-date" | "out-of-sync" | "error">>({});
  const [loadingRepos, setLoadingRepos] = useState(false);

  // Chat states
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>("auto");

  // Progress monitoring
  const [progressData, setProgressData] = useState<{ status: string; error_message: string | null } | null>(null);


  const loadRepos = useCallback(async () => {
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
    } catch {
      console.error("Failed to load repositories.");
    } finally {
      setLoadingRepos(false);
    }
  }, [token]);

  // Fetch initial repositories on login
  useEffect(() => {
    let active = true;
    if (!token) return;

    async function fetchInitialRepos() {
      setLoadingRepos(true);
      try {
        const res = await apiCall("/repos", "GET", null, token);
        if (res.ok) {
          const result = await res.json();
          if (result.success && active) {
            setRepos(result.data.repos || []);
          }
        }
      } catch {
        console.error("Failed to load repositories.");
      } finally {
        if (active) {
          setLoadingRepos(false);
        }
      }
    }

    fetchInitialRepos();

    return () => {
      active = false;
    };
  }, [token]);

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
  }, [screen, jobId, token, loadRepos]);

  const handleLogin = () => {
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

  const handleDemoLogin = () => {
    const mockToken = "mock_google_id_token";
    localStorage.setItem("google_auth_token", mockToken);
    setToken(mockToken);
    setUserName("Demo User");
  };

  const handleLogout = () => {
    localStorage.removeItem("google_auth_token");
    setToken(null);
    setScreen("ingest");
    setJobId(null);
    setActiveRepo(null);
    setRepos([]);
    setMessages([]);
    setIsLoading(false);
    setMobileSidebarOpen(false);
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
    } catch {
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
    } catch {
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
    } catch {
      setCheckingSync((prev) => ({ ...prev, [repoName]: "error" }));
    }
  };

  const handleStartChatSession = async (repoName: string) => {
    setActiveRepo(repoName);
    setScreen("chat");
    setMobileSidebarOpen(false);

    try {
      const res = await apiCall(`/chat-history?repo_name=${encodeURIComponent(repoName)}`, "GET", null, token);
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data?.history?.length > 0) {
          setMessages(
            result.data.history.map((m: { role: string; content: string }, idx: number) => ({
              id: `hist-${idx}`,
              role: m.role === "user" ? "user" : "bot",
              content: m.content,
            }))
          );
          return;
        }
      }
    } catch {
      console.log("No previous chat history found.");
    }

    setMessages([
      {
        id: "welcome",
        role: "bot",
        content: `Hello! I am askRepo, your AI assistant for ${repoName}. Ask me anything about the codebase!`
      }
    ]);
  };

  const handleSubmitQuery = async () => {
    if (!query.trim() || !activeRepo || !token || isLoading) return;

    const userText = query.trim();
    setQuery("");
    setIsLoading(true);

    const userMsgId = Math.random().toString(36).substring(2);
    const botMsgId = Math.random().toString(36).substring(2);

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: userText },
      { id: botMsgId, role: "bot", content: "" }
    ]);

    let botResponseText = "";

    try {
      const response = await fetch(`${BASE_URL}/query?repo_name=${encodeURIComponent(activeRepo)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: userText,
          provider: selectedProvider !== "auto" ? selectedProvider : undefined,
        }),

      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson.message || `Server responded with status ${response.status}`;
        setMessages((prev) =>
          prev.map((m) => (m.id === botMsgId ? { ...m, content: errMsg, isError: true } : m))
        );
        return;
      }

      if (!response.body) {
        throw new Error("Response stream is not available");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          botResponseText += chunk;

          setMessages((prev) =>
            prev.map((m) => (m.id === botMsgId ? { ...m, content: botResponseText } : m))
          );
        }
      }
    } catch (err: unknown) {
      console.error("Streaming error:", err);
      const errMsg = err instanceof Error ? err.message : "Cannot reach the askRepo server. Is the backend running?";
      setMessages((prev) =>
        prev.map((m) => (m.id === botMsgId ? { ...m, content: errMsg, isError: true } : m))
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return <AuthScreen onLogin={handleLogin} onDemoLogin={handleDemoLogin} />;
  }

  return (
    <div className="flex bg-[#010102] text-[#f7f8f8] h-screen w-full font-sans antialiased overflow-hidden relative">
      <Sidebar
        repos={repos}
        activeRepo={activeRepo}
        sidebarOpen={sidebarOpen}
        mobileSidebarOpen={mobileSidebarOpen}
        loadingRepos={loadingRepos}
        checkingSync={checkingSync}
        userName={userName}
        onSelectRepo={handleStartChatSession}
        onNewIngest={() => {
          setScreen("ingest");
          setActiveRepo(null);
        }}
        onCheckSync={handleCheckSync}
        onSyncNow={handleSyncNow}
        onReloadRepos={loadRepos}
        onCloseSidebar={() => setSidebarOpen(false)}
        onCloseMobileSidebar={() => setMobileSidebarOpen(false)}
        onLogout={handleLogout}
      />

      {!sidebarOpen && (
        <Button
          variant="secondary"
          size="icon"
          onClick={() => setSidebarOpen(true)}
          className="hidden md:flex absolute top-4 left-4 z-40 h-8 w-8 text-[#8a8f98] hover:text-[#f7f8f8]"
          title="Open sidebar"
        >
          <ChevronRight size={16} />
        </Button>
      )}

      <main className="flex-1 flex flex-col justify-between min-w-0 h-full bg-[#010102] relative z-10 w-full">
        {/* Mobile Header Bar */}
        <header className="flex md:hidden items-center justify-between px-4 py-3 bg-[#0d0d0e] border-b border-[#23252a] w-full shrink-0 z-20">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setMobileSidebarOpen(true)}
            className="h-8 w-8 text-[#8a8f98] hover:text-[#f7f8f8]"
          >
            <Menu size={18} />
          </Button>
          
          <span className="text-sm font-semibold text-[#f7f8f8]">
            {screen === "chat" ? activeRepo : "askRepo"}
          </span>
          
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => {
              setScreen("ingest");
              setActiveRepo(null);
            }}
            className="h-8 w-8 text-[#8a8f98] hover:text-[#f7f8f8]"
            title="Index Repository"
          >
            <Plus size={18} />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar w-full flex flex-col relative z-10">
          {screen === "ingest" && (
            <IngestScreen
              repoUrlInput={repoUrlInput}
              ingestLoading={ingestLoading}
              ingestError={ingestError}
              repos={repos}
              onChangeUrl={setRepoUrlInput}
              onIndexRepo={handleIndexRepository}
              onSelectRepo={handleStartChatSession}
            />
          )}

          {screen === "progress" && (
            <ProgressScreen
              progressData={progressData}
              onStartChat={() => handleStartChatSession(repos[0]?.repo_name || activeRepo || "")}
              onBackHome={() => {
                setScreen("ingest");
                setJobId(null);
              }}
            />
          )}

          {screen === "chat" && activeRepo && (
            <ChatScreen
              activeRepo={activeRepo}
              messages={messages}
              input={query}
              isLoading={isLoading}
              provider={selectedProvider}
              onInputChange={setQuery}
              onProviderChange={setSelectedProvider}
              onSubmitQuery={handleSubmitQuery}
              onBackHome={() => {
                setScreen("ingest");
                setActiveRepo(null);
              }}
            />
          )}

        </div>
      </main>
    </div>
  );
}
