import type { Paragraph, SiteAdapter } from '../types';

export class RedditAdapter implements SiteAdapter {
  name = 'reddit';
  patterns = [/reddit\.com/, /redd\.it/];
  priority = 10;

  extract(doc: Document, url: string) {
    const title = this.extractTitle(doc);
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
        source: 'reddit.com',
        extractedAt: new Date(),
        tags: []
      }
    };
  }

  detectParagraphs(doc: Document): Paragraph[] {
    const paragraphs: Paragraph[] = [];
    let index = 0;

    const postContent = doc.querySelector('[data-test-id="post-content"]');
    if (postContent) {
      const text = postContent.textContent?.trim() || '';
      if (text.length > 10) {
        paragraphs.push({
          id: `p-${index}`,
          text,
          html: postContent.innerHTML,
          index: index++,
          element: '[data-test-id="post-content"]',
          bounds: postContent.getBoundingClientRect(),
          isQuote: false,
          isCode: false,
          isHeading: false,
          importance: 0.9
        });
      }
    }

    const comments = doc.querySelectorAll('[data-testid="comment"]');
    comments.forEach((comment) => {
      const commentBody = comment.querySelector('.RichTextJSON-root');
      if (commentBody) {
        const text = commentBody.textContent?.trim() || '';
        if (text.length > 10) {
          const author = comment.querySelector('[data-testid="comment_author_link"]')?.textContent?.trim();
          
          paragraphs.push({
            id: `p-${index}`,
            text: author ? `[${author}]: ${text}` : text,
            html: commentBody.innerHTML,
            index: index++,
            element: `[data-testid="comment"]:nth-of-type(${index})`,
            bounds: commentBody.getBoundingClientRect(),
            isQuote: true,
            isCode: false,
            isHeading: false,
            importance: 0.5
          });
        }
      }
    });

    return paragraphs;
  }

  private extractTitle(doc: Document): string {
    return doc.querySelector('h1')?.textContent?.trim() ||
           doc.querySelector('[data-test-id="post-title"]')?.textContent?.trim() ||
           doc.title.split('-')[0].trim();
  }
}