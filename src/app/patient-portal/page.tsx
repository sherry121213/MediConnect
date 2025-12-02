import AppHeader from "@/components/layout/header";
import AppFooter from "@/components/layout/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Video, MessageSquare, PlusCircle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { PlaceHolderImages } from "@/lib/placeholder-images";


const appointments = [
    { id: 1, doctor: "Dr. Amina Khan", specialty: "Cardiology", date: "2024-08-15", time: "10:00 AM", type: "Video Call", status: "Upcoming", imageId: "doctor1" },
    { id: 2, doctor: "Dr. Bilal Ahmed", specialty: "Dermatology", date: "2024-07-20", time: "02:30 PM", type: "Chat", status: "Completed", imageId: "doctor2" },
]

export default function PatientPortalPage() {
    const getIcon = (type: string) => {
        if (type === 'Video Call') return <Video className="w-5 h-5 text-muted-foreground" />;
        return <MessageSquare className="w-5 h-5 text-muted-foreground" />;
    }

    const AppointmentCard = ({ apt }: { apt: any }) => {
        const doctorImage = PlaceHolderImages.find(p => p.id === apt.imageId);
        return (
            <Card className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
                <CardHeader className="flex flex-row items-center gap-4 md:col-span-2">
                    {doctorImage && (
                        <Image
                            src={doctorImage.imageUrl}
                            alt={apt.doctor}
                            width={56}
                            height={56}
                            className="rounded-full"
                            data-ai-hint={doctorImage.imageHint}
                        />
                    )}
                    <div>
                        <CardTitle>{apt.doctor}</CardTitle>
                        <CardDescription>{apt.specialty}</CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="p-6 pt-0 md:pt-6">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>{apt.date} at {apt.time}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm mt-1">
                        {getIcon(apt.type)}
                        <span>{apt.type}</span>
                    </div>
                </CardContent>
                <div className="p-6 pt-0 md:pt-6 text-right">
                    {apt.status === "Upcoming" && <Button asChild><Link href="#">Join Call</Link></Button>}
                    {apt.status === "Completed" && <Button variant="outline" asChild><Link href="#">View Details</Link></Button>}
                </div>
            </Card>
        )
    };


    return (
        <div className="flex flex-col min-h-screen">
          <AppHeader />
          <main className="flex-grow bg-secondary/30 py-12">
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold font-headline">Patient Portal</h1>
                        <p className="text-muted-foreground">Welcome back, Ali!</p>
                    </div>
                    <Button asChild>
                        <Link href="/find-a-doctor">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Book New Appointment
                        </Link>
                    </Button>
                </div>
                
                <div className="space-y-6">
                    {appointments.length > 0 ? (
                        appointments.map(apt => <AppointmentCard key={apt.id} apt={apt} />)
                    ) : (
                        <Card className="text-center py-16">
                            <CardContent>
                                <h3 className="text-xl font-medium">No Appointments Yet</h3>
                                <p className="text-muted-foreground mt-2 mb-6">It looks like you haven't booked any appointments.</p>
                                <Button asChild>
                                    <Link href="/find-a-doctor">Find a Doctor</Link>
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
          </main>
          <AppFooter />
        </div>
    )
}
