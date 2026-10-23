"use client";

import React from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { StatusIndicator } from "./status-indicator";

export function Footer() {
  return (
    <footer className="w-full border-t border-zinc-200/80 dark:border-[#23252a]/80 bg-white/60 dark:bg-[#010102]/60 backdrop-blur-md shrink-0 py-2.5 px-4 md:px-6 z-20">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-zinc-500 dark:text-[#8a8f98]">
        {/* Attribution & GitHub Link */}
        <div className="flex items-center gap-1.5 font-medium">
          <span>Made with</span>
          <Heart size={13} className="text-red-500 fill-red-500 inline-block" />
          <span>by</span>
          <a
            href="https://github.com/ayussh-2"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-900 dark:text-[#f7f8f8] hover:text-[#5e6ad2] dark:hover:text-[#5e6ad2] font-semibold transition-colors inline-flex items-center gap-1 group"
          >
            <span>Ayush</span>
          </a>
        </div>

        {/* Status Indicator & Theme Toggle */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-1.5"
            title="System Health & Connectivity"
          >
            <StatusIndicator placement="top" />
          </div>
        </div>
      </div>
    </footer>
  );
}
