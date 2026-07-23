'use client';

import { useFirestore, useUserData, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Star, Quote, ArrowLeft, History, Clock, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Review } from '@/lib/types';

export default function DoctorReviewsPage() {
  const { user } = useUserData();
  const firestore = useFirestore();

  const reviewsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
        collection(firestore, 'reviews'), 
        where('doctorId', '==', user.uid),
        orderBy('createdAt', 'desc')
    );
  }, [firestore, user]);

  const { data: reviews, isLoading } = useCollection<Review>(reviewsQuery);

  if (isLoading) return <div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <main className="min-h-screen bg-slate-50/50 py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-8 pb-20">
        <div className="flex justify-start">
            <Button variant="ghost" asChild className="rounded-xl hover:bg-white border shadow-sm px-4 group">
                <Link href="/doctor-portal">
                    <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                    Back to Hub
                </Link>
            </Button>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight text-slate-900">Professional Feedback</h1>
            <p className="text-muted-foreground mt-1">Review verified patient testimonials and clinical ratings.</p>
          </div>
          <div className="bg-white border shadow-sm px-6 py-4 rounded-[1.5rem] flex items-center gap-4">
             <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 shadow-inner">
                <Star className="h-5 w-5 fill-amber-500" />
             </div>
             <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest leading-none">Total Feedback</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{reviews?.length || 0}</p>
             </div>
          </div>
        </div>

        <div className="space-y-6">
          {reviews && reviews.length > 0 ? (
            reviews.map((review) => (
                <Card key={review.id} className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white hover:shadow-2xl transition-all duration-300">
                    <CardContent className="p-8 sm:p-10 space-y-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                            <div className="space-y-2">
                                <div className="flex gap-1">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <Star key={i} className={cn("h-5 w-5", i < review.rating ? "text-amber-500 fill-amber-500" : "text-slate-100")} />
                                    ))}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="bg-primary/5 text-primary font-bold text-[9px] uppercase tracking-widest px-3">Verified Consultation</Badge>
                                    <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1"><Clock className="h-3 w-3" /> {format(new Date(review.createdAt), "PPP")}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-full border border-slate-100 shrink-0">
                                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">P</div>
                                <span className="text-xs font-bold text-slate-700">{review.patientName || 'Anonymous'}</span>
                            </div>
                        </div>

                        <div className="relative p-6 bg-slate-50/50 rounded-3xl italic text-slate-600 leading-relaxed border-l-4 border-primary/20">
                            <Quote className="absolute -top-3 -left-3 h-8 w-8 text-primary/10" />
                            "{review.comment}"
                        </div>

                        <div className="flex justify-end pt-2">
                            <Link href={`/appointments/${review.appointmentId}`} className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-2 hover:underline">
                                <History className="h-3 w-3" /> View Linked Case
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            ))
          ) : (
            <div className="text-center py-32 bg-white rounded-[3rem] border-4 border-dashed border-slate-100 space-y-4">
                <Quote className="h-16 w-16 mx-auto opacity-5" />
                <div className="space-y-1">
                    <p className="text-lg font-bold text-slate-400">Awaiting your first review</p>
                    <p className="text-sm text-slate-300">Feedback will appear here once consultations are performed.</p>
                </div>
            </div>
          )}
        </div>

        <Card className="bg-slate-900 text-white rounded-[2rem] border-none shadow-2xl p-8 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
            <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="h-16 w-16 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 border border-white/5">
                    <ShieldCheck className="h-8 w-8 text-primary" />
                </div>
                <div className="space-y-1">
                    <h3 className="text-lg font-bold tracking-tight">Clinical Standards Protocol</h3>
                    <p className="text-sm text-slate-400 leading-relaxed max-w-xl">
                        Verified feedback helps our audit team maintain Pakistani telemedicine regulations. If you believe a review is fraudulent, please contact Admin Support for a formal audit.
                    </p>
                </div>
            </div>
        </Card>
      </div>
    </main>
  );
}