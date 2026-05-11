
"use client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Globe, Calendar, Zap, Siren, ArrowRight, ShieldAlert, Activity, Loader2, TrendingUp, BarChart3, Target, CheckCircle2 } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, limit, orderBy } from "firebase/firestore";
import type { Doctor, Appointment, Patient } from "@/lib/types";
import { format, isSameDay, startOfDay, startOfWeek, startOfMonth, isAfter } from "date-fns";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export default function AdminDashboardPage() {
  const firestore = useFirestore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
      setMounted(true);
  }, []);

  const appointmentsCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'appointments');
  }, [firestore]);
  const { data: appointments, isLoading: isLoadingAppointments } = useCollection<Appointment>(appointmentsCollection);

  const doctorsCollection = useMemoFirebase(() => {
      if (!firestore) return null;
      return collection(firestore, 'doctors');
  }, [firestore]);
  const { data: doctors, isLoading: isLoadingDoctors } = useCollection<Doctor>(doctorsCollection);

  const patientsQuery = useMemoFirebase(() => {
      if (!firestore) return null;
      return query(collection(firestore, 'patients'), where('role', '==', 'patient'));
  }, [firestore]);
  const { data: patients, isLoading: isLoadingPatients } = useCollection<Patient>(patientsQuery);

  const missedAuditQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'missedSessionAudits'), orderBy('loggedAt', 'desc'), limit(5));
  }, [firestore]);
  const { data: missedAudits } = useCollection<any>(missedAuditQuery);

  const activeLogsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'consultationLogs'), orderBy('timestamp', 'desc'), limit(5));
  }, [firestore]);
  const { data: activeLogs } = useCollection<any>(activeLogsQuery);
  
  const stats = useMemo(() => {
    if (!appointments || !doctors || !patients) return { 
        totalRevenue: 0, 
        todayRevenue: 0, 
        weeklyRevenue: 0,
        monthlyRevenue: 0,
        weeklyCount: 0,
        monthlyCount: 0,
        verifiedDoctors: 0, 
        todayBookings: 0, 
        missedCount: 0 
    };

    const now = new Date();
    const todayStart = startOfDay(now);
    const weekStart = startOfWeek(now);
    const monthStart = startOfMonth(now);

    const approvedApts = appointments.filter(apt => apt && apt.paymentStatus === 'approved');
    const todayApts = appointments.filter(apt => apt && apt.createdAt && isAfter(new Date(apt.createdAt), todayStart));
    const weeklyApts = appointments.filter(apt => apt && apt.createdAt && isAfter(new Date(apt.createdAt), weekStart));
    const monthlyApts = appointments.filter(apt => apt && apt.createdAt && isAfter(new Date(apt.createdAt), monthStart));

    return {
        totalRevenue: approvedApts.reduce((sum, a) => sum + (a.amount || 1500), 0),
        todayRevenue: todayApts.filter(a => a.paymentStatus === 'approved').reduce((sum, a) => sum + (a.amount || 1500), 0),
        weeklyRevenue: weeklyApts.filter(a => a.paymentStatus === 'approved').reduce((sum, a) => sum + (a.amount || 1500), 0),
        monthlyRevenue: monthlyApts.filter(a => a.paymentStatus === 'approved').reduce((sum, a) => sum + (a.amount || 1500), 0),
        weeklyCount: weeklyApts.length,
        monthlyCount: monthlyApts.length,
        verifiedDoctors: doctors.filter(d => d && d.verified).length,
        todayBookings: todayApts.length,
        missedCount: appointments.filter(apt => apt && apt.status === 'expired').length
    };
  }, [appointments, doctors, patients]);

  if (!mounted || isLoadingAppointments || isLoadingDoctors || isLoadingPatients) {
      return <div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-4 md:p-8 space-y-8 bg-slate-50/50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Clinical Command Center</h1>
            <p className="text-muted-foreground text-sm flex items-center gap-2"><Globe className="h-4 w-4 text-primary" /> Global Platform Surveillance.</p>
        </div>
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border shadow-sm text-xs font-bold text-slate-600">
            <Calendar className="h-4 w-4 text-primary" /> {format(new Date(), "EEEE, MMM do")}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-sm"><CardContent className="p-6"><p className="text-[10px] font-bold uppercase text-muted-foreground">Today's Revenue</p><p className="text-2xl font-bold">PKR {stats.todayRevenue.toLocaleString()}</p></CardContent></Card>
        <Card className="border-none shadow-sm"><CardContent className="p-6"><p className="text-[10px] font-bold uppercase text-muted-foreground">Today's Bookings</p><p className="text-2xl font-bold">{stats.todayBookings}</p></CardContent></Card>
        <Card className="border-none shadow-sm"><CardContent className="p-6"><p className="text-[10px] font-bold uppercase text-muted-foreground">Verified Doctors</p><p className="text-2xl font-bold">{stats.verifiedDoctors}</p></CardContent></Card>
        <Card className="border-none shadow-sm"><CardContent className="p-6"><p className="text-[10px] font-bold uppercase text-muted-foreground">Missed Slots</p><p className="text-2xl font-bold text-destructive">{stats.missedCount}</p></CardContent></Card>
      </div>

      {/* NEW: Platform Velocity Spectrum (Weekly/Monthly) */}
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-8">
            <Card className="border-none shadow-2xl overflow-hidden bg-white rounded-3xl">
                <CardHeader className="bg-slate-900 text-white p-6">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-xl font-headline flex items-center gap-3">
                            <TrendingUp className="h-6 w-6 text-primary" /> Platform Velocity Spectrum
                        </CardTitle>
                        <Badge variant="outline" className="border-white/20 text-white text-[10px] uppercase font-bold">Time-Series Analytics</Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="grid md:grid-cols-2 divide-x border-b">
                        <div className="p-8 space-y-4">
                            <div className="flex items-center gap-3 text-muted-foreground mb-2">
                                <BarChart3 className="h-5 w-5" />
                                <h3 className="text-xs font-bold uppercase tracking-widest">Weekly Momentum</h3>
                            </div>
                            <div className="space-y-1">
                                <p className="text-4xl font-bold tracking-tighter">PKR {stats.weeklyRevenue.toLocaleString()}</p>
                                <p className="text-xs text-muted-foreground font-medium">{stats.weeklyCount} Total Consultations this week</p>
                            </div>
                        </div>
                        <div className="p-8 space-y-4 bg-primary/5">
                            <div className="flex items-center gap-3 text-primary mb-2">
                                <Target className="h-5 w-5" />
                                <h3 className="text-xs font-bold uppercase tracking-widest">Monthly Reach</h3>
                            </div>
                            <div className="space-y-1">
                                <p className="text-4xl font-bold tracking-tighter text-primary">PKR {stats.monthlyRevenue.toLocaleString()}</p>
                                <p className="text-xs text-slate-500 font-medium">{stats.monthlyCount} Records indexed this month</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-6 flex items-center justify-between bg-muted/10">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-green-500" />
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">Stable Growth</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-primary" />
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">Clinical Capacity: 85%</span>
                            </div>
                        </div>
                        <Button variant="ghost" size="sm" className="text-[10px] font-bold uppercase" asChild>
                            <Link href="/admin/payments">Audit All Transactions <ArrowRight className="ml-2 h-3 w-3" /></Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-lg overflow-hidden bg-white">
                <CardHeader className="bg-primary/5 border-b"><CardTitle className="text-lg flex items-center gap-2"><Siren className="h-5 w-5 text-primary" /> Live Operational Feed</CardTitle></CardHeader>
                <CardContent className="p-0">
                    {activeLogs && activeLogs.length > 0 ? (
                        <div className="divide-y">
                            {activeLogs.map((log: any) => (
                                <div key={log.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-green-100 text-green-700 rounded-full"><Activity className="h-4 w-4" /></div>
                                        <div>
                                            <p className="text-xs font-bold">{log.description || 'Consultation session active'}</p>
                                            <p className="text-[10px] text-muted-foreground">ID: {log.appointmentId.slice(0,8)}</p>
                                        </div>
                                    </div>
                                    <p className="text-[10px] font-bold uppercase text-muted-foreground">{format(new Date(log.timestamp), "p")}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20 text-muted-foreground italic text-sm">No live session activity detected.</div>
                    )}
                </CardContent>
            </Card>
        </div>

        <div className="lg:col-span-4 space-y-8">
            <Card className="border-none shadow-2xl bg-slate-900 text-white overflow-hidden rounded-3xl">
                <CardContent className="p-8 space-y-6">
                    <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center">
                        <CheckCircle2 className="h-6 w-6 text-primary" />
                    </div>
                    <div className="space-y-2">
                        <h4 className="text-xl font-bold font-headline">Platform Integrity</h4>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            Auto-expiry and notification suppression are active. Completed sessions are locked against further audit alerts.
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-2xl bg-white h-full flex flex-col">
                <CardHeader className="bg-slate-900 text-white rounded-t-xl"><CardTitle className="text-lg">Real-time Missed Logs</CardTitle></CardHeader>
                <CardContent className="p-6">
                    {missedAudits && missedAudits.length > 0 ? (
                        <div className="space-y-4">
                            {missedAudits.map((log: any) => (
                                <div key={log.id} className="p-3 rounded-xl bg-muted/30 border text-[10px] space-y-1">
                                    <p className="font-bold text-destructive flex items-center justify-between">SESSION MISSED <span className="opacity-50">{format(new Date(log.loggedAt), "p")}</span></p>
                                    <p className="text-slate-600">ID: {log.appointmentId.slice(0, 8)}...</p>
                                    <p className="text-slate-600">Scheduled: {format(new Date(log.scheduledTime), "MMM dd, p")}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center py-12 text-xs text-muted-foreground italic">No missed session logs detected.</p>
                    )}
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
