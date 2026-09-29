import {useEffect, useRef} from 'react';
import {DeviceEventEmitter} from 'react-native';
import * as RN from 'react-native';
import {isTV} from './constants';

export interface TVRemoteEvent {
  eventType:
    | 'select'
    | 'playPause'
    | 'menu'
    | 'left'
    | 'right'
    | 'up'
    | 'down'
    | 'back'
    | string;
  eventKeyAction?: number;
  tag?: number;
  target?: number;
}

export type TVRemoteHandler = (event: TVRemoteEvent) => void;

export const useTVRemote = (handler: TVRemoteHandler, enabled: boolean = true) => {
  const handlerRef = useRef<TVRemoteHandler>(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!isTV || !enabled) {
      return;
    }

    const rnAny = RN as any;
    let tvSub: any = null;
    let deviceSub: {remove: () => void} | null = null;
    if (typeof rnAny.TVEventHandler?.addListener === 'function') {
      try {
        tvSub = rnAny.TVEventHandler.addListener((evt: TVRemoteEvent) => {
          if (evt && evt.eventType !== 'focus' && evt.eventType !== 'blur') {
            handlerRef.current(evt);
          }
        });
      } catch {
        // TVEventHandler may not be supported on all environments
      }
    }
    // TVEventHandler listens to onHWKeyEvent internally. Subscribing to both
    // sources sends each D-pad press twice (including two 10-second skips).
    if (!tvSub) {
      deviceSub = DeviceEventEmitter.addListener('onHWKeyEvent', (evt: TVRemoteEvent) => {
        if (evt && evt.eventType !== 'focus' && evt.eventType !== 'blur') {
          handlerRef.current(evt);
        }
      });
    }

    return () => {
      deviceSub?.remove?.();
      tvSub?.remove?.();
    };
  }, [enabled]);
};
