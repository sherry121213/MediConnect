
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from '@/components/ui/sidebar';
import Logo from '@/components/logo';
import {
  LayoutDashboard,
  Stethoscope,
  CreditCard,
  LogOut,
  Users,
  MessageCircle,
  CalendarClock,
  AlertCircle,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth, useUserData, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';

export default function AdminSidebar() {
  const pathname = usePathname();
  const { user, userData } = useUserData();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();

  // Notification listeners for Admin
  const requestsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'doctorUnavailabilityRequests'), where('status', '==', 'pending'));
  }, [firestore]);
  const { data: pendingRequests } = useCollection(requestsQuery);

  const chatsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'adminDoctorChatSessions'), where('lastMessageSenderRole', '==', 'doctor'));
  }, [firestore]);
  const { data: unreadChats } = useCollection(chatsQuery);

  const paymentsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'appointments'), where('paymentStatus', '==', 'pending'));
  }, [firestore]);
  const { data: pendingPayments } = useCollection(paymentsQuery);

  const adminNavItems = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/doctors', label: 'Doctors', icon: Stethoscope },
    { href: '/admin/patients', label: 'Patients', icon: Users },
    { href: '/admin/requests', label: 'Clinical Requests', icon: CalendarClock, badge: pendingRequests?.length },
    { href: '/admin/payments', label: 'Payments', icon: CreditCard, badge: pendingPayments?.length },
    { href: '/admin/missed-slots', label: 'Missed Audits', icon: AlertCircle },
    { href: '/admin/chats', label: 'Messages', icon: MessageCircle, badge: unreadChats?.length },
  ];

  const handleLogout = () => {
    if (auth) {
      signOut(auth).then(() => {
        router.push('/');
      });
    }
  };
  
  const displayName = [userData?.firstName, userData?.lastName].filter(Boolean).join(' ') || 'Admin';
  const displayEmail = user?.email || '';
  const fallback = displayName.split(' ').map(n => n[0]).join('');

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <Logo />
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {adminNavItems.map((item) => (
            <SidebarMenuItem key={item.label}>
              <Link href={item.href}>
                <SidebarMenuButton
                  isActive={pathname === item.href}
                  tooltip={{ children: item.label, side: 'right' }}
                  className="relative"
                >
                  <item.icon />
                  <span>{item.label}</span>
                  {item.badge && item.badge > 0 ? (
                    <Badge className="ml-auto bg-primary h-5 min-w-5 flex items-center justify-center p-0 text-[10px] rounded-full">
                        {item.badge}
                    </Badge>
                  ) : null}
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <Separator />
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 p-2">
              <Avatar className="h-9 w-9">
                 <AvatarImage src={user?.photoURL || undefined} />
                 <AvatarFallback>{fallback || "A"}</AvatarFallback>
              </Avatar>
              <div className="group-data-[collapsible=icon]:hidden overflow-hidden">
                <p className="text-sm font-semibold truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
              </div>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
             <SidebarMenuButton onClick={handleLogout}>
                <LogOut />
                <span>Logout</span>
              </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
