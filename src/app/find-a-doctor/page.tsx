
'use client';

import { useState, useMemo, useEffect } from 'react';
import AppHeader from '@/components/layout/header';
import AppFooter from '@/components/layout/footer';
import DoctorCard from '@/components/doctor-card';
import { specialties } from '@/lib/data';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, MapPin, Loader2, X, AlertCircle } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Doctor } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const locations = ["Islamabad", "Rawalpindi", "Lahore", "Karachi", "Peshawar", "Faisalabad", "Multan", "Quetta"];

export default function FindADoctorPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [isLocating, setIsLocating] = useState(false);
  const [showLocationBanner, setShowLocationBanner] = useState(true);
  const firestore = useFirestore();
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const doctorsPerPage = 8;

  const doctorsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    // Base visibility filter
    return query(
        collection(firestore, 'doctors'),
        where('verified', '==', true),
        where('profileComplete', '==', true)
    );
  }, [firestore]);

  const { data: doctors, isLoading: isLoadingDoctors, error } = useCollection<Doctor>(doctorsQuery);

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
                 setShowLocationBanner(false);
                 toast({ title: `Location Detected: ${matchedCity}` });
            } else {
                toast({
                    title: "Location Note",
                    description: `We detected ${city}, which is currently outside our primary coverage. Please select a hub city manually.`,
                });
            }
        } catch (error) {
            toast({ variant: "destructive", title: "Location Error", description: "Could not fetch city details." });
        } finally {
            setIsLocating(false);
        }
      },
      () => {
        toast({ variant: "destructive", title: "Access Denied", description: "Please enable location permissions in your browser." });
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
      return nameMatch && specialtyMatch && locationMatch;
    });
  }, [doctors, searchTerm, selectedSpecialty, selectedLocation]);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedSpecialty, selectedLocation]);

  const pageCount = Math.ceil(filteredDoctors.length / doctorsPerPage);
  const paginatedDoctors = filteredDoctors.slice((currentPage - 1) * doctorsPerPage, currentPage * doctorsPerPage);

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-grow bg-secondary/10">
        <div className="container mx-auto px-4 py-12">
          <div className="text-center space-y-4 mb-12">
            <h1 className="text-4xl md:text-5xl font-bold font-headline">Find Your Specialist</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Search our directory of verified healthcare professionals for an encrypted 30-minute clinical consultation.
            </p>
          </div>

        {showLocationBanner && (
             <div className="max-w-4xl mx-auto bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center justify-between mb-8 animate-in slide-in-from-top-4">
                <div className='flex items-center gap-3'>
                    <div className="bg-primary/20 p-2 rounded-full"><MapPin className="h-5 w-5 text-primary" /></div>
                    <p className="text-sm font-bold text-primary-dark">Find doctors in your immediate vicinity.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button size="sm" onClick={handleLocationClick} disabled={isLocating} className="font-bold">
                        {isLocating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Detect City
                    </Button>
                     <Button size="sm" variant="ghost" onClick={() => setShowLocationBanner(false)} className="text-muted-foreground hover:text-primary">
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        )}

          <div className="p-4 bg-white rounded-3xl shadow-xl max-w-4xl mx-auto border-2 border-primary/5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Doctor's name..."
                  className="pl-10 h-11 border-none bg-secondary/30 rounded-xl"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              <Select onValueChange={setSelectedSpecialty} value={selectedSpecialty}>
                <SelectTrigger className="h-11 border-none bg-secondary/30 rounded-xl">
                  <SelectValue placeholder="Specialty" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">All Specialties</SelectItem>
                  {specialties.map(specialty => (
                    <SelectItem key={specialty} value={specialty}>{specialty}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
               <Select onValueChange={setSelectedLocation} value={selectedLocation}>
                <SelectTrigger className="h-11 border-none bg-secondary/30 rounded-xl">
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">All Hub Cities</SelectItem>
                   {locations.map(loc => (
                    <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {isLoadingDoctors ? (
                Array.from({ length: 8 }).map((_, i) => (
                    <Card key={i} className="rounded-2xl overflow-hidden border-none shadow-sm">
                        <Skeleton className="h-48 w-full" />
                        <CardContent className="p-4 space-y-3"><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-1/2" /></CardContent>
                    </Card>
                ))
            ) : filteredDoctors.length > 0 ? (
              paginatedDoctors.map(doctor => (
                <DoctorCard key={doctor.id} doctor={doctor} variant="default" />
              ))
            ) : (
              <div className="col-span-full text-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-primary/10">
                <AlertCircle className="h-16 w-16 mx-auto mb-4 opacity-10" />
                <h3 className="text-xl font-bold tracking-tight">No providers found</h3>
                <p className="text-muted-foreground mt-1">Adjust your hub city or specialty filters.</p>
              </div>
            )}
          </div>

          {pageCount > 1 && (
            <div className="mt-16 flex justify-center items-center gap-6">
                <Button variant="outline" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1} className="rounded-xl font-bold h-11 px-6 border-2 transition-all">Previous</Button>
                <span className="text-sm font-bold bg-white px-4 py-2 rounded-full shadow-sm">
                    Page {currentPage} / {pageCount}
                </span>
                <Button variant="outline" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === pageCount} className="rounded-xl font-bold h-11 px-6 border-2 transition-all">Next</Button>
            </div>
          )}
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
