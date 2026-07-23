'use client';

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Star, User, Search, Filter, ShieldCheck, MessageSquare, TrendingUp, Award, Stethoscope, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Review, Doctor } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AdminReviewsAuditPage() {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [ratingFilter, setRatingFilter] = useState('all');

  const reviewsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'reviews'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const doctorsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'doctors');
  }, [firestore]);

  const { data: reviews, isLoading: isLoadingReviews } = useCollection<Review>(reviewsQuery);
  const { data: doctors, isLoading: isLoadingDoctors } = useCollection<Doctor>(doctorsQuery);

  const performanceRankings = useMemo(() => {
    if (!reviews || !doctors) return [];
    
    const doctorStats: Record<string, { doctor: Doctor, ratings: number[], reviews: Review[] }> = {};
    
    reviews.forEach(r => {
        const doc = doctors.find(d => d.id === r.doctorId);
        if (!doc) return;
        
        if (!doctorStats[r.doctorId]) {
            doctorStats[r.doctorId] = { doctor: doc, ratings: [], reviews: [] };
        }
        doctorStats[r.doctorId].ratings.push(r.rating);
        doctorStats[r.doctorId].reviews.push(r);
    });

    return Object.values(doctorStats)
        .map(stat => ({
            ...stat,
            avgRating: stat.ratings.reduce((a, b) => a + b, 0) / stat.ratings.length,
            totalReviews: stat.ratings.length,
            latestFeedback: stat.reviews[0]?.comment || 'No comments logged.'
        }))
        .sort((a, b) => b.avgRating - a.avgRating);
  }, [reviews, doctors]);

  const filteredReviews = useMemo(() => {
    if (!reviews) return [];
    return reviews.filter(r => {
      const doctor = doctors?.find(d => d.id === r.doctorId);
      const doctorName = doctor ? `${doctor.firstName} ${doctor.lastName}` : 'Anonymous';
      const matchSearch = searchTerm === '' || 
        r.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doctorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.comment?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchRating = ratingFilter === 'all' || r.rating === parseInt(ratingFilter);
      
      return matchSearch && matchRating;
    });
  }, [reviews, searchTerm, ratingFilter, doctors]);

  const isLoading = isLoadingReviews || isLoadingDoctors;

  return (
    <div className="p-4 md:p-8 space-y-8 bg-slate-50/50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight text-slate-900">Clinical Performance Index</h1>
          <p className="text-muted-foreground text-sm">Auditing professional quality and patient cooperation across the registry.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search doctor or feedback..." 
                    className="pl-9 h-11 bg-white border-2 rounded-xl"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <Select value={ratingFilter} onValueChange={setRatingFilter}>
                <SelectTrigger className="w-full sm:w-40 h-11 bg-white border-2 rounded-xl font-bold">
                    <SelectValue placeholder="Rating Rank" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl">
                    <SelectItem value="all" className="font-bold">All Ratings</SelectItem>
                    {[5,4,3,2,1].map(r => (
                        <SelectItem key={r} value={r.toString()} className="font-bold">{r} Stars Only</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
      </div>

      <Tabs defaultValue="rankings" className="space-y-6">
        <TabsList className="bg-white p-1 rounded-2xl border shadow-sm h-14">
            <TabsTrigger value="rankings" className="rounded-xl px-8 font-bold text-[10px] uppercase tracking-widest gap-2">
                <Award className="h-3.5 w-3.5" /> Doctor Rankings
            </TabsTrigger>
            <TabsTrigger value="feed" className="rounded-xl px-8 font-bold text-[10px] uppercase tracking-widest gap-2">
                <MessageSquare className="h-3.5 w-3.5" /> Incoming Feed
            </TabsTrigger>
        </TabsList>

        <TabsContent value="rankings" className="space-y-6">
            <Card className="border-none shadow-2xl bg-white rounded-[2rem] overflow-hidden">
                <CardHeader className="bg-primary/5 border-b py-6 px-8">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-3">
                            <TrendingUp className="h-5 w-5 text-primary" /> High-Cooperation Professional Registry
                        </CardTitle>
                        <Badge variant="outline" className="bg-white text-primary font-bold border-primary/20">
                            {performanceRankings.length} Active Records
                        </Badge>
                    </div>
                    <CardDescription>Doctors ranked by average patient satisfaction and clinical cooperation.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                    ) : performanceRankings.length > 0 ? (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow>
                                        <TableHead className="py-5 pl-8 font-bold">Rank & Identity</TableHead>
                                        <TableHead className="font-bold">Performance</TableHead>
                                        <TableHead className="font-bold min-w-[300px]">Latest Context</TableHead>
                                        <TableHead className="text-right pr-8 font-bold">Consultations</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {performanceRankings.map((stat, idx) => (
                                        <TableRow key={stat.doctor.id} className="hover:bg-muted/30 transition-colors group">
                                            <TableCell className="py-5 pl-8">
                                                <div className="flex items-center gap-4">
                                                    <div className={cn(
                                                        "h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0",
                                                        idx === 0 ? "bg-amber-100 text-amber-600 shadow-sm border border-amber-200" : "bg-slate-100 text-slate-500"
                                                    )}>
                                                        #{idx + 1}
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-full bg-primary/5 flex items-center justify-center text-primary font-bold shadow-inner">
                                                            {stat.doctor.firstName[0]}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-sm">Dr. {stat.doctor.firstName} {stat.doctor.lastName}</p>
                                                            <p className="text-[10px] text-muted-foreground font-medium uppercase">{stat.doctor.specialty}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <div className="flex gap-0.5">
                                                        {Array.from({ length: 5 }).map((_, i) => (
                                                            <Star key={i} className={cn("h-3 w-3", i < Math.round(stat.avgRating) ? "text-amber-500 fill-amber-500" : "text-slate-200")} />
                                                        ))}
                                                    </div>
                                                    <p className="text-[10px] font-bold text-slate-500">{stat.avgRating.toFixed(1)} / 5.0</p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-start gap-3">
                                                    <MessageSquare className="h-4 w-4 text-slate-200 mt-0.5 shrink-0" />
                                                    <p className="text-xs text-slate-500 leading-relaxed italic line-clamp-2">
                                                        "{stat.latestFeedback}"
                                                    </p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right pr-8">
                                                <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-bold text-[10px] uppercase">
                                                    {stat.totalReviews} Testimonials
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div className="text-center py-32 text-muted-foreground">
                            <Stethoscope className="h-16 w-16 mx-auto mb-4 opacity-10" />
                            <p className="text-lg font-bold text-slate-400">No performance data yet.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="feed" className="space-y-6">
            <Card className="border-none shadow-2xl bg-white rounded-[2rem] overflow-hidden">
                <CardHeader className="bg-primary/5 border-b py-6 px-8">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Filter className="h-5 w-5 text-primary" /> Multi-Rank Distribution
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                {isLoading ? (
                    <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : filteredReviews.length > 0 ? (
                    <div className="overflow-x-auto">
                        <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow>
                            <TableHead className="py-5 pl-8 font-bold min-w-[180px]">Patient Profile</TableHead>
                            <TableHead className="font-bold">Rating Rank</TableHead>
                            <TableHead className="font-bold min-w-[300px]">Clinical Feedback</TableHead>
                            <TableHead className="font-bold">Professional</TableHead>
                            <TableHead className="text-right pr-8 font-bold">Audit ID</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredReviews.map((r) => {
                                const doctor = doctors?.find(d => d.id === r.doctorId);
                                return (
                                    <TableRow key={r.id} className="hover:bg-muted/30 transition-colors group">
                                    <TableCell className="py-5 pl-8">
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-full bg-primary/5 flex items-center justify-center text-primary">
                                                <User className="h-4 w-4" />
                                            </div>
                                            <span className="font-bold text-sm truncate max-w-[140px]">{r.patientName || 'Anonymous'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-0.5">
                                            {Array.from({ length: 5 }).map((_, i) => (
                                                <Star key={i} className={cn("h-3.5 w-3.5", i < r.rating ? "text-amber-500 fill-amber-500" : "text-slate-200")} />
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <p className="text-xs text-slate-600 leading-relaxed italic line-clamp-2">
                                            "{r.comment}"
                                        </p>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-[10px] uppercase font-bold text-slate-500">
                                            {doctor ? `Dr. ${doctor.lastName}` : 'System Prof.'}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right pr-8">
                                        <code className="text-[9px] bg-slate-100 px-2 py-1 rounded text-slate-500 font-mono">
                                            {r.id.slice(0, 8)}...
                                        </code>
                                    </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                        </Table>
                    </div>
                ) : (
                    <div className="text-center py-32 text-muted-foreground italic">
                    <Star className="h-16 w-16 mx-auto mb-4 opacity-10" />
                    <p className="text-lg font-bold text-slate-400 tracking-tight">No matching audit records found.</p>
                    </div>
                )}
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
