import Layout from '@/screens/layout/layout';
import IngestScreen from '@/screens/ingest/Ingest';
import ProgressScreen from '@/screens/progress/Progress';
import { useState, useEffect } from 'react';
import { setApiToken } from '@/lib/api';
import { Typography } from '@/components/typography/Typography';
import { Button } from '@/components/ui/button';

function App() {
  const [screen, setScreen] = useState<'ingest' | 'progress'>('ingest');
  const [jobId, setJobId] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);



  const handleLogin = () => {
    if (typeof chrome !== 'undefined' && chrome.identity) {
      chrome.identity.getAuthToken({ interactive: true }, (authToken) => {
        if (chrome.runtime.lastError || !authToken) {
          console.error("Auth failed:", chrome.runtime.lastError);
          return;
        }
        setApiToken(authToken);
        setToken(authToken);
      });
    } else {
      // Mock login for local browser testing/dev server environment
      const mockToken = "mock_google_id_token";
      setApiToken(mockToken);
      setToken(mockToken);
    }
  };

  const handleIngestStarted = (id: number) => {
    setJobId(id);
    setScreen('progress');
  };

  const handleBackToIngest = () => {
    setJobId(null);
    setScreen('ingest');
  };

  if (!token) {
    return (
      <Layout>
        <div className="space-y-6 flex flex-col items-center justify-center py-12 text-center">
          <div className="space-y-2">
            <Typography variant="headline" className="font-semibold text-foreground tracking-tight">
              Welcome to askRepo
            </Typography>
            <Typography variant="body-sm" className="text-muted-foreground max-w-xs mx-auto">
              Please sign in with Google to index and search codebases.
            </Typography>
          </div>
          
          <Button onClick={handleLogin} className="w-full max-w-xs font-medium">
            Sign In with Google
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {screen === 'ingest' ? (
        <IngestScreen onIngestStarted={handleIngestStarted} />
      ) : (
        <ProgressScreen jobId={jobId!} onBack={handleBackToIngest} />
      )}
    </Layout>
  );
}

export default App;
