import sanitizeHtml from 'sanitize-html';
import type { CleaningOptions } from '../types';

export class ContentCleaner {
  private defaultOptions: CleaningOptions = {
    removeAds: true,
    removeNavigation: true,
    removeComments: true,
    removeRelated: true,
    removeFooters: true,
    removeSidebars: true,
    preserveImages: true,
    preserveVideos: true,
    preserveIframes: false,
    removePopups: true,
    removeCookieBanners: true,
    removeNewsletterSignups: true,
    preserveTables: true,
    preserveLists: true,
    preserveEmbeds: true,
    aggressiveMode: false
  };

  private removeSelectors = {
    ads: [
      '.advertisement', '.ad', '.ads', '[class*="ad-"]', '[id*="ad-"]',
      '.sponsored', '.promo', '[class*="sponsor"]', 'ins.adsbygoogle',
      '[id*="google_ads"]', '.banner-ad', '.text-ad', '.ad-container',
      '.ad-banner', '.ad-wrapper', '[data-ad]', '[data-advertisement]'
    ],
    navigation: [
      'nav', '.navigation', '.nav', '.menu', '#menu', '.navbar',
      '.header-menu', '.main-menu', '.site-navigation', '.breadcrumb',
      '.breadcrumbs', '[role="navigation"]', '.nav-links'
    ],
    comments: [
      '#comments', '.comments', '.comment-section', '.disqus',
      '#disqus_thread', '.fb-comments', '[id*="comments"]',
      '.comment-form', '.comment-list', '.comment-respond'
    ],
    related: [
      '.related', '.related-posts', '.recommended', '.more-stories',
      '.you-might-like', '.suggested', '.popular-posts', '.trending',
      '.also-read', '.read-next', '.more-articles', '.suggested-articles'
    ],
    footers: [
      'footer', '.footer', '#footer', '.site-footer', '.page-footer',
      '.copyright', '.footer-widgets', '.footer-content', '[role="contentinfo"]'
    ],
    sidebars: [
      'aside', '.sidebar', '#sidebar', '.widget-area', '.side-column',
      '.rail', '[class*="sidebar"]', '[id*="sidebar"]', '.aside',
      '.side-bar', '[role="complementary"]'
    ],
    social: [
      '.social-share', '.share-buttons', '.social-media', '.sharing',
      '.share-icons', '.social-links', '.share-bar', '.share-widget',
      '.social-buttons', '.sharing-buttons', '[class*="share-"]'
    ],
    popups: [
      '.popup', '.modal', '.overlay', '.lightbox', '.dialog',
      '[class*="popup"]', '[class*="modal"]', '.newsletter-signup',
      '.cookie-notice', '.cookie-banner', '.gdpr-banner', '.privacy-banner'
    ],
    newsletters: [
      '.newsletter', '.subscribe-form', '.email-signup', '.subscription-box',
      '.newsletter-form', '.subscribe-widget', '.email-subscription'
    ],
    cookieBanners: [
      '.cookie-banner', '.cookie-notice', '.cookie-consent', '.gdpr-notice',
      '.privacy-notice', '#cookie-banner', '#cookie-notice'
    ]
  };

  clean(doc: Document, options?: Partial<CleaningOptions>): Document {
    const opts = { ...this.defaultOptions, ...options };
    const cleanDoc = doc.cloneNode(true) as Document;

    // Remove unwanted elements
    if (opts.removeAds) this.removeElements(cleanDoc, this.removeSelectors.ads);
    if (opts.removeNavigation) this.removeElements(cleanDoc, this.removeSelectors.navigation);
    if (opts.removeComments) this.removeElements(cleanDoc, this.removeSelectors.comments);
    if (opts.removeRelated) this.removeElements(cleanDoc, this.removeSelectors.related);
    if (opts.removeFooters) this.removeElements(cleanDoc, this.removeSelectors.footers);
    if (opts.removeSidebars) this.removeElements(cleanDoc, this.removeSelectors.sidebars);
    if (opts.removePopups) this.removeElements(cleanDoc, this.removeSelectors.popups);
    if (opts.removeCookieBanners) this.removeElements(cleanDoc, this.removeSelectors.cookieBanners);
    if (opts.removeNewsletterSignups) this.removeElements(cleanDoc, this.removeSelectors.newsletters);

    // Always remove these
    this.removeElements(cleanDoc, this.removeSelectors.social);

    // Apply custom selectors
    if (opts.customSelectors?.remove) {
      this.removeElements(cleanDoc, opts.customSelectors.remove);
    }

    // Clean attributes
    this.cleanAttributes(cleanDoc, opts);

    // Handle media
    if (!opts.preserveImages) {
      this.removeElements(cleanDoc, ['img', 'picture', 'figure']);
    }
    if (!opts.preserveVideos) {
      this.removeElements(cleanDoc, ['video', 'audio']);
    }
    if (!opts.preserveIframes) {
      this.removeElements(cleanDoc, ['iframe', 'embed', 'object']);
    }

    // Remove empty elements
    this.removeEmptyElements(cleanDoc);

    // Remove hidden elements
    this.removeHiddenElements(cleanDoc);

    // Aggressive mode
    if (opts.aggressiveMode) {
      this.applyAggressiveCleaning(cleanDoc);
    }

    return cleanDoc;
  }

  cleanHtml(html: string, options?: Partial<CleaningOptions>): string {
    const opts = { ...this.defaultOptions, ...options };

    const allowedTags = ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'blockquote', 'pre', 'code', 'a', 'ul', 'ol', 'li', 'dl', 'dt', 'dd'];

    if (opts.preserveImages) {
      allowedTags.push('img', 'picture', 'figure', 'figcaption');
    }
    if (opts.preserveVideos) {
      allowedTags.push('video', 'audio', 'source');
    }
    if (opts.preserveIframes) {
      allowedTags.push('iframe');
    }
    if (opts.preserveTables) {
      allowedTags.push('table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption');
    }

    const allowedAttributes: sanitizeHtml.Attributes = {
      a: ['href', 'title', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      video: ['src', 'controls', 'width', 'height'],
      audio: ['src', 'controls'],
      iframe: ['src', 'width', 'height', 'frameborder', 'allowfullscreen'],
      blockquote: ['cite'],
      code: ['class'],
      pre: ['class']
    };

    return sanitizeHtml(html, {
      allowedTags,
      allowedAttributes,
      allowedIframeHostnames: ['www.youtube.com', 'player.vimeo.com', 'codepen.io'],
      transformTags: {
        a: (tagName, attribs) => {
          // Add rel="noopener noreferrer" to external links
          if (attribs.href && attribs.href.startsWith('http')) {
            attribs.rel = 'noopener noreferrer';
          }
          return { tagName, attribs };
        }
      }
    });
  }

  private removeElements(doc: Document, selectors: string[]) {
    selectors.forEach(selector => {
      try {
        doc.querySelectorAll(selector).forEach(el => el.remove());
      } catch (e) {
        // Invalid selector, skip
      }
    });
  }

  private cleanAttributes(doc: Document, options: CleaningOptions) {
    const allowedAttributes = [
      'href', 'src', 'alt', 'title', 'class', 'id',
      'data-src', 'data-srcset', 'width', 'height',
      'datetime', 'cite', 'lang', 'dir'
    ];

    // Preserve custom attributes if specified
    if (options.customSelectors?.preserve) {
      options.customSelectors.preserve.forEach(attr => {
        if (!allowedAttributes.includes(attr)) {
          allowedAttributes.push(attr);
        }
      });
    }

    doc.querySelectorAll('*').forEach(element => {
      const attributes = Array.from(element.attributes);

      attributes.forEach(attr => {
        if (!allowedAttributes.includes(attr.name) && !attr.name.startsWith('aria-')) {
          element.removeAttribute(attr.name);
        }
      });

      // Clean classes
      if (element.classList.length > 0) {
        const cleanClasses = Array.from(element.classList)
          .filter(cls => !this.isJunkClass(cls));

        element.className = cleanClasses.join(' ');
      }
    });
  }

  private isJunkClass(className: string): boolean {
    const junkPatterns = [
      /^js-/, /^is-/, /^has-/, /^wp-/, /^post-\d+$/,
      /^id-\d+$/, /^item-\d+$/, /^node-\d+$/, /^_/,
      /^widget-/, /^module-/, /^component-/
    ];

    return junkPatterns.some(pattern => pattern.test(className));
  }

  private removeEmptyElements(doc: Document) {
    let changed = true;

    while (changed) {
      changed = false;

      doc.querySelectorAll('div, span, p, section, article').forEach(element => {
        const text = element.textContent?.trim() || '';
        const hasImages = element.querySelector('img, video, iframe');
        const hasPreservedContent = element.querySelector('table, ul, ol, pre, code');

        if (text.length === 0 && !hasImages && !hasPreservedContent) {
          element.remove();
          changed = true;
        }
      });
    }
  }

  private removeHiddenElements(doc: Document) {
    // Remove inline hidden styles
    doc.querySelectorAll('[style*="display:none"], [style*="display: none"], [hidden]').forEach(el => {
      el.remove();
    });

    // Remove elements with hidden classes
    const hiddenClasses = ['hidden', 'hide', 'invisible', 'visually-hidden', 'sr-only', 'd-none'];
    hiddenClasses.forEach(cls => {
      doc.querySelectorAll(`.${cls}`).forEach(el => el.remove());
    });

    // Remove elements with zero dimensions
    doc.querySelectorAll('[width="0"], [height="0"]').forEach(el => {
      if (el.tagName !== 'IMG') { // Keep tracking pixels for now
        el.remove();
      }
    });
  }

  private applyAggressiveCleaning(doc: Document) {
    // Remove all divs with less than 50 characters
    doc.querySelectorAll('div').forEach(div => {
      const text = div.textContent?.trim() || '';
      if (text.length < 50 && !div.querySelector('img, video, table, ul, ol')) {
        div.remove();
      }
    });

    // Remove all links that look like navigation
    doc.querySelectorAll('a').forEach(link => {
      const text = link.textContent?.trim() || '';
      if (text.length < 20 && !link.closest('p, li')) {
        link.remove();
      }
    });

    // Remove any remaining elements with common ad/tracking classes
    const aggressivePatterns = [
      '[class*="banner"]', '[class*="promo"]', '[class*="sponsor"]',
      '[class*="widget"]', '[class*="module"]', '[id*="banner"]'
    ];
    this.removeElements(doc, aggressivePatterns);
  }
}