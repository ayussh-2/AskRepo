import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Message } from "@/components/ai-sdk/types";
import { ChatList } from "@/components/ai-sdk/chat-list";
import { ChatInput } from "@/components/ai-sdk/chat-input";

export interface ChatScreenProps {
  activeRepo: string;
  messages: Message[];
  input: string;
  isLoading: boolean;
  provider?: string;
  onInputChange: (value: string) => void;
  onProviderChange?: (provider: string) => void;
  onSubmitQuery: () => void;
  onBackHome: () => void;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  activeRepo,
  messages,
  input,
  isLoading,
  provider = "auto",
  onInputChange,
  onProviderChange,
  onSubmitQuery,
  onBackHome,
}) => {
  return (
    <div className="flex-1 flex flex-col h-full relative">
      {/* Desktop Header */}
      <div className="hidden md:flex p-3 px-5  items-center justify-between gap-4 sticky top-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBackHome}
            className="h-8 w-8 text-[#8a8f98] hover:text-[#f7f8f8]"
            title="Back to Home"
          >
            <ArrowLeft size={16} />
          </Button>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-[#f7f8f8] truncate">
              askRepo Chat
            </span>
            <span className="text-[11px] text-[#8a8f98] font-mono truncate">
              {activeRepo}
            </span>
          </div>
        </div>
      </div>

      {/* AI SDK UI Chat List */}
      <ChatList messages={messages} isLoading={isLoading} />

      {/* AI SDK UI Chat Input Bar */}
      <ChatInput
        input={input}
        onChange={onInputChange}
        onSubmit={onSubmitQuery}
        isLoading={isLoading}
        provider={provider}
        onProviderChange={onProviderChange}
        placeholder={`Ask anything about ${activeRepo}...`}
      />
    </div>
  );
};

