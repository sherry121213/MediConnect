'use client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import AppHeader from "./header";
import AppFooter from "./footer";
import { useAuth, useUserData } from "@/firebase";
import { signOut, sendEmailVerification } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Clock, ShieldAlert, FileSearch, BadgeCheck, Mail, CheckCircle2, AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function DoctorPendingVerification() {
  const auth = useAuth();
  const { user, userData } = useUserData();
  const router = useRouter();
  const { toast } = useToast();
  const [isResending, setIsResending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const handleLogout = () => {
    if (auth) {
      signOut(auth).then(() => {
        router.push('/');
      });
    }
  };

  const handleResendEmail = async () => {
    if (!user) return;
    setIsResending(true);
    try {
      await sendEmailVerification(user);
      toast({ title: "Email Sent", description: "A verification link has been sent to your inbox." });
    } catch (e) {
      toast({ variant: 'destructive', title: "Error", description: "Could not resend verification email." });
    } finally {
      setIsResending(false);
    }
  };

  const handleRefreshStatus = async () => {
    if (!user) return;
    setIsRefreshing(true);
    try {
      await user.reload();
      // NextJS layout will automatically re-render based on updated auth state
      toast({ title: "Status Refreshed", description: "Checking your latest credentials..." });
      window.location.reload();
    } catch (e) {
      toast({ variant: 'destructive', title: "Error", description: "Failed to refresh status." });
    } finally {
      setIsRefreshing(false);
    }
  };

  const isEmailVerified = !!user?.emailVerified;
  const isAdminVerified = !!userData?.verified;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <AppHeader />
      <main className="flex-grow flex flex-col items-center justify-center p-4 py-12">
        <div className="max-w-2xl w-full">
            <Card className="border-none shadow-2xl overflow-hidden rounded-[2.5rem] bg-white">
                <CardHeader className="bg-slate-900 text-white text-center p-8 sm:p-12 space-y-4">
                    <div className="mx-auto bg-primary/20 text-primary rounded-full p-4 w-fit shadow-inner">
                        <FileSearch className="h-10 w-10" />
                    </div>
                    <div className="space-y-1">
                        <CardTitle className="text-3xl font-bold font-headline tracking-tight">Onboarding in Progress</CardTitle>
                        <p className="text-slate-400 text-sm font-medium">Dr. {userData?.firstName}, your professional profile is being finalized.</p>
                    </div>
                </CardHeader>
                <CardContent className="p-8 sm:p-12 space-y-8">
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground ml-1">Verification Roadmap</h4>
                        
                        {/* Status Item: Email */}
                        <div className={cn(
                            "p-5 rounded-2xl border-2 flex items-center justify-between transition-all",
                            isEmailVerified ? "bg-green-50/50 border-green-100" : "bg-muted/30 border-muted/50"
                        )}>
                            <div className="flex items-center gap-4">
                                <div className={cn("p-2 rounded-xl", isEmailVerified ? "bg-green-100 text-green-600" : "bg-muted text-muted-foreground")}>
                                    <Mail className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="font-bold text-sm">Email Authentication</p>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">
                                        {isEmailVerified ? 'Confirmed' : 'Awaiting confirmation'}
                                    </p>
                                </div>
                            </div>
                            {isEmailVerified ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                            ) : (
                                <Button variant="link" size="sm" onClick={handleResendEmail} disabled={isResending} className="text-xs font-bold p-0 h-auto">
                                    {isResending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                                    Resend Link
                                </Button>
                            )}
                        </div>

                        {/* Status Item: Admin Approval */}
                        <div className={cn(
                            "p-5 rounded-2xl border-2 flex items-center justify-between transition-all",
                            isAdminVerified ? "bg-green-50/50 border-green-100" : "bg-muted/30 border-muted/50"
                        )}>
                            <div className="flex items-center gap-4">
                                <div className={cn("p-2 rounded-xl", isAdminVerified ? "bg-green-100 text-green-600" : "bg-muted text-muted-foreground")}>
                                    <BadgeCheck className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="font-bold text-sm">Administrative Audit</p>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">
                                        {isAdminVerified ? 'Registry Approved' : 'Review in queue'}
                                    </p>
                                </div>
                            </div>
                            {isAdminVerified ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                            ) : (
                                <div className="flex items-center gap-2 text-[10px] font-bold text-amber-600 uppercase bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
                                    <Clock className="h-3 w-3" /> Pending
                                </div>
                            )}
                        </div>
                    </div>

                    {!isAdminVerified && (
                        <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6 flex gap-4 items-start">
                            <ShieldAlert className="h-6 w-6 text-primary shrink-0 mt-1" />
                            <div className="space-y-1">
                                <p className="font-bold text-slate-900 text-sm tracking-tight">Access Restricted</p>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Your portal features (Appointments, Chat, etc.) will unlock automatically once an administrator approves your professional details.
                                </p>
                            </div>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="p-8 sm:p-12 bg-slate-50 border-t flex flex-col sm:flex-row gap-4">
                    <div className="flex flex-col gap-2 flex-1">
                        <Button variant="outline" onClick={handleRefreshStatus} disabled={isRefreshing} className="h-14 rounded-2xl font-bold border-2 bg-white">
                            {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                            Refresh Account Status
                        </Button>
                        <p className="text-[9px] text-center text-muted-foreground italic">Check for updates after verifying email</p>
                    </div>
                    <Button variant="ghost" onClick={handleLogout} className="h-14 rounded-2xl font-bold border-2 hover:bg-destructive/5 hover:text-destructive">
                        Log Out
                    </Button>
                </CardFooter>
            </Card>

            <div className="mt-8 text-center space-y-4">
                <Button asChild variant="link" className="text-muted-foreground hover:text-primary font-bold">
                    <Link href="/doctor-portal/profile">Update Professional Info →</Link>
                </Button>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.2em] flex items-center justify-center gap-2">
                    <Clock className="h-3 w-3" /> Average Audit Window: 12-24 Hours
                </p>
            </div>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
