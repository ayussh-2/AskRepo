"use client";

import * as React from "react";
import { useState } from "react";
import { Send, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModelPalette } from "./model-palette";
import { fetchModelsApi, ProviderGroup } from "@/lib/api";

export interface ChatInputProps {
  input: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading?: boolean;
  placeholder?: string;
  provider?: string;
  model?: string;
  onProviderChange?: (provider: string) => void;
  onSelectModel?: (provider: string, model: string) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  input,
  onChange,
  onSubmit,
  isLoading,
  placeholder = "Ask me....",
  provider = "auto",
  model = "auto",
  onProviderChange,
  onSelectModel,
}) => {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [providers, setProviders] = useState<ProviderGroup[]>([]);

  React.useEffect(() => {
    let active = true;

    fetchModelsApi().then((res) => {
      if (active && res.success && res.data?.providers?.length) {
        setProviders(res.data.providers);

        // Select the default first model that comes from the api
        const firstProvider = res.data.providers[0];
        const firstModel = firstProvider?.models?.[0];
        const defaultProv =
          res.data.default?.provider && res.data.default?.provider !== "auto"
            ? res.data.default.provider
            : firstProvider?.id;
        const defaultMod =
          res.data.default?.model && res.data.default?.model !== "auto"
            ? res.data.default.model
            : firstModel?.id;

        if (
          defaultProv &&
          defaultMod &&
          (!provider || provider === "auto" || !model || model === "auto")
        ) {
          if (onSelectModel) {
            onSelectModel(defaultProv, defaultMod);
          } else if (onProviderChange) {
            onProviderChange(defaultProv);
          }
        }
      }
    });

    return () => {
      active = false;
    };
  }, []);

  // Global capture-phase shortcut listener for Ctrl+K / Cmd+K
  // Prevents Chrome and other browsers from intercepting and focusing the address bar
  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopPropagation();
        setPaletteOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown, true);
    return () =>
      window.removeEventListener("keydown", handleGlobalKeyDown, true);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      e.stopPropagation();
      setPaletteOpen(true);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  const handleModelSelect = (selectedProv: string, selectedMod: string) => {
    if (onSelectModel) {
      onSelectModel(selectedProv, selectedMod);
    } else if (onProviderChange) {
      onProviderChange(selectedProv);
    }
  };

  const selectedProvider =
    providers.find((item) => item.id === provider) ||
    (provider === "auto" ? providers[0] : undefined);
  const selectedModel =
    selectedProvider?.models.find((item) => item.id === model) ||
    (model === "auto" ? selectedProvider?.models?.[0] : undefined);
  const displayIcon = selectedModel?.icon || selectedProvider?.icon;
  const displayLabel =
    selectedModel?.name ||
    (provider === "auto"
      ? "Auto"
      : model && model !== "auto"
        ? model.split("/").pop()?.replace(/-/g, " ")
        : provider);

  return (
    <>
      <div className="p-3 md:p-4 w-full shrink-0">
        <div className="max-w-3xl lg:max-w-4xl w-full mx-auto flex flex-col gap-2">
          <div className="relative flex items-center bg-zinc-100 dark:bg-[#131416] border border-zinc-200 dark:border-[#23252a] rounded-xl px-2 py-1 focus-within:border-[#5e6ad2]/50 transition-colors">
            {/* Model Palette Trigger Button */}
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              disabled={isLoading}
              className="relative flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 border-r border-zinc-200 dark:border-[#23252a] text-zinc-600 dark:text-[#8a8f98] shrink-0 hover:text-zinc-900 dark:hover:text-[#f7f8f8] hover:bg-zinc-200/50 dark:hover:bg-[#1a1c22] rounded-l-lg transition-colors group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Select LLM Model & Provider (⌘K)"
            >
              <div className="flex items-center gap-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {displayIcon && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-zinc-100 dark:bg-white/10 ring-1 ring-zinc-200 dark:ring-[#23252a]">
                    <img
                      src={displayIcon}
                      alt={provider}
                      className="size-3.5 object-contain shrink-0 dark:[&[src*='openai.svg']]:invert dark:[&[src*='groq.svg']]:invert"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  </span>
                )}

                <ChevronDown
                  size={12}
                  className="text-zinc-400 dark:text-[#62666d] group-hover:text-zinc-700 dark:group-hover:text-[#f7f8f8] transition-colors"
                />
              </div>
            </button>

            {/* Text Input */}
            <input
              type="text"
              placeholder={placeholder}
              value={input}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              className="flex-1 min-w-0 bg-transparent text-zinc-900 dark:text-[#f7f8f8] placeholder-zinc-400 dark:placeholder-[#62666d] px-3 py-1.5 text-sm focus:outline-none disabled:opacity-50"
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

      {/* Command Palette Modal */}
      <ModelPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        selectedProvider={provider}
        selectedModel={model}
        providers={providers}
        onSelect={handleModelSelect}
      />
    </>
  );
};
