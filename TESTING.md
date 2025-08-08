# EcoSense.ai Testing Guide

This document provides information about testing the EcoSense.ai infrastructure and application components.

## Available Tests

### Unit Tests
Tests individual components in isolation without external dependencies.

**Location**: `src/**/__tests__/*.test.ts`

**What's tested**:
- Logger functionality
- Error handler middleware
- Utility functions

**Run unit tests**:
```bash
npm test
```

## Quick Start Testing

### Setup Test Environment

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Build and Quality Checks

```bash
# Build TypeScript
npm run build

# Check code quality
npm run lint

# Fix linting issues
npm run lint:fix
```

## Docker Testing Environment

### Start Services
```bash
# Start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs
```

## Test Coverage

Generate test coverage reports:

```bash
npm test -- --coverage
```

## Adding New Tests

When adding new functionality, ensure you add corresponding tests:

Example test structure:
```typescript
describe('New Feature', () => {
  beforeEach(() => {
    // Setup before each test
  });

  it('should handle normal case', () => {
    // Test implementation
  });

  it('should handle error case', () => {
    // Error handling test
  });
});
```