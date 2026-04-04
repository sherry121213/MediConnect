
"use client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { 
  Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, 
  AreaChart, Area, CartesianGrid 
} from "recharts";
import { BookOpen, Stethoscope, UserPlus, UserCheck, DollarSign, Loader2, TrendingUp, TrendingDown, Calendar } from "lucide-react";
import { useMemo } from "react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import type { Doctor, Appointment, Patient } from "@/lib/types";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isSameDay, startOfDay, subDays } from "date-fns";

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

  // Stat calculations
  const totalRevenue = useMemo(() => {
    if (!appointments) return 0;
    return appointments
      .filter(apt => apt.paymentStatus === 'approved')
      .reduce((sum, apt) => sum + (apt.amount || 1500), 0);
  }, [appointments]);

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

  const totalBookings = appointments?.length || 0;
  
  const verifiedDoctorsCount = useMemo(() => {
    if (!doctors) return 0;
    return doctors.filter(d => d.verified).length;
  }, [doctors]);
  
  const totalPatients = patients?.length || 0;

  // Daily Stats for the last 7 days
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

  const monthlyBookings = useMemo(() => {
    if (!appointments) {
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return monthNames.map(name => ({ name, total: 0 }));
    };
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const bookingsByMonth: { [key: number]: number } = {};

    appointments.forEach(apt => {
        if (apt.createdAt) {
            const monthIndex = new Date(apt.createdAt).getMonth();
            bookingsByMonth[monthIndex] = (bookingsByMonth[monthIndex] || 0) + 1;
        }
    });

    return monthNames.map((name, index) => ({ name, total: bookingsByMonth[index] || 0 }));
  }, [appointments]);

  const topSpecialties = useMemo(() => {
    if (!appointments || !doctors) return [];
    
    const specialtyCounts: { [key: string]: number } = {};

    appointments.forEach(apt => {
        const doctor = doctors.find(d => d.id === apt.doctorId);
        if (doctor && doctor.specialty) {
            specialtyCounts[doctor.specialty] = (specialtyCounts[doctor.specialty] || 0) + 1;
        }
    });

    return Object.entries(specialtyCounts)
        .map(([specialty, bookings]) => ({ specialty, bookings }))
        .sort((a, b) => b.bookings - a.bookings)
        .slice(0, 5);
  }, [appointments, doctors]);

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
            <p className="text-muted-foreground">Overview of platform performance and daily profits.</p>
        </div>
        <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-md border text-sm font-medium">
            <Calendar className="h-4 w-4 text-primary" />
            {format(new Date(), "EEEE, MMMM do")}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
            title="Total Revenue" 
            value={`PKR ${totalRevenue.toLocaleString()}`}
            icon={DollarSign}
            isLoading={isLoading}
            description={`PKR ${todayRevenue.toLocaleString()} today`}
            trend={todayRevenue > 0 ? 'up' : undefined}
        />
         <StatCard 
            title="Total Bookings" 
            value={totalBookings}
            icon={BookOpen}
            isLoading={isLoading}
            description={`${todayBookings} new today`}
            trend={todayBookings > 0 ? 'up' : undefined}
        />
        <StatCard 
            title="Verified Doctors" 
            value={verifiedDoctorsCount}
            icon={Stethoscope}
            isLoading={isLoading}
            description="Active professionals"
        />
        <StatCard 
            title="Total Patients" 
            value={totalPatients}
            icon={UserPlus}
            isLoading={isLoading}
            description="Registered users"
        />
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Daily Profit & Revenue Summary</CardTitle>
            <p className="text-sm text-muted-foreground">Detailed revenue trends for the past 7 days.</p>
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
            <p className="text-sm text-muted-foreground">Appointment count day-wise.</p>
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

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Annual Booking Overview</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            {isLoading ? (
                <div className="w-full h-[350px] flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={monthlyBookings}>
                    <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                    <Tooltip cursor={{fill: 'hsl(var(--secondary))'}} contentStyle={{backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}/>
                    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        
        <Card className="col-span-4 lg:col-span-3">
          <CardHeader>
            <CardTitle>Top Specialties</CardTitle>
            <p className="text-sm text-muted-foreground">Most booked specialties this month.</p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
                <div className="space-y-4">
                    {Array.from({length: 5}).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
                </div>
            ) : (
                <div className="space-y-4">
                  {topSpecialties.length > 0 ? topSpecialties.map((spec) => (
                    <div key={spec.specialty} className="flex items-center">
                      <span className="text-sm">{spec.specialty}</span>
                      <span className="ml-auto font-medium text-sm">{spec.bookings} bookings</span>
                    </div>
                  )) : <p className="text-sm text-muted-foreground text-center py-4">No booking data available.</p>}
                </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
