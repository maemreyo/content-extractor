import type { Paragraph, SiteAdapter } from '../types';

export class GitHubAdapter implements SiteAdapter {
  name = 'github';
  patterns = [/github\.com/];
  priority = 10;

  extract(doc: Document, url: string) {
    if (url.includes('/blob/') || url.includes('/tree/')) {
      return this.extractCode(doc, url);
    } else if (url.includes('/issues/') || url.includes('/pull/')) {
      return this.extractIssue(doc, url);
    } else if (url.includes('/wiki/')) {
      return this.extractWiki(doc, url);
    } else {
      return this.extractReadme(doc, url);
    }
  }

  private extractReadme(doc: Document, url: string) {
    const readme = doc.querySelector('.markdown-body');
    if (!readme) return {};

    const title = doc.querySelector('[itemprop="name"]')?.textContent?.trim() ||
                 doc.title.split('·')[0].trim();

    const paragraphs = this.detectParagraphs(readme);
    const cleanText = paragraphs.map((p) => p.text).join('\n\n');
    const wordCount = cleanText.split(/\s+/).length;

    return {
      title,
      paragraphs,
      cleanText,
      wordCount,
      readingTime: Math.ceil(wordCount / 200),
      metadata: this.extractRepoMetadata(doc, url)
    };
  }

  private extractCode(doc: Document, url: string) {
    const codeContent = doc.querySelector('.blob-wrapper');
    if (!codeContent) return {};

    const title = doc.querySelector('.final-path')?.textContent?.trim() || '';
    const code = codeContent.querySelector('pre')?.textContent || '';

    const paragraphs: Paragraph[] = [{
      id: 'code-0',
      text: code,
      html: `<pre><code>${this.escapeHtml(code)}</code></pre>`,
      index: 0,
      element: 'pre',
      bounds: new DOMRect(),
      isQuote: false,
      isCode: true,
      isHeading: false,
      importance: 1
    }];

    return {
      title,
      paragraphs,
      cleanText: code,
      wordCount: code.split(/\s+/).length,
      readingTime: Math.ceil(code.split('\n').length / 50),
      metadata: {
        source: 'github.com',
        extractedAt: new Date(),
        tags: [this.getFileExtension(title)]
      }
    };
  }

  private extractIssue(doc: Document, url: string) {
    const title = doc.querySelector('.js-issue-title')?.textContent?.trim() || '';
    const paragraphs: Paragraph[] = [];
    let index = 0;

    const issueBody = doc.querySelector('.comment-body');
    if (issueBody) {
      const bodyParagraphs = this.detectParagraphs(issueBody);
      paragraphs.push(...bodyParagraphs);
      index = bodyParagraphs.length;
    }

    doc.querySelectorAll('.timeline-comment .comment-body').forEach((comment, i) => {
      if (i === 0) return;

      const commentParagraphs = this.detectParagraphs(comment);
      commentParagraphs.forEach((p) => {
        p.index = index++;
        p.id = `p-${p.index}`;
      });
      paragraphs.push(...commentParagraphs);
    });

    const cleanText = paragraphs.map((p) => p.text).join('\n\n');
    const wordCount = cleanText.split(/\s+/).length;

    return {
      title,
      paragraphs,
      cleanText,
      wordCount,
      readingTime: Math.ceil(wordCount / 200),
      metadata: this.extractIssueMetadata(doc, url)
    };
  }

  private extractWiki(doc: Document, url: string) {
    const content = doc.querySelector('.markdown-body');
    if (!content) return {};

    const title = doc.querySelector('.gh-header-title')?.textContent?.trim() || '';
    const paragraphs = this.detectParagraphs(content);
    const cleanText = paragraphs.map((p) => p.text).join('\n\n');
    const wordCount = cleanText.split(/\s+/).length;

    return {
      title,
      paragraphs,
      cleanText,
      wordCount,
      readingTime: Math.ceil(wordCount / 200),
      metadata: {
        source: 'github.com',
        extractedAt: new Date(),
        tags: ['wiki']
      }
    };
  }

  detectParagraphs(container: Element): Paragraph[] {
    const paragraphs: Paragraph[] = [];
    const elements = container.querySelectorAll(
      'p, h1, h2, h3, h4, h5, h6, pre, blockquote, ul, ol'
    );

    elements.forEach((element, index) => {
      const text = element.textContent?.trim() || '';
      if (text.length < 5) return;

      const tagName = element.tagName.toLowerCase();
      const isHeading = /^h[1-6]$/.test(tagName);
      const isCode = tagName === 'pre' || element.querySelector('code') !== null;
      const isList = tagName === 'ul' || tagName === 'ol';

      paragraphs.push({
        id: `p-${index}`,
        text,
        html: element.innerHTML,
        index,
        element: tagName,
        bounds: element.getBoundingClientRect(),
        isQuote: tagName === 'blockquote',
        isCode,
        isHeading,
        headingLevel: isHeading ? parseInt(tagName[1]) : undefined,
        importance: isHeading ? 0.9 : isCode ? 0.8 : 0.7
      });
    });

    return paragraphs;
  }

  private extractRepoMetadata(doc: Document, url: string) {
    const metadata: any = {
      source: 'github.com',
      extractedAt: new Date(),
      tags: []
    };

    doc.querySelectorAll('.topic-tag').forEach((tag) => {
      const topic = tag.textContent?.trim();
      if (topic) metadata.tags.push(topic);
    });

    const language = doc.querySelector('[itemprop="programmingLanguage"]')?.textContent?.trim();
    if (language) metadata.tags.push(language);

    const stars = doc.querySelector('[aria-label*="starred"]')?.textContent?.trim();
    if (stars) {
      metadata.stars = parseInt(stars.replace(/[^\d]/g, ''));
    }

    return metadata;
  }

  private extractIssueMetadata(doc: Document, url: string) {
    const metadata: any = {
      source: 'github.com',
      extractedAt: new Date(),
      tags: []
    };

    const state = doc.querySelector('.State')?.textContent?.trim();
    if (state) metadata.tags.push(state);

    doc.querySelectorAll('.IssueLabel').forEach((label) => {
      const text = label.textContent?.trim();
      if (text) metadata.tags.push(text);
    });

    const author = doc.querySelector('.author')?.textContent?.trim();
    if (author) metadata.author = author;

    const timeElement = doc.querySelector('relative-time');
    if (timeElement) {
      const datetime = timeElement.getAttribute('datetime');
      if (datetime) metadata.publishDate = new Date(datetime);
    }

    return metadata;
  }

  private getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}