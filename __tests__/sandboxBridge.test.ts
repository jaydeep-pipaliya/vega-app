import {afterEach, describe, expect, it, jest} from '@jest/globals';

jest.mock('../src/lib/sandbox/providerRpc', () => ({
  handleProviderRpc: jest.fn(),
}));

import {sandboxBridge} from '../src/lib/sandbox/sandboxBridge';

const PREFIX = 'window.__sandboxReceive(';
const SUFFIX = ');true;';

// The frame is a JSON string literal holding the JSON message.
const decodeInjected = (script: string) => {
  if (!script.startsWith(PREFIX) || !script.endsWith(SUFFIX)) {
    throw new Error(`Unexpected injected script: ${script}`);
  }
  const literal = script.slice(PREFIX.length, -SUFFIX.length);
  return JSON.parse(JSON.parse(literal));
};

describe('sandboxBridge', () => {
  it('injects frames that provider data cannot break out of', () => {
    const injected: string[] = [];
    sandboxBridge.register(script => injected.push(script), () => {});
    sandboxBridge.handleSandboxMessage(JSON.stringify({type: 'ready'}));
    const tricky = 'a"b\\c\u2028d\u2029e</script>);alert(1);//';
    sandboxBridge
      .invoke({
        moduleCode: tricky,
        providerValue: 'p',
        author: 'x',
        args: {},
        state: {},
      } as any)
      .catch(() => {});
    const script = injected[injected.length - 1];
    expect(script).not.toMatch(/[\u2028\u2029]/);
    // Evaluating the literal must give back exactly the frame that was sent.
    expect(decodeInjected(script).moduleCode).toBe(tricky);
  });

  afterEach(() => {
    sandboxBridge.unregister();
    jest.useRealTimers();
  });

  it('queues invokes until the sandbox reports ready', () => {
    const injected: string[] = [];
    sandboxBridge.register(script => injected.push(script), jest.fn());

    const invocation = sandboxBridge.invoke({
      moduleCode: 'exports.catalog = [];',
      providerValue: 'fixture',
      state: {},
    });

    expect(injected).toEqual([]);

    sandboxBridge.handleSandboxMessage(JSON.stringify({type: 'ready'}));
    expect(injected).toHaveLength(1);
    const frame = decodeInjected(injected[0]);
    expect(frame.type).toBe('invoke');
    expect(frame.moduleCode).toBe('exports.catalog = [];');

    sandboxBridge.handleSandboxMessage(
      JSON.stringify({type: 'result', token: frame.token, result: []}),
    );
    return expect(invocation).resolves.toEqual([]);
  });

  it('sends a cancel frame and rejects when aborted', async () => {
    const injected: string[] = [];
    sandboxBridge.register(script => injected.push(script), jest.fn());
    sandboxBridge.handleSandboxMessage(JSON.stringify({type: 'ready'}));

    const controller = new AbortController();
    const invocation = sandboxBridge.invoke({
      moduleCode: 'while (true) {}',
      providerValue: 'fixture',
      state: {},
      signal: controller.signal,
    });

    const invokeFrame = decodeInjected(injected[0]);
    controller.abort();

    await expect(invocation).rejects.toThrow('Provider request aborted');
    expect(decodeInjected(injected[1])).toEqual({
      type: 'cancel',
      token: invokeFrame.token,
    });
  });

  it('rejects oversized modules before posting them', async () => {
    sandboxBridge.register(jest.fn(), jest.fn());
    sandboxBridge.handleSandboxMessage(JSON.stringify({type: 'ready'}));

    await expect(
      sandboxBridge.invoke({
        moduleCode: 'x'.repeat(2_000_001),
        providerValue: 'fixture',
        state: {},
      }),
    ).rejects.toThrow('Provider module is too large');
  });
});
