import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContentExtractorService } from '../src';
import type { ExtractedContent, ExtractionOptions } from '../src/types';

// Mock fetch for testing
global.fetch = vi.fn();

describe('ContentExtractorService', () => {
  let extractor: ContentExtractorService;

  beforeEach(() => {
    extractor = new ContentExtractorService({
      enabled: true,
      persistent: false
    });
    vi.clearAllMocks();
  });

  describe('Core Extraction', () => {
    it('should extract content from URL successfully', async () => {
      const mockHtml = `
        <html>
          <head><title>Test Article</title></head>
          <body>
            <article>
              <h1>Test Article Title</h1>
              <p>This is a test paragraph with some content.</p>
              <p>Another paragraph with more information.</p>
            </article>
          </body>
        </html>
      `;

      (global.fetch as any).mockResolvedValueOnce({
        text: async () => mockHtml
      });

      const result = await extractor.extract('https://example.com/article');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Test Article Title');
        expect(result.data.paragraphs).toHaveLength(2);
        expect(result.data.wordCount).toBeGreaterThan(0);
      }
    });

    it('should handle extraction errors gracefully', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const result = await extractor.extract('https://example.com/article');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Network error');
      }
    });

    it('should extract from HTML string', async () => {
      const html = '<h1>Title</h1><p>Content</p>';
      const result = await extractor.extractFromHTML(html, 'https://example.com');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Title');
        expect(result.data.paragraphs).toHaveLength(1);
      }
    });
  });

  describe('Cache Management', () => {
    it('should cache extraction results', async () => {
      const mockHtml = '<h1>Cached Content</h1>';
      (global.fetch as any).mockResolvedValueOnce({
        text: async () => mockHtml
      });

      // First extraction
      await extractor.extract('https://example.com/cached');

      // Second extraction should use cache
      const result = await extractor.extract('https://example.com/cached');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
    });

    it('should provide accurate cache statistics', async () => {
      const mockHtml = '<h1>Stats Test</h1>';
      (global.fetch as any).mockResolvedValue({
        text: async () => mockHtml
      });

      // Make some requests
      await extractor.extract('https://example.com/1');
      await extractor.extract('https://example.com/1'); // Cache hit
      await extractor.extract('https://example.com/2');

      const stats = extractor.getCacheStats();

      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBeCloseTo(0.333, 2);
    });
  });

  describe('Plugin System', () => {
    it('should register and execute plugins', async () => {
      const mockPlugin = {
        name: 'test-plugin',
        version: '1.0.0',
        afterExtract: vi.fn((content) => ({
          ...content,
          metadata: {
            ...content.metadata,
            pluginProcessed: true
          }
        }))
      };

      await extractor.registerPlugin(mockPlugin);

      const mockHtml = '<h1>Plugin Test</h1>';
      (global.fetch as any).mockResolvedValueOnce({
        text: async () => mockHtml
      });

      const result = await extractor.extract('https://example.com/plugin');

      expect(mockPlugin.afterExtract).toHaveBeenCalled();
      if (result.success) {
        expect((result.data.metadata as any).pluginProcessed).toBe(true);
      }
    });
  });

  describe('Batch Extraction', () => {
    it('should extract multiple URLs concurrently', async () => {
      const urls = [
        'https://example.com/1',
        'https://example.com/2',
        'https://example.com/3'
      ];

      (global.fetch as any).mockResolvedValue({
        text: async () => '<h1>Batch Test</h1>'
      });

      const results = await extractor.extractBatch(urls, {}, 2);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });
  });

  describe('Export Functionality', () => {
    it('should export content as Markdown', async () => {
      const content: ExtractedContent = {
        title: 'Test Article',
        paragraphs: [{
          id: 'p1',
          text: 'First paragraph',
          html: '<p>First paragraph</p>',
          index: 0,
          element: 'p',
          bounds: new DOMRect(),
          isQuote: false,
          isCode: false,
          isHeading: false,
          importance: 0.7
        }],
        cleanText: 'First paragraph',
        metadata: {
          author: 'Test Author',
          publishDate: new Date('2024-01-01'),
          source: 'example.com',
          extractedAt: new Date(),
          tags: []
        },
        sections: [],
        readingTime: 1,
        wordCount: 2,
        language: 'en',
        quality: {
          score: 0.8,
          textDensity: 0.8,
          linkDensity: 0.1,
          adDensity: 0,
          readabilityScore: 0.9,
          structureScore: 0.8,
          completeness: 0.9
        },
        fingerprint: 'abc123'
      };

      const markdown = await extractor.exportContent(content, 'markdown');

      expect(markdown).toContain('# Test Article');
      expect(markdown).toContain('**Author:** Test Author');
      expect(markdown).toContain('First paragraph');
    });
  });

  describe('Content Validation', () => {
    it('should validate extracted content', () => {
      const validContent: ExtractedContent = {
        title: 'Valid Article',
        paragraphs: Array(5).fill({
          id: 'p1',
          text: 'This is a valid paragraph with enough content.',
          html: '<p>This is a valid paragraph with enough content.</p>',
          index: 0,
          element: 'p',
          bounds: new DOMRect(),
          isQuote: false,
          isCode: false,
          isHeading: false,
          importance: 0.7
        }),
        cleanText: 'Content '.repeat(100),
        wordCount: 100,
        quality: { score: 0.8 } as any,
        metadata: {} as any,
        sections: [],
        readingTime: 1,
        language: 'en',
        fingerprint: 'abc'
      };

      const invalidContent: ExtractedContent = {
        ...validContent,
        title: '',
        paragraphs: [],
        wordCount: 10,
        quality: { score: 0.2 } as any
      };

      const validResult = extractor.validateContent(validContent);
      const invalidResult = extractor.validateContent(invalidContent);

      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toContain('Missing title');
      expect(invalidResult.errors).toContain('No paragraphs extracted');
    });
  });
});