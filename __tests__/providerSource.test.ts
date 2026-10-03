import {createProviderSource} from '../src/lib/utils/helpers';

const GH = 'https://raw.githubusercontent.com';

const cases: Array<[string, string, string]> = [
  ['foo', 'foo', `${GH}/foo/vega-providers/refs/heads/main`],
  ['@foo', 'foo', `${GH}/foo/vega-providers/refs/heads/main`],
  ['foo@gh', 'foo', `${GH}/foo/vega-providers/refs/heads/main`],
  ['foo@cb', 'foo@cb', 'https://codeberg.org/foo/vega-providers/raw/branch/main'],
  ['foo@BB', 'foo@bb', 'https://bitbucket.org/foo/vega-providers/raw/main'],
  ['foo@gl', 'foo@gl', 'https://gitlab.com/foo/vega-providers/-/raw/main'],
  ['https://github.com/foo/repo/tree/dev', 'foo', `${GH}/foo/repo/refs/heads/dev`],
  [
    `${GH}/foo/repo/refs/heads/main/manifest.json`,
    'foo',
    `${GH}/foo/repo/refs/heads/main`,
  ],
  ['https://codeberg.org/foo/repo', 'foo@cb', 'https://codeberg.org/foo/repo/raw/branch/main'],
  [
    'https://codeberg.org/foo/repo/src/branch/dev',
    'foo@cb',
    'https://codeberg.org/foo/repo/raw/branch/dev',
  ],
  ['https://bitbucket.org/foo/repo/src/dev/', 'foo@bb', 'https://bitbucket.org/foo/repo/raw/dev'],
  ['https://www.bitbucket.org/foo/repo', 'foo@bb', 'https://bitbucket.org/foo/repo/raw/main'],
  ['https://gitlab.com/grp/sub/repo', 'grp/sub@gl', 'https://gitlab.com/grp/sub/repo/-/raw/main'],
  ['https://gitlab.com/foo/repo/-/tree/dev', 'foo@gl', 'https://gitlab.com/foo/repo/-/raw/dev'],
  [
    'https://gitlab.com/foo/repo/-/raw/main/manifest.json',
    'foo@gl',
    'https://gitlab.com/foo/repo/-/raw/main',
  ],
];

describe('createProviderSource', () => {
  it.each(cases)('parses %s', (input, author, url) => {
    expect(createProviderSource(input)).toEqual({author, url, isDefault: false});
  });

  it.each([
    'foo@xx',
    'foo bar',
    'https://example.com/foo/repo',
    'https://gitlab.com/foo',
  ])('rejects %s', input => {
    expect(() => createProviderSource(input)).toThrow();
  });
});
