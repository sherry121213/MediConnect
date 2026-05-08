
"use client"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { 
  Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, 
  AreaChart, Area, CartesianGrid, PieChart, Pie, Cell, Legend
} from "recharts";
import { 
  Stethoscope, DollarSign, Loader2, 
  TrendingUp, TrendingDown, Calendar, History, Activity, 
  Users as UsersIcon, Zap, Target, Globe, AlertCircle, ArrowRight, AlertTriangle, ShieldAlert
} from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, limit } from "firebase/firestore";
import type { Doctor, Appointment, Patient } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isSameDay, startOfDay, subDays, isAfter } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

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
    return query(collection(firestore, 'missedSessionAudits'), limit(5));
  }, [firestore]);
  const { data: missedAudits } = useCollection<any>(missedAuditQuery);
  
  const isLoading = isLoadingAppointments || isLoadingDoctors || isLoadingPatients || !mounted;

  const { stats, pendingPaymentCount, missedCount } = useMemo(() => {
    if (!appointments || !doctors || !patients) return {
        stats: { totalRevenue: 0, totalBookings: 0, verifiedDoctors: 0, totalPatients: 0, todayRevenue: 0, todayBookings: 0, weeklyRevenue: 0, specialtyData: [] },
        pendingPaymentCount: 0,
        missedCount: 0
    };

    const today = startOfDay(new Date());
    const sevenDaysAgo = subDays(today, 7);

    const approvedApts = appointments.filter(apt => apt && apt.paymentStatus === 'approved');
    const pendingApts = appointments.filter(apt => apt && apt.paymentStatus === 'pending' && apt.paymentReceiptUrl);
    const missedApts = appointments.filter(apt => apt && apt.status === 'expired').length;
    
    const todayApts = appointments.filter(apt => apt && apt.createdAt && isSameDay(new Date(apt.createdAt), today));
    const todayRev = todayApts.filter(a => a.paymentStatus === 'approved').reduce((sum, a) => sum + (a.amount || 1500), 0);
    
    const specialtyCounts: Record<string, number> = {};
    doctors.forEach(d => { if (d && d.specialty) specialtyCounts[d.specialty] = (specialtyCounts[d.specialty] || 0) + 1; });
    const specialtyData = Object.entries(specialtyCounts).map(([name, value]) => ({ name, value })).slice(0, 5);

    return {
        stats: {
            totalRevenue: approvedApts.reduce((sum, a) => sum + (a.amount || 1500), 0),
            totalBookings: appointments.length,
            verifiedDoctors: doctors.filter(d => d && d.verified).length,
            totalPatients: patients.length,
            todayRevenue: todayRev,
            todayBookings: todayApts.length,
            weeklyRevenue: 0,
            specialtyData
        },
        pendingPaymentCount: pendingApts.length,
        missedCount: missedApts
    };
  }, [appointments, doctors, patients]);

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
        <Card className="border-none shadow-sm"><CardContent className="p-6">
            <p className="text-[10px] font-bold uppercase text-muted-foreground">Today's Revenue</p>
            <p className="text-2xl font-bold">PKR {stats.todayRevenue.toLocaleString()}</p>
        </CardContent></Card>
        <Card className="border-none shadow-sm"><CardContent className="p-6">
            <p className="text-[10px] font-bold uppercase text-muted-foreground">Today's Bookings</p>
            <p className="text-2xl font-bold">{stats.todayBookings}</p>
        </CardContent></Card>
        <Card className="border-none shadow-sm"><CardContent className="p-6">
            <p className="text-[10px] font-bold uppercase text-muted-foreground">Verified Doctors</p>
            <p className="text-2xl font-bold">{stats.verifiedDoctors}</p>
        </CardContent></Card>
        <Card className="border-none shadow-sm"><CardContent className="p-6">
            <p className="text-[10px] font-bold uppercase text-muted-foreground">Clinical Missed Slots</p>
            <p className="text-2xl font-bold text-destructive">{missedCount}</p>
        </CardContent></Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-8">
            <Card className="border-none shadow-lg overflow-hidden bg-white">
                <CardHeader className="border-b bg-muted/5"><CardTitle className="text-lg">Recent Performance</CardTitle></CardHeader>
                <CardContent className="p-6 text-center py-24 text-muted-foreground italic">Analytics stream active. Monitor clinical trajectory from the side diagnostics.</CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-8">
                <Card className="border-none shadow-lg bg-primary text-primary-foreground">
                    <CardHeader><CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2"><Zap className="h-4 w-4" /> System Integrity</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-4 bg-white/10 rounded-xl border border-white/10 backdrop-blur-sm">
                            <p className="text-xs italic opacity-80 leading-relaxed">"Clinical window enforcement is active. Missed sessions are automatically archived to protect patient slots."</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
            {missedCount > 0 && (
                <Card className="border-none shadow-2xl bg-red-50 border-red-200">
                    <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-red-100 text-red-600 rounded-2xl shadow-inner"><ShieldAlert className="h-6 w-6" /></div>
                            <div className="space-y-3 flex-1">
                                <div>
                                    <h4 className="text-sm font-bold text-red-900 uppercase tracking-tight">Missed Session Audit</h4>
                                    <p className="text-xs text-red-800/70 font-medium leading-relaxed mt-1">There are {missedCount} clinical sessions that were never started by providers. Review protocols.</p>
                                </div>
                                <Button size="sm" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold" asChild><Link href="/admin/doctors">Audit Providers <ArrowRight className="ml-2 h-3 w-3" /></Link></Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card className="border-none shadow-2xl bg-white h-full flex flex-col">
                <CardHeader className="bg-slate-900 text-white rounded-t-xl"><CardTitle className="text-lg">Real-time Missed Logs</CardTitle></CardHeader>
                <CardContent className="p-6">
                    {missedAudits && missedAudits.length > 0 ? (
                        <div className="space-y-4">
                            {missedAudits.map((log: any) => (
                                <div key={log.id} className="p-3 rounded-xl bg-muted/30 border text-[10px] space-y-1">
                                    <p className="font-bold text-destructive flex items-center justify-between">
                                        SESSION MISSED <span className="opacity-50">{format(new Date(log.loggedAt), "p")}</span>
                                    </p>
                                    <p className="text-slate-600">ID: {log.appointmentId.slice(0, 8)}...</p>
                                    <p className="text-slate-600">Scheduled: {format(new Date(log.scheduledTime), "MMM dd, p")}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center py-12 text-xs text-muted-foreground italic">No missed session logs for this cycle.</p>
                    )}
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
