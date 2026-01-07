'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';

interface IdleTimerProps {
    idleTimeout?: number;
    countdownTime?: number;
}

const useIdleTimer = ({ idleTimeout = 30000, countdownTime = 7000 }: IdleTimerProps) => {
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
     const events = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll'];
     events.forEach(event => window.dispatchEvent(new Event(event)));
  }

  return { isIdle, countdown, reset };
};

export default useIdleTimer;
