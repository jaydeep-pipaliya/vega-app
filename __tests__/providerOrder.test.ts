import {
  moveItem,
  providerOrderKey,
  sortInstalledProviders,
} from '../src/lib/providerOrder';

const provider = (value: string, name: string, author = 'a') =>
  ({value, display_name: name, source: {author, url: ''}}) as any;

describe('sortInstalledProviders', () => {
  it('uses the saved order, then sorts new providers by name', () => {
    const list = [
      provider('zee', 'Zee'),
      provider('alpha', 'Alpha'),
      provider('mid', 'Mid'),
      provider('new', 'Brand New'),
    ];
    const order = ['a/mid', 'a/zee'];

    expect(sortInstalledProviders(list, order).map(p => p.value)).toEqual([
      'mid',
      'zee',
      'alpha',
      'new',
    ]);
  });

  it('keeps the same value from two sources apart', () => {
    const list = [provider('nf', 'NF', 'one'), provider('nf', 'NF', 'two')];
    const order = ['two/nf', 'one/nf'];

    expect(
      sortInstalledProviders(list, order).map(p => p.source.author),
    ).toEqual(['two', 'one']);
    expect(providerOrderKey(list[0])).toBe('one/nf');
  });

  it('does not change the input list', () => {
    const list = [provider('b', 'B'), provider('a', 'A')];
    sortInstalledProviders(list, []);
    expect(list.map(p => p.value)).toEqual(['b', 'a']);
  });
});

describe('moveItem', () => {
  it.each([
    [0, 2, ['b', 'c', 'a', 'd']],
    [3, 1, ['a', 'd', 'b', 'c']],
    [1, 1, ['a', 'b', 'c', 'd']],
  ])('moves %i to %i', (from, to, expected) => {
    expect(moveItem(['a', 'b', 'c', 'd'], from, to)).toEqual(expected);
  });

  // A drag whose start index was reset (-1) must not move the last item.
  it.each([
    [-1, 1],
    [1, -1],
    [4, 0],
    [0, 4],
  ])('leaves the list alone for out-of-range %i to %i', (from, to) => {
    expect(moveItem(['a', 'b', 'c', 'd'], from, to)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });
});
