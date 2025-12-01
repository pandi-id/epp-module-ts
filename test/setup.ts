import { jest } from '@jest/globals';

// Global test setup
beforeEach(() => {
  jest.clearAllMocks();
});

// Global test timeout
jest.setTimeout(10000);