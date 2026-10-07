import type {ProviderExtension} from './storage/extensionStorage';

/**
 * Identity of an installed provider. The same value can be installed from two
 * sources, so the source author is part of it.
 */
export const providerOrderKey = (
  provider: Pick<ProviderExtension, 'value' | 'source'>,
): string => `${provider.source?.author ?? ''}/${provider.value}`;

/**
 * Installed providers in the user's saved order. Providers the order does not
 * know yet (newly installed ones) follow, sorted by name.
 */
export const sortInstalledProviders = (
  providers: ProviderExtension[],
  order: string[],
): ProviderExtension[] => {
  const rank = new Map(order.map((key, index) => [key, index]));
  return [...providers].sort((a, b) => {
    const rankA = rank.get(providerOrderKey(a));
    const rankB = rank.get(providerOrderKey(b));
    if (rankA !== undefined && rankB !== undefined) {
      return rankA - rankB;
    }
    if (rankA !== undefined) {
      return -1;
    }
    if (rankB !== undefined) {
      return 1;
    }
    return a.display_name.localeCompare(b.display_name);
  });
};

/** Copy of the list with one item moved from one index to another. */
export const moveItem = <T>(list: T[], from: number, to: number): T[] => {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};
