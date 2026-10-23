"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ModeToggle({ className }: { className?: string }) {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={`size-8 rounded-lg border border-gray-200 dark:border-[#23252a] bg-transparent opacity-50 ${
          className || ""
        }`}
      />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`size-8 text-gray-500 hover:text-gray-900 dark:text-[#8a8f98] dark:hover:text-[#f7f8f8] hover:bg-gray-100 dark:hover:bg-[#16171b] border border-gray-200/80 dark:border-[#23252a] rounded-lg transition-colors cursor-pointer ${
        className || ""
      }`}
      title={`Switch to ${isDark ? "Light" : "Dark"} Mode`}
    >
      {isDark ? (
        <Sun className="size-4 transition-transform hover:rotate-45" />
      ) : (
        <Moon className="size-4  transition-transform hover:-rotate-12" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
