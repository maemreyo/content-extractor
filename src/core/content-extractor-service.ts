import { LRUCache } from 'lru-cache';
import { JSDOM } from 'jsdom';
import crypto from 'crypto-js';
import { TextExtractor } from '../extractors/text-extractor';
import { getSiteAdapter } from '../adapters';
import type {
  CacheOptions,
  ContentExtractorPlugin,
  ExtractedContent,
  ExtractionEvents,
  ExtractionOptions,
  ExtractionResult,
  StreamingOptions,
  BatchOptions
} from '../types';

class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 10, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async checkLimit(key: string): Promise<boolean> {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    const validRequests = requests.filter((time) => now - time < this.windowMs);

    if (validRequests.length >= this.maxRequests) {
      return false;
    }

    validRequests.push(now);
    this.requests.set(key, validRequests);
    return true;
  }

  getRemainingRequests(key: string): number {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    const validRequests = requests.filter((time) => now - time < this.windowMs);
    return Math.max(0, this.maxRequests - validRequests.length);
  }
}

export class ContentExtractorService {
  private extractor: TextExtractor;
  private cache: LRUCache<string, { content: ExtractedContent; timestamp: number }>;
  private plugins: ContentExtractorPlugin[] = [];
  private defaultCacheOptions: CacheOptions = {
    enabled: true,
    ttl: 3600000, // 1 hour
    maxSize: 50, // 50 MB
    strategy: 'lru',
    persistent: false
  };
  private cacheOptions: CacheOptions;
  private pendingExtractions: Map<string, Promise<ExtractedContent>> = new Map();
  private rateLimiter: RateLimiter;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  private persistentCache?: Map<string, any>;

  constructor(cacheOptions?: Partial<CacheOptions>) {
    this.extractor = new TextExtractor();
    this.cacheOptions = { ...this.defaultCacheOptions, ...cacheOptions };
    this.cache = new LRUCache({
      max: 100,
      ttl: this.cacheOptions.ttl,
      sizeCalculation: (value) => JSON.stringify(value).length,
      maxSize: this.cacheOptions.maxSize * 1024 * 1024, // Convert MB to bytes
    });
    this.rateLimiter = new RateLimiter();

    if (this.cacheOptions.persistent) {
      this.persistentCache = new Map();
    }
  }

  async registerPlugin(plugin: ContentExtractorPlugin): Promise<void> {
    if (plugin.init) {
      await plugin.init();
    }
    this.plugins.push(plugin);
    console.log(`Registered plugin: ${plugin.name} v${plugin.version}`);
  }

  unregisterPlugin(pluginName: string): void {
    this.plugins = this.plugins.filter((p) => p.name !== pluginName);
  }

  getPlugins(): ContentExtractorPlugin[] {
    return [...this.plugins];
  }

  async extract(
    url: string,
    options?: ExtractionOptions,
    events?: ExtractionEvents
  ): Promise<ExtractionResult> {
    try {
      const domain = new URL(url).hostname;
      if (!(await this.rateLimiter.checkLimit(domain))) {
        throw new Error(`Rate limit exceeded for ${domain}. Try again later.`);
      }

      events?.onStart?.();

      const pendingKey = `${url}_${JSON.stringify(options || {})}`;
      if (this.pendingExtractions.has(pendingKey)) {
        const content = await this.pendingExtractions.get(pendingKey)!;
        return { success: true, data: content };
      }

      const extractionPromise = this._extract(url, options, events);
      this.pendingExtractions.set(pendingKey, extractionPromise);

      try {
        const content = await extractionPromise;
        events?.onComplete?.(content);
        return { success: true, data: content };
      } finally {
        this.pendingExtractions.delete(pendingKey);
      }
    } catch (error) {
      events?.onError?.(error as Error);
      return {
        success: false,
        error: error as Error,
        partial: undefined
      };
    }
  }

  async extractFromCurrentTab(
    options?: ExtractionOptions,
    events?: ExtractionEvents
  ): Promise<ExtractionResult> {
    try {
      if (typeof window === 'undefined') {
        throw new Error('extractFromCurrentTab is only available in browser environment');
      }
      const html = document.documentElement.outerHTML;
      const url = window.location.href;
      return this.extractFromHTML(html, url, options, events);
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  async extractFromDocument(
    document: Document,
    url: string,
    options?: ExtractionOptions,
    events?: ExtractionEvents
  ): Promise<ExtractionResult> {
    try {
      events?.onStart?.();
      events?.onProgress?.({ phase: 'extracting', progress: 50 });

      let doc = document;

      for (const plugin of this.plugins) {
        if (plugin.beforeExtract) {
          doc = plugin.beforeExtract(doc, options || {});
        }
      }

      let content = await this.extractor.extractEnhanced(doc, url, options);

      for (const plugin of this.plugins) {
        if (plugin.afterExtract) {
          content = plugin.afterExtract(content);
        }
      }

      content.fingerprint = this.generateFingerprint(content);

      events?.onComplete?.(content);
      return { success: true, data: content };
    } catch (error) {
      events?.onError?.(error as Error);
      return { success: false, error: error as Error };
    }
  }

  async extractFromHTML(
    html: string,
    url: string,
    options?: ExtractionOptions,
    events?: ExtractionEvents
  ): Promise<ExtractionResult> {
    try {
      events?.onStart?.();
      events?.onProgress?.({ phase: 'parsing', progress: 20 });

      const dom = new JSDOM(html);
      const doc = dom.window.document;
      return this.extractFromDocument(doc, url, options, events);
    } catch (error) {
      events?.onError?.(error as Error);
      return { success: false, error: error as Error };
    }
  }

  private async _extract(
    url: string,
    options?: ExtractionOptions,
    events?: ExtractionEvents
  ): Promise<ExtractedContent> {
    if (this.cacheOptions.enabled) {
      const cached = await this.getFromCache(url, options);
      if (cached) {
        this.cacheHits++;
        events?.onProgress?.({
          phase: 'fetching',
          progress: 100,
          message: 'Loaded from cache'
        });
        return cached;
      }
      this.cacheMisses++;
    }

    events?.onProgress?.({ phase: 'fetching', progress: 10 });
    const response = await this.fetchWithTimeout(url, options?.timeout || 30000);
    const html = await response.text();

    events?.onProgress?.({ phase: 'parsing', progress: 30 });
    const dom = new JSDOM(html);
    let doc = dom.window.document;

    for (const plugin of this.plugins) {
      if (plugin.beforeExtract) {
        doc = plugin.beforeExtract(doc, options || {});
      }
    }

    events?.onProgress?.({ phase: 'cleaning', progress: 50 });
    events?.onProgress?.({ phase: 'extracting', progress: 70 });
    
    let content = await this.extractor.extractEnhanced(doc, url, options);

    for (const plugin of this.plugins) {
      if (plugin.afterExtract) {
        content = plugin.afterExtract(content);
      }
    }

    events?.onProgress?.({ phase: 'analyzing', progress: 90 });

    content.fingerprint = this.generateFingerprint(content);

    if (this.cacheOptions.enabled) {
      await this.saveToCache(url, options, content);
    }

    events?.onProgress?.({ phase: 'analyzing', progress: 100 });
    return content;
  }

  async extractBatch(
    urls: string[],
    options?: ExtractionOptions & BatchOptions,
    concurrency: number = 3
  ): Promise<ExtractionResult[]> {
    const results: ExtractionResult[] = [];
    const chunks: string[][] = [];

    for (let i = 0; i < urls.length; i += concurrency) {
      chunks.push(urls.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map((url) => this.extract(url, options))
      );
      results.push(...chunkResults);
    }

    return results;
  }

  async *extractStream(
    url: string,
    options: StreamingOptions = {}
  ): AsyncGenerator<Partial<ExtractedContent>, ExtractedContent> {
    const chunkSize = options.chunkSize || 10;
    const result = await this.extract(url, options);
    
    if (!result.success) {
      throw result.error;
    }

    const content = result.data;
    const totalParagraphs = content.paragraphs.length;
    
    for (let i = 0; i < totalParagraphs; i += chunkSize) {
      const chunk: Partial<ExtractedContent> = {
        paragraphs: content.paragraphs.slice(i, i + chunkSize),
        wordCount: content.paragraphs
          .slice(i, i + chunkSize)
          .reduce((sum, p) => sum + p.text.split(/\s+/).length, 0)
      };
      
      if (options.onProgress) {
        options.onProgress(chunk);
      }
      
      yield chunk;
    }
    
    return content;
  }

  async exportContent(
    content: ExtractedContent,
    format: 'json' | 'markdown' | 'html' = 'json'
  ): Promise<string> {
    switch (format) {
      case 'markdown':
        return this.contentToMarkdown(content);
      case 'html':
        return this.contentToHTML(content);
      default:
        return JSON.stringify(content, null, 2);
    }
  }

  async importContent(
    data: string,
    format: 'json' | 'markdown' | 'html' = 'json'
  ): Promise<ExtractedContent> {
    switch (format) {
      case 'json':
        return JSON.parse(data);
      default:
        throw new Error(`Import format ${format} not yet supported`);
    }
  }

  private contentToMarkdown(content: ExtractedContent): string {
    let markdown = `# ${content.title}\n\n`;

    if (content.metadata.author) {
      markdown += `**Author:** ${content.metadata.author}\n`;
    }
    if (content.metadata.publishDate) {
      markdown += `**Published:** ${new Date(content.metadata.publishDate).toLocaleDateString()}\n`;
    }
    markdown += `\n---\n\n`;

    if (content.sections.length > 0) {
      content.sections.forEach((section) => {
        markdown += `${'#'.repeat(section.level)} ${section.title}\n\n`;
        section.paragraphs.forEach((p) => {
          markdown += `${p.text}\n\n`;
        });
      });
    } else {
      content.paragraphs.forEach((p) => {
        if (p.isHeading) {
          markdown += `${'#'.repeat(p.headingLevel || 2)} ${p.text}\n\n`;
        } else if (p.isQuote) {
          markdown += `> ${p.text}\n\n`;
        } else if (p.isCode) {
          markdown += `\`\`\`\n${p.text}\n\`\`\`\n\n`;
        } else {
          markdown += `${p.text}\n\n`;
        }
      });
    }

    return markdown;
  }

  private contentToHTML(content: ExtractedContent): string {
    let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${content.title}</title>
</head>
<body>
  <article>
    <h1>${content.title}</h1>`;

    if (content.metadata.author || content.metadata.publishDate) {
      html += '<div class="metadata">';
      if (content.metadata.author) {
        html += `<span class="author">By ${content.metadata.author}</span>`;
      }
      if (content.metadata.publishDate) {
        html += `<time>${new Date(content.metadata.publishDate).toLocaleDateString()}</time>`;
      }
      html += '</div>';
    }

    content.paragraphs.forEach((p) => {
      html += p.html + '\n';
    });

    html += `
  </article>
</body>
</html>`;

    return html;
  }

  private async getFromCache(
    url: string,
    options?: ExtractionOptions
  ): Promise<ExtractedContent | null> {
    const cacheKey = this.getCacheKey(url, options);
    const cached = this.cache.get(cacheKey);

    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < this.cacheOptions.ttl) {
        return cached.content;
      }
    }

    if (this.cacheOptions.persistent && this.persistentCache) {
      const persistentCached = this.persistentCache.get(cacheKey);
      if (persistentCached) {
        const age = Date.now() - persistentCached.timestamp;
        if (age < this.cacheOptions.ttl) {
          this.cache.set(cacheKey, persistentCached);
          return persistentCached.content;
        }
      }
    }

    return null;
  }

  private async saveToCache(
    url: string,
    options: ExtractionOptions | undefined,
    content: ExtractedContent
  ): Promise<void> {
    const cacheKey = this.getCacheKey(url, options);
    const cacheEntry = { content, timestamp: Date.now() };

    this.cache.set(cacheKey, cacheEntry);

    if (this.cacheOptions.persistent && this.persistentCache) {
      this.persistentCache.set(cacheKey, cacheEntry);
    }
  }

  private getCacheKey(url: string, options?: ExtractionOptions): string {
    const optionsHash = options ? JSON.stringify(options) : 'default';
    return `${url}_${this.hashString(optionsHash)}`;
  }

  private hashString(str: string): string {
    return crypto.SHA256(str).toString();
  }

  private generateFingerprint(content: ExtractedContent): string {
    const text = content.cleanText.slice(0, 1000);
    return this.hashString(text + content.title);
  }

  private async fetchWithTimeout(
    url: string,
    timeout: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    }
  }

  async clearCache(): Promise<void> {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;

    if (this.persistentCache) {
      this.persistentCache.clear();
    }
  }

  getCacheStats(): {
    size: number;
    hitRate: number;
    hits: number;
    misses: number;
    itemCount: number;
  } {
    const total = this.cacheHits + this.cacheMisses;
    return {
      size: this.cache.size,
      hitRate: total > 0 ? this.cacheHits / total : 0,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      itemCount: this.cache.size
    };
  }

  getRateLimitInfo(url: string): { remaining: number; resetTime: number } {
    const domain = new URL(url).hostname;
    return {
      remaining: this.rateLimiter.getRemainingRequests(domain),
      resetTime: Date.now() + 60000
    };
  }

  async findDuplicates(urls: string[]): Promise<Map<string, string[]>> {
    const fingerprints = new Map<string, string[]>();

    for (const url of urls) {
      const result = await this.extract(url);
      if (result.success) {
        const fp = result.data.fingerprint;
        if (!fingerprints.has(fp)) {
          fingerprints.set(fp, []);
        }
        fingerprints.get(fp)!.push(url);
      }
    }

    const duplicates = new Map<string, string[]>();
    for (const [fp, urls] of fingerprints) {
      if (urls.length > 1) {
        duplicates.set(fp, urls);
      }
    }

    return duplicates;
  }

  validateContent(content: ExtractedContent): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!content.title || content.title.length === 0) {
      errors.push('Missing title');
    }

    if (!content.paragraphs || content.paragraphs.length === 0) {
      errors.push('No paragraphs extracted');
    }

    if (content.wordCount < 50) {
      errors.push('Content too short (less than 50 words)');
    }

    if (content.quality.score < 0.3) {
      errors.push('Content quality too low');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}