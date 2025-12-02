export type Specialty = 'Cardiology' | 'Dermatology' | 'Neurology' | 'Orthopedics' | 'Pediatrics' | 'General Physician' | 'Endocrinology' | 'Gastroenterology' | 'Oncology';

export interface Doctor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  specialty?: string;
  location?: string;
  rating?: number;
  reviews?: number;
  verified: boolean;
  profileImageId?: string;
  bio?: string;
  medicalSchool?: string;
  degree?: string;
  profileComplete?: boolean;
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
