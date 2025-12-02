import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Calendar, MessageSquare, Search } from "lucide-react";
import DoctorCard from "@/components/doctor-card";
import { doctors } from "@/lib/data";
import SymptomCheckerForm from "@/components/symptom-checker-form";
import AppHeader from "@/components/layout/header";
import AppFooter from "@/components/layout/footer";
import { PlaceHolderImages as placeholderImages } from "@/lib/placeholder-images";
import Link from "next/link";

export default function Home() {
  const heroImage = placeholderImages.find(p => p.id === 'hero');

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative bg-secondary text-primary-foreground py-20 md:py-32">
          <div className="absolute inset-0">
            {heroImage && (
              <Image
                src={heroImage.imageUrl}
                alt={heroImage.description}
                fill
                className="object-cover opacity-20"
                data-ai-hint={heroImage.imageHint}
                priority
              />
            )}
          </div>
          <div className="container mx-auto px-4 relative">
            <div className="max-w-3xl text-center mx-auto">
              <h1 className="text-4xl md:text-6xl font-headline font-bold text-foreground">Your Trusted Partner in Health</h1>
              <p className="mt-4 text-lg md:text-xl text-foreground/80">
                Connect with verified doctors, get instant advice with our AI Symptom Checker, and manage your health seamlessly.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="font-bold" asChild>
                  <Link href="/find-a-doctor">
                    Find a Doctor <ArrowRight className="ml-2" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="font-bold bg-background/80 backdrop-blur-sm" asChild>
                   <Link href="/symptom-checker">Check Symptoms</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section className="py-16 md:py-24 bg-background">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center font-headline">How MediAI Assist Works</h2>
            <p className="text-center text-muted-foreground mt-2 max-w-2xl mx-auto">A simple, three-step process to get the care you need.</p>
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <div className="flex flex-col items-center">
                <div className="bg-primary/20 text-primary rounded-full p-4 mb-4">
                  <Search className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold font-headline">1. Find Your Doctor</h3>
                <p className="text-muted-foreground mt-2">Search by specialty and location. View profiles and ratings of verified professionals.</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="bg-primary/20 text-primary rounded-full p-4 mb-4">
                  <Calendar className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold font-headline">2. Book an Appointment</h3>
                <p className="text-muted-foreground mt-2">Choose a convenient time slot and book your consultation in just a few clicks.</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="bg-primary/20 text-primary rounded-full p-4 mb-4">
                  <MessageSquare className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold font-headline">3. Start Your Consultation</h3>
                <p className="text-muted-foreground mt-2">Connect with your doctor via secure chat, audio, or video call.</p>
              </div>
            </div>
          </div>
        </section>

        {/* AI Symptom Checker Section */}
        <section className="py-16 md:py-24 bg-secondary/50">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold font-headline">AI-Powered Symptom Checker</h2>
                <p className="mt-4 text-lg text-muted-foreground">
                  Not sure what's wrong? Describe your symptoms, and our advanced AI will suggest potential conditions and the right specialist to consult.
                </p>
                <ul className="mt-6 space-y-2 text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <ArrowRight className="text-primary w-5 h-5" />
                    <span>Analyzes symptoms using advanced NLP</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <ArrowRight className="text-primary w-5 h-5" />
                    <span>Recommends relevant specialists</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <ArrowRight className="text-primary w-5 h-5" />
                    <span>Suggests potential lab tests</span>
                  </li>
                </ul>
              </div>
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>Check Your Symptoms</CardTitle>
                </CardHeader>
                <CardContent>
                  <SymptomCheckerForm />
                </CardContent>
              </Card>
            </div>
          </div>
        </section>


        {/* Featured Doctors Section */}
        <section className="py-16 md:py-24 bg-background">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center font-headline">Meet Our Top Doctors</h2>
            <p className="text-center text-muted-foreground mt-2 max-w-2xl mx-auto">Handpicked, verified specialists ready to help you.</p>
            <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {doctors.slice(0, 4).map(doctor => (
                <DoctorCard key={doctor.id} doctor={doctor} />
              ))}
            </div>
            <div className="text-center mt-12">
              <Button size="lg" variant="outline" asChild>
                <Link href="/find-a-doctor">View All Doctors</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <AppFooter />
    </div>
  );
}
