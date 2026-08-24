import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A resend cooldown.
 *
 * All three OTP pages ran their own copy of this, each with its own interval
 * and its own off-by-one. The interval is torn down on unmount and when it
 * reaches zero, and the deadline is stored as a timestamp rather than
 * decremented - a decrementing counter drifts, and stops entirely while a
 * background tab is throttled, so the button can unlock late or never.
 */
export const useCountdown = (seconds: number) => {
  const [remaining, setRemaining] = useState(0);
  const deadline = useRef(0);

  const tick = useCallback(() => {
    const left = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
    setRemaining(left);
    return left;
  }, []);

  useEffect(() => {
    if (remaining <= 0) return undefined;

    const timer = setInterval(() => {
      if (tick() <= 0) clearInterval(timer);
    }, 250);

    return () => clearInterval(timer);
  }, [remaining, tick]);

  const start = useCallback(() => {
    deadline.current = Date.now() + seconds * 1000;
    setRemaining(seconds);
  }, [seconds]);

  return { remaining, isCoolingDown: remaining > 0, start };
};
