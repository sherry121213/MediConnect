import Link from 'next/link';
import Logo from '@/components/logo';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Facebook, Twitter, Linkedin, Instagram } from 'lucide-react';

export default function AppFooter() {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* About Section */}
          <div className="lg:col-span-1">
            <Logo />
            <p className="mt-4 text-sm text-gray-400">
              Get the best online consultation from the best doctors and specialists in Pakistan through our mobile app.
            </p>
             <div className="flex space-x-4 mt-6">
                <Link href="#" className="text-gray-400 hover:text-accent"><Facebook size={20}/></Link>
                <Link href="#" className="text-gray-400 hover:text-accent"><Twitter size={20}/></Link>
                <Link href="#" className="text-gray-400 hover:text-accent"><Linkedin size={20}/></Link>
                <Link href="#" className="text-gray-400 hover:text-accent"><Instagram size={20}/></Link>
            </div>
          </div>
          
          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-white tracking-wider">Quick Links</h3>
            <ul className="mt-4 space-y-3 text-sm">
              <li><Link href="/find-a-doctor" className="text-gray-400 hover:text-accent">Find a Doctor</Link></li>
              <li><Link href="/appointments" className="text-gray-400 hover:text-accent">Appointments</Link></li>
              <li><Link href="/contact" className="text-gray-400 hover:text-accent">Contact Us</Link></li>
              <li><Link href="#" className="text-gray-400 hover:text-accent">About Us</Link></li>
            </ul>
          </div>
          
          {/* Contact Us */}
          <div>
             <h3 className="font-semibold text-white tracking-wider">Contact Us</h3>
             <ul className="mt-4 space-y-3 text-sm text-gray-400">
                <li><p>House 15, Street 2, F-6/3, Islamabad, Pakistan</p></li>
                <li><p>info@mediconnect.com</p></li>
                <li><p>+92 311 141142</p></li>
             </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="font-semibold text-white tracking-wider">Join our Newsletter</h3>
            <p className="mt-4 text-sm text-gray-400">Stay updated with our latest news and offers.</p>
            <div className="mt-4 flex">
                <Input type="email" placeholder="Your email" className="bg-gray-800 border-gray-700 rounded-r-none text-white placeholder-gray-500" />
                <Button className="bg-accent hover:bg-accent/90 rounded-l-none text-white">Subscribe</Button>
            </div>
          </div>
        </div>
        <div className="mt-12 border-t border-gray-800 pt-6 text-center text-sm text-gray-500">
          &copy; {new Date().getFullYear()} Mediconnect. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
