// Tests for EnvironmentalDataRepository
// Validates CRUD operations and query functionality

import { EnvironmentalDataRepository } from '../EnvironmentalDataRepository';
import { CreateEnvironmentalDataPoint, EnvironmentalDataQuery } from '../types';

// Mock the database connection
jest.mock('../../config/database', () => ({
  getDatabase: jest.fn(() => ({
    connect: jest.fn(() => ({
      query: jest.fn(),
      release: jest.fn()
    }))
  }))
}));

// Mock the logger
jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

describe('EnvironmentalDataRepository', () => {
  let repository: EnvironmentalDataRepository;
  let mockClient: any;
  let mockDb: any;

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    
    mockDb = {
      connect: jest.fn(() => Promise.resolve(mockClient))
    };

    // Reset mocks
    jest.clearAllMocks();
    
    // Mock the getDatabase function
    const { getDatabase } = require('../../config/database');
    getDatabase.mockReturnValue(mockDb);

    repository = new EnvironmentalDataRepository();
  });

  describe('create', () => {
    it('should create a new environmental data point', async () => {
      const testData: CreateEnvironmentalDataPoint = {
        source: 'openaq',
        pollutant: 'pm25',
        value: 15.5,
        unit: 'µg/m³',
        location: { latitude: 37.7749, longitude: -122.4194 },
        timestamp: new Date('2024-01-01T12:00:00Z'),
        quality_grade: 'A'
      };

      const mockResult = {
        rows: [{
          id: 'test-id',
          source: 'openaq',
          pollutant: 'pm25',
          value: '15.5',
          unit: 'µg/m³',
          location: 'POINT(-122.4194 37.7749)',
          address: null,
          timestamp: new Date('2024-01-01T12:00:00Z'),
          quality_grade: 'A',
          created_at: new Date()
        }]
      };

      mockClient.query.mockResolvedValue(mockResult);

      const result = await repository.create(testData);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO environmental_data'),
        expect.arrayContaining([
          'openaq',
          'pm25',
          15.5,
          'µg/m³',
          'POINT(-122.4194 37.7749)',
          null,
          testData.timestamp,
          'A'
        ])
      );

      expect(result).toEqual({
        id: 'test-id',
        source: 'openaq',
        pollutant: 'pm25',
        value: 15.5,
        unit: 'µg/m³',
        location: { latitude: 37.7749, longitude: -122.4194 },
        timestamp: new Date('2024-01-01T12:00:00Z'),
        quality_grade: 'A',
        created_at: expect.any(Date)
      });

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const testData: CreateEnvironmentalDataPoint = {
        source: 'openaq',
        pollutant: 'pm25',
        value: 15.5,
        unit: 'µg/m³',
        location: { latitude: 37.7749, longitude: -122.4194 },
        timestamp: new Date(),
        quality_grade: 'A'
      };

      mockClient.query.mockRejectedValue(new Error('Database error'));

      await expect(repository.create(testData)).rejects.toThrow('Failed to create environmental data point');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should find environmental data by ID', async () => {
      const mockResult = {
        rows: [{
          id: 'test-id',
          source: 'openaq',
          pollutant: 'pm25',
          value: '15.5',
          unit: 'µg/m³',
          location: 'POINT(-122.4194 37.7749)',
          address: null,
          timestamp: new Date('2024-01-01T12:00:00Z'),
          quality_grade: 'A',
          created_at: new Date()
        }]
      };

      mockClient.query.mockResolvedValue(mockResult);

      const result = await repository.findById('test-id');

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['test-id']
      );

      expect(result).toEqual({
        id: 'test-id',
        source: 'openaq',
        pollutant: 'pm25',
        value: 15.5,
        unit: 'µg/m³',
        location: { latitude: 37.7749, longitude: -122.4194 },
        timestamp: new Date('2024-01-01T12:00:00Z'),
        quality_grade: 'A',
        created_at: expect.any(Date)
      });
    });

    it('should return null when not found', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      const result = await repository.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('findMany', () => {
    it('should query environmental data with pagination', async () => {
      const query: EnvironmentalDataQuery = {
        pollutant: 'pm25',
        limit: 10,
        offset: 0
      };

      const mockCountResult = { rows: [{ total: '25' }] };
      const mockDataResult = {
        rows: [{
          id: 'test-id',
          source: 'openaq',
          pollutant: 'pm25',
          value: '15.5',
          unit: 'µg/m³',
          location: 'POINT(-122.4194 37.7749)',
          address: null,
          timestamp: new Date('2024-01-01T12:00:00Z'),
          quality_grade: 'A',
          created_at: new Date()
        }]
      };

      mockClient.query
        .mockResolvedValueOnce(mockCountResult)
        .mockResolvedValueOnce(mockDataResult);

      const result = await repository.findMany(query);

      expect(result.data).toHaveLength(1);
      expect(result.pagination).toEqual({
        total: 25,
        page: 1,
        limit: 10,
        has_next: true,
        has_previous: false
      });
    });
  });

  describe('bulkCreate', () => {
    it('should handle bulk insert of environmental data', async () => {
      const testData: CreateEnvironmentalDataPoint[] = [
        {
          source: 'openaq',
          pollutant: 'pm25',
          value: 15.5,
          unit: 'µg/m³',
          location: { latitude: 37.7749, longitude: -122.4194 },
          timestamp: new Date(),
          quality_grade: 'A'
        },
        {
          source: 'openaq',
          pollutant: 'pm10',
          value: 25.2,
          unit: 'µg/m³',
          location: { latitude: 37.7749, longitude: -122.4194 },
          timestamp: new Date(),
          quality_grade: 'B'
        }
      ];

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rowCount: 1 }) // First insert
        .mockResolvedValueOnce({ rowCount: 1 }) // Second insert
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await repository.bulkCreate(testData);

      expect(result).toBe(2);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should return 0 for empty array', async () => {
      const result = await repository.bulkCreate([]);
      expect(result).toBe(0);
    });
  });
});