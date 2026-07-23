// Test setup file for Vitest + @testing-library/react
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock localStorage for all tests
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock window.matchMedia (used by some CSS-related hooks)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
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

// Mock fetch globally — individual tests override with vi.fn()
global.fetch = vi.fn().mockImplementation(() => Promise.resolve({
  ok: true,
  json: async () => []
}));

// Reset all mocks between tests
afterEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
});
