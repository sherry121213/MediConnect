import Image from 'next/image';
import type { Doctor } from '@/lib/types';
import { PlaceHolderImages as placeholderImages } from '@/lib/placeholder-images';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, MapPin, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

interface DoctorCardProps {
  doctor: Doctor;
}

export default function DoctorCard({ doctor }: DoctorCardProps) {
  const doctorImage = placeholderImages.find(p => p.id === doctor.profileImageId);

  return (
    <Card className="flex flex-col h-full overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
      <CardHeader className="p-0">
        <div className="relative h-48 w-full">
          {doctorImage && (
            <Image
              src={doctorImage.imageUrl}
              alt={doctor.name}
              fill
              className="object-cover"
              data-ai-hint={doctorImage.imageHint}
            />
          )}
          {doctor.isVerified && (
            <Badge variant="secondary" className="absolute top-2 right-2 bg-green-100 text-green-800 border-green-300">
              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
              Verified
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 flex-grow">
        <h3 className="text-lg font-bold font-headline">{doctor.name}</h3>
        <p className="text-sm text-primary font-medium">{doctor.specialty}</p>
        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
          <MapPin className="w-4 h-4" />
          <span>{doctor.location}</span>
        </div>
        <div className="flex items-center gap-1 text-sm mt-1">
          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
          <span className="font-bold">{doctor.rating}</span>
          <span className="text-muted-foreground">({doctor.reviews} reviews)</span>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Button className="w-full" asChild>
            <Link href="#">Book Appointment</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
