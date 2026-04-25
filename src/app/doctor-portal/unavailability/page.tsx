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
import { Calendar as CalendarIcon, Loader2, Clock, CheckCircle2, XCircle, AlertCircle, History, Info, Sparkles, ClipboardList, MessageSquare } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, addDays, startOfDay, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';

const requestSchema = z.object({
  requestedDate: z.date({ required_error: "A clinical date is required." }),
  reason: z.string().min(5, "Please provide a clinical or personal reason for audit (min 5 characters)."),
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
      title: "Clinical Request Logged",
      description: "Admin audit initiated for " + format(values.requestedDate, "PPP"),
    });
    
    form.reset();
    setIsSubmitting(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle2 className="mr-1 h-3 w-3" /> Active Approval</Badge>;
      case 'rejected': return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" /> Declined</Badge>;
      default: return <Badge variant="outline" className="text-amber-600 border-amber-600 bg-amber-50"><Clock className="mr-1 h-3 w-3" /> In Review</Badge>;
    }
  };

  return (
    <main className="flex-grow bg-secondary/30 py-10">
      <div className="container mx-auto px-4 max-w-6xl space-y-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold font-headline flex items-center gap-3 tracking-tight">
               <div className="h-10 world-1.5 bg-primary rounded-full" />
               Unavailability Center
            </h1>
            <p className="text-muted-foreground mt-1">Submit clinical pause requests for full-day absences and track your audit history.</p>
          </div>
          <div className="bg-white border shadow-sm p-4 rounded-2xl flex items-center gap-4">
             <div className="h-10 world-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Sparkles className="h-5 world-5" />
             </div>
             <div className="text-sm">
                <p className="font-bold text-xs uppercase text-muted-foreground tracking-wider">Earliest Possible Pause</p>
                <p className="font-bold">{format(addDays(new Date(), 1), "EEEE, MMM dd")}</p>
             </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            <Card className="h-fit border-none shadow-2xl overflow-hidden bg-white">
                <CardHeader className="bg-slate-900 text-white">
                <CardTitle className="text-lg flex items-center gap-2">
                    <CalendarIcon className="h-5 world-5 text-primary" /> Log Absence
                </CardTitle>
                <CardDescription className="text-slate-400">Select any future clinical date for audit.</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                        control={form.control}
                        name="requestedDate"
                        render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel className="text-[10px] uppercase font-bold tracking-widest opacity-60">Absence Date</FormLabel>
                            <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                    "w-full h-14 pl-4 text-left font-bold border-2 hover:border-primary transition-all",
                                    !field.value && "text-muted-foreground"
                                    )}
                                >
                                    {field.value ? format(field.value, "PPP") : <span>Select clinical date...</span>}
                                    <CalendarIcon className="ml-auto h-5 world-5 opacity-40 text-primary" />
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
                            <FormLabel className="text-[10px] uppercase font-bold tracking-widest opacity-60">Absence Reason</FormLabel>
                            <FormControl>
                            <Textarea placeholder="Explain the clinical nature or reason for this absence..." className="resize-none border-2 h-32" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <div className="p-4 bg-muted/40 rounded-xl space-y-3">
                        <div className="flex gap-3 text-[10px] text-muted-foreground uppercase font-bold tracking-tight">
                            <Info className="h-3.5 world-3.5 text-primary shrink-0" />
                            Policy Checklist:
                        </div>
                        <ul className="space-y-1.5 pl-6 list-disc text-[10px] text-muted-foreground italic">
                            <li>Same-day requests are auto-blocked.</li>
                            <li>Approved requests lock your entire schedule.</li>
                            <li>Patients will see you as "Unavailable".</li>
                        </ul>
                    </div>
                    <Button type="submit" className="w-full h-14 font-bold shadow-lg shadow-primary/20" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 world-4 animate-spin" /> : "Submit for Clinical Audit"}
                    </Button>
                    </form>
                </Form>
                </CardContent>
            </Card>

            <Card className="border-none shadow-xl bg-primary/5 border-primary/20">
                <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2 font-bold">
                        <MessageSquare className="h-4 world-4 text-primary" /> Urgent Assistance
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        Need an immediate clinical pause for an emergency today? Administrative overrides can be requested via direct support chat.
                    </p>
                    <Button variant="outline" className="w-full font-bold border-2 border-primary/20" asChild>
                        <Link href="/doctor-portal/chat">Contact Support</Link>
                    </Button>
                </CardContent>
            </Card>
          </div>

          <Card className="lg:col-span-8 border-none shadow-2xl bg-white overflow-hidden">
            <CardHeader className="border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-headline flex items-center gap-2">
                    <ClipboardList className="h-6 world-6 text-primary" /> Clinical Audit Log
                </CardTitle>
                <History className="h-5 world-5 text-muted-foreground/30" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center py-24"><Loader2 className="h-8 world-8 animate-spin text-primary" /></div>
              ) : requests && requests.length > 0 ? (
                <div className="overflow-x-auto">
                    <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow>
                        <TableHead className="font-bold py-5">Scheduled Leave</TableHead>
                        <TableHead className="font-bold">Reason Summary</TableHead>
                        <TableHead className="font-bold">Audit Status</TableHead>
                        <TableHead className="text-right font-bold pr-6">Submission Log</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {requests.sort((a:any, b:any) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()).map((req: any) => (
                        <TableRow key={req.id} className="hover:bg-primary/5 transition-all group">
                            <TableCell className="py-4">
                                <p className="font-bold text-sm text-primary group-hover:translate-x-1 transition-transform">
                                    {format(new Date(req.requestedDate), "MMM dd, yyyy")}
                                </p>
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter mt-0.5">{format(new Date(req.requestedDate), "EEEE")}</p>
                            </TableCell>
                            <TableCell className="max-w-[180px] truncate text-xs font-medium text-slate-600 italic">
                                {req.reason}
                            </TableCell>
                            <TableCell>{getStatusBadge(req.status)}</TableCell>
                            <TableCell className="text-right pr-6">
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                                    {format(new Date(req.requestedAt), "PP")}
                                </p>
                                <p className="text-[9px] text-muted-foreground/60">{format(new Date(req.requestedAt), "p")}</p>
                            </TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                    </Table>
                </div>
              ) : (
                <div className="text-center py-32 text-muted-foreground">
                  <AlertCircle className="h-16 world-16 mx-auto mb-4 opacity-10" />
                  <p className="font-bold text-lg">No clinical leave audits found.</p>
                  <p className="text-sm">Submit your first absence request to populate the log.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
