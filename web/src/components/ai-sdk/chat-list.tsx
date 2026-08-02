import * as React from "react";
import { useEffect, useRef } from "react";
import { Message } from "./types";
import { ChatMessage } from "./chat-message";

export interface ChatListProps {
  messages: Message[];
  isLoading?: boolean;
}

export const ChatList: React.FC<ChatListProps> = ({ messages, isLoading }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 w-full flex flex-col">
      <div className="max-w-3xl lg:max-w-4xl w-full mx-auto flex-1 flex flex-col space-y-4">
        {messages.map((message, i) => (
          <ChatMessage
            key={message.id || i}
            message={message}
            isLoading={isLoading}
            isLastMessage={i === messages.length - 1}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
