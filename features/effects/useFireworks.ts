// Particle state controller for the Fireworks overlay.
// Two-burst pattern: 18 particles at 0ms, 18 at 60ms = 36 total.
// Caller passes the glow color directly so this hook stays theme-agnostic.

import { useCallback, useState } from 'react';
import { Dimensions } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const PARTICLES_PER_BURST = 18;
const BURST_OFFSETS_MS = [0, 60] as const;
const LIFETIME_MS = 900;
const DEFAULT_GLOW = 'rgba(180,200,255,0.9)';

export type Particle = {
  id: number;
  startX: number;
  startY: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  delay: number;
};

let idCounter = 0;

function pickColor(categoryGlow: string, i: number): string {
  // Mix: ~1/3 white, ~2/3 category glow
  if (i % 3 === 0) return '#ffffff';
  return categoryGlow;
}

export function useFireworks() {
  const [particles, setParticles] = useState<Particle[]>([]);

  const trigger = useCallback(
    (centerXPct: number, centerYPct: number, glowColor?: string) => {
      const cx = (centerXPct / 100) * SCREEN_W;
      const cy = (centerYPct / 100) * (SCREEN_H * 0.5) + 120;

      const glow = glowColor ?? DEFAULT_GLOW;

      const newParticles: Particle[] = [];

      BURST_OFFSETS_MS.forEach((delay) => {
        for (let i = 0; i < PARTICLES_PER_BURST; i++) {
          const angle = (i / PARTICLES_PER_BURST) * Math.PI * 2;
          const speed = 90 + Math.random() * 100;
          newParticles.push({
            id: ++idCounter,
            startX: cx,
            startY: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - speed * 0.4,
            color: pickColor(glow, i),
            size: 3 + Math.random() * 2,
            delay,
          });
        }
      });

      setParticles(newParticles);
      setTimeout(() => setParticles([]), LIFETIME_MS + 200);
    },
    [],
  );

  return { particles, trigger };
}

export { LIFETIME_MS };
