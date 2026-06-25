// Jest config — unit tests for the pure logic layer (currency, period math,
// bubble sizing, backup serialization, insights). We deliberately keep tests on
// modules that import only types/plain TS so they run fast with no native shims.
module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
};
