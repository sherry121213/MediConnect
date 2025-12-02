"use client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { DollarSign, BookOpen, Stethoscope, UserPlus } from "lucide-react";
import { useUser } from "@/firebase";
import { useEffect, useState } from "react";

const monthlyBookings = [
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
  const { user } = useUser();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      if (user) {
        try {
          const idTokenResult = await user.getIdTokenResult();
          setIsAdmin(!!idTokenResult.claims.admin);
        } catch (error) {
          console.error("Error checking admin status:", error);
          setIsAdmin(false);
        }
      }
    };
    checkAdmin();
  }, [user]);

  return (
    <div className="p-4 md:p-8 space-y-8">
      <h1 className="text-3xl font-bold font-headline">Admin Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isAdmin && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$45,231.89</div>
                <p className="text-xs text-muted-foreground">+20.1% from last month</p>
              </CardContent>
            </Card>
        )}
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
    </div>
  );
}
