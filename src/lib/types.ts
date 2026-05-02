export type Specialty = 'Psychiatrist' | 'Cardiologist' | 'General Physician' | 'Gynecologist' | 'Dermatology' | 'Orthopedics';

export interface DoctorAvailability {
  days: string[]; // ["Mon", "Tue", etc]
  disabledSlots: string[]; // ["09:00 AM", etc]
}

export interface Doctor {
  id: string;
  name?: string; 
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  specialty?: Specialty | string;
  location?: string;
  rating?: number;
  reviews?: number;
  verified: boolean;
  isActive?: boolean;
  profileImageId?: string;
  photoURL?: string;
  bio?: string;
  medicalSchool?: string;
  degree?: string;
  experience?: number;
  documents?: string[];
  profileComplete?: boolean;
  createdAt?: string;
  updatedAt?: string;
  availability?: DoctorAvailability;
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
  diagnosis?: string;
  prescription?: string;
  createdAt: string;
  updatedAt: string;
  amount?: number;
  paymentReceiptUrl?: string;
  paymentStatus?: 'pending' | 'approved' | 'rejected';
  paymentMethod?: string;
}
