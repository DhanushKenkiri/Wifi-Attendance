import { useCallback, useEffect, useRef, useState } from 'react';

const MS_IN_SECOND = 1000;

export const useCountdown = (targetTime, { onExpire } = {}) => {
  const safeTarget = Number.isFinite(targetTime) ? targetTime : 0;
  const [remaining, setRemaining] = useState(() => Math.max(0, safeTarget - Date.now()));
  const savedOnExpire = useRef(onExpire);
  const savedTarget = useRef(safeTarget);
  const durationRef = useRef(Math.max(1, safeTarget - Date.now()));

  useEffect(() => {
    savedOnExpire.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    const normalized = Number.isFinite(targetTime) ? targetTime : 0;
    savedTarget.current = normalized;
    durationRef.current = Math.max(1, normalized - Date.now());
    setRemaining(Math.max(0, normalized - Date.now()));
  }, [targetTime]);

  useEffect(() => {
    if (!Number.isFinite(savedTarget.current) || savedTarget.current <= 0) {
      return undefined;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const delta = Math.max(0, savedTarget.current - now);
      setRemaining(delta);

      if (delta === 0) {
        clearInterval(interval);
        savedOnExpire.current?.();
      }
    }, MS_IN_SECOND);

    return () => clearInterval(interval);
  }, [targetTime]);

  const reset = useCallback((nextTarget) => {
    const normalized = Number.isFinite(nextTarget) ? nextTarget : 0;
    savedTarget.current = normalized;
    durationRef.current = Math.max(1, normalized - Date.now());
    setRemaining(Math.max(0, normalized - Date.now()));
  }, []);

  const seconds = Math.ceil(remaining / MS_IN_SECOND);
  const percentRemaining = Math.min(100, Math.max(0, (remaining / durationRef.current) * 100));

  return {
    secondsRemaining: seconds,
    percentRemaining,
    isExpired: remaining <= 0,
    reset,
  };
};
