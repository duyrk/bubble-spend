// App configuration constants

export const GYROSCOPE = {
  MAX_DRIFT: 8, // max px offset from tilt
  SMOOTHING_ALPHA: 0.1, // low-pass filter coefficient
  UPDATE_INTERVAL: 16, // ~60fps in ms
} as const;

export const GESTURE = {
  TAP_MAX_DURATION: 500, // ms — tap vs long-press threshold
  DRAG_ACTIVATION_DELAY: 500, // ms — long press to enter drag mode
  SWIPE_ACTIVATE_OFFSET: 20, // horizontal px before a Home period swipe commits
} as const;

export const DB_NAME = 'bubble-spend.db';
