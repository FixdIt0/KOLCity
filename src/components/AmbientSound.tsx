"use client";
import { useRef, useEffect } from "react";

export default function AmbientSound({ enabled }: { enabled: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioRef.current) {
      const a = new Audio("/bgm.mp3");
      a.loop = true;
      a.volume = 0.4;
      audioRef.current = a;
    }
    if (enabled) audioRef.current.play().catch(() => {});
    else audioRef.current.pause();
    return () => { audioRef.current?.pause(); };
  }, [enabled]);

  return null;
}
