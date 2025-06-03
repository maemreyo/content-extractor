import { Readability } from '@mozilla/readability';
import * as cheerio from 'cheerio';
import { JSDOM } from 'jsdom';
import { franc } from 'franc';
import { ContentCleaner } from '../cleaners/content-cleaner';
import { ParagraphDetector } from '../detectors/paragraph-detector';
import { getSiteAdapter } from '../adapters';
import type {
  ContentMetadata,
  ContentQuality,
  Embed,
  Entity,
  ExtractedContent,
  ExtractionOptions,
  List,
  ListItem,
  Paragraph,
  ReadabilityScore,
  Section,
  StructuredData,
  Table
} from '../types';

export class TextExtractor {
  private paragraphDetector: ParagraphDetector;
  private contentCleaner: ContentCleaner;

  constructor() {
    this.paragraphDetector = new ParagraphDetector();
    this.contentCleaner = new ContentCleaner();
  }

  async extractEnhanced(
    doc: Document,
    url: string,
    options: ExtractionOptions = {}
  ): Promise<ExtractedContent> {
    // Try site-specific adapter first
    const adapter = getSiteAdapter(url);
    if (adapter && (!options.adapter || options.adapter === adapter.name)) {
      const adapterResult = adapter.extract(doc, url);
      if (adapterResult.paragraphs && adapterResult.paragraphs.length > 0) {
        return this.enhanceExtractedContent(adapterResult, doc, url, options);
      }
    }

    // Fallback to Readability
    const reader = new Readability(doc);
    const article = reader.parse();
    
    if (article) {
      // Create DOM from Readability content for further processing
      const contentDom = new JSDOM(article.content);
      const contentDoc = contentDom.window.document;
      
      const paragraphs = await this.extractParagraphsEnhanced(contentDoc, options);
      const sections = options.detectSections ? this.detectSections(paragraphs) : [];
      const tables = options.extractTables ? this.extractTables(contentDoc) : undefined;
      const lists = options.extractLists ? this.extractLists(contentDoc) : undefined;
      const embeds = options.extractEmbeds ? this.extractEmbeds(contentDoc) : undefined;
      const structuredData = options.extractStructuredData ? this.extractStructuredData(doc) : undefined;
      
      const cleanText = paragraphs.map((p) => p.text).join('\n\n');
      const wordCount = cleanText.split(/\s+/).filter((w) => w.length > 0).length;
      const readingTime = Math.ceil(wordCount / 200);
      
      const quality = this.calculateQuality(contentDoc, paragraphs, tables, lists);
      
      return {
        title: article.title || this.extractTitle(doc),
        paragraphs,
        cleanText,
        sections,
        tables,
        lists,
        embeds,
        structuredData,
        readingTime,
        wordCount,
        language: this.detectLanguage(doc, cleanText),
        quality,
        fingerprint: '',
        metadata: options.includeMetadata
          ? await this.extractMetadataEnhanced(doc, url)
          : this.getBasicMetadata(url)
      };
    }

    // Fallback to generic extraction
    const cleanedDoc = this.contentCleaner.clean(
      doc.cloneNode(true) as Document,
      options.cleaningOptions
    );

    const paragraphs = await this.extractParagraphsEnhanced(cleanedDoc, options);
    const sections = options.detectSections ? this.detectSections(paragraphs) : [];
    const tables = options.extractTables ? this.extractTables(cleanedDoc) : undefined;
    const lists = options.extractLists ? this.extractLists(cleanedDoc) : undefined;
    const embeds = options.extractEmbeds ? this.extractEmbeds(cleanedDoc) : undefined;
    const structuredData = options.extractStructuredData ? this.extractStructuredData(doc) : undefined;

    const cleanText = paragraphs.map((p) => p.text).join('\n\n');
    const wordCount = cleanText.split(/\s+/).filter((w) => w.length > 0).length;
    const readingTime = Math.ceil(wordCount / 200);

    const quality = this.calculateQuality(cleanedDoc, paragraphs, tables, lists);

    return {
      title: this.extractTitle(doc),
      paragraphs,
      cleanText,
      sections,
      tables,
      lists,
      embeds,
      structuredData,
      readingTime,
      wordCount,
      language: this.detectLanguage(doc, cleanText),
      quality,
      fingerprint: '',
      metadata: options.includeMetadata
        ? await this.extractMetadataEnhanced(doc, url)
        : this.getBasicMetadata(url)
    };
  }

  private async extractParagraphsEnhanced(
    doc: Document,
    options: ExtractionOptions
  ): Promise<Paragraph[]> {
    const paragraphs = this.paragraphDetector.detect(doc, options);

    if (options.extractEntities || options.calculateReadability) {
      return Promise.all(
        paragraphs.map(async (p) => {
          if (options.extractEntities) {
            p.entities = this.extractEntities(p.text);
            p.keywords = this.extractKeywords(p.text);
          }

          if (options.calculateReadability) {
            p.readability = this.calculateReadability(p.text);
          }

          return p;
        })
      );
    }

    return paragraphs;
  }

  private extractTables(doc: Document): Table[] {
    const tables: Table[] = [];
    const tableElements = doc.querySelectorAll('table');

    tableElements.forEach((table, index) => {
      if (this.isLayoutTable(table)) return;

      const headers = this.extractTableHeaders(table);
      const rows = this.extractTableRows(table);
      const caption = table.querySelector('caption')?.textContent?.trim();

      if (headers.length > 0 || rows.length > 0) {
        tables.push({
          id: `table-${index}`,
          headers,
          rows,
          caption,
          element: this.getSelector(table),
          index
        });
      }
    });

    return tables;
  }

  private isLayoutTable(table: Element): boolean {
    const hasHeaders = table.querySelector('th, thead') !== null;
    const hasBorder = table.getAttribute('border') !== '0';
    const hasRole = table.getAttribute('role') === 'presentation';
    const cellCount = table.querySelectorAll('td, th').length;

    return !hasHeaders && !hasBorder && (hasRole || cellCount < 3);
  }

  private extractTableHeaders(table: Element): string[] {
    const headers: string[] = [];

    const thead = table.querySelector('thead');
    if (thead) {
      thead.querySelectorAll('th').forEach((th) => {
        headers.push(th.textContent?.trim() || '');
      });
    }

    if (headers.length === 0) {
      const firstRow = table.querySelector('tr');
      firstRow?.querySelectorAll('th, td').forEach((cell) => {
        const text = cell.textContent?.trim() || '';
        if (text && cell.tagName === 'TH') {
          headers.push(text);
        }
      });
    }

    return headers;
  }

  private extractTableRows(table: Element): string[][] {
    const rows: string[][] = [];
    const tbody = table.querySelector('tbody') || table;
    const trs = tbody.querySelectorAll('tr');

    trs.forEach((tr) => {
      const row: string[] = [];
      tr.querySelectorAll('td, th').forEach((cell) => {
        row.push(cell.textContent?.trim() || '');
      });
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
    });

    return rows;
  }

  private extractLists(doc: Document): List[] {
    const lists: List[] = [];
    const listElements = doc.querySelectorAll('ul, ol, dl');

    listElements.forEach((list, index) => {
      const type = list.tagName === 'UL' ? 'unordered' : list.tagName === 'OL' ? 'ordered' : 'definition';
      const items = this.extractListItems(list, 0);

      if (items.length > 0) {
        lists.push({
          id: `list-${index}`,
          type,
          items,
          element: this.getSelector(list),
          index
        });
      }
    });

    return lists;
  }

  private extractListItems(list: Element, depth: number): ListItem[] {
    const items: ListItem[] = [];

    if (list.tagName === 'DL') {
      const children = Array.from(list.children);
      for (let i = 0; i < children.length; i++) {
        if (children[i].tagName === 'DT') {
          const item: ListItem = {
            text: children[i].textContent?.trim() || '',
            html: children[i].innerHTML,
            depth
          };
          if (i + 1 < children.length && children[i + 1].tagName === 'DD') {
            item.subItems = [{
              text: children[i + 1].textContent?.trim() || '',
              html: children[i + 1].innerHTML,
              depth: depth + 1
            }];
          }
          items.push(item);
        }
      }
    } else {
      list.querySelectorAll(':scope > li').forEach((li) => {
        const item: ListItem = {
          text: this.getDirectText(li),
          html: li.innerHTML,
          depth
        };

        const nestedList = li.querySelector('ul, ol');
        if (nestedList) {
          item.subItems = this.extractListItems(nestedList, depth + 1);
        }

        items.push(item);
      });
    }

    return items;
  }

  private extractEmbeds(doc: Document): Embed[] {
    const embeds: Embed[] = [];
    let embedIndex = 0;

    doc.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]').forEach((element) => {
      const embed = this.createEmbed(element, embedIndex++);
      if (embed) embeds.push(embed);
    });

    doc.querySelectorAll('.twitter-tweet, .instagram-media, [data-tweet-id]').forEach((element) => {
      const embed = this.createSocialEmbed(element, embedIndex++);
      if (embed) embeds.push(embed);
    });

    doc.querySelectorAll('iframe[src*="codepen"], iframe[src*="jsfiddle"], iframe[src*="codesandbox"]').forEach((element) => {
      const embed = this.createCodeEmbed(element, embedIndex++);
      if (embed) embeds.push(embed);
    });

    return embeds;
  }

  private createEmbed(element: Element, index: number): Embed | null {
    const tagName = element.tagName.toLowerCase();
    let type: Embed['type'] = 'other';
    let url = '';
    let provider = '';

    if (tagName === 'video') {
      type = 'video';
      url = element.getAttribute('src') || '';
    } else if (tagName === 'iframe') {
      const src = element.getAttribute('src') || '';
      url = src;

      if (src.includes('youtube.com') || src.includes('youtu.be')) {
        type = 'video';
        provider = 'YouTube';
      } else if (src.includes('vimeo.com')) {
        type = 'video';
        provider = 'Vimeo';
      }
    }

    if (!url) return null;

    return {
      id: `embed-${index}`,
      type,
      url,
      provider,
      title: element.getAttribute('title') || undefined,
      element: this.getSelector(element),
      index
    };
  }

  private createSocialEmbed(element: Element, index: number): Embed | null {
    let type: Embed['type'] = 'other';
    let provider = '';
    let url = '';

    if (element.classList.contains('twitter-tweet')) {
      type = 'tweet';
      provider = 'Twitter';
      url = element.querySelector('a[href*="twitter.com"]')?.getAttribute('href') || '';
    } else if (element.classList.contains('instagram-media')) {
      type = 'instagram';
      provider = 'Instagram';
      url = element.getAttribute('data-instgrm-permalink') || '';
    }

    if (!url) return null;

    return {
      id: `embed-${index}`,
      type,
      url,
      provider,
      element: this.getSelector(element),
      index
    };
  }

  private createCodeEmbed(element: Element, index: number): Embed | null {
    const src = element.getAttribute('src') || '';
    let provider = '';

    if (src.includes('codepen.io')) {
      provider = 'CodePen';
    } else if (src.includes('jsfiddle.net')) {
      provider = 'JSFiddle';
    } else if (src.includes('codesandbox.io')) {
      provider = 'CodeSandbox';
    }

    return {
      id: `embed-${index}`,
      type: 'codepen',
      url: src,
      provider,
      element: this.getSelector(element),
      index
    };
  }

  private extractStructuredData(doc: Document): StructuredData[] {
    const data: StructuredData[] = [];

    doc.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
      try {
        const jsonData = JSON.parse(script.textContent || '{}');
        data.push({
          type: 'json-ld',
          data: jsonData,
          context: jsonData['@context']
        });
      } catch (e) {
        // Invalid JSON
      }
    });

    const ogData: any = {};
    doc.querySelectorAll('meta[property^="og:"]').forEach((meta) => {
      const property = meta.getAttribute('property')?.replace('og:', '');
      const content = meta.getAttribute('content');
      if (property && content) {
        ogData[property] = content;
      }
    });
    if (Object.keys(ogData).length > 0) {
      data.push({ type: 'opengraph', data: ogData });
    }

    const microdataElements = doc.querySelectorAll('[itemscope]');
    microdataElements.forEach((element) => {
      const itemData = this.extractMicrodata(element);
      if (itemData) {
        data.push({ type: 'microdata', data: itemData });
      }
    });

    return data;
  }

  private extractMicrodata(element: Element): any {
    const data: any = {};
    const itemType = element.getAttribute('itemtype');
    if (itemType) {
      data['@type'] = itemType;
    }

    element.querySelectorAll('[itemprop]').forEach((prop) => {
      const name = prop.getAttribute('itemprop');
      const value = prop.getAttribute('content') || prop.textContent?.trim();
      if (name && value) {
        data[name] = value;
      }
    });

    return Object.keys(data).length > 0 ? data : null;
  }

  private calculateQuality(
    doc: Document,
    paragraphs: Paragraph[],
    tables?: Table[],
    lists?: List[]
  ): ContentQuality {
    const text = paragraphs.map((p) => p.text).join(' ');
    const wordCount = text.split(/\s+/).length;

    const totalText = doc.body?.textContent?.length || 1;
    const htmlLength = doc.body?.innerHTML.length || 1;
    const textDensity = totalText / htmlLength;

    const links = doc.querySelectorAll('a');
    const linkText = Array.from(links).map((a) => a.textContent || '').join('').length;
    const linkDensity = linkText / (totalText || 1);

    const adSelectors = ['.ad', '.advertisement', '[id*="ad"]', '[class*="ad-"]'];
    const adElements = adSelectors.reduce(
      (count, selector) => count + doc.querySelectorAll(selector).length,
      0
    );
    const totalElements = doc.querySelectorAll('*').length;
    const adDensity = adElements / (totalElements || 1);

    const hasTitle = doc.querySelector('h1') !== null;
    const hasSections = doc.querySelectorAll('h2, h3').length > 0;
    const hasParagraphs = paragraphs.length > 3;
    const hasMedia = doc.querySelectorAll('img, video').length > 0;
    const structureScore =
      (hasTitle ? 0.25 : 0) +
      (hasSections ? 0.25 : 0) +
      (hasParagraphs ? 0.25 : 0) +
      (hasMedia ? 0.25 : 0);

    const avgSentenceLength = this.calculateAvgSentenceLength(text);
    const readabilityScore = Math.min(1, Math.max(0, 1 - (avgSentenceLength - 15) / 30));

    const hasMetadata = doc.querySelector('meta[name="author"]') !== null;
    const hasDate = doc.querySelector('time, [class*="date"]') !== null;
    const hasContent = wordCount > 200;
    const completeness = (hasMetadata ? 0.2 : 0) + (hasDate ? 0.2 : 0) + (hasContent ? 0.6 : 0);

    const score =
      textDensity * 0.2 +
      (1 - linkDensity) * 0.2 +
      (1 - adDensity) * 0.1 +
      structureScore * 0.2 +
      readabilityScore * 0.2 +
      completeness * 0.1;

    return {
      score: Math.min(1, Math.max(0, score)),
      textDensity,
      linkDensity,
      adDensity,
      readabilityScore,
      structureScore,
      completeness
    };
  }

  private extractEntities(text: string): Entity[] {
    const entities: Entity[] = [];

    const datePattern = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4})\b/gi;
    const dateMatches = text.match(datePattern);
    if (dateMatches) {
      dateMatches.forEach((match) => {
        entities.push({
          text: match,
          type: 'date',
          confidence: 0.9
        });
      });
    }

    const moneyPattern = /\$[\d,]+\.?\d*|\b\d+\s*(?:dollars?|euros?|pounds?|yen|yuan)\b/gi;
    const moneyMatches = text.match(moneyPattern);
    if (moneyMatches) {
      moneyMatches.forEach((match) => {
        entities.push({
          text: match,
          type: 'money',
          confidence: 0.85
        });
      });
    }

    const orgPattern = /\b[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,3}\b/g;
    const orgMatches = text.match(orgPattern);
    if (orgMatches) {
      orgMatches.forEach((match) => {
        if (!this.isCommonPhrase(match)) {
          entities.push({
            text: match,
            type: 'organization',
            confidence: 0.6
          });
        }
      });
    }

    return entities;
  }

  private extractKeywords(text: string): string[] {
    const words = text.toLowerCase().split(/\s+/);
    const wordFreq = new Map<string, number>();

    words.forEach((word) => {
      const cleaned = word.replace(/[^\w]/g, '');
      if (cleaned.length > 3 && !this.isStopWord(cleaned)) {
        wordFreq.set(cleaned, (wordFreq.get(cleaned) || 0) + 1);
      }
    });

    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  private calculateReadability(text: string): ReadabilityScore {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    const syllables = words.map((w) => this.countSyllables(w)).reduce((a, b) => a + b, 0);

    const avgSentenceLength = words.length / (sentences.length || 1);
    const avgSyllablesPerWord = syllables / (words.length || 1);

    const fleschKincaid = 0.39 * avgSentenceLength + 11.8 * avgSyllablesPerWord - 15.59;

    const complexWords = words.filter((w) => this.countSyllables(w) >= 3).length;
    const gunningFog = 0.4 * (avgSentenceLength + (100 * complexWords) / words.length);

    return {
      fleschKincaid: Math.max(0, fleschKincaid),
      gunningFog: Math.max(0, gunningFog),
      avgSentenceLength,
      avgWordLength: words.reduce((sum, w) => sum + w.length, 0) / words.length,
      complexWords: complexWords
    };
  }

  private countSyllables(word: string): number {
    word = word.toLowerCase();
    let count = 0;
    let previousWasVowel = false;

    for (let i = 0; i < word.length; i++) {
      const isVowel = /[aeiouy]/.test(word[i]);
      if (isVowel && !previousWasVowel) {
        count++;
      }
      previousWasVowel = isVowel;
    }

    if (word.endsWith('e')) {
      count--;
    }

    return Math.max(1, count);
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'as', 'are',
      'been', 'by', 'for', 'from', 'has', 'had', 'have', 'in', 'of', 'or',
      'that', 'to', 'was', 'will', 'with', 'would', 'could', 'should'
    ]);
    return stopWords.has(word);
  }

  private isCommonPhrase(phrase: string): boolean {
    const common = new Set([
      'The United States', 'United States', 'New York', 'Los Angeles'
    ]);
    return common.has(phrase);
  }

  private calculateAvgSentenceLength(text: string): number {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    return words.length / (sentences.length || 1);
  }

  private getDirectText(element: Element): string {
    let text = '';
    element.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      }
    });
    return text.trim();
  }

  private detectLanguage(doc: Document, text: string): string {
    const docLang = doc.documentElement.lang || doc.querySelector('html')?.getAttribute('lang');
    if (docLang) return docLang.split('-')[0];

    return franc(text.slice(0, 1000)) || 'en';
  }

  private getSelector(element: Element): string {
    const path: string[] = [];
    let current: Element | null = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector = `#${current.id}`;
        path.unshift(selector);
        break;
      } else if (current.className) {
        const classes = Array.from(current.classList)
          .filter((c) => !c.includes('_') && c.length < 20)
          .slice(0, 2);

        if (classes.length > 0) {
          selector += '.' + classes.join('.');
        }
      }

      const siblings = current.parentElement?.children;
      if (siblings && siblings.length > 1) {
        const index = Array.from(siblings).indexOf(current);
        selector += `:nth-child(${index + 1})`;
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
  }

  private async extractMetadataEnhanced(doc: Document, url: string): Promise<ContentMetadata> {
    const metadata = this.extractMetadata(doc, url);

    const authorElements = doc.querySelectorAll('[rel="author"], .author-name, .by-line');
    if (authorElements.length > 1) {
      metadata.authors = Array.from(authorElements)
        .map((el) => el.textContent?.trim())
        .filter((author): author is string => !!author);
    }

    const images = doc.querySelectorAll('img[src]');
    metadata.images = Array.from(images)
      .slice(0, 5)
      .map((img) => ({
        url: img.getAttribute('src') || '',
        alt: img.getAttribute('alt') || undefined,
        width: (img as HTMLImageElement).width || undefined,
        height: (img as HTMLImageElement).height || undefined
      }));

    metadata.socialMetadata = {
      twitter: {
        card: doc.querySelector('meta[name="twitter:card"]')?.getAttribute('content') || undefined,
        site: doc.querySelector('meta[name="twitter:site"]')?.getAttribute('content') || undefined,
        creator: doc.querySelector('meta[name="twitter:creator"]')?.getAttribute('content') || undefined
      },
      openGraph: {
        type: doc.querySelector('meta[property="og:type"]')?.getAttribute('content') || undefined,
        locale: doc.querySelector('meta[property="og:locale"]')?.getAttribute('content') || undefined,
        siteName: doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || undefined
      }
    };

    return metadata;
  }

  private extractMetadata(doc: Document, url: string): ContentMetadata {
    const metadata: ContentMetadata = {
      source: new URL(url).hostname,
      extractedAt: new Date(),
      tags: []
    };

    const authorSelectors = [
      'meta[name="author"]',
      'meta[property="article:author"]',
      '[rel="author"]',
      '.author-name',
      '.by-line',
      '.byline',
      '[itemprop="author"]'
    ];

    for (const selector of authorSelectors) {
      const element = doc.querySelector(selector);
      if (element) {
        metadata.author = element.getAttribute('content') || element.textContent?.trim();
        if (metadata.author) break;
      }
    }

    const dateSelectors = [
      { selector: 'meta[property="article:published_time"]', attr: 'content' },
      { selector: 'time[datetime]', attr: 'datetime' },
      { selector: '.publish-date', attr: 'textContent' },
      { selector: '[itemprop="datePublished"]', attr: 'content' }
    ];

    for (const { selector, attr } of dateSelectors) {
      const element = doc.querySelector(selector);
      if (element) {
        const dateStr = attr === 'textContent' ? element.textContent : element.getAttribute(attr);

        if (dateStr) {
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            metadata.publishDate = date;
            break;
          }
        }
      }
    }

    const keywords = doc.querySelector('meta[name="keywords"]')?.getAttribute('content');
    if (keywords) {
      metadata.tags = keywords.split(',').map((k) => k.trim()).filter((k) => k.length > 0);
    }

    const category = doc.querySelector('meta[property="article:section"]')?.getAttribute('content');
    if (category) {
      metadata.category = category;
    }

    metadata.description =
      doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
      doc.querySelector('meta[property="og:description"]')?.getAttribute('content');

    metadata.imageUrl =
      doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
      doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content');

    return metadata;
  }

  private getBasicMetadata(url: string): ContentMetadata {
    return {
      source: new URL(url).hostname,
      extractedAt: new Date(),
      tags: []
    };
  }

  private detectSections(paragraphs: Paragraph[]): Section[] {
    const sections: Section[] = [];
    let currentSection: Section | null = null;
    let sectionIndex = 0;

    paragraphs.forEach((p, index) => {
      if (p.isHeading && p.headingLevel) {
        if (currentSection) {
          currentSection.endIndex = index - 1;
          sections.push(currentSection);
        }

        currentSection = {
          id: `section-${sectionIndex++}`,
          title: p.text,
          level: p.headingLevel,
          paragraphs: [],
          startIndex: index,
          endIndex: index
        };
      } else if (currentSection) {
        currentSection.paragraphs.push(p);
        currentSection.endIndex = index;
      }
    });

    if (currentSection) {
      sections.push(currentSection);
    }

    return sections;
  }

  private extractTitle(doc: Document): string {
    const strategies = [
      () => doc.querySelector('h1')?.textContent,
      () => doc.querySelector('[class*="title"]')?.textContent,
      () => doc.querySelector('meta[property="og:title"]')?.getAttribute('content'),
      () => doc.title.split(/[|\-–]/)[0],
      () => doc.title
    ];

    for (const strategy of strategies) {
      const title = strategy()?.trim();
      if (title && title.length > 10 && title.length < 200) {
        return title;
      }
    }

    return doc.title;
  }

  private enhanceExtractedContent(
    partial: Partial<ExtractedContent>,
    doc: Document,
    url: string,
    options: ExtractionOptions
  ): ExtractedContent {
    const wordCount = partial.cleanText?.split(/\s+/).filter((w) => w.length > 0).length || 0;

    return {
      title: partial.title || this.extractTitle(doc),
      paragraphs: partial.paragraphs || [],
      cleanText: partial.cleanText || '',
      sections: partial.sections || [],
      readingTime: partial.readingTime || Math.ceil(wordCount / 200),
      wordCount: partial.wordCount || wordCount,
      language: partial.language || doc.documentElement.lang || 'en',
      metadata: partial.metadata || this.extractMetadata(doc, url),
      quality: partial.quality || this.calculateQuality(doc, partial.paragraphs || []),
      fingerprint: ''
    };
  }
}