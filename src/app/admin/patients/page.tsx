'use client';

import { useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Patient, Doctor, Appointment } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, where, doc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Stethoscope, Users, LayoutList, Trash2, MoreHorizontal, AlertCircle } from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

function PatientTable({ patients }: { patients: Patient[] }) {
    const firestore = useFirestore();
    const { toast } = useToast();

    const handleDeletePatient = (patientId: string) => {
        if (!firestore) return;
        deleteDocumentNonBlocking(doc(firestore, 'patients', patientId));
        toast({
            title: "Patient Purged",
            description: "The patient record has been permanently removed from the registry.",
            variant: "destructive"
        });
    };

    if (!patients || patients.length === 0) return null;

    return (
        <div className="overflow-x-auto custom-scrollbar">
            <Table>
                <TableHeader className="bg-muted/10">
                    <TableRow>
                        <TableHead className="w-16 hidden sm:table-cell text-center">#</TableHead>
                        <TableHead className="min-w-[200px]">Patient Identity</TableHead>
                        <TableHead className="min-w-[180px]">Contact Information</TableHead>
                        <TableHead className="hidden lg:table-cell">Status</TableHead>
                        <TableHead className="text-right pr-6 min-w-[120px]">Joined Date</TableHead>
                        <TableHead className="text-right pr-8">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {patients.map((patient, index) => (
                        <TableRow key={patient.id} className="hover:bg-muted/5 transition-colors">
                            <TableCell className="hidden sm:table-cell text-center font-mono text-[10px] text-muted-foreground">
                                {index + 1}
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-primary/5 flex items-center justify-center text-primary text-xs font-bold border border-primary/10 shrink-0">
                                        {patient.firstName?.[0] || '?'}{patient.lastName?.[0] || '?'}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-sm truncate">{patient.firstName} {patient.lastName}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter truncate opacity-60">ID: {patient.id.slice(0, 8)}</p>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell>
                                <p className="text-sm font-medium truncate max-w-[180px]">{patient.email}</p>
                                <p className="text-xs text-muted-foreground">{patient.phone || 'No phone logged'}</p>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                                <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200 font-bold text-[10px] uppercase">
                                    Active
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right pr-6 text-xs font-medium text-muted-foreground">
                                {patient.createdAt ? new Date(patient.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'N/A'}
                            </TableCell>
                            <TableCell className="text-right pr-8">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-slate-100">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48 rounded-xl border-2 shadow-xl p-1">
                                        <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground p-2">Operations</DropdownMenuLabel>
                                        
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <DropdownMenuItem className="text-destructive font-bold rounded-lg cursor-pointer" onSelect={(e) => e.preventDefault()}>
                                                    <Trash2 className="mr-2 h-4 w-4" /> Delete Record
                                                </DropdownMenuItem>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl">
                                                <AlertDialogHeader>
                                                    <div className="mx-auto bg-destructive/10 text-destructive p-3 rounded-full w-fit mb-2">
                                                        <AlertCircle className="h-8 w-8" />
                                                    </div>
                                                    <AlertDialogTitle className="font-headline text-2xl text-center">Purge Patient Record?</AlertDialogTitle>
                                                    <AlertDialogDescription className="text-sm text-center">
                                                        This will permanently delete <strong>{patient.firstName} {patient.lastName}</strong> from the clinical system. All associated medical history links for this profile will be severed.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter className="pt-6 sm:justify-center gap-3">
                                                    <AlertDialogCancel className="rounded-xl border-2">Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeletePatient(patient.id)} className="rounded-xl font-bold text-white bg-destructive hover:bg-destructive/90">Confirm Purge</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

export default function AdminPatientsPage() {
    const firestore = useFirestore();

    const patientsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'patients'), where('role', '==', 'patient'));
    }, [firestore]);
    const { data: patients, isLoading: isLoadingPatients } = useCollection<Patient>(patientsQuery);

    const doctorsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'doctors');
    }, [firestore]);
    const { data: doctors, isLoading: isLoadingDoctors } = useCollection<Doctor>(doctorsQuery);

    const appointmentsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'appointments');
    }, [firestore]);
    const { data: appointments, isLoading: isLoadingAppointments } = useCollection<Appointment>(appointmentsQuery);

    const groupedData = useMemo(() => {
        if (!patients || !doctors || !appointments) return { grouped: [], unassigned: [] };

        const groups: Record<string, { doctor: Doctor, patients: Patient[] }> = {};
        const assignedPatientIds = new Set<string>();

        appointments.forEach(apt => {
            if (!apt || !apt.patientId || !apt.doctorId) return;
            const patient = patients.find(p => p && p.id === apt.patientId);
            const doctor = doctors.find(d => d && d.id === apt.doctorId);

            if (patient && doctor) {
                if (!groups[doctor.id]) {
                    groups[doctor.id] = { doctor, patients: [] };
                }
                if (!groups[doctor.id].patients.some(p => p.id === patient.id)) {
                    groups[doctor.id].patients.push(patient);
                }
                assignedPatientIds.add(patient.id);
            }
        });

        const unassigned = patients.filter(p => p && !assignedPatientIds.has(p.id));
        return { grouped: Object.values(groups), unassigned };
    }, [patients, doctors, appointments]);

    const isLoading = isLoadingPatients || isLoadingDoctors || isLoadingAppointments;

    if (isLoading) {
        return (
            <div className="p-4 md:p-8 space-y-6">
                <Skeleton className="h-12 w-64 rounded-xl" />
                <div className="space-y-6">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Card key={i} className="border-none shadow-sm rounded-2xl">
                            <CardHeader><Skeleton className="h-8 w-48"/></CardHeader>
                            <CardContent><Skeleton className="h-40 w-full rounded-xl"/></CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">Clinical Distribution</h1>
                    <p className="text-muted-foreground text-sm font-medium">Patient workload analysis across verified providers.</p>
                </div>
                <div className="flex items-center gap-4 bg-white p-3 rounded-2xl border shadow-sm w-full md:w-auto">
                    <div className="flex-1 text-center px-4 border-r">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-tighter">Total Registry</p>
                        <p className="text-xl font-bold text-primary">{patients?.length || 0}</p>
                    </div>
                    <div className="flex-1 text-center px-4">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-tighter">Providers</p>
                        <p className="text-xl font-bold text-primary">{doctors?.length || 0}</p>
                    </div>
                </div>
            </div>

            <div className="space-y-10">
                {groupedData.grouped.map(({ doctor, patients: doctorPatients }) => (
                    <Card key={doctor.id} className="border-none shadow-xl overflow-hidden bg-white rounded-2xl">
                        <CardHeader className="bg-primary/5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-5 px-6">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0 shadow-inner">
                                    <Stethoscope className="h-6 w-6" />
                                </div>
                                <div className="min-w-0">
                                    <CardTitle className="text-lg font-headline tracking-tight">Dr. {doctor.firstName} {doctor.lastName}</CardTitle>
                                    <p className="text-[10px] text-primary font-bold uppercase tracking-[0.15em] truncate">{doctor.specialty}</p>
                                </div>
                            </div>
                            <Badge variant="secondary" className="bg-white border-2 border-primary/10 text-primary font-bold px-4 py-1.5 rounded-full shadow-sm">
                                {doctorPatients.length} Linked Patients
                            </Badge>
                        </CardHeader>
                        <CardContent className="p-0">
                            <PatientTable patients={doctorPatients} />
                        </CardContent>
                    </Card>
                ))}

                {groupedData.unassigned.length > 0 && (
                    <Card className="border-none shadow-xl overflow-hidden bg-slate-50 rounded-2xl">
                        <CardHeader className="bg-slate-200/50 border-b py-5 px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-2xl bg-slate-300 flex items-center justify-center text-slate-600 shrink-0 shadow-inner">
                                    <Users className="h-6 w-6" />
                                </div>
                                <div className="min-w-0">
                                    <CardTitle className="text-lg text-slate-700 font-headline">General Patient Pool</CardTitle>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.15em]">Pending Assignment</p>
                                </div>
                            </div>
                            <Badge variant="outline" className="bg-white border-2 border-slate-200 text-slate-600 font-bold px-4 py-1.5 rounded-full shadow-sm">
                                {groupedData.unassigned.length} Available Records
                            </Badge>
                        </CardHeader>
                        <CardContent className="p-0">
                            <PatientTable patients={groupedData.unassigned} />
                        </CardContent>
                    </Card>
                )}

                {!isLoading && patients?.length === 0 && (
                    <div className="text-center py-32 border-2 border-dashed rounded-[2.5rem] bg-muted/5">
                        <LayoutList className="h-16 w-16 mx-auto mb-6 text-muted-foreground/20" />
                        <p className="text-muted-foreground font-bold tracking-tight">No clinical patient records indexed.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
