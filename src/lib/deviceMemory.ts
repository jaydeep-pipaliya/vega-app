import {NativeModules} from 'react-native';
import {BUFFER_LIMITS} from './storage';

// Both must match the react-native-video patch (RNVLoadControl).
// Share of the app's Java heap the buffers may use.
const BUFFER_HEAP_SHARE = 0.35;
// Share of total device RAM the buffers may use: 1/32 gives 64 MB on a 2 GB
// TV box and about 230 MB on an 8 GB phone.
const BUFFER_RAM_DIVISOR = 32;
// Used when the native module is missing: a low-end phone.
const FALLBACK_HEAP_LIMIT_MB = 192;
const FALLBACK_TOTAL_RAM_MB = 2048;

const readNative = (name: 'heapLimitMB' | 'totalRamMB', fallback: number) => {
  const module = NativeModules.VegaDeviceMemory;
  const getter = name === 'heapLimitMB' ? 'getHeapLimitMB' : 'getTotalRamMB';
  let value: unknown;
  try {
    // Bridgeless interop exposes module constants through getConstants();
    // the sync method covers builds where constants are not forwarded.
    value =
      module?.[name] ?? module?.getConstants?.()?.[name] ?? module?.[getter]?.();
  } catch {}
  return typeof value === 'number' && value > 0 ? value : fallback;
};

/** The app's Java heap limit in MB (includes largeHeap). */
export const getHeapLimitMB = () =>
  readNative('heapLimitMB', FALLBACK_HEAP_LIMIT_MB);

/** Total device RAM in MB. */
export const getTotalRamMB = () =>
  readNative('totalRamMB', FALLBACK_TOTAL_RAM_MB);

/**
 * Largest forward + back buffer total the player will use on this device,
 * bounded by both the heap and total RAM, rounded down to the slider step.
 */
export const getSafeBufferTotalMB = (): number => {
  const step = BUFFER_LIMITS.step;
  const limitMB = Math.min(
    getHeapLimitMB() * BUFFER_HEAP_SHARE,
    getTotalRamMB() / BUFFER_RAM_DIVISOR,
    BUFFER_LIMITS.forwardMax + BUFFER_LIMITS.backMax,
  );
  const total = Math.floor(limitMB / step) * step;
  // Leave room for both sliders to have a range.
  return Math.max(total, BUFFER_LIMITS.forwardMin + 2 * step);
};
