'use client';

import Image from 'next/image';
import type { Doctor } from '@/lib/types';
import { PlaceHolderImages as placeholderImages } from '@/lib/placeholder-images';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, MapPin, ShieldCheck, Video, Clock, BriefcaseMedical, CheckCircle2, Wallet, CreditCard } from 'lucide-react';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { cn } from '@/lib/utils';

interface DoctorCardProps {
  doctor: Doctor;
  variant?: 'default' | 'compact';
}

export default function DoctorCard({ doctor, variant = 'default' }: DoctorCardProps) {
  const staticDoctorImage = placeholderImages.find(p => p.id === doctor.profileImageId);
  const imageSrc = doctor.photoURL || staticDoctorImage?.imageUrl;
  const name = `${doctor.firstName} ${doctor.lastName}`;
  const doctorProfileLink = `/find-a-doctor/${doctor.id}`;
  const nameFallback = (doctor.firstName?.[0] || '') + (doctor.lastName?.[0] || '');

  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const handleBookAppointment = () => {
    if (isUserLoading) return;
    if (!user) {
        toast({ title: 'Login Required', description: 'Please log in to book an appointment.' });
        router.push('/login');
    } else {
        router.push(doctorProfileLink);
    }
  };

  if (variant === 'compact') {
     return (
        <Card className="flex flex-col h-full overflow-hidden transition-all duration-300 hover:shadow-2xl group border-none shadow-lg rounded-[2rem] bg-white">
            <div className="p-6 flex flex-col items-center text-center space-y-4">
                <Avatar className="h-24 w-24 border-4 border-primary/5 shadow-inner">
                    <AvatarImage src={imageSrc} className="object-cover" />
                    <AvatarFallback className="text-2xl font-bold bg-primary/5 text-primary">{nameFallback}</AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                    <h3 className="text-lg font-bold font-headline line-clamp-1 text-slate-900 group-hover:text-primary transition-colors">{name}</h3>
                    <p className="text-[10px] text-primary font-bold uppercase tracking-widest">{doctor.specialty}</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-xs font-bold text-slate-700">
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        <span>{doctor.rating || '4.8'}</span>
                    </div>
                    <Badge variant="secondary" className="bg-primary/5 text-primary border-none px-3 font-bold text-[10px] uppercase">PKR 1,500</Badge>
                </div>
                <Button size="sm" className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-11 text-xs rounded-xl shadow-lg shadow-primary/10 transition-all active:scale-95" onClick={handleBookAppointment}>
                    Book Consultation
                </Button>
            </div>
        </Card>
     )
  }

  return (
    <Card className="flex flex-col h-full overflow-hidden transition-all duration-300 hover:shadow-2xl bg-white border-none shadow-lg rounded-[2.5rem]">
      <CardContent className="p-8 space-y-8">
        {/* Header Identity Section */}
        <div className="flex gap-6 items-start">
            <div className="relative h-28 w-28 shrink-0 rounded-3xl overflow-hidden border-4 border-primary/5 shadow-inner group-hover:scale-105 transition-transform">
                {imageSrc ? (
                    <Image src={imageSrc} alt={name} fill className="object-cover" />
                ) : (
                    <div className="h-full w-full bg-slate-50 flex items-center justify-center text-slate-300 text-3xl font-bold">{nameFallback}</div>
                )}
            </div>
            <div className="min-w-0 flex-1 space-y-2 pt-2">
                <h3 className="text-2xl font-bold font-headline tracking-tight truncate text-slate-900">{name}</h3>
                {doctor.verified && (
                    <div className="flex items-center gap-1.5 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Board Verified</span>
                    </div>
                )}
                <p className="text-sm text-slate-500 font-medium">{doctor.specialty}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{doctor.degree || 'MBBS, FCPS'}</p>
            </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 border-y py-6 border-slate-50">
            <div className="text-center space-y-1.5 border-r border-slate-50">
                <p className="text-sm font-bold text-slate-900">15 - 30 Min</p>
                <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">Wait Time</p>
            </div>
            <div className="text-center space-y-1.5 border-r border-slate-50">
                <p className="text-sm font-bold text-slate-900">{doctor.experience || 12} Years</p>
                <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">Practice</p>
            </div>
            <div className="text-center space-y-1.5">
                <p className="text-sm font-bold text-slate-900 flex items-center justify-center gap-1">
                    <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" /> {doctor.rating || 4.8}
                </p>
                <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">{doctor.reviews || 0} Reviews</p>
            </div>
        </div>

        {/* Unique Fee Section */}
        <div className="bg-slate-50 rounded-3xl p-5 border border-slate-100 flex items-center justify-between group/fee hover:bg-primary/5 hover:border-primary/20 transition-colors">
            <div className="flex items-center gap-4">
                <div className="h-11 w-11 rounded-2xl bg-white flex items-center justify-center text-primary shadow-sm group-hover/fee:bg-primary group-hover/fee:text-white transition-all">
                    <Wallet className="h-5 w-5" />
                </div>
                <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Session Fee</p>
                    <p className="text-lg font-bold text-slate-900">PKR 1,500</p>
                </div>
            </div>
            <div className="text-right">
                <Badge className="bg-primary text-white border-none text-[8px] font-bold uppercase py-1 px-3 rounded-full">Secured</Badge>
            </div>
        </div>

        {/* Location Section */}
        <div className="space-y-3">
            <div className="p-5 rounded-3xl border-2 border-slate-100 bg-white flex items-center justify-between group/loc hover:border-primary/20 transition-all">
                 <div className="flex items-center gap-4">
                    <div className="h-11 w-11 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover/loc:bg-primary/10 group-hover/loc:text-primary transition-all">
                        <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-900">Clinical Hub</p>
                        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">{doctor.location || 'Pakistan'}</p>
                    </div>
                </div>
            </div>
        </div>

        {/* Action Footer */}
        <div className="pt-2">
            <Button className="w-full h-16 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold text-lg shadow-2xl shadow-primary/20 transition-all active:scale-95" onClick={handleBookAppointment}>
                Request Consultation
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}
