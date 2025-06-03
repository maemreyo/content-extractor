import { ContentExtractorService } from './core/content-extractor-service';

// Core exports
export { ContentExtractorService };
export { TextExtractor } from './extractors/text-extractor';
export { ParagraphDetector } from './detectors/paragraph-detector';
export { ContentCleaner } from './cleaners/content-cleaner';

// Site adapters
export {
  MediumAdapter,
  SubstackAdapter,
  GenericNewsAdapter,
  GitHubAdapter,
  WikipediaAdapter,
  LinkedInAdapter,
  RedditAdapter,
  TwitterAdapter,
  getSiteAdapter,
  registerAdapter,
  unregisterAdapter,
  getRegisteredAdapters,
  clearAdapters,
  getAdapterByName
} from './adapters';

// Types
export type {
  ExtractedContent,
  Paragraph,
  Table,
  List,
  ListItem,
  Embed,
  StructuredData,
  ContentQuality,
  ReadabilityScore,
  Entity,
  Section,
  ContentMetadata,
  ImageMetadata,
  SocialMetadata,
  SiteAdapter,
  CleaningOptions,
  ExtractionOptions,
  CustomExtractor,
  ExtractionEvents,
  ExtractionProgress,
  CacheOptions,
  ContentExtractorPlugin,
  ExtractionResult,
  StreamingOptions,
  BatchOptions
} from './types';

// Default instance for convenience
export const contentExtractor = new ContentExtractorService();

// Default export
export default ContentExtractorService;