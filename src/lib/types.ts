export type Specialty = 'Psychiatrist' | 'Cardiologist' | 'General Physician' | 'Gynecologist' | 'Dermatology' | 'Orthopedics';

export interface Doctor {
  id: string;
  name?: string; // Keep for static data compatibility
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  specialty?: Specialty | string;
  location?: string;
  rating?: number;
  reviews?: number;
  isVerified?: boolean; // Keep for static data
  verified: boolean; // For Firestore data
  profileImageId?: string;
  photoURL?: string;
  bio?: string;
  medicalSchool?: string;
  degree?: string;
  experience?: number;
  degreeUrl?: string;
  profileComplete?: boolean;
  createdAt?: string;
  updatedAt?: string;
}


export interface Patient {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    dateOfBirth?: string;
    address?: string;
    photoURL?: string;
    role: 'patient' | 'doctor' | 'admin';
    profileComplete?: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentDateTime: string;
  appointmentType: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
