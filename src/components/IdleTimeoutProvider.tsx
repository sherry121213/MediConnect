'use client';
import React, { ReactNode } from 'react';
import useIdleTimer from '@/hooks/useIdleTimer';
import { useUser } from '@/firebase';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { Button } from './ui/button';

export const IdleTimeoutProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useUser();
  const { isIdle, countdown, reset } = useIdleTimer({
    idleTimeout: 30000, 
    countdownTime: 7000 
  });

  const handleStay = () => {
    reset();
  };

  // Only run the idle timer if a user is logged in
  if (!user) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <AlertDialog open={isIdle}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you still there?</AlertDialogTitle>
            <AlertDialogDescription>
              You've been inactive for a while. For your security, we'll sign you out in {countdown} seconds.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button onClick={handleStay}>I'm still here</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
