"use client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { BookOpen, Stethoscope, UserPlus, UserCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import type { Doctor } from "@/lib/types";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";


const generateMonthlyBookings = () => [
  { name: "Jan", total: Math.floor(Math.random() * 200) + 50 },
  { name: "Feb", total: Math.floor(Math.random() * 200) + 50 },
  { name: "Mar", total: Math.floor(Math.random() * 200) + 50 },
  { name: "Apr", total: Math.floor(Math.random() * 200) + 50 },
  { name: "May", total: Math.floor(Math.random() * 200) + 50 },
  { name: "Jun", total: Math.floor(Math.random() * 200) + 50 },
  { name: "Jul", total: Math.floor(Math.random() * 200) + 50 },
  { name: "Aug", total: Math.floor(Math.random() * 200) + 50 },
  { name: "Sep", total: Math.floor(Math.random() * 200) + 50 },
  { name: "Oct", total: Math.floor(Math.random() * 200) + 50 },
  { name: "Nov", total: Math.floor(Math.random() * 200) + 50 },
  { name: "Dec", total: Math.floor(Math.random() * 200) + 50 },
];

const topSpecialties = [
    { specialty: "General Physician", bookings: 450 },
    { specialty: "Dermatology", bookings: 320 },
    { specialty: "Cardiology", bookings: 280 },
    { specialty: "Pediatrics", bookings: 210 },
    { specialty: "Neurology", bookings: 150 },
]

export default function AdminDashboardPage() {
  const [monthlyBookings, setMonthlyBookings] = useState<any[]>([]);
  const firestore = useFirestore();

  const pendingDoctorsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'doctors'), where('verified', '==', false));
  }, [firestore]);

  const { data: pendingDoctors, isLoading: isLoadingPending } = useCollection<Doctor>(pendingDoctorsQuery);

  useEffect(() => {
    setMonthlyBookings(generateMonthlyBookings());
  }, []);

  return (
    <div className="p-4 md:p-8 space-y-8">
      <h1 className="text-3xl font-bold font-headline">Admin Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <span className="text-muted-foreground font-bold">PKR</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12,545,231</div>
            <p className="text-xs text-muted-foreground">+20.1% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+2350</div>
            <p className="text-xs text-muted-foreground">+180.1% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verified Doctors</CardTitle>
            <Stethoscope className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">128</div>
            <p className="text-xs text-muted-foreground">+12 since last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Patients</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+573</div>
            <p className="text-xs text-muted-foreground">+201 since last month</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Booking Overview</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={monthlyBookings}>
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                <Tooltip cursor={{fill: 'hsl(var(--secondary))'}} contentStyle={{backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}/>
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="col-span-4 lg:col-span-3">
          <CardHeader>
            <CardTitle>Top Specialties</CardTitle>
            <p className="text-sm text-muted-foreground">Most booked specialties this month.</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topSpecialties.map((spec) => (
                <div key={spec.specialty} className="flex items-center">
                  <span>{spec.specialty}</span>
                  <span className="ml-auto font-medium">{spec.bookings} bookings</span>
                </div>
              ))}
            </div>
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
                        <div key={doctor.id} className="flex items-center justify-between p-2 rounded-md border">
                            <div>
                                <p className="font-medium">{doctor.firstName} {doctor.lastName}</p>
                                <p className="text-sm text-muted-foreground">{doctor.email}</p>
                            </div>
                            <Button asChild variant="outline" size="sm">
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
