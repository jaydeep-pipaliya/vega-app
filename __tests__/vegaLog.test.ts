import {beforeEach, describe, expect, it, jest} from '@jest/globals';

const mockWriteBatch = jest.fn();

jest.mock('react-native', () => ({
  Platform: {OS: 'android'},
  NativeModules: {
    VegaLog: {
      writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
      setDetailed: jest.fn(),
      share: jest.fn(async () => undefined),
      clear: jest.fn(async () => undefined),
    },
  },
}));

jest.mock('../src/lib/storage/StorageService', () => ({
  mainStorage: {getNumber: () => 0, setNumber: jest.fn()},
}));

import {installVegaLog, shareLogs} from '../src/lib/logging/vegaLog';

const written = (): string[] =>
  mockWriteBatch.mock.calls.flatMap(
    call => (call[0] as Array<[number, string, string]>).map(entry => entry[2]),
  );

describe('vegaLog', () => {
  beforeEach(() => {
    mockWriteBatch.mockClear();
  });

  it('drops library deprecation noise and collapses repeated lines', async () => {
    installVegaLog(false);
    console.warn(
      'This method is deprecated (as well as all React Native Firebase namespaced API) and will be removed',
    );
    console.warn('InteractionManager has been deprecated and will be removed');
    console.error('Error in posts function: timed out');
    console.error('Error in posts function: timed out');
    console.error('Error in posts function: timed out');
    console.warn('something else');
    await shareLogs();

    expect(written()).toEqual([
      'Error in posts function: timed out',
      '(previous line repeated 2 more times)',
      'something else',
    ]);
  });

  it('shortens long error stacks', async () => {
    installVegaLog(false);
    const error = new Error('boom');
    error.stack = ['Error: boom', ...Array.from({length: 20}, (_, i) => `    at f${i}`)].join('\n');
    console.error(error);
    await shareLogs();

    const line = written().find(text => text.startsWith('Error: boom'))!;
    expect(line.split('\n')).toHaveLength(7);
    expect(line).toContain('… 15 more frames');
  });
});
