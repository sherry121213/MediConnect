'use client';

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Video, MessageSquare, Loader2, Users, Clock, History, ListFilter, Activity, ClipboardCheck, TrendingUp, DollarSign, PieChart as PieChartIcon, ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useUserData, useFirestore, useCollection, useDoc, useMemoFirebase } from "@/firebase";
import { collection, query, where, doc } from "firebase/firestore";
import type { Appointment, Patient } from "@/lib/types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";
import { format, isSameDay, subDays, startOfDay } from "date-fns";
import AppHeader from "@/components/layout/header";
import AppFooter from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { 
  Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, 
  Cell, PieChart, Pie 
} from "recharts";

const notesSchema = z.object({
  diagnosis: z.string().min(3, "Diagnosis is required."),
  prescription: z.string().min(10, "Prescription details are required."),
});
type NotesFormValues = z.infer<typeof notesSchema>;

function ConsultationDialog({ isOpen, onOpenChange, appointment }: { isOpen: boolean, onOpenChange: (open: boolean) => void, appointment: Appointment | null }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [view, setView] = useState<'details' | 'notes'>('details');
    
    const patientDocRef = useMemoFirebase(() => {
        if (!firestore || !appointment) return null;
        return doc(firestore, 'patients', appointment.patientId);
    }, [firestore, appointment]);
    const { data: patient } = useDoc<Patient>(patientDocRef);

    const form = useForm<NotesFormValues>({
        resolver: zodResolver(notesSchema),
        defaultValues: { diagnosis: '', prescription: '' }
    });

    useEffect(() => {
        if (appointment) {
            form.reset({
                diagnosis: appointment.diagnosis || '',
                prescription: appointment.prescription || '',
            });
            setView('details');
        }
    }, [appointment, form]);

    if (!appointment) return null;

    const onSubmit = (values: NotesFormValues) => {
        if (!firestore) return;
        const appointmentRef = doc(firestore, 'appointments', appointment.id);
        updateDocumentNonBlocking(appointmentRef, { ...values, status: 'completed', updatedAt: new Date().toISOString() });
        toast({ title: "Consultation Completed", description: "The records have been updated." });
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{view === 'details' ? 'Appointment Details' : 'Complete Consultation'}</DialogTitle>
                    <DialogDescription>
                        Patient: {patient ? `${patient.firstName} ${patient.lastName}` : 'Loading...'}
                    </DialogDescription>
                </DialogHeader>
                
                {view === 'details' ? (
                    <div className="space-y-6 py-4">
                        <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/20">
                            <Avatar className="h-12 w-12">
                                <AvatarFallback>{patient?.firstName?.[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-bold text-lg">{patient?.firstName} {patient?.lastName}</p>
                                <p className="text-sm text-muted-foreground">{patient?.email}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="space-y-1">
                                <p className="text-muted-foreground">Date & Time</p>
                                <p className="font-medium">{format(new Date(appointment.appointmentDateTime), "PPP p")}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-muted-foreground">Consultation Type</p>
                                <p className="font-medium capitalize">{appointment.appointmentType}</p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Button className="w-full" asChild>
                                <Link href="https://meet.google.com" target="_blank">
                                    <Video className="mr-2 h-4 w-4" /> Join Video Call
                                </Link>
                            </Button>
                            <Button variant="outline" className="w-full" onClick={() => setView('notes')}>
                                Start Consultation Form
                            </Button>
                        </div>
                    </div>
                ) : (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                            <FormField
                                control={form.control}
                                name="diagnosis"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Diagnosis</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g., Viral Infection" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="prescription"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Prescription & Advice</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="e.g., Paracetamol 500mg, twice a day..." rows={5} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => setView('details')}>Back</Button>
                                <Button type="submit" disabled={form.formState.isSubmitting}>
                                    {form.formState.isSubmitting ? "Saving..." : "Complete & Close"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                )}
            </DialogContent>
        </Dialog>
    );
}

const AppointmentRow = ({ apt, onSelect }: { apt: Appointment, onSelect: (a: Appointment) => void }) => {
    const firestore = useFirestore();
    const patientDocRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'patients', apt.patientId);
    }, [firestore, apt.patientId]);
    const { data: patient } = useDoc<Patient>(patientDocRef);

    return (
        <div className="flex items-center justify-between p-4 hover:bg-muted/50 rounded-xl transition-all border-b last:border-0 group cursor-pointer" onClick={() => onSelect(apt)}>
            <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                    <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">{patient?.firstName?.[0]}{patient?.lastName?.[0]}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-bold text-sm">{patient ? `${patient.firstName} ${patient.lastName}` : '...'}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 uppercase font-bold tracking-tighter">
                        <Clock className="h-2.5 w-2.5" /> {format(new Date(apt.appointmentDateTime), "p")} • {apt.appointmentType}
                    </p>
                </div>
            </div>
            <Badge variant={apt.status === 'completed' ? 'secondary' : 'outline'} className={apt.status === 'completed' ? 'bg-green-100 text-green-800' : 'text-primary border-primary/20'}>
                {apt.status === 'scheduled' ? 'Upcoming' : apt.status}
            </Badge>
        </div>
    );
};

export default function DoctorPortalPage() {
    const { user, userData, isUserLoading } = useUserData();
    const firestore = useFirestore();
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const appointmentsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, 'appointments'),
            where('doctorId', '==', user.uid)
        );
    }, [firestore, user]);

    const { data: appointments, isLoading: isLoadingAppointments } = useCollection<Appointment>(appointmentsQuery);

    const { todayAppointments, stats, analytics, consultMix, recentEvents } = useMemo(() => {
        if (!mounted || !appointments) return { 
            todayAppointments: [], 
            stats: { today: 0, pending: 0, revenue: 0 }, 
            analytics: [], 
            consultMix: [],
            recentEvents: []
        };
        
        const now = new Date();
        const today = appointments.filter(apt => isSameDay(new Date(apt.appointmentDateTime), now));
        const pending = appointments.filter(apt => apt.status === 'scheduled').length;
        const revenue = appointments.filter(apt => apt.paymentStatus === 'approved').reduce((sum, a) => sum + (a.amount || 1500), 0);

        // Weekly Revenue Growth Data
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const d = subDays(now, 6 - i);
            const dateStr = format(d, 'MMM dd');
            const dayRevenue = appointments
                .filter(a => a.paymentStatus === 'approved' && isSameDay(new Date(a.createdAt), d))
                .reduce((sum, a) => sum + (a.amount || 1500), 0);
            return { name: dateStr, revenue: dayRevenue };
        });

        // Consultation Mix
        const videoCount = appointments.filter(a => a.appointmentType === 'Video Call').length;
        const chatCount = appointments.filter(a => a.appointmentType === 'Chat' || a.appointmentType !== 'Video Call').length;
        const mix = [
            { name: 'Video Sessions', value: videoCount, color: 'hsl(var(--primary))' },
            { name: 'Text Consults', value: chatCount, color: 'hsl(var(--accent))' }
        ];

        // Recent System Events (Mocked based on actual data states)
        const events = appointments.slice(0, 5).map(apt => ({
            id: apt.id,
            msg: apt.status === 'completed' ? `Record finalized for patient ${apt.patientId.slice(0,4)}` : `New booking request: ${apt.appointmentType}`,
            time: format(new Date(apt.createdAt), "p"),
            type: apt.status
        }));

        return { 
            todayAppointments: today,
            stats: { today: today.length, pending: pending, revenue },
            analytics: last7Days,
            consultMix: mix,
            recentEvents: events
        };
    }, [appointments, mounted]);

    const handleSelectApt = (apt: Appointment) => {
        setSelectedAppointment(apt);
        setIsDialogOpen(true);
    };

    if (!mounted || isUserLoading) return (
        <div className="flex flex-col min-h-screen">
            <AppHeader />
            <main className="flex-grow flex items-center justify-center bg-secondary/30">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </main>
            <AppFooter />
        </div>
    );

    return (
        <div className="flex flex-col min-h-screen">
            <AppHeader />
            <main className="flex-grow bg-secondary/30 py-8">
                <div className="container mx-auto px-4 space-y-8">
                    
                    {/* High-End Analytics Header */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            <h1 className="text-3xl font-bold font-headline tracking-tight text-foreground">Clinical Command Center</h1>
                            <p className="text-muted-foreground flex items-center gap-2 mt-1">
                                <Activity className="h-4 w-4 text-primary" />
                                Welcome back, Dr. {userData?.firstName}. Your clinical practice is performing at peak efficiency.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full md:w-auto">
                            <Card className="p-3 bg-primary text-primary-foreground border-none shadow-lg shadow-primary/20">
                                <p className="text-[10px] font-bold uppercase opacity-80">Practice Revenue</p>
                                <p className="text-2xl font-bold">PKR {stats.revenue.toLocaleString()}</p>
                            </Card>
                            <Card className="p-3 bg-background border-none shadow-sm">
                                <p className="text-[10px] font-bold uppercase text-muted-foreground">Active Patients</p>
                                <p className="text-2xl font-bold text-primary">{appointments?.length || 0}</p>
                            </Card>
                            <Card className="p-3 bg-background border-none shadow-sm hidden sm:block">
                                <p className="text-[10px] font-bold uppercase text-muted-foreground">Avg. Rating</p>
                                <p className="text-2xl font-bold flex items-center gap-1">
                                    {userData?.rating || 4.9} <TrendingUp className="h-4 w-4 text-green-500" />
                                </p>
                            </Card>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        
                        {/* Left Column: Real-time Patient Queue */}
                        <div className="lg:col-span-4 space-y-6">
                            <Card className="border-none shadow-xl overflow-hidden">
                                <CardHeader className="bg-background pb-3 border-b">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <ClipboardCheck className="h-5 w-5 text-primary" /> Today's Live Queue
                                        </CardTitle>
                                        <Badge variant="outline" className="text-[10px] font-bold">{format(new Date(), "MMM dd")}</Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {isLoadingAppointments ? (
                                        <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>
                                    ) : todayAppointments.length > 0 ? (
                                        <div className="divide-y max-h-[500px] overflow-y-auto custom-scrollbar">
                                            {todayAppointments.map(apt => (
                                                <AppointmentRow key={apt.id} apt={apt} onSelect={handleSelectApt} />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-12 text-center text-muted-foreground space-y-2">
                                            <CalendarIcon className="h-10 w-10 mx-auto opacity-20" />
                                            <p className="text-sm font-medium">No sessions for today.</p>
                                            <Button variant="link" size="sm" asChild>
                                                <Link href="/doctor-portal/records">View Past Records</Link>
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                                <div className="p-4 bg-muted/20 border-t flex items-center justify-between">
                                    <Button variant="ghost" size="sm" className="text-xs font-bold text-primary gap-2" asChild>
                                        <Link href="/doctor-portal/patients">
                                            <Users className="h-3.5 w-3.5" /> Manage All Patients
                                        </Link>
                                    </Button>
                                    <Button variant="ghost" size="sm" className="text-xs font-bold text-muted-foreground gap-2" asChild>
                                        <Link href="/doctor-portal/records">
                                            <History className="h-3.5 w-3.5" /> History
                                        </Link>
                                    </Button>
                                </div>
                            </Card>

                            <Card className="border-none shadow-md">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <Activity className="h-4 w-4 text-primary" /> Clinical Event Log
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {recentEvents.map(ev => (
                                        <div key={ev.id} className="flex items-start gap-3 text-xs">
                                            <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${ev.type === 'completed' ? 'bg-green-500' : 'bg-primary'}`} />
                                            <div className="flex-1">
                                                <p className="font-medium text-foreground">{ev.msg}</p>
                                                <p className="text-[10px] text-muted-foreground">{ev.time}</p>
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Right Column: Practice Intelligence & Analytics */}
                        <div className="lg:col-span-8 space-y-8">
                            <div className="grid md:grid-cols-2 gap-8">
                                {/* Practice Revenue Chart */}
                                <Card className="border-none shadow-xl h-[400px]">
                                    <CardHeader className="border-b">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <DollarSign className="h-5 w-5 text-primary" /> Revenue Velocity
                                        </CardTitle>
                                        <CardDescription className="text-xs">Clinical earnings over the last 7 days</CardDescription>
                                    </CardHeader>
                                    <CardContent className="pt-6 h-[300px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={analytics}>
                                                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                                                <YAxis hide />
                                                <Tooltip 
                                                    cursor={{fill: 'hsl(var(--muted)/0.3)'}}
                                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                                />
                                                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>

                                {/* Consultation Mix Pie Chart */}
                                <Card className="border-none shadow-xl h-[400px]">
                                    <CardHeader className="border-b">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <PieChartIcon className="h-5 w-5 text-primary" /> Consultation Mix
                                        </CardTitle>
                                        <CardDescription className="text-xs">Breakdown of service modalities</CardDescription>
                                    </CardHeader>
                                    <CardContent className="pt-6 flex flex-col items-center justify-center h-[300px]">
                                        <ResponsiveContainer width="100%" height={200}>
                                            <PieChart>
                                                <Pie
                                                    data={consultMix}
                                                    innerRadius={60}
                                                    outerRadius={80}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    {consultMix.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="grid grid-cols-2 gap-4 mt-4 w-full px-4">
                                            {consultMix.map((m, i) => (
                                                <div key={i} className="flex flex-col items-center">
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{m.name}</p>
                                                    <p className="text-lg font-bold" style={{ color: m.color }}>{m.value}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card className="bg-primary/5 border-primary/20 border-2 border-dashed">
                                <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-primary text-primary-foreground p-3 rounded-xl shadow-lg">
                                            <TrendingUp className="h-8 w-8" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-xl">Grow Your Digital Clinic</h3>
                                            <p className="text-muted-foreground text-sm max-w-md">Verify more documents or update your clinic location to appear higher in patient search results.</p>
                                        </div>
                                    </div>
                                    <Button asChild size="lg" className="px-8 shadow-md">
                                        <Link href="/doctor-portal/profile">
                                            Complete Profile <ArrowRight className="ml-2 h-4 w-4" />
                                        </Link>
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    <ConsultationDialog 
                        isOpen={isDialogOpen} 
                        onOpenChange={setIsDialogOpen} 
                        appointment={selectedAppointment} 
                    />
                </div>
            </main>
            <AppFooter />
        </div>
    );
}