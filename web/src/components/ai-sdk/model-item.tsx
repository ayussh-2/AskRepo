"use client";

import React from "react";
import { Check } from "lucide-react";

export interface FlatModelItem {
  type: "model";
  providerId: string;
  providerName: string;
  modelId: string;
  modelName: string;
  icon: string;
}

export interface ModelItemProps {
  item: FlatModelItem;
  index: number;
  isSelected: boolean;
  isHighlighted: boolean;
  onSelect: (providerId: string, modelId: string, icon?: string) => void;
  onMouseEnter: () => void;
}

export const ModelItem: React.FC<ModelItemProps> = ({
  item,
  index,
  isSelected,
  isHighlighted,
  onSelect,
  onMouseEnter,
}) => {
  return (
    <button
      data-index={index}
      onClick={() => onSelect(item.providerId, item.modelId, item.icon)}
      onMouseEnter={onMouseEnter}
      className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all group ${
        isHighlighted
          ? "bg-zinc-100 dark:bg-[#1c1e24] text-zinc-900 dark:text-[#f7f8f8]"
          : "hover:bg-zinc-50 dark:hover:bg-[#15161b] text-zinc-700 dark:text-[#c9cbd0]"
      } ${isSelected ? "border border-[#5e6ad2]/50 bg-indigo-50/50 dark:bg-[#161822]" : ""}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="size-7 rounded-lg bg-zinc-100 dark:bg-[#181920] border border-zinc-200 dark:border-[#282a33] flex items-center justify-center shrink-0">
          <img
            src={item.icon}
            alt={item.modelName}
            className="size-5 object-contain dark:[&[src*='openai.svg']]:invert dark:[&[src*='groq.svg']]:invert"
            onError={(e) => {
              (e.target as HTMLElement).style.display = "none";
            }}
          />
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
};
