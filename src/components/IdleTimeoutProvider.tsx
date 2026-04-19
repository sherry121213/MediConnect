'use client';
import React, { ReactNode, useState, useEffect } from 'react';
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
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const { isIdle, countdown, reset } = useIdleTimer({
    idleTimeout: 120000, 
    countdownTime: 30000 
  });

  const handleStay = () => {
    reset();
  };

  // Only run the idle timer if a user is logged in and component is mounted
  if (!user || !mounted) {
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
