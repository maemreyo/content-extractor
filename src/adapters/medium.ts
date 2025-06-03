import type { SiteAdapter, Paragraph } from '../types';

export class MediumAdapter implements SiteAdapter {
  name = 'medium';
  patterns = [
    /medium\.com/,
    /.*\.medium\.com/,
    /towardsdatascience\.com/,
    /hackernoon\.com/,
    /better.*programming/
  ];
  priority = 10;

  extract(doc: Document, url: string) {
    const article = doc.querySelector('article');
    if (!article) return {};

    const title = article.querySelector('h1')?.textContent?.trim() || '';
    const paragraphs = this.detectParagraphs(doc);
    const author = this.extractAuthor(doc);
    const publishDate = this.extractPublishDate(doc);

    const cleanText = paragraphs.map(p => p.text).join('\n\n');
    const wordCount = cleanText.split(/\s+/).length;

    return {
      title,
      paragraphs,
      cleanText,
      wordCount,
      readingTime: Math.ceil(wordCount / 200),
      metadata: {
        author,
        publishDate,
        source: 'medium.com',
        extractedAt: new Date(),
        tags: this.extractTags(doc)
      }
    };
  }

  detectParagraphs(doc: Document): Paragraph[] {
    const paragraphs: Paragraph[] = [];
    const article = doc.querySelector('article');
    if (!article) return paragraphs;

    const elements = article.querySelectorAll(
      'p, h1, h2, h3, h4, blockquote, pre, figure'
    );

    elements.forEach((element, index) => {
      const text = element.textContent?.trim() || '';
      if (text.length < 10) return;

      const tagName = element.tagName.toLowerCase();
      const isHeading = /^h[1-6]$/.test(tagName);

      paragraphs.push({
        id: `p-${index}`,
        text,
        html: element.innerHTML,
        index,
        element: `article > :nth-child(${index + 1})`,
        bounds: element.getBoundingClientRect(),
        isQuote: tagName === 'blockquote',
        isCode: tagName === 'pre' || element.querySelector('code') !== null,
        isHeading,
        headingLevel: isHeading ? parseInt(tagName[1]) : undefined,
        importance: isHeading ? 0.9 : 0.7
      });
    });

    return paragraphs;
  }

  private extractAuthor(doc: Document): string {
    const selectors = [
      'a[data-testid="authorName"]',
      'a[rel="author"]',
      'span[data-testid="authorName"]',
      '.pw-author-name'
    ];

    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element?.textContent) {
        return element.textContent.trim();
      }
    }

    return '';
  }

  private extractPublishDate(doc: Document): Date | undefined {
    const timeElement = doc.querySelector('time[datetime]');
    if (timeElement) {
      const datetime = timeElement.getAttribute('datetime');
      if (datetime) {
        return new Date(datetime);
      }
    }

    const metaDate = doc.querySelector('meta[property="article:published_time"]');
    if (metaDate) {
      const content = metaDate.getAttribute('content');
      if (content) {
        return new Date(content);
      }
    }

    return undefined;
  }

  private extractTags(doc: Document): string[] {
    const tags: string[] = [];

    doc.querySelectorAll('a[href*="/tag/"], a[href*="/tagged/"]').forEach(link => {
      const text = link.textContent?.trim();
      if (text && !tags.includes(text)) {
        tags.push(text);
      }
    });

    return tags;
  }
}