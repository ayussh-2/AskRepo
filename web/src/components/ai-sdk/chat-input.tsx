import * as React from "react";
import { Send, Loader2, Cpu, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ChatInputProps {
  input: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading?: boolean;
  placeholder?: string;
  provider?: string;
  onProviderChange?: (provider: string) => void;
}

export const PROVIDER_OPTIONS = [
  { value: "auto", label: "Auto", icon: "/models/auto.png" },
  {
    value: "gemini",
    label: "gemini-3.1-flash-lite",
    icon: "/models/gemini.svg",
  },
  {
    value: "groq",
    label: "llama-3.3-70b-versatile",
    icon: "/models/llama.svg",
  },

  {
    value: "mistral",
    label: "mistral-small-latest",
    icon: "/models/mistral.svg",
  },
];

export const ChatInput: React.FC<ChatInputProps> = ({
  input,
  onChange,
  onSubmit,
  isLoading,
  placeholder = "Ask me....",
  provider = "auto",
  onProviderChange,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  const activeOpt =
    PROVIDER_OPTIONS.find((o) => o.value === provider) || PROVIDER_OPTIONS[0];

  return (
    <div className="p-3 md:p-4 w-full shrink-0">
      <div className="max-w-3xl lg:max-w-4xl w-full mx-auto flex flex-col gap-2">
        <div className="relative flex items-center bg-[#131416] border border-[#23252a] rounded-xl px-2 py-1 focus-within:border-[#5e6ad2]/50 transition-colors">
          {/* Provider Dropdown inside input field */}
          <div className="flex items-center gap-1.5 pl-2 pr-2.5 py-1 border-r border-[#23252a] text-[#8a8f98] shrink-0">
            <img
              src={activeOpt.icon}
              alt={activeOpt.label}
              className={`size-3.5 object-contain shrink-0 ${provider === "auto" ? "invert size-5" : ""}`}
              onError={(e) => {
                // Hide icon if missing
                (e.target as HTMLElement).style.display = "none";
              }}
            />
            <select
              value={provider}
              onChange={(e) => onProviderChange?.(e.target.value)}
              disabled={isLoading}
              className="bg-transparent text-xs text-[#f7f8f8] font-medium focus:outline-none cursor-pointer pr-1 appearance-none [&>option]:bg-[#131416] [&>option]:text-[#f7f8f8]"
              title="Select LLM Provider / Model"
            >
              {PROVIDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              className="text-[#62666d] pointer-events-none -ml-1"
            />
          </div>

          {/* Text Input */}
          <input
            type="text"
            placeholder={placeholder}
            value={input}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="flex-1 min-w-0 bg-transparent text-[#f7f8f8] placeholder-[#62666d] px-3 py-1.5 text-sm focus:outline-none disabled:opacity-50"
          />

          {/* Send Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onSubmit}
            disabled={isLoading || !input.trim()}
            className="text-[#8a8f98] hover:text-[#f7f8f8] disabled:opacity-40 transition-all p-1.5 cursor-pointer disabled:cursor-not-allowed h-8 w-8 shrink-0"
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
    </div>
  );
};
