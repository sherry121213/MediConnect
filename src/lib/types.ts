export type Specialty = 'Cardiology' | 'Dermatology' | 'Neurology' | 'Orthopedics' | 'Pediatrics' | 'General Physician';

export interface Doctor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  specialty: Specialty;
  location?: string;
  ratings?: number;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
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
