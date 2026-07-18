'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, LogOut, User as UserIcon, Shield, LayoutDashboard, MessageCircle, CalendarClock, Bell, Siren, Clock, User as UserCircle, CheckCircle2 } from 'lucide-react';
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
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  // Notification logic for doctors
  const appointmentsQuery = useMemoFirebase(() => {
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
        const endTime = startTime + (15 * 60 * 1000); // 15 min precision session
        const warningTime = endTime - (5 * 60 * 1000); // 5 min warning

        // 1. New Bookings (Booked in last 24h)
        if (isAfter(new Date(apt.createdAt), yesterday) && apt.status === 'scheduled') {
            alerts.push({
                id: apt.id + '-new',
                title: 'New Precision Session',
                msg: `Appointment registered for ${format(aptDate, "MMM dd, p")}`,
                icon: UserCircle,
                color: 'text-primary',
                timestamp: new Date(apt.createdAt).getTime(),
                link: '/doctor-portal'
            });
        }

        // 2. Starting Soon / Live
        if (currentTime >= startTime && currentTime < endTime && apt.status === 'scheduled' && apt.paymentStatus === 'approved') {
            alerts.push({
                id: apt.id + '-live',
                title: 'Clinical Session Live',
                msg: 'Secure video feed is active. Join now.',
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
                msg: 'Only 5 minutes remaining in session.',
                icon: Clock,
                color: 'text-amber-500',
                timestamp: warningTime,
                isUrgent: true,
                link: `/consultation/${apt.id}`
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
                  <span className="font-medium">Dashboard</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-xl p-3 cursor-pointer" onClick={() => router.push('/doctor-portal/profile')}>
                <UserIcon className="mr-2 h-4 w-4 text-primary" />
                <span className="font-medium">Clinical Registry</span>
              </DropdownMenuItem>
            </div>
          )}

          {userData?.role === 'patient' && (
            <div className="p-1 space-y-1">
                <DropdownMenuItem className="rounded-xl p-3 cursor-pointer" onClick={() => router.push('/patient-portal')}>
                    <LayoutDashboard className="mr-2 h-4 w-4 text-primary" />
                    <span className="font-medium">Patient Portal</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-xl p-3 cursor-pointer" onClick={() => router.push('/patient-portal/profile')}>
                  <UserIcon className="mr-2 h-4 w-4 text-primary" />
                  <span className="font-medium">My Identity</span>
                </DropdownMenuItem>
            </div>
          )}
          
          {userData?.role === 'admin' && (
            <div className="p-1 space-y-1">
              <DropdownMenuItem className="rounded-xl p-3 cursor-pointer" onClick={() => router.push('/admin')}>
                <Shield className="mr-2 h-4 w-4 text-primary" />
                <span className="font-medium">Admin HQ</span>
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
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 shadow-sm">
      <div className="container flex h-20 items-center justify-between">
        <Logo />
        
        <nav className="hidden md:flex gap-10">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'text-sm font-bold uppercase tracking-[0.15em] transition-colors hover:text-primary',
                pathname === link.href ? 'text-primary' : 'text-slate-500'
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {isUserLoading ? null : user ? (
            <>
                {userData?.role === 'doctor' && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full hover:bg-slate-50">
                                <Bell className="h-5 w-5 text-slate-600" />
                                {notifications.length > 0 && (
                                    <span className="absolute top-2 right-2 h-4 w-4 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[8px] font-bold text-white animate-pulse">
                                        {notifications.length}
                                    </span>
                                )}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-80 p-0 rounded-2xl border-none shadow-2xl overflow-hidden" align="end">
                            <div className="bg-slate-900 text-white p-4">
                                <p className="text-[10px] uppercase font-bold tracking-[0.2em] opacity-60">Clinical Pulse</p>
                                <h4 className="text-sm font-bold flex items-center gap-2">
                                    Recent Notifications {notifications.length > 0 && <Badge variant="secondary" className="h-4 text-[8px] bg-primary text-white border-none">{notifications.length}</Badge>}
                                </h4>
                            </div>
                            <ScrollArea className="max-h-[400px]">
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
                                        <Bell className="h-10 w-10 text-slate-100 mx-auto" />
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">No active signals</p>
                                    </div>
                                )}
                            </ScrollArea>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
                <div className="w-px h-6 bg-slate-200 mx-2 hidden sm:block" />
                <UserMenu />
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" asChild className="font-bold uppercase text-xs tracking-widest hidden sm:flex">
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild className="bg-primary hover:bg-primary/90 text-white font-bold h-10 px-6 rounded-xl shadow-lg">
                <Link href="/signup">Sign Up</Link>
              </Button>
            </div>
          )}
          
          <Sheet open={isMobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] p-0 border-none rounded-l-[2rem] overflow-hidden">
              <div className="bg-slate-900 text-white p-8">
                <Logo />
                <p className="text-slate-400 text-xs mt-2 font-medium">Precision Clinical Platform</p>
              </div>
              <div className="p-8 flex flex-col gap-6">
                 {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        'text-lg font-bold uppercase tracking-widest transition-colors',
                        pathname === link.href ? 'text-primary' : 'text-slate-500'
                      )}
                    >
                      {link.label}
                    </Link>
                  ))}
                  <DropdownMenuSeparator />
                  {user ? (
                    <Button variant="destructive" className="h-14 rounded-2xl font-bold" onClick={handleLogout}>Log Out</Button>
                  ) : (
                    <Button className="h-14 rounded-2xl font-bold" asChild><Link href="/login">Portal Login</Link></Button>
                  )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}