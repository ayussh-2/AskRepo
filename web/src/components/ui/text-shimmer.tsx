import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextShimmerProps {
  children: string;
  className?: string;
}

export const TextShimmer: React.FC<TextShimmerProps> = ({ children, className }) => {
  return (
    <span 
      className={cn(
        "inline-block bg-clip-text text-transparent bg-gradient-to-r from-[#71717a] via-[#ffffff] to-[#71717a] bg-[length:250%_100%] animate-shimmer",
        className
      )}
    >
      {children}
    </span>
  );
};
