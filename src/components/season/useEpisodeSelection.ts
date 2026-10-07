import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {BackHandler, Clipboard, ToastAndroid} from 'react-native';
import {
  EpisodeLinkTarget,
  FetchEpisodeStreams,
  copiedLinksMessage,
  resolveEpisodeLinks,
} from '../../lib/episodeLinks';

export interface CopyProgress {
  current: number;
  total: number;
}

interface UseEpisodeSelectionOptions {
  /** Every episode of the season, in season order. */
  items: EpisodeLinkTarget[];
  /** Selection ends when this changes, e.g. on season change. */
  resetKey: string | undefined;
  fetchStreams: FetchEpisodeStreams;
}

export const useEpisodeSelection = ({
  items,
  resetKey,
  fetchStreams,
}: UseEpisodeSelectionOptions) => {
  const [active, setActive] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [progress, setProgress] = useState<CopyProgress | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const stopCopy = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setProgress(null);
  }, []);

  const exit = useCallback(() => {
    stopCopy();
    setSelected(new Set());
    setActive(false);
  }, [stopCopy]);

  const start = useCallback((link?: string) => {
    setSelected(new Set(link ? [link] : []));
    setActive(true);
  }, []);

  const toggle = useCallback((link: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(link)) {
        next.delete(link);
      } else {
        next.add(link);
      }
      return next;
    });
  }, []);

  const allSelected =
    items.length > 0 && items.every(item => selected.has(item.link));

  const toggleAll = useCallback(() => {
    setSelected(allSelected ? new Set() : new Set(items.map(i => i.link)));
  }, [allSelected, items]);

  // Only count episodes of the current season.
  const selectedItems = useMemo(
    () => items.filter(item => selected.has(item.link)),
    [items, selected],
  );

  useEffect(() => {
    exit();
  }, [resetKey, exit]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const cancelCopy = useCallback(() => {
    if (!controllerRef.current) return;
    stopCopy();
    ToastAndroid.show('Cancelled', ToastAndroid.SHORT);
  }, [stopCopy]);

  useEffect(() => {
    if (!active) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (progress) {
        cancelCopy();
      } else {
        exit();
      }
      return true;
    });
    return () => sub.remove();
  }, [active, progress, cancelCopy, exit]);

  const copyLinks = useCallback(async () => {
    if (controllerRef.current || selectedItems.length === 0) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setProgress({current: 0, total: selectedItems.length});
    const result = await resolveEpisodeLinks({
      episodes: selectedItems,
      fetchStreams,
      signal: controller.signal,
      onProgress: (current, total) => {
        if (!controller.signal.aborted) setProgress({current, total});
      },
    });
    if (result.cancelled || controllerRef.current !== controller) return;
    controllerRef.current = null;
    setProgress(null);
    if (result.links.length === 0) {
      ToastAndroid.show('No downloadable links found', ToastAndroid.SHORT);
      return;
    }
    Clipboard.setString(result.links.join('\n'));
    ToastAndroid.show(
      copiedLinksMessage(result.links.length, result.skipped.length),
      ToastAndroid.LONG,
    );
  }, [fetchStreams, selectedItems]);

  return {
    active,
    selected,
    selectedCount: selectedItems.length,
    allSelected,
    progress,
    start,
    exit,
    toggle,
    toggleAll,
    copyLinks,
    cancelCopy,
  };
};

export type EpisodeSelection = ReturnType<typeof useEpisodeSelection>;
