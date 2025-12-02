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
import { useAdmin } from "@/hooks/useAdmin";
import { ShieldAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// NOTE: Payments data is static for now as there is no payments collection in Firestore.
const payments = [
  { id: 'pay_1', patient: 'Ali Khan', doctor: 'Dr. Amina Khan', amount: 50, status: 'Approved', date: '2023-10-26' },
  { id: 'pay_2', patient: 'Sana Ahmed', doctor: 'Dr. Bilal Ahmed', amount: 75, status: 'Approved', date: '2023-10-25' },
  { id: 'pay_3', patient: 'Zoya Farooq', doctor: 'Dr. Fatima Zahra', amount: 60, status: 'Pending', date: '2023-10-25' },
  { id: 'pay_4', patient: 'Usman Sharif', doctor: 'Dr. Amina Khan', amount: 50, status: 'Approved', date: '2023-10-24' },
  { id: 'pay_5', patient: 'Hina Iqbal', doctor: 'Dr. Hassan Raza', amount: 40, status: 'Disputed', date: '2023-10-23' },
];

export default function AdminPaymentsPage() {
    const { isAdmin, isLoading } = useAdmin();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case 'Pending':
        return <Badge className="bg-amber-100 text-amber-800">Pending</Badge>;
      case 'Disputed':
        return <Badge variant="destructive">Disputed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

    if (isLoading) {
        return (
             <div className="p-4 md:p-8">
                <h1 className="text-3xl font-bold font-headline mb-6">Payment Management</h1>
                <Skeleton className="border rounded-lg h-96" />
            </div>
        )
    }

    if (!isAdmin) {
        return (
            <div className="p-4 md:p-8 flex flex-col items-center justify-center text-center h-[60vh]">
                <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
                <h1 className="text-2xl font-bold font-headline text-destructive">Access Denied</h1>
                <p className="text-muted-foreground mt-2">You do not have permission to view this page.</p>
            </div>
        )
    }

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-3xl font-bold font-headline mb-6">Payment Management</h1>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transaction ID</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Doctor</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell className="font-mono text-xs">{payment.id}</TableCell>
                <TableCell>{payment.patient}</TableCell>
                <TableCell>{payment.doctor}</TableCell>
                <TableCell>${payment.amount.toFixed(2)}</TableCell>
                <TableCell>{payment.date}</TableCell>
                <TableCell>{getStatusBadge(payment.status)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
