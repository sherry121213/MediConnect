import AppHeader from "@/components/layout/header";
import AppFooter from "@/components/layout/footer";
import SymptomCheckerForm from "@/components/symptom-checker-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function SymptomCheckerPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-grow bg-secondary/30 py-16">
        <div className="container mx-auto px-4 flex justify-center">
          <Card className="w-full max-w-2xl shadow-xl">
            <CardHeader>
              <CardTitle className="text-3xl font-headline text-center">AI Symptom Checker</CardTitle>
              <CardDescription className="text-center">
                Describe your symptoms below to get an AI-powered analysis and recommendation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SymptomCheckerForm />
              <Alert variant="default" className="mt-6 bg-amber-50 border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-700">
                  <strong>Disclaimer:</strong> This tool is for informational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
