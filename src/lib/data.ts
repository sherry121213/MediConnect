import type { Doctor, Specialty } from './types';

export const specialties: Specialty[] = [
  'Cardiology',
  'Dermatology',
  'Neurology',
  'Orthopedics',
  'Pediatrics',
  'General Physician',
];

export const doctors: Doctor[] = [
  {
    id: '1',
    name: 'Dr. Amina Khan',
    specialty: 'Cardiology',
    location: 'Karachi',
    rating: 4.9,
    reviews: 124,
    isVerified: true,
    profileImageId: 'doctor1',
    bio: 'Renowned cardiologist with 15 years of experience in treating complex heart conditions. Fellow of the American College of Cardiology.'
  },
  {
    id: '2',
    name: 'Dr. Bilal Ahmed',
    specialty: 'Dermatology',
    location: 'Lahore',
    rating: 4.8,
    reviews: 98,
    isVerified: true,
    profileImageId: 'doctor2',
    bio: 'Expert in cosmetic and clinical dermatology. Specializes in advanced acne treatments and anti-aging procedures.'
  },
  {
    id: '3',
    name: 'Dr. Fatima Zahra',
    specialty: 'Neurology',
    location: 'Islamabad',
    rating: 4.9,
    reviews: 85,
    isVerified: true,
    profileImageId: 'doctor3',
    bio: 'Leading neurologist focusing on migraine, epilepsy, and neurodegenerative diseases. Published in several international journals.'
  },
  {
    id: '4',
    name: 'Dr. Usman Ali',
    specialty: 'Orthopedics',
    location: 'Faisalabad',
    rating: 4.7,
    reviews: 150,
    isVerified: true,
    profileImageId: 'doctor4',
    bio: 'Specialist in sports injuries and joint replacement surgery. Has worked with national-level athletes.'
  },
  {
    id: '5',
    name: 'Dr. Sana Javed',
    specialty: 'Pediatrics',
    location: 'Karachi',
    rating: 5.0,
    reviews: 210,
    isVerified: true,
    profileImageId: 'doctor5',
    bio: 'Compassionate pediatrician dedicated to children\'s health and wellness, from newborns to adolescents.'
  },
  {
    id: '6',
    name: 'Dr. Hassan Raza',
    specialty: 'General Physician',
    location: 'Lahore',
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
    id: '8',
    name: 'Dr. Imran Khan',
    specialty: 'Dermatology',
    location: 'Karachi',
    rating: 4.7,
    reviews: 65,
    isVerified: false,
    profileImageId: 'doctor8',
    bio: 'A dermatologist with a focus on skin cancer screening and treatment of chronic skin conditions like psoriasis.'
  },
];
