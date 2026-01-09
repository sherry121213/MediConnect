'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import AppHeader from '@/components/layout/header';
import AppFooter from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Mail, Phone, Users, Shield, Heart, Quote } from 'lucide-react';
import Image from 'next/image';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import Autoplay from 'embla-carousel-autoplay';

const contactFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  message: z.string().min(10, { message: 'Message must be at least 10 characters.' }),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

const teamMembers = [
    { name: "Dr. Arshad", role: "CEO & Founder", image: "https://images.unsplash.com/photo-1590086782792-42dd2350140d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw0fHxwZXJzb24lMjBwb3J0cmFpdHxlbnwwfHx8fDE3NjQ2NzYxNTh8MA&ixlibrb-4.1.0&q=80&w=1080", hint: "male ceo portrait" },
    { name: "Dr. Sana", role: "Chief Medical Officer", image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHwzfHxwZXJzb24lMjBwb3J0cmFpdHxlbnwwfHx8fDE3NjQ2NzYxNTh8MA&ixlib-rb-4.1.0&q=80&w=1080", hint: "female doctor portrait" },
    { name: "Mr. Bilal", role: "Chief Technology Officer", image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw3fHxwZXJzb24lMjBwb3J0cmFpdHxlbnwwfHx8fDE3NjQ2NzYxNTh8MA&ixlib-rb-4.1.0&q=80&w=1080", hint: "male engineer portrait" },
];

const milestones = [
    { year: 2020, description: "Mediconnect was founded with a mission to revolutionize healthcare access in Pakistan." },
    { year: 2021, description: "Launched our first mobile app, connecting patients with doctors via video calls." },
    { year: 2022, description: "Partnered with over 100 clinics and hospitals to expand our network of verified doctors." },
    { year: 2023, description: "Introduced corporate wellness programs, serving over 20 companies." },
    { year: 2024, description: "Reached a milestone of 1 million successful consultations across the country." },
]

export default function AboutUsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: '',
      email: '',
      message: '',
    },
  });

  const onSubmit = async (values: ContactFormValues) => {
    if (!firestore) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not connect to the database.' });
      return;
    }

    try {
      const contactsCollection = collection(firestore, 'contacts');
      await addDoc(contactsCollection, { ...values, submittedAt: new Date().toISOString() });
      toast({ title: 'Message Sent!', description: "Thank you for reaching out. We'll be in touch soon." });
      form.reset();
    } catch (error) {
      console.error('Error submitting contact form: ', error);
      toast({ variant: 'destructive', title: 'Uh oh!', description: 'There was a problem sending your message.' });
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="bg-primary/5 text-center py-20">
            <div className="container">
                <h1 className="text-5xl font-bold font-headline text-primary">About Mediconnect</h1>
                <p className="mt-4 text-xl text-muted-foreground max-w-3xl mx-auto">We are on a mission to democratize healthcare, making quality medical advice accessible and affordable for everyone in Pakistan.</p>
            </div>
        </section>

        {/* Our Values Section */}
        <section className="py-20">
            <div className="container">
                <div className="text-center mb-12">
                    <h2 className="text-4xl font-bold font-headline">Our Core Values</h2>
                    <p className="text-muted-foreground mt-2">The principles that guide our work every day.</p>
                </div>
                <div className="grid md:grid-cols-3 gap-8 text-center">
                    <div className="p-6">
                        <Heart className="h-12 w-12 mx-auto text-primary mb-4" />
                        <h3 className="text-xl font-bold">Compassion</h3>
                        <p className="text-muted-foreground mt-2">We believe in treating every patient with empathy, respect, and dignity.</p>
                    </div>
                    <div className="p-6">
                        <Shield className="h-12 w-12 mx-auto text-primary mb-4" />
                        <h3 className="text-xl font-bold">Trust</h3>
                        <p className="text-muted-foreground mt-2">We are committed to building a trustworthy platform through verified doctors and data security.</p>
                    </div>
                    <div className="p-6">
                        <Users className="h-12 w-12 mx-auto text-primary mb-4" />
                        <h3 className="text-xl font-bold">Accessibility</h3>
                        <p className="text-muted-foreground mt-2">Our goal is to break down barriers to healthcare for people in every corner of the nation.</p>
                    </div>
                </div>
            </div>
        </section>

         {/* Our Journey Section (Slider) */}
        <section className="py-20 bg-secondary/30">
            <div className="container">
                <div className="text-center mb-12">
                    <h2 className="text-4xl font-bold font-headline">Our Journey</h2>
                </div>
                <Carousel
                    opts={{ align: "start", loop: true, }}
                    plugins={[ Autoplay({ delay: 5000, stopOnInteraction: true, }), ]}
                    className="w-full max-w-4xl mx-auto"
                >
                    <CarouselContent>
                        {milestones.map((milestone) => (
                            <CarouselItem key={milestone.year} className="md:basis-1/2 lg:basis-1/3">
                                <div className="p-1 h-full">
                                    <Card className="h-full flex flex-col justify-center text-center">
                                        <CardHeader>
                                            <CardTitle className="text-5xl font-bold text-primary">{milestone.year}</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-muted-foreground">{milestone.description}</p>
                                        </CardContent>
                                    </Card>
                                </div>
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                    <CarouselPrevious className="hidden sm:flex"/>
                    <CarouselNext className="hidden sm:flex"/>
                </Carousel>
            </div>
        </section>


        {/* Leadership Team Section */}
        <section className="py-20">
            <div className="container">
                <div className="text-center mb-12">
                    <h2 className="text-4xl font-bold font-headline">Meet Our Leaders</h2>
                    <p className="text-muted-foreground mt-2">The minds behind our mission.</p>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {teamMembers.map((member) => (
                        <Card key={member.name} className="text-center overflow-hidden">
                             <div className="relative h-64 w-full">
                                <Image src={member.image} alt={member.name} fill className="object-cover" data-ai-hint={member.hint} />
                            </div>
                            <CardContent className="p-6">
                                <h3 className="text-xl font-bold">{member.name}</h3>
                                <p className="text-primary">{member.role}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </section>
        
        {/* Contact Us Section */}
        <section id="contact" className="py-20 bg-primary/5">
          <div className="container">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold font-headline">Get in Touch</h2>
              <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">Have a question or want to partner with us? We'd love to hear from you.</p>
            </div>
             <Card className="max-w-2xl mx-auto">
              <CardContent className="p-8">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Amina Khan" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <Input placeholder="amina.khan@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Your Message</FormLabel>
                          <FormControl>
                            <Textarea placeholder="How can we help?" rows={5} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                      {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Send Message
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </section>

      </main>
      <AppFooter />
    </div>
  );
}
