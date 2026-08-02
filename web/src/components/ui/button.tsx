import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#5e6ad2] disabled:pointer-events-none disabled:opacity-50 cursor-pointer";
    
    const variants = {
      default: "bg-[#5e6ad2] text-white hover:bg-[#828fff] active:bg-[#4f5ac1] shadow-sm",
      secondary: "bg-[#131416] text-[#f7f8f8] border border-[#23252a] hover:bg-[#1a1b1e]",
      outline: "border border-[#23252a] bg-transparent text-[#f7f8f8] hover:bg-[#131416]",
      ghost: "text-[#8a8f98] hover:text-[#f7f8f8] hover:bg-[#131416]",
      destructive: "bg-red-950/40 text-red-400 border border-red-900/30 hover:bg-red-900/40",
      link: "text-[#5e6ad2] underline-offset-4 hover:underline",
    };

    const sizes = {
      default: "h-10 px-4 py-2",
      sm: "h-8 rounded-md px-3 text-xs",
      lg: "h-12 rounded-xl px-8 text-base",
      icon: "h-9 w-9 p-0",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
