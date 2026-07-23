'use client';

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Mail, User, Search, Clock, ShieldCheck, MessageSquare, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export default function AdminInquiriesPage() {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInquiry, setSelectedInquiry] = useState<any>(null);

  const contactsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'contacts'), orderBy('submittedAt', 'desc'));
  }, [firestore]);

  const { data: inquiries, isLoading } = useCollection<any>(contactsQuery);

  const filteredInquiries = useMemo(() => {
    if (!inquiries) return [];
    return inquiries.filter(i => {
      const searchLower = searchTerm.toLowerCase();
      return i.name?.toLowerCase().includes(searchLower) || 
             i.email?.toLowerCase().includes(searchLower) ||
             i.message?.toLowerCase().includes(searchLower);
    });
  }, [inquiries, searchTerm]);

  return (
    <div className="p-4 md:p-8 space-y-8 bg-slate-50/50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight text-slate-900">Public Inquiries</h1>
          <p className="text-muted-foreground text-sm">Manage messages and feedback from the 'About Us' gateway.</p>
        </div>
        <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Search inquiries..." 
                className="pl-9 h-11 bg-white border-2 rounded-xl"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      <Card className="border-none shadow-2xl bg-white rounded-[2rem] overflow-hidden">
        <CardHeader className="bg-primary/5 border-b py-6 px-8">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" /> Incoming Message Pool
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : filteredInquiries.length > 0 ? (
            <div className="overflow-x-auto">
                <Table>
                <TableHeader className="bg-muted/30">
                    <TableRow>
                    <TableHead className="py-5 pl-8 font-bold">Identity</TableHead>
                    <TableHead className="font-bold">Contact Channel</TableHead>
                    <TableHead className="font-bold min-w-[300px]">Message Context</TableHead>
                    <TableHead className="font-bold">Received At</TableHead>
                    <TableHead className="text-right pr-8 font-bold">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredInquiries.map((inq) => (
                        <TableRow key={inq.id} className="hover:bg-muted/30 transition-colors group cursor-pointer" onClick={() => setSelectedInquiry(inq)}>
                          <TableCell className="py-5 pl-8">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                    <User className="h-4 w-4" />
                                </div>
                                <span className="font-bold text-sm">{inq.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                             <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                                <Mail className="h-3.5 w-3.5 text-primary/60" />
                                {inq.email}
                             </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-xs text-slate-500 line-clamp-1 italic">
                                "{inq.message}"
                            </p>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {format(new Date(inq.submittedAt), "MMM dd, p")}
                            </div>
                          </TableCell>
                          <TableCell className="text-right pr-8">
                             <Button variant="ghost" size="sm" className="h-8 rounded-lg font-bold text-[10px] uppercase">
                                Open Audit
                             </Button>
                          </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                </Table>
            </div>
          ) : (
            <div className="text-center py-32 text-muted-foreground italic">
              <AlertCircle className="h-16 w-16 mx-auto mb-4 opacity-10" />
              <p className="text-lg font-bold text-slate-400 tracking-tight">No inquiries matching your audit criteria.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inquiry Detail Dialog */}
      <Dialog open={!!selectedInquiry} onOpenChange={(open) => !open && setSelectedInquiry(null)}>
        <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden max-w-lg">
            <div className="bg-slate-900 text-white p-8">
                <div className="flex items-center gap-3 text-primary mb-2">
                    <ShieldCheck className="h-6 w-6" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Gateway Log Audit</span>
                </div>
                <DialogTitle className="text-2xl font-headline">Message Audit</DialogTitle>
                <DialogDescription className="text-slate-400">Reviewing public gateway submission metadata.</DialogDescription>
            </div>
            <div className="p-8 space-y-8 bg-white">
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Sender Identity</p>
                        <p className="font-bold text-slate-900">{selectedInquiry?.name}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Contact Point</p>
                        <p className="font-bold text-slate-900 truncate">{selectedInquiry?.email}</p>
                    </div>
                </div>
                <div className="space-y-3">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Full Message Context</p>
                    <div className="p-6 bg-slate-50 rounded-3xl border-2 italic text-sm text-slate-700 leading-relaxed shadow-inner">
                        "{selectedInquiry?.message}"
                    </div>
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-tighter pt-4 border-t">
                    <span>Logged: {selectedInquiry?.submittedAt ? format(new Date(selectedInquiry.submittedAt), "PP p") : ''}</span>
                    <span className="text-primary/60">Source: Public Gateway</span>
                </div>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}