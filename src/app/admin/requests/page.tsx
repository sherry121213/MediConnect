
'use client';

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, query } from 'firebase/firestore';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Check, X, Loader2, Calendar, User, ClipboardList } from 'lucide-react';
import type { Patient } from '@/lib/types';
import { useDoc } from '@/firebase';

const DoctorCell = ({ doctorId }: { doctorId: string }) => {
  const firestore = useFirestore();
  const docRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'patients', doctorId);
  }, [firestore, doctorId]);
  const { data: doctor } = useDoc<Patient>(docRef);

  return (
    <div className="flex items-center gap-2">
      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
        <User className="h-4 w-4" />
      </div>
      <span className="font-medium text-sm">
        {doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : '...'}
      </span>
    </div>
  );
};

export default function AdminRequestsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const requestsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'doctorUnavailabilityRequests'));
  }, [firestore]);

  const { data: requests, isLoading } = useCollection<any>(requestsQuery);

  const handleStatusChange = (requestId: string, status: 'approved' | 'rejected') => {
    if (!firestore) return;
    const reqRef = doc(firestore, 'doctorUnavailabilityRequests', requestId);
    updateDocumentNonBlocking(reqRef, { 
      status, 
      processedAt: new Date().toISOString() 
    });
    
    toast({
      title: `Request ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      description: `The unavailability request has been ${status}.`,
    });
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline">Clinical Requests</h1>
          <p className="text-muted-foreground">Manage doctor leave and unavailability requests.</p>
        </div>
      </div>

      <Card className="border-none shadow-lg overflow-hidden">
        <CardHeader className="bg-primary/5">
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" /> Approval Queue
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : requests && requests.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Doctor</TableHead>
                  <TableHead>Requested Date</TableHead>
                  <TableHead className="hidden md:table-cell">Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.sort((a:any, b:any) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()).map((req: any) => (
                  <TableRow key={req.id}>
                    <TableCell><DoctorCell doctorId={req.doctorId} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {format(new Date(req.requestedDate), "PPP")}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground italic max-w-xs truncate">
                      {req.reason}
                    </TableCell>
                    <TableCell>
                      <Badge variant={req.status === 'approved' ? 'secondary' : req.status === 'rejected' ? 'destructive' : 'outline'} 
                             className={cn(
                               req.status === 'approved' && "bg-green-100 text-green-800",
                               req.status === 'pending' && "bg-amber-100 text-amber-800 border-amber-200"
                             )}>
                        {req.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {req.status === 'pending' ? (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-green-600 hover:bg-green-100 hover:border-green-300" onClick={() => handleStatusChange(req.id, 'approved')}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-destructive hover:bg-red-100 hover:border-red-300" onClick={() => handleStatusChange(req.id, 'rejected')}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="text-[10px] text-muted-foreground italic">
                          Processed {format(new Date(req.processedAt || req.requestedAt), "PP")}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-24 text-muted-foreground">
              <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-10" />
              <p>No active clinical requests.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
