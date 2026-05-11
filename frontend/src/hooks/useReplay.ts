import { useState, useCallback, useRef, useEffect } from "react";

export interface ReplayState {
  visibleUpTo: number;
  isPlaying: boolean;
  speed: number;
  play: () => void;
  pause: () => void;
  stepForward: () => void;
  stepBack: () => void;
  jumpTo: (turn: number) => void;
  jumpToStart: () => void;
  jumpToEnd: () => void;
  setSpeed: (s: number) => void;
}

export function useReplay(totalTurns: number): ReplayState {
  const [visibleUpTo, setVisibleUpTo] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1 / 3);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const pause = useCallback(() => {
    setIsPlaying(false);
    clearTimer();
  }, [clearTimer]);

  const play = useCallback(() => {
    setIsPlaying(true);
    // If at end, reset to beginning; otherwise keep position
    setVisibleUpTo((prev) => {
      if (prev >= totalTurns - 1) return -1;
      return prev;
    });
  }, [totalTurns]);

  useEffect(() => {
    if (!isPlaying) {
      clearTimer();
      return;
    }
    // Immediately advance on first tick — no dead wait
    const advance = () => {
      setVisibleUpTo((prev) => {
        const next = prev + 1;
        if (next >= totalTurns) {
          setIsPlaying(false);
          return totalTurns - 1;
        }
        return next;
      });
    };
    // Fire the first advance immediately
    advance();
    // Then continue on interval
    // Base: 2200ms at 1x — typing (800ms) + entrance (800ms) + reading pause (600ms)
    const interval = Math.max(400, 2200 / speed);
    timerRef.current = setInterval(advance, interval);
    return clearTimer;
  }, [isPlaying, speed, totalTurns, clearTimer]);

  const stepForward = useCallback(() => {
    pause();
    setVisibleUpTo((prev) => Math.min(prev + 1, totalTurns - 1));
  }, [pause, totalTurns]);

  const stepBack = useCallback(() => {
    pause();
    setVisibleUpTo((prev) => Math.max(prev - 1, -1));
  }, [pause]);

  const jumpTo = useCallback(
    (turn: number) => {
      pause();
      setVisibleUpTo(Math.max(-1, Math.min(turn, totalTurns - 1)));
    },
    [pause, totalTurns],
  );

  const jumpToStart = useCallback(() => {
    pause();
    setVisibleUpTo(-1);
  }, [pause]);

  const jumpToEnd = useCallback(() => {
    pause();
    setVisibleUpTo(totalTurns - 1);
  }, [pause, totalTurns]);

  return {
    visibleUpTo,
    isPlaying,
    speed,
    play,
    pause,
    stepForward,
    stepBack,
    jumpTo,
    jumpToStart,
    jumpToEnd,
    setSpeed,
  };
}
