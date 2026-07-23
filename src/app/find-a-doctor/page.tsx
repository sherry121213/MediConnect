'use client';

import { useState, useMemo, useEffect } from 'react';
import AppHeader from '@/components/layout/header';
import AppFooter from '@/components/layout/footer';
import DoctorCard from '@/components/doctor-card';
import { specialties } from '@/lib/data';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, MapPin, Loader2, X, AlertCircle, Filter, Users, Star, Clock, User, Calendar as CalendarIcon, BriefcaseMedical } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Doctor } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfDay, isSameDay } from 'date-fns';

const locations = ["Islamabad", "Rawalpindi", "Lahore", "Karachi", "Peshawar", "Faisalabad", "Multan", "Quetta"];

const filterPills = [
    { id: 'female', label: "Female Doctors", icon: User },
    { id: 'near', label: "Doctors Near Me", icon: MapPin },
    { id: 'exp', label: "Most Experienced", icon: BriefcaseMedical }, // Changed from Star to clarify practice vs reviews
];

export default function FindADoctorPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [detectedCity, setDetectedCity] = useState<string | null>(null);
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

  const leavesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
        collection(firestore, 'doctorUnavailabilityRequests'),
        where('status', '==', 'approved')
    );
  }, [firestore]);

  const { data: allLeaves } = useCollection<any>(leavesQuery);

  const handlePillClick = (filterId: string) => {
      if (activeFilterId === filterId) {
          setActiveFilterId(null);
          if (filterId === 'near') setDetectedCity(null);
      } else {
          setActiveFilterId(filterId);
          if (filterId === 'near') {
              handleLocationClick();
          }
      }
  };

  const handleLocationClick = () => {
    setIsLocating(true);
    
    const matchCity = (cityName: string | undefined) => {
        if (!cityName) return null;
        return locations.find(loc => cityName.toLowerCase().includes(loc.toLowerCase()));
    };

    const fetchIPFallback = async () => {
        try {
            const res = await fetch('https://ipapi.co/json/');
            const data = await res.json();
            const matched = matchCity(data.city);
            if (matched) {
                setDetectedCity(matched);
                setSelectedLocation('all');
                toast({ title: `Location Detected (IP): ${matched}`, description: "Filtered by your region." });
            } else {
                toast({ title: "Global Location", description: `You are in ${data.city || 'a new area'}. Showing all records.` });
                setDetectedCity(null);
                setActiveFilterId(null);
            }
        } catch (e) {
            toast({ variant: "destructive", title: "Detection Failed", description: "Could not resolve global location." });
            setActiveFilterId(null);
        } finally {
            setIsLocating(false);
        }
    };

    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`);
                    const data = await response.json();
                    const addr = data.address;
                    const cityValue = addr.city || addr.town || addr.village || addr.county || addr.state;
                    const matched = matchCity(cityValue);
                    
                    if (matched) {
                         setDetectedCity(matched);
                         setSelectedLocation('all');
                         toast({ title: `Location Detected: ${matched}`, description: "Clinical record filtered for your area." });
                    } else {
                        await fetchIPFallback();
                    }
                } catch (error) {
                    await fetchIPFallback();
                } finally {
                    setIsLocating(false);
                }
            },
            async () => {
                await fetchIPFallback();
            },
            { timeout: 8000 }
        );
    } else {
        fetchIPFallback();
    }
  };

  const filteredDoctors = useMemo(() => {
    if (!doctors) return [];
    return doctors.filter(doctor => {
      const isActive = doctor.isActive !== false;
      if (!isActive) return false;
      
      // UNAVAILABILITY CHECK FOR SELECTED DATE
      if (allLeaves && selectedDate) {
          const isUnavailable = allLeaves.some(leave => {
              if (leave.doctorId !== doctor.id) return false;
              const start = startOfDay(new Date(leave.startDate || leave.requestedDate));
              const end = startOfDay(new Date(leave.endDate || leave.startDate || leave.requestedDate));
              const current = startOfDay(selectedDate);
              return current >= start && current <= end;
          });
          if (isUnavailable) return false;
      }

      const nameMatch = `${doctor.firstName} ${doctor.lastName}`.toLowerCase().includes(searchTerm.toLowerCase());
      const specialtyMatch = selectedSpecialty === 'all' || doctor.specialty === selectedSpecialty;
      
      let locationMatch = true;
      if (activeFilterId === 'near' && detectedCity) {
          locationMatch = doctor.location === detectedCity;
      } else {
          locationMatch = selectedLocation === 'all' || doctor.location === selectedLocation;
      }
      
      // Most Experienced filter: based on verified practice years (> 4 years)
      const experienceMatch = activeFilterId === 'exp' ? (Number(doctor.experience) || 0) > 4 : true;
      const genderMatch = activeFilterId === 'female' ? doctor.gender === 'female' : true;

      return nameMatch && specialtyMatch && locationMatch && experienceMatch && genderMatch;
    });
  }, [doctors, allLeaves, searchTerm, selectedSpecialty, selectedLocation, selectedDate, activeFilterId, detectedCity]);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedSpecialty, selectedLocation, selectedDate, activeFilterId]);

  const pageCount = Math.ceil(filteredDoctors.length / doctorsPerPage);
  const paginatedDoctors = filteredDoctors.slice((currentPage - 1) * doctorsPerPage, currentPage * doctorsPerPage);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 overflow-x-hidden w-full">
      <AppHeader />
      <main className="flex-grow w-full max-w-[100vw]">
        <div className="container mx-auto px-4 py-8 md:py-12">
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="text-center space-y-3">
                <h1 className="text-4xl md:text-5xl font-bold font-headline text-slate-900 tracking-tight">Clinical Record</h1>
                <p className="text-muted-foreground text-sm max-w-lg mx-auto font-medium">Search and book verified healthcare professionals instantly.</p>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 no-scrollbar custom-scrollbar">
                {filterPills.map((pill) => (
                    <button 
                        key={pill.id} 
                        onClick={() => handlePillClick(pill.id)}
                        disabled={pill.id === 'near' && isLocating}
                        className={cn(
                            "h-10 px-6 rounded-full border-2 whitespace-nowrap text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-all shadow-sm shrink-0",
                            activeFilterId === pill.id 
                                ? "bg-primary border-primary text-white" 
                                : "bg-white border-slate-100 text-slate-600 hover:border-primary/30 hover:bg-primary/5"
                        )}
                    >
                        {pill.id === 'near' && isLocating ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                            <pill.icon className={cn("h-3 w-3", activeFilterId === pill.id ? "text-white" : "text-slate-400")} />
                        )}
                        {pill.label}
                    </button>
                ))}
            </div>

            <div className="p-2 bg-white rounded-[2rem] shadow-2xl shadow-slate-200/50 border-4 border-white">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                    <div className="md:col-span-5 relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder="Search doctor..."
                            className="pl-12 h-14 border-none bg-slate-50 rounded-2xl font-medium focus-visible:ring-0"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="md:col-span-3">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" className="w-full h-14 border-none bg-slate-50 rounded-2xl font-bold text-xs justify-start px-4">
                                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                                    {isSameDay(selectedDate, new Date()) ? 'Today' : format(selectedDate, "MMM dd, yyyy")}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl" align="start">
                                <Calendar
                                    mode="single"
                                    selected={selectedDate}
                                    onSelect={(date) => date && setSelectedDate(date)}
                                    disabled={(date) => date < startOfDay(new Date())}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="md:col-span-2">
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
                    <div className="md:col-span-2">
                        <Select 
                            onValueChange={(val) => {
                                setSelectedLocation(val);
                                if (activeFilterId === 'near') {
                                    setActiveFilterId(null);
                                    setDetectedCity(null);
                                }
                            }} 
                            value={activeFilterId === 'near' && detectedCity ? detectedCity : selectedLocation}
                        >
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
                <h3 className="text-xl font-bold text-slate-900">No available professionals</h3>
                <p className="text-muted-foreground text-sm mt-1 px-8">Try searching for a different date or clinical hub.</p>
              </div>
            )}
          </div>

          {pageCount > 1 && (
            <div className="mt-16 flex justify-center items-center gap-6 pb-12">
                <Button variant="outline" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1} className="rounded-2xl font-bold h-12 px-8 border-2 bg-white hover:bg-slate-50 shadow-sm">Previous</Button>
                <span className="text-xs font-bold bg-white px-6 py-2.5 rounded-full shadow-inner text-slate-500 uppercase tracking-widest border-2">
                    {currentPage} / {pageCount}
                </span>
                <Button variant="outline" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === pageCount} className="rounded-2xl font-bold h-12 px-8 border-2 bg-white hover:bg-slate-50 shadow-sm">Next</Button>
            </div>
          )}
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
