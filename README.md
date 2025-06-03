# @content-extractor/core

A powerful, flexible content extraction library for web pages with support for multiple extraction engines, site-specific adapters, and content analysis.

## Features

- 📝 **Smart Content Extraction**: Automatically extracts main content from any webpage
- 🎯 **Site-Specific Adapters**: Optimized extraction for popular sites (Medium, GitHub, Wikipedia, etc.)
- 🧹 **Content Cleaning**: Remove ads, navigation, and clutter
- 📊 **Content Analysis**: Readability scores, sentiment analysis, and quality metrics
- 🔍 **Structured Data**: Extract tables, lists, embeds, and metadata
- 🚀 **High Performance**: Built-in caching and rate limiting
- 🔌 **Plugin System**: Extend functionality with custom plugins
- 📦 **TypeScript Support**: Full type definitions included

## Installation

```bash
npm install @content-extractor/core
# or
yarn add @content-extractor/core
# or
pnpm add @content-extractor/core
```

## Quick Start

```typescript
import { contentExtractor } from '@content-extractor/core';

// Extract content from a URL
const result = await contentExtractor.extract('https://example.com/article');

if (result.success) {
  console.log('Title:', result.data.title);
  console.log('Content:', result.data.cleanText);
  console.log('Reading time:', result.data.readingTime, 'minutes');
  console.log('Quality score:', result.data.quality.score);
}
```

## Usage Examples

### Basic Extraction

```typescript
import { ContentExtractorService } from '@content-extractor/core';

const extractor = new ContentExtractorService({
  enabled: true,
  ttl: 3600000, // 1 hour cache
  maxSize: 50 // 50MB cache
});

// Extract from URL
const result = await extractor.extract('https://medium.com/@user/article');

// Extract from HTML
const htmlResult = await extractor.extractFromHTML(
  '<html>...</html>',
  'https://example.com'
);

// Extract from current browser tab (browser environment only)
const tabResult = await extractor.extractFromCurrentTab();
```

### Advanced Options

```typescript
const result = await extractor.extract('https://example.com/article', {
  // Cleaning options
  cleaningOptions: {
    removeAds: true,
    removeNavigation: true,
    preserveImages: true,
    preserveVideos: true,
    aggressiveMode: false
  },
  
  // Extraction options
  includeMetadata: true,
  detectSections: true,
  extractTables: true,
  extractLists: true,
  extractEmbeds: true,
  extractStructuredData: true,
  extractEntities: true,
  calculateReadability: true,
  
  // Performance options
  minParagraphLength: 20,
  timeout: 30000
});
```

### Batch Extraction

```typescript
const urls = [
  'https://example.com/article1',
  'https://example.com/article2',
  'https://example.com/article3'
];

const results = await extractor.extractBatch(urls, {
  parallel: 3,
  retryFailed: true,
  continueOnError: true
});

results.forEach((result, index) => {
  if (result.success) {
    console.log(`Article ${index + 1}:`, result.data.title);
  } else {
    console.error(`Failed to extract article ${index + 1}:`, result.error);
  }
});
```

### Streaming Extraction (for large documents)

```typescript
const stream = extractor.extractStream('https://example.com/large-document', {
  chunkSize: 10, // paragraphs per chunk
  onProgress: (chunk) => {
    console.log('Received chunk with', chunk.paragraphs?.length, 'paragraphs');
  }
});

for await (const chunk of stream) {
  // Process each chunk as it arrives
  processChunk(chunk);
}
```

### Export Content

```typescript
const result = await extractor.extract('https://example.com/article');

if (result.success) {
  // Export as Markdown
  const markdown = await extractor.exportContent(result.data, 'markdown');
  
  // Export as HTML
  const html = await extractor.exportContent(result.data, 'html');
  
  // Export as JSON
  const json = await extractor.exportContent(result.data, 'json');
}
```

## Site Adapters

The library includes optimized adapters for popular websites:

- **Medium** - Articles and publications
- **GitHub** - README files, issues, wikis, and code
- **Wikipedia** - Articles with proper formatting
- **Reddit** - Posts and comments
- **Twitter/X** - Tweets and threads
- **LinkedIn** - Articles and posts
- **Substack** - Newsletter articles
- **News Sites** - CNN, BBC, NYTimes, etc.

### Using Site Adapters

```typescript
import { 
  MediumAdapter, 
  GitHubAdapter,
  registerAdapter 
} from '@content-extractor/core';

// Adapters are automatically used based on URL patterns
const result = await extractor.extract('https://medium.com/@user/article');

// Register a custom adapter
const customAdapter = {
  name: 'my-site',
  patterns: [/mysite\.com/],
  priority: 10,
  extract(doc, url) {
    // Custom extraction logic
    return {
      title: doc.querySelector('h1')?.textContent || '',
      // ... other fields
    };
  }
};

registerAdapter(customAdapter);
```

## Plugin System

Extend functionality with plugins:

```typescript
const analyticsPlugin = {
  name: 'analytics',
  version: '1.0.0',
  
  async init() {
    console.log('Analytics plugin initialized');
  },
  
  beforeExtract(doc, options) {
    console.log('Starting extraction for:', doc.URL);
    return doc;
  },
  
  afterExtract(content) {
    console.log('Extracted:', content.title);
    console.log('Word count:', content.wordCount);
    return content;
  }
};

await extractor.registerPlugin(analyticsPlugin);
```

## Content Analysis

The library provides comprehensive content analysis:

```typescript
const result = await extractor.extract(url, {
  calculateReadability: true,
  extractEntities: true
});

if (result.success) {
  const { analysis } = result.data;
  
  console.log('Reading level:', analysis.readingLevel);
  console.log('Sentiment:', analysis.sentiment);
  console.log('Language:', analysis.language);
  console.log('Quality score:', analysis.quality.score);
  
  // Readability metrics
  const { readability } = result.data.paragraphs[0];
  console.log('Flesch-Kincaid:', readability?.fleschKincaid);
  console.log('Gunning Fog:', readability?.gunningFog);
  
  // Extracted entities
  const entities = result.data.paragraphs[0].entities;
  entities?.forEach(entity => {
    console.log(`Found ${entity.type}: ${entity.text}`);
  });
}
```

## Caching

Built-in intelligent caching system:

```typescript
const extractor = new ContentExtractorService({
  enabled: true,
  ttl: 3600000, // 1 hour
  maxSize: 50, // 50MB
  strategy: 'lru',
  persistent: true // Use persistent storage
});

// Check cache statistics
const stats = extractor.getCacheStats();
console.log('Cache hit rate:', stats.hitRate);
console.log('Cache size:', stats.size);

// Clear cache
await extractor.clearCache();
```

## Rate Limiting

Automatic rate limiting to prevent overwhelming servers:

```typescript
// Check rate limit status
const info = extractor.getRateLimitInfo('https://example.com');
console.log('Remaining requests:', info.remaining);
console.log('Reset time:', new Date(info.resetTime));

// Rate limit is automatically enforced
const result = await extractor.extract('https://example.com/article');
if (!result.success && result.error.message.includes('Rate limit')) {
  console.log('Rate limited, please wait');
}
```

## TypeScript Support

Full TypeScript support with comprehensive type definitions:

```typescript
import type {
  ExtractedContent,
  ExtractionOptions,
  ExtractionResult,
  ContentQuality,
  Paragraph,
  Table,
  List,
  Embed
} from '@content-extractor/core';

// All types are fully documented and available
const options: ExtractionOptions = {
  includeMetadata: true,
  detectSections: true
};

const handleResult = (result: ExtractionResult) => {
  if (result.success) {
    const content: ExtractedContent = result.data;
    // Full intellisense support
  }
};
```

## API Reference

### ContentExtractorService

The main service class for content extraction.

#### Constructor Options

```typescript
interface CacheOptions {
  enabled: boolean;      // Enable caching (default: true)
  ttl: number;          // Time to live in ms (default: 3600000)
  maxSize: number;      // Max cache size in MB (default: 50)
  strategy: 'lru';      // Cache strategy (default: 'lru')
  persistent: boolean;  // Use persistent storage (default: false)
}
```

#### Methods

- `extract(url: string, options?: ExtractionOptions): Promise<ExtractionResult>`
- `extractFromHTML(html: string, url: string, options?: ExtractionOptions): Promise<ExtractionResult>`
- `extractFromDocument(doc: Document, url: string, options?: ExtractionOptions): Promise<ExtractionResult>`
- `extractFromCurrentTab(options?: ExtractionOptions): Promise<ExtractionResult>`
- `extractBatch(urls: string[], options?: BatchOptions): Promise<ExtractionResult[]>`
- `extractStream(url: string, options?: StreamingOptions): AsyncGenerator`
- `exportContent(content: ExtractedContent, format: 'json' | 'markdown' | 'html'): Promise<string>`
- `registerPlugin(plugin: ContentExtractorPlugin): Promise<void>`
- `clearCache(): Promise<void>`
- `getCacheStats(): CacheStats`
- `getRateLimitInfo(url: string): RateLimitInfo`

### Extraction Options

```typescript
interface ExtractionOptions {
  // Adapter selection
  adapter?: string;
  
  // Cleaning options
  cleaningOptions?: Partial<CleaningOptions>;
  
  // Content options
  minParagraphLength?: number;
  includeMetadata?: boolean;
  detectSections?: boolean;
  scoreParagraphs?: boolean;
  
  // Feature flags
  extractTables?: boolean;
  extractLists?: boolean;
  extractEmbeds?: boolean;
  extractStructuredData?: boolean;
  extractEntities?: boolean;
  calculateReadability?: boolean;
  generateSummary?: boolean;
  
  // Performance
  maxDepth?: number;
  timeout?: number;
  lazy?: boolean;
  waitForSelectors?: string[];
}
```

## Browser Usage

The library can be used in browser environments:

```html
<script type="module">
  import { contentExtractor } from '@content-extractor/core';
  
  // Extract from current page
  const result = await contentExtractor.extractFromCurrentTab();
  console.log(result.data.title);
</script>
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT © [Your Name]

## Support

- 📚 [Documentation](https://github.com/yourusername/content-extractor/docs)
- 🐛 [Issue Tracker](https://github.com/yourusername/content-extractor/issues)
- 💬 [Discussions](https://github.com/yourusername/content-extractor/discussions)