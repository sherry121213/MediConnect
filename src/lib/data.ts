
import type { Doctor } from '@/lib/types';
import { Specialty } from '@/lib/types';

export const specialties: Specialty[] = [
  'Psychiatrist',
  'Cardiologist',
  'General Physician',
  'Gynecologist',
  'Dermatology',
  'Orthopedics'
];

export const doctors: Doctor[] = [
  {
    id: '1',
    name: 'Dr. Amina Khan',
    specialty: 'Cardiology',
    location: 'Islamabad',
    rating: 4.9,
    reviews: 124,
    isVerified: true,
    profileImageId: 'doctor1',
    bio: 'Renowned cardiologist with 15 years of experience in treating complex heart conditions. Fellow of the American College of Cardiology.'
  },
  {
    id: '6',
    name: 'Dr. Hassan Raza',
    specialty: 'General Physician',
    location: 'Rawalpindi',
    rating: 4.8,
    reviews: 302,
    isVerified: true,
    profileImageId: 'doctor6',
    bio: 'Experienced general physician providing comprehensive primary care for all ages. Strong focus on preventive medicine.'
  },
  {
    id: '7',
    name: 'Dr. Ayesha Malik',
    specialty: 'Cardiology',
    location: 'Islamabad',
    rating: 4.8,
    reviews: 76,
    isVerified: true,
    profileImageId: 'doctor7',
    bio: 'Interventional cardiologist specializing in minimally invasive procedures. Passionate about patient education on heart health.'
  },
  {
    id: '12',
    name: 'Dr. Fawad Khan',
    specialty: 'General Physician',
    location: 'Islamabad',
    rating: 4.7,
    reviews: 250,
    isVerified: true,
    profileImageId: 'doctor1',
    bio: 'Your friendly neighborhood GP, great with chronic disease management.'
  },
  {
    id: '18',
    name: 'Dr. Saad Abbasi',
    specialty: 'General Physician',
    location: 'Rawalpindi',
    rating: 4.7,
    reviews: 215,
    isVerified: true,
    profileImageId: 'doctor4',
    bio: 'A trusted family physician in Rawalpindi, providing comprehensive healthcare for all ages.'
  },
  {
    id: '20',
    name: 'Dr. Nadia Hassan',
    specialty: 'Psychiatrist',
    location: 'Islamabad',
    rating: 4.9,
    reviews: 150,
    isVerified: true,
    profileImageId: 'doctor2',
    bio: 'Expert in treating a wide range of mental health issues including anxiety, depression, and PTSD.'
  },
  {
    id: '21',
    name: 'Dr. Sara Ahmed',
    specialty: 'Gynecologist',
    location: 'Rawalpindi',
    rating: 4.8,
    reviews: 180,
    isVerified: true,
    profileImageId: 'doctor3',
    bio: 'Compassionate gynecologist providing comprehensive women\'s health care services.'
  },
  {
    id: '22',
    name: 'Dr. Khalid Mehmood',
    specialty: 'Psychiatrist',
    location: 'Islamabad',
    rating: 4.7,
    reviews: 130,
    isVerified: true,
    profileImageId: 'doctor4',
    bio: 'Specializing in adolescent and adult psychiatry, with a focus on therapy and medication management.'
  }
];

