import { useEffect, useState, useRef } from 'react';
import { Send, X, Copy, Check } from 'lucide-react';
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
  const [sessionId] = useState(() => crypto.randomUUID());
  const [width, setWidth] = useState(384);
  const [height, setHeight] = useState(550);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const isResizing = useRef(false);

  const startResize = (e: React.MouseEvent, direction: 'left' | 'top' | 'top-left') => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = width;
    const startHeight = height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizing.current) return;
      if (direction === 'left' || direction === 'top-left') {
        const newWidth = Math.max(320, Math.min(800, startWidth + (startX - moveEvent.clientX)));
        setWidth(newWidth);
      }
      if (direction === 'top' || direction === 'top-left') {
        const newHeight = Math.max(400, Math.min(window.innerHeight - 100, startHeight + (startY - moveEvent.clientY)));
        setHeight(newHeight);
      }
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
  }, [messages]);

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
      const response = await api.query(repoName, userText, sessionId);

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
      style={{ width: `${width}px`, height: `${height}px` }}
      className="fixed bottom-24 right-6 min-w-[40vw] min-h-[80vh] max-w-[calc(100vw-32px)] max-h-[calc(100vh-100px)] flex flex-col bg-card/95 backdrop-blur-md border border-border rounded-2xl shadow-2xl overflow-hidden z-[99998] transition-shadow duration-300 font-sans text-foreground"
    >
      <div 
        className="absolute left-0 top-0 w-1.5 h-full cursor-ew-resize hover:bg-primary/20 transition-colors z-[100000]"
        onMouseDown={(e) => startResize(e, 'left')}
      />
      <div 
        className="absolute left-0 top-0 h-1.5 w-full cursor-ns-resize hover:bg-primary/20 transition-colors z-[100000]"
        onMouseDown={(e) => startResize(e, 'top')}
      />
      <div 
        className="absolute left-0 top-0 w-3.5 h-3.5 cursor-nwse-resize hover:bg-primary/20 transition-colors z-[100001]"
        onMouseDown={(e) => startResize(e, 'top-left')}
      />
      <div className="py-2 px-4 border-b border-border bg-background flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          
          <div className="min-w-0">
            <Typography
              variant="body"
              as="h3"
              className="font-semibold text-sm leading-none flex items-center gap-1.5"
            >
              askRepo Chat
            </Typography>
            <Typography
              variant="mono"
              className="text-[11px] text-muted-foreground truncate block mt-1"
            >
              {repoName || 'No repository selected'}
            </Typography>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          className="text-muted-foreground hover:cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
        >
          <X className="size-4" />
        </Button>
      </div>

      <Conversation className='bg-background'>
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
                        <TextShimmer className='font-sans text-sm' duration={1}>
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

      <div className=" p-2 bg-background">
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
