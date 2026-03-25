import { useState, useEffect } from "react";

/**
 * Hook to calculate and format the duration of a live stream.
 * @param startedAt The ISO date string when the stream started.
 * @returns Formatted duration string (MM:SS or HH:MM:SS)
 */
export function useLiveTimer(startedAt?: string | Date | null) {
  const [duration, setDuration] = useState("00:00");

  useEffect(() => {
    if (!startedAt) {
      setDuration("00:00");
      return;
    }

    const startTime = new Date(startedAt).getTime();
    if (isNaN(startTime)) {
      setDuration("00:00");
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, now - startTime);

      const seconds = Math.floor((diff / 1000) % 60);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const hours = Math.floor(diff / (1000 * 60 * 60));

      const pad = (n: number) => n.toString().padStart(2, "0");

      if (hours > 0) {
        setDuration(`${hours}:${pad(minutes)}:${pad(seconds)}`);
      } else {
        setDuration(`${pad(minutes)}:${pad(seconds)}`);
      }
    };

    updateTimer(); // Initial call
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

  return duration;
}
