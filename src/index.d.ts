export * from './types';
export * from './core/content-extractor-service';
export * from './extractors/text-extractor';
export * from './detectors/paragraph-detector';
export * from './cleaners/content-cleaner';
export * from './adapters';

declare module '@content-extractor/core' {
  export const contentExtractor: ContentExtractorService;
  export default ContentExtractorService;
}