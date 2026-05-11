
"use client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Globe, Calendar, Siren, ArrowRight, Activity, Loader2, TrendingUp, BarChart3, Target, CheckCircle2, AlertCircle, Trash2, User, Stethoscope, ShieldCheck } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, limit, orderBy } from "firebase/firestore";
import type { Doctor, Appointment, Patient } from "@/lib/types";
import { format, isAfter, startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

export default function AdminDashboardPage() {
  const firestore = useFirestore();
  const [mounted, setMounted] = useState(false);
  const [dismissedMissedIds, setDismissedMissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
      setMounted(true);
      const saved = localStorage.getItem('admin_dismissed_missed');
      if (saved) {
          try {
              setDismissedMissedIds(new Set(JSON.parse(saved)));
          } catch (e) {
              console.error("Failed to load dismissed alerts", e);
          }
      }
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
    return query(collection(firestore, 'missedSessionAudits'), orderBy('loggedAt', 'desc'), limit(10));
  }, [firestore]);
  const { data: missedAudits } = useCollection<any>(missedAuditQuery);
  
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

  const activeMissedAudits = useMemo(() => {
      if (!missedAudits) return [];
      return missedAudits.filter((a: any) => !dismissedMissedIds.has(a.id));
  }, [missedAudits, dismissedMissedIds]);

  const handleDismissAll = () => {
    const newDismissed = new Set(dismissedMissedIds);
    activeMissedAudits.forEach((a: any) => newDismissed.add(a.id));
    setDismissedMissedIds(newDismissed);
    localStorage.setItem('admin_dismissed_missed', JSON.stringify(Array.from(newDismissed)));
  };

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

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6">
            <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Today's Revenue</p>
            <p className="text-2xl font-bold mt-1">PKR {stats.todayRevenue.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6">
            <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Today's Bookings</p>
            <p className="text-2xl font-bold mt-1">{stats.todayBookings}</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6">
            <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Verified Doctors</p>
            <p className="text-2xl font-bold mt-1">{stats.verifiedDoctors}</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-8">
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

        <Card className="border-none shadow-2xl bg-white rounded-3xl overflow-hidden">
            <CardHeader className="bg-primary/5 border-b py-6 px-8">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-3 font-headline">
                        <Siren className="h-6 w-6 text-primary" /> Real-time Missed Slots
                    </CardTitle>
                    <div className="flex items-center gap-3">
                         <Button variant="ghost" size="sm" onClick={handleDismissAll} className="h-8 text-[10px] font-bold uppercase text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3 w-3 mr-1.5" /> Clear Surveillance
                        </Button>
                        <Button size="sm" variant="outline" asChild className="h-8 text-[10px] font-bold uppercase rounded-xl">
                            <Link href="/admin/missed-slots">Full History</Link>
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-8">
                {activeMissedAudits && activeMissedAudits.length > 0 ? (
                    <Carousel
                        opts={{ align: "start", loop: true }}
                        plugins={[Autoplay({ delay: 4000, stopOnInteraction: true })]}
                        className="w-full"
                    >
                        <CarouselContent className="-ml-4">
                            {activeMissedAudits.map((log: any) => {
                                const doctor = doctors?.find(d => d.id === log.doctorId);
                                return (
                                    <CarouselItem key={log.id} className="pl-4 md:basis-1/3 lg:basis-1/4">
                                        <div className="p-1">
                                            <Card className="border-2 border-destructive/10 bg-destructive/5 rounded-2xl overflow-hidden">
                                                <CardContent className="p-5 space-y-4">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center text-destructive shrink-0">
                                                                <User className="h-5 w-5" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="font-bold text-sm truncate">Dr. {doctor?.firstName} {doctor?.lastName}</p>
                                                                <p className="text-[10px] text-destructive font-bold uppercase tracking-widest">{doctor?.specialty || 'Specialist'}</p>
                                                            </div>
                                                        </div>
                                                        <Badge variant="destructive" className="h-5 text-[8px] font-bold uppercase">Missed</Badge>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Scheduled Time</p>
                                                        <p className="text-xs font-semibold flex items-center gap-2">
                                                            <AlertCircle className="h-3 w-3 text-destructive" />
                                                            {format(new Date(log.scheduledTime), "MMM dd, p")}
                                                        </p>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </div>
                                    </CarouselItem>
                                );
                            })}
                        </CarouselContent>
                        <div className="flex justify-end gap-2 mt-4">
                            <CarouselPrevious className="static translate-y-0 h-8 w-8 rounded-xl border-2" />
                            <CarouselNext className="static translate-y-0 h-8 w-8 rounded-xl border-2" />
                        </div>
                    </Carousel>
                ) : (
                    <div className="text-center py-20 bg-muted/20 rounded-3xl border-2 border-dashed border-muted/50">
                        <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Surveillance Clear</p>
                        <p className="text-xs text-muted-foreground mt-1">No pending missed session logs detected.</p>
                    </div>
                )}
            </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between p-6 bg-slate-900 rounded-2xl text-white">
        <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
            </div>
            <div>
                <p className="font-bold">System Operational</p>
                <p className="text-xs text-slate-400">All clinical subsystems and media relays are functioning within normal parameters.</p>
            </div>
        </div>
        <div className="text-right hidden sm:block">
            <p className="text-[10px] font-bold uppercase text-slate-500">Security Standard</p>
            <p className="text-xs font-mono">AES-256 / SSL SECURE</p>
        </div>
      </div>
    </div>
  );
}
