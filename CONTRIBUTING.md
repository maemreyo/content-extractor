# Contributing to @content-extractor/core

Thank you for your interest in contributing to Content Extractor! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please be respectful and constructive in all interactions.

## How to Contribute

### Reporting Issues

- Check existing issues before creating a new one
- Use issue templates when available
- Provide clear reproduction steps
- Include relevant system information

### Submitting Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/content-extractor.git
   cd content-extractor
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Run tests:
   ```bash
   pnpm test
   ```

4. Build the project:
   ```bash
   pnpm build
   ```

### Coding Standards

- Use TypeScript for all code
- Follow existing code style
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass
- Run linting before committing

### Adding Site Adapters

To add a new site adapter:

1. Create a new file in `src/adapters/`:
   ```typescript
   // src/adapters/mysite.ts
   import type { SiteAdapter } from '../types';

   export class MySiteAdapter implements SiteAdapter {
     name = 'mysite';
     patterns = [/mysite\.com/];
     priority = 10;

     extract(doc: Document, url: string) {
       // Extraction logic
     }

     detectParagraphs(doc: Document) {
       // Paragraph detection logic
     }
   }
   ```

2. Add the adapter to `src/adapters/index.ts`

3. Add tests for the adapter

4. Update documentation

### Testing

- Write unit tests for all new features
- Ensure existing tests pass
- Add integration tests for site adapters
- Test with real-world URLs

### Documentation

- Update README.md for new features
- Add JSDoc comments to all public APIs
- Include usage examples
- Update type definitions

### Commit Messages

Follow conventional commit format:
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Test additions/changes
- `chore:` Build process/auxiliary changes

### Release Process

1. Update version in package.json
2. Update CHANGELOG.md
3. Create a release PR
4. After merge, tag the release
5. Publish to npm

## Questions?

Feel free to open an issue for any questions about contributing.