export type Specialty = 'Cardiology' | 'Dermatology' | 'Neurology' | 'Orthopedics' | 'Pediatrics' | 'General Physician';

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
