
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore, useUserData, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar as CalendarIcon, Loader2, Clock, CheckCircle2, XCircle, AlertCircle, History, Info, Sparkles } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, addDays, startOfDay, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const requestSchema = z.object({
  requestedDate: z.date({ required_error: "A date is required." }),
  reason: z.string().min(5, "Please provide a professional reason (min 5 characters)."),
});

type RequestFormValues = z.infer<typeof requestSchema>;

export default function DoctorUnavailabilityPage() {
  const { user } = useUserData();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      reason: '',
    }
  });

  const requestsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'doctorUnavailabilityRequests'),
      where('doctorId', '==', user.uid)
    );
  }, [firestore, user]);

  const { data: requests, isLoading } = useCollection<any>(requestsQuery);

  const onSubmit = (values: RequestFormValues) => {
    if (!user || !firestore) return;
    setIsSubmitting(true);

    const requestData = {
      doctorId: user.uid,
      requestedDate: values.requestedDate.toISOString(),
      reason: values.reason,
      status: 'pending',
      requestedAt: new Date().toISOString(),
    };

    const colRef = collection(firestore, 'doctorUnavailabilityRequests');
    addDocumentNonBlocking(colRef, requestData);

    toast({
      title: "Clinical Request Queued",
      description: "Admin will review your pause for " + format(values.requestedDate, "PPP"),
    });
    
    form.reset();
    setIsSubmitting(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle2 className="mr-1 h-3 w-3" /> Approved</Badge>;
      case 'rejected': return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" /> Rejected</Badge>;
      default: return <Badge variant="outline" className="text-amber-600 border-amber-600 bg-amber-50"><Clock className="mr-1 h-3 w-3" /> Pending</Badge>;
    }
  };

  return (
    <main className="flex-grow bg-secondary/30 py-10">
      <div className="container mx-auto px-4 max-w-6xl space-y-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
               <div className="h-10 w-1 bg-primary rounded-full" />
               Unavailability Center
            </h1>
            <p className="text-muted-foreground mt-1">Submit clinical pause requests for full-day absences.</p>
          </div>
          <div className="bg-primary/5 border border-primary/10 p-4 rounded-2xl flex items-center gap-4">
             <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Sparkles className="h-5 w-5" />
             </div>
             <div className="text-sm">
                <p className="font-bold">Next Possible Leave</p>
                <p className="text-muted-foreground">{format(addDays(new Date(), 1), "EEEE, MMM dd")}</p>
             </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
          <Card className="lg:col-span-4 h-fit border-none shadow-xl overflow-hidden">
            <CardHeader className="bg-slate-900 text-white">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-primary" /> Request a Pause
              </CardTitle>
              <CardDescription className="text-slate-400">Select a future clinical date.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="requestedDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="text-xs uppercase font-bold opacity-70">Target Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full h-12 pl-3 text-left font-normal border-2 hover:border-primary transition-colors",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? format(field.value, "PPP") : <span>Select a date...</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) => isSameDay(date, new Date()) || date < startOfDay(new Date())}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs uppercase font-bold opacity-70">Audit Reason</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Explain the reason for this clinical unavailability..." className="resize-none border-2" rows={4} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-2 p-3 bg-muted/50 rounded-lg text-[10px] text-muted-foreground">
                    <Info className="h-3 w-3 shrink-0 text-primary" />
                    <p>Same-day requests are blocked to maintain clinical continuity. Future requests can be accumulated and reviewed by Admin.</p>
                  </div>
                  <Button type="submit" className="w-full h-12 font-bold" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Submit Audit Request"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card className="lg:col-span-8 border-none shadow-xl">
            <CardHeader className="border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5 text-primary" /> Audit History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : requests && requests.length > 0 ? (
                <div className="overflow-x-auto">
                    <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow>
                        <TableHead className="font-bold">Leave Date</TableHead>
                        <TableHead className="font-bold">Reason Summary</TableHead>
                        <TableHead className="font-bold">Status</TableHead>
                        <TableHead className="text-right font-bold">Request Log</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {requests.sort((a:any, b:any) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()).map((req: any) => (
                        <TableRow key={req.id} className="hover:bg-muted/10 transition-colors">
                            <TableCell className="font-bold text-sm text-primary">
                                {format(new Date(req.requestedDate), "MMM dd, yyyy")}
                                <p className="text-[10px] text-muted-foreground font-normal uppercase tracking-tighter">{format(new Date(req.requestedDate), "EEEE")}</p>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate text-sm italic text-muted-foreground">
                                {req.reason}
                            </TableCell>
                            <TableCell>{getStatusBadge(req.status)}</TableCell>
                            <TableCell className="text-right text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                                {format(new Date(req.requestedAt), "PP")}
                            </TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                    </Table>
                </div>
              ) : (
                <div className="text-center py-24 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-10" />
                  <p className="font-medium">No clinical leave requests found.</p>
                  <p className="text-xs">Your request history will appear here.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
