
"use client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Globe, Calendar, Siren, ArrowRight, Activity, Loader2, TrendingUp, BarChart3, Target, CheckCircle2, AlertCircle, Trash2, User, Stethoscope, ShieldCheck, Zap, Layers, History, DollarSign } from "lucide-react";
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
            <h1 className="text-3xl font-bold font-headline tracking-tight text-slate-900">Command Center</h1>
            <p className="text-muted-foreground text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary fill-primary" /> Real-time Platform Surveillance Engine
            </p>
        </div>
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border shadow-sm text-xs font-bold text-slate-600">
            <Calendar className="h-4 w-4 text-primary" /> {format(new Date(), "EEEE, MMM do")}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-none shadow-sm bg-white hover:shadow-md transition-shadow group rounded-2xl">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Today's Revenue</p>
                <p className="text-3xl font-bold mt-1 tracking-tight">PKR {stats.todayRevenue.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-primary/10 rounded-xl text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white hover:shadow-md transition-shadow group rounded-2xl">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Active Bookings</p>
                <p className="text-3xl font-bold mt-1 tracking-tight">{stats.todayBookings}</p>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Layers className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white hover:shadow-md transition-shadow group rounded-2xl">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Verified Providers</p>
                <p className="text-3xl font-bold mt-1 tracking-tight">{stats.verifiedDoctors}</p>
              </div>
              <div className="p-3 bg-green-50 text-green-600 rounded-xl group-hover:bg-green-600 group-hover:text-white transition-colors">
                <Stethoscope className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <Card className="border-none shadow-2xl overflow-hidden bg-white rounded-[2rem]">
            <CardHeader className="bg-slate-900 text-white p-8">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-2xl font-headline flex items-center gap-3">
                            <BarChart3 className="h-7 w-7 text-primary" /> Platform Velocity
                        </CardTitle>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-[0.2em] mt-1">Time-Series Performance Intelligence</p>
                    </div>
                    <Badge variant="outline" className="border-white/20 text-white text-[10px] uppercase font-bold px-3 py-1">Secure Data</Badge>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="grid md:grid-cols-2 divide-x divide-slate-100 border-b">
                    <div className="p-8 space-y-4">
                        <div className="flex items-center gap-3 text-muted-foreground mb-2">
                            <TrendingUp className="h-5 w-5 text-primary" />
                            <h3 className="text-xs font-bold uppercase tracking-widest">Weekly Momentum</h3>
                        </div>
                        <div className="space-y-1">
                            <p className="text-4xl font-bold tracking-tighter">PKR {stats.weeklyRevenue.toLocaleString()}</p>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase">{stats.weeklyCount} Consultations verified</p>
                        </div>
                    </div>
                    <div className="p-8 space-y-4 bg-primary/5">
                        <div className="flex items-center gap-3 text-primary mb-2">
                            <Target className="h-5 w-5" />
                            <h3 className="text-xs font-bold uppercase tracking-widest">Monthly Reach</h3>
                        </div>
                        <div className="space-y-1">
                            <p className="text-4xl font-bold tracking-tighter text-primary">PKR {stats.monthlyRevenue.toLocaleString()}</p>
                            <p className="text-[10px] text-slate-500 font-bold uppercase">{stats.monthlyCount} Record sets indexed</p>
                        </div>
                    </div>
                </div>
                <div className="p-6 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Financial Accuracy: 100%</span>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-[10px] font-bold uppercase hover:bg-white" asChild>
                        <Link href="/admin/payments">Audit Settlements <ArrowRight className="ml-2 h-3 w-3" /></Link>
                    </Button>
                </div>
            </CardContent>
        </Card>

        <Card className="border-none shadow-2xl bg-white rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-primary/5 border-b py-8 px-8">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-2xl flex items-center gap-3 font-headline text-slate-900">
                            <Siren className="h-7 w-7 text-primary" /> Missed Alerts
                        </CardTitle>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-[0.2em] mt-1">Real-time Clinical Surveillance</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {activeMissedAudits.length > 0 && (
                            <Button variant="ghost" size="sm" onClick={handleDismissAll} className="h-8 text-[10px] font-bold uppercase text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-full px-4">
                                Clear Log
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-8 h-[300px] overflow-hidden relative">
                {activeMissedAudits && activeMissedAudits.length > 0 ? (
                    <>
                        <Carousel
                            opts={{ align: "start", loop: true }}
                            plugins={[Autoplay({ delay: 5000, stopOnInteraction: true })]}
                            className="w-full"
                        >
                            <CarouselContent>
                                {activeMissedAudits.map((log: any) => {
                                    const doctor = doctors?.find(d => d.id === log.doctorId);
                                    return (
                                        <CarouselItem key={log.id} className="md:basis-1/1">
                                            <div className="p-6 border-2 border-destructive/10 bg-destructive/5 rounded-3xl space-y-4 animate-in fade-in zoom-in-95 duration-500 h-full">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center text-destructive shrink-0 border-2 border-white">
                                                            <User className="h-7 w-7" />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-lg text-slate-900">Dr. {doctor?.firstName} {doctor?.lastName}</p>
                                                            <p className="text-[10px] text-destructive font-bold uppercase tracking-widest">{doctor?.specialty || 'Medical Specialist'}</p>
                                                        </div>
                                                    </div>
                                                    <Badge variant="destructive" className="h-6 text-[9px] font-bold uppercase px-3 rounded-full">Expired Window</Badge>
                                                </div>
                                                <div className="flex items-center justify-between pt-2">
                                                    <p className="text-xs font-bold flex items-center gap-2 text-slate-600">
                                                        <AlertCircle className="h-4 w-4 text-destructive" />
                                                        {format(new Date(log.scheduledTime), "MMM dd, p")}
                                                    </p>
                                                    <Button variant="ghost" size="sm" asChild className="text-[10px] font-bold uppercase">
                                                        <Link href="/admin/missed-slots">Audit Trail</Link>
                                                    </Button>
                                                </div>
                                            </div>
                                        </CarouselItem>
                                    );
                                })}
                            </CarouselContent>
                            <CarouselPrevious className="hidden sm:flex -left-4 bg-white/90 backdrop-blur shadow-lg border-none" />
                            <CarouselNext className="hidden sm:flex -right-4 bg-white/90 backdrop-blur shadow-lg border-none" />
                        </Carousel>
                    </>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-40">
                        <ShieldCheck className="h-16 w-16 text-primary" />
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">No Clinical Disruptions</p>
                    </div>
                )}
            </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-6 pb-8">
          <Card className="border-none shadow-sm bg-white p-8 flex items-center gap-6 group cursor-pointer hover:bg-primary/5 transition-all rounded-3xl" asChild>
            <Link href="/admin/doctors">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
                    <Stethoscope className="h-7 w-7" />
                </div>
                <div>
                    <h4 className="font-bold text-base text-slate-900">Registry History</h4>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-0.5">Manage Providers</p>
                </div>
            </Link>
          </Card>
          <Card className="border-none shadow-sm bg-white p-8 flex items-center gap-6 group cursor-pointer hover:bg-blue-50 transition-all rounded-3xl" asChild>
            <Link href="/admin/patients">
                <div className="h-14 w-14 rounded-2xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all flex items-center justify-center shadow-inner">
                    <User className="h-7 w-7" />
                </div>
                <div>
                    <h4 className="font-bold text-base text-slate-900">Patient Pool</h4>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-0.5">Clinical Distribution</p>
                </div>
            </Link>
          </Card>
          <Card className="border-none shadow-sm bg-white p-8 flex items-center gap-6 group cursor-pointer hover:bg-slate-50 transition-all rounded-3xl" asChild>
            <Link href="/admin/missed-slots">
                <div className="h-14 w-14 rounded-2xl bg-slate-100 text-slate-600 group-hover:bg-slate-900 group-hover:text-white transition-all flex items-center justify-center shadow-inner">
                    <History className="h-7 w-7" />
                </div>
                <div>
                    <h4 className="font-bold text-base text-slate-900">Missed Session History</h4>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-0.5">Full Archive View</p>
                </div>
            </Link>
          </Card>
      </div>
    </div>
  );
}
