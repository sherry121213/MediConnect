
"use client"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { 
  Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, 
  AreaChart, Area, CartesianGrid, PieChart, Pie, Cell, Legend
} from "recharts";
import { 
  BookOpen, Stethoscope, UserPlus, DollarSign, Loader2, 
  TrendingUp, TrendingDown, Calendar, History, Activity, 
  Wallet, Users as UsersIcon, Zap, Target, Globe
} from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import type { Doctor, Appointment, Patient } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isSameDay, startOfDay, subDays, isAfter, isBefore } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AdminDashboardPage() {
  const firestore = useFirestore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
      setMounted(true);
  }, []);

  // Data fetching
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
  
  const isLoading = isLoadingAppointments || isLoadingDoctors || isLoadingPatients || !mounted;

  // Stats Logic
  const stats = useMemo(() => {
    if (!appointments || !doctors || !patients) return {
        totalRevenue: 0,
        totalBookings: 0,
        verifiedDoctors: 0,
        totalPatients: 0,
        todayRevenue: 0,
        todayBookings: 0,
        weeklyRevenue: 0,
        specialtyData: []
    };

    const today = startOfDay(new Date());
    const sevenDaysAgo = subDays(today, 7);

    const approvedApts = appointments.filter(apt => apt.paymentStatus === 'approved');
    
    const todayApts = appointments.filter(apt => apt.createdAt && isSameDay(new Date(apt.createdAt), today));
    const todayRev = todayApts.filter(a => a.paymentStatus === 'approved').reduce((sum, a) => sum + (a.amount || 1500), 0);
    
    const weeklyApts = appointments.filter(apt => apt.createdAt && isAfter(new Date(apt.createdAt), sevenDaysAgo));
    const weeklyRev = weeklyApts.filter(a => a.paymentStatus === 'approved').reduce((sum, a) => sum + (a.amount || 1500), 0);

    // Specialty Breakdown
    const specialtyCounts: Record<string, number> = {};
    doctors.forEach(d => {
        if (d.specialty) {
            specialtyCounts[d.specialty] = (specialtyCounts[d.specialty] || 0) + 1;
        }
    });
    const specialtyData = Object.entries(specialtyCounts).map(([name, value]) => ({ name, value })).slice(0, 5);

    return {
        totalRevenue: approvedApts.reduce((sum, a) => sum + (a.amount || 1500), 0),
        totalBookings: appointments.length,
        verifiedDoctors: doctors.filter(d => d.verified).length,
        totalPatients: patients.length,
        todayRevenue: todayRev,
        todayBookings: todayApts.length,
        weeklyRevenue: weeklyRev,
        specialtyData
    };
  }, [appointments, doctors, patients]);

  const chartData = useMemo(() => {
    if (!appointments) return [];
    const stats: Record<string, { date: string, revenue: number, bookings: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const key = format(d, 'yyyy-MM-dd');
      stats[key] = { date: format(d, 'MMM dd'), revenue: 0, bookings: 0 };
    }
    appointments.forEach(apt => {
      if (!apt.createdAt) return;
      const key = apt.createdAt.split('T')[0];
      if (stats[key]) {
        stats[key].bookings += 1;
        if (apt.paymentStatus === 'approved') stats[key].revenue += (apt.amount || 1500);
      }
    });
    return Object.values(stats);
  }, [appointments]);

  const StatCard = ({ title, value, icon: Icon, isLoading, description, trend }: { title: string, value: string | number, icon: React.ElementType, isLoading: boolean, description?: string, trend?: 'up' | 'down' }) => (
      <Card className="border-none shadow-sm hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{title}</CardTitle>
              <div className="p-2 bg-primary/5 rounded-lg">
                <Icon className="h-4 w-4 text-primary" />
              </div>
          </CardHeader>
          <CardContent>
              {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-7 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
              ) : (
                  <>
                    <div className="text-2xl font-bold tracking-tight">{value}</div>
                    <div className="flex items-center gap-1 mt-1">
                        {trend === 'up' && <TrendingUp className="h-3 w-3 text-green-500" />}
                        {trend === 'down' && <TrendingDown className="h-3 w-3 text-destructive" />}
                        {description && <p className="text-[10px] font-medium text-muted-foreground">{description}</p>}
                    </div>
                  </>
              )}
          </CardContent>
      </Card>
  );

  return (
    <div className="p-4 md:p-8 space-y-8 bg-slate-50/50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Clinical Command Center</h1>
            <p className="text-muted-foreground text-sm flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" /> Operations overview for Mediconnect Digital Health.
            </p>
        </div>
        <div className="flex items-center gap-3">
            <Dialog>
                <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2 shadow-sm border-slate-200">
                        <History className="h-4 w-4" />
                        Audit History
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-headline flex items-center gap-2">
                            <Activity className="h-6 w-6 text-primary" />
                            Lifetime Platform Summary
                        </DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-6">
                        <div className="p-4 bg-muted/30 rounded-xl border text-center space-y-1">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Revenue</p>
                            <p className="text-2xl font-bold">PKR {stats.totalRevenue.toLocaleString()}</p>
                        </div>
                        <div className="p-4 bg-muted/30 rounded-xl border text-center space-y-1">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Bookings</p>
                            <p className="text-2xl font-bold">{stats.totalBookings}</p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border shadow-sm text-xs font-bold text-slate-600">
                <Calendar className="h-4 w-4 text-primary" />
                {format(new Date(), "EEEE, MMM do")}
            </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
            title="Today's Revenue" 
            value={`PKR ${stats.todayRevenue.toLocaleString()}`}
            icon={DollarSign}
            isLoading={isLoading}
            description="Verified consults"
            trend={stats.todayRevenue > 0 ? 'up' : undefined}
        />
         <StatCard 
            title="Today's Bookings" 
            value={stats.todayBookings}
            icon={Activity}
            isLoading={isLoading}
            description="Scheduled sessions"
            trend={stats.todayBookings > 0 ? 'up' : undefined}
        />
        <StatCard 
            title="Verified Doctors" 
            value={stats.verifiedDoctors}
            icon={Stethoscope}
            isLoading={isLoading}
            description="Active professionals"
        />
        <StatCard 
            title="Total Patients" 
            value={stats.totalPatients}
            icon={UsersIcon}
            isLoading={isLoading}
            description="Registered identities"
        />
      </div>

      {/* Main Grid: Charts & Unique Intelligence Report */}
      <div className="grid gap-8 lg:grid-cols-12">
        
        {/* Left Side: Performance Visuals */}
        <div className="lg:col-span-8 space-y-8">
            <Card className="border-none shadow-lg overflow-hidden">
                <CardHeader className="bg-white border-b pb-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg">Revenue Trajectory</CardTitle>
                            <CardDescription className="text-xs">Consolidated daily profits for the current week.</CardDescription>
                        </div>
                        <Badge variant="secondary" className="bg-primary/5 text-primary text-[10px] font-bold">7-DAY AUDIT</Badge>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    {isLoading ? (
                        <div className="w-full h-[350px] flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={350}>
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15}/>
                                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                                <Tooltip cursor={{stroke: 'hsl(var(--primary))', strokeWidth: 1}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}/>
                                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-8">
                <Card className="border-none shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-sm">Volume Comparison</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Skeleton className="h-[250px] w-full" />
                        ) : (
                            <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={chartData}>
                                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                                    <Tooltip contentStyle={{borderRadius: '12px', border: 'none'}}/>
                                    <Bar dataKey="bookings" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-none shadow-lg bg-primary text-primary-foreground">
                    <CardHeader>
                        <CardTitle className="text-sm opacity-90 uppercase tracking-widest flex items-center gap-2">
                            <Zap className="h-4 w-4" /> System Health
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs font-bold">
                                <span>Platform Load</span>
                                <span>{isLoading ? '...' : Math.min(stats.todayBookings * 10, 100)}%</span>
                            </div>
                            <div className="h-2 w-full bg-white/20 rounded-full overflow-hidden">
                                <div className="h-full bg-white transition-all" style={{ width: `${isLoading ? 0 : Math.min(stats.todayBookings * 10, 100)}%` }} />
                            </div>
                        </div>
                        <div className="p-4 bg-white/10 rounded-xl border border-white/10 backdrop-blur-sm">
                            <p className="text-xs italic opacity-80 leading-relaxed">
                                "Platform performance is stable. Daily clinical intake is within optimal parameters for verified doctor bandwidth."
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>

        {/* Right Side: Weekly Intelligence Report (Unique) */}
        <div className="lg:col-span-4 space-y-8">
            <Card className="border-none shadow-2xl bg-white h-full flex flex-col">
                <CardHeader className="bg-slate-900 text-white rounded-t-xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/10 rounded-lg">
                            <Target className="h-5 w-5 text-accent" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">Weekly Digest</CardTitle>
                            <CardDescription className="text-slate-400 text-xs">Clinical intelligence summary</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                
                <CardContent className="flex-1 p-6 space-y-10">
                    {/* Specialty Distribution Chart */}
                    <div className="space-y-4">
                        <h4 className="text-[10px] uppercase font-bold text-muted-foreground tracking-[0.2em] text-center">Professional Composition</h4>
                        {isLoading ? (
                            <div className="h-[220px] flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                        ) : (
                            <ResponsiveContainer width="100%" height={220}>
                                <PieChart>
                                    <Pie
                                        data={stats.specialtyData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {stats.specialtyData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    <div className="space-y-4 pt-6 border-t border-dashed">
                        <h4 className="text-[10px] uppercase font-bold text-muted-foreground tracking-[0.2em]">Weekly Velocity</h4>
                        <div className="grid grid-cols-1 gap-3">
                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Revenue Momentum</p>
                                    <p className="text-lg font-bold">PKR {stats.weeklyRevenue.toLocaleString()}</p>
                                </div>
                                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">+12%</Badge>
                            </div>
                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Active Case Load</p>
                                    <p className="text-lg font-bold">{Math.round(stats.totalBookings / 30)} Avg/Day</p>
                                </div>
                                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none">Stable</Badge>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex gap-4 items-start">
                        <div className="p-2 bg-amber-200/50 rounded-full text-amber-700">
                            <Target className="h-4 w-4" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs font-bold text-amber-900">Optimization Goal</p>
                            <p className="text-[10px] text-amber-800/80 leading-relaxed">
                                Current verified doctor to patient ratio is 1:{isLoading ? '...' : Math.round(stats.totalPatients / (stats.verifiedDoctors || 1))}. Target optimal ratio is 1:25.
                            </p>
                        </div>
                    </div>
                </CardContent>

                <div className="p-4 bg-slate-50 border-t mt-auto text-center">
                    <Button variant="link" className="text-xs font-bold text-primary p-0 h-auto" asChild>
                        <a href="/admin/doctors">Expand Professional Directory <ChevronRight className="h-3 w-3 ml-1" /></a>
                    </Button>
                </div>
            </Card>
        </div>
      </div>
    </div>
  );
}

function ChevronRight(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}
