'use client';
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { ArrowRight, Briefcase, Heart, Brain, Clock, FileText, User, Lock, Video, Calendar } from "lucide-react";
import DoctorCard from "@/components/doctor-card";
import AppHeader from "@/components/layout/header";
import AppFooter from "@/components/layout/footer";
import { PlaceHolderImages as placeholderImages } from "@/lib/placeholder-images";
import { doctors } from "@/lib/data";

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

  const partners = [
    { id: "partner_chughtai", alt: "Chughtai Lab Logo"},
    { id: "partner_aga_khan", alt: "Aga Khan University Hospital Logo"},
    { id: "partner_shaukat", alt: "Shaukat Khanum Memorial Cancer Hospital Logo"},
    { id: "partner_red_crescent", alt: "Pakistan Red Crescent Logo"},
  ]

export default function Home() {
  const heroImage = placeholderImages.find(p => p.id === 'hero-v2');

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <AppHeader />
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="bg-white">
          <div className="container mx-auto px-4 py-16 md:py-24">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h1 className="text-4xl md:text-5xl font-bold font-headline leading-tight">Connect to an online doctor within <span className="text-primary">60 seconds</span></h1>
                <p className="mt-4 text-lg text-muted-foreground">
                  Consult with qualified and verified doctors from the comfort of your home. Get instant medical advice, prescriptions, and manage your health seamlessly.
                </p>
                <div className="mt-8">
                  <Button size="lg" asChild className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base">
                    <Link href="/find-a-doctor">
                      Find a Doctor
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="relative aspect-video rounded-lg overflow-hidden shadow-2xl">
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

        {/* Democratizing Healthcare Section */}
        <section className="py-16 md:py-24 bg-secondary/30">
            <div className="container mx-auto px-4">
                <div className="text-center">
                    <h2 className="text-3xl font-bold font-headline">Democratizing healthcare for all</h2>
                    <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">From individual consultations to corporate wellness, we have a solution for you.</p>
                </div>
                <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {services.map((service, index) => (
                        <Card key={index} className="text-center p-6 shadow-lg hover:shadow-xl transition-shadow">
                            <div className="mx-auto bg-primary/20 text-primary rounded-full p-4 w-fit mb-4">
                                <service.icon className="w-8 h-8" />
                            </div>
                            <h3 className="font-bold text-lg">{service.title}</h3>
                            <p className="text-muted-foreground mt-2 text-sm">{service.description}</p>
                            <Button variant="link" className="mt-4 text-primary">
                                Find out more <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </Card>
                    ))}
                </div>
            </div>
        </section>
        
        {/* Convenient Accessibility Section */}
        <section className="py-16 md:py-24 bg-primary/90 text-white">
            <div className="container mx-auto px-4">
                <div className="grid md:grid-cols-2 gap-12 items-center">
                    <div>
                        <h2 className="text-3xl font-bold font-headline">Convenient accessibility to healthcare with Mediconnect.</h2>
                        <p className="mt-4 opacity-90">We are on a mission to provide quality healthcare access to everyone. Here’s how we make it easier for you.</p>
                        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {features.map((feature, index) => (
                                <div key={index} className="flex items-start gap-3">
                                    <div className="bg-white/20 p-2 rounded-full">
                                      <feature.icon className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold">{feature.title}</h4>
                                        <p className="text-sm opacity-90">{feature.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                     <div className="relative flex items-center justify-center">
                         <div className="relative h-96 w-full max-w-md">
                            {placeholderImages.find(p => p.id === 'doctor-and-patient') && (
                                <Image
                                    src={placeholderImages.find(p => p.id === 'doctor-and-patient')!.imageUrl}
                                    alt="Doctor consulting with a patient"
                                    fill
                                    className="object-contain rounded-lg"
                                    data-ai-hint="doctor with patient"
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>

        {/* Featured Doctors Section */}
        <section className="py-16 md:py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center">
                <h2 className="text-3xl font-bold font-headline">Meet Our Healthcare professionals</h2>
                <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">Consult with our team of qualified and verified doctors.</p>
            </div>
            <Carousel
              opts={{ align: "start", loop: true, }}
              plugins={[ Autoplay({ delay: 3000, stopOnInteraction: true, }), ]}
              className="mt-12"
            >
              <CarouselContent>
                {doctors.map(doctor => (
                  <CarouselItem key={doctor.id} className="sm:basis-1/2 md:basis-1/3 lg:basis-1/4">
                    <div className="p-1">
                      <DoctorCard doctor={doctor} variant="compact" />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-16 md:py-24 bg-secondary/30">
          <div className="container mx-auto px-4">
            <div className="text-center">
              <h2 className="text-3xl font-bold font-headline">Patient Testimonials</h2>
            </div>
            <Carousel
              opts={{ align: "start", loop: true, }}
              plugins={[ Autoplay({ delay: 5000, stopOnInteraction: true, }), ]}
              className="mt-12 max-w-4xl mx-auto"
            >
              <CarouselContent>
                {testimonials.map((testimonial) => {
                  const testimonialImage = placeholderImages.find(p => p.id === testimonial.imageId);
                  return(
                  <CarouselItem key={testimonial.id}>
                    <div className="p-4 text-center">
                      {testimonialImage && (
                          <Image
                              src={testimonialImage.imageUrl}
                              alt={testimonial.name}
                              width={80}
                              height={80}
                              className="rounded-full mx-auto mb-4 border-4 border-white shadow-md"
                              data-ai-hint="person portrait"
                          />
                      )}
                      <p className="text-lg text-muted-foreground italic">"{testimonial.text}"</p>
                      <p className="font-bold mt-4">{testimonial.name}</p>
                      <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                    </div>
                  </CarouselItem>
                )})}
              </CarouselContent>
            </Carousel>
          </div>
        </section>

        {/* Our Trusted Partners */}
        <section className="py-16 bg-white">
            <div className="container mx-auto px-4">
                <div className="text-center">
                    <h2 className="text-3xl font-bold font-headline">Our Trusted Partners</h2>
                    <p className="text-muted-foreground mt-2">We are proud to partner with leading organizations to deliver quality healthcare.</p>
                </div>
                <div className="mt-12 flex flex-wrap justify-center items-center gap-x-12 gap-y-8">
                  {partners.map(partner => {
                    const partnerImage = placeholderImages.find(p => p.id === partner.id);
                    return partnerImage ? (
                      <div key={partner.id} className="relative h-16 w-40 grayscale opacity-60 hover:opacity-100 hover:grayscale-0 transition-all">
                        <Image src={partnerImage.imageUrl} alt={partner.alt} fill className="object-contain" data-ai-hint="company logo"/>
                      </div>
                    ) : null;
                  })}
                </div>
            </div>
        </section>
      </main>
      <AppFooter />
    </div>
  );
}

    