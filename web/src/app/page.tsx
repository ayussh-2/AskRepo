"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/workspace/navbar";
import { Hero } from "@/components/workspace/hero";
import {
  getUserName,
  getStoredToken,
  isValidRepoUrl,
  normalizeRepoUrl,
} from "@/lib/utils";
import { toast } from "sonner";
import { useRepos } from "@/context/repo-context";

export default function Home() {
  const router = useRouter();
  const { clearSession } = useRepos();

  const [token, setToken] = useState<string | null>(() => getStoredToken());

  const [userName] = useState<string>(() => {
    const savedToken = token || getStoredToken();
    return savedToken ? getUserName(savedToken) : "User";
  });

  const [repo, setRepo] = useState("");

  useEffect(() => {
    if (typeof window === "undefined" || !token) return;

    const isOAuthReturn = window.location.hash.includes("id_token");
    const pendingRepo = localStorage.getItem("pending_repo_url");

    if (pendingRepo || isOAuthReturn) {
      router.push("/dashboard");
    }
  }, [token, router]);

  const handleLogout = () => {
    clearSession();
    setToken(null);
    toast.success("Logged out successfully");
  };

  const handleAnalyzeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repo.trim()) return;

    if (!isValidRepoUrl(repo)) {
      toast.error(
        "Please enter a valid GitHub or GitLab URL (e.g. github.com/owner/repo or owner/repo)",
      );
      return;
    }

    const targetUrl = normalizeRepoUrl(repo);
    localStorage.setItem("pending_repo_url", targetUrl);

    if (!token) {
      toast.info("Please sign in to analyze this repository.");
      router.push("/login");
      return;
    }

    router.push("/dashboard");
  };

  return (
    <div className="flex bg-[#010102] text-[#f7f8f8] h-screen w-full font-sans antialiased overflow-hidden relative">
      <main className="flex-1 flex flex-col min-w-0 h-full bg-[#010102] relative z-10 w-full overflow-y-auto custom-scrollbar">
        <Navbar token={token} userName={userName} onLogout={handleLogout} />

        <div className="pt-[52px] flex-1 flex flex-col justify-center">
          <Hero
            repoUrl={repo}
            onRepoChange={setRepo}
            onSubmit={handleAnalyzeSubmit}
            userName={token ? userName : undefined}
          />
        </div>
      </main>
    </div>
  );
}
