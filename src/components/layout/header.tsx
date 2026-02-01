'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, LogOut, User as UserIcon, Shield, LayoutDashboard } from 'lucide-react';
import Logo from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useState } from 'react';
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
  const auth = useAuth();
  
  const handleLogout = () => {
    if (auth) {
      signOut(auth).then(() => {
        router.push('/');
      });
    }
  };
  
  const handleProfileClick = () => {
    router.push('/profile');
  }

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
          {userData?.role === 'admin' && (
            <DropdownMenuItem onClick={() => router.push('/admin')}>
              <Shield className="mr-2 h-4 w-4" />
              <span>Admin Portal</span>
            </DropdownMenuItem>
          )}
          {userData?.role === 'patient' && (
              <DropdownMenuItem onClick={() => router.push('/patient-portal')}>
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  <span>Patient Portal</span>
              </DropdownMenuItem>
          )}
          {userData?.role === 'doctor' && (
              <DropdownMenuItem onClick={() => router.push('/doctor-portal')}>
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  <span>Doctor Portal</span>
              </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={handleProfileClick}>
            <UserIcon className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </DropdownMenuItem>
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

        <div className="hidden md:flex items-center gap-2">
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
            {userData?.role !== 'doctor' && (
                <nav className="flex flex-col gap-6 text-lg font-medium mt-12">
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
                  {userData?.role === 'admin' && <Button variant="outline" className="w-full" onClick={() => {router.push('/admin'); setMobileMenuOpen(false);}}>Admin Portal</Button>}
                  {userData?.role === 'doctor' && <Button variant="outline" className="w-full" onClick={() => {router.push('/doctor-portal'); setMobileMenuOpen(false);}}>Doctor Portal</Button>}
                  {userData?.role === 'patient' && <Button variant="outline" className="w-full" onClick={() => {router.push('/patient-portal'); setMobileMenuOpen(false);}}>Patient Portal</Button>}
                  <Button variant="outline" className="w-full" onClick={() => {handleProfileClick(); setMobileMenuOpen(false);}}>My Profile</Button>
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
