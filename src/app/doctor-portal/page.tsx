import AppHeader from "@/components/layout/header";
import AppFooter from "@/components/layout/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Video, MessageSquare } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const upcomingAppointments = [
    { id: 1, patient: "Ali Khan", date: "2024-08-15", time: "10:00 AM", type: "Video Call", status: "Upcoming", patientImage: "https://picsum.photos/seed/p1/100/100" },
    { id: 2, patient: "Sana Ahmed", date: "2024-08-15", time: "11:30 AM", type: "Chat", status: "Upcoming", patientImage: "https://picsum.photos/seed/p2/100/100" },
]

const recentAppointments = [
    { id: 3, patient: "Zoya Farooq", date: "2024-07-20", time: "02:30 PM", type: "Chat", status: "Completed", patientImage: "https://picsum.photos/seed/p3/100/100" },
    { id: 4, patient: "Usman Sharif", date: "2024-06-10", time: "11:00 AM", type: "Video Call", status: "Completed", patientImage: "https://picsum.photos/seed/p4/100/100" },
]

export default function DoctorPortalPage() {
    const getIcon = (type: string) => {
        if (type === 'Video Call') return <Video className="w-5 h-5" />;
        return <MessageSquare className="w-5 h-5" />;
    }

    const AppointmentCard = ({ apt }: { apt: any }) => (
        <Card className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
            <CardHeader className="flex flex-row items-center gap-4 md:col-span-2">
                <Avatar className="h-12 w-12">
                    <AvatarImage src={apt.patientImage} alt={apt.patient} />
                    <AvatarFallback>{apt.patient.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                    <CardTitle>{apt.patient}</CardTitle>
                </div>
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
                {apt.status === "Completed" && <Button variant="outline" asChild><Link href="#">View Notes</Link></Button>}
            </div>
        </Card>
    );

    return (
        <div className="flex flex-col min-h-screen">
            <AppHeader />
            <main className="flex-grow bg-secondary/30 py-12">
                <div className="container mx-auto px-4">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold font-headline">Doctor Portal</h1>
                        <p className="text-muted-foreground">Welcome back, Dr. Ahmed!</p>
                    </div>

                    <div className="space-y-8">
                        <div>
                            <h2 className="text-2xl font-bold font-headline mb-4">Upcoming Appointments</h2>
                            <div className="space-y-4">
                                {upcomingAppointments.map(apt => <AppointmentCard key={apt.id} apt={apt} />)}
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold font-headline mb-4">Recent Activity</h2>
                            <div className="space-y-4">
                                {recentAppointments.map(apt => <AppointmentCard key={apt.id} apt={apt} />)}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            <AppFooter />
        </div>
    )
}
