export interface ExtractedContent {
  title: string;
  paragraphs: Paragraph[];
  cleanText: string;
  metadata: ContentMetadata;
  sections: Section[];
  readingTime: number;
  wordCount: number;
  language: string;
  tables?: Table[];
  lists?: List[];
  embeds?: Embed[];
  structuredData?: StructuredData[];
  quality: ContentQuality;
  fingerprint: string;
}

export interface Paragraph {
  id: string;
  text: string;
  html: string;
  index: number;
  element: string;
  bounds: DOMRect;
  section?: string;
  isQuote: boolean;
  isCode: boolean;
  isHeading: boolean;
  headingLevel?: number;
  importance: number;
  sentiment?: number;
  keywords?: string[];
  entities?: Entity[];
  language?: string;
  readability?: ReadabilityScore;
}

export interface Table {
  id: string;
  headers: string[];
  rows: string[][];
  caption?: string;
  element: string;
  index: number;
}

export interface List {
  id: string;
  type: 'ordered' | 'unordered' | 'definition';
  items: ListItem[];
  element: string;
  index: number;
}

export interface ListItem {
  text: string;
  html: string;
  subItems?: ListItem[];
  depth: number;
}

export interface Embed {
  id: string;
  type: 'video' | 'audio' | 'iframe' | 'tweet' | 'instagram' | 'codepen' | 'other';
  url: string;
  title?: string;
  provider?: string;
  thumbnailUrl?: string;
  element: string;
  index: number;
}

export interface StructuredData {
  type: 'json-ld' | 'microdata' | 'rdfa' | 'opengraph';
  data: any;
  context?: string;
}

export interface ContentQuality {
  score: number;
  textDensity: number;
  linkDensity: number;
  adDensity: number;
  readabilityScore: number;
  structureScore: number;
  completeness: number;
}

export interface ReadabilityScore {
  fleschKincaid: number;
  gunningFog: number;
  avgSentenceLength: number;
  avgWordLength: number;
  complexWords: number;
}

export interface Entity {
  text: string;
  type: 'person' | 'organization' | 'location' | 'date' | 'money' | 'other';
  confidence: number;
  metadata?: Record<string, any>;
}

export interface Section {
  id: string;
  title: string;
  paragraphs: Paragraph[];
  level: number;
  startIndex: number;
  endIndex: number;
  summary?: string;
  keywords?: string[];
  subSections?: Section[];
}

export interface ContentMetadata {
  author?: string;
  authors?: string[];
  publishDate?: Date;
  updateDate?: Date;
  category?: string;
  categories?: string[];
  tags: string[];
  description?: string;
  imageUrl?: string;
  images?: ImageMetadata[];
  source: string;
  extractedAt: Date;
  publisher?: string;
  copyright?: string;
  license?: string;
  wordCount?: number;
  estimatedReadTime?: number;
  socialMetadata?: SocialMetadata;
}

export interface ImageMetadata {
  url: string;
  alt?: string;
  caption?: string;
  width?: number;
  height?: number;
  type?: string;
}

export interface SocialMetadata {
  twitter?: {
    card?: string;
    site?: string;
    creator?: string;
  };
  openGraph?: {
    type?: string;
    locale?: string;
    siteName?: string;
  };
}

export interface SiteAdapter {
  name: string;
  patterns: RegExp[];
  priority?: number;
  extract(doc: Document, url: string): Partial<ExtractedContent>;
  cleanContent?(content: string): string;
  detectParagraphs?(doc: Document): Paragraph[];
  detectTables?(doc: Document): Table[];
  detectLists?(doc: Document): List[];
  detectEmbeds?(doc: Document): Embed[];
  extractStructuredData?(doc: Document): StructuredData[];
  validateContent?(content: ExtractedContent): boolean;
}

export interface CleaningOptions {
  removeAds: boolean;
  removeNavigation: boolean;
  removeComments: boolean;
  removeRelated: boolean;
  removeFooters: boolean;
  removeSidebars: boolean;
  preserveImages: boolean;
  preserveVideos: boolean;
  preserveIframes: boolean;
  removePopups: boolean;
  removeCookieBanners: boolean;
  removeNewsletterSignups: boolean;
  preserveTables: boolean;
  preserveLists: boolean;
  preserveEmbeds: boolean;
  aggressiveMode: boolean;
  customSelectors?: {
    remove?: string[];
    preserve?: string[];
  };
}

export interface ExtractionOptions {
  adapter?: string;
  cleaningOptions?: Partial<CleaningOptions>;
  minParagraphLength?: number;
  includeMetadata?: boolean;
  detectSections?: boolean;
  scoreParagraphs?: boolean;
  extractTables?: boolean;
  extractLists?: boolean;
  extractEmbeds?: boolean;
  extractStructuredData?: boolean;
  extractEntities?: boolean;
  calculateReadability?: boolean;
  generateSummary?: boolean;
  maxDepth?: number;
  timeout?: number;
  lazy?: boolean;
  waitForSelectors?: string[];
  customExtractors?: CustomExtractor[];
}

export interface CustomExtractor {
  name: string;
  selector: string;
  extract: (element: Element) => any;
  transform?: (data: any) => any;
}

export interface ExtractionEvents {
  onStart?: () => void;
  onProgress?: (progress: ExtractionProgress) => void;
  onComplete?: (content: ExtractedContent) => void;
  onError?: (error: Error) => void;
}

export interface ExtractionProgress {
  phase: 'fetching' | 'parsing' | 'cleaning' | 'extracting' | 'analyzing';
  progress: number;
  message?: string;
}

export interface CacheOptions {
  enabled: boolean;
  ttl: number;
  maxSize: number;
  strategy: 'lru' | 'lfu' | 'fifo';
  persistent: boolean;
}

export interface ContentExtractorPlugin {
  name: string;
  version: string;
  init?: () => Promise<void>;
  beforeExtract?: (doc: Document, options: ExtractionOptions) => Document;
  afterExtract?: (content: ExtractedContent) => ExtractedContent;
  extractors?: Record<string, (doc: Document) => any>;
}

export type ExtractionResult<T = ExtractedContent> =
  | { success: true; data: T }
  | { success: false; error: Error; partial?: Partial<T> };

export interface StreamingOptions extends ExtractionOptions {
  stream?: boolean;
  chunkSize?: number;
  onProgress?: (chunk: Partial<ExtractedContent>) => void;
}

export interface BatchOptions {
  parallel?: number;
  retryFailed?: boolean;
  continueOnError?: boolean;
}