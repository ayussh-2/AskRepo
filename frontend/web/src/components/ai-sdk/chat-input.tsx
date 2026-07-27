import * as React from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ChatInputProps {
  input: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading?: boolean;
  placeholder?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  input,
  onChange,
  onSubmit,
  isLoading,
  placeholder = "Ask me....",
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="p-3 md:p-4 w-full shrink-0">
      <div className="max-w-3xl lg:max-w-4xl w-full mx-auto relative flex items-center gap-2">
        <input
          type="text"
          placeholder={placeholder}
          value={input}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          className="flex-1 min-w-0 h-10 bg-[#131416] text-[#f7f8f8] placeholder-[#62666d] border border-[#23252a] rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:border-[#5e6ad2]/50 transition-colors disabled:opacity-50"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={onSubmit}
          disabled={isLoading || !input.trim()}
          className="absolute right-2 text-[#8a8f98] hover:text-[#f7f8f8] disabled:opacity-40 transition-all p-1.5 cursor-pointer disabled:cursor-not-allowed h-7 w-7"
          title="Send message"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin text-[#5e6ad2]" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
};
