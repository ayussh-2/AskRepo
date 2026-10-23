"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Search, Check, X, RotateCw, Cpu } from "lucide-react";
import { fetchModelsApi, ProviderGroup } from "@/lib/api";

export interface ModelPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProvider: string;
  selectedModel: string;
  providers?: ProviderGroup[];
  onSelect: (provider: string, model: string, icon?: string) => void;
}

export const ModelPalette: React.FC<ModelPaletteProps> = ({
  isOpen,
  onClose,
  selectedProvider,
  selectedModel,
  providers: cachedProviders,
  onSelect,
}) => {
  const [loadedProviders, setLoadedProviders] = useState<ProviderGroup[]>(
    cachedProviders ?? [],
  );
  const providers = cachedProviders?.length ? cachedProviders : loadedProviders;
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const loadModels = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const res = await fetchModelsApi(forceRefresh);
      if (res.success && res.data?.providers?.length) {
        setLoadedProviders(res.data.providers);
      }
    } catch (e) {
      console.warn("Failed to load live models:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const modelLoadTimeout = setTimeout(() => {
        void loadModels();
      }, 0);
      setTimeout(() => inputRef.current?.focus(), 50);
      const resetStateTimeout = setTimeout(() => {
        setSearch("");
        setHighlightedIndex(0);
      }, 0);

      return () => {
        clearTimeout(modelLoadTimeout);
        clearTimeout(resetStateTimeout);
      };
    }
  }, [isOpen]);

  // Flatten models for unified keyboard navigation and searching
  const filteredList = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result: Array<{
      type: "model";
      providerId: string;
      providerName: string;
      modelId: string;
      modelName: string;
      icon: string;
    }> = [];

    providers.forEach((p) => {
      if (activeTab !== "all" && activeTab !== p.id) return;

      p.models.forEach((m) => {
        const matchesQuery =
          !query ||
          m.name.toLowerCase().includes(query) ||
          m.id.toLowerCase().includes(query) ||
          p.name.toLowerCase().includes(query);

        if (matchesQuery) {
          result.push({
            type: "model",
            providerId: p.id,
            providerName: p.name,
            modelId: m.id,
            modelName: m.name,
            icon: m.icon || p.icon,
          });
        }
      });
    });

    return result;
  }, [providers, search, activeTab]);

  // Handle keyboard events (Esc, Arrow keys, Enter)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % (filteredList.length || 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev - 1 < 0 ? (filteredList.length || 1) - 1 : prev - 1,
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredList[highlightedIndex]) {
          const item = filteredList[highlightedIndex];
          onSelect(item.providerId, item.modelId, item.icon);
          onClose();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredList, highlightedIndex, onClose, onSelect]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector(
        `[data-index="${highlightedIndex}"]`,
      );
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-[#0f1012] border border-zinc-200 dark:border-[#23252a] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] text-zinc-900 dark:text-[#f7f8f8] relative animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header & Search */}
        <div className="p-3.5 border-b border-zinc-200 dark:border-[#1c1d22] flex items-center gap-2.5">
          <Search
            size={18}
            className="text-zinc-400 dark:text-[#8a8f98] shrink-0"
          />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setHighlightedIndex(0);
            }}
            placeholder="Search models or providers (e.g. flash, codestral, qwen)..."
            className="w-full bg-transparent text-sm text-zinc-900 dark:text-[#f7f8f8] placeholder-zinc-400 dark:placeholder-[#62666d] focus:outline-none"
          />
          {search && (
            <button
              onClick={() => {
                setSearch("");
                setHighlightedIndex(0);
              }}
              className="text-zinc-400 hover:text-zinc-700 dark:text-[#62666d] dark:hover:text-[#f7f8f8] p-1 rounded-md transition-colors"
            >
              <X size={14} />
            </button>
          )}
          <button
            onClick={() => loadModels(true)}
            title="Refresh models from provider APIs"
            className="text-zinc-500 hover:text-zinc-900 dark:text-[#8a8f98] dark:hover:text-[#f7f8f8] p-1 rounded-md transition-colors"
          >
            <RotateCw
              size={14}
              className={loading ? "animate-spin text-[#5e6ad2]" : ""}
            />
          </button>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-zinc-500 dark:text-[#8a8f98] bg-zinc-100 dark:bg-[#1a1b20] border border-zinc-200 dark:border-[#2b2c34] rounded">
            ESC
          </kbd>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-zinc-200 dark:border-[#1c1d22] bg-zinc-50 dark:bg-[#0c0d0f] overflow-x-auto no-scrollbar text-xs">
          <button
            onClick={() => {
              setActiveTab("all");
              setHighlightedIndex(0);
            }}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all shrink-0 ${
              activeTab === "all"
                ? "bg-white dark:bg-[#23252a] text-zinc-900 dark:text-[#f7f8f8] shadow-sm border border-zinc-200 dark:border-transparent"
                : "text-zinc-500 hover:text-zinc-900 dark:text-[#8a8f98] dark:hover:text-[#f7f8f8] hover:bg-zinc-200/50 dark:hover:bg-[#16171b]"
            }`}
          >
            All Models
          </button>
          {providers.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setActiveTab(p.id);
                setHighlightedIndex(0);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all shrink-0 ${
                activeTab === p.id
                  ? "bg-white dark:bg-[#23252a] text-zinc-900 dark:text-[#f7f8f8] shadow-sm border border-zinc-200 dark:border-transparent"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-[#8a8f98] dark:hover:text-[#f7f8f8] hover:bg-zinc-200/50 dark:hover:bg-[#16171b]"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-zinc-100 dark:bg-white/10 ring-1 ring-zinc-200 dark:ring-[#23252a]">
                <img
                  src={p.icon}
                  alt={p.name}
                  className="size-3.5 object-contain dark:[&[src*='openai.svg']]:invert dark:[&[src*='groq.svg']]:invert"
                />
              </span>
              <span>{p.name.replace("Google ", "")}</span>
              <span className="text-[10px] opacity-60">
                ({p.models.length})
              </span>
            </button>
          ))}
        </div>

        {/* Model List */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto p-2 divide-y divide-zinc-100 dark:divide-[#17181d]/50"
        >
          {filteredList.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-500 dark:text-[#8a8f98] flex flex-col items-center gap-2">
              <Cpu size={24} className="opacity-40" />
              <span>No models found matching &quot;{search}&quot;</span>
              <span className="text-xs text-zinc-400 dark:text-[#62666d]">
                Try searching for &quot;flash&quot;, &quot;qwen&quot;, or
                &quot;codestral&quot;
              </span>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredList.map((item, index) => {
                const isSelected =
                  selectedProvider === item.providerId &&
                  selectedModel === item.modelId;
                const isHighlighted = highlightedIndex === index;

                return (
                  <button
                    key={`${item.providerId}-${item.modelId}`}
                    data-index={index}
                    onClick={() => {
                      onSelect(item.providerId, item.modelId, item.icon);
                      onClose();
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all group ${
                      isHighlighted
                        ? "bg-zinc-100 dark:bg-[#1c1e24] text-zinc-900 dark:text-[#f7f8f8]"
                        : "hover:bg-zinc-50 dark:hover:bg-[#15161b] text-zinc-700 dark:text-[#c9cbd0]"
                    } ${isSelected ? "border border-[#5e6ad2]/50 bg-indigo-50/50 dark:bg-[#161822]" : ""}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-7 rounded-lg bg-zinc-100 dark:bg-[#181920] border border-zinc-200 dark:border-[#282a33] flex items-center justify-center shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <span className="">
                          <img
                            src={item.icon}
                            alt={item.modelName}
                            className="size-5 object-contain dark:[&[src*='openai.svg']]:invert dark:[&[src*='groq.svg']]:invert"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        </span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate text-zinc-900 dark:text-[#f7f8f8]">
                            {item.modelName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-[#6e727c]">
                          <span>{item.providerName}</span>
                          <span>•</span>
                          <span className="font-mono text-[11px] text-zinc-400 dark:text-[#555963] truncate">
                            {item.modelId}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isSelected && (
                        <div className="size-5 rounded-full bg-[#5e6ad2] text-white flex items-center justify-center">
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
