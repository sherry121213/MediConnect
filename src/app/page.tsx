'use client';
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { ArrowRight, Briefcase, Heart, Brain, Clock, FileText, User, Lock, Video, Calendar, ShieldCheck, Siren, Activity, Shield } from "lucide-react";
import DoctorCard from "@/components/doctor-card";
import AppHeader from "@/components/layout/header";
import AppFooter from "@/components/layout/footer";
import { PlaceHolderImages as placeholderImages } from "@/lib/placeholder-images";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, where, limit } from "firebase/firestore";
import type { Doctor } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

const services = [
  { icon: Briefcase, title: "Mediconnect Corporate Care", description: "Corporate wellness programs designed to keep your workforce healthy and productive." },
  { icon: Heart, title: "Mediconnect E-Clinics", description: "Walk-in clinics providing access to quality healthcare in your community." },
  { icon: Brain, title: "Mediconnect Mental Health & Well-being", description: "Confidential and professional mental health support from certified therapists." },
];

const features = [
    { icon: Clock, title: "24/7 Doctor Access", description: "Connect with a certified doctor online anytime, anywhere for immediate medical consultation." },
    { icon: FileText, title: "Get Your Digital Prescription", description: "Receive a valid digital prescription in your app after every consultation." },
    { icon: User, title: "800+ Verified Doctors", description: "Choose from a network of highly qualified and experienced doctors across various specialties." },
    { icon: Lock, title: "Data Privacy and Security", description: "Your medical records and consultations are kept secure and confidential with end-to-end encryption." },
    { icon: Video, title: "Video Consultations", description: "Engage in high-quality video calls with your doctor for a thorough and personal consultation." },
    { icon: Calendar, title: "Appointment Bookings",
      description: "Easily book and manage your appointments at your convenience with our in-app booking system.",
    },
  ];

  const testimonials = [
    {
      id: 1,
      name: "Javed Ahmed",
      role: "CEO, Adamjee Life Insurance",
      text: "Our partnership with Mediconnect has been transformative. It allowed us to extend our reach and provide quality healthcare services to millions, fulfilling our vision of democratizing healthcare access.",
      imageId: "testimonial1",
    },
    {
      id: 2,
      name: "Aisha Malik",
      role: "Working Professional",
      text: "As a busy professional, the Mediconnect platform has been a lifesaver. I can consult with a doctor anytime, even during my short breaks, without the hassle of traffic and waiting rooms. Highly recommended!",
      imageId: "testimonial2",
    },
     {
      id: 3,
      name: "Fatima Ali",
      role: "Mother of Two",
      text: "The pediatricians on this platform are wonderful. Getting immediate advice for my children's health concerns from home gives me peace of mind. The platform is so easy to use.",
      imageId: "testimonial3",
    },
  ];

  const healthSafetyTips = [
    {
        icon: ShieldCheck,
        title: "Regular Check-ups",
        description: "Schedule regular check-ups with your doctor to monitor your health and catch potential issues early.",
    },
    {
        icon: Activity,
        title: "Stay Active",
        description: "Incorporate at least 30 minutes of moderate physical activity into your daily routine to maintain a healthy heart.",
    },
    {
        icon: Siren,
        title: "Know Emergency Signs",
        description: "Be aware of heart attack and stroke symptoms. Quick action can save lives. Call for help immediately.",
    },
    {
        icon: Brain,
        title: "Prioritize Mental Health",
        description: "Your mental well-being is as important as your physical health. Don't hesitate to seek help from a professional.",
    },
  ];

const CompactDoctorCardSkeleton = () => (
    <Card className="flex flex-col h-full overflow-hidden border-gray-200/80 rounded-[2rem]">
        <CardHeader className="p-0">
            <Skeleton className="h-40 w-full" />
        </CardHeader>
        <CardContent className="p-4 text-center flex-grow space-y-2 mt-2">
            <Skeleton className="h-5 w-3/4 mx-auto" />
            <Skeleton className="h-4 w-1/2 mx-auto" />
            <Skeleton className="h-4 w-1/4 mx-auto" />
        </CardContent>
        <CardFooter className="p-4 pt-0">
            <Skeleton className="h-10 w-full rounded-xl" />
        </CardFooter>
    </Card>
);

export default function Home() {
  const heroImage = placeholderImages.find(p => p.id === 'hero-v2');
  const firestore = useFirestore();

  const doctorsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
        collection(firestore, 'doctors'), 
        where('verified', '==', true), 
        where('profileComplete', '==', true), 
        where('isActive', '==', true),
        limit(8)
    );
  }, [firestore]);

  const { data: doctors, isLoading: isLoadingDoctors } = useCollection<Doctor>(doctorsQuery);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <AppHeader />
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="bg-white overflow-hidden relative border-b">
          <div className="container mx-auto px-4 py-20 md:py-32">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div className="order-2 lg:order-1 space-y-8 animate-in fade-in slide-in-from-left-4 duration-700">
                <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full font-bold text-xs uppercase tracking-widest">
                    <Shield className="h-3.5 w-3.5" /> High-Fidelity Healthcare
                </div>
                <h1 className="text-5xl md:text-7xl font-bold font-headline leading-tight tracking-tight text-slate-900">
                  Connect to an online doctor within <span className="text-primary underline decoration-primary/20">60 seconds</span>
                </h1>
                <p className="text-lg md:text-xl text-slate-500 leading-relaxed max-w-xl">
                  Consult with qualified and verified doctors from the comfort of your home. Get instant medical advice, digital prescriptions, and manage your health seamlessly.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button size="lg" asChild className="bg-primary hover:bg-primary/90 text-white font-bold text-lg h-16 px-10 rounded-2xl shadow-2xl shadow-primary/20 transition-all active:scale-95">
                    <Link href="/find-a-doctor">
                      Find a Doctor Now
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild className="font-bold text-lg h-16 px-10 rounded-2xl border-2 hover:bg-slate-50 transition-all active:scale-95">
                    <Link href="/about">
                      Corporate Solutions
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="relative aspect-square lg:aspect-video rounded-[3rem] overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)] order-1 lg:order-2 border-8 border-white animate-in fade-in zoom-in-95 duration-1000">
                 {heroImage && (
                    <Image
                        src={heroImage.imageUrl}
                        alt={heroImage.description}
                        fill
                        className="object-cover"
                        data-ai-hint={heroImage.imageHint}
                        priority
                    />
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Services Section */}
        <section className="py-24 md:py-32 bg-slate-50/50">
            <div className="container mx-auto px-4">
                <div className="text-center space-y-4 max-w-3xl mx-auto">
                    <h2 className="text-4xl md:text-5xl font-bold font-headline tracking-tight text-slate-900">Democratizing healthcare for all</h2>
                    <p className="text-lg text-slate-500 font-medium">From individual consultations to corporate wellness, we have a solution for you.</p>
                </div>
                <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
                    {services.map((service, index) => (
                        <Card key={index} className="text-center p-10 shadow-xl hover:shadow-2xl transition-all rounded-[2.5rem] border-none bg-white group hover:-translate-y-2 duration-300">
                            <div className="mx-auto bg-primary/10 text-primary rounded-3xl p-6 w-fit mb-8 group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                                <service.icon className="w-10 h-10" />
                            </div>
                            <h3 className="font-bold text-2xl text-slate-900 mb-4">{service.title}</h3>
                            <p className="text-slate-500 leading-relaxed text-base">{service.description}</p>
                            <Button variant="link" className="mt-6 text-primary font-bold text-lg p-0">
                                Find out more <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                        </Card>
                    ))}
                </div>
            </div>
        </section>
        
        {/* Features Section */}
        <section className="py-24 md:py-32 bg-primary text-white relative overflow-hidden">
            <div className="absolute inset-0 opacity-10 pointer-events-none">
                <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-white rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />
            </div>
            <div className="container mx-auto px-4 relative z-10">
                <div className="grid lg:grid-cols-2 gap-20 items-center">
                    <div className="space-y-10">
                        <div className="space-y-6">
                            <h2 className="text-4xl md:text-6xl font-bold font-headline tracking-tight leading-tight">Convenient accessibility to healthcare with Mediconnect.</h2>
                            <p className="text-xl opacity-80 leading-relaxed">We are on a mission to provide quality healthcare access to everyone. Here’s how we make it easier for you.</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                            {features.map((feature, index) => (
                                <div key={index} className="flex items-start gap-4 p-4 rounded-2xl hover:bg-white/5 transition-colors">
                                    <div className="bg-white/20 p-3 rounded-xl shrink-0">
                                      <feature.icon className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="font-bold text-lg">{feature.title}</h4>
                                        <p className="text-sm opacity-70 leading-relaxed">{feature.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                     <div className="relative flex items-center justify-center">
                         <div className="relative h-[500px] w-full max-w-lg bg-white/10 rounded-[4rem] p-10 border border-white/20 shadow-2xl backdrop-blur-sm">
                            {placeholderImages.find(p => p.id === 'doctor-and-patient') && (
                                <Image
                                    src={placeholderImages.find(p => p.id === 'doctor-and-patient')!.imageUrl}
                                    alt="Doctor consulting with a patient"
                                    fill
                                    className="object-contain rounded-[3rem] p-4"
                                    data-ai-hint="doctor with patient"
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>

        {/* Featured Doctors Section */}
        <section className="py-24 md:py-32 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center space-y-4 mb-16">
                <h2 className="text-4xl md:text-5xl font-bold font-headline tracking-tight text-slate-900">Meet Our Healthcare professionals</h2>
                <p className="text-lg text-slate-500 font-medium">Consult with our team of qualified and verified doctors across all specialties.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                {isLoadingDoctors && Array.from({ length: 8 }).map((_, i) => (
                    <CompactDoctorCardSkeleton key={i} />
                ))}
                {doctors && doctors.map(doctor => (
                    <DoctorCard key={doctor.id} doctor={doctor} variant="compact" />
                ))}
            </div>
            <div className="text-center mt-20">
                <Button size="lg" asChild className="bg-slate-900 hover:bg-slate-800 text-white font-bold h-14 px-10 rounded-2xl shadow-xl transition-all">
                    <Link href="/find-a-doctor">View Full Registry <ArrowRight className="ml-2 h-5 w-5" /></Link>
                </Button>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-24 md:py-32 bg-slate-50/50 relative overflow-hidden">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold font-headline text-slate-900 tracking-tight">Patient Experiences</h2>
            </div>
            <div className="relative max-w-5xl mx-auto">
                <Carousel
                  opts={{ align: "start", loop: true }}
                  plugins={[ Autoplay({ delay: 6000, stopOnInteraction: true }) ]}
                  className="w-full"
                >
                  <CarouselContent>
                    {testimonials.map((testimonial) => {
                      const testimonialImage = placeholderImages.find(p => p.id === testimonial.imageId);
                      return(
                      <CarouselItem key={testimonial.id}>
                        <div className="p-10 text-center space-y-8 bg-white rounded-[3rem] shadow-2xl border border-slate-100 mx-4">
                          <div className="relative h-24 w-24 mx-auto">
                            {testimonialImage && (
                                <Image
                                    src={testimonialImage.imageUrl}
                                    alt={testimonial.name}
                                    fill
                                    className="rounded-3xl object-cover border-4 border-slate-50 shadow-lg"
                                    data-ai-hint="person portrait"
                                />
                            )}
                          </div>
                          <div className="space-y-4">
                            <p className="text-2xl md:text-3xl text-slate-700 italic font-medium leading-relaxed max-w-3xl mx-auto">"{testimonial.text}"</p>
                            <div className="pt-4 border-t w-fit mx-auto px-8">
                                <p className="font-bold text-xl text-slate-900">{testimonial.name}</p>
                                <p className="text-xs text-primary font-bold uppercase tracking-[0.2em] mt-1">{testimonial.role}</p>
                            </div>
                          </div>
                        </div>
                      </CarouselItem>
                    )})}
                  </CarouselContent>
                  <CarouselPrevious className="hidden md:flex -left-16 bg-white hover:bg-slate-50 border-2 h-12 w-12 rounded-2xl shadow-lg" />
                  <CarouselNext className="hidden md:flex -right-16 bg-white hover:bg-slate-50 border-2 h-12 w-12 rounded-2xl shadow-lg" />
                </Carousel>
            </div>
          </div>
        </section>

        {/* Health & Safety Tips Section */}
        <section className="py-24 md:py-32 bg-white">
            <div className="container mx-auto px-4">
                <div className="text-center space-y-4 mb-16">
                    <h2 className="text-4xl font-bold font-headline text-slate-900">Health & Safety Insights</h2>
                    <p className="text-lg text-slate-500 font-medium max-w-2xl mx-auto">Stay informed with our essential health advice and safety protocols.</p>
                </div>
                 <div className="relative">
                    <Carousel
                        opts={{ align: "start", loop: true }}
                        plugins={[ Autoplay({ delay: 4000, stopOnInteraction: true }) ]}
                        className="w-full"
                        >
                        <CarouselContent>
                            {healthSafetyTips.map((tip, index) => (
                            <CarouselItem key={index} className="md:basis-1/2 lg:basis-1/3">
                                <div className="p-4 h-full">
                                    <Card className="h-full p-10 text-center shadow-xl hover:shadow-2xl transition-all flex flex-col items-center rounded-[2.5rem] border-none bg-slate-50/50 group">
                                         <div className="mx-auto bg-primary/10 text-primary rounded-3xl p-5 w-fit mb-8 group-hover:scale-110 transition-transform">
                                            <tip.icon className="w-10 h-10" />
                                        </div>
                                        <CardHeader className="p-0">
                                            <CardTitle className="text-2xl font-bold text-slate-900">{tip.title}</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-0 mt-4 flex-grow">
                                            <p className="text-slate-500 leading-relaxed">{tip.description}</p>
                                        </CardContent>
                                    </Card>
                                </div>
                            </CarouselItem>
                            ))}
                        </CarouselContent>
                        <CarouselPrevious className="hidden md:flex -left-6 bg-white h-10 w-10 rounded-xl" />
                        <CarouselNext className="hidden md:flex -right-6 bg-white h-10 w-10 rounded-xl" />
                    </Carousel>
                 </div>
            </div>
        </section>
      </main>
      <AppFooter />
    </div>
  );
}
