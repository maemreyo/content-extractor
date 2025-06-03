import { contentExtractor, ContentExtractorService } from '@content-extractor/core';
import type { ExtractionOptions, ExtractionResult } from '@content-extractor/core';

// Example 1: Simple extraction using default instance
async function simpleExtraction() {
  console.log('=== Simple Extraction Example ===');
  
  const result = await contentExtractor.extract('https://medium.com/@example/article');
  
  if (result.success) {
    console.log('Title:', result.data.title);
    console.log('Author:', result.data.metadata.author);
    console.log('Word Count:', result.data.wordCount);
    console.log('Reading Time:', result.data.readingTime, 'minutes');
    console.log('Quality Score:', result.data.quality.score.toFixed(2));
    console.log('First paragraph:', result.data.paragraphs[0]?.text.substring(0, 100) + '...');
  } else {
    console.error('Extraction failed:', result.error);
  }
}

// Example 2: Custom configuration
async function customConfiguration() {
  console.log('\n=== Custom Configuration Example ===');
  
  const extractor = new ContentExtractorService({
    enabled: true,
    ttl: 7200000, // 2 hours
    maxSize: 100, // 100MB cache
    strategy: 'lru',
    persistent: true
  });

  const options: ExtractionOptions = {
    cleaningOptions: {
      removeAds: true,
      removeNavigation: true,
      preserveImages: true,
      preserveVideos: false,
      aggressiveMode: true
    },
    includeMetadata: true,
    detectSections: true,
    extractTables: true,
    extractLists: true,
    calculateReadability: true,
    extractEntities: true,
    minParagraphLength: 50,
    timeout: 15000
  };

  const result = await extractor.extract('https://en.wikipedia.org/wiki/Machine_learning', options);

  if (result.success) {
    console.log('Sections found:', result.data.sections.length);
    console.log('Tables found:', result.data.tables?.length || 0);
    console.log('Lists found:', result.data.lists?.length || 0);
    
    // Show readability metrics
    if (result.data.paragraphs[0]?.readability) {
      const readability = result.data.paragraphs[0].readability;
      console.log('Readability Metrics:');
      console.log('  - Flesch-Kincaid:', readability.fleschKincaid.toFixed(2));
      console.log('  - Gunning Fog:', readability.gunningFog.toFixed(2));
      console.log('  - Avg Sentence Length:', readability.avgSentenceLength.toFixed(2));
    }
    
    // Show extracted entities
    const entities = result.data.paragraphs.flatMap(p => p.entities || []);
    const entityTypes = new Map<string, number>();
    entities.forEach(e => entityTypes.set(e.type, (entityTypes.get(e.type) || 0) + 1));
    console.log('Entities found:', Object.fromEntries(entityTypes));
  }
}

// Example 3: Batch extraction with progress
async function batchExtraction() {
  console.log('\n=== Batch Extraction Example ===');
  
  const urls = [
    'https://github.com/microsoft/vscode',
    'https://github.com/facebook/react',
    'https://github.com/tensorflow/tensorflow'
  ];

  const results = await contentExtractor.extractBatch(urls, {
    cleaningOptions: { removeAds: true },
    includeMetadata: true
  }, 2); // Process 2 URLs concurrently

  results.forEach((result, index) => {
    console.log(`\nRepository ${index + 1}:`);
    if (result.success) {
      console.log('  Title:', result.data.title);
      console.log('  Stars:', (result.data.metadata as any).stars || 'N/A');
      console.log('  Language:', result.data.language);
    } else {
      console.log('  Failed:', result.error.message);
    }
  });
}

// Example 4: Streaming extraction for large documents
async function streamingExtraction() {
  console.log('\n=== Streaming Extraction Example ===');
  
  let totalParagraphs = 0;
  let totalWords = 0;

  const stream = contentExtractor.extractStream(
    'https://example.com/very-long-document',
    {
      chunkSize: 5,
      onProgress: (chunk) => {
        const paragraphCount = chunk.paragraphs?.length || 0;
        const wordCount = chunk.wordCount || 0;
        console.log(`Received chunk: ${paragraphCount} paragraphs, ${wordCount} words`);
      }
    }
  );

  try {
    for await (const chunk of stream) {
      totalParagraphs += chunk.paragraphs?.length || 0;
      totalWords += chunk.wordCount || 0;
      
      // Process chunk in real-time
      // For example, update UI or save to database
    }
    
    console.log(`Streaming complete: ${totalParagraphs} paragraphs, ${totalWords} words total`);
  } catch (error) {
    console.error('Streaming error:', error);
  }
}

// Example 5: Using plugins
async function pluginExample() {
  console.log('\n=== Plugin Example ===');
  
  const extractor = new ContentExtractorService();

  // Create a word frequency plugin
  const wordFrequencyPlugin = {
    name: 'word-frequency',
    version: '1.0.0',
    
    afterExtract(content: any) {
      const words = content.cleanText.toLowerCase().split(/\s+/);
      const frequency = new Map<string, number>();
      
      words.forEach(word => {
        const cleaned = word.replace(/[^\w]/g, '');
        if (cleaned.length > 3) {
          frequency.set(cleaned, (frequency.get(cleaned) || 0) + 1);
        }
      });
      
      // Add top 10 words to metadata
      const topWords = Array.from(frequency.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word, count]) => ({ word, count }));
      
      content.metadata.topWords = topWords;
      return content;
    }
  };

  await extractor.registerPlugin(wordFrequencyPlugin);

  const result = await extractor.extract('https://example.com/article');
  
  if (result.success) {
    console.log('Top words in article:');
    (result.data.metadata as any).topWords?.forEach((item: any) => {
      console.log(`  "${item.word}": ${item.count} times`);
    });
  }
}

// Example 6: Export in different formats
async function exportExample() {
  console.log('\n=== Export Example ===');
  
  const result = await contentExtractor.extract('https://example.com/article');
  
  if (result.success) {
    // Export as Markdown
    const markdown = await contentExtractor.exportContent(result.data, 'markdown');
    console.log('Markdown preview:');
    console.log(markdown.substring(0, 200) + '...\n');
    
    // Export as HTML
    const html = await contentExtractor.exportContent(result.data, 'html');
    console.log('HTML preview:');
    console.log(html.substring(0, 200) + '...\n');
    
    // Save to files
    // fs.writeFileSync('article.md', markdown);
    // fs.writeFileSync('article.html', html);
  }
}

// Example 7: Custom site adapter
async function customAdapterExample() {
  console.log('\n=== Custom Adapter Example ===');
  
  const { registerAdapter } = await import('@content-extractor/core');
  
  // Create adapter for a custom blog platform
  const myBlogAdapter = {
    name: 'myblog',
    patterns: [/myblog\.example\.com/],
    priority: 15,
    
    extract(doc: Document, url: string) {
      const title = doc.querySelector('.blog-title')?.textContent?.trim() || '';
      const content = doc.querySelector('.blog-content');
      const author = doc.querySelector('.blog-author')?.textContent?.trim();
      const date = doc.querySelector('.blog-date')?.getAttribute('data-date');
      
      const paragraphs = Array.from(content?.querySelectorAll('p') || []).map((p, i) => ({
        id: `p-${i}`,
        text: p.textContent?.trim() || '',
        html: p.innerHTML,
        index: i,
        element: 'p',
        bounds: p.getBoundingClientRect(),
        isQuote: false,
        isCode: false,
        isHeading: false,
        importance: 0.7
      }));
      
      return {
        title,
        paragraphs,
        cleanText: paragraphs.map(p => p.text).join('\n\n'),
        metadata: {
          author,
          publishDate: date ? new Date(date) : undefined,
          source: 'myblog.example.com',
          extractedAt: new Date(),
          tags: []
        }
      };
    }
  };
  
  registerAdapter(myBlogAdapter);
  
  // Now the adapter will be used automatically
  const result = await contentExtractor.extract('https://myblog.example.com/post/123');
  console.log('Custom adapter result:', result.success ? result.data.title : 'Failed');
}

// Example 8: Rate limiting and caching
async function performanceExample() {
  console.log('\n=== Performance Example ===');
  
  // Check rate limit before making request
  const url = 'https://api.example.com/article';
  const rateLimitInfo = contentExtractor.getRateLimitInfo(url);
  console.log('Rate limit info:', rateLimitInfo);
  
  if (rateLimitInfo.remaining === 0) {
    const waitTime = rateLimitInfo.resetTime - Date.now();
    console.log(`Rate limited. Wait ${Math.ceil(waitTime / 1000)} seconds.`);
    return;
  }
  
  // First request (cache miss)
  console.time('First request');
  const result1 = await contentExtractor.extract(url);
  console.timeEnd('First request');
  
  // Second request (cache hit)
  console.time('Second request (cached)');
  const result2 = await contentExtractor.extract(url);
  console.timeEnd('Second request (cached)');
  
  // Show cache statistics
  const cacheStats = contentExtractor.getCacheStats();
  console.log('Cache statistics:', cacheStats);
}

// Run examples
async function runExamples() {
  try {
    await simpleExtraction();
    await customConfiguration();
    await batchExtraction();
    // await streamingExtraction(); // Uncomment to test with real URL
    await pluginExample();
    await exportExample();
    await customAdapterExample();
    await performanceExample();
  } catch (error) {
    console.error('Example error:', error);
  }
}

// Run if called directly
if (require.main === module) {
  runExamples();
}