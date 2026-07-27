import { useEffect, useState, useRef } from 'react';
import { Send, X, Copy, Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Typography } from '@/components/typography/Typography';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import { Conversation, ConversationContent } from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse, MessageActions, MessageAction } from '@/components/ai-elements/message';
import { Input } from '@/components/ui/input';
import { TextShimmer } from 'components/motion-primitives/text-shimmer';

interface ChatScreenProps {
  repoName: string | null;
  onClose: () => void;
}

interface MessageData {
  id: string;
  role: 'user' | 'bot';
  text: string;
  isError?: boolean;
}

export default function ChatScreen({ repoName, onClose }: ChatScreenProps) {
  const [messages, setMessages] = useState<MessageData[]>([
    {
      id: 'welcome',
      role: 'bot',
      text: 'Hello! I am askRepo, your AI assistant for this repository. Ask me anything about the codebase!',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [width, setWidth] = useState(420);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const isResizing = useRef(false);

  // Fetch restored temporary chat history from Redis
  useEffect(() => {
    if (!repoName) return;
    api.getChatHistory(repoName).then((res) => {
      if (res.ok && res.data.history && res.data.history.length > 0) {
        setMessages(
          res.data.history.map((m, idx) => ({
            id: `hist-${idx}`,
            role: m.role === 'user' ? 'user' : 'bot',
            text: m.content,
          }))
        );
      }
    });
  }, [repoName]);

  const handleClearHistory = async () => {
    if (!repoName) return;
    await api.clearChatHistory(repoName);
    setMessages([
      {
        id: 'welcome',
        role: 'bot',
        text: `Cleared history. How can I help you with ${repoName}?`,
      },
    ]);
  };

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.max(340, Math.min(window.innerWidth - 60, startWidth + (startX - moveEvent.clientX)));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    if (!repoName) {
      setMessages(prev => [
        ...prev,
        { id: crypto.randomUUID(), role: 'user', text: input.trim() },
        {
          id: crypto.randomUUID(),
          role: 'bot',
          text: 'I cannot detect a valid GitHub repository on this page. Please navigate to a repository page to query.',
          isError: true,
        },
      ]);
      setInput('');
      return;
    }

    const userText = input.trim();
    setInput('');
    setIsLoading(true);

    const userMsgId = crypto.randomUUID();
    const botMsgId = crypto.randomUUID();

    setMessages(prev => [...prev, { id: userMsgId, role: 'user', text: userText }]);

    let botResponseText = '';
    setMessages(prev => [...prev, { id: botMsgId, role: 'bot', text: '' }]);

    try {
      const response = await api.query(repoName, userText);

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.message || `Server responded with status ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response stream is not available');
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

          setMessages(prev =>
            prev.map(m => (m.id === botMsgId ? { ...m, text: botResponseText } : m))
          );
        }
      }
    } catch (err: any) {
      console.error('Streaming error:', err);
      const errMsg = err.message || 'Cannot reach the askRepo server. Is the backend running?';
      setMessages(prev =>
        prev.map(m =>
          m.id === botMsgId ? { ...m, text: errMsg, isError: true } : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      style={{ width: `${width}px` }}
      className="fixed top-0 right-0 h-screen max-w-[calc(100vw-32px)] flex flex-col bg-background/98 backdrop-blur-md border-l border-border shadow-2xl overflow-hidden z-[99998] transition-all duration-150 font-sans text-foreground"
    >
      {/* Left-edge drag handle for resizing the side panel */}
      <div 
        className="absolute left-0 top-0 w-1.5 h-full cursor-ew-resize hover:bg-primary/40 transition-colors z-[100000]"
        onMouseDown={startResize}
        title="Drag to resize panel width"
      />

      {/* Extension Right Panel Top Header */}
      <div className="py-3 px-4 border-b border-border bg-card/60 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="min-w-0">
            <Typography
              variant="body"
              as="h3"
              className="font-semibold text-sm leading-none flex items-center gap-1.5 text-foreground"
            >
              askRepo Panel
            </Typography>
            <Typography
              variant="mono"
              className="text-[11px] text-muted-foreground truncate block mt-1"
            >
              {repoName || 'No repository selected'}
            </Typography>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {repoName && messages.length > 1 && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={handleClearHistory}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Clear chat history"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            className="text-muted-foreground hover:cursor-pointer hover:bg-destructive/20 hover:text-destructive transition-colors"
            title="Close side panel"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Main Panel Chat Conversation Scroll Area */}
      <Conversation className="bg-background flex-1 overflow-hidden">
        <ConversationContent>
          {messages.map((message, messageIndex) => {
            const isLastMessage = messageIndex === messages.length - 1;
            const displayRole = message.role === 'bot' ? 'assistant' : 'user';

            return (
              <div key={message.id} className="group">
                <Message from={displayRole}>
                  <MessageContent>
                    {message.text === '' && isLoading && isLastMessage ? (
                      <div className="flex items-center gap-1.5 py-1 px-2">
                        <TextShimmer className="font-sans text-sm" duration={1}>
                          Thinking...
                        </TextShimmer>
                      </div>
                    ) : (
                      <MessageResponse>{message.text}</MessageResponse>
                    )}
                  </MessageContent>
                </Message>

                {/* Copy action below messages */}
                {message.role === 'bot' && message.text && !message.isError && (
                  <MessageActions className="justify-start pl-1">
                    <MessageAction
                      onClick={async () => {
                        await navigator.clipboard.writeText(message.text);
                        setCopiedMessageId(message.id);
                        setTimeout(() => {
                          setCopiedMessageId(current => current === message.id ? null : current);
                        }, 2000);
                      }}
                      label={copiedMessageId === message.id ? "Copied!" : "Copy response"}
                    >
                      {copiedMessageId === message.id ? <Check className="text-green-500" /> : <Copy />}
                    </MessageAction>
                  </MessageActions>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </ConversationContent>
      </Conversation>

      {/* Fixed Bottom Panel Input Bar */}
      <div className="p-3 border-t border-border bg-card/40 shrink-0">
        <div className="relative flex items-center gap-2">
          <Input
            type="text"
            placeholder="Ask me...."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            className="flex-1 min-w-0 h-10 bg-secondary/80 text-foreground border border-border rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:border-primary/50 transition-colors"
            disabled={isLoading}
          />
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="absolute right-2 text-muted-foreground hover:text-foreground hover:bg-secondary/80 disabled:opacity-40 disabled:hover:bg-transparent transition-all [&_svg]:size-4"
          >
            {isLoading ? <Spinner /> : <Send />}
          </Button>
        </div>
      </div>
    </div>
  );
}
