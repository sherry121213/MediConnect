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
import { MoreHorizontal, PlusCircle, Stethoscope, UserX, UserCheck, Eye, Upload, FileText, Loader2, X } from "lucide-react";
import Image from "next/image";
import { useFirestore, useCollection, useMemoFirebase, useStorage } from "@/firebase";
import { collection, doc, setDoc } from "firebase/firestore";
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import type { Doctor } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
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
import { useState, useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Progress } from "@/components/ui/progress";

const addDoctorSchema = z.object({
  firstName: z.string().min(2, { message: "First name is required." }),
  lastName: z.string().min(2, { message: "Last name is required." }),
  email: z.string().email({ message: "Invalid email." }),
  specialty: z.string().min(2, { message: "Specialty required." }),
  location: z.string().min(2, { message: "Location required." }),
  phone: z.string().min(10, { message: "Valid phone required." }),
  experience: z.coerce.number().min(0),
  medicalSchool: z.string().min(2, { message: "School required." }),
  degree: z.string().min(2, { message: "Degree title required." }),
});

type AddDoctorFormValues = z.infer<typeof addDoctorSchema>;

export default function AdminDoctorsPage() {
    const firestore = useFirestore();
    const storage = useStorage();
    const { toast } = useToast();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const doctorsCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'doctors');
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
            phone: "",
            experience: 0,
            medicalSchool: "",
            degree: ""
        },
    });

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    async function onSubmit(values: AddDoctorFormValues) {
        if (!firestore || !storage) return;
        setIsSubmitting(true);

        try {
            // 1. Initialize Doctor Registry IDs
            const doctorRef = doc(collection(firestore, 'doctors'));
            const doctorId = doctorRef.id;

            // 2. Process Credentials (if any)
            const documentUrls: string[] = [];
            if (selectedFiles.length > 0) {
                for (const file of selectedFiles) {
                    const fileRef = ref(storage, `doctors/${doctorId}/degrees/${Date.now()}_${file.name}`);
                    const uploadResult = await uploadBytes(fileRef, file);
                    const downloadUrl = await getDownloadURL(uploadResult.ref);
                    documentUrls.push(downloadUrl);
                }
            }

            // 3. Construct Unified Professional Profile
            const timestamp = new Date().toISOString();
            const newDoctorData: Doctor = {
                id: doctorId,
                ...values,
                verified: true, // Admin-added doctors are pre-verified
                profileComplete: true,
                isActive: true, 
                rating: 0,
                reviews: 0,
                documents: documentUrls,
                profileImageId: 'doctor' + (Math.floor(Math.random() * 8) + 1),
                createdAt: timestamp,
                updatedAt: timestamp,
            };

            // 4. Force Persistence to both Doctors and Patients collections
            await setDoc(doctorRef, newDoctorData);
            await setDoc(doc(firestore, 'patients', doctorId), {
                id: doctorId,
                firstName: values.firstName,
                lastName: values.lastName,
                email: values.email,
                phone: values.phone,
                role: 'doctor',
                verified: true,
                profileComplete: true,
                createdAt: timestamp,
                updatedAt: timestamp,
            });

            toast({ title: "Clinical Record Created", description: `Full professional profile for Dr. ${values.firstName} has been indexed.` });
            form.reset();
            setSelectedFiles([]);
            setIsDialogOpen(false);
        } catch (error) {
            console.error("Enrollment failed:", error);
            toast({ variant: "destructive", title: "Enrollment Error", description: "Could not finalize doctor registry details." });
        } finally {
            setIsSubmitting(false);
        }
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
        toast({ title: nextStatus ? "Access Restored" : "Profile Disabled" });
    };

    return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Clinical Registry</h1>
            <p className="text-muted-foreground text-sm">Audit professional identities and practice status.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!isSubmitting) setIsDialogOpen(open); }}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto font-bold shadow-lg shadow-primary/20 text-white rounded-xl h-11">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Provider
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px] rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden max-h-[95vh] overflow-y-auto custom-scrollbar">
            <div className="bg-slate-900 p-6 sm:p-8 text-white">
                <DialogTitle className="font-headline text-2xl">New Provider Enrollment</DialogTitle>
                <p className="text-slate-400 text-sm mt-1">Populate full clinical profile and credentials.</p>
            </div>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 sm:p-8 space-y-8">
                    <div className="space-y-6">
                        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">1. Identity & Contact</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="firstName" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold tracking-widest opacity-60">First Name</FormLabel><FormControl><Input placeholder="Amina" {...field} className="rounded-xl border-2" disabled={isSubmitting}/></FormControl></FormItem>)} />
                            <FormField control={form.control} name="lastName" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold tracking-widest opacity-60">Last Name</FormLabel><FormControl><Input placeholder="Khan" {...field} className="rounded-xl border-2" disabled={isSubmitting}/></FormControl></FormItem>)} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold tracking-widest opacity-60">Registry Email</FormLabel><FormControl><Input type="email" placeholder="amina@example.com" {...field} className="rounded-xl border-2" disabled={isSubmitting}/></FormControl></FormItem>)} />
                            <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold tracking-widest opacity-60">Clinical Phone</FormLabel><FormControl><Input placeholder="03XXXXXXXXX" {...field} className="rounded-xl border-2" disabled={isSubmitting}/></FormControl></FormItem>)} />
                        </div>
                    </div>

                    <div className="space-y-6">
                         <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">2. Professional Details</h4>
                         <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="specialty" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold tracking-widest opacity-60">Medical Specialty</FormLabel><FormControl><Input placeholder="Cardiology" {...field} className="rounded-xl border-2" disabled={isSubmitting}/></FormControl></FormItem>)} />
                            <FormField control={form.control} name="experience" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold tracking-widest opacity-60">Years Experience</FormLabel><FormControl><Input type="number" {...field} className="rounded-xl border-2" disabled={isSubmitting}/></FormControl></FormItem>)} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="medicalSchool" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold tracking-widest opacity-60">Medical School</FormLabel><FormControl><Input placeholder="Aga Khan University" {...field} className="rounded-xl border-2" disabled={isSubmitting}/></FormControl></FormItem>)} />
                            <FormField control={form.control} name="degree" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold tracking-widest opacity-60">Primary Degree</FormLabel><FormControl><Input placeholder="MBBS, FCPS" {...field} className="rounded-xl border-2" disabled={isSubmitting}/></FormControl></FormItem>)} />
                        </div>
                        <FormField control={form.control} name="location" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold tracking-widest opacity-60">Registry Hub (City)</FormLabel><FormControl><Input placeholder="Karachi" {...field} className="rounded-xl border-2" disabled={isSubmitting}/></FormControl></FormItem>)} />
                    </div>

                    <div className="space-y-6">
                        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">3. Professional Credentials</h4>
                        <div className="p-8 border-4 border-dashed rounded-3xl bg-muted/20 text-center space-y-4">
                            <div className="h-14 w-14 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto text-muted-foreground/30">
                                <Upload className="h-7 w-7" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-bold">Attach Clinical Evidence</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Images or PDFs of Medical Degrees</p>
                            </div>
                            <Button type="button" variant="outline" className="rounded-xl border-2 font-bold" onClick={() => fileInputRef.current?.click()} disabled={isSubmitting}>
                                Select Credentials
                            </Button>
                            <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*,.pdf" onChange={handleFileSelect} />
                        </div>

                        {selectedFiles.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {selectedFiles.map((file, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-primary/5 border rounded-xl animate-in zoom-in-95">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <FileText className="h-4 w-4 text-primary shrink-0" />
                                            <span className="text-[10px] font-bold truncate">{file.name}</span>
                                        </div>
                                        <button type="button" onClick={() => removeFile(idx)} className="text-muted-foreground hover:text-destructive transition-colors">
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="pt-8 border-t space-y-4">
                         {isSubmitting && (
                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-[10px] font-bold uppercase text-primary tracking-widest">
                                    <span>Synchronizing Clinical Portfolio...</span>
                                </div>
                                <Progress value={undefined} className="h-1.5" />
                            </div>
                        )}
                        <DialogFooter className="gap-3">
                            <DialogClose asChild><Button type="button" variant="secondary" className="rounded-xl h-12 flex-1 font-bold" disabled={isSubmitting}>Cancel</Button></DialogClose>
                            <Button type="submit" className="rounded-xl h-12 flex-1 font-bold text-white shadow-xl shadow-primary/20" disabled={isSubmitting}>
                                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Finalizing Enrollment</> : "Finalize Enrollment"}
                            </Button>
                        </DialogFooter>
                    </div>
                </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-[2rem] shadow-2xl bg-white overflow-hidden">
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
                                            <Link href={`/admin/doctors/${doctor.id}`}><Eye className="mr-2 h-4 w-4" /> View History & File</Link>
                                        </DropdownMenuItem>
                                        
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <DropdownMenuItem className={cn("font-bold rounded-xl cursor-pointer", isActive ? "text-amber-600" : "text-primary")} onSelect={(e) => e.preventDefault()}>
                                                    {isActive ? <><UserX className="mr-2 h-4 w-4" /> Disable Profile</> : <><UserCheck className="mr-2 h-4 w-4" /> Enable Profile</>}
                                                </DropdownMenuItem>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl">
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle className="font-headline text-2xl">{isActive ? "Disable Profile?" : "Enable Profile?"}</AlertDialogTitle>
                                                    <AlertDialogDescription className="text-sm">
                                                        {isActive ? "Disabling instantly blocks dashboard access and hides the provider from patient search results, but their consultation history remains archived for admin review." : "Enabling immediately re-enables clinical booking slots for this provider."}
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter className="pt-6">
                                                    <AlertDialogCancel className="rounded-xl border-2">Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleToggleDoctorStatus(doctor.id, isActive)} className={cn("rounded-xl font-bold text-white", isActive ? "bg-amber-600 hover:bg-amber-700" : "bg-primary hover:bg-primary/90")}>Confirm</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </DropdownMenuContent>
                                </DropdownMenu>
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
      </div>
    </div>
  );
}
