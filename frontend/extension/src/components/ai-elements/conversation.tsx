import * as React from "react";
import { cn } from "@/lib/utils";

export interface ConversationProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Conversation = React.forwardRef<HTMLDivElement, ConversationProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex flex-col flex-1 min-h-0 relative", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Conversation.displayName = "Conversation";

export interface ConversationContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const ConversationContent = React.forwardRef<HTMLDivElement, ConversationContentProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex-1 overflow-y-auto p-4 space-y-4", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ConversationContent.displayName = "ConversationContent";
