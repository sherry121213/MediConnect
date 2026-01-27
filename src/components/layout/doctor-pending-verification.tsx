'use client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AppHeader from "./header";
import AppFooter from "./footer";
import { useAuth } from "@/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";

export default function DoctorPendingVerification() {
  const auth = useAuth();
  const router = useRouter();
  
  const handleLogout = () => {
    if (auth) {
      signOut(auth).then(() => {
        router.push('/');
      });
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-grow flex flex-col items-center justify-center bg-secondary/30 text-center p-4">
        <div className="max-w-md w-full">
            <Card className="p-6">
                <CardHeader className="p-0 mb-4">
                    <div className="mx-auto bg-amber-100 text-amber-800 rounded-full p-3 w-fit">
                        <Clock className="h-10 w-10" />
                    </div>
                </CardHeader>
                <CardTitle className="text-2xl font-bold font-headline">Verification Pending</CardTitle>
                <p className="text-muted-foreground mt-2">
                    Your profile has been submitted and is currently under review by our administration team. You will be notified by email once your account is verified.
                </p>
                <div className="mt-6 flex flex-col gap-2">
                    <Button variant="outline" onClick={handleLogout} className="w-full">
                        Log Out
                    </Button>
                </div>
            </Card>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
