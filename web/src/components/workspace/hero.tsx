"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";

export interface HeroProps {
  repoUrl: string;
  onRepoChange: (url: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading?: boolean;
  userName?: string;
}

export function Hero({
  repoUrl,
  onRepoChange,
  onSubmit,
  isLoading,
  userName,
}: HeroProps) {
  const [focused, setFocused] = useState(false);

  return (
    <section className="relative flex min-h-[calc(100vh-110px)] w-full items-center justify-center overflow-hidden py-12">
      {/* Dark mode gradient blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden dark:block"
        style={{
          background: `
            radial-gradient(ellipse 75% 55% at 18% 52%, rgba(94,106,210,0.30) 0%, transparent 65%),
            radial-gradient(ellipse 55% 50% at 82% 38%, rgba(139,92,246,0.24) 0%, transparent 60%),
            radial-gradient(ellipse 48% 65% at 50% 82%, rgba(59,130,246,0.13) 0%, transparent 65%),
            #010102
          `,
        }}
      />

      {/* Light mode gradient blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 block dark:hidden"
        style={{
          background: `
            radial-gradient(ellipse 75% 55% at 18% 52%, rgba(94,106,210,0.15) 0%, transparent 65%),
            radial-gradient(ellipse 55% 50% at 82% 38%, rgba(139,92,246,0.12) 0%, transparent 60%),
            radial-gradient(ellipse 48% 65% at 50% 82%, rgba(59,130,246,0.08) 0%, transparent 65%),
            #ffffff
          `,
        }}
      />

      {/* Noise grain */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "160px 160px",
        }}
      />

      {/* Content */}
      <div className="relative z-10 mx-auto w-full max-w-[640px] px-5 text-center">
        {/* Creative Badge */}
        <div className="mb-7 inline-flex items-center gap-2.5 rounded-full px-4 py-1.5 text-[12.5px] text-zinc-600 dark:text-[#8a8f98] bg-zinc-100/90 dark:bg-[#131416]/80 border border-zinc-200/80 dark:border-[#23252a] backdrop-blur-sm shadow-sm transition-all hover:border-[#5e6ad2]/50">
          <span>
            {userName ? (
              <>
                Welcome back,{" "}
                <strong className="font-semibold text-zinc-900 dark:text-[#f7f8f8]">
                  {userName}
                </strong>{" "}
              </>
            ) : (
              "Grounded answers with real citations"
            )}
          </span>
        </div>

        {/* Headline */}
        <h1
          className="text-[clamp(2.8rem,7.5vw,4.75rem)] font-bold leading-[1.03] text-zinc-900 dark:text-[#f7f8f8]"
          style={{ letterSpacing: "-0.038em" }}
        >
          Talk to your
          <br />
          codebase.
        </h1>

        <p className="mx-auto mt-5 max-w-[420px] text-[15.5px] leading-relaxed text-zinc-600 dark:text-[#8a8f98]">
          Paste a GitHub repo and ask anything — get answers with exact file and
          line citations.
        </p>

        {/* Input card */}
        <form
          onSubmit={onSubmit}
          className={`mt-9 mx-auto rounded-2xl border bg-white/95 dark:bg-[#0f0f11]/90 backdrop-blur-sm transition-all duration-200 ${
            focused
              ? "border-[#5e6ad2]/70 shadow-[0_0_0_3px_rgba(94,106,210,0.14),0_16px_48px_rgba(0,0,0,0.1)] dark:shadow-[0_0_0_3px_rgba(94,106,210,0.14),0_16px_48px_rgba(0,0,0,0.5)]"
              : "border-zinc-200 dark:border-[#23252a] shadow-[0_16px_48px_rgba(0,0,0,0.06)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.45)]"
          }`}
          style={{ maxWidth: 560 }}
        >
          {/* Main input */}
          <div className="px-5 pt-4 pb-2">
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => onRepoChange(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="github.com/owner/repo — ask anything about this codebase..."
              className="w-full bg-transparent text-[15px] text-zinc-900 dark:text-[#f7f8f8] placeholder-zinc-400 dark:placeholder-[#4a4f5a] outline-none"
              spellCheck={false}
              autoComplete="off"
              disabled={isLoading}
            />
          </div>

          {/* Bottom row */}
          <div className="flex items-center justify-end px-4 pb-3.5 pt-1">
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={!repoUrl.trim() || isLoading}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-[13px] font-semibold transition-all duration-150 ${
                  repoUrl.trim() && !isLoading
                    ? "bg-[#5e6ad2] text-white hover:bg-[#6e7ee0] cursor-pointer"
                    : "bg-zinc-100 text-zinc-400 dark:bg-[#1a1a1f] dark:text-[#4a4f5a] cursor-not-allowed"
                }`}
              >
                {isLoading ? "Analyzing..." : "Analyze"}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </form>

        {/* Supported Languages Pills */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2 max-w-[540px] mx-auto">
          {[
            "Python",
            "JavaScript",
            "TypeScript",
            "Java",
            "Go",
            "Rust",
            "C++",
            "C",
          ].map((lang) => (
            <span
              key={lang}
              className="rounded-full border border-zinc-200 bg-zinc-100/90 dark:border-[#23252a] dark:bg-[#111215]/80 px-2.5 py-0.5 text-[11px] text-zinc-600 dark:text-[#8a8f98] backdrop-blur-sm transition-colors hover:border-zinc-300 dark:hover:border-[#3a3f47] hover:text-zinc-900 dark:hover:text-[#f7f8f8]"
            >
              {lang}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
