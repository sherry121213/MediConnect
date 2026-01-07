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
import type { Patient } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";


export default function AdminPatientsPage() {
    const firestore = useFirestore();

    const patientsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        // Query the 'patients' collection and filter for documents where the role is 'patient'
        return query(collection(firestore, 'patients'), where('role', '==', 'patient'));
    }, [firestore]);

    const { data: patients, isLoading: isLoadingPatients, error } = useCollection<Patient>(patientsQuery);

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
                    <TableCell>
                        <Badge variant={'secondary'}>
                            {patient.role}
                        </Badge>
                    </TableCell>
                    <TableCell>
                    <Badge variant={"secondary"} className={"bg-green-100 text-green-800"}>
                        Active
                    </Badge>
                    </TableCell>
                </TableRow>
                ))}
                {!isLoadingPatients && patients && patients.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={5} className="text-center h-24">No patients found.</TableCell>
                    </TableRow>
                )}
                 {error && (
                    <TableRow>
                        <TableCell colSpan={5} className="text-center h-24 text-destructive">
                            Error loading patients: {error.message}
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
            </Table>
        </div>
        </div>
    );
}
