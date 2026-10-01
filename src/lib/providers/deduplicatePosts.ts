import type {Post} from './types';

/** Keep the first copy of each title within one provider's catalog. */
export function deduplicatePosts(posts: Post[]): Post[] {
  const seen = new Set<string>();
  return posts.filter(post => {
    if (!post.link) return true;
    const key = JSON.stringify([post.provider || '', post.link]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
