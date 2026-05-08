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
import { Eye, MoreHorizontal, CreditCard, Wallet, Landmark, ShieldCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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
      return appointments
          .filter(apt => apt !== null && apt.id)
          .map(apt => {
              const patient = patients.find(p => p.id === apt.patientId);
              const doctor = doctors.find(d => d.id === apt.doctorId);
              return {
                  ...apt,
                  patientName: patient ? `${patient.firstName} ${patient.lastName}` : 'N/A',
                  doctorName: doctor ? `Dr. ${doctor.firstName}` : 'N/A',
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

  const getPaymentStatusBadge = (status?: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 border-green-200 gap-1.5 font-bold text-[9px] uppercase"><ShieldCheck className="h-3 w-3" /> Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="font-bold text-[9px] uppercase">Rejected</Badge>;
      case 'pending':
      default:
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200 font-bold text-[9px] uppercase">Review</Badge>;
    }
  };

  const getChannelIcon = (method?: string) => {
      if (method === 'MasterCard') return <Landmark className="h-3.5 w-3.5" />;
      return <Wallet className="h-3.5 w-3.5" />;
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary text-white rounded-xl shadow-lg shadow-primary/20">
            <CreditCard className="h-6 w-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-headline tracking-tight">Payment Audit Center</h1>
        </div>
        <div className="flex items-center gap-2 bg-muted/40 px-4 py-2 rounded-lg border border-dashed text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-fit">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" /> Live Settlement Stream
        </div>
      </div>

      <div className="border rounded-2xl shadow-sm bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="py-4 min-w-[150px]">Patient</TableHead>
                <TableHead className="min-w-[120px]">Doctor</TableHead>
                <TableHead className="min-w-[150px]">Payment Chain</TableHead>
                <TableHead className="hidden lg:table-cell">Fee Amount</TableHead>
                <TableHead className="hidden md:table-cell">Transaction Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Evidence</TableHead>
                <TableHead className="text-right pr-6">Settlement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && Array.from({length: 5}).map((_, i) => (
                  <TableRow key={i}>
                      <TableCell><Skeleton className="h-6 w-24"/></TableCell>
                      <TableCell><Skeleton className="h-6 w-24"/></TableCell>
                      <TableCell><Skeleton className="h-6 w-24"/></TableCell>
                      <TableCell className="hidden lg:table-cell"><Skeleton className="h-6 w-24"/></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-6 w-24"/></TableCell>
                      <TableCell><Skeleton className="h-6 w-20"/></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-8 w-8 mx-auto"/></TableCell>
                      <TableCell className="text-right pr-6"><Skeleton className="h-8 w-8 ml-auto"/></TableCell>
                  </TableRow>
              ))}
              {!isLoading && combinedData.map((payment) => (
                <TableRow key={payment.id} className="hover:bg-muted/5 transition-all group">
                  <TableCell className="font-bold py-5 truncate max-w-[150px]">{payment.patientName}</TableCell>
                  <TableCell className="text-slate-600 truncate max-w-[120px]">{payment.doctorName}</TableCell>
                  <TableCell>
                    {payment.paymentMethod ? (
                      <div className="flex items-center gap-2">
                          <div className={cn(
                              "h-7 w-7 rounded-lg flex items-center justify-center border shrink-0",
                              payment.paymentMethod === 'MasterCard' ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-green-50 text-green-600 border-green-100"
                          )}>
                              {getChannelIcon(payment.paymentMethod)}
                          </div>
                          <Badge variant="outline" className="font-bold border-slate-200 text-slate-700 uppercase text-[9px] whitespace-nowrap">
                          {payment.paymentMethod}
                          </Badge>
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground font-bold uppercase opacity-40">System Legacy</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell font-mono font-bold text-slate-800 text-sm">PKR {payment.amount?.toLocaleString() || '1,500'}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      <p className="font-medium text-slate-600">{new Date(payment.createdAt).toLocaleDateString()}</p>
                      <p className="text-[9px] uppercase">{new Date(payment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </TableCell>
                  <TableCell>{getPaymentStatusBadge(payment.paymentStatus)}</TableCell>
                  <TableCell className="text-center">
                      {payment.paymentReceiptUrl ? (
                          <Button asChild variant="ghost" size="icon" className="h-9 w-9 text-primary hover:bg-primary/10 rounded-xl">
                              <Link href={payment.paymentReceiptUrl} target="_blank" rel="noopener noreferrer">
                                  <Eye className="h-5 w-5" />
                                  <span className="sr-only">View Receipt</span>
                              </Link>
                          </Button>
                      ) : (
                          <span className="text-[10px] text-muted-foreground italic font-bold opacity-30">N/A</span>
                      )}
                  </TableCell>
                  <TableCell className="text-right pr-6">
                      {payment.paymentStatus === 'pending' && (
                          <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" className="h-9 w-9 p-0 rounded-xl hover:bg-slate-100">
                                      <span className="sr-only">Open menu</span>
                                      <MoreHorizontal className="h-5 w-5" />
                                  </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 rounded-xl border-2">
                                  <DropdownMenuItem onClick={() => handleUpdatePaymentStatus(payment.id, 'approved')} className="text-green-600 font-bold py-2.5 cursor-pointer">
                                      <ShieldCheck className="mr-2 h-4 w-4" /> Approve Payment
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleUpdatePaymentStatus(payment.id, 'rejected')} className="text-destructive font-bold py-2.5 cursor-pointer">
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
                      <TableCell colSpan={8} className="text-center h-48 text-muted-foreground italic">
                          <Landmark className="h-12 w-12 mx-auto mb-4 opacity-10" />
                          <p className="font-bold text-lg">No audit records found</p>
                          <p className="text-sm px-4">Patient transactions will appear here for verification.</p>
                      </TableCell>
                  </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}