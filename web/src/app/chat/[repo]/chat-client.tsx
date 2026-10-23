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

  if (typeof window !== "undefined" && window.self !== window.top) {
    return null;
  }
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
    token,
    repos,
    loadingRepos,
    checkingSync,
    loadRepos,
    handleCheckSync,
    handleSyncNow,
    clearSession,
  } = useRepos();

  const userName = token ? getUserName(token) : "User";

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleUnauthorized = useCallback(() => {
    clearSession();
    setShowAuthModal(true);
  }, [clearSession]);

  const {
    query,
    setQuery,
    messages,
    isLoading,
    selectedProvider,
    selectedModel,
    setSelectedProvider,
    handleSelectModel,
    handleSubmitQuery,
  } = useChat(repoName, token, handleUnauthorized);

  const handleLogout = () => {
    clearSession();
    router.push("/");
  };

  useEffect(() => {
    if (!token && typeof window !== "undefined") {
      router.push("/login");
    }
  }, [token, router]);

  if (!token) return null;

  return (
    <div className="flex bg-white dark:bg-[#010102] text-zinc-900 dark:text-[#f7f8f8] h-screen w-full font-sans antialiased overflow-hidden relative transition-colors">
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

      <main className="flex-1 flex flex-col justify-between min-w-0 h-full bg-white dark:bg-[#010102] relative z-10 w-full transition-colors">
        <ChatScreen
          activeRepo={repoName}
          messages={messages}
          input={query}
          isLoading={isLoading}
          provider={selectedProvider}
          model={selectedModel}
          onInputChange={setQuery}
          onProviderChange={setSelectedProvider}
          onSelectModel={handleSelectModel}
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
