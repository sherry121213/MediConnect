"use client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { BookOpen, Stethoscope, UserPlus, UserCheck, DollarSign, Loader2 } from "lucide-react";
import { useMemo } from "react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import type { Doctor, Appointment, Patient } from "@/lib/types";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

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
  
  const pendingDoctorsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'doctors'), where('verified', '==', false));
  }, [firestore]);
  const { data: pendingDoctors, isLoading: isLoadingPending } = useCollection<Doctor>(pendingDoctorsQuery);
  
  const isLoading = isLoadingAppointments || isLoadingDoctors || isLoadingPatients;

  // Stat calculations
  const totalRevenue = useMemo(() => {
    if (!appointments) return 0;
    return appointments.reduce((sum, apt) => sum + (apt.amount || 1500), 0);
  }, [appointments]);

  const totalBookings = appointments?.length || 0;
  
  const verifiedDoctorsCount = useMemo(() => {
    if (!doctors) return 0;
    return doctors.filter(d => d.verified).length;
  }, [doctors]);
  
  const totalPatients = patients?.length || 0;

  // Chart data calculations
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

  const StatCard = ({ title, value, icon: Icon, isLoading, description }: { title: string, value: string | number, icon: React.ElementType, isLoading: boolean, description?: string }) => (
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
                    {description && <p className="text-xs text-muted-foreground">{description}</p>}
                  </>
              )}
          </CardContent>
      </Card>
  );

  return (
    <div className="p-4 md:p-8 space-y-8">
      <h1 className="text-3xl font-bold font-headline">Admin Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
            title="Total Revenue" 
            value={`PKR ${totalRevenue.toLocaleString()}`}
            icon={DollarSign}
            isLoading={isLoading}
        />
         <StatCard 
            title="Total Bookings" 
            value={totalBookings}
            icon={BookOpen}
            isLoading={isLoading}
        />
        <StatCard 
            title="Verified Doctors" 
            value={verifiedDoctorsCount}
            icon={Stethoscope}
            isLoading={isLoading}
        />
        <StatCard 
            title="Total Patients" 
            value={totalPatients}
            icon={UserPlus}
            isLoading={isLoading}
        />
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Booking Overview</CardTitle>
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
                      <span>{spec.specialty}</span>
                      <span className="ml-auto font-medium">{spec.bookings} bookings</span>
                    </div>
                  )) : <p className="text-sm text-muted-foreground text-center py-4">No booking data available.</p>}
                </div>
            )}
          </CardContent>
        </Card>
      </div>

       <Card>
        <CardHeader>
            <CardTitle>Pending Doctor Verifications</CardTitle>
            <p className="text-sm text-muted-foreground">Review and approve new doctor profiles to allow them portal access.</p>
        </CardHeader>
        <CardContent>
            {isLoadingPending && (
                <div className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            )}
            {!isLoadingPending && pendingDoctors && pendingDoctors.length > 0 ? (
                <div className="space-y-4">
                    {pendingDoctors.map(doctor => (
                        <div key={doctor.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-md border gap-3">
                            <div>
                                <p className="font-medium">{doctor.firstName} {doctor.lastName}</p>
                                <p className="text-sm text-muted-foreground">{doctor.email}</p>
                            </div>
                            <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
                                <Link href={`/admin/doctors/${doctor.id}`}>
                                    <UserCheck className="mr-2 h-4 w-4" />
                                    Review Profile
                                </Link>
                            </Button>
                        </div>
                    ))}
                </div>
            ) : !isLoadingPending && (
                <p className="text-sm text-muted-foreground text-center py-8">No pending verifications.</p>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
