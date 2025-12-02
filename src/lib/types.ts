export type Specialty = 'Cardiology' | 'Dermatology' | 'Neurology' | 'Orthopedics' | 'Pediatrics' | 'General Physician' | 'Endocrinology' | 'Gastroenterology' | 'Oncology';

export interface Doctor {
  id: string;
  name: string;
  specialty: Specialty;
  location: string;
  rating: number;
  reviews: number;
  isVerified: boolean;
  profileImageId: string;
  bio: string;
}

export interface Patient {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: 'patient' | 'doctor' | 'admin';
    createdAt: string;
    updatedAt: string;
}
