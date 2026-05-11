
"use client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Globe, Calendar, Siren, ArrowRight, Activity, Loader2, TrendingUp, BarChart3, Target, CheckCircle2, AlertCircle, Trash2, User, Stethoscope, ShieldCheck, Zap, Layers } from "lucide-react";
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
            <h1 className="text-3xl font-bold font-headline tracking-tight">Command Center</h1>
            <p className="text-muted-foreground text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary fill-primary" /> Real-time Platform Surveillance Engine
            </p>
        </div>
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border shadow-sm text-xs font-bold text-slate-600">
                <Calendar className="h-4 w-4 text-primary" /> {format(new Date(), "EEEE, MMM do")}
            </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="border-none shadow-sm bg-white hover:shadow-md transition-shadow group">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Today's Revenue</p>
                <p className="text-2xl font-bold mt-1">PKR {stats.todayRevenue.toLocaleString()}</p>
              </div>
              <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary group-hover:text-white transition-colors">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white hover:shadow-md transition-shadow group">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Active Bookings</p>
                <p className="text-2xl font-bold mt-1">{stats.todayBookings}</p>
              </div>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Layers className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white hover:shadow-md transition-shadow group">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Verified Providers</p>
                <p className="text-2xl font-bold mt-1">{stats.verifiedDoctors}</p>
              </div>
              <div className="p-2 bg-green-50 text-green-600 rounded-lg group-hover:bg-green-600 group-hover:text-white transition-colors">
                <Stethoscope className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-slate-900 text-white hover:shadow-md transition-shadow group">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Live Pulse</p>
                <p className="text-2xl font-bold mt-1">Active</p>
              </div>
              <div className="p-2 bg-white/10 rounded-lg">
                <Activity className="h-4 w-4 text-primary animate-pulse" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-8">
            <Card className="border-none shadow-2xl overflow-hidden bg-white rounded-3xl h-full">
                <CardHeader className="bg-slate-900 text-white p-6">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-xl font-headline flex items-center gap-3">
                            <TrendingUp className="h-6 w-6 text-primary" /> Performance Spectrum
                        </CardTitle>
                        <Badge variant="outline" className="border-white/20 text-white text-[10px] uppercase font-bold">Time-Series Intelligence</Badge>
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
                                <p className="text-xs text-muted-foreground font-medium">{stats.weeklyCount} Consultations verified</p>
                            </div>
                        </div>
                        <div className="p-8 space-y-4 bg-primary/5">
                            <div className="flex items-center gap-3 text-primary mb-2">
                                <Target className="h-5 w-5" />
                                <h3 className="text-xs font-bold uppercase tracking-widest">Monthly Reach</h3>
                            </div>
                            <div className="space-y-1">
                                <p className="text-4xl font-bold tracking-tighter text-primary">PKR {stats.monthlyRevenue.toLocaleString()}</p>
                                <p className="text-xs text-slate-500 font-medium">{stats.monthlyCount} Record sets indexed</p>
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
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">Capacity: 92%</span>
                            </div>
                        </div>
                        <Button variant="ghost" size="sm" className="text-[10px] font-bold uppercase" asChild>
                            <Link href="/admin/payments">Audit Settlements <ArrowRight className="ml-2 h-3 w-3" /></Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>

        <div className="xl:col-span-4">
            <Card className="border-none shadow-2xl bg-white rounded-3xl overflow-hidden h-full">
                <CardHeader className="bg-primary/5 border-b py-6 px-8">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-3 font-headline">
                            <Siren className="h-6 w-6 text-primary" /> Missed Alerts
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={handleDismissAll} className="h-8 text-[10px] font-bold uppercase text-muted-foreground hover:text-destructive p-0 px-2">
                                Clear All
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-8">
                    {activeMissedAudits && activeMissedAudits.length > 0 ? (
                        <div className="space-y-4">
                            {activeMissedAudits.slice(0, 3).map((log: any) => {
                                const doctor = doctors?.find(d => d.id === log.doctorId);
                                return (
                                    <div key={log.id} className="p-4 border-2 border-destructive/10 bg-destructive/5 rounded-2xl animate-in fade-in slide-in-from-right-4 duration-300">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center text-destructive shrink-0">
                                                    <User className="h-4 w-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-xs truncate">Dr. {doctor?.firstName} {doctor?.lastName}</p>
                                                    <p className="text-[9px] text-destructive font-bold uppercase tracking-tighter">{doctor?.specialty || 'Specialist'}</p>
                                                </div>
                                            </div>
                                            <Badge variant="destructive" className="h-4 text-[7px] font-bold uppercase px-1">Missed</Badge>
                                        </div>
                                        <p className="text-[10px] font-semibold flex items-center gap-2 text-slate-600">
                                            <AlertCircle className="h-3 w-3 text-destructive" />
                                            {format(new Date(log.scheduledTime), "MMM dd, p")}
                                        </p>
                                    </div>
                                );
                            })}
                            {activeMissedAudits.length > 3 && (
                                <Button variant="link" className="w-full text-xs font-bold" asChild>
                                    <Link href="/admin/missed-slots">View {activeMissedAudits.length - 3} more alerts</Link>
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-12 space-y-4">
                            <Activity className="h-10 w-10 mx-auto text-muted-foreground/20" />
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Surveillance Clear</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
          <Card className="border-none shadow-sm bg-white p-6 flex items-center gap-4 group cursor-pointer hover:bg-primary/5 transition-colors" asChild>
            <Link href="/admin/doctors">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                    <Stethoscope className="h-6 w-6" />
                </div>
                <div>
                    <h4 className="font-bold text-sm">Registry Audit</h4>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Manage Providers</p>
                </div>
            </Link>
          </Card>
          <Card className="border-none shadow-sm bg-white p-6 flex items-center gap-4 group cursor-pointer hover:bg-blue-50 transition-colors" asChild>
            <Link href="/admin/patients">
                <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all flex items-center justify-center">
                    <User className="h-6 w-6" />
                </div>
                <div>
                    <h4 className="font-bold text-sm">Patient Pool</h4>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Clinical Distribution</p>
                </div>
            </Link>
          </Card>
          <Card className="border-none shadow-sm bg-white p-6 flex items-center gap-4 group cursor-pointer hover:bg-slate-50 transition-colors" asChild>
            <Link href="/admin/missed-slots">
                <div className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-600 group-hover:bg-slate-900 group-hover:text-white transition-all flex items-center justify-center">
                    <History className="h-6 w-6" />
                </div>
                <div>
                    <h4 className="font-bold text-sm">Historical Audit</h4>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Full Archive View</p>
                </div>
            </Link>
          </Card>
      </div>
    </div>
  );
}
