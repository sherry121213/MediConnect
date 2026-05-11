
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
import { MoreHorizontal, PlusCircle, Stethoscope, ShieldCheck, UserX, UserCheck, Eye, Trash2 } from "lucide-react";
import Image from "next/image";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc, deleteDoc } from "firebase/firestore";
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
import { cn } from "@/lib/utils";

const addDoctorSchema = z.object({
  firstName: z.string().min(2, { message: "First name is required." }),
  lastName: z.string().min(2, { message: "Last name is required." }),
  email: z.string().email({ message: "Invalid email." }),
  specialty: z.string().min(2, { message: "Specialty required." }),
  location: z.string().min(2, { message: "Location required." }),
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

    const { data: doctors, isLoading: isLoadingDoctors } = useCollection<Doctor>(doctorsCollection);

    const form = useForm<AddDoctorFormValues>({
        resolver: zodResolver(addDoctorSchema),
        defaultValues: { firstName: "", lastName: "", email: "", specialty: "", location: "" },
    });

    async function onSubmit(values: AddDoctorFormValues) {
        if (!firestore) return;
        const newDoctorData: Omit<Doctor, 'id'> = {
            ...values,
            verified: false,
            isActive: true, 
            rating: 0,
            reviews: 0,
            profileImageId: 'doctor' + (Math.floor(Math.random() * 8) + 1),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        addDocumentNonBlocking(collection(firestore, 'doctors'), newDoctorData);
        toast({ title: "Doctor Record Created", description: `Draft profile for Dr. ${values.firstName} initialized.` });
        form.reset();
        setIsDialogOpen(false);
    }

    const handleVerifyDoctor = (doctorId: string) => {
        if (!firestore) return;
        updateDocumentNonBlocking(doc(firestore, 'doctors', doctorId), { verified: true, profileComplete: true, updatedAt: new Date().toISOString() });
        updateDocumentNonBlocking(doc(firestore, 'patients', doctorId), { verified: true, profileComplete: true, updatedAt: new Date().toISOString() });
        toast({ title: "Verification Approved", description: "The doctor now has full platform access." });
    }

    const handleToggleDoctorStatus = (doctorId: string, currentStatus: boolean) => {
        if (!firestore) return;
        const nextStatus = !currentStatus;
        updateDocumentNonBlocking(doc(firestore, 'doctors', doctorId), { isActive: nextStatus, updatedAt: new Date().toISOString() });
        updateDocumentNonBlocking(doc(firestore, 'patients', doctorId), { isActive: nextStatus, updatedAt: new Date().toISOString() });
        toast({ title: nextStatus ? "Access Restored" : "Access Suspended" });
    };

    return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Clinical Registry</h1>
            <p className="text-muted-foreground text-sm">Audit professional identities and practice status.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto font-bold shadow-lg shadow-primary/20 text-white rounded-xl h-11">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Provider
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] rounded-[2rem] border-none shadow-2xl">
            <DialogHeader><DialogTitle className="font-headline text-xl">New Doctor Profile</DialogTitle></DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>First Name</FormLabel><FormControl><Input placeholder="Amina" {...field} className="rounded-xl border-2"/></FormControl></FormItem>)} />
                        <FormField control={form.control} name="lastName" render={({ field }) => (<FormItem><FormLabel>Last Name</FormLabel><FormControl><Input placeholder="Khan" {...field} className="rounded-xl border-2"/></FormControl></FormItem>)} />
                    </div>
                    <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="amina@example.com" {...field} className="rounded-xl border-2"/></FormControl></FormItem>)} />
                    <FormField control={form.control} name="specialty" render={({ field }) => (<FormItem><FormLabel>Specialty</FormLabel><FormControl><Input placeholder="Cardiology" {...field} className="rounded-xl border-2"/></FormControl></FormItem>)} />
                    <FormField control={form.control} name="location" render={({ field }) => (<FormItem><FormLabel>Hub City</FormLabel><FormControl><Input placeholder="Karachi" {...field} className="rounded-xl border-2"/></FormControl></FormItem>)} />
                    <DialogFooter className="gap-2 pt-4">
                        <DialogClose asChild><Button type="button" variant="secondary" className="rounded-xl">Cancel</Button></DialogClose>
                        <Button type="submit" className="rounded-xl font-bold text-white shadow-lg shadow-primary/20">Initialize Profile</Button>
                    </DialogFooter>
                </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-[2rem] shadow-2xl bg-white overflow-hidden">
         <AlertDialog>
            <div className="overflow-x-auto custom-scrollbar">
                <Table>
                <TableHeader className="bg-muted/30">
                    <TableRow>
                    <TableHead className="py-6 pl-8 min-w-[220px]">Healthcare Professional</TableHead>
                    <TableHead className="min-w-[150px]">Specialty</TableHead>
                    <TableHead className="min-w-[120px]">Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Hub City</TableHead>
                    <TableHead className="text-right pr-8">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoadingDoctors ? Array.from({length: 5}).map((_, i) => (
                        <TableRow key={i}><TableCell className="pl-8"><Skeleton className="h-10 w-48"/></TableCell><TableCell><Skeleton className="h-6 w-24"/></TableCell><TableCell><Skeleton className="h-6 w-20"/></TableCell><TableCell className="hidden lg:table-cell"><Skeleton className="h-6 w-24"/></TableCell><TableCell className="text-right pr-8"><Skeleton className="h-8 w-8 ml-auto"/></TableCell></TableRow>
                    )) : doctors?.map((doctor) => {
                        const doctorImage = placeholderImages.find(p => p.id === doctor.profileImageId);
                        const name = `Dr. ${doctor.firstName} ${doctor.lastName}`;
                        const isActive = doctor.isActive !== false;
                        return (
                            <TableRow key={doctor.id} className={cn(!isActive && "opacity-50 grayscale bg-muted/5", "hover:bg-muted/5 transition-colors")}>
                                <TableCell className="font-bold py-6 pl-8">
                                    <div className="flex items-center gap-3">
                                        <div className="relative h-10 w-10 shrink-0 shadow-sm rounded-full overflow-hidden bg-primary/5 flex items-center justify-center font-bold text-primary border border-primary/10">
                                            {doctor.photoURL ? <Image src={doctor.photoURL} alt={name} fill className="object-cover" /> : doctor.firstName?.[0]}
                                        </div>
                                        <span className="truncate max-w-[150px] tracking-tight">{name}</span>
                                    </div>
                                </TableCell>
                                <TableCell><Badge variant="outline" className="font-bold text-[9px] uppercase border-primary/20 text-primary bg-primary/5">{doctor.specialty}</Badge></TableCell>
                                <TableCell>
                                    <Badge variant={doctor.verified ? "secondary" : "destructive"} className={cn("text-[9px] uppercase font-bold", doctor.verified ? "bg-green-100 text-green-800 border-green-200" : "")}>
                                        {doctor.verified ? "Verified" : "Pending Audit"}
                                    </Badge>
                                </TableCell>
                                <TableCell className="hidden lg:table-cell text-muted-foreground text-xs font-medium">{doctor.location}</TableCell>
                                <TableCell className="text-right pr-8">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="rounded-xl hover:bg-slate-100"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-56 rounded-2xl border-2 shadow-2xl p-2">
                                            <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Account Operations</DropdownMenuLabel>
                                            {!doctor.verified && (
                                                <DropdownMenuItem onClick={() => handleVerifyDoctor(doctor.id)} className="font-bold text-green-600 focus:text-green-700 rounded-xl cursor-pointer">
                                                    <UserCheck className="mr-2 h-4 w-4" /> Verify Credentials
                                                </DropdownMenuItem>
                                            )}
                                            <DropdownMenuItem asChild className="rounded-xl cursor-pointer">
                                                <Link href={`/admin/doctors/${doctor.id}`}><Eye className="mr-2 h-4 w-4" /> View Clinical File</Link>
                                            </DropdownMenuItem>
                                            <AlertDialogTrigger asChild>
                                                <DropdownMenuItem className={cn("font-bold rounded-xl cursor-pointer", isActive ? "text-destructive" : "text-primary")} onSelect={(e) => e.preventDefault()}>
                                                    {isActive ? <><UserX className="mr-2 h-4 w-4" /> Suspend Practice</> : <><UserCheck className="mr-2 h-4 w-4" /> Restore Practice</>}
                                                </DropdownMenuItem>
                                            </AlertDialogTrigger>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl">
                                        <AlertDialogHeader>
                                            <AlertDialogTitle className="font-headline text-2xl">{isActive ? "Suspend Access?" : "Restore Access?"}</AlertDialogTitle>
                                            <AlertDialogDescription className="text-sm">
                                                {isActive ? "Suspension instantly blocks dashboard access and hides the provider from patient search results." : "Restoration immediately re-enables clinical booking slots for this provider."}
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter className="pt-6">
                                            <AlertDialogCancel className="rounded-xl border-2">Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleToggleDoctorStatus(doctor.id, isActive)} className={cn("rounded-xl font-bold text-white", isActive ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90")}>Confirm</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </TableCell>
                            </TableRow>
                        )
                    })}
                    {!isLoadingDoctors && doctors?.length === 0 && (
                        <TableRow><TableCell colSpan={5} className="text-center py-32 text-muted-foreground italic"><Stethoscope className="h-16 w-16 mx-auto mb-4 opacity-10" />No clinical professionals indexed in registry.</TableCell></TableRow>
                    )}
                </TableBody>
                </Table>
            </div>
         </AlertDialog>
      </div>
    </div>
  );
}
