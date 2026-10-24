"use client";

import { useState, useEffect } from "react";
import { Message, SwitchedModelInfo } from "@/components/ai-sdk/types";
import { fetchChatHistoryApi, fetchModelsApi, streamQueryApi } from "@/lib/api";

export function useChat(
  repoName: string,
  token: string | null,
  handleUnauthorized: () => void
) {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>("auto");
  const [selectedModel, setSelectedModel] = useState<string>("auto");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedProvider = localStorage.getItem("askrepo_preferred_provider");
      const savedModel = localStorage.getItem("askrepo_preferred_model");
      if (savedProvider && savedProvider !== "auto") setSelectedProvider(savedProvider);
      if (savedModel && savedModel !== "auto") setSelectedModel(savedModel);
    }
  }, []);

  useEffect(() => {
    let active = true;

    fetchModelsApi().then((res) => {
      if (!active || !res.success || !res.data?.providers?.length) return;

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

      if (defaultProv && defaultMod) {
        setSelectedProvider((prev) => (prev === "auto" || !prev ? defaultProv : prev));
        setSelectedModel((prev) => (prev === "auto" || !prev ? defaultMod : prev));
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const handleSelectModel = (provider: string, model: string) => {
    setSelectedProvider(provider);
    setSelectedModel(model);
    if (typeof window !== "undefined") {
      localStorage.setItem("askrepo_preferred_provider", provider);
      localStorage.setItem("askrepo_preferred_model", model);
    }
  };

  useEffect(() => {
    let active = true;
    if (!token || !repoName) return;

    async function loadChatHistory() {
      setMessages([
        {
          id: "loading",
          role: "bot",
          content: `Loading chat history for ${repoName}...`,
        },
      ]);

      const res = await fetchChatHistoryApi(repoName, token!, handleUnauthorized);
      if (res.success && res.data?.history?.length && active) {
        setMessages(
          res.data.history.map(
            (m: { role: string; content: string }, idx: number) => ({
              id: `hist-${idx}`,
              role: m.role === "user" ? "user" : "bot",
              content: m.content,
            })
          )
        );
        return;
      }

      if (active) {
        setMessages([
          {
            id: "welcome",
            role: "bot",
            content: `Hello! I am askRepo, your AI assistant for ${repoName}. Ask me anything about the codebase!`,
          },
        ]);
      }
    }

    loadChatHistory();

    return () => {
      active = false;
    };
  }, [token, repoName, handleUnauthorized]);

  const handleSubmitQuery = async () => {
    if (!query.trim() || !repoName || !token || isLoading) return;

    const userText = query.trim();
    setQuery("");
    setIsLoading(true);

    const userMsgId = Math.random().toString(36).substring(2);
    const botMsgId = Math.random().toString(36).substring(2);

    setMessages((prev) => [
      ...prev.filter((m) => m.id !== "loading"),
      { id: userMsgId, role: "user", content: userText },
      { id: botMsgId, role: "bot", content: "" },
    ]);

    let botResponseText = "";

    const { res: response, error } = await streamQueryApi(
      repoName,
      userText,
      selectedProvider,
      selectedModel,
      token,
      handleUnauthorized
    );

    if (error || !response) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMsgId
            ? { ...m, content: error || "Failed to query server", isError: true }
            : m
        )
      );
      setIsLoading(false);
      return;
    }

    if (!response.body) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMsgId
            ? { ...m, content: "Response stream unavailable", isError: true }
            : m
        )
      );
      setIsLoading(false);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let done = false;
    let switchedModelInfo: SwitchedModelInfo | undefined;
    let rawBuffer = "";

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        rawBuffer += chunk;

        // Check for model switch event marker
        if (rawBuffer.includes("<!-- MODEL_SWITCH:")) {
          const match = rawBuffer.match(/<!-- MODEL_SWITCH:(.*?) -->/);
          if (match) {
            try {
              const data = JSON.parse(match[1]);
              switchedModelInfo = {
                provider: data.provider,
                model: data.model,
                originalProvider: data.original_provider,
                originalModel: data.original_model,
              };

              // Immediately reflect the switched provider & model in state & UI
              setSelectedProvider(data.provider);
              setSelectedModel(data.model);

              if (typeof window !== "undefined") {
                localStorage.setItem("askrepo_preferred_provider", data.provider);
                localStorage.setItem("askrepo_preferred_model", data.model);
              }
            } catch (err) {
              console.error("Failed to parse MODEL_SWITCH metadata:", err);
            }
          }
        }

        // Clean out any switch marker from visible message text
        botResponseText = rawBuffer.replace(/<!-- MODEL_SWITCH:.*?-->\r?\n?/g, "");

        setMessages((prev) =>
          prev.map((m) =>
            m.id === botMsgId
              ? {
                  ...m,
                  content: botResponseText,
                  switchedModel: switchedModelInfo || m.switchedModel,
                }
              : m
          )
        );
      }
    }

    setIsLoading(false);
  };

  return {
    query,
    setQuery,
    messages,
    isLoading,
    selectedProvider,
    selectedModel,
    setSelectedProvider,
    setSelectedModel,
    handleSelectModel,
    handleSubmitQuery,
  };
}
