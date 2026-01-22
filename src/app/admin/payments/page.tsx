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
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";
import type { Appointment, Doctor, Patient } from "@/lib/types";
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Eye } from "lucide-react";


export default function AdminPaymentsPage() {
  const firestore = useFirestore();

  const appointmentsCollection = useMemoFirebase(() => {
      if (!firestore) return null;
      return collection(firestore, 'appointments');
  }, [firestore]);
  const { data: appointments, isLoading: isLoadingAppointments } = useCollection<Appointment>(appointmentsCollection);

  const patientsCollection = useMemoFirebase(() => {
      if (!firestore) return null;
      return collection(firestore, 'patients');
  }, [firestore]);
  const { data: patients, isLoading: isLoadingPatients } = useCollection<Patient>(patientsCollection);

  const doctorsCollection = useMemoFirebase(() => {
      if (!firestore) return null;
      return collection(firestore, 'doctors');
  }, [firestore]);
  const { data: doctors, isLoading: isLoadingDoctors } = useCollection<Doctor>(doctorsCollection);

  const combinedData = useMemo(() => {
      if (!appointments || !patients || !doctors) return [];
      return appointments.map(apt => {
          const patient = patients.find(p => p.id === apt.patientId);
          const doctor = doctors.find(d => d.id === apt.doctorId);
          return {
              ...apt,
              patientName: patient ? `${patient.firstName} ${patient.lastName}` : 'N/A',
              doctorName: doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : 'N/A',
          }
      }).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [appointments, patients, doctors]);

  const isLoading = isLoadingAppointments || isLoadingPatients || isLoadingDoctors;


  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge className="bg-amber-100 text-amber-800">Pending</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-3xl font-bold font-headline mb-6">Payment Management</h1>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient</TableHead>
              <TableHead>Doctor</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Receipt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({length: 5}).map((_, i) => (
                <TableRow key={i}>
                    <TableCell><Skeleton className="h-6 w-32"/></TableCell>
                    <TableCell><Skeleton className="h-6 w-32"/></TableCell>
                    <TableCell><Skeleton className="h-6 w-24"/></TableCell>
                    <TableCell><Skeleton className="h-6 w-24"/></TableCell>
                    <TableCell><Skeleton className="h-6 w-20"/></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-8 w-8 mx-auto"/></TableCell>
                </TableRow>
            ))}
            {!isLoading && combinedData.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell>{payment.patientName}</TableCell>
                <TableCell>{payment.doctorName}</TableCell>
                <TableCell>PKR {payment.amount?.toLocaleString() || '1,500'}</TableCell>
                <TableCell>{new Date(payment.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>{getStatusBadge(payment.status)}</TableCell>
                 <TableCell className="text-center">
                    {payment.paymentReceiptUrl ? (
                         <Button asChild variant="ghost" size="icon">
                             <Link href={payment.paymentReceiptUrl} target="_blank" rel="noopener noreferrer">
                                 <Eye className="h-5 w-5" />
                                 <span className="sr-only">View Receipt</span>
                             </Link>
                         </Button>
                    ) : (
                        <span className="text-xs text-muted-foreground">N/A</span>
                    )}
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && combinedData.length === 0 && (
                <TableRow>
                    <TableCell colSpan={6} className="text-center h-24">No payments found.</TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
