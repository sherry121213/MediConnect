
'use client';

import { Firestore, writeBatch, doc } from 'firebase/firestore';
import type { Appointment, QueueStatus } from './types';

/**
 * Handles the core reordering logic for a queue block.
 * Rule: Active patient becomes 'in-consultation'. 
 * Bypassed 'waiting' patients become 'shifted' and move to the end of the block.
 */
export async function manageQueueShift(
  db: Firestore,
  appointmentsInBlock: Appointment[],
  targetAptId: string,
  newStatus: QueueStatus
) {
  const batch = writeBatch(db);
  const now = new Date().toISOString();

  // 1. Sort current appointments by sequence position
  const sorted = [...appointmentsInBlock].sort((a, b) => (a.sequencePosition || 0) - (b.sequencePosition || 0));
  
  const targetApt = sorted.find(a => a.id === targetAptId);
  if (!targetApt) return;

  const targetIndex = sorted.indexOf(targetApt);
  const updatedList: Appointment[] = [];
  const bypassedList: Appointment[] = [];
  const remainingList: Appointment[] = [];

  // 2. Identify bypassed waiting patients
  sorted.forEach((apt, idx) => {
    if (idx < targetIndex) {
      // If we are skipping this person to get to target
      if (apt.queueStatus === 'waiting' || apt.queueStatus === 'shifted') {
        bypassedList.push({
          ...apt,
          queueStatus: 'shifted',
          readyToStart: false, // Reset early start signal if bypassed
          updatedAt: now
        });
      } else {
        updatedList.push(apt);
      }
    } else if (idx === targetIndex) {
      // The one the doctor is acting on
      updatedList.push({
        ...apt,
        queueStatus: newStatus,
        updatedAt: now,
        readyToStart: newStatus === 'in-consultation'
      });
    } else {
      // Everyone after the target
      remainingList.push(apt);
    }
  });

  // 3. Reconstruct the sequence: [Previous non-waiting] + [Target] + [Remaining] + [Bypassed]
  const finalSequence = [...updatedList, ...remainingList, ...bypassedList];

  // 4. Update Firestore with new sequence positions
  finalSequence.forEach((apt, index) => {
    const aptRef = doc(db, 'appointments', apt.id);
    batch.update(aptRef, {
      sequencePosition: index + 1,
      queueStatus: apt.queueStatus || 'waiting',
      readyToStart: apt.readyToStart ?? false,
      updatedAt: now,
      ...(apt.id === targetAptId && newStatus === 'in-consultation' ? { readyToStart: true } : {})
    });
  });

  await batch.commit();
}
