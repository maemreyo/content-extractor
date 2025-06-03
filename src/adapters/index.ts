import type { SiteAdapter } from '../types';
import { MediumAdapter } from './medium';
import { SubstackAdapter } from './substack';
import { GenericNewsAdapter } from './news-sites';
import { GitHubAdapter } from './github';
import { WikipediaAdapter } from './wikipedia';
import { LinkedInAdapter } from './linkedin';
import { RedditAdapter } from './reddit';
import { TwitterAdapter } from './twitter';

// Export all adapters
export {
  MediumAdapter,
  SubstackAdapter,
  GenericNewsAdapter,
  GitHubAdapter,
  WikipediaAdapter,
  LinkedInAdapter,
  RedditAdapter,
  TwitterAdapter
};

// Internal adapters registry
const adapters: SiteAdapter[] = [
  new MediumAdapter(),
  new SubstackAdapter(),
  new GenericNewsAdapter(),
  new GitHubAdapter(),
  new WikipediaAdapter(),
  new LinkedInAdapter(),
  new RedditAdapter(),
  new TwitterAdapter()
];

export function getSiteAdapter(url: string): SiteAdapter | null {
  const sortedAdapters = [...adapters].sort(
    (a, b) => (b.priority || 0) - (a.priority || 0)
  );

  for (const adapter of sortedAdapters) {
    if (adapter.patterns.some((pattern) => pattern.test(url))) {
      return adapter;
    }
  }
  return null;
}

export function registerAdapter(adapter: SiteAdapter): void {
  const existingIndex = adapters.findIndex((a) => a.name === adapter.name);
  if (existingIndex !== -1) {
    adapters[existingIndex] = adapter;
  } else {
    adapters.push(adapter);
  }
}

export function unregisterAdapter(name: string): boolean {
  const index = adapters.findIndex((adapter) => adapter.name === name);
  if (index !== -1) {
    adapters.splice(index, 1);
    return true;
  }
  return false;
}

export function getRegisteredAdapters(): SiteAdapter[] {
  return [...adapters];
}

export function clearAdapters(): void {
  adapters.length = 0;
}

export function getAdapterByName(name: string): SiteAdapter | null {
  return adapters.find((adapter) => adapter.name === name) || null;
}