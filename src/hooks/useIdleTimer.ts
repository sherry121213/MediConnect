'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';

const useIdleTimer = (idleTimeout = 30000, countdownTime = 7000) => {
  const [isIdle, setIsIdle] = useState(false);
  const [countdown, setCountdown] = useState(countdownTime / 1000);
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
    let idleTimer: NodeJS.Timeout;
    let countdownTimer: NodeJS.Timeout;

    const resetTimers = () => {
      clearTimeout(idleTimer);
      clearTimeout(countdownTimer);
      setIsIdle(false);
      setCountdown(countdownTime / 1000);

      idleTimer = setTimeout(() => {
        setIsIdle(true);
      }, idleTimeout);
    };

    const events = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll'];

    events.forEach(event => window.addEventListener(event, resetTimers));
    resetTimers();

    return () => {
      events.forEach(event => window.removeEventListener(event, resetTimers));
      clearTimeout(idleTimer);
      clearTimeout(countdownTimer);
    };
  }, [idleTimeout, countdownTime]);

  useEffect(() => {
    let countdownInterval: NodeJS.Timeout;

    if (isIdle) {
      countdownInterval = setInterval(() => {
        setCountdown(prev => {
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
  }, [isIdle, handleSignOut]);

  const reset = () => {
     setIsIdle(false);
     setCountdown(countdownTime / 1000);
  }

  return { isIdle, countdown, reset };
};

export default useIdleTimer;
