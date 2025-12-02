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
import { collection, query, addDoc } from "firebase/firestore";
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
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";

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
        return query(collection(firestore, 'doctors'));
    }, [firestore]);

    const { data: doctors, isLoading: isLoadingDoctors } = useCollection<Doctor>(doctorsCollection);

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

        try {
            const doctorsCollectionRef = collection(firestore, 'doctors');
            // This now uses the non-blocking update
            await addDoc(doctorsCollectionRef, {
                ...values,
                verified: false,
                rating: 0,
                reviews: 0,
                profileImageId: 'doctor' + (Math.floor(Math.random() * 8) + 1),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });

            toast({
                title: "Doctor Added",
                description: `Dr. ${values.firstName} ${values.lastName} has been successfully added.`,
            });
            form.reset();
            setIsDialogOpen(false);
        } catch (error) {
            console.error("Error adding document: ", error);
            toast({
                variant: "destructive",
                title: "Uh oh! Something went wrong.",
                description: "There was a problem with your request.",
            });
        }
    }


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
            {doctors && doctors.map((doctor: any) => {
              const doctorImage = placeholderImages.find(p => p.id === 'doctor1');
              const name = doctor.name || `${doctor.firstName} ${doctor.lastName}`;
              return (
              <TableRow key={doctor.id}>
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
                    {name}
                  </div>
                </TableCell>
                <TableCell>{doctor.specialty}</TableCell>
                <TableCell>
                   <Badge variant={doctor.verified ? "secondary" : "destructive"} className={doctor.verified ? "bg-green-100 text-green-800" : ""}>
                    {doctor.verified ? "Verified" : "Pending"}
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
                      {!doctor.verified && <DropdownMenuItem>Verify Document</DropdownMenuItem>}
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
