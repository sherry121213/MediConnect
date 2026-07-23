'use client';

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Star, User, Search, Filter, ShieldCheck, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Review } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function AdminReviewsAuditPage() {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [ratingFilter, setRatingFilter] = useState('all');

  const reviewsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'reviews'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: reviews, isLoading } = useCollection<Review>(reviewsQuery);

  const filteredReviews = useMemo(() => {
    if (!reviews) return [];
    return reviews.filter(r => {
      const matchSearch = searchTerm === '' || 
        r.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.comment?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchRating = ratingFilter === 'all' || r.rating === parseInt(ratingFilter);
      
      return matchSearch && matchRating;
    });
  }, [reviews, searchTerm, ratingFilter]);

  return (
    <div className="p-4 md:p-8 space-y-8 bg-slate-50/50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight text-slate-900">Reviews Audit</h1>
          <p className="text-muted-foreground text-sm">Monitor clinical service quality through patient feedback.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search comments or names..." 
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
                    <SelectItem value="5" className="font-bold">5 Stars Only</SelectItem>
                    <SelectItem value="4" className="font-bold">4 Stars Only</SelectItem>
                    <SelectItem value="3" className="font-bold">3 Stars Only</SelectItem>
                    <SelectItem value="2" className="font-bold">2 Stars Only</SelectItem>
                    <SelectItem value="1" className="font-bold">1 Star Only</SelectItem>
                </SelectContent>
            </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-none shadow-xl bg-primary text-white rounded-2xl overflow-hidden">
              <CardContent className="p-6">
                  <p className="text-[10px] font-bold uppercase opacity-60 tracking-[0.2em] mb-1">Audit Population</p>
                  <p className="text-4xl font-bold tracking-tighter">{reviews?.length || 0}</p>
              </CardContent>
          </Card>
          <Card className="border-none shadow-xl bg-white rounded-2xl overflow-hidden md:col-span-2">
              <CardContent className="p-6 flex items-center gap-6">
                  <div className="h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 shrink-0 border border-amber-100">
                      <Star className="h-6 w-6 fill-amber-500" />
                  </div>
                  <div>
                      <p className="text-sm font-bold tracking-tight">Clinical Standards Surveillance</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">Systematically auditing patient testimonials to identify outliers in professional practice quality.</p>
                  </div>
              </CardContent>
          </Card>
      </div>

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
                    <TableHead className="font-bold">Logged At</TableHead>
                    <TableHead className="text-right pr-8 font-bold">Audit ID</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredReviews.map((r) => (
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
                            <div className="text-[10px] uppercase font-bold text-muted-foreground">
                                {format(new Date(r.createdAt), "PP")} 
                            </div>
                          </TableCell>
                          <TableCell className="text-right pr-8">
                             <code className="text-[9px] bg-slate-100 px-2 py-1 rounded text-slate-500 font-mono">
                                {r.id.slice(0, 8)}...
                             </code>
                          </TableCell>
                        </TableRow>
                    ))}
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
    </div>
  );
}