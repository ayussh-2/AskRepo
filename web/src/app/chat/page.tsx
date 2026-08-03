import { Suspense } from "react";
import ChatClientPage from "./[repo]/chat-client";

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatClientPage repo="" />
    </Suspense>
  );
}
