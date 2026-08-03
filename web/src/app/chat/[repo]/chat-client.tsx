"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getUserName, getStoredToken } from "@/lib/utils";
import { Sidebar } from "@/components/workspace/sidebar";
import { ChatScreen } from "@/components/workspace/chat-screen";
import { AuthModal } from "@/components/workspace/auth-modal";
import { useRepos } from "@/context/repo-context";
import { useChat } from "@/hooks/use-chat";

export default function ChatClientPage({ repo }: { repo: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchRepo = searchParams ? searchParams.get("repo") : null;

  const repoName =
    typeof window !== "undefined"
      ? searchRepo
        ? decodeURIComponent(searchRepo)
        : decodeURIComponent(
            window.location.pathname.replace(/^\/chat\/?/, "") || repo,
          )
      : decodeURIComponent(repo || "");

  const {
    repos,
    loadingRepos,
    checkingSync,
    loadRepos,
    handleCheckSync,
    handleSyncNow,
    clearSession,
  } = useRepos();

  const [token, setToken] = useState<string | null>(() => getStoredToken());

  const [userName] = useState<string>(() => {
    const savedToken = token || getStoredToken();
    return savedToken ? getUserName(savedToken) : "User";
  });

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleUnauthorized = useCallback(() => {
    setShowAuthModal(true);
  }, []);

  const {
    query,
    setQuery,
    messages,
    isLoading,
    selectedProvider,
    setSelectedProvider,
    handleSubmitQuery,
  } = useChat(repoName, token, handleUnauthorized);

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
        onOpenSidebar={() => setSidebarOpen(true)}
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
