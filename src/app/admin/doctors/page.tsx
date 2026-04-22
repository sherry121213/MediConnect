
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
import { MoreHorizontal, PlusCircle, UserX, UserCheck } from "lucide-react";
import Image from "next/image";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import type { Doctor } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { PlaceHolderImages as placeholderImages } from "@/lib/placeholder-images";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import Link from "next/link";

const addDoctorSchema = z.object({
  firstName: z.string().min(2, { message: "First name must be at least 2 characters." }),
  lastName: z.string().min(2, { message: "Last name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email." }),
  specialty: z.string().min(2, { message: "Specialty is required." }),
  location: z.string().min(2, { message: "Location is required." }),
});

type AddDoctorFormValues = z.infer<typeof addDoctorSchema>;

export default function AdminDoctorsPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const doctorsCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'doctors');
    }, [firestore]);

    const { data: doctors, isLoading: isLoadingDoctors, error } = useCollection<Doctor>(doctorsCollection);

    const form = useForm<AddDoctorFormValues>({
        resolver: zodResolver(addDoctorSchema),
        defaultValues: {
            firstName: "",
            lastName: "",
            email: "",
            specialty: "",
            location: "",
        },
    });

    async function onSubmit(values: AddDoctorFormValues) {
        if (!firestore) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Firestore is not available.",
            });
            return;
        }

        const newDoctorData: Omit<Doctor, 'id'> = {
            firstName: values.firstName,
            lastName: values.lastName,
            email: values.email,
            specialty: values.specialty,
            location: values.location,
            verified: false,
            isActive: true, // Default to active
            rating: 0,
            reviews: 0,
            profileImageId: 'doctor' + (Math.floor(Math.random() * 8) + 1),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const doctorsCollectionRef = collection(firestore, 'doctors');
        addDocumentNonBlocking(doctorsCollectionRef, newDoctorData);

        toast({
            title: "Doctor Added",
            description: `Dr. ${values.firstName} has been successfully added.`,
        });
        form.reset();
        setIsDialogOpen(false);
    }

    const handleVerifyDoctor = async (doctorId: string) => {
        if (!firestore) return;
        const doctorDocRef = doc(firestore, 'doctors', doctorId);
        // Once verified by admin, we also mark profile as complete so they can access the portal immediately
        updateDocumentNonBlocking(doctorDocRef, { 
            verified: true, 
            profileComplete: true, 
            updatedAt: new Date().toISOString() 
        });

        // Also update the patients collection which is the source of truth for user data and portal routing
        const patientDocRef = doc(firestore, 'patients', doctorId);
        updateDocumentNonBlocking(patientDocRef, {
            profileComplete: true,
            updatedAt: new Date().toISOString()
        });

        toast({
            title: "Doctor Verified",
            description: "The doctor has been verified and can now access their portal.",
        });
    }

    const handleToggleDoctorStatus = async (doctorId: string, currentStatus: boolean) => {
        if (!firestore) return;
        const doctorDocRef = doc(firestore, 'doctors', doctorId);
        const nextStatus = !currentStatus;
        updateDocumentNonBlocking(doctorDocRef, { isActive: nextStatus, updatedAt: new Date().toISOString() });
        toast({
            title: nextStatus ? "Doctor Enabled" : "Doctor Disabled",
            description: `The doctor's account has been ${nextStatus ? "enabled" : "disabled"}.`,
        });
    };

    return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold font-headline">Manage Doctors</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Doctor
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Doctor</DialogTitle>
              <DialogDescription>
                Fill in the details below to add a new doctor profile.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="firstName"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>First Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="Amina" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="lastName"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Last Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="Khan" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                                <Input placeholder="amina.khan@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="specialty"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Specialty</FormLabel>
                            <FormControl>
                                <Input placeholder="Cardiology" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="location"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Location</FormLabel>
                            <FormControl>
                                <Input placeholder="Karachi" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting ? "Adding..." : "Add Doctor"}
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="border rounded-lg">
         <AlertDialog>
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead>Doctor</TableHead>
                <TableHead>Specialty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Location</TableHead>
                <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoadingDoctors && Array.from({length: 5}).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><Skeleton className="h-10 w-48"/></TableCell>
                        <TableCell><Skeleton className="h-6 w-24"/></TableCell>
                        <TableCell><Skeleton className="h-6 w-20"/></TableCell>
                        <TableCell className="hidden md:table-cell"><Skeleton className="h-6 w-24"/></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto"/></TableCell>
                    </TableRow>
                ))}
                {doctors && doctors.map((doctor: Doctor) => {
                const doctorImage = placeholderImages.find(p => p.id === doctor.profileImageId);
                const name = `${doctor.firstName} ${doctor.lastName}`;
                const isActive = doctor.isActive !== false; // Handle undefined as active

                return (
                <TableRow key={doctor.id} className={!isActive ? "opacity-60 bg-muted/30" : ""}>
                    <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                        {doctorImage && (
                            <Image
                                src={doctorImage.imageUrl}
                                alt={name}
                                width={40}
                                height={40}
                                className="rounded-full"
                                data-ai-hint={doctorImage.imageHint}
                            />
                        )}
                        <span className="truncate">{name}</span>
                    </div>
                    </TableCell>
                    <TableCell>{doctor.specialty}</TableCell>
                    <TableCell>
                        <div className="flex flex-col gap-1">
                            <Badge variant={doctor.verified ? "secondary" : "destructive"} className={doctor.verified ? "bg-green-100 text-green-800" : ""}>
                                {doctor.verified ? "Verified" : "Pending"}
                            </Badge>
                            {!isActive && (
                                <Badge variant="outline" className="border-destructive text-destructive">
                                    Disabled
                                </Badge>
                            )}
                        </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{doctor.location}</TableCell>
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
                        {doctor.verified === false && <DropdownMenuItem onClick={() => handleVerifyDoctor(doctor.id)}>Verify</DropdownMenuItem>}
                        <DropdownMenuItem asChild>
                           <Link href={`/admin/doctors/${doctor.id}`}>View Profile</Link>
                        </DropdownMenuItem>
                        
                        <AlertDialogTrigger asChild>
                            <DropdownMenuItem className={isActive ? "text-destructive" : "text-primary"} onSelect={(e) => e.preventDefault()}>
                                {isActive ? "Disable Account" : "Enable Account"}
                            </DropdownMenuItem>
                        </AlertDialogTrigger>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{isActive ? "Disable Doctor Account?" : "Enable Doctor Account?"}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {isActive 
                                    ? "Disabling this account will prevent the doctor from logging in, accessing their portal, and being visible to patients."
                                    : "Enabling this account will restore access for the doctor and make them visible to patients again."}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                                onClick={() => handleToggleDoctorStatus(doctor.id, isActive)} 
                                className={isActive ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90"}
                            >
                                {isActive ? "Disable" : "Enable"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                    </TableCell>
                </TableRow>
                )})}
                {!isLoadingDoctors && doctors?.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={5} className="text-center h-24">No doctors found.</TableCell>
                    </TableRow>
                )}
                {error && (
                    <TableRow>
                        <TableCell colSpan={5} className="text-center h-24 text-destructive">
                            Error loading doctors: {error.message}
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
            </Table>
        </AlertDialog>
      </div>
    </div>
  );
}
