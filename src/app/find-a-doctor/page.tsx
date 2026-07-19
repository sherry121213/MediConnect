
'use client';

import { useState, useMemo, useEffect } from 'react';
import AppHeader from '@/components/layout/header';
import AppFooter from '@/components/layout/footer';
import DoctorCard from '@/components/doctor-card';
import { specialties } from '@/lib/data';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, MapPin, Loader2, X, AlertCircle, Filter, Users, Star, Clock } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Doctor } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const locations = ["Islamabad", "Rawalpindi", "Lahore", "Karachi", "Peshawar", "Faisalabad", "Multan", "Quetta"];

const filterPills = [
    { id: 'female', label: "Female Doctors", icon: Users },
    { id: 'near', label: "Doctors Near Me", icon: MapPin },
    { id: 'exp', label: "Most Experienced", icon: Star },
    { id: 'today', label: "Available Today", icon: Clock },
];

export default function FindADoctorPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const doctorsPerPage = 8;

  const doctorsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
        collection(firestore, 'doctors'),
        where('verified', '==', true),
        where('profileComplete', '==', true)
    );
  }, [firestore]);

  const { data: doctors, isLoading: isLoadingDoctors } = useCollection<Doctor>(doctorsQuery);

  const handlePillClick = (filterId: string) => {
      if (activeFilterId === filterId) {
          setActiveFilterId(null);
      } else {
          setActiveFilterId(filterId);
          if (filterId === 'near') {
              handleLocationClick();
          }
      }
  };

  const handleLocationClick = () => {
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`);
            const data = await response.json();
            const city = data.address.city || data.address.town || data.address.village || data.address.state;
            const matchedCity = locations.find(loc => city?.toLowerCase().includes(loc.toLowerCase()));
            if (matchedCity) {
                 setSelectedLocation(matchedCity);
                 toast({ title: `Location Detected: ${matchedCity}` });
            } else {
                toast({ title: "Location Note", description: `Primary coverage for hub cities only.` });
            }
        } catch (error) {
            toast({ variant: "destructive", title: "Location Error" });
        } finally {
            setIsLocating(false);
        }
      },
      () => {
        toast({ variant: "destructive", title: "Access Denied" });
        setIsLocating(false);
      }
    );
  };

  const filteredDoctors = useMemo(() => {
    if (!doctors) return [];
    return doctors.filter(doctor => {
      const isActive = doctor.isActive !== false;
      if (!isActive) return false;
      
      const nameMatch = `${doctor.firstName} ${doctor.lastName}`.toLowerCase().includes(searchTerm.toLowerCase());
      const specialtyMatch = selectedSpecialty === 'all' || doctor.specialty === selectedSpecialty;
      const locationMatch = selectedLocation === 'all' || doctor.location === selectedLocation;
      
      // Female Doctors Filter Logic
      const genderMatch = activeFilterId === 'female' ? doctor.gender === 'female' : true;
      
      // Additional filter pill logic
      const experienceMatch = activeFilterId === 'exp' ? (doctor.experience || 0) >= 10 : true;

      return nameMatch && specialtyMatch && locationMatch && genderMatch && experienceMatch;
    });
  }, [doctors, searchTerm, selectedSpecialty, selectedLocation, activeFilterId]);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedSpecialty, selectedLocation, activeFilterId]);

  const pageCount = Math.ceil(filteredDoctors.length / doctorsPerPage);
  const paginatedDoctors = filteredDoctors.slice((currentPage - 1) * doctorsPerPage, currentPage * doctorsPerPage);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <AppHeader />
      <main className="flex-grow">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="text-center space-y-3">
                <h1 className="text-4xl md:text-5xl font-bold font-headline text-slate-900 tracking-tight">Clinical Record</h1>
                <p className="text-muted-foreground text-sm max-w-lg mx-auto font-medium">Search and book verified healthcare professionals instantly.</p>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar">
                {filterPills.map((pill) => (
                    <button 
                        key={pill.id} 
                        onClick={() => handlePillClick(pill.id)}
                        className={cn(
                            "h-10 px-6 rounded-full border-2 whitespace-nowrap text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-all shadow-sm",
                            activeFilterId === pill.id 
                                ? "bg-primary border-primary text-white" 
                                : "bg-white border-slate-100 text-slate-600 hover:border-primary/30 hover:bg-primary/5"
                        )}
                    >
                        <pill.icon className={cn("h-3 w-3", activeFilterId === pill.id ? "text-white" : "text-slate-400")} />
                        {pill.label}
                    </button>
                ))}
            </div>

            <div className="p-2 bg-white rounded-[2rem] shadow-2xl shadow-slate-200/50 border-4 border-white">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                    <div className="md:col-span-6 relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder="Search by doctor name..."
                            className="pl-12 h-14 border-none bg-slate-50 rounded-2xl font-medium focus-visible:ring-0"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="md:col-span-3">
                        <Select onValueChange={setSelectedSpecialty} value={selectedSpecialty}>
                            <SelectTrigger className="h-14 border-none bg-slate-50 rounded-2xl font-bold text-xs">
                                <SelectValue placeholder="Specialty" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-none shadow-2xl">
                                <SelectItem value="all" className="font-bold">All Specialties</SelectItem>
                                {specialties.map(specialty => (
                                    <SelectItem key={specialty} value={specialty} className="font-medium">{specialty}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="md:col-span-3">
                        <Select onValueChange={setSelectedLocation} value={selectedLocation}>
                            <SelectTrigger className="h-14 border-none bg-slate-50 rounded-2xl font-bold text-xs">
                                <SelectValue placeholder="City" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-none shadow-2xl">
                                <SelectItem value="all" className="font-bold">All Cities</SelectItem>
                                {locations.map(loc => (
                                    <SelectItem key={loc} value={loc} className="font-medium">{loc}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {isLoadingDoctors ? (
                Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i} className="rounded-[2rem] overflow-hidden border-none shadow-md bg-white p-6 space-y-6">
                        <div className="flex gap-4">
                            <Skeleton className="h-24 w-24 rounded-full shrink-0" />
                            <div className="flex-1 space-y-3"><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-1/3" /></div>
                        </div>
                        <Skeleton className="h-12 w-full rounded-xl" />
                        <div className="flex gap-3"><Skeleton className="h-12 flex-1 rounded-xl" /><Skeleton className="h-12 flex-1 rounded-xl" /></div>
                    </Card>
                ))
            ) : filteredDoctors.length > 0 ? (
              paginatedDoctors.map(doctor => (
                <DoctorCard key={doctor.id} doctor={doctor} variant="default" />
              ))
            ) : (
              <div className="col-span-full text-center py-32 bg-white rounded-[3rem] border-4 border-dashed border-slate-100">
                <AlertCircle className="h-16 w-16 mx-auto mb-4 text-slate-200" />
                <h3 className="text-xl font-bold text-slate-900">No record matches found</h3>
                <p className="text-muted-foreground text-sm mt-1">Adjust your search parameters or filters.</p>
              </div>
            )}
          </div>

          {pageCount > 1 && (
            <div className="mt-16 flex justify-center items-center gap-6">
                <Button variant="outline" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1} className="rounded-2xl font-bold h-12 px-8 border-2 bg-white hover:bg-slate-50">Previous</Button>
                <span className="text-xs font-bold bg-white px-6 py-2.5 rounded-full shadow-inner text-slate-500 uppercase tracking-widest border-2">
                    {currentPage} / {pageCount}
                </span>
                <Button variant="outline" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === pageCount} className="rounded-2xl font-bold h-12 px-8 border-2 bg-white hover:bg-slate-50">Next</Button>
            </div>
          )}
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
