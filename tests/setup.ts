import { vi } from 'vitest';

// Mock browser APIs for testing
global.DOMRect = class DOMRect {
  constructor(
    public x = 0,
    public y = 0,
    public width = 0,
    public height = 0
  ) {}

  get top() { return this.y; }
  get left() { return this.x; }
  get bottom() { return this.y + this.height; }
  get right() { return this.x + this.width; }

  toJSON() {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      top: this.top,
      left: this.left,
      bottom: this.bottom,
      right: this.right
    };
  }
};

// Mock window object if needed
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: 768
  });

  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: 1024
  });
}

// Mock performance API
if (typeof performance === 'undefined') {
  (global as any).performance = {
    now: () => Date.now()
  };
}

// Suppress console errors in tests
console.error = vi.fn();
console.warn = vi.fn();