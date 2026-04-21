"use client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { 
  Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, 
  AreaChart, Area, CartesianGrid 
} from "recharts";
import { 
  BookOpen, Stethoscope, UserPlus, DollarSign, Loader2, 
  TrendingUp, TrendingDown, Calendar, History, Activity, 
  Wallet, Users as UsersIcon
} from "lucide-react";
import { useMemo, useState } from "react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import type { Doctor, Appointment, Patient } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isSameDay, startOfDay, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function AdminDashboardPage() {
  const firestore = useFirestore();

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
  
  const isLoading = isLoadingAppointments || isLoadingDoctors || isLoadingPatients;

  // Lifetime Stats
  const totalLifetimeRevenue = useMemo(() => {
    if (!appointments) return 0;
    return appointments
      .filter(apt => apt.paymentStatus === 'approved')
      .reduce((sum, apt) => sum + (apt.amount || 1500), 0);
  }, [appointments]);

  const totalLifetimeBookings = appointments?.length || 0;
  
  const verifiedDoctorsCount = useMemo(() => {
    if (!doctors) return 0;
    return doctors.filter(d => d.verified).length;
  }, [doctors]);
  
  const totalPatientsCount = patients?.length || 0;

  // Daily Stats (Today)
  const todayRevenue = useMemo(() => {
    if (!appointments) return 0;
    const today = startOfDay(new Date());
    return appointments
      .filter(apt => apt.paymentStatus === 'approved' && apt.createdAt && isSameDay(new Date(apt.createdAt), today))
      .reduce((sum, apt) => sum + (apt.amount || 1500), 0);
  }, [appointments]);

  const todayBookings = useMemo(() => {
    if (!appointments) return 0;
    const today = startOfDay(new Date());
    return appointments.filter(apt => apt.createdAt && isSameDay(new Date(apt.createdAt), today)).length;
  }, [appointments]);

  // Daily Stats for the last 7 days (Charts)
  const dailyStats = useMemo(() => {
    if (!appointments) return [];
    
    const stats: Record<string, { date: string, revenue: number, bookings: number }> = {};
    
    // Pre-populate last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const key = format(d, 'yyyy-MM-dd');
      stats[key] = {
        date: format(d, 'MMM dd'),
        revenue: 0,
        bookings: 0
      };
    }

    appointments.forEach(apt => {
      if (!apt.createdAt) return;
      const key = apt.createdAt.split('T')[0];
      if (stats[key]) {
        stats[key].bookings += 1;
        if (apt.paymentStatus === 'approved') {
          stats[key].revenue += (apt.amount || 1500);
        }
      }
    });

    return Object.values(stats);
  }, [appointments]);

  const StatCard = ({ title, value, icon: Icon, isLoading, description, trend }: { title: string, value: string | number, icon: React.ElementType, isLoading: boolean, description?: string, trend?: 'up' | 'down' }) => (
      <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
              {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
          </CardHeader>
          <CardContent>
              {isLoading ? (
                  <>
                    <Skeleton className="h-7 w-24" />
                    {description && <Skeleton className="h-3 w-32 mt-1" />}
                  </>
              ) : (
                  <>
                    <div className="text-2xl font-bold">{value}</div>
                    <div className="flex items-center gap-1 mt-1">
                        {trend === 'up' && <TrendingUp className="h-3 w-3 text-green-500" />}
                        {trend === 'down' && <TrendingDown className="h-3 w-3 text-destructive" />}
                        {description && <p className="text-xs text-muted-foreground">{description}</p>}
                    </div>
                  </>
              )}
          </CardContent>
      </Card>
  );

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-bold font-headline">Admin Dashboard</h1>
            <p className="text-muted-foreground">Daily performance summary and operation metrics.</p>
        </div>
        <div className="flex items-center gap-3">
            <Dialog>
                <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2">
                        <History className="h-4 w-4" />
                        Platform History
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-headline flex items-center gap-2">
                            <Activity className="h-6 w-6 text-primary" />
                            Lifetime Platform Summary
                        </DialogTitle>
                        <DialogDescription>
                            Aggregated metrics since the platform's inception.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-6">
                        <div className="p-4 bg-muted/30 rounded-lg border text-center space-y-1">
                            <Wallet className="h-5 w-5 text-primary mx-auto mb-2" />
                            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total Revenue</p>
                            <p className="text-2xl font-bold">PKR {totalLifetimeRevenue.toLocaleString()}</p>
                        </div>
                        <div className="p-4 bg-muted/30 rounded-lg border text-center space-y-1">
                            <BookOpen className="h-5 w-5 text-primary mx-auto mb-2" />
                            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total Bookings</p>
                            <p className="text-2xl font-bold">{totalLifetimeBookings}</p>
                        </div>
                        <div className="p-4 bg-muted/30 rounded-lg border text-center space-y-1">
                            <UsersIcon className="h-5 w-5 text-primary mx-auto mb-2" />
                            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total Patients</p>
                            <p className="text-2xl font-bold">{totalPatientsCount}</p>
                        </div>
                        <div className="p-4 bg-muted/30 rounded-lg border text-center space-y-1">
                            <Stethoscope className="h-5 w-5 text-primary mx-auto mb-2" />
                            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Verified Doctors</p>
                            <p className="text-2xl font-bold">{verifiedDoctorsCount}</p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
            <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-md border text-sm font-medium">
                <Calendar className="h-4 w-4 text-primary" />
                {format(new Date(), "EEEE, MMMM do")}
            </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <StatCard 
            title="Today's Revenue" 
            value={`PKR ${todayRevenue.toLocaleString()}`}
            icon={DollarSign}
            isLoading={isLoading}
            description="Approved payments today"
            trend={todayRevenue > 0 ? 'up' : undefined}
        />
         <StatCard 
            title="Today's Bookings" 
            value={todayBookings}
            icon={Activity}
            isLoading={isLoading}
            description="Total appointments scheduled today"
            trend={todayBookings > 0 ? 'up' : undefined}
        />
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Revenue Trends</CardTitle>
            <p className="text-sm text-muted-foreground">Daily profits over the past 7 days.</p>
          </CardHeader>
          <CardContent className="pl-2">
            {isLoading ? (
                <div className="w-full h-[350px] flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={dailyStats}>
                    <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                    <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                    <Tooltip cursor={{fill: 'hsl(var(--secondary))'}} contentStyle={{backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}/>
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorRevenue)" />
                  </AreaChart>
                </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-4 lg:col-span-3">
          <CardHeader>
            <CardTitle>Daily Bookings</CardTitle>
            <p className="text-sm text-muted-foreground">Volume comparison for the week.</p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
                <div className="space-y-4">
                    {Array.from({length: 5}).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={dailyStats}>
                        <XAxis dataKey="date" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}/>
                        <Bar dataKey="bookings" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
