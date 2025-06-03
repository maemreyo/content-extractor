import type { SiteAdapter, Paragraph, Table } from '../types';

export class WikipediaAdapter implements SiteAdapter {
  name = 'wikipedia';
  patterns = [/wikipedia\.org/, /wikimedia\.org/];
  priority = 10;

  extract(doc: Document, url: string) {
    const content = doc.querySelector('#mw-content-text .mw-parser-output');
    if (!content) return {};

    const title = doc.querySelector('#firstHeading')?.textContent?.trim() || '';
    const paragraphs = this.detectParagraphs(doc);
    const cleanText = paragraphs.map((p) => p.text).join('\n\n');
    const wordCount = cleanText.split(/\s+/).length;

    return {
      title,
      paragraphs,
      cleanText,
      wordCount,
      readingTime: Math.ceil(wordCount / 200),
      metadata: {
        source: 'wikipedia.org',
        extractedAt: new Date(),
        tags: []
      }
    };
  }

  detectParagraphs(doc: Document): Paragraph[] {
    const paragraphs: Paragraph[] = [];
    const content = doc.querySelector('#mw-content-text .mw-parser-output');
    if (!content) return paragraphs;

    const elements = content.querySelectorAll('p, h2, h3, h4, blockquote, .mw-headline');

    elements.forEach((element, index) => {
      const text = element.textContent?.trim() || '';
      if (text.length < 10) return;

      if (element.querySelector('.mw-editsection')) {
        element.querySelector('.mw-editsection')?.remove();
      }

      const tagName = element.tagName.toLowerCase();
      const isHeading = element.classList.contains('mw-headline') || /^h[2-6]$/.test(tagName);

      paragraphs.push({
        id: `p-${index}`,
        text: element.textContent?.trim() || '',
        html: element.innerHTML,
        index,
        element: tagName,
        bounds: element.getBoundingClientRect(),
        isQuote: tagName === 'blockquote',
        isCode: false,
        isHeading,
        headingLevel: isHeading ? this.getHeadingLevel(element) : undefined,
        importance: isHeading ? 0.9 : 0.7
      });
    });

    return paragraphs;
  }

  private getHeadingLevel(element: Element): number {
    const tagName = element.tagName;
    if (/^H[2-6]$/.test(tagName)) {
      return parseInt(tagName[1]);
    }
    const parent = element.parentElement;
    if (parent && /^H[2-6]$/.test(parent.tagName)) {
      return parseInt(parent.tagName[1]);
    }
    return 2;
  }
}