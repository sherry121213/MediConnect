'use client';

import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// This is a mock function. In a real app, this would be a server action calling the AI flow.
async function getSymptomAnalysis(symptoms: string) {
  return new Promise<string>((resolve) => {
    setTimeout(() => {
      if (symptoms.toLowerCase().includes('chest pain')) {
        resolve("Based on your symptoms, it is advisable to consult a **Cardiologist**. We also recommend considering an **ECG** and a **Lipid Profile** test.");
      } else if (symptoms.toLowerCase().includes('rash')) {
        resolve("Your symptoms may be related to a skin condition. We suggest consulting a **Dermatologist**. A **skin biopsy** might be recommended for further diagnosis.");
      } else {
        resolve("Based on your symptoms, we recommend consulting a **General Physician** for a primary evaluation. They may suggest further tests like a **Complete Blood Count (CBC)**.");
      }
    }, 1500);
  });
}

export default function SymptomCheckerForm() {
  const [symptoms, setSymptoms] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symptoms.trim()) {
      setError('Please describe your symptoms.');
      return;
    }
    setLoading(true);
    setError('');
    setResult('');
    
    try {
      const analysis = await getSymptomAnalysis(symptoms);
      setResult(analysis);
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Textarea
        placeholder="e.g., I have a headache and a persistent cough..."
        value={symptoms}
        onChange={(e) => setSymptoms(e.target.value)}
        rows={4}
        disabled={loading}
      />
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Analyze Symptoms
      </Button>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {result && (
        <Alert variant="default" className="bg-primary/10">
          <AlertTitle>AI Analysis Result</AlertTitle>
          <AlertDescription>
            <div dangerouslySetInnerHTML={{ __html: result.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
          </AlertDescription>
        </Alert>
      )}
    </form>
  );
}
