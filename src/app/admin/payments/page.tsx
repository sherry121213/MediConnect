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
import { collection, doc } from "firebase/firestore";
import type { Appointment, Doctor, Patient } from "@/lib/types";
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Eye, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";


export default function AdminPaymentsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

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

  const handleUpdatePaymentStatus = (appointmentId: string, status: 'approved' | 'rejected') => {
    if (!firestore) return;
    const appointmentDocRef = doc(firestore, 'appointments', appointmentId);
    updateDocumentNonBlocking(appointmentDocRef, { paymentStatus: status, updatedAt: new Date().toISOString() });
    toast({
        title: "Payment Updated",
        description: `The payment has been marked as ${status}.`,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge className="bg-blue-100 text-blue-800">Scheduled</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPaymentStatusBadge = (status?: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'pending':
      default:
        return <Badge className="bg-amber-100 text-amber-800">Pending</Badge>;
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
              <TableHead className="hidden lg:table-cell">Amount</TableHead>
              <TableHead className="hidden md:table-cell">Date</TableHead>
              <TableHead className="hidden lg:table-cell">Apt. Status</TableHead>
              <TableHead>Payment Status</TableHead>
              <TableHead className="text-center">Receipt</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({length: 5}).map((_, i) => (
                <TableRow key={i}>
                    <TableCell><Skeleton className="h-6 w-24"/></TableCell>
                    <TableCell><Skeleton className="h-6 w-24"/></TableCell>
                    <TableCell className="hidden lg:table-cell"><Skeleton className="h-6 w-24"/></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-6 w-24"/></TableCell>
                    <TableCell className="hidden lg:table-cell"><Skeleton className="h-6 w-20"/></TableCell>
                    <TableCell><Skeleton className="h-6 w-20"/></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-8 w-8 mx-auto"/></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto"/></TableCell>
                </TableRow>
            ))}
            {!isLoading && combinedData.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell>{payment.patientName}</TableCell>
                <TableCell>{payment.doctorName}</TableCell>
                <TableCell className="hidden lg:table-cell">PKR {payment.amount?.toLocaleString() || '1,500'}</TableCell>
                <TableCell className="hidden md:table-cell">{new Date(payment.createdAt).toLocaleDateString()}</TableCell>
                <TableCell className="hidden lg:table-cell">{getStatusBadge(payment.status)}</TableCell>
                <TableCell>{getPaymentStatusBadge(payment.paymentStatus)}</TableCell>
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
                 <TableCell className="text-right">
                    {payment.paymentStatus === 'pending' && (
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                    <span className="sr-only">Open menu</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleUpdatePaymentStatus(payment.id, 'approved')}>
                                    Approve Payment
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleUpdatePaymentStatus(payment.id, 'rejected')} className="text-destructive">
                                    Reject Payment
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && combinedData.length === 0 && (
                <TableRow>
                    <TableCell colSpan={8} className="text-center h-24">No payments found.</TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
