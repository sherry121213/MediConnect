import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Calendar, MessageSquare, Search } from "lucide-react";
import DoctorCard from "@/components/doctor-card";
import { doctors } from "@/lib/data";
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
        <section className="relative text-primary-foreground py-20 md:py-32">
          <div className="absolute inset-0">
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
            <div className="absolute inset-0 bg-black/50"></div>
          </div>
          <div className="container mx-auto px-4 relative">
            <div className="max-w-3xl text-center mx-auto">
              <h1 className="text-4xl md:text-6xl font-headline font-bold text-white">Your Trusted Partner in Health</h1>
              <p className="mt-4 text-lg md:text-xl text-white/90">
                Connect with verified doctors, get instant advice, and manage your health seamlessly.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="font-bold" asChild>
                  <Link href="/find-a-doctor">
                    Find a Doctor <ArrowRight className="ml-2" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section className="py-16 md:py-24 bg-background">
          <div className="container mx-auto px-4">
            <div className="text-center">
                <h2 className="text-3xl font-bold font-headline">How Mediconnect Works</h2>
                <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">A simple, three-step process to get the care you need.</p>
            </div>
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
              <Card className="text-center">
                <CardHeader>
                    <div className="mx-auto bg-primary/20 text-primary rounded-full p-4 w-fit mb-4">
                        <Search className="w-8 h-8" />
                    </div>
                  <CardTitle className="font-headline text-xl">1. Find Your Doctor</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Search by specialty and location. View profiles and ratings of verified professionals.</p>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardHeader>
                    <div className="mx-auto bg-primary/20 text-primary rounded-full p-4 w-fit mb-4">
                        <Calendar className="w-8 h-8" />
                    </div>
                  <CardTitle className="font-headline text-xl">2. Book an Appointment</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Choose a convenient time slot and book your consultation in just a few clicks.</p>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardHeader>
                    <div className="mx-auto bg-primary/20 text-primary rounded-full p-4 w-fit mb-4">
                        <MessageSquare className="w-8 h-8" />
                    </div>
                  <CardTitle className="font-headline text-xl">3. Start Your Consultation</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Connect with your doctor via secure chat, audio, or video call.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Featured Doctors Section */}
        <section className="py-16 md:py-24 bg-secondary/30">
          <div className="container mx-auto px-4">
            <div className="text-center">
                <h2 className="text-3xl font-bold font-headline">Meet Our Top Doctors</h2>
                <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">Handpicked, verified specialists ready to help you.</p>
            </div>
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
