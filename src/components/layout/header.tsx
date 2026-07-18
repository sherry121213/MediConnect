
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, LogOut, User as UserIcon, Shield, LayoutDashboard, MessageCircle, CalendarClock, Bell, Siren, Clock, ChevronRight, User as UserCircle } from 'lucide-react';
import Logo from '@/components/logo';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useState, useMemo, useEffect } from 'react';
import { useAuth, useUserData, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { signOut } from 'firebase/auth';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { format, isAfter, subHours, isValid } from 'date-fns';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/find-a-doctor', label: 'Find a Doctor' },
  { href: '/about', label: 'About Us' },
];

export default function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, userData, isUserLoading } = useUserData();
  const firestore = useFirestore();
  const auth = useAuth();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Notification logic for doctors - Guarded by role verification
  const appointmentsQuery = useMemoFirebase(() => {
    // CRITICAL: Only initiate query if userData is fully loaded and role is confirmed as 'doctor'
    if (!firestore || !user || !userData || userData.role !== 'doctor') return null;
    return query(
        collection(firestore, 'appointments'), 
        where('doctorId', '==', user.uid),
        orderBy('appointmentDateTime', 'asc')
    );
  }, [firestore, user, userData?.role]);
  
  const { data: appointments } = useCollection<any>(appointmentsQuery);

  const notifications = useMemo(() => {
    if (!appointments) return [];
    const alerts: any[] = [];
    const currentTime = now;
    const yesterday = subHours(new Date(), 24);

    appointments.forEach(apt => {
        if (!apt.appointmentDateTime) return;
        const aptDate = new Date(apt.appointmentDateTime);
        if (!isValid(aptDate)) return;

        const startTime = aptDate.getTime();
        const endTime = startTime + (15 * 60 * 1000);
        const warningTime = endTime - (5 * 60 * 1000);

        // 1. New Bookings
        if (isAfter(new Date(apt.createdAt), yesterday) && apt.status === 'scheduled') {
            alerts.push({
                id: apt.id + '-new',
                title: 'New Precision Session',
                msg: `New booking registered for ${format(aptDate, "MMM dd, p")}`,
                icon: UserCircle,
                color: 'text-primary',
                timestamp: new Date(apt.createdAt).getTime()
            });
        }

        // 2. Starting Soon / Live
        if (currentTime >= startTime && currentTime < endTime && apt.status === 'scheduled' && apt.paymentStatus === 'approved') {
            alerts.push({
                id: apt.id + '-live',
                title: 'Clinical Session Live',
                msg: ' HD Video feed active. Join now.',
                icon: Siren,
                color: 'text-red-600 animate-pulse',
                timestamp: startTime,
                isUrgent: true,
                link: `/consultation/${apt.id}`
            });
        }

        // 3. Concluding Warning (5 mins left)
        if (currentTime >= warningTime && currentTime < endTime && apt.status === 'scheduled' && apt.paymentStatus === 'approved') {
             alerts.push({
                id: apt.id + '-warning',
                title: 'Precision Countdown',
                msg: '5 minutes remaining in session window.',
                icon: Clock,
                color: 'text-amber-500',
                timestamp: warningTime,
                isUrgent: true
            });
        }
    });

    return alerts.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
  }, [appointments, now]);

  const handleLogout = () => {
    if (auth) {
      signOut(auth).then(() => {
        router.push('/');
      });
    }
  };

  const NotificationCenter = () => (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full hover:bg-primary/5">
                <Bell className="h-5 w-5 text-slate-600" />
                {notifications.length > 0 && (
                    <span className="absolute top-2 right-2 h-4 w-4 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[8px] font-bold text-white animate-in zoom-in">
                        {notifications.length}
                    </span>
                )}
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-80 p-0 rounded-2xl border-none shadow-2xl overflow-hidden" align="end">
            <div className="bg-slate-900 text-white p-4">
                <p className="text-[10px] uppercase font-bold tracking-[0.2em] opacity-60">Notification Center</p>
                <h4 className="text-sm font-bold flex items-center gap-2">
                    Clinical Activity {notifications.length > 0 && <Badge variant="secondary" className="h-4 text-[8px] bg-primary text-white border-none">{notifications.length}</Badge>}
                </h4>
            </div>
            <ScrollArea className="h-[350px]">
                {notifications.length > 0 ? (
                    <div className="divide-y divide-slate-50">
                        {notifications.map((n) => (
                            <DropdownMenuItem 
                                key={n.id} 
                                className="p-4 flex gap-4 cursor-pointer focus:bg-slate-50 items-start"
                                onClick={() => n.link && router.push(n.link)}
                            >
                                <div className={cn("p-2 rounded-xl bg-slate-100 shrink-0", n.color)}>
                                    <n.icon className="h-4 w-4" />
                                </div>
                                <div className="space-y-0.5 min-w-0">
                                    <p className={cn("font-bold text-[11px] uppercase tracking-tight", n.isUrgent ? "text-red-600" : "text-slate-900")}>{n.title}</p>
                                    <p className="text-xs text-muted-foreground leading-snug">{n.msg}</p>
                                    <p className="text-[9px] text-slate-400 font-medium">{format(new Date(n.timestamp), "p")}</p>
                                </div>
                            </DropdownMenuItem>
                        ))}
                    </div>
                ) : (
                    <div className="py-20 text-center space-y-3 px-8">
                        <Bell className="h-10 w-10 text-slate-200 mx-auto" />
                        <div>
                            <p className="font-bold text-xs text-slate-900">All Quiet</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">No pending signals</p>
                        </div>
                    </div>
                )}
            </ScrollArea>
            <div className="p-3 bg-slate-50 border-t text-center">
                <Button variant="ghost" size="sm" className="text-[9px] uppercase font-bold text-primary hover:bg-white" onClick={() => router.push(userData?.role === 'doctor' ? '/doctor-portal' : '/patient-portal')}>
                    View Full Dashboard <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
            </div>
        </DropdownMenuContent>
    </DropdownMenu>
  );

  const UserMenu = () => {
    const displayName = [userData?.firstName, userData?.lastName].filter(Boolean).join(' ') || userData?.displayName || user?.displayName || 'User';
    const displayEmail = userData?.email || user?.email;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full border-2 border-transparent hover:border-primary/20 transition-all p-0 overflow-hidden">
            <Avatar className="h-full w-full">
               <AvatarImage src={userData?.photoURL || user?.photoURL || undefined} alt={displayName} />
               <AvatarFallback className="bg-primary/10 text-primary font-bold">{displayEmail?.[0].toUpperCase() ?? 'U'}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 rounded-2xl border-none shadow-2xl p-2" align="end" forceMount>
          <DropdownMenuLabel className="font-normal p-3">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-bold leading-none">{displayName}</p>
              <p className="text-[10px] leading-none text-muted-foreground uppercase tracking-tighter mt-1 font-bold">
                {displayEmail}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="mx-2" />
          
          {userData?.role === 'doctor' && (
            <div className="p-1 space-y-1">
              <DropdownMenuItem className="rounded-xl p-3 cursor-pointer" onClick={() => router.push('/doctor-portal')}>
                  <LayoutDashboard className="mr-2 h-4 w-4 text-primary" />
                  <span className="font-medium">Command Center</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-xl p-3 cursor-pointer" onClick={() => router.push('/doctor-portal/unavailability')}>
                <CalendarClock className="mr-2 h-4 w-4 text-primary" />
                <span className="font-medium">Clinical Pause</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-xl p-3 cursor-pointer" onClick={() => router.push('/doctor-portal/chat')}>
                <MessageCircle className="mr-2 h-4 w-4 text-primary" />
                <span className="font-medium">Admin Link</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-xl p-3 cursor-pointer" onClick={() => router.push('/doctor-portal/profile')}>
                <UserIcon className="mr-2 h-4 w-4 text-primary" />
                <span className="font-medium">Registry Settings</span>
              </DropdownMenuItem>
            </div>
          )}

          {userData?.role === 'patient' && (
            <div className="p-1 space-y-1">
                <DropdownMenuItem className="rounded-xl p-3 cursor-pointer" onClick={() => router.push('/patient-portal')}>
                    <LayoutDashboard className="mr-2 h-4 w-4 text-primary" />
                    <span className="font-medium">Care Portal</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-xl p-3 cursor-pointer" onClick={() => router.push('/patient-portal/profile')}>
                  <UserIcon className="mr-2 h-4 w-4 text-primary" />
                  <span className="font-medium">Profile Integrity</span>
                </DropdownMenuItem>
            </div>
          )}
          
          {userData?.role === 'admin' && (
            <div className="p-1 space-y-1">
              <DropdownMenuItem className="rounded-xl p-3 cursor-pointer" onClick={() => router.push('/admin')}>
                <Shield className="mr-2 h-4 w-4 text-primary" />
                <span className="font-medium">Platform HQ</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-xl p-3 cursor-pointer" onClick={() => router.push('/profile')}>
                  <UserIcon className="mr-2 h-4 w-4 text-primary" />
                  <span className="font-medium">Security Key</span>
              </DropdownMenuItem>
            </div>
          )}

          <DropdownMenuSeparator className="mx-2" />
          <DropdownMenuItem className="rounded-xl p-3 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/5" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            <span className="font-bold">Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-20 items-center justify-between">
        <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2">
            <Logo />
            </Link>
        </div>
        
        {/* Desktop Navigation */}
        {userData?.role !== 'doctor' && (
            <nav className="hidden md:flex gap-8">
            {navLinks.map((link) => (
                <Link
                key={link.href}
                href={link.href}
                className={cn(
                    'text-sm font-bold uppercase tracking-[0.1em] transition-all hover:text-accent',
                    pathname === link.href ? 'text-primary' : 'text-slate-500'
                )}
                >
                {link.label}
                </Link>
            ))}
            </nav>
        )}

        <div className="hidden md:flex items-center gap-3">
          {isUserLoading ? null : user ? (
            <>
                <NotificationCenter />
                <div className="w-px h-6 bg-slate-200 mx-2" />
                <UserMenu />
            </>
          ) : (
            <>
              <Button variant="ghost" asChild className="font-bold uppercase text-xs tracking-widest">
                <Link href="/login">Log In</Link>
              </Button>
              <Button asChild className="bg-accent hover:bg-accent/90 text-white font-bold h-11 px-8 rounded-xl shadow-lg shadow-accent/20">
                <Link href="/signup">Sign Up</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile Navigation */}
        <div className="flex items-center gap-2 md:hidden">
             {user && <NotificationCenter />}
             <Sheet open={isMobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-10 w-10">
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">Toggle Menu</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] sm:w-[400px] p-0 border-none rounded-l-[2.5rem] overflow-hidden">
                    <SheetHeader className="bg-slate-900 text-white p-8">
                    <SheetTitle className="text-white font-headline text-2xl">Menu</SheetTitle>
                    <SheetDescription className="text-slate-400">
                        Access all clinical features.
                    </SheetDescription>
                    </SheetHeader>
                    
                    <div className="p-8 space-y-10">
                        {userData?.role !== 'doctor' && (
                            <nav className="flex flex-col gap-6 text-lg font-bold">
                            {navLinks.map((link) => (
                                <Link
                                key={link.href}
                                href={link.href}
                                onClick={() => setMobileMenuOpen(false)}
                                className={cn(
                                    'transition-colors uppercase tracking-widest text-sm',
                                    pathname === link.href ? 'text-primary' : 'text-slate-500'
                                )}
                                >
                                {link.label}
                                </Link>
                            ))}
                            </nav>
                        )}
                        <div className="flex flex-col gap-3">
                        {isUserLoading ? null : user ? (
                            <div className="space-y-4">
                            {userData?.role === 'admin' && (
                                <>
                                <Button variant="outline" className="w-full h-14 rounded-2xl font-bold border-2" onClick={() => {router.push('/admin'); setMobileMenuOpen(false);}}>Admin Portal</Button>
                                <Button variant="outline" className="w-full h-14 rounded-2xl font-bold border-2" onClick={() => {router.push('/profile'); setMobileMenuOpen(false);}}>Security Center</Button>
                                </>
                            )}
                            {userData?.role === 'doctor' && (
                                <>
                                <Button variant="outline" className="w-full h-14 rounded-2xl font-bold border-2" onClick={() => {router.push('/doctor-portal'); setMobileMenuOpen(false);}}>Dashboard</Button>
                                <Button variant="outline" className="w-full h-14 rounded-2xl font-bold border-2" onClick={() => {router.push('/doctor-portal/profile'); setMobileMenuOpen(false);}}>Registry Info</Button>
                                <Button variant="outline" className="w-full h-14 rounded-2xl font-bold border-2" onClick={() => {router.push('/doctor-portal/unavailability'); setMobileMenuOpen(false);}}>Clinical Pause</Button>
                                </>
                            )}
                            {userData?.role === 'patient' && (
                                <>
                                <Button variant="outline" className="w-full h-14 rounded-2xl font-bold border-2" onClick={() => {router.push('/patient-portal'); setMobileMenuOpen(false);}}>Care Portal</Button>
                                <Button variant="outline" className="w-full h-14 rounded-2xl font-bold border-2" onClick={() => {router.push('/patient-portal/profile'); setMobileMenuOpen(false);}}>My Profile</Button>
                                </>
                            )}
                            <Button variant="destructive" className="w-full h-14 rounded-2xl font-bold shadow-xl shadow-red-500/10 mt-8" onClick={() => {handleLogout(); setMobileMenuOpen(false);}}>Log Out</Button>
                            </div>
                        ) : (
                            <div className="grid gap-4 mt-4">
                            <Button variant="outline" className="h-14 rounded-2xl font-bold border-2" asChild>
                                <Link href="/login" onClick={() => setMobileMenuOpen(false)}>Log In</Link>
                            </Button>
                            <Button asChild className="h-14 rounded-2xl font-bold bg-accent hover:bg-accent/90 text-white shadow-xl shadow-accent/20">
                                <Link href="/signup" onClick={() => setMobileMenuOpen(false)}>Create Account</Link>
                            </Button>
                            </div>
                        )}
                        </div>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
      </div>
    </header>
  );
}
