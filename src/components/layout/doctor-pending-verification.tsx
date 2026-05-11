'use client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import AppHeader from "./header";
import AppFooter from "./footer";
import { useAuth, useUserData } from "@/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Clock, ShieldAlert, FileSearch, BadgeCheck, PhoneIncoming } from "lucide-react";
import Link from "next/link";

export default function DoctorPendingVerification() {
  const auth = useAuth();
  const { userData } = useUserData();
  const router = useRouter();
  
  const handleLogout = () => {
    if (auth) {
      signOut(auth).then(() => {
        router.push('/');
      });
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <AppHeader />
      <main className="flex-grow flex flex-col items-center justify-center p-4">
        <div className="max-w-2xl w-full">
            <Card className="border-none shadow-2xl overflow-hidden rounded-[2.5rem] bg-white">
                <CardHeader className="bg-slate-900 text-white text-center p-10 space-y-4">
                    <div className="mx-auto bg-primary/20 text-primary rounded-full p-4 w-fit shadow-inner">
                        <FileSearch className="h-10 w-10" />
                    </div>
                    <div className="space-y-1">
                        <CardTitle className="text-3xl font-bold font-headline tracking-tight">Credentials Under Audit</CardTitle>
                        <p className="text-slate-400 text-sm font-medium">Dr. {userData?.firstName}, we are verifying your professional status.</p>
                    </div>
                </CardHeader>
                <CardContent className="p-10 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-6 rounded-3xl bg-slate-50 border flex flex-col items-center text-center space-y-3">
                            <BadgeCheck className="h-6 w-6 text-primary" />
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Step 1: ID Verified</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">Profile photo and basic clinical data synced.</p>
                        </div>
                        <div className="p-6 rounded-3xl bg-primary/5 border-2 border-primary/20 flex flex-col items-center text-center space-y-3 animate-pulse">
                            <FileSearch className="h-6 w-6 text-primary" />
                            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Step 2: Degree Audit</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">Our Admin team is reviewing your uploaded documents.</p>
                        </div>
                        <div className="p-6 rounded-3xl bg-slate-50 border flex flex-col items-center text-center space-y-3 opacity-40">
                            <PhoneIncoming className="h-6 w-6 text-slate-400" />
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Step 3: Portal Active</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">Accepting patients and starting consultations.</p>
                        </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 flex gap-4 items-start">
                        <ShieldAlert className="h-6 w-6 text-amber-600 shrink-0 mt-1" />
                        <div className="space-y-1">
                            <p className="font-bold text-amber-900 text-sm tracking-tight">Platform Security Protocol</p>
                            <p className="text-xs text-amber-800/80 leading-relaxed">
                                To ensure patient safety, all healthcare providers must undergo a manual credential audit. You will receive an automated email once your verified status is active.
                            </p>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="p-10 bg-slate-50 border-t flex flex-col sm:flex-row gap-4">
                    <Button variant="outline" onClick={handleLogout} className="flex-1 h-14 rounded-2xl font-bold border-2">
                        Log Out of Secure Session
                    </Button>
                    <Button asChild className="flex-1 h-14 rounded-2xl font-bold shadow-lg">
                        <Link href="/doctor-portal/profile">View/Edit Application</Link>
                    </Button>
                </CardFooter>
            </Card>

            <div className="mt-8 text-center">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-2 font-medium">
                    <Clock className="h-3.5 w-3.5" /> Average Audit Time: 12 Hours
                </p>
            </div>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
