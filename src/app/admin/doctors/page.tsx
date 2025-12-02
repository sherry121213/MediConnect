'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, PlusCircle } from "lucide-react";
import Image from "next/image";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query } from "firebase/firestore";
import type { Doctor } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { PlaceHolderImages as placeholderImages } from "@/lib/placeholder-images";


export default function AdminDoctorsPage() {
    const firestore = useFirestore();

    const doctorsCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'doctors'));
    }, [firestore]);

    const { data: doctors, isLoading: isLoadingDoctors } = useCollection<Doctor>(doctorsCollection);

    return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold font-headline">Manage Doctors</h1>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Doctor
        </Button>
      </div>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Doctor</TableHead>
              <TableHead>Specialty</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingDoctors && Array.from({length: 5}).map((_, i) => (
                <TableRow key={i}>
                    <TableCell><Skeleton className="h-10 w-48"/></TableCell>
                    <TableCell><Skeleton className="h-6 w-24"/></TableCell>
                    <TableCell><Skeleton className="h-6 w-20"/></TableCell>
                    <TableCell><Skeleton className="h-6 w-24"/></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto"/></TableCell>
                </TableRow>
            ))}
            {doctors && doctors.map((doctor) => {
              const doctorImage = placeholderImages.find(p => p.id === doctor.profileImageId);
              return (
              <TableRow key={doctor.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    {doctorImage && (
                        <Image
                            src={doctorImage.imageUrl}
                            alt={doctor.name}
                            width={40}
                            height={40}
                            className="rounded-full"
                            data-ai-hint={doctorImage.imageHint}
                        />
                    )}
                    {doctor.name}
                  </div>
                </TableCell>
                <TableCell>{doctor.specialty}</TableCell>
                <TableCell>
                  <Badge variant={doctor.isVerified ? "secondary" : "destructive"} className={doctor.isVerified ? "bg-green-100 text-green-800" : ""}>
                    {doctor.isVerified ? "Verified" : "Pending"}
                  </Badge>
                </TableCell>
                <TableCell>{doctor.location}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      {!doctor.isVerified && <DropdownMenuItem>Verify Document</DropdownMenuItem>}
                      <DropdownMenuItem>Edit</DropdownMenuItem>
                      <DropdownMenuItem>View Profile</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )})}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
