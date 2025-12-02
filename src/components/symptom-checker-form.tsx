'use client';

import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { aiSymptomChecker } from '@/ai/ai-symptom-checker';

export default function SymptomCheckerForm() {
  const [symptoms, setSymptoms] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ suggestedLabTests: string; relevantMedicalSpecialists: string; } | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symptoms.trim()) {
      setError('Please describe your symptoms.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    
    try {
      const analysis = await aiSymptomChecker({ symptoms });
      setResult(analysis);
    } catch (err) {
      setError('An error occurred while analyzing your symptoms. Please try again.');
      console.error(err);
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
            <div className="space-y-2">
              <p><strong>Suggested Specialist:</strong> {result.relevantMedicalSpecialists}</p>
              <p><strong>Suggested Lab Tests:</strong> {result.suggestedLabTests}</p>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </form>
  );
}
