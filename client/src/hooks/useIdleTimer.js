import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useIdleTimer
 * ─────────────────────────────────────────────────────────────
 * Tracks user inactivity across a page.
 *
 * @param {object}   opts
 * @param {number}   opts.timeoutSeconds  - Idle threshold (default 30)
 * @param {Function} opts.onTimeout       - Called when countdown reaches 0
 * @param {boolean}  [opts.disabled]      - Pass true to disable entirely (e.g. Capture page)
 * @returns {{ secondsLeft: number, reset: Function }}
 */
export const useIdleTimer = ({ timeoutSeconds = 30, onTimeout, disabled = false }) => {
  const [secondsLeft, setSecondsLeft] = useState(timeoutSeconds);
  const timerRef     = useRef(null);
  const secondsRef   = useRef(timeoutSeconds);
  const onTimeoutRef = useRef(onTimeout);

  // Keep latest callback without re-registering listeners
  useEffect(() => { onTimeoutRef.current = onTimeout; }, [onTimeout]);

  const reset = useCallback(() => {
    secondsRef.current = timeoutSeconds;
    setSecondsLeft(timeoutSeconds);
  }, [timeoutSeconds]);

  useEffect(() => {
    if (disabled) return;

    // Tick every second
    timerRef.current = setInterval(() => {
      secondsRef.current -= 1;
      setSecondsLeft(secondsRef.current);
      if (secondsRef.current <= 0) {
        clearInterval(timerRef.current);
        onTimeoutRef.current?.();
      }
    }, 1000);

    // User interaction events — any of these reset the countdown
    const interactionEvents = ['mousemove', 'mousedown', 'touchstart', 'keypress', 'scroll'];

    const handleInteraction = () => {
      secondsRef.current = timeoutSeconds;
      setSecondsLeft(timeoutSeconds);
    };

    interactionEvents.forEach(evt =>
      window.addEventListener(evt, handleInteraction, { passive: true })
    );

    return () => {
      clearInterval(timerRef.current);
      interactionEvents.forEach(evt =>
        window.removeEventListener(evt, handleInteraction)
      );
    };
  }, [timeoutSeconds, disabled]);

  return { secondsLeft, reset };
};
