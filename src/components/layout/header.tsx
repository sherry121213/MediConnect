'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, LogOut, Shield, LayoutDashboard, Bell, Siren, User as UserCircle, UserCog, Settings, CheckCircle2, CreditCard, Trash2, HeartPulse } from 'lucide-react';
import Logo from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
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
import { collection, query, where } from 'firebase/firestore';
import { format, isAfter, subHours, isValid } from 'date-fns';
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
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    const savedDismissed = localStorage.getItem('mediconnect_dismissed_alerts');
    if (savedDismissed) {
      try {
        setDismissedIds(new Set(JSON.parse(savedDismissed)));
      } catch (e) {
        console.error("Failed to load dismissed alerts");
      }
    }
    return () => clearInterval(timer);
  }, []);

  const appointmentsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !userData) return null;
    const field = userData.role === 'doctor' ? 'doctorId' : 'patientId';
    return query(collection(firestore, 'appointments'), where(field, '==', user.uid));
  }, [firestore, user, userData?.role]);
  
  const { data: appointmentsRaw } = useCollection<any>(appointmentsQuery);

  const notifications = useMemo(() => {
    if (!appointmentsRaw || !userData) return [];
    const alerts: any[] = [];
    const currentTime = now;
    const yesterday = subHours(new Date(), 24);

    appointmentsRaw.forEach(apt => {
        if (!apt || !apt.appointmentDateTime) return;
        const aptDate = new Date(apt.appointmentDateTime);
        if (!isValid(aptDate)) return;

        const startTime = aptDate.getTime();
        const endTime = startTime + (20 * 60 * 1000); 

        if (userData.role === 'doctor') {
            if (apt.createdAt && isAfter(new Date(apt.createdAt), yesterday) && apt.status === 'scheduled') {
                alerts.push({ id: apt.id + '-new', title: 'New Booking', msg: `Patient booked: ${format(aptDate, "MMM dd, p")}`, icon: UserCircle, color: 'text-primary', timestamp: new Date(apt.createdAt).getTime(), link: '/doctor-portal' });
            }
            if (apt.patientCheckedIn && apt.status === 'scheduled') {
                alerts.push({ id: apt.id + '-arrived', title: 'Patient Arrived', msg: 'Patient is waiting in room.', icon: CheckCircle2, color: 'text-green-600', timestamp: Date.now(), link: '/doctor-portal' });
            }
        }

        if (userData.role === 'patient') {
            if (apt.readyToStart && !apt.doctorInRoom && apt.status === 'scheduled' && currentTime < startTime) {
                alerts.push({ id: apt.id + '-ready', title: 'Doctor Ready', msg: 'Provider is available early.', icon: Siren, color: 'text-amber-600 animate-pulse', timestamp: Date.now(), link: '/patient-portal' });
            }
            if (apt.paymentStatus === 'approved' && apt.createdAt && isAfter(new Date(apt.createdAt), yesterday)) {
                alerts.push({ id: apt.id + '-paid', title: 'Payment Approved', msg: 'Receipt verified by admin.', icon: CreditCard, color: 'text-primary', timestamp: Date.now(), link: '/patient-portal' });
            }
        }

        if (currentTime >= startTime && currentTime < endTime && apt.status === 'scheduled' && apt.paymentStatus === 'approved' && (userData.role === 'doctor' || apt.doctorInRoom)) {
            alerts.push({ id: apt.id + '-live', title: 'Session Live', msg: 'Secure tunnel active.', icon: Siren, color: 'text-red-600 animate-pulse', timestamp: startTime, isUrgent: true, link: `/consultation/${apt.id}` });
        }
    });

    return alerts
        .filter(n => !dismissedIds.has(n.id))
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 10);
  }, [appointmentsRaw, now, userData, dismissedIds]);

  const handleClearLog = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newDismissed = new Set(dismissedIds);
    notifications.forEach(n => newDismissed.add(n.id));
    setDismissedIds(newDismissed);
    localStorage.setItem('mediconnect_dismissed_alerts', JSON.stringify(Array.from(newDismissed)));
  };

  const handleLogout = () => {
    if (auth) {
      signOut(auth).then(() => {
        router.push('/');
      });
    }
  };

  const UserMenu = () => {
    const displayName = [userData?.firstName, userData?.lastName].filter(Boolean).join(' ') || 'User';
    const displayEmail = userData?.email || user?.email;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full border-2 border-white/20 hover:bg-white/10 transition-all p-0 overflow-hidden">
            <Avatar className="h-full w-full">
               <AvatarImage src={userData?.photoURL || user?.photoURL || undefined} alt={displayName} />
               <AvatarFallback className="bg-white/10 text-white font-bold">{displayEmail?.[0].toUpperCase() ?? 'U'}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64 rounded-2xl border-none shadow-2xl p-2 mt-2" align="end" forceMount>
          <DropdownMenuLabel className="font-normal p-3">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-bold leading-none">{displayName}</p>
              <p className="text-[10px] leading-none text-muted-foreground uppercase tracking-tighter mt-1 font-bold">{displayEmail}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="mx-2" />
          {userData?.role === 'doctor' && (
            <div className="p-1 space-y-1">
              <DropdownMenuItem className="rounded-xl p-3 cursor-pointer hover:bg-primary/5" onClick={() => router.push('/doctor-portal')}>
                  <LayoutDashboard className="mr-2 h-4 w-4 text-primary" /><span className="font-medium">Practice Dashboard</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-xl p-3 cursor-pointer hover:bg-primary/5" onClick={() => router.push('/doctor-portal/profile')}>
                  <UserCog className="mr-2 h-4 w-4 text-primary" /><span className="font-medium">Professional Profile</span>
              </DropdownMenuItem>
            </div>
          )}
          {userData?.role === 'patient' && (
            <div className="p-1 space-y-1">
                <DropdownMenuItem className="rounded-xl p-3 cursor-pointer hover:bg-primary/5" onClick={() => router.push('/patient-portal')}>
                    <LayoutDashboard className="mr-2 h-4 w-4 text-primary" /><span className="font-medium">Patient Portal</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-xl p-3 cursor-pointer hover:bg-primary/5" onClick={() => router.push('/patient-portal/profile')}>
                    <Settings className="mr-2 h-4 w-4 text-primary" /><span className="font-medium">Edit Personal Profile</span>
                </DropdownMenuItem>
            </div>
          )}
          {userData?.role === 'admin' && (
            <div className="p-1 space-y-1">
              <DropdownMenuItem className="rounded-xl p-3 cursor-pointer hover:bg-primary/5" onClick={() => router.push('/admin')}>
                <Shield className="mr-2 h-4 w-4 text-primary" /><span className="font-medium">Admin HQ</span>
              </DropdownMenuItem>
            </div>
          )}
          <DropdownMenuSeparator className="mx-2" />
          <DropdownMenuItem className="rounded-xl p-3 cursor-pointer text-destructive focus:text-destructive" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" /><span className="font-bold">Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const portalLabel = userData?.role === 'doctor' ? 'Professional Portal' : userData?.role === 'patient' ? 'Patient Hub' : '';

  return (
    <header className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300 h-20 bg-primary text-primary-foreground shadow-lg border-b border-white/10"
    )}>
      <div className="w-full h-full px-4 sm:px-8 flex items-center justify-between relative">
        {/* BRANDING BLOCK - LEFT */}
        <div className="flex items-center gap-4">
          <Link href={user ? (userData?.role === 'doctor' ? '/doctor-portal' : '/patient-portal') : '/'} className="flex items-center gap-3 group">
             <div className="bg-white rounded-xl p-1.5 shadow-sm transition-transform group-hover:scale-105">
                <HeartPulse className="h-6 w-6 text-primary" />
             </div>
             <div className="flex flex-col">
                <span className="text-xl font-bold font-headline text-white leading-none tracking-tight">Mediconnect</span>
                {portalLabel && <span className="text-[8px] font-bold text-white/70 uppercase tracking-[0.3em] mt-1 leading-none">{portalLabel}</span>}
             </div>
          </Link>
          
          {/* NAVIGATION - HIDDEN ON PORTALS FOR CLEANLINESS */}
          {!user && (
            <nav className="hidden md:flex gap-4 lg:gap-8 ml-8">
              {navLinks.map((link) => (
                <Link 
                  key={link.href} 
                  href={link.href} 
                  className={cn(
                    'text-[11px] font-bold uppercase tracking-[0.2em] transition-all hover:text-white', 
                    pathname === link.href ? 'text-white' : 'text-white/60'
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          )}
        </div>

        {/* OPERATIONS BLOCK - RIGHT */}
        <div className="flex items-center gap-2 sm:gap-4">
          {isUserLoading ? null : user ? (
            <>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="relative h-11 w-11 rounded-2xl hover:bg-white/10 transition-colors border border-transparent hover:border-white/20">
                            <Bell className="h-5 w-5 text-white" />
                            {notifications.length > 0 && (<span className="absolute top-2.5 right-2.5 h-3.5 w-3.5 bg-red-500 border-2 border-primary rounded-full flex items-center justify-center text-[7px] font-black text-white animate-pulse">{notifications.length}</span>)}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-80 p-0 rounded-[1.5rem] border-none shadow-2xl overflow-hidden mt-2" align="end">
                        <div className="bg-slate-950 text-white p-5 flex items-center justify-between">
                            <div className="space-y-0.5">
                              <h4 className="text-xs font-bold uppercase tracking-widest text-primary">Signals</h4>
                              <p className="text-[8px] text-slate-500 font-bold uppercase">Real-time alerts</p>
                            </div>
                            {notifications.length > 0 && (
                                <Button variant="ghost" size="sm" onClick={handleClearLog} className="h-7 text-[9px] font-bold uppercase hover:bg-white/10 hover:text-white px-2">
                                    <Trash2 className="h-3 w-3 mr-1" /> Clear Log
                                </Button>
                            )}
                        </div>
                        <ScrollArea className="max-h-[400px] bg-white">
                            {notifications.length > 0 ? (
                                <div className="divide-y divide-slate-50">
                                    {notifications.map((n) => (
                                        <DropdownMenuItem key={n.id} className="p-4 flex gap-4 cursor-pointer focus:bg-primary/5 m-1 rounded-xl transition-colors" onClick={() => n.link && router.push(n.link)}>
                                            <div className={cn("p-2.5 rounded-xl bg-slate-50 shrink-0", n.color)}>
                                                <n.icon className="h-4.5 w-4.5" />
                                            </div>
                                            <div className="space-y-0.5 min-w-0">
                                                <p className={cn("font-bold text-[10px] uppercase truncate", n.isUrgent ? "text-red-600" : "text-slate-900")}>{n.title}</p>
                                                <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{n.msg}</p>
                                            </div>
                                        </DropdownMenuItem>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-20 text-center px-8 bg-slate-50/50">
                                    <div className="h-16 w-16 rounded-3xl bg-white shadow-sm flex items-center justify-center mx-auto mb-4">
                                      <Bell className="h-8 w-8 text-slate-200" />
                                    </div>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Awaiting active signals</p>
                                </div>
                            )}
                        </ScrollArea>
                    </DropdownMenuContent>
                </DropdownMenu>
                <UserMenu />
            </>
          ) : (
            <div className="flex items-center gap-2 sm:gap-3">
                <Button asChild variant="outline" className="border-2 border-white/20 text-white bg-white/5 hover:bg-white/10 font-bold h-11 px-4 sm:px-8 rounded-2xl hidden sm:inline-flex whitespace-nowrap">
                    <Link href="/login">Login</Link>
                </Button>
                <Button asChild className="bg-white text-primary hover:bg-slate-100 font-bold h-11 px-4 sm:px-8 rounded-2xl shadow-xl whitespace-nowrap">
                    <Link href="/signup">Join Platform</Link>
                </Button>
            </div>
          )}
          
          <Sheet open={isMobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild><Button variant="ghost" size="icon" className="md:hidden ml-2 text-white hover:bg-white/10 rounded-xl"><Menu className="h-6 w-6" /></Button></SheetTrigger>
            <SheetContent side="right" className="w-[300px] p-0 border-none rounded-l-[2rem] overflow-hidden bg-white">
              <SheetHeader className="p-8 pb-0">
                <SheetTitle className="sr-only">Main Navigation</SheetTitle>
                <Logo />
              </SheetHeader>
              <div className="p-8 flex flex-col gap-6">
                {!user && navLinks.map((link) => (
                    <Link key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)} className={cn('text-lg font-bold uppercase tracking-widest transition-colors', pathname === link.href ? 'text-primary' : 'text-slate-500')}>
                        {link.label}
                    </Link>
                ))}
                  {user ? (
                      <div className="flex flex-col gap-6 pt-6 border-t border-slate-100">
                        {userData?.role === 'doctor' && (
                            <>
                                <Link href="/doctor-portal" onClick={() => setMobileMenuOpen(false)} className="text-lg font-bold uppercase tracking-widest text-slate-500">Practice Dashboard</Link>
                                <Link href="/doctor-portal/profile" onClick={() => setMobileMenuOpen(false)} className="text-lg font-bold uppercase tracking-widest text-slate-500">Professional Profile</Link>
                            </>
                        )}
                        {userData?.role === 'patient' && (
                            <>
                                <Link href="/patient-portal" onClick={() => setMobileMenuOpen(false)} className="text-lg font-bold uppercase tracking-widest text-slate-500">Patient Dashboard</Link>
                                <Link href="/patient-portal/profile" onClick={() => setMobileMenuOpen(false)} className="text-lg font-bold uppercase tracking-widest text-slate-500">Account Settings</Link>
                            </>
                        )}
                        <Button variant="destructive" className="h-14 rounded-2xl font-bold mt-4" onClick={handleLogout}>Log Out</Button>
                      </div>
                  ) : (
                      <div className="flex flex-col gap-4 mt-4">
                        <Button variant="outline" className="h-14 rounded-2xl font-bold border-2 border-primary text-primary" asChild onClick={() => setMobileMenuOpen(false)}>
                            <Link href="/login">Login</Link>
                        </Button>
                        <Button className="h-14 rounded-2xl font-bold shadow-lg bg-primary text-white" asChild onClick={() => setMobileMenuOpen(false)}>
                            <Link href="/signup">Create Account</Link>
                        </Button>
                      </div>
                  )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
