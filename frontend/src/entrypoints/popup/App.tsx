import Layout from '@/screens/layout/layout';
import IngestScreen from '@/screens/ingest/Ingest';
import ProgressScreen from '@/screens/progress/Progress';
import { useState } from 'react';

function App() {
  const [screen, setScreen] = useState<'ingest' | 'progress'>('ingest');
  const [jobId, setJobId] = useState<number | null>(null);

  const handleIngestStarted = (id: number) => {
    setJobId(id);
    setScreen('progress');
  };

  const handleBackToIngest = () => {
    setJobId(null);
    setScreen('ingest');
  };

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
