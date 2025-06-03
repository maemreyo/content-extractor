import type { SiteAdapter, Paragraph } from '../types';

export class SubstackAdapter implements SiteAdapter {
  name = 'substack';
  patterns = [/\.substack\.com/, /substack\.com/];
  priority = 10;

  extract(doc: Document, url: string) {
    const article = doc.querySelector('.post, article');
    if (!article) return {};

    const title = doc.querySelector('h1.post-title, h1')?.textContent?.trim() || '';
    const paragraphs = this.detectParagraphs(doc);
    const cleanText = paragraphs.map(p => p.text).join('\n\n');
    const wordCount = cleanText.split(/\s+/).length;

    return {
      title,
      paragraphs,
      cleanText,
      wordCount,
      readingTime: Math.ceil(wordCount / 200),
      metadata: {
        source: 'substack.com',
        extractedAt: new Date(),
        tags: []
      }
    };
  }

  detectParagraphs(doc: Document): Paragraph[] {
    const paragraphs: Paragraph[] = [];
    const content = doc.querySelector('.body, .post-content, article');
    if (!content) return paragraphs;

    const elements = content.querySelectorAll('p, h1, h2, h3, h4, blockquote, pre');

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
        element: tagName,
        bounds: element.getBoundingClientRect(),
        isQuote: tagName === 'blockquote',
        isCode: tagName === 'pre',
        isHeading,
        headingLevel: isHeading ? parseInt(tagName[1]) : undefined,
        importance: isHeading ? 0.9 : 0.7
      });
    });

    return paragraphs;
  }
}