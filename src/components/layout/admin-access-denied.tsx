'use client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ShieldAlert, ShieldCheck, Siren, Brain, Activity } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import AppHeader from "./header";
import AppFooter from "./footer";

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

export default function AdminAccessDenied() {
  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-grow flex flex-col items-center justify-center bg-secondary/30 text-center p-4">
        <div className="max-w-md w-full">
            <Card className="p-6">
                <CardHeader className="p-0 mb-4">
                    <div className="mx-auto bg-destructive/20 text-destructive rounded-full p-3 w-fit">
                        <ShieldAlert className="h-10 w-10" />
                    </div>
                </CardHeader>
                <CardTitle className="text-2xl font-bold font-headline">Access Denied</CardTitle>
                <p className="text-muted-foreground mt-2">
                    You must be logged in as an administrator to access this page.
                </p>
                <Button asChild className="mt-6 w-full">
                    <Link href="/login">Admin Login</Link>
                </Button>
            </Card>
        </div>

        <section className="w-full py-16 md:py-24">
            <div className="container mx-auto px-4">
                <div className="text-center">
                    <h2 className="text-3xl font-bold font-headline">Health & Safety Awareness</h2>
                    <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">Stay informed with our essential health and safety advice while you wait.</p>
                </div>
                 <Carousel
                    opts={{ align: "start", loop: true, }}
                    plugins={[ Autoplay({ delay: 4000, stopOnInteraction: true, }), ]}
                    className="mt-12 w-full"
                    >
                    <CarouselContent>
                        {healthSafetyTips.map((tip, index) => (
                        <CarouselItem key={index} className="md:basis-1/2 lg:basis-1/3">
                            <div className="p-4">
                                <Card className="h-full p-6 text-center shadow-lg hover:shadow-xl transition-shadow flex flex-col items-center">
                                     <div className="mx-auto bg-primary/20 text-primary rounded-full p-4 w-fit mb-4">
                                        <tip.icon className="w-8 h-8" />
                                    </div>
                                    <CardHeader className="p-0">
                                        <CardTitle>{tip.title}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0 mt-2 flex-grow">
                                        <p className="text-muted-foreground">{tip.description}</p>
                                    </CardContent>
                                </Card>
                            </div>
                        </CarouselItem>
                        ))}
                    </CarouselContent>
                </Carousel>
            </div>
        </section>

      </main>
      <AppFooter />
    </div>
  );
}
