import { WaterQualityPortalClient, WaterQualityConfig, WaterQualityResponse } from '../WaterQualityPortalClient';
import { Logger } from 'winston';

// Mock fetch globally
global.fetch = jest.fn();

describe('WaterQualityPortalClient', () => {
  let client: WaterQualityPortalClient;
  let mockLogger: jest.Mocked<Logger>;

  const mockConfig: WaterQualityConfig = {
    endpoint: 'https://www.waterqualitydata.us',
    rateLimit: 30
  };

  const mockWQPResponse: WaterQualityResponse = {
    WQXWeb: {
      Result: [
        {
          OrganizationIdentifier: 'USGS-CA',
          OrganizationFormalName: 'USGS California Water Science Center',
          MonitoringLocationIdentifier: 'USGS-11074000',
          MonitoringLocationName: 'SANTA ANA RIVER AT SANTA ANA, CA',
          MonitoringLocationTypeName: 'Stream',
          ActivityIdentifier: 'USGS-11074000-2023-01-01',
          ActivityTypeCode: 'Sample-Routine',
          ActivityMediaName: 'Water',
          ActivityStartDate: '2023-01-01',
          ActivityStartTime: {
            Time: '10:00:00',
            TimeZoneCode: 'PST'
          },
          CharacteristicName: 'pH',
          ResultMeasureValue: '7.2',
          ResultMeasure: {
            MeasureUnitCode: 'pH units'
          },
          MonitoringLocationLatitude: '33.7455',
          MonitoringLocationLongitude: '-117.8678',
          StateCode: 'CA',
          CountyCode: '059',
          HUCEightDigitCode: '18070203'
        },
        {
          OrganizationIdentifier: 'EPA-R9',
          OrganizationFormalName: 'EPA Region 9',
          MonitoringLocationIdentifier: 'EPA-R9-001',
          MonitoringLocationName: 'Los Angeles River',
          MonitoringLocationTypeName: 'Stream',
          ActivityIdentifier: 'EPA-R9-001-2023-01-01',
          ActivityTypeCode: 'Sample-Routine',
          ActivityMediaName: 'Water',
          ActivityStartDate: '2023-01-01',
          CharacteristicName: 'Dissolved oxygen',
          ResultMeasureValue: '8.5',
          ResultMeasure: {
            MeasureUnitCode: 'mg/L'
          },
          MonitoringLocationLatitude: '34.0522',
          MonitoringLocationLongitude: '-118.2437',
          StateCode: 'CA',
          CountyCode: '037',
          HUCEightDigitCode: '18070105'
        }
      ]
    }
  };

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as any;

    client = new WaterQualityPortalClient(mockConfig, mockLogger);
    jest.clearAllMocks();
  });

  describe('fetchLatestMeasurements', () => {
    it('should fetch and transform measurements successfully', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockWQPResponse)
      });

      const result = await client.fetchLatestMeasurements();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        source: 'water_quality_portal',
        pollutant: 'pH',
        value: 7.2,
        unit: 'pH units',
        location: {
          latitude: 33.7455,
          longitude: -117.8678,
          address: 'SANTA ANA RIVER AT SANTA ANA, CA, CA'
        },
        timestamp: new Date('2023-01-01T10:00:00'),
        quality_grade: 'A'
      });
      expect(result[1]).toEqual({
        source: 'water_quality_portal',
        pollutant: 'Dissolved Oxygen',
        value: 8.5,
        unit: 'mg/L',
        location: {
          latitude: 34.0522,
          longitude: -118.2437,
          address: 'Los Angeles River, CA'
        },
        timestamp: new Date('2023-01-01T00:00:00.000Z'),
        quality_grade: 'A'
      });
    });

    it('should include location parameters when provided', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockWQPResponse)
      });

      const location = { latitude: 34.0522, longitude: -118.2437, radius: 10000 };
      await client.fetchLatestMeasurements(location);

      const fetchCall = (fetch as jest.Mock).mock.calls[0];
      const url = new URL(fetchCall[0]);
      
      expect(url.searchParams.get('lat')).toBe('34.0522');
      expect(url.searchParams.get('long')).toBe('-118.2437');
      expect(url.searchParams.get('within')).toBe('10'); // Converted to km
    });

    it('should filter out invalid results', async () => {
      const responseWithInvalidData: WaterQualityResponse = {
        WQXWeb: {
          Result: [
            ...mockWQPResponse.WQXWeb.Result,
            // Invalid result - missing required fields
            {
              OrganizationIdentifier: 'TEST',
              OrganizationFormalName: 'Test Org',
              MonitoringLocationIdentifier: 'TEST-001',
              MonitoringLocationName: 'Test Location',
              MonitoringLocationTypeName: 'Stream',
              ActivityIdentifier: 'TEST-001-2023-01-01',
              ActivityTypeCode: 'Sample-Routine',
              ActivityMediaName: 'Water',
              ActivityStartDate: '2023-01-01',
              CharacteristicName: '', // Empty characteristic name
              ResultMeasureValue: 'invalid', // Invalid numeric value
              MonitoringLocationLatitude: '200', // Invalid latitude
              MonitoringLocationLongitude: '-118.2437',
              StateCode: 'CA',
              CountyCode: '037',
              HUCEightDigitCode: '18070105'
            }
          ]
        }
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseWithInvalidData)
      });

      const result = await client.fetchLatestMeasurements();

      // Should only return the 2 valid results, filtering out the invalid one
      expect(result).toHaveLength(2);
    });
  });

  describe('error handling and retries', () => {
    it('should retry on API errors with exponential backoff', async () => {
      (fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockWQPResponse)
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
        'Water Quality Portal API request failed after 3 retries'
      );

      expect(fetch).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it('should handle HTTP error responses', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(client.fetchLatestMeasurements()).rejects.toThrow(
        'Water Quality Portal API request failed after 3 retries'
      );
    });
  });

  describe('data validation', () => {
    it('should validate required fields', async () => {
      const responseWithMissingFields: WaterQualityResponse = {
        WQXWeb: {
          Result: [
            {
              ...mockWQPResponse.WQXWeb.Result[0],
              CharacteristicName: '', // Missing characteristic name
            },
            {
              ...mockWQPResponse.WQXWeb.Result[0],
              ResultMeasureValue: '', // Missing result value
            },
            {
              ...mockWQPResponse.WQXWeb.Result[0],
              ActivityStartDate: '', // Missing date
            }
          ]
        }
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseWithMissingFields)
      });

      const result = await client.fetchLatestMeasurements();

      expect(result).toHaveLength(0); // All results should be filtered out
    });

    it('should validate numeric values', async () => {
      const responseWithInvalidNumbers: WaterQualityResponse = {
        WQXWeb: {
          Result: [
            {
              ...mockWQPResponse.WQXWeb.Result[0],
              ResultMeasureValue: 'not-a-number',
            },
            {
              ...mockWQPResponse.WQXWeb.Result[0],
              ResultMeasureValue: '-5', // Negative value
            }
          ]
        }
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseWithInvalidNumbers)
      });

      const result = await client.fetchLatestMeasurements();

      expect(result).toHaveLength(0); // All results should be filtered out
    });

    it('should validate coordinates', async () => {
      const responseWithInvalidCoords: WaterQualityResponse = {
        WQXWeb: {
          Result: [
            {
              ...mockWQPResponse.WQXWeb.Result[0],
              MonitoringLocationLatitude: '200', // Invalid latitude
            },
            {
              ...mockWQPResponse.WQXWeb.Result[0],
              MonitoringLocationLongitude: '200', // Invalid longitude
            }
          ]
        }
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseWithInvalidCoords)
      });

      const result = await client.fetchLatestMeasurements();

      expect(result).toHaveLength(0); // All results should be filtered out
    });

    it('should filter out old data', async () => {
      const oldDate = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000); // 35 days ago
      const responseWithOldData: WaterQualityResponse = {
        WQXWeb: {
          Result: [
            {
              ...mockWQPResponse.WQXWeb.Result[0],
              ActivityStartDate: oldDate.toISOString().split('T')[0],
            }
          ]
        }
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseWithOldData)
      });

      const result = await client.fetchLatestMeasurements();

      expect(result).toHaveLength(0); // Old data should be filtered out
    });
  });

  describe('quality grade assignment', () => {
    it('should assign correct quality grades based on organization', async () => {
      const responseWithDifferentOrgs: WaterQualityResponse = {
        WQXWeb: {
          Result: [
            {
              ...mockWQPResponse.WQXWeb.Result[0],
              OrganizationFormalName: 'USGS California Water Science Center',
            },
            {
              ...mockWQPResponse.WQXWeb.Result[0],
              OrganizationFormalName: 'EPA Region 9',
            },
            {
              ...mockWQPResponse.WQXWeb.Result[0],
              OrganizationFormalName: 'California State University',
            },
            {
              ...mockWQPResponse.WQXWeb.Result[0],
              OrganizationFormalName: 'Community Water Watch',
              MonitoringLocationTypeName: 'Volunteer monitoring site',
            }
          ]
        }
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseWithDifferentOrgs)
      });

      const result = await client.fetchLatestMeasurements();

      expect(result[0].quality_grade).toBe('A'); // USGS
      expect(result[1].quality_grade).toBe('A'); // EPA
      expect(result[2].quality_grade).toBe('B'); // University
      expect(result[3].quality_grade).toBe('D'); // Volunteer
    });
  });

  describe('pollutant name normalization', () => {
    it('should normalize common pollutant names', async () => {
      const responseWithVariousPollutants: WaterQualityResponse = {
        WQXWeb: {
          Result: [
            { ...mockWQPResponse.WQXWeb.Result[0], CharacteristicName: 'dissolved oxygen' },
            { ...mockWQPResponse.WQXWeb.Result[0], CharacteristicName: 'pH' },
            { ...mockWQPResponse.WQXWeb.Result[0], CharacteristicName: 'temperature' },
            { ...mockWQPResponse.WQXWeb.Result[0], CharacteristicName: 'turbidity' },
            { ...mockWQPResponse.WQXWeb.Result[0], CharacteristicName: 'Unknown Parameter' }
          ]
        }
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseWithVariousPollutants)
      });

      const result = await client.fetchLatestMeasurements();

      expect(result[0].pollutant).toBe('Dissolved Oxygen');
      expect(result[1].pollutant).toBe('pH');
      expect(result[2].pollutant).toBe('Temperature');
      expect(result[3].pollutant).toBe('Turbidity');
      expect(result[4].pollutant).toBe('Unknown Parameter'); // Unchanged
    });
  });

  describe('healthCheck', () => {
    it('should return true when API is accessible', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ WQXWeb: { Organization: [] } })
      });

      const isHealthy = await client.healthCheck();

      expect(isHealthy).toBe(true);
    });

    it('should return false when API is not accessible', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const isHealthy = await client.healthCheck();

      expect(isHealthy).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('Water Quality Portal health check failed', expect.any(Object));
    });
  });
});