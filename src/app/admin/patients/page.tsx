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
import { collection, query, where } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Stethoscope, Users, LayoutList } from "lucide-react";

export default function AdminPatientsPage() {
    const firestore = useFirestore();

    // Fetch all patients
    const patientsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'patients'), where('role', '==', 'patient'));
    }, [firestore]);
    const { data: patients, isLoading: isLoadingPatients } = useCollection<Patient>(patientsQuery);

    // Fetch all doctors for grouping headers
    const doctorsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'doctors');
    }, [firestore]);
    const { data: doctors, isLoading: isLoadingDoctors } = useCollection<Doctor>(doctorsQuery);

    // Fetch appointments to determine the doctor-patient relationship
    const appointmentsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'appointments');
    }, [firestore]);
    const { data: appointments, isLoading: isLoadingAppointments } = useCollection<Appointment>(appointmentsQuery);

    const groupedData = useMemo(() => {
        if (!patients || !doctors || !appointments) return { grouped: {}, unassigned: [] };

        const groups: Record<string, { doctor: Doctor, patients: Patient[] }> = {};
        const assignedPatientIds = new Set<string>();

        // Map patients to doctors based on appointments
        appointments.forEach(apt => {
            if (!apt) return;
            const patient = patients.find(p => p && p.id === apt.patientId);
            const doctor = doctors.find(d => d && d.id === apt.doctorId);

            if (patient && doctor) {
                if (!groups[doctor.id]) {
                    groups[doctor.id] = { doctor, patients: [] };
                }
                if (!groups[doctor.id].patients.find(p => p.id === patient.id)) {
                    groups[doctor.id].patients.push(patient);
                }
                assignedPatientIds.add(patient.id);
            }
        });

        // Patients with no clinical history yet
        const unassigned = patients.filter(p => p && !assignedPatientIds.has(p.id));

        return { grouped: groups, unassigned };
    }, [patients, doctors, appointments]);

    const isLoading = isLoadingPatients || isLoadingDoctors || isLoadingAppointments;

    if (isLoading) {
        return (
            <div className="p-4 md:p-8 space-y-6">
                <Skeleton className="h-10 w-64" />
                <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Card key={i} className="border-none shadow-sm">
                            <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
                            <CardContent><Skeleton className="h-32 w-full" /></CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Clinical Distribution</h1>
                    <p className="text-muted-foreground">Patients categorized by their treating healthcare professionals.</p>
                </div>
                <div className="flex items-center gap-4 bg-muted/30 p-3 rounded-xl border border-dashed">
                    <div className="text-center px-4 border-r">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Total Patients</p>
                        <p className="text-xl font-bold text-primary">{patients?.length || 0}</p>
                    </div>
                    <div className="text-center px-4">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Active Doctors</p>
                        <p className="text-xl font-bold text-primary">{doctors?.length || 0}</p>
                    </div>
                </div>
            </div>

            <div className="space-y-10">
                {/* Grouped Patients by Doctor */}
                {Object.values(groupedData.grouped).map(({ doctor, patients: doctorPatients }) => (
                    <Card key={doctor.id} className="border-none shadow-lg overflow-hidden bg-white">
                        <CardHeader className="bg-primary/5 border-b flex flex-row items-center justify-between py-4">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                    <Stethoscope className="h-5 w-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg">Dr. {doctor.firstName} {doctor.lastName}</CardTitle>
                                    <p className="text-xs text-primary font-bold uppercase tracking-wider">{doctor.specialty}</p>
                                </div>
                            </div>
                            <Badge variant="secondary" className="bg-white border-primary/20 text-primary font-bold">
                                {doctorPatients.length} Patients Assigned
                            </Badge>
                        </CardHeader>
                        <CardContent className="p-0">
                            <PatientTable patients={doctorPatients} />
                        </CardContent>
                    </Card>
                ))}

                {/* Unassigned Patients */}
                {groupedData.unassigned.length > 0 && (
                    <Card className="border-none shadow-lg overflow-hidden bg-slate-50">
                        <CardHeader className="bg-slate-200/50 border-b py-4">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-slate-300 flex items-center justify-center text-slate-600">
                                    <Users className="h-5 w-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg text-slate-700">General Patient Pool</CardTitle>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">No clinical sessions recorded yet</p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <PatientTable patients={groupedData.unassigned} />
                        </CardContent>
                )}

                {patients?.length === 0 && (
                    <div className="text-center py-24 border-2 border-dashed rounded-3xl bg-muted/5">
                        <LayoutList className="h-12 w-12 mx-auto mb-4 text-muted-foreground/20" />
                        <p className="text-muted-foreground font-medium">No patient records found in the database.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function PatientTable({ patients }: { patients: Patient[] }) {
    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader className="bg-muted/10">
                    <TableRow>
                        <TableHead className="w-16 hidden sm:table-cell text-center">#</TableHead>
                        <TableHead>Patient Identity</TableHead>
                        <TableHead>Contact Information</TableHead>
                        <TableHead className="hidden md:table-cell">Status</TableHead>
                        <TableHead className="text-right">Joined Date</TableHead>
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
                                    <div className="h-8 w-8 rounded-full bg-primary/5 flex items-center justify-center text-primary text-xs font-bold border border-primary/10">
                                        {patient.firstName[0]}{patient.lastName[0]}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm">{patient.firstName} {patient.lastName}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">ID: {patient.id.slice(0, 8)}...</p>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell>
                                <p className="text-sm font-medium">{patient.email}</p>
                                <p className="text-xs text-muted-foreground">{patient.phone || 'No phone logged'}</p>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                                <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200 font-bold text-[10px]">
                                    ACTIVE
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right text-xs font-medium text-muted-foreground">
                                {new Date(patient.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}