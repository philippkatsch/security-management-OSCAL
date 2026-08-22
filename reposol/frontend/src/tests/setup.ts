// Test setup file for Vitest + @testing-library/react
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock localStorage for all tests
if (typeof window !== 'undefined') {
  const localStorageMock = (() => {
    let store = {};
    return {
      getItem: (key: string) => (store as any)[key] ?? null,
      setItem: (key: string, value: any) => { (store as any)[key] = String(value); },
      removeItem: (key: string) => { delete (store as any)[key]; },
      clear: () => { store = {}; },
    };
  })();
  Object.defineProperty(window, 'localStorage', { value: localStorageMock });

  // Mock window.matchMedia (used by some CSS-related hooks)
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: any) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
}

// Polyfill HTMLDialogElement showModal and close for Vitest jsdom environment
if (typeof HTMLDialogElement !== 'undefined') {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.open = true;
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      this.open = false;
    };
  }
}

// Mock fetch globally — individual tests override with vi.fn()
global.fetch = vi.fn().mockImplementation(() => Promise.resolve({
  ok: true,
  json: async () => []
}));

// Reset all mocks between tests
afterEach(() => {
  vi.clearAllMocks();
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.clear();
  }
});
