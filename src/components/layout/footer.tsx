import Link from 'next/link';
import Logo from '@/components/logo';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Facebook, Twitter, Linkedin, Instagram, HeartPulse } from 'lucide-react';

export default function AppFooter() {
  return (
    <footer className="bg-slate-950 text-white border-t border-white/5">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* About Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-2">
                <div className="bg-primary rounded-xl p-1.5">
                    <HeartPulse className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold font-headline text-white tracking-tight">Mediconnect</span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              Democratizing healthcare access in Pakistan through high-fidelity clinical sessions and verified professional care.
            </p>
             <div className="flex space-x-3">
                <Link href="#" className="h-9 w-9 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:bg-primary hover:text-white transition-all"><Facebook size={18}/></Link>
                <Link href="#" className="h-9 w-9 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:bg-primary hover:text-white transition-all"><Twitter size={18}/></Link>
                <Link href="#" className="h-9 w-9 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:bg-primary hover:text-white transition-all"><Linkedin size={18}/></Link>
                <Link href="#" className="h-9 w-9 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:bg-primary hover:text-white transition-all"><Instagram size={18}/></Link>
            </div>
          </div>
          
          {/* Quick Links */}
          <div className="space-y-6">
            <h3 className="font-bold text-xs uppercase tracking-[0.2em] text-primary">Resources</h3>
            <ul className="space-y-3 text-sm">
              <li><Link href="/find-a-doctor" className="text-slate-400 hover:text-white transition-colors">Find a Specialist</Link></li>
              <li><Link href="/patient-portal" className="text-slate-400 hover:text-white transition-colors">Digital Portal</Link></li>
              <li><Link href="/about" className="text-slate-400 hover:text-white transition-colors">Corporate Care</Link></li>
              <li><Link href="/about#contact" className="text-slate-400 hover:text-white transition-colors">Partnerships</Link></li>
            </ul>
          </div>
          
          {/* Contact Us */}
          <div className="space-y-6">
             <h3 className="font-bold text-xs uppercase tracking-[0.2em] text-primary">Headquarters</h3>
             <ul className="space-y-3 text-sm text-slate-400">
                <li><p>F-6/3 Blue Area, Islamabad, PK</p></li>
                <li><p className="font-medium text-white">info@mediconnect.pk</p></li>
                <li><p>+92 311 141142</p></li>
             </ul>
          </div>

          {/* Newsletter */}
          <div className="space-y-6">
            <h3 className="font-bold text-xs uppercase tracking-[0.2em] text-primary">Clinical Updates</h3>
            <p className="text-sm text-slate-400">Stay informed with essential health and safety advice.</p>
            <div className="flex gap-2">
                <Input type="email" placeholder="Professional email" className="bg-white/5 border-white/10 rounded-xl text-white placeholder-slate-500 focus-visible:ring-primary h-11" />
                <Button className="bg-primary hover:bg-primary/90 rounded-xl h-11 px-6 font-bold shadow-lg shadow-primary/10">Join</Button>
            </div>
          </div>
        </div>
        <div className="mt-16 pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] uppercase font-bold tracking-widest text-slate-500">
          <p>&copy; {new Date().getFullYear()} Mediconnect Pakistan. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="#" className="hover:text-primary transition-colors">Privacy Protocol</Link>
            <Link href="#" className="hover:text-primary transition-colors">Terms of Care</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
