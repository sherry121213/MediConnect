'use client';

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Video, Loader2, Clock, History, Activity, ClipboardCheck, Settings2, ShieldCheck, Moon, ChevronLeft, ChevronRight, User, Bell, AlertCircle, Siren, Trash2, RefreshCw, FileText, CheckCircle2, XCircle, PhoneCall } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useUserData, useFirestore, useCollection, useDoc, useMemoFirebase } from "@/firebase";
import { collection, query, where, doc, getDocs } from "firebase/firestore";
import type { Appointment, Patient, Doctor } from "@/lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { updateDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";
import { format, isSameDay, addDays, subDays, isBefore, isAfter, isValid, startOfDay, addMinutes, parse } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { getNext7Days } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";

function PatientHistoryTab({ patientId }: { patientId: string }) {
    const firestore = useFirestore();
    const historyQuery = useMemoFirebase(() => {
        if (!firestore || !patientId) return null;
        return query(
            collection(firestore, 'appointments'),
            where('patientId', '==', patientId),
            where('status', '==', 'completed')
        );
    }, [firestore, patientId]);

    const { data: pastApts, isLoading } = useCollection<Appointment>(historyQuery);

    if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

    return (
        <div className="space-y-4 pr-2 pb-20">
            {pastApts && pastApts.length > 0 ? (
                pastApts.filter(a => a && a.appointmentDateTime).sort((a,b) => new Date(b.appointmentDateTime).getTime() - new Date(a.appointmentDateTime).getTime()).map(apt => (
                    <div key={apt.id} className="p-4 border-2 rounded-2xl bg-muted/5 space-y-2">
                        <div className="flex justify-between items-start">
                            <p className="text-[10px] font-bold text-primary uppercase tracking-widest">{format(new Date(apt.appointmentDateTime), "PPP")}</p>
                            <Badge variant="outline" className="text-[10px] font-bold px-2.5 py-0.5 h-auto">Performed</Badge>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-700">Diagnosis:</p>
                            <p className="text-xs text-muted-foreground italic">{apt.diagnosis}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-700">Advice:</p>
                            <p className="text-xs text-muted-foreground line-clamp-2">{apt.prescription}</p>
                        </div>
                    </div>
                ))
            ) : (
                <div className="text-center py-12 text-muted-foreground italic">
                    <FileText className="h-10 w-10 mx-auto mb-2 opacity-10" />
                    <p className="text-xs font-bold uppercase tracking-widest">No Prior Records Found</p>
                </div>
            )}
        </div>
    );
}

function InternalPostponeDialog({ isOpen, onOpenChange, appointment }: { isOpen: boolean, onOpenChange: (o: boolean) => void, appointment: any }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedHour, setSelectedHour] = useState<string>("09");
    const [selectedMinute, setSelectedMinute] = useState<string>("00");
    const [selectedPeriod, setSelectedPeriod] = useState<string>("AM");
    const [isSaving, setIsSaving] = useState(false);
    const [nowTicker, setNowTicker] = useState(new Date());
    const availableDates = getNext7Days();

    useEffect(() => {
        const interval = setInterval(() => setNowTicker(new Date()), 60000);
        return () => clearInterval(interval);
    }, []);

    const isToday = isSameDay(selectedDate, nowTicker);
    const currentHour24 = nowTicker.getHours();
    const currentMin = nowTicker.getMinutes();
    const currentPeriod = currentHour24 >= 12 ? "PM" : "AM";
    const currentHour12 = currentHour24 > 12 ? currentHour24 - 12 : (currentHour24 === 0 ? 12 : currentHour24);

    const availablePeriods = useMemo(() => {
        if (!isToday) return ["AM", "PM"];
        if (currentPeriod === "PM") return ["PM"];
        return ["AM", "PM"];
    }, [isToday, currentPeriod]);

    const availableHours = useMemo(() => {
        const allHours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
        if (!isToday) return allHours;

        return allHours.filter(h => {
            const hNum = parseInt(h);
            if (selectedPeriod === currentPeriod) {
                const compareH = hNum === 12 ? 0 : hNum;
                const currentCompareH = currentHour12 === 12 ? 0 : currentHour12;
                return compareH >= currentCompareH;
            }
            return true;
        });
    }, [isToday, selectedPeriod, currentPeriod, currentHour12]);

    const availableMinutes = useMemo(() => {
        const allMins = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
        if (!isToday) return allMins;

        const hNum = parseInt(selectedHour);
        if (selectedPeriod === currentPeriod && hNum === currentHour12) {
            return allMins.filter(m => parseInt(m) > currentMin);
        }
        return allMins;
    }, [isToday, selectedHour, selectedPeriod, currentPeriod, currentHour12, currentMin]);

    useEffect(() => {
        if (isToday) {
            if (!availablePeriods.includes(selectedPeriod)) setSelectedPeriod(availablePeriods[0]);
            if (!availableHours.includes(selectedHour)) setSelectedHour(availableHours[0] || "09");
            if (!availableMinutes.includes(selectedMinute)) setSelectedMinute(availableMinutes[0] || "00");
        }
    }, [isToday, availablePeriods, availableHours, availableMinutes, selectedPeriod, selectedHour, selectedMinute]);

    const appointmentsQuery = useMemoFirebase(() => {
        if (!firestore || !appointment?.doctorId) return null;
        return query(collection(firestore, 'appointments'), where('doctorId', '==', appointment.doctorId));
    }, [firestore, appointment?.doctorId]);
    const { data: existingAppointments } = useCollection<Appointment>(appointmentsQuery);

    const selectedTimeStr = useMemo(() => `${selectedHour}:${selectedMinute} ${selectedPeriod}`, [selectedHour, selectedMinute, selectedPeriod]);

    const timeValidation = useMemo(() => {
        if (!existingAppointments || !selectedDate || !selectedTimeStr) return { isAvailable: true, message: '' };

        const proposedStart = parse(selectedTimeStr, 'hh:mm a', selectedDate);
        // Protocol: 20 min block for Precision Clinical Session
        const proposedEnd = addMinutes(proposedStart, 20);
        const now = new Date();

        if (isSameDay(selectedDate, now) && isBefore(proposedStart, now)) {
            return { isAvailable: false, message: 'This time has already passed for today.' };
        }

        const overlap = existingAppointments.find(apt => {
            if (!apt || apt.status === 'cancelled' || !apt.appointmentDateTime || apt.id === appointment.id) return false;
            const aptStart = new Date(apt.appointmentDateTime);
            const aptEnd = addMinutes(aptStart, 20);
            return proposedStart < aptEnd && proposedEnd > aptStart;
        });

        if (overlap) return { isAvailable: false, message: 'This clinical window is already booked.' };

        return { isAvailable: true, message: '' };
    }, [selectedTimeStr, selectedDate, existingAppointments, appointment.id]);

    const handleConfirm = async () => {
        if (!firestore || !appointment || !timeValidation.isAvailable) return;
        setIsSaving(true);
        
        const newDateTime = parse(selectedTimeStr, 'hh:mm a', selectedDate);

        updateDocumentNonBlocking(doc(firestore, 'appointments', appointment.id), {
            appointmentDateTime: newDateTime.toISOString(),
            status: 'scheduled', 
            updatedAt: new Date().toISOString(),
            doctorInRoom: false,
            readyToStart: false
        });
        toast({ title: "Clinical Session Rescheduled", description: `Appointment moved to ${format(newDateTime, "PPP p")}.` });
        setIsSaving(false);
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl rounded-[2.5rem] border-none shadow-2xl overflow-hidden p-0 max-h-[90dvh] flex flex-col animate-in zoom-in-95 duration-200">
                <div className="bg-slate-900 p-6 sm:p-8 text-white shrink-0">
                    <DialogTitle className="text-xl sm:text-2xl font-headline">Clinical Rescheduling</DialogTitle>
                    <DialogDescription className="text-slate-400 mt-1 font-medium">Shift this Precision Session precisely.</DialogDescription>
                </div>
                <div className="flex-1 overflow-y-auto bg-white overscroll-contain custom-scrollbar">
                    <div className="p-8 space-y-10 pb-32">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">Select Date</p>
                            <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2 custom-scrollbar">
                                {availableDates.map(day => (
                                    <button 
                                        key={day.date.toISOString()}
                                        onClick={() => { setSelectedDate(day.date); }}
                                        className={cn(
                                            "p-4 rounded-3xl border-2 transition-all shrink-0 w-28 text-center flex flex-col items-center justify-center gap-1",
                                            isSameDay(selectedDate, day.date) ? 'bg-primary/5 border-primary shadow-sm' : 'bg-background hover:bg-muted border-slate-100'
                                        )}
                                    >
                                        <p className="text-[10px] font-bold uppercase text-muted-foreground">{day.dayName}</p>
                                        <p className="text-xl font-bold font-headline text-slate-900">{format(day.date, "dd")}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="border-t pt-10">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-6">Manual Time Adjustment</p>
                            <div className="grid grid-cols-3 gap-3 p-4 border-2 rounded-2xl bg-slate-50">
                                <div className="space-y-1">
                                    <Label className="text-[9px] uppercase font-bold text-muted-foreground">Hour</Label>
                                    <Select value={selectedHour} onValueChange={setSelectedHour}>
                                        <SelectTrigger className="h-10 rounded-lg border-2 bg-white font-bold">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[200px] rounded-xl border-none shadow-xl">
                                            {availableHours.map(h => (
                                                <SelectItem key={h} value={h}>{h}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[9px] uppercase font-bold text-muted-foreground">Min</Label>
                                    <Select value={selectedMinute} onValueChange={setSelectedMinute}>
                                        <SelectTrigger className="h-10 rounded-lg border-2 bg-white font-bold">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[200px] rounded-xl border-none shadow-xl">
                                            {availableMinutes.map(m => (
                                                <SelectItem key={m} value={m}>{m}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[9px] uppercase font-bold text-muted-foreground">Per</Label>
                                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                                        <SelectTrigger className="h-10 rounded-lg border-2 bg-white font-bold">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-none shadow-xl">
                                            {availablePeriods.map(p => (
                                                <SelectItem key={p} value={p}>{p}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            {selectedTimeStr && !timeValidation.isAvailable && (
                                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
                                    <XCircle className="h-4 w-4 text-red-600" />
                                    <p className="text-[10px] text-red-800 font-bold uppercase">{timeValidation.message}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="p-6 sm:p-8 border-t bg-slate-50 shrink-0 mt-auto">
                    <div className="flex gap-4">
                        <Button variant="ghost" className="flex-1 h-14 rounded-2xl font-bold" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button className="flex-1 h-14 rounded-2xl font-bold shadow-2xl shadow-primary/20 bg-slate-900 hover:bg-slate-800 text-white" disabled={!timeValidation.isAvailable || isSaving} onClick={handleConfirm}>
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Move"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

const AppointmentRow = ({ apt, patient, onSelect, onNotify, isMounted }: { apt: Appointment, patient?: Patient, onSelect: (a: Appointment) => void, onNotify: (a: Appointment) => void, isMounted: boolean }) => {
    const appointmentDate = new Date(apt.appointmentDateTime);
    const now = isMounted ? Date.now() : 0;
    
    const startTime = appointmentDate.getTime();
    const earlyBufferTime = startTime - (5 * 60 * 1000);
    const endTime = startTime + (15 * 60 * 1000); 

    const isLive = isMounted && now >= startTime && now < endTime && apt.status === 'scheduled';
    const isNotifyRange = isMounted && now >= earlyBufferTime && now < startTime && apt.status === 'scheduled';
    const isMissed = isMounted && now >= endTime && apt.status !== 'completed';

    return (
        <div className={cn(
            "flex items-center justify-between p-4 hover:bg-muted/50 rounded-xl transition-all border-b last:border-0 group cursor-pointer",
            isLive && "bg-primary/5 border-primary/20 shadow-sm"
        )} onClick={() => onSelect(apt)}>
            <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-10 w-10 border-2 border-background shadow-sm shrink-0">
                    <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">{patient?.firstName?.[0]}{patient?.lastName?.[0]}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{patient ? `${patient.firstName} ${patient.lastName}` : '...'}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 uppercase font-bold tracking-tighter truncate">
                        <Clock className="h-2.5 w-2.5 shrink-0" /> {format(appointmentDate, "p")} • Precision Session
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-4">
                {isLive && <Badge className="bg-red-600 text-white animate-pulse text-[9px] px-2 font-bold h-auto py-1">LIVE NOW</Badge>}
                {isNotifyRange && (
                    <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-8 text-[9px] font-bold border-primary text-primary hover:bg-primary hover:text-white"
                        onClick={(e) => { e.stopPropagation(); onNotify(apt); }}
                        disabled={apt.readyToStart}
                    >
                        <PhoneCall className="h-3 w-3 mr-1" /> {apt.readyToStart ? 'Patient Signaled' : 'Signal Ready'}
                    </Button>
                )}
                {isMissed && <Badge variant="destructive" className="text-[9px] px-2.5 py-1 h-auto font-bold uppercase">Missed</Badge>}
                {!isLive && !isNotifyRange && !isMissed && (
                    <Badge variant={apt.status === 'completed' ? 'secondary' : 'outline'} className={cn("shrink-0 text-[10px] px-2.5 py-1 h-auto font-bold", apt.status === 'completed' ? "bg-green-100 text-green-800" : "text-primary border-primary/20")}>
                        {apt.status === 'scheduled' ? 'Scheduled' : apt.status === 'completed' ? 'Performed' : apt.status}
                    </Badge>
                )}
            </div>
        </div>
    );
};

function ConsultationDialog({ isOpen, onOpenChange, appointment, patient, isMounted, onPostpone }: { isOpen: boolean, onOpenChange: (open: boolean) => void, appointment: Appointment | null, patient?: Patient, isMounted: boolean, onPostpone: (a: any) => void }) {
    const firestore = useFirestore();
    const { toast } = useToast();

    const form = useForm({
        resolver: zodResolver(z.object({ diagnosis: z.string().min(3), prescription: z.string().min(10) })),
        defaultValues: { diagnosis: appointment?.diagnosis || '', prescription: appointment?.prescription || '' }
    });

    if (!appointment) return null;

    const isCompleted = appointment.status === 'completed';

    const onSubmit = (values: any) => {
        if (!firestore || isCompleted) return;
        const appointmentRef = doc(firestore, 'appointments', appointment.id);
        updateDocumentNonBlocking(appointmentRef, { ...values, status: 'completed', updatedAt: new Date().toISOString(), doctorInRoom: false, readyToStart: false });
        toast({ title: "Clinical Record Logged" });
        onOpenChange(false);
    };

    const appointmentDate = new Date(appointment.appointmentDateTime);
    const now = isMounted ? Date.now() : 0;
    const startTime = appointmentDate.getTime();
    const earlyNotifyTime = startTime - (5 * 60 * 1000); 
    const endTime = startTime + (15 * 60 * 1000); 

    const isLive = isMounted && now >= startTime && now < endTime && appointment.status === 'scheduled';
    const isFlexibleEarly = isMounted && now >= earlyNotifyTime && now < startTime && appointment.status === 'scheduled';
    const isExpired = isMounted && now >= endTime && appointment.status !== 'completed';

    const handleStartRoom = () => {
        if (isFlexibleEarly && !appointment.readyToStart && firestore) {
            updateDocumentNonBlocking(doc(firestore, 'appointments', appointment.id), { readyToStart: true, doctorInRoom: true });
        }
        onOpenChange(false);
        window.location.assign(`/consultation/${appointment.id}`);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl p-0 overflow-hidden border-none shadow-2xl w-[95vw] sm:w-full rounded-t-[2.5rem] sm:rounded-[2.5rem] max-h-[95dvh] flex flex-col animate-in zoom-in-95 duration-200">
                <Tabs defaultValue="overview" className="w-full flex-1 flex flex-col overflow-hidden">
                    <div className="bg-slate-900 p-6 sm:p-8 text-white shrink-0">
                        <DialogTitle className="text-2xl font-headline mb-6 text-white">Patient Clinical Record</DialogTitle>
                        <TabsList className="bg-white/10 border-none text-white w-full grid grid-cols-3 h-12 p-1 rounded-xl">
                            <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-900 font-bold uppercase text-[10px]">Registry</TabsTrigger>
                            <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-900 font-bold uppercase text-[10px]">History</TabsTrigger>
                            <TabsTrigger value="notes" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-900 font-bold uppercase text-[10px]">Clinical Notes</TabsTrigger>
                        </TabsList>
                    </div>
                    <div className="flex-1 overflow-y-auto bg-white overscroll-contain custom-scrollbar">
                        <div className="p-6 sm:p-10 pb-32">
                            <TabsContent value="overview" className="space-y-8 m-0">
                                <div className="flex items-center gap-6 p-6 border-2 rounded-[2rem] bg-muted/20">
                                    <Avatar className="h-16 w-16 shadow-lg border-2 border-white"><AvatarFallback className="bg-primary text-white font-bold text-lg">{patient?.firstName?.[0]}{patient?.lastName?.[0]}</AvatarFallback></Avatar>
                                    {patient && <div className="min-w-0"><p className="font-bold text-xl truncate text-slate-900">{patient.firstName} {patient.lastName}</p><p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{patient.email}</p></div>}
                                </div>
                                <div className="flex flex-col gap-4 pt-4">
                                    {isCompleted ? (
                                        <div className="p-8 bg-green-50 border-2 border-green-100 rounded-3xl text-center space-y-3">
                                            <ShieldCheck className="h-12 w-12 text-green-600 mx-auto" />
                                            <p className="font-bold text-xl text-green-800">Precision Session Finalized</p>
                                        </div>
                                    ) : (isLive || isFlexibleEarly) ? (
                                        <>
                                            <Button onClick={handleStartRoom} className={cn("h-16 text-lg font-bold shadow-2xl rounded-2xl text-white", isLive ? "bg-red-600 hover:bg-red-700 animate-pulse" : "bg-primary hover:bg-primary/90")}>
                                                <Video className="mr-3 h-6 w-6" /> {isLive ? "Join Precision Session" : "Start Early (Flexible Window)"}
                                            </Button>
                                            <Button variant="outline" className="h-14 text-sm font-bold w-full rounded-2xl gap-3 border-2" onClick={() => onPostpone(appointment)}>
                                                <RefreshCw className="h-4 w-4 text-primary" /> Shift Session
                                            </Button>
                                        </>
                                    ) : isExpired ? (
                                        <div className="space-y-6">
                                            <div className="p-8 bg-red-50 border-2 border-red-100 rounded-3xl text-center space-y-3">
                                                <AlertCircle className="h-12 w-12 text-red-600 mx-auto" />
                                                <p className="font-bold text-xl text-red-800">Session Window Concluded</p>
                                            </div>
                                            <Button variant="outline" className="h-16 text-lg font-bold w-full rounded-2xl gap-3 border-2 hover:bg-primary/5" onClick={() => onPostpone(appointment)}>
                                                <RefreshCw className="h-5 w-5 text-primary" /> Reschedule Session
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="p-6 bg-slate-50 border-2 rounded-3xl text-center">
                                                <Clock className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                                                <p className="text-sm font-bold text-slate-600">Awaiting Precision Window</p>
                                                <p className="text-[10px] text-muted-foreground mt-1">Starts at {format(appointmentDate, "p")}</p>
                                            </div>
                                            <Button variant="outline" className="h-16 text-lg font-bold w-full rounded-2xl gap-3 border-2 hover:bg-primary/5" onClick={() => onPostpone(appointment)}>
                                                <RefreshCw className="h-4 w-4 text-primary" /> Shift Session
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </TabsContent>
                            <TabsContent value="history" className="m-0">
                                <PatientHistoryTab patientId={appointment.patientId} />
                            </TabsContent>
                            <TabsContent value="notes" className="m-0">
                                <Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                                    <FormField control={form.control} name="diagnosis" render={({ field }) => (
                                        <FormItem><FormLabel className="uppercase text-[10px] font-bold tracking-[0.2em] text-muted-foreground">Clinical Diagnosis</FormLabel><FormControl><Input placeholder="Clinical Summary..." className="h-14 border-2 rounded-2xl px-5" {...field} disabled={isCompleted} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="prescription" render={({ field }) => (
                                        <FormItem><FormLabel className="uppercase text-[10px] font-bold tracking-[0.2em] text-muted-foreground">Treatment Plan</FormLabel><FormControl><Textarea placeholder="Detailed medical advice..." rows={8} className="resize-none border-2 rounded-2xl p-5" {...field} disabled={isCompleted} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    {!isCompleted && (
                                        <Button type="submit" className="w-full h-16 text-lg font-bold rounded-2xl shadow-2xl shadow-primary/20 bg-primary text-white">Finalize Record</Button>
                                    )}
                                </form></Form>
                            </TabsContent>
                        </div>
                    </div>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

export default function DoctorPortalPage() {
    const { user, userData, isUserLoading } = useUserData();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [isConsultOpen, setIsConsultOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isPostponeOpen, setIsPostponeOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [viewDate, setViewDate] = useState(new Date());
    const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(new Set());
    const [nowState, setNowState] = useState(Date.now());
    const [patientsMap, setPatientsMap] = useState<Map<string, Patient>>(new Map());

    useEffect(() => {
        setMounted(true);
        const timer = setInterval(() => setNowState(Date.now()), 15000);
        const saved = localStorage.getItem('dismissed_alerts');
        if (saved) try { setDismissedAlertIds(new Set(JSON.parse(saved))); } catch (e) { }
        return () => clearInterval(timer);
    }, []);

    const appointmentsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, 'appointments'), 
            where('doctorId', '==', user.uid),
            where('paymentStatus', '==', 'approved')
        );
    }, [firestore, user]);
    const { data: appointments, isLoading: isLoadingAppointments } = useCollection<Appointment>(appointmentsQuery);

    useEffect(() => {
        if (!appointments || !firestore) return;
        const fetchPatients = async () => {
            const pIds = Array.from(new Set(appointments.map(a => a?.patientId).filter(Boolean)));
            if (pIds.length === 0) return;
            
            const newMap = new Map<string, Patient>(patientsMap);
            const missingIds = pIds.filter(id => !newMap.has(id));
            if (missingIds.length === 0) return;

            for (let i = 0; i < missingIds.length; i += 30) {
                const chunk = missingIds.slice(i, i + 30);
                const q = query(collection(firestore, 'patients'), where('id', 'in', chunk));
                const snap = await getDocs(q);
                snap.forEach(doc => newMap.set(doc.id, doc.data() as Patient));
            }
            setPatientsMap(newMap);
        };
        fetchPatients();
    }, [appointments, firestore]);

    useEffect(() => {
        if (!mounted || !appointments || !firestore || !user) return;
        const checkMissedSessions = async () => {
            const now = Date.now();
            const missed = appointments.filter(apt => {
                if (!apt || apt.status !== 'scheduled' || !apt.appointmentDateTime) return false;
                return now > new Date(apt.appointmentDateTime).getTime() + (15 * 60 * 1000); 
            });
            for (const apt of missed) {
                if (!apt?.id) continue;
                updateDocumentNonBlocking(doc(firestore, 'appointments', apt.id), { status: 'expired', updatedAt: new Date().toISOString() });
                addDocumentNonBlocking(collection(firestore, 'missedSessionAudits'), {
                    appointmentId: apt.id, doctorId: user.uid, patientId: apt.patientId, scheduledTime: apt.appointmentDateTime, loggedAt: new Date().toISOString()
                });
            }
        };
        checkMissedSessions();
    }, [appointments, mounted, firestore, user, nowState]);

    const { activeQueue, timelineApts, stats, notifications } = useMemo(() => {
        if (!mounted || !appointments) return { activeQueue: [], timelineApts: [], stats: { today: 0, todayRevenue: 0, totalRevenue: 0, totalConsults: 0 }, notifications: [] };
        
        const now = new Date();
        const yesterday = subDays(now, 1);

        const allToday = appointments.filter(apt => apt && apt.appointmentDateTime && isSameDay(new Date(apt.appointmentDateTime), now) && apt.status !== 'cancelled');
        const viewDayApts = appointments.filter(apt => apt && apt.appointmentDateTime && isSameDay(new Date(apt.appointmentDateTime), viewDate) && apt.status !== 'cancelled')
                                      .sort((a,b) => a.appointmentDateTime.localeCompare(b.appointmentDateTime));

        const activeQ = allToday.filter(apt => apt.status === 'scheduled' && Date.now() < new Date(apt.appointmentDateTime).getTime() + (15 * 60 * 1000));
        
        const todayRev = allToday.filter(a => a.paymentStatus === 'approved').reduce((sum, a) => sum + (a.amount || 1500), 0);
        const lifetimeRev = appointments.filter(a => a && a.paymentStatus === 'approved').reduce((sum, a) => sum + (a.amount || 1500), 0);
        const totalCompleted = appointments.filter(a => a && a.status === 'completed').length;

        const alerts: any[] = [];
        appointments.forEach(a => {
            if (!a?.appointmentDateTime || a.status === 'completed' || a.status === 'cancelled') return;
            const alertId = a.id + (a.status === 'expired' ? '-exp' : '-notif');
            if (dismissedAlertIds.has(alertId)) return;
            if (a.status === 'expired') alerts.push({ id: alertId, msg: `Missed Window: ${format(new Date(a.appointmentDateTime), "p")}`, icon: AlertCircle, color: 'text-destructive', timestamp: new Date(a.updatedAt || a.createdAt).getTime() });
            else if (isAfter(new Date(a.createdAt), yesterday)) alerts.push({ id: alertId, msg: `New Registry: ${format(new Date(a.appointmentDateTime), "PP p")}`, icon: Clock, color: 'text-primary', timestamp: new Date(a.createdAt).getTime() });
            
            const aptStart = new Date(a.appointmentDateTime).getTime();
            if (Date.now() >= aptStart && Date.now() < aptStart + (15 * 60 * 1000) && a.status === 'scheduled') {
                alerts.push({ id: alertId + '-live', msg: "PRECISION SESSION LIVE", icon: Siren, color: 'text-red-500 animate-pulse font-bold', isReminder: true, timestamp: Date.now() + 1000000 });
            }
        });

        return { 
            activeQueue: activeQ,
            timelineApts: viewDayApts,
            stats: { today: allToday.length, todayRevenue: todayRev, totalRevenue: lifetimeRev, totalConsults: totalCompleted },
            notifications: alerts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        };
    }, [appointments, mounted, viewDate, dismissedAlertIds, nowState]);

    const handleSelectApt = (apt: Appointment) => { setSelectedAppointment(apt); setIsConsultOpen(true); };
    const handleTriggerPostpone = (apt: any) => { setSelectedAppointment(apt); setIsConsultOpen(false); setIsPostponeOpen(true); };
    
    const handleNotifyPatient = (apt: Appointment) => {
        if (!firestore) return;
        updateDocumentNonBlocking(doc(firestore, 'appointments', apt.id), { readyToStart: true, doctorInRoom: true });
        toast({ title: "Clinical Signal Sent", description: "Requesting patient to join for a Precision Session early start." });
    };

    if (!mounted || isUserLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

    return (
        <main className="min-h-screen bg-slate-50/50 py-8 px-4 overflow-x-hidden">
            <div className="max-w-7xl mx-auto space-y-8 pb-20">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-bold font-headline text-slate-900">Precision Practice Command</h1>
                        <p className="text-muted-foreground text-sm font-medium flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Intelligent Professional Performance Analytics</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full md:w-auto">
                        <Card className="p-4 bg-primary text-white border-none shadow-xl shadow-primary/10 rounded-2xl">
                            <p className="text-[10px] font-bold uppercase opacity-80">Practice Revenue</p>
                            <p className="text-xl font-bold">PKR {stats.todayRevenue.toLocaleString()}</p>
                        </Card>
                        <Card className="p-4 bg-white border-none shadow-sm rounded-2xl">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground">Session Load</p>
                            <p className="text-xl font-bold text-primary">{stats.today} Slots</p>
                        </Card>
                        <Button onClick={() => setIsHistoryOpen(true)} variant="outline" className="col-span-2 sm:col-span-1 h-full font-bold gap-2 border-2 bg-white rounded-2xl text-xs"><History className="h-4 w-4 text-primary" /> Performance</Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    <div className="lg:col-span-4 space-y-8">
                        <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden">
                             <CardHeader className="bg-slate-50 border-b p-6">
                                <CardTitle className="text-xs uppercase font-bold flex items-center gap-2"><Bell className="h-4 w-4 text-amber-500" /> Professional Alerts</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 space-y-3">
                                {notifications.length > 0 ? notifications.map(n => n && (
                                    <div key={n.id} className={cn("p-4 rounded-2xl border-2 flex gap-3 items-start", n.isReminder ? "bg-red-50 border-red-100" : "bg-slate-50 border-slate-100")}>
                                        <n.icon className={cn("h-4 w-4 shrink-0 mt-0.5", n.color)} />
                                        <p className={cn("text-xs font-bold", n.isReminder ? "text-red-700" : "text-slate-700")}>{n.msg}</p>
                                    </div>
                                )) : <div className="text-center py-8 opacity-20"><Activity className="h-8 w-8 mx-auto" /></div>}
                            </CardContent>
                        </Card>
                        
                        <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden">
                            <CardHeader className="bg-primary/5 border-b p-6">
                                <CardTitle className="text-xs uppercase font-bold flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-primary" /> Immediate Sessions</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {isLoadingAppointments ? <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/30" /></div> : 
                                 activeQueue.length > 0 ? <div className="divide-y">{activeQueue.map(apt => apt && <AppointmentRow key={apt.id} apt={apt} patient={patientsMap.get(apt.patientId)} onSelect={handleSelectApt} onNotify={handleNotifyPatient} isMounted={mounted} />)}</div> :
                                 <div className="p-12 text-center text-muted-foreground italic text-xs">No pending Precision Sessions.</div>}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="lg:col-span-8 space-y-8">
                        <Card className="border-none shadow-2xl bg-white rounded-[2.5rem] overflow-hidden">
                            <CardHeader className="border-b bg-slate-50 p-6 sm:p-8">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                                    <div className="space-y-1">
                                        <CardTitle className="text-xl font-headline flex items-center gap-3"><Clock className="h-6 w-6 text-primary" /> Clinical Timeline</CardTitle>
                                        <CardDescription className="text-xs">Precision sequence of all consultation sessions including administrative buffers.</CardDescription>
                                    </div>
                                    <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border-2 shadow-sm">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewDate(subDays(viewDate, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                                        <span className="px-3 text-xs font-bold uppercase tracking-widest">{format(viewDate, "MMM dd")}</span>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewDate(addDays(viewDate, 1))}><ChevronRight className="h-4 w-4" /></Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 sm:p-10 min-h-[400px]">
                                {timelineApts.length > 0 ? (
                                    <div className="space-y-4">
                                        {timelineApts.map((apt) => {
                                            const timing = {
                                                isLive: Date.now() >= new Date(apt.appointmentDateTime).getTime() && Date.now() < new Date(apt.appointmentDateTime).getTime() + (15 * 60 * 1000),
                                                isCompleted: apt.status === 'completed'
                                            };
                                            return (
                                                <div key={apt.id} className={cn(
                                                    "flex items-center justify-between p-6 rounded-[1.5rem] border-2 transition-all",
                                                    timing.isLive ? "border-primary bg-primary/5 shadow-lg shadow-primary/5 scale-[1.01]" : 
                                                    timing.isCompleted ? "border-green-100 bg-green-50/50" : "border-slate-100 hover:border-slate-200 bg-white"
                                                )}>
                                                    <div className="flex items-center gap-5">
                                                        <div className="text-center w-16 shrink-0 border-r-2 border-slate-100">
                                                            <p className="text-sm font-bold text-slate-900">{format(new Date(apt.appointmentDateTime), "hh:mm")}</p>
                                                            <p className="text-[10px] font-bold text-muted-foreground uppercase">{format(new Date(apt.appointmentDateTime), "a")}</p>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <div className={cn("h-10 w-10 rounded-full flex items-center justify-center shadow-inner", timing.isCompleted ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-400")}>
                                                                <User className="h-5 w-5" />
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-slate-900">{patientsMap.get(apt.patientId)?.firstName} {patientsMap.get(apt.patientId)?.lastName || '...'}</p>
                                                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">{apt.appointmentType} • Clinical Window</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        {timing.isCompleted ? <Badge className="bg-green-100 text-green-800 font-bold text-[10px] px-3 h-7">Performed</Badge> :
                                                         timing.isLive ? <Button size="sm" onClick={() => handleSelectApt(apt)} className="bg-red-600 hover:bg-red-700 text-white font-bold h-9 px-6 rounded-xl animate-pulse">Join Session</Button> :
                                                         <Button variant="outline" size="sm" onClick={() => handleSelectApt(apt)} className="h-9 px-4 rounded-xl font-bold border-2 text-xs">Manage</Button>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-32 opacity-20 grayscale">
                                        <CalendarIcon className="h-20 w-20 mb-4" />
                                        <p className="font-bold text-xs uppercase tracking-[0.3em]">No Clinical Registry for this date</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                    <DialogContent className="sm:max-w-md rounded-[2.5rem] p-8 border-none shadow-2xl animate-in zoom-in-95">
                        <DialogHeader className="text-center mb-8"><DialogTitle className="text-2xl font-headline flex items-center justify-center gap-3"><History className="h-6 w-6 text-primary" /> Clinical Performance</DialogTitle></DialogHeader>
                        <div className="space-y-4">
                            <div className="p-6 bg-slate-900 text-white rounded-3xl text-center"><p className="text-[10px] uppercase font-bold opacity-60">Aggregate Earnings</p><p className="text-3xl font-bold mt-1">PKR {stats.totalRevenue.toLocaleString()}</p></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-6 bg-primary/10 rounded-3xl text-center"><p className="text-[10px] uppercase font-bold text-primary">Performed</p><p className="text-2xl font-bold text-slate-900">{stats.totalConsults}</p></div>
                                <div className="p-6 bg-slate-100 rounded-3xl text-center"><p className="text-[10px] uppercase font-bold text-slate-500">Upcoming</p><p className="text-2xl font-bold text-slate-900">{appointments?.filter(a => a?.status === 'scheduled').length || 0}</p></div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {selectedAppointment && <ConsultationDialog isOpen={isConsultOpen} onOpenChange={setIsConsultOpen} appointment={selectedAppointment} patient={patientsMap.get(selectedAppointment.patientId)} isMounted={mounted} onPostpone={handleTriggerPostpone} />}
                {selectedAppointment && <InternalPostponeDialog isOpen={isPostponeOpen} onOpenChange={setIsPostponeOpen} appointment={selectedAppointment} />}
            </div>
        </main>
    );
}
