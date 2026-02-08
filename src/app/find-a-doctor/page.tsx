'use client';

import { useState, useMemo, useEffect } from 'react';
import AppHeader from '@/components/layout/header';
import AppFooter from '@/components/layout/footer';
import DoctorCard from '@/components/doctor-card';
import { specialties } from '@/lib/data';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, MapPin, Loader2, X } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Doctor } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

// A list of major cities in Pakistan for the dropdown.
const locations = ["Islamabad", "Rawalpindi", "Lahore", "Karachi", "Peshawar"];

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
    return query(collection(firestore, 'doctors'), where('verified', '==', true));
  }, [firestore]);

  const { data: doctors, isLoading: isLoadingDoctors, error } = useCollection<Doctor>(doctorsQuery);

  const handleLocationClick = () => {
    setIsLocating(true);
    setShowLocationBanner(false);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
            // Using a reverse geocoding service to get city from coordinates.
            // NOTE: This is a free, public API. For production, a paid, robust service is recommended.
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`);
            const data = await response.json();
            const city = data.address.city || data.address.town || data.address.village;
            if (city && locations.includes(city)) {
                 setSelectedLocation(city);
            } else {
                toast({
                    title: "Location Not Supported",
                    description: "We couldn't automatically detect you in a supported city. Please select one manually.",
                });
            }
        } catch (error) {
            console.error("Error fetching city:", error);
            toast({
                variant: "destructive",
                title: "Could Not Determine Location",
                description: "There was an issue fetching your city. Please select one manually.",
            });
        } finally {
            setIsLocating(false);
        }
      },
      (geoError) => {
        console.error("Geolocation error:", geoError);
        toast({
            variant: "destructive",
            title: "Location Access Denied",
            description: "Please enable it in your browser settings or search manually.",
        });
        setIsLocating(false);
      },
      { enableHighAccuracy: true }
    );
  };


  const filteredDoctors = useMemo(() => {
    if (!doctors) return [];
    return doctors.filter(doctor => {
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
  const paginatedDoctors = useMemo(() => {
      return filteredDoctors.slice(
        (currentPage - 1) * doctorsPerPage,
        currentPage * doctorsPerPage
      );
  }, [filteredDoctors, currentPage, doctorsPerPage]);

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-grow bg-background">
        <div className="container mx-auto px-4 py-12">
          <h1 className="text-4xl font-bold font-headline text-center">Find Your Specialist</h1>
          <p className="text-muted-foreground text-center mt-2 max-w-2xl mx-auto">
            Search our directory of verified healthcare professionals to find the right one for you.
          </p>

        {showLocationBanner && (
             <div className="mt-8 max-w-4xl mx-auto bg-primary/10 border border-primary/20 rounded-lg p-4 flex items-center justify-between">
                <div className='flex items-center'>
                    <MapPin className="h-6 w-6 text-primary mr-3" />
                    <p className="text-sm font-medium text-primary-dark">Enable location services to find doctors near you.</p>
                </div>
                <div>
                    <Button size="sm" onClick={handleLocationClick} disabled={isLocating}>
                        {isLocating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enable"}
                    </Button>
                     <Button size="sm" variant="ghost" onClick={() => setShowLocationBanner(false)} className="ml-2">
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        )}

          <div className="mt-8 p-4 bg-card rounded-lg shadow-md max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative md:col-span-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search by doctor's name..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              <Select onValueChange={setSelectedSpecialty} defaultValue="all">
                <SelectTrigger>
                  <SelectValue placeholder="Filter by specialty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Specialties</SelectItem>
                  {specialties.map(specialty => (
                    <SelectItem key={specialty} value={specialty}>
                      {specialty}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
               <Select onValueChange={setSelectedLocation} value={selectedLocation}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                   {locations.map(loc => (
                    <SelectItem key={loc} value={loc}>
                      {loc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {isLoadingDoctors && Array.from({ length: 8 }).map((_, i) => (
                <Card key={i}>
                    <CardContent className="p-0">
                        <Skeleton className="h-48 w-full" />
                    </CardContent>
                    <CardContent className="p-4 space-y-2">
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-4 w-1/3" />
                    </CardContent>
                    <CardFooter className="p-4">
                        <Skeleton className="h-10 w-full" />
                    </CardFooter>
                </Card>
            ))}
            {!isLoadingDoctors && filteredDoctors.length > 0 ? (
              paginatedDoctors.map(doctor => (
                <DoctorCard key={doctor.id} doctor={doctor} />
              ))
            ) : null}
             {!isLoadingDoctors && !error && filteredDoctors.length === 0 && (
              <div className="col-span-full text-center py-16">
                <h3 className="text-xl font-medium">No doctors found</h3>
                <p className="text-muted-foreground mt-2">Try adjusting your search or filters.</p>
              </div>
            )}
             {error && (
                <div className="col-span-full text-center py-16 text-destructive">
                    <h3 className="text-xl font-medium">Error loading doctors</h3>
                    <p className="text-muted-foreground mt-2">{error.message}</p>
                </div>
            )}
          </div>
          {pageCount > 1 && (
            <div className="mt-12 flex justify-center items-center gap-4">
                <Button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>
                    Previous
                </Button>
                <span className="text-muted-foreground">
                    Page {currentPage} of {pageCount}
                </span>
                <Button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === pageCount}>
                    Next
                </Button>
            </div>
          )}
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
