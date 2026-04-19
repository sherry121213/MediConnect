'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';

interface IdleTimerProps {
    idleTimeout?: number;
    countdownTime?: number;
}

const useIdleTimer = ({ idleTimeout = 120000, countdownTime = 30000 }: IdleTimerProps) => {
  const [isIdle, setIsIdle] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const auth = useAuth();
  const router = useRouter();

  const handleSignOut = useCallback(() => {
    if (auth) {
      signOut(auth).then(() => {
        router.push('/login');
      });
    }
  }, [auth, router]);

  useEffect(() => {
    setIsMounted(true);
    setCountdown(countdownTime / 1000);

    let idleTimer: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(idleTimer);
      setIsIdle(false);
      setCountdown(countdownTime / 1000);

      idleTimer = setTimeout(() => {
        setIsIdle(true);
      }, idleTimeout);
    };

    const events = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll'];

    events.forEach(event => window.addEventListener(event, resetTimer));
    resetTimer();

    return () => {
      events.forEach(event => window.removeEventListener(event, resetTimer));
      clearTimeout(idleTimer);
    };
  }, [idleTimeout, countdownTime]);

  useEffect(() => {
    let countdownInterval: NodeJS.Timeout;

    if (isIdle && isMounted) {
      countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev === null) return null;
          if (prev <= 1) {
            clearInterval(countdownInterval);
            handleSignOut();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(countdownInterval);
  }, [isIdle, isMounted, handleSignOut]);

  const reset = () => {
     const events = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll'];
     events.forEach(event => window.dispatchEvent(new Event(event)));
  }

  // Ensure countdown value used in render is hydration-safe
  const displayCountdown = isMounted ? (countdown ?? (countdownTime / 1000)) : (countdownTime / 1000);

  return { isIdle, countdown: displayCountdown, reset };
};

export default useIdleTimer;