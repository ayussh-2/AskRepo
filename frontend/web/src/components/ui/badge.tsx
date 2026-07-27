import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "success" | "destructive" | "outline";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const baseStyles = "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors";
  
  const variants = {
    default: "bg-[#202020] text-[#f7f8f8] border border-[#23252a]",
    secondary: "bg-[#131416] text-[#8a8f98] border border-[#23252a]",
    success: "bg-[#27a644]/10 text-[#27a644] border border-[#27a644]/20",
    destructive: "bg-red-950/40 text-red-400 border border-red-900/30",
    outline: "text-[#d0d6e0] border border-[#23252a]",
  };

  return (
    <div className={cn(baseStyles, variants[variant], className)} {...props} />
  );
}
