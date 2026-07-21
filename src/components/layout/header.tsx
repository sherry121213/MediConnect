
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, LogOut, Shield, LayoutDashboard, Bell, Siren, User as UserCircle, UserCog, Settings, CheckCircle2, CreditCard, Trash2 } from 'lucide-react';
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

  const isDoctorPortal = userData?.role === 'doctor' && (pathname?.startsWith('/doctor-portal') || pathname?.startsWith('/consultation/'));

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
          <Button variant="ghost" className="relative h-10 w-10 rounded-full border-2 border-transparent hover:border-primary/20 transition-all p-0 overflow-hidden">
            <Avatar className="h-full w-full">
               <AvatarImage src={userData?.photoURL || user?.photoURL || undefined} alt={displayName} />
               <AvatarFallback className="bg-primary/10 text-primary font-bold">{displayEmail?.[0].toUpperCase() ?? 'U'}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64 rounded-2xl border-none shadow-2xl p-2" align="end" forceMount>
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

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur shadow-sm overflow-x-hidden">
      <div className="w-full px-4 sm:px-8 flex h-20 items-center justify-between relative">
        {isDoctorPortal ? (
          <>
            {/* Elegant Doctor Portal Layout - Center Logo */}
            <div className="flex-1" /> 
            
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
              <Logo />
            </div>

            <div className="flex items-center gap-3 shrink-0 relative z-10">
              <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full hover:bg-slate-50">
                          <Bell className="h-5 w-5 text-slate-600" />
                          {notifications.length > 0 && (<span className="absolute top-2 right-2 h-4 w-4 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[8px] font-bold text-white animate-pulse">{notifications.length}</span>)}
                      </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-80 p-0 rounded-2xl border-none shadow-2xl overflow-hidden" align="end">
                      <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
                          <h4 className="text-sm font-bold">Signals</h4>
                          {notifications.length > 0 && (
                              <Button variant="ghost" size="sm" onClick={handleClearLog} className="h-7 text-[9px] font-bold uppercase hover:bg-white/10 hover:text-white px-2">
                                  <Trash2 className="h-3 w-3 mr-1" /> Clear All
                              </Button>
                          )}
                      </div>
                      <ScrollArea className="max-h-[400px]">
                          {notifications.length > 0 ? (
                              <div className="divide-y divide-slate-50">
                                  {notifications.map((n) => (
                                      <DropdownMenuItem key={n.id} className="p-4 flex gap-4 cursor-pointer focus:bg-primary/5" onClick={() => n.link && router.push(n.link)}>
                                          <div className={cn("p-2 rounded-xl bg-slate-100", n.color)}>
                                              <n.icon className="h-4 w-4" />
                                          </div>
                                          <div className="space-y-0.5">
                                              <p className={cn("font-bold text-[11px] uppercase", n.isUrgent ? "text-red-600" : "")}>{n.title}</p>
                                              <p className="text-xs text-muted-foreground">{n.msg}</p>
                                          </div>
                                      </DropdownMenuItem>
                                  ))}
                              </div>
                          ) : (
                              <div className="py-20 text-center px-8">
                                  <Bell className="h-10 w-10 text-slate-100 mx-auto" />
                                  <p className="text-[10px] text-muted-foreground uppercase font-bold mt-2">No active signals</p>
                              </div>
                          )}
                      </ScrollArea>
                  </DropdownMenuContent>
              </DropdownMenu>
              <UserMenu />
            </div>
          </>
        ) : (
          <>
            {/* Standard Header Layout */}
            <div className="flex items-center gap-4 md:gap-12 min-w-0">
              <Logo />
              <nav className="hidden md:flex gap-4 lg:gap-10 shrink-0">
                {navLinks.map((link) => (
                  <Link 
                    key={link.href} 
                    href={link.href} 
                    className={cn(
                      'text-sm font-bold uppercase tracking-[0.15em] transition-colors hover:text-primary whitespace-nowrap', 
                      pathname === link.href ? 'text-primary' : 'text-slate-500'
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {isUserLoading ? null : user ? (
                <>
                    {(userData?.role === 'doctor' || userData?.role === 'patient') && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full hover:bg-slate-50">
                                    <Bell className="h-5 w-5 text-slate-600" />
                                    {notifications.length > 0 && (<span className="absolute top-2 right-2 h-4 w-4 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[8px] font-bold text-white animate-pulse">{notifications.length}</span>)}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-80 p-0 rounded-2xl border-none shadow-2xl overflow-hidden" align="end">
                                <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
                                    <h4 className="text-sm font-bold">Signals</h4>
                                    {notifications.length > 0 && (
                                        <Button variant="ghost" size="sm" onClick={handleClearLog} className="h-7 text-[9px] font-bold uppercase hover:bg-white/10 hover:text-white px-2">
                                            <Trash2 className="h-3 w-3 mr-1" /> Clear All
                                        </Button>
                                    )}
                                </div>
                                <ScrollArea className="max-h-[400px]">
                                    {notifications.length > 0 ? (
                                        <div className="divide-y divide-slate-50">
                                            {notifications.map((n) => (
                                                <DropdownMenuItem key={n.id} className="p-4 flex gap-4 cursor-pointer focus:bg-primary/5" onClick={() => n.link && router.push(n.link)}>
                                                    <div className={cn("p-2 rounded-xl bg-slate-100", n.color)}>
                                                        <n.icon className="h-4 w-4" />
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <p className={cn("font-bold text-[11px] uppercase", n.isUrgent ? "text-red-600" : "")}>{n.title}</p>
                                                        <p className="text-xs text-muted-foreground">{n.msg}</p>
                                                    </div>
                                                </DropdownMenuItem>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-20 text-center px-8">
                                            <Bell className="h-10 w-10 text-slate-100 mx-auto" />
                                            <p className="text-[10px] text-muted-foreground uppercase font-bold mt-2">No active signals</p>
                                        </div>
                                    )}
                                </ScrollArea>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                    <UserMenu />
                </>
              ) : (
                <div className="flex items-center gap-2 sm:gap-3">
                    <Button asChild variant="outline" className="border-2 border-primary text-primary hover:bg-primary/5 font-bold h-10 px-4 sm:px-6 rounded-xl hidden sm:inline-flex whitespace-nowrap">
                        <Link href="/login">Login</Link>
                    </Button>
                    <Button asChild className="bg-primary hover:bg-primary/90 text-white font-bold h-10 px-4 sm:px-6 rounded-xl shadow-lg whitespace-nowrap">
                        <Link href="/signup">Sign Up</Link>
                    </Button>
                </div>
              )}
              
              <Sheet open={isMobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild><Button variant="ghost" size="icon" className="md:hidden ml-2"><Menu className="h-6 w-6" /></Button></SheetTrigger>
                <SheetContent side="right" className="w-[300px] p-0 border-none rounded-l-[2rem] overflow-hidden">
                  <SheetHeader className="p-8 pb-0">
                    <SheetTitle className="sr-only">Main Navigation</SheetTitle>
                    <Logo />
                  </SheetHeader>
                  <div className="p-8 flex flex-col gap-6">
                    {navLinks.map((link) => (
                        <Link key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)} className={cn('text-lg font-bold uppercase tracking-widest transition-colors', pathname === link.href ? 'text-primary' : 'text-slate-500')}>
                            {link.label}
                        </Link>
                    ))}
                      {user ? (
                          <div className="flex flex-col gap-6 pt-6 border-t border-slate-100">
                            {userData?.role === 'doctor' && (
                                <>
                                    <Link href="/doctor-portal" onClick={() => setMobileMenuOpen(false)} className="text-lg font-bold uppercase tracking-widest text-slate-500">Dashboard</Link>
                                    <Link href="/doctor-portal/profile" onClick={() => setMobileMenuOpen(false)} className="text-lg font-bold uppercase tracking-widest text-slate-500">Professional Profile</Link>
                                </>
                            )}
                            {userData?.role === 'patient' && (
                                <>
                                    <Link href="/patient-portal" onClick={() => setMobileMenuOpen(false)} className="text-lg font-bold uppercase tracking-widest text-slate-500">Patient Portal</Link>
                                    <Link href="/patient-portal/profile" onClick={() => setMobileMenuOpen(false)} className="text-lg font-bold uppercase tracking-widest text-slate-500">Edit Personal Profile</Link>
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
                                <Link href="/signup">Sign Up</Link>
                            </Button>
                          </div>
                      )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
