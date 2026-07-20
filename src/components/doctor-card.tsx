'use client';

import Image from 'next/image';
import type { Doctor } from '@/lib/types';
import { PlaceHolderImages as placeholderImages } from '@/lib/placeholder-images';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, MapPin, ShieldCheck, Video, Clock, BriefcaseMedical, CheckCircle2 } from 'lucide-react';
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
        <Card className="flex flex-col h-full overflow-hidden transition-all duration-300 hover:shadow-xl group border-gray-200/80 rounded-2xl">
            <div className="p-4 flex flex-col items-center text-center space-y-3">
                <Avatar className="h-20 w-20 border-2 border-primary/10 shadow-sm">
                    <AvatarImage src={imageSrc} className="object-cover" />
                    <AvatarFallback className="text-xl font-bold bg-primary/5 text-primary">{nameFallback}</AvatarFallback>
                </Avatar>
                <div>
                    <h3 className="text-sm font-bold font-headline line-clamp-1">{name}</h3>
                    <p className="text-[10px] text-primary font-bold uppercase tracking-tighter">{doctor.specialty}</p>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-bold">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    <span>{doctor.rating || 0}</span>
                </div>
                <Button size="sm" className="w-full bg-accent hover:bg-accent/90 text-white font-bold h-8 text-[10px] rounded-lg" onClick={handleBookAppointment}>
                    View Profile
                </Button>
            </div>
        </Card>
     )
  }

  return (
    <Card className="flex flex-col h-full overflow-hidden transition-all duration-300 hover:shadow-2xl bg-white border-none shadow-lg rounded-[2rem]">
      <CardContent className="p-6 space-y-6">
        {/* Header Identity Section */}
        <div className="flex gap-4">
            <div className="relative h-24 w-24 shrink-0 rounded-full overflow-hidden border-2 border-primary/5 shadow-inner">
                {imageSrc ? (
                    <Image src={imageSrc} alt={name} fill className="object-cover" />
                ) : (
                    <div className="h-full w-full bg-slate-50 flex items-center justify-center text-slate-300 text-2xl font-bold">{nameFallback}</div>
                )}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
                <h3 className="text-xl font-bold font-headline tracking-tight truncate">{name}</h3>
                {doctor.verified && (
                    <div className="flex items-center gap-1.5 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">PMDC Verified</span>
                    </div>
                )}
                <p className="text-xs text-muted-foreground font-medium">{doctor.specialty}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight truncate">{doctor.degree || 'MBBS, FCPS'}</p>
            </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 border-y py-4 border-slate-50">
            <div className="text-center space-y-1 border-r border-slate-50">
                <p className="text-xs font-bold text-slate-900">15 - 30 Min</p>
                <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">Wait Time</p>
            </div>
            <div className="text-center space-y-1 border-r border-slate-50">
                <p className="text-xs font-bold text-slate-900">{doctor.experience || 12} Years</p>
                <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">Experience</p>
            </div>
            <div className="text-center space-y-1">
                <p className="text-xs font-bold text-slate-900 flex items-center justify-center gap-1">
                    <Star className="h-3 w-3 text-amber-400 fill-amber-400" /> {doctor.rating || 4.8}
                </p>
                <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">{doctor.reviews || 0} Reviews</p>
            </div>
        </div>

        {/* Services & Availability */}
        <div className="space-y-3">
            <div className={cn(
                "p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between group",
                "border-primary bg-primary/5 shadow-sm"
            )}>
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                        <Video className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-900">Online Consultation</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[9px] font-bold uppercase text-green-600">Online Now</span>
                        </div>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-xs font-bold text-primary">Rs. 1,500</p>
                </div>
            </div>

            <div className="p-4 rounded-2xl border-2 border-slate-50 bg-slate-50/30 flex items-center justify-between opacity-60">
                 <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-slate-200 flex items-center justify-center text-slate-400">
                        <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-900">Clinical Center</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                            <span className="text-[9px] font-bold uppercase text-slate-500">Available Tomorrow</span>
                        </div>
                    </div>
                </div>
                <p className="text-xs font-bold text-slate-400">{doctor.location}</p>
            </div>
        </div>

        {/* Action Footer */}
        <div className="pt-2">
            <Button className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs shadow-lg shadow-primary/20" onClick={handleBookAppointment}>
                Book Appointment
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}
