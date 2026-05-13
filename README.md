# MEDICONNECT - Secure Digital Healthcare Platform

Mediconnect is a high-fidelity, professional telemedicine platform designed to provide quality medical access across Pakistan.

## 🚀 Overview
The platform connects patients with verified healthcare professionals through encrypted 30-minute clinical windows. It features a robust multi-portal system (Patient, Doctor, Admin) designed for high-stakes medical environments.

## 🛠 Tech Stack
- **Framework**: Next.js 15 (App Router)
- **UI/UX**: React, Tailwind CSS, ShadCN UI
- **Backend**: Firebase (Authentication, Firestore, Storage)
- **Real-time**: Firebase Firestore Listeners
- **Icons**: Lucide React
- **Video/Audio**: WebRTC (Signaling via Firestore)

## 🩺 Technical Implementation

### 1. WebRTC Video Consultations
- **Peer-to-Peer**: High-quality, low-latency video/audio feed directly between devices.
- **Signaling**: Custom implementation using Firestore to exchange ICE candidates and SDP offers/answers.
- **Security**: Mandatory end-to-end encryption for all clinical sessions.
- **Precision Timing**: Clinical rooms unlock exactly at the scheduled time and auto-expire after the 30-minute professional window.

### 2. "Floating Page" UI Architecture
- **Anti-Crop Geometry**: Designed for mobile-first accessibility.
- **Stable Navigation**: Fixed-header and fixed-footer patterns in management dialogs ensure critical clinical actions (like "Finalize" or "Postpone") are always reachable.
- **Fluid Scrolling**: Independent scroll zones allow for long clinical notes and extensive patient histories on any screen size.

### 3. Data & Security
- **Role-Based Access**: Strict Firestore security rules protecting patient data.
- **Audit Trails**: Every missed session, leave request, and payment transaction is logged for administrative review.
- **Optimistic UI**: Real-time updates with background persistence for a lag-free experience.

## 🔒 Privacy Notice
This application is designed to be HIPAA-compliant, ensuring that all medical summaries and consultation history are encrypted and accessible only to the parties involved.
