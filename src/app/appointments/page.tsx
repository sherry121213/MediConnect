import AppHeader from "@/components/layout/header";
import AppFooter from "@/components/layout/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Video, MessageSquare } from "lucide-react";
import Link from "next/link";

const appointments = [
    { id: 1, doctor: "Dr. Amina Khan", specialty: "Cardiology", date: "2024-08-15", time: "10:00 AM", type: "Video Call", status: "Upcoming" },
    { id: 2, doctor: "Dr. Bilal Ahmed", specialty: "Dermatology", date: "2024-07-20", time: "02:30 PM", type: "Chat", status: "Completed" },
    { id: 3, doctor: "Dr. Hassan Raza", specialty: "General Physician", date: "2024-06-10", time: "11:00 AM", type: "Video Call", status: "Completed" },
]

export default function AppointmentsPage() {
    const getIcon = (type: string) => {
        if (type === 'Video Call') return <Video className="w-5 h-5" />;
        return <MessageSquare className="w-5 h-5" />;
    }

    return (
        <div className="flex flex-col min-h-screen">
          <AppHeader />
          <main className="flex-grow bg-secondary/30 py-12">
            <div className="container mx-auto px-4">
                <h1 className="text-3xl font-bold font-headline mb-8">My Appointments</h1>
                <div className="space-y-6">
                    {appointments.map(apt => (
                        <Card key={apt.id} className="grid grid-cols-1 md:grid-cols-4 items-center">
                            <CardHeader className="md:col-span-2">
                                <CardTitle>{apt.doctor}</CardTitle>
                                <CardDescription>{apt.specialty}</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6 pt-0 md:pt-6">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Calendar className="w-4 h-4" />
                                    <span>{apt.date} at {apt.time}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                    {getIcon(apt.type)}
                                    <span>{apt.type}</span>
                                </div>
                            </CardContent>
                             <div className="p-6 pt-0 md:pt-6 text-right">
                                {apt.status === "Upcoming" && <Button asChild><Link href="#">Join Call</Link></Button>}
                                {apt.status === "Completed" && <Button variant="outline" asChild><Link href="#">View Details</Link></Button>}
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
          </main>
          <AppFooter />
        </div>
    )
}
