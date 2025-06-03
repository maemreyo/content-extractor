import type { Paragraph, SiteAdapter } from '../types';

export class LinkedInAdapter implements SiteAdapter {
  name = 'linkedin';
  patterns = [/linkedin\.com/];
  priority = 10;

  extract(doc: Document, url: string) {
    if (url.includes('/pulse/') || url.includes('/article/')) {
      return this.extractArticle(doc, url);
    } else if (url.includes('/posts/')) {
      return this.extractPost(doc, url);
    } else {
      return this.extractProfile(doc, url);
    }
  }

  private extractArticle(doc: Document, url: string) {
    const article = doc.querySelector('.article-content__body') ||
                   doc.querySelector('[data-test-id="article-content"]');

    if (!article) return {};

    const title = doc.querySelector('.article-title')?.textContent?.trim() || '';
    const paragraphs = this.detectParagraphs(article);
    const cleanText = paragraphs.map((p) => p.text).join('\n\n');
    const wordCount = cleanText.split(/\s+/).length;

    return {
      title,
      paragraphs,
      cleanText,
      wordCount,
      readingTime: Math.ceil(wordCount / 200),
      metadata: {
        source: 'linkedin.com',
        extractedAt: new Date(),
        tags: []
      }
    };
  }

  private extractPost(doc: Document, url: string) {
    const postContent = doc.querySelector('.feed-shared-update-v2__description') ||
                       doc.querySelector('[data-test-id="post-content"]');

    if (!postContent) return {};

    const title = 'LinkedIn Post';
    const text = postContent.textContent?.trim() || '';

    const paragraphs: Paragraph[] = [{
      id: 'post-0',
      text,
      html: postContent.innerHTML,
      index: 0,
      element: '.feed-shared-update-v2__description',
      bounds: postContent.getBoundingClientRect(),
      isQuote: false,
      isCode: false,
      isHeading: false,
      importance: 0.8
    }];

    return {
      title,
      paragraphs,
      cleanText: text,
      wordCount: text.split(/\s+/).length,
      readingTime: 1,
      metadata: {
        source: 'linkedin.com',
        extractedAt: new Date(),
        tags: []
      }
    };
  }

  private extractProfile(doc: Document, url: string) {
    const sections: Paragraph[] = [];
    let index = 0;

    const about = doc.querySelector('.pv-about-section');
    if (about) {
      const text = about.textContent?.trim() || '';
      sections.push({
        id: `section-${index}`,
        text,
        html: about.innerHTML,
        index: index++,
        element: '.pv-about-section',
        bounds: about.getBoundingClientRect(),
        isQuote: false,
        isCode: false,
        isHeading: false,
        importance: 0.8
      });
    }

    const name = doc.querySelector('.pv-top-card--list li:first-child')?.textContent?.trim() || 'LinkedIn Profile';
    const cleanText = sections.map((p) => p.text).join('\n\n');

    return {
      title: name,
      paragraphs: sections,
      cleanText,
      wordCount: cleanText.split(/\s+/).length,
      readingTime: Math.ceil(cleanText.split(/\s+/).length / 200),
      metadata: {
        source: 'linkedin.com',
        extractedAt: new Date(),
        tags: ['profile']
      }
    };
  }

  detectParagraphs(container: Element): Paragraph[] {
    const paragraphs: Paragraph[] = [];
    const elements = container.querySelectorAll('p, h1, h2, h3, h4, blockquote, li');

    elements.forEach((element, index) => {
      const text = element.textContent?.trim() || '';
      if (text.length < 10) return;

      const tagName = element.tagName.toLowerCase();
      const isHeading = /^h[1-4]$/.test(tagName);

      paragraphs.push({
        id: `p-${index}`,
        text,
        html: element.innerHTML,
        index,
        element: tagName,
        bounds: element.getBoundingClientRect(),
        isQuote: tagName === 'blockquote',
        isCode: false,
        isHeading,
        headingLevel: isHeading ? parseInt(tagName[1]) : undefined,
        importance: isHeading ? 0.9 : 0.7
      });
    });

    return paragraphs;
  }
}