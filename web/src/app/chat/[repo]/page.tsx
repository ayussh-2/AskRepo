import ChatClientPage from "./chat-client";

export function generateStaticParams() {
  return [
    { repo: "default" }
  ];
}

export default async function ChatPage({ params }: { params: Promise<{ repo: string }> }) {
  const resolvedParams = await params;
  return <ChatClientPage repo={resolvedParams.repo} />;
}
