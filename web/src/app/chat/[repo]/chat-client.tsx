"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Message } from "@/components/ai-sdk/types";
import { apiCall, getUserName, getStoredToken, BASE_URL } from "@/lib/utils";
import { Sidebar } from "@/components/workspace/sidebar";
import { ChatScreen } from "@/components/workspace/chat-screen";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { useRepos } from "@/context/repo-context";

export default function ChatClientPage({ repo }: { repo: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchRepo = searchParams ? searchParams.get("repo") : null;

  // Reactively derive active repoName from search params, pathname, or prop
  const repoName =
    typeof window !== "undefined"
      ? searchRepo
        ? decodeURIComponent(searchRepo)
        : decodeURIComponent(
            window.location.pathname.replace(/^\/chat\/?/, "") || repo,
          )
      : decodeURIComponent(repo || "");

  // Use global repo context (cached, single API request across application)
  const {
    repos,
    loadingRepos,
    checkingSync,
    loadRepos,
    handleCheckSync,
    handleSyncNow,
  } = useRepos();

  // Synchronous state initializers
  const [token, setToken] = useState<string | null>(() => getStoredToken());

  const [userName] = useState<string>(() => {
    const savedToken = token || getStoredToken();
    return savedToken ? getUserName(savedToken) : "User";
  });

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Chat states
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>("auto");
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

  // Load chat history whenever repoName or token changes
  useEffect(() => {
    let active = true;
    if (!token || !repoName) return;

    async function loadChatHistory() {
      // Reset messages when switching repos to reflect immediate UI change
      setMessages([
        {
          id: "loading",
          role: "bot",
          content: `Loading chat history for ${repoName}...`,
        },
      ]);
      try {
        const res = await apiCall(
          `/chat-history?repo_name=${encodeURIComponent(repoName)}`,
          "GET",
          null,
          token,
          handleUnauthorized,
        );
        if (res.ok) {
          const result = await res.json();
          if (result.success && result.data?.history?.length > 0 && active) {
            setMessages(
              result.data.history.map(
                (m: { role: string; content: string }, idx: number) => ({
                  id: `hist-${idx}`,
                  role: m.role === "user" ? "user" : "bot",
                  content: m.content,
                }),
              ),
            );
            return;
          }
        }
      } catch {
        console.log("No previous chat history found.");
      }

      if (active) {
        setMessages([
          {
            id: "welcome",
            role: "bot",
            content: `Hello! I am askRepo, your AI assistant for ${repoName}. Ask me anything about the codebase!`,
          },
        ]);
      }
    }

    loadChatHistory();

    return () => {
      active = false;
    };
  }, [token, repoName, handleUnauthorized]);

  const handleSubmitQuery = async () => {
    if (!query.trim() || !repoName || !token || isLoading) return;

    const userText = query.trim();
    setQuery("");
    setIsLoading(true);

    const userMsgId = Math.random().toString(36).substring(2);
    const botMsgId = Math.random().toString(36).substring(2);

    setMessages((prev) => [
      ...prev.filter((m) => m.id !== "loading"),
      { id: userMsgId, role: "user", content: userText },
      { id: botMsgId, role: "bot", content: "" },
    ]);

    let botResponseText = "";

    try {
      const response = await fetch(
        `${BASE_URL}/query?repo_name=${encodeURIComponent(repoName)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            query: userText,
            provider:
              selectedProvider !== "auto" ? selectedProvider : undefined,
          }),
        },
      );

      if (!response.ok) {
        if (response.status === 401) {
          handleUnauthorized();
        }
        const errJson = await response.json().catch(() => ({}));
        const errMsg =
          errJson.message || `Server responded with status ${response.status}`;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botMsgId ? { ...m, content: errMsg, isError: true } : m,
          ),
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
            prev.map((m) =>
              m.id === botMsgId ? { ...m, content: botResponseText } : m,
            ),
          );
        }
      }
    } catch (err: unknown) {
      console.error("Streaming error:", err);
      const errMsg =
        err instanceof Error ? err.message : "Cannot reach the askRepo server.";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMsgId ? { ...m, content: errMsg, isError: true } : m,
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) return null;

  return (
    <div className="flex bg-[#010102] text-[#f7f8f8] h-screen w-full font-sans antialiased overflow-hidden relative">
      <Sidebar
        repos={repos}
        activeRepo={repoName}
        sidebarOpen={sidebarOpen}
        mobileSidebarOpen={mobileSidebarOpen}
        loadingRepos={loadingRepos}
        checkingSync={checkingSync}
        userName={userName}
        onSelectRepo={(name) =>
          router.push(`/chat?repo=${encodeURIComponent(name)}`)
        }
        onNewIngest={() => router.push("/")}
        onCheckSync={handleCheckSync}
        onSyncNow={handleSyncNow}
        onReloadRepos={loadRepos}
        onCloseSidebar={() => setSidebarOpen(false)}
        onCloseMobileSidebar={() => setMobileSidebarOpen(false)}
        onLogout={handleLogout}
      />

      <main className="flex-1 flex flex-col justify-between min-w-0 h-full bg-[#010102] relative z-10 w-full">
        <ChatScreen
          activeRepo={repoName}
          messages={messages}
          input={query}
          isLoading={isLoading}
          provider={selectedProvider}
          onInputChange={setQuery}
          onProviderChange={setSelectedProvider}
          onSubmitQuery={handleSubmitQuery}
          onBackHome={() => router.push("/dashboard")}
        />
      </main>

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
