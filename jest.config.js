/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/apps/web/app/$1',
  },
  roots: ['<rootDir>/apps/web/app'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'apps/web/tsconfig.json',
    }],
  },
}; 