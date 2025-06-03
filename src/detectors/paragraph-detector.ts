import type { Paragraph, ExtractionOptions } from '../types';

export class ParagraphDetector {
  private paragraphSelectors = [
    'p',
    'div.paragraph',
    'div.content > div',
    'article > div',
    '.post-content > *',
    '.entry-content > *',
    '.article-body > *'
  ];

  private excludeSelectors = [
    'script',
    'style',
    'nav',
    'header',
    'footer',
    '.advertisement',
    '.social-share',
    '.related-posts',
    '[class*="sidebar"]',
    '[class*="widget"]',
    '[id*="comments"]'
  ];

  detect(doc: Document, options: ExtractionOptions = {}): Paragraph[] {
    const paragraphs: Paragraph[] = [];
    const minLength = options.minParagraphLength || 20;
    const elements = this.findParagraphElements(doc);

    elements.forEach((element, index) => {
      const text = this.extractText(element);

      if (text.length < minLength) return;

      const paragraph: Paragraph = {
        id: `p-${index}`,
        text,
        html: this.extractHTML(element),
        index,
        element: this.getSelector(element),
        bounds: element.getBoundingClientRect(),
        isQuote: this.isQuote(element),
        isCode: this.isCode(element),
        isHeading: this.isHeading(element),
        headingLevel: this.getHeadingLevel(element),
        importance: options.scoreParagraphs ? this.scoreParagraph(element, text) : 0.5
      };

      paragraphs.push(paragraph);
    });

    return this.postProcess(paragraphs);
  }

  private findParagraphElements(doc: Document): Element[] {
    const elements: Element[] = [];
    const seen = new Set<Element>();

    const contentContainer = this.findContentContainer(doc);

    if (contentContainer) {
      const walker = document.createTreeWalker(
        contentContainer,
        NodeFilter.SHOW_ELEMENT,
        {
          acceptNode: (node) => {
            const element = node as Element;

            if (this.shouldExclude(element)) {
              return NodeFilter.FILTER_REJECT;
            }

            if (this.hasTextContent(element)) {
              return NodeFilter.FILTER_ACCEPT;
            }

            return NodeFilter.FILTER_SKIP;
          }
        }
      );

      let node: Node | null;
      while (node = walker.nextNode()) {
        const element = node as Element;
        if (!seen.has(element) && !this.hasTextChildren(element)) {
          seen.add(element);
          elements.push(element);
        }
      }
    } else {
      this.paragraphSelectors.forEach(selector => {
        doc.querySelectorAll(selector).forEach(element => {
          if (!seen.has(element) && !this.shouldExclude(element)) {
            seen.add(element);
            elements.push(element);
          }
        });
      });
    }

    return elements;
  }

  private findContentContainer(doc: Document): Element | null {
    const candidates = [
      doc.querySelector('main'),
      doc.querySelector('article'),
      doc.querySelector('[role="main"]'),
      doc.querySelector('.content'),
      doc.querySelector('.post-content'),
      doc.querySelector('.entry-content'),
      doc.querySelector('#content')
    ].filter(Boolean) as Element[];

    let bestCandidate: Element | null = null;
    let bestScore = 0;

    candidates.forEach(candidate => {
      const score = this.scoreContainer(candidate);
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = candidate;
      }
    });

    return bestCandidate;
  }

  private scoreContainer(element: Element): number {
    const text = element.textContent || '';
    const linkText = Array.from(element.querySelectorAll('a'))
      .map(a => a.textContent || '')
      .join('');

    const textLength = text.length;
    const linkDensity = linkText.length / (textLength || 1);

    return textLength * (1 - linkDensity);
  }

  private shouldExclude(element: Element): boolean {
    for (const selector of this.excludeSelectors) {
      if (element.matches(selector)) return true;
    }

    for (const selector of this.excludeSelectors) {
      if (element.closest(selector)) return true;
    }

    return false;
  }

  private hasTextContent(element: Element): boolean {
    const text = element.textContent?.trim() || '';
    return text.length > 20;
  }

  private hasTextChildren(element: Element): boolean {
    return Array.from(element.children).some(child =>
      this.hasTextContent(child) && !this.shouldExclude(child)
    );
  }

  private extractText(element: Element): string {
    const clone = element.cloneNode(true) as Element;
    clone.querySelectorAll('script, style').forEach(el => el.remove());
    return clone.textContent?.trim() || '';
  }

  private extractHTML(element: Element): string {
    const clone = element.cloneNode(true) as Element;
    clone.querySelectorAll('script, style').forEach(el => el.remove());
    return clone.innerHTML.trim();
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
          .filter(c => !c.includes('_') && c.length < 20)
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

  private isQuote(element: Element): boolean {
    return element.tagName === 'BLOCKQUOTE' ||
           element.classList.contains('quote') ||
           element.classList.contains('blockquote') ||
           element.getAttribute('role') === 'blockquote';
  }

  private isCode(element: Element): boolean {
    return element.tagName === 'CODE' ||
           element.tagName === 'PRE' ||
           element.classList.contains('code') ||
           element.classList.contains('highlight');
  }

  private isHeading(element: Element): boolean {
    return /^H[1-6]$/.test(element.tagName);
  }

  private getHeadingLevel(element: Element): number | undefined {
    const match = element.tagName.match(/^H([1-6])$/);
    return match ? parseInt(match[1]) : undefined;
  }

  private scoreParagraph(element: Element, text: string): number {
    let score = 0.5;

    if (text.length > 100) score += 0.1;
    if (text.length > 300) score += 0.1;

    const position = element.getBoundingClientRect().top;
    if (position < window.innerHeight) score += 0.1;

    if (element.closest('article')) score += 0.1;
    if (element.tagName === 'P') score += 0.05;

    if (this.isQuote(element)) score -= 0.2;
    if (this.isCode(element)) score -= 0.3;

    const links = element.querySelectorAll('a').length;
    const words = text.split(/\s+/).length;
    const linkDensity = links / (words || 1);
    score -= linkDensity * 0.5;

    return Math.max(0, Math.min(1, score));
  }

  private postProcess(paragraphs: Paragraph[]): Paragraph[] {
    const processed: Paragraph[] = [];
    let current: Paragraph | null = null;

    paragraphs.forEach(p => {
      if (current && this.shouldMerge(current, p)) {
        current.text += '\n' + p.text;
        current.html += '\n' + p.html;
        current.bounds = this.mergeBounds(current.bounds, p.bounds);
      } else {
        if (current) processed.push(current);
        current = p;
      }
    });

    if (current) processed.push(current);

    processed.forEach((p, i) => {
      p.index = i;
      p.id = `p-${i}`;
    });

    return processed;
  }

  private shouldMerge(p1: Paragraph, p2: Paragraph): boolean {
    if (p1.isHeading || p2.isHeading) return false;
    if (p1.isQuote || p2.isQuote || p1.isCode || p2.isCode) return false;

    const distance = p2.bounds.top - (p1.bounds.top + p1.bounds.height);
    if (distance > 50) return false;

    const p1EndsWithPeriod = /[.!?]$/.test(p1.text.trim());
    const p2StartsWithLower = /^[a-z]/.test(p2.text.trim());

    return !p1EndsWithPeriod && p2StartsWithLower;
  }

  private mergeBounds(b1: DOMRect, b2: DOMRect): DOMRect {
    return new DOMRect(
      Math.min(b1.left, b2.left),
      b1.top,
      Math.max(b1.right, b2.right) - Math.min(b1.left, b2.left),
      b2.bottom - b1.top
    );
  }
}