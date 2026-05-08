'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, LogOut, User as UserIcon, Shield, LayoutDashboard, MessageCircle, CalendarClock, Monitor, Smartphone, Settings2 } from 'lucide-react';
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
import { useState, useEffect } from 'react';
import { useAuth, useUserData } from '@/firebase';
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
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/find-a-doctor', label: 'Find a Doctor' },
  { href: '/about', label: 'About Us' },
];

export default function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDesktopMode, setIsDesktopMode] = useState(false);
  const { user, userData, isUserLoading } = useUserData();
  const auth = useAuth();
  
  useEffect(() => {
    const savedMode = localStorage.getItem('desktop-mode') === 'true';
    setIsDesktopMode(savedMode);
    if (savedMode) {
      document.documentElement.classList.add('force-desktop');
    }
  }, []);

  const toggleDesktopMode = (enabled: boolean) => {
    setIsDesktopMode(enabled);
    localStorage.setItem('desktop-mode', String(enabled));
    if (enabled) {
      document.documentElement.classList.add('force-desktop');
    } else {
      document.documentElement.classList.remove('force-desktop');
    }
  };

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
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
               <AvatarImage src={userData?.photoURL || user?.photoURL || undefined} alt={displayName} />
               <AvatarFallback>{displayEmail?.[0].toUpperCase() ?? 'U'}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{displayName}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {displayEmail}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {userData?.role === 'doctor' && (
            <>
              <DropdownMenuItem onClick={() => router.push('/doctor-portal')}>
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  <span>Dashboard</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/doctor-portal/unavailability')}>
                <CalendarClock className="mr-2 h-4 w-4" />
                <span>Leave Requests</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/doctor-portal/chat')}>
                <MessageCircle className="mr-2 h-4 w-4" />
                <span>Support Chat</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/doctor-portal/profile')}>
                <UserIcon className="mr-2 h-4 w-4" />
                <span>Profile Settings</span>
              </DropdownMenuItem>
            </>
          )}

          {userData?.role === 'patient' && (
            <>
                <DropdownMenuItem onClick={() => router.push('/patient-portal')}>
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    <span>Patient Portal</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/patient-portal/profile')}>
                  <UserIcon className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
            </>
          )}
          
          {userData?.role === 'admin' && (
            <>
              <DropdownMenuItem onClick={() => router.push('/admin')}>
                <Shield className="mr-2 h-4 w-4" />
                <span>Admin Portal</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/profile')}>
                  <UserIcon className="mr-2 h-4 w-4" />
                  <span>Profile</span>
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />
          
          <div className="p-2 flex items-center justify-between">
              <Label htmlFor="desktop-mode-header" className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Monitor className="h-3 w-3" /> Desktop View
              </Label>
              <Switch 
                  id="desktop-mode-header" 
                  checked={isDesktopMode} 
                  onCheckedChange={toggleDesktopMode}
                  className="scale-75"
              />
          </div>

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
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
                    'text-base font-medium transition-colors hover:text-accent',
                    pathname === link.href ? 'text-primary' : 'text-foreground'
                )}
                >
                {link.label}
                </Link>
            ))}
            </nav>
        )}

        <div className="hidden md:flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-muted/40 rounded-full border border-dashed">
              <Monitor className={cn("h-3.5 w-3.5", isDesktopMode ? "text-primary" : "text-muted-foreground")} />
              <Switch 
                checked={isDesktopMode} 
                onCheckedChange={toggleDesktopMode}
                className="scale-75"
              />
          </div>
          {isUserLoading ? null : user ? (
            <UserMenu />
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/login">Log In</Link>
              </Button>
              <Button asChild className="bg-accent hover:bg-accent/90 text-white font-bold">
                <Link href="/signup">Sign Up</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile Navigation */}
        <Sheet open={isMobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[300px] sm:w-[400px]">
            <SheetHeader className="sr-only">
              <SheetTitle>Mobile Menu</SheetTitle>
              <SheetDescription>
                A list of navigation links for the site.
              </SheetDescription>
            </SheetHeader>
            
            <div className="flex items-center justify-between bg-primary/5 p-4 rounded-xl border border-primary/10 mt-8">
                <div className="flex items-center gap-2">
                    <Monitor className="h-5 w-5 text-primary" />
                    <div>
                        <p className="text-xs font-bold uppercase tracking-tight">Desktop View</p>
                        <p className="text-[10px] text-muted-foreground">Work like a laptop</p>
                    </div>
                </div>
                <Switch 
                    checked={isDesktopMode} 
                    onCheckedChange={(val) => { toggleDesktopMode(val); setMobileMenuOpen(false); }} 
                />
            </div>

            {userData?.role !== 'doctor' && (
                <nav className="flex flex-col gap-6 text-lg font-medium mt-8">
                {navLinks.map((link) => (
                    <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                        'transition-colors hover:text-accent',
                        pathname === link.href ? 'text-primary' : 'text-foreground'
                    )}
                    >
                    {link.label}
                    </Link>
                ))}
                </nav>
            )}
            <div className="mt-8 flex flex-col gap-2">
               {isUserLoading ? null : user ? (
                <div className="space-y-2">
                  {userData?.role === 'admin' && (
                    <>
                      <Button variant="outline" className="w-full" onClick={() => {router.push('/admin'); setMobileMenuOpen(false);}}>Admin Portal</Button>
                      <Button variant="outline" className="w-full" onClick={() => {router.push('/profile'); setMobileMenuOpen(false);}}>My Profile</Button>
                    </>
                  )}
                  {userData?.role === 'doctor' && (
                     <>
                      <Button variant="outline" className="w-full" onClick={() => {router.push('/doctor-portal'); setMobileMenuOpen(false);}}>Doctor Dashboard</Button>
                      <Button variant="outline" className="w-full" onClick={() => {router.push('/doctor-portal/profile'); setMobileMenuOpen(false);}}>Professional Profile</Button>
                      <Button variant="outline" className="w-full" onClick={() => {router.push('/doctor-portal/unavailability'); setMobileMenuOpen(false);}}>Leave Requests</Button>
                      <Button variant="outline" className="w-full" onClick={() => {router.push('/doctor-portal/chat'); setMobileMenuOpen(false);}}>Support Chat</Button>
                     </>
                  )}
                  {userData?.role === 'patient' && (
                    <>
                      <Button variant="outline" className="w-full" onClick={() => {router.push('/patient-portal'); setMobileMenuOpen(false);}}>Patient Portal</Button>
                      <Button variant="outline" className="w-full" onClick={() => {router.push('/patient-portal/profile'); setMobileMenuOpen(false);}}>My Profile</Button>
                    </>
                  )}
                  <Button variant="outline" className="w-full" onClick={() => {handleLogout(); setMobileMenuOpen(false);}}>Log Out</Button>
                </div>
               ) : (
                <>
                  <Button variant="ghost" asChild>
                    <Link href="/login" onClick={() => setMobileMenuOpen(false)}>Log In</Link>
                  </Button>
                  <Button asChild className="bg-accent hover:bg-accent/90 text-white font-bold">
                    <Link href="/signup" onClick={() => setMobileMenuOpen(false)}>Sign Up</Link>
                  </Button>
                </>
               )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}