'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useCollection, useFirestore } from "@/firebase";
import { collection } from "firebase/firestore";
import { useMemo } from "react";
import type { Patient } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminPatientsPage() {
    const firestore = useFirestore();

    const patientsCollection = useMemo(() => {
        if (!firestore) return null;
        return collection(firestore, 'patients');
    }, [firestore]);

    const { data: patients, isLoading: isLoadingPatients } = useCollection<Patient>(patientsCollection);

    return (
        <div className="p-4 md:p-8">
        <h1 className="text-3xl font-bold font-headline mb-6">Patient Management</h1>
        <div className="border rounded-lg">
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead>Patient ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoadingPatients && Array.from({length: 5}).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><Skeleton className="h-6 w-40"/></TableCell>
                        <TableCell><Skeleton className="h-6 w-32"/></TableCell>
                        <TableCell><Skeleton className="h-6 w-48"/></TableCell>
                        <TableCell><Skeleton className="h-6 w-20"/></TableCell>
                        <TableCell><Skeleton className="h-6 w-20"/></TableCell>
                    </TableRow>
                ))}
                {patients && patients.map((patient) => (
                <TableRow key={patient.id}>
                    <TableCell className="font-mono text-xs">{patient.id}</TableCell>
                    <TableCell>{patient.firstName} {patient.lastName}</TableCell>
                    <TableCell>{patient.email}</TableCell>
                    <TableCell>{patient.role}</TableCell>
                    <TableCell>
                    <Badge variant={"secondary"} className={"bg-green-100 text-green-800"}>
                        Active
                    </Badge>
                    </TableCell>
                </TableRow>
                ))}
            </TableBody>
            </Table>
        </div>
        </div>
    );
}
