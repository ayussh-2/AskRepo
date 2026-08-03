"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface NavbarProps {
  token: string | null;
  userName?: string;
  onLogout: () => void;
}

export function Navbar({ token, onLogout }: NavbarProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-[#23252a]/60 bg-[#010102]/75 backdrop-blur-md">
      <div className="mx-auto flex h-[52px] max-w-[1200px] items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center flex-shrink-0">
          <span
            className="text-[15px] font-semibold text-[#f7f8f8]"
            style={{ letterSpacing: "-0.02em" }}
          >
            askRepo
          </span>
        </Link>

        {/* Right actions */}
        <div className="flex items-center gap-2.5">
          {token ? (
            <>
              <Link
                href="/dashboard"
                className="rounded-lg border border-[#23252a] bg-[#131416] px-3.5 py-1.5 text-xs font-medium text-[#f7f8f8] transition-colors hover:bg-[#1e2024]"
              >
                Dashboard
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={onLogout}
                className="text-xs text-[#8a8f98] hover:text-[#f7f8f8] flex items-center gap-1.5"
              >
                <LogOut size={14} />
                Log out
              </Button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-[#5e6ad2] px-4 py-1.5 text-[13.5px] font-medium text-white transition-colors duration-150 hover:bg-[#4e58b5]"
            >
              Get started
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
