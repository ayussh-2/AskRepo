"use client";

import { useState, useEffect } from "react";
import { Message } from "@/components/ai-sdk/types";
import { fetchChatHistoryApi, streamQueryApi } from "@/lib/api";

export function useChat(
  repoName: string,
  token: string | null,
  handleUnauthorized: () => void
) {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>("auto");

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

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        botResponseText += chunk;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === botMsgId ? { ...m, content: botResponseText } : m
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
    setSelectedProvider,
    handleSubmitQuery,
  };
}
