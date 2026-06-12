import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { MessageSquare, X } from 'lucide-react';
import { parseRepoUrl } from '@/utils/url-parser';
import { Button } from '@/components/ui/button';
import ChatScreen from '@/screens/chat/Chat';

export default function App() {
  const [isEnabled, setIsEnabled] = useState(() => {
    return sessionStorage.getItem('askrepo_enabled') === 'true';
  });
  const [open, setOpen] = useState(false);
  const [repoName, setRepoName] = useState<string | null>(null);

  useEffect(() => {
    const detectRepo = () => {
      const result = parseRepoUrl(window.location.href);
      if (result.valid) {
        setRepoName(result.fullName);
      } else {
        setRepoName(null);
      }
    };
    
    detectRepo();
    const interval = setInterval(detectRepo, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (message: { type: string }) => {
      if (message.type === 'OPEN_CHAT') {
        setIsEnabled(true);
        setOpen(true);
        sessionStorage.setItem('askrepo_enabled', 'true');
      }
    };

    browser.runtime.onMessage.addListener(handler);
    return () => browser.runtime.onMessage.removeListener(handler);
  }, []);

  if (!isEnabled) return null;

  return (
    <>
      <Button
        variant="default"
        onClick={() => setOpen(prev => !prev)}
        className="fixed bottom-6 right-6 !size-14 flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer z-[99999] border border-border/10 [&_svg]:!size-6"
        title="Chat with repository"
      >
        {open ? <X /> : <MessageSquare />}
      </Button>

      {open && <ChatScreen repoName={repoName} onClose={() => setOpen(false)} />}
    </>
  );
}