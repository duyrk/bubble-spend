// JS facade for the Android notification-listener module. Android-only: on iOS
// (and in Expo Go) the native module is absent, so every call degrades to a
// harmless no-op and `isSupported` is false — callers gate UI on that flag.

import { requireOptionalNativeModule } from 'expo';
import type { EventSubscription } from 'expo-modules-core';
import type { RawCapture } from '@/types';

export type { RawCapture };

type NativeModuleShape = {
  isAccessGranted(): boolean;
  openAccessSettings(): void;
  requestRebind(): void;
  getAllowedPackages(): string[];
  setAllowedPackages(packages: string[]): void;
  isCaptureAll(): boolean;
  setCaptureAll(enabled: boolean): void;
  getInstalledPackages(packages: string[]): string[];
  peekPending(): string;
  drainPending(): string;
  clearPending(): void;
  removePending(ids: string[]): void;
  addListener(event: 'onCapture', listener: (capture: RawCapture) => void): EventSubscription;
};

const native = requireOptionalNativeModule<NativeModuleShape>('NotificationCapture');

export const isSupported = native != null;

function parseInbox(json: string | undefined): RawCapture[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as RawCapture[]) : [];
  } catch {
    return [];
  }
}

export const isAccessGranted = (): boolean => native?.isAccessGranted() ?? false;
export const openAccessSettings = (): void => native?.openAccessSettings();
export const requestRebind = (): void => native?.requestRebind();
export const getAllowedPackages = (): string[] => native?.getAllowedPackages() ?? [];
export const setAllowedPackages = (packages: string[]): void =>
  native?.setAllowedPackages(packages);
export const isCaptureAll = (): boolean => native?.isCaptureAll() ?? false;
export const setCaptureAll = (enabled: boolean): void => native?.setCaptureAll(enabled);
export const getInstalledPackages = (packages: string[]): string[] =>
  native?.getInstalledPackages(packages) ?? [];

// Read the inbox without consuming it (debug screen).
export const peekPending = (): RawCapture[] => parseInbox(native?.peekPending());
// Read and empty the inbox (capture pipeline).
export const drainPending = (): RawCapture[] => parseInbox(native?.drainPending());
export const clearPending = (): void => native?.clearPending();
// Ack processed captures (pipeline) — leaves anything that arrived meanwhile.
export const removePending = (ids: string[]): void => native?.removePending(ids);

export function addCaptureListener(listener: (capture: RawCapture) => void): EventSubscription | null {
  return native?.addListener('onCapture', listener) ?? null;
}
