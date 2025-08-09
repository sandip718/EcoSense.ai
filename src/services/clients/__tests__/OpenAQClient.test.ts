import { OpenAQClient, OpenAQConfig, OpenAQResponse } from '../OpenAQClient';
import { Logger } from 'winston';

// Mock fetch globally
global.fetch = jest.fn();

describe('OpenAQClient', () => {
  let client: OpenAQClient;
  let mockLogger: jest.Mocked<Logger>;

  const mockConfig: OpenAQConfig = {
    endpoint: 'https://api.openaq.org',
    apiKey: 'test-api-key',
    rateLimit: 60
  };

  const mockOpenAQResponse: OpenAQResponse = {
    meta: {
      name: 'openaq-api',
      license: 'CC BY 4.0',
      website: 'https://openaq.org',
      page: 1,
      limit: 100,
      found: 2
    },
    results: [
      {
        parameter: 'pm25',
        value: 25.5,
        unit: 'µg/m³',
        date: {
          utc: '2023-01-01T12:00:00Z',
          local: '2023-01-01T04:00:00-08:00'
        },
        coordinates: {
          latitude: 34.0522,
          longitude: -118.2437
        },
        country: 'US',
        city: 'Los Angeles',
        location: 'Downtown LA',
        sourceName: 'EPA AirNow',
        sourceType: 'government',
        mobile: false
      },
      {
        parameter: 'no2',
        value: 45.2,
        unit: 'µg/m³',
        date: {
          utc: '2023-01-01T12:00:00Z',
          local: '2023-01-01T04:00:00-08:00'
        },
        coordinates: {
          latitude: 34.0522,
          longitude: -118.2437
        },
        country: 'US',
        city: 'Los Angeles',
        location: 'Downtown LA',
        sourceName: 'EPA AirNow',
        sourceType: 'government',
        mobile: false
      }
    ]
  };

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as any;

    client = new OpenAQClient(mockConfig, mockLogger);
    jest.clearAllMocks();
  });

  describe('fetchLatestMeasurements', () => {
    it('should fetch and transform measurements successfully', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockOpenAQResponse)
      });

      const result = await client.fetchLatestMeasurements();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        source: 'openaq',
        pollutant: 'PM2.5',
        value: 25.5,
        unit: 'µg/m³',
        location: {
          latitude: 34.0522,
          longitude: -118.2437,
          address: 'Downtown LA, Los Angeles, US'
        },
        timestamp: new Date('2023-01-01T12:00:00Z'),
        quality_grade: 'A'
      });
      expect(result[1]).toEqual({
        source: 'openaq',
        pollutant: 'NO2',
        value: 45.2,
        unit: 'µg/m³',
        location: {
          latitude: 34.0522,
          longitude: -118.2437,
          address: 'Downtown LA, Los Angeles, US'
        },
        timestamp: new Date('2023-01-01T12:00:00Z'),
        quality_grade: 'A'
      });
    });

    it('should include location parameters when provided', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockOpenAQResponse)
      });

      const location = { latitude: 34.0522, longitude: -118.2437, radius: 10000 };
      await client.fetchLatestMeasurements(location);

      const fetchCall = (fetch as jest.Mock).mock.calls[0];
      const url = new URL(fetchCall[0]);
      
      expect(url.searchParams.get('coordinates')).toBe('34.0522,-118.2437');
      expect(url.searchParams.get('radius')).toBe('10000');
    });

    it('should use default radius when location provided without radius', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockOpenAQResponse)
      });

      const location = { latitude: 34.0522, longitude: -118.2437, radius: 5000 };
      await client.fetchLatestMeasurements(location);

      const fetchCall = (fetch as jest.Mock).mock.calls[0];
      const url = new URL(fetchCall[0]);
      
      expect(url.searchParams.get('radius')).toBe('5000');
    });

    it('should include API key in headers when provided', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockOpenAQResponse)
      });

      await client.fetchLatestMeasurements();

      const fetchCall = (fetch as jest.Mock).mock.calls[0];
      const headers = fetchCall[1].headers;
      
      expect(headers['X-API-Key']).toBe('test-api-key');
    });

    it('should not include API key header when not provided', async () => {
      const configWithoutKey = { ...mockConfig, apiKey: undefined };
      const clientWithoutKey = new OpenAQClient(configWithoutKey, mockLogger);

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockOpenAQResponse)
      });

      await clientWithoutKey.fetchLatestMeasurements();

      const fetchCall = (fetch as jest.Mock).mock.calls[0];
      const headers = fetchCall[1].headers;
      
      expect(headers['X-API-Key']).toBeUndefined();
    });
  });

  describe('error handling and retries', () => {
    it('should retry on API errors with exponential backoff', async () => {
      (fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockOpenAQResponse)
        });

      const result = await client.fetchLatestMeasurements();

      expect(fetch).toHaveBeenCalledTimes(3);
      expect(result).toHaveLength(2);
      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenCalledTimes(2);
    });

    it('should fail after maximum retries', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Persistent network error'));

      await expect(client.fetchLatestMeasurements()).rejects.toThrow(
        'OpenAQ API request failed after 3 retries'
      );

      expect(fetch).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it('should handle HTTP error responses', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      });

      await expect(client.fetchLatestMeasurements()).rejects.toThrow(
        'OpenAQ API request failed after 3 retries'
      );
    });
  });

  describe('rate limiting', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should enforce rate limiting', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockOpenAQResponse)
      });

      // Make requests up to the rate limit
      const promises = [];
      for (let i = 0; i < mockConfig.rateLimit + 1; i++) {
        promises.push(client.fetchLatestMeasurements());
      }

      // Fast-forward time to trigger rate limiting
      jest.advanceTimersByTime(1000);

      await Promise.all(promises);

      // Should have made rate limit + 1 requests (the extra one should wait)
      expect(fetch).toHaveBeenCalledTimes(mockConfig.rateLimit + 1);
    });
  });

  describe('data transformation', () => {
    it('should assign correct quality grades based on source type', async () => {
      const responseWithDifferentSources: OpenAQResponse = {
        ...mockOpenAQResponse,
        results: [
          { ...mockOpenAQResponse.results[0], sourceType: 'government', mobile: false },
          { ...mockOpenAQResponse.results[0], sourceType: 'research', mobile: false },
          { ...mockOpenAQResponse.results[0], sourceType: 'community', mobile: false },
          { ...mockOpenAQResponse.results[0], sourceType: 'government', mobile: true }
        ]
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseWithDifferentSources)
      });

      const result = await client.fetchLatestMeasurements();

      expect(result[0].quality_grade).toBe('A'); // Government
      expect(result[1].quality_grade).toBe('B'); // Research
      expect(result[2].quality_grade).toBe('C'); // Community
      expect(result[3].quality_grade).toBe('C'); // Mobile
    });

    it('should normalize pollutant names correctly', async () => {
      const responseWithVariousPollutants: OpenAQResponse = {
        ...mockOpenAQResponse,
        results: [
          { ...mockOpenAQResponse.results[0], parameter: 'pm25' },
          { ...mockOpenAQResponse.results[0], parameter: 'pm10' },
          { ...mockOpenAQResponse.results[0], parameter: 'o3' },
          { ...mockOpenAQResponse.results[0], parameter: 'no2' },
          { ...mockOpenAQResponse.results[0], parameter: 'unknown_pollutant' }
        ]
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseWithVariousPollutants)
      });

      const result = await client.fetchLatestMeasurements();

      expect(result[0].pollutant).toBe('PM2.5');
      expect(result[1].pollutant).toBe('PM10');
      expect(result[2].pollutant).toBe('O3');
      expect(result[3].pollutant).toBe('NO2');
      expect(result[4].pollutant).toBe('UNKNOWN_POLLUTANT');
    });
  });

  describe('healthCheck', () => {
    it('should return true when API is accessible', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ meta: {}, results: [] })
      });

      const isHealthy = await client.healthCheck();

      expect(isHealthy).toBe(true);
    });

    it('should return false when API is not accessible', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const isHealthy = await client.healthCheck();

      expect(isHealthy).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('OpenAQ health check failed', expect.any(Object));
    });
  });
});