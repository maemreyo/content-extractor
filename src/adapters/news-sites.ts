import type { SiteAdapter } from '../types';

export class GenericNewsAdapter implements SiteAdapter {
  name = 'generic-news';
  patterns = [
    /nytimes\.com/,
    /washingtonpost\.com/,
    /theguardian\.com/,
    /bbc\.com/,
    /cnn\.com/,
    /reuters\.com/,
    /bloomberg\.com/,
    /wsj\.com/
  ];
  priority = 10;

  extract(doc: Document, url: string) {
    const article = doc.querySelector('article, [role="article"], .article-body, .story-body');
    if (!article) return {};

    const title = this.extractTitle(doc);
    const paragraphs = this.detectParagraphs(doc);
    const metadata = this.extractMetadata(doc);

    const cleanText = paragraphs.map(p => p.text).join('\n\n');
    const wordCount = cleanText.split(/\s+/).length;

    return {
      title,
      paragraphs,
      cleanText,
      wordCount,
      readingTime: Math.ceil(wordCount / 200),
      metadata
    };
  }

  detectParagraphs(doc: Document) {
    const paragraphs: any[] = [];
    const article = doc.querySelector('article, [role="article"], .article-body');
    if (!article) return paragraphs;

    const elements = article.querySelectorAll('p, h2, h3, h4, blockquote');

    elements.forEach((element, index) => {
      const text = element.textContent?.trim() || '';

      if (text.length < 30 && element.tagName === 'P') return;
      if (element.closest('.related, .advertisement, .promo')) return;

      const tagName = element.tagName.toLowerCase();
      const isHeading = /^h[2-6]$/.test(tagName);

      paragraphs.push({
        id: `p-${index}`,
        text,
        html: element.innerHTML,
        index,
        element: this.getCssPath(element),
        bounds: element.getBoundingClientRect(),
        isQuote: tagName === 'blockquote',
        isCode: false,
        isHeading,
        headingLevel: isHeading ? parseInt(tagName[1]) : undefined,
        importance: this.scoreParagraph(element, text, index)
      });
    });

    return paragraphs;
  }

  private extractTitle(doc: Document): string {
    const selectors = [
      'h1.headline',
      'h1[itemprop="headline"]',
      'h1.article-title',
      'h1',
      'meta[property="og:title"]'
    ];

    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element) {
        const content = element.getAttribute('content') || element.textContent;
        if (content) return content.trim();
      }
    }

    return doc.title;
  }

  private extractMetadata(doc: Document) {
    return {
      author: this.extractAuthor(doc),
      publishDate: this.extractPublishDate(doc),
      source: new URL(doc.location?.href || '').hostname,
      extractedAt: new Date(),
      tags: this.extractTags(doc),
      category: this.extractCategory(doc),
      description: doc.querySelector('meta[name="description"]')?.getAttribute('content'),
      imageUrl: doc.querySelector('meta[property="og:image"]')?.getAttribute('content')
    };
  }

  private extractAuthor(doc: Document): string {
    const selectors = [
      '[itemprop="author"] [itemprop="name"]',
      '[rel="author"]',
      '.byline-name',
      '.author-name',
      'meta[name="author"]',
      '.by-line',
      '.article-author'
    ];

    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element) {
        const content = element.getAttribute('content') || element.textContent;
        if (content) {
          return content.trim().replace(/^by\s+/i, '');
        }
      }
    }

    return '';
  }

  private extractPublishDate(doc: Document): Date | undefined {
    const selectors = [
      'time[datetime]',
      'time[pubdate]',
      '[itemprop="datePublished"]',
      'meta[property="article:published_time"]',
      'meta[name="publish_date"]',
      '.publish-date',
      '.article-date'
    ];

    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element) {
        const dateStr = element.getAttribute('datetime') ||
                       element.getAttribute('content') ||
                       element.textContent;

        if (dateStr) {
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
      }
    }

    return undefined;
  }

  private extractCategory(doc: Document): string | undefined {
    const selectors = [
      'meta[property="article:section"]',
      '[itemprop="articleSection"]',
      '.section-name',
      '.category'
    ];

    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element) {
        const content = element.getAttribute('content') || element.textContent;
        if (content) return content.trim();
      }
    }

    return undefined;
  }

  private extractTags(doc: Document): string[] {
    const tags: string[] = [];
    const tagSelectors = [
      'meta[property="article:tag"]',
      '[rel="tag"]',
      '.tags a',
      '.article-tags a'
    ];

    tagSelectors.forEach(selector => {
      doc.querySelectorAll(selector).forEach(element => {
        const tag = element.getAttribute('content') || element.textContent?.trim();
        if (tag && !tags.includes(tag)) {
          tags.push(tag);
        }
      });
    });

    return tags;
  }

  private getCssPath(element: Element): string {
    const path: string[] = [];
    let el: Element | null = element;

    while (el && el.nodeType === Node.ELEMENT_NODE) {
      let selector = el.nodeName.toLowerCase();

      if (el.id) {
        selector = '#' + el.id;
        path.unshift(selector);
        break;
      } else {
        let sibling = el;
        let nth = 1;

        while (sibling.previousElementSibling) {
          sibling = sibling.previousElementSibling;
          if (sibling.nodeName === el.nodeName) {
            nth++;
          }
        }

        if (nth > 1) {
          selector += `:nth-of-type(${nth})`;
        }
      }

      path.unshift(selector);
      el = el.parentElement;
    }

    return path.join(' > ');
  }

  private scoreParagraph(element: Element, text: string, index: number): number {
    let score = 0.7;

    if (index < 3) score += 0.2;
    else if (index < 5) score += 0.1;

    const wordCount = text.split(/\s+/).length;
    if (wordCount > 50) score += 0.1;

    if (element.className.includes('caption')) score -= 0.3;
    if (element.closest('aside, .sidebar')) score -= 0.4;

    return Math.max(0.1, Math.min(1, score));
  }
}