import { MessageQueuePublisher, MessageQueueConfig } from '../MessageQueuePublisher';
import { CreateEnvironmentalDataPoint } from '../../../models/types';
import { Logger } from 'winston';
import * as amqp from 'amqplib';

// Mock amqplib
jest.mock('amqplib');

describe('MessageQueuePublisher', () => {
  let publisher: MessageQueuePublisher;
  let mockLogger: jest.Mocked<Logger>;
  let mockConnection: jest.Mocked<amqp.Connection>;
  let mockChannel: jest.Mocked<amqp.Channel>;

  const mockConfig: MessageQueueConfig = {
    connectionUrl: 'amqp://localhost:5672',
    exchangeName: 'environmental_data',
    exchangeType: 'topic',
    durable: true,
    reconnectDelay: 1000
  };

  const mockEnvironmentalData: CreateEnvironmentalDataPoint = {
    source: 'openaq',
    pollutant: 'PM2.5',
    value: 25.5,
    unit: 'µg/m³',
    location: {
      latitude: 34.0522,
      longitude: -118.2437,
      address: 'Los Angeles, CA'
    },
    timestamp: new Date('2023-01-01T12:00:00Z'),
    quality_grade: 'A'
  };

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as any;

    mockChannel = {
      assertExchange: jest.fn().mockResolvedValue({}),
      publish: jest.fn().mockReturnValue(true),
      checkExchange: jest.fn().mockResolvedValue({}),
      close: jest.fn().mockResolvedValue({})
    } as any;

    mockConnection = {
      createChannel: jest.fn().mockResolvedValue(mockChannel),
      on: jest.fn(),
      close: jest.fn().mockResolvedValue({})
    } as any;

    (amqp.connect as jest.Mock).mockResolvedValue(mockConnection);

    publisher = new MessageQueuePublisher(mockConfig, mockLogger);
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should establish connection and create channel', async () => {
      await publisher.initialize();

      expect(amqp.connect).toHaveBeenCalledWith(mockConfig.connectionUrl);
      expect(mockConnection.createChannel).toHaveBeenCalled();
      expect(mockChannel.assertExchange).toHaveBeenCalledWith(
        mockConfig.exchangeName,
        mockConfig.exchangeType,
        { durable: mockConfig.durable }
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Message queue connection established');
    });

    it('should set up connection error handlers', async () => {
      await publisher.initialize();

      expect(mockConnection.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockConnection.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should handle connection errors during initialization', async () => {
      const error = new Error('Connection failed');
      (amqp.connect as jest.Mock).mockRejectedValue(error);

      await expect(publisher.initialize()).rejects.toThrow('Connection failed');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to connect to message queue', { error });
    });

    it('should prevent multiple concurrent initialization attempts', async () => {
      const promise1 = publisher.initialize();
      const promise2 = publisher.initialize();

      await Promise.all([promise1, promise2]);

      expect(amqp.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('publishEnvironmentalData', () => {
    beforeEach(async () => {
      await publisher.initialize();
      jest.clearAllMocks();
    });

    it('should publish environmental data successfully', async () => {
      await publisher.publishEnvironmentalData(mockEnvironmentalData);

      expect(mockChannel.publish).toHaveBeenCalledWith(
        mockConfig.exchangeName,
        'environmental.openaq.pm2.5',
        expect.any(Buffer),
        expect.objectContaining({
          persistent: true,
          timestamp: expect.any(Number),
          messageId: expect.any(String),
          contentType: 'application/json',
          headers: {
            source: 'openaq',
            pollutant: 'PM2.5',
            location: '34.0522,-118.2437'
          }
        })
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Environmental data published to message queue',
        expect.objectContaining({
          messageId: expect.any(String),
          exchange: mockConfig.exchangeName,
          routingKey: 'environmental.openaq.pm2.5',
          source: 'openaq',
          pollutant: 'PM2.5'
        })
      );
    });

    it('should use custom exchange and routing key when provided', async () => {
      const customExchange = 'custom_exchange';
      const customRoutingKey = 'custom.routing.key';

      await publisher.publishEnvironmentalData(
        mockEnvironmentalData,
        customExchange,
        customRoutingKey
      );

      expect(mockChannel.publish).toHaveBeenCalledWith(
        customExchange,
        customRoutingKey,
        expect.any(Buffer),
        expect.any(Object)
      );
    });

    it('should handle publish failures', async () => {
      mockChannel.publish.mockReturnValue(false);

      await expect(
        publisher.publishEnvironmentalData(mockEnvironmentalData)
      ).rejects.toThrow('Message queue buffer full, message not published');
    });

    it('should handle channel errors', async () => {
      const error = new Error('Channel error');
      mockChannel.publish.mockImplementation(() => {
        throw error;
      });

      await expect(
        publisher.publishEnvironmentalData(mockEnvironmentalData)
      ).rejects.toThrow('Channel error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to publish environmental data',
        expect.objectContaining({ error })
      );
    });

    it('should initialize connection if not already connected', async () => {
      const newPublisher = new MessageQueuePublisher(mockConfig, mockLogger);

      await newPublisher.publishEnvironmentalData(mockEnvironmentalData);

      expect(amqp.connect).toHaveBeenCalled();
      expect(mockChannel.publish).toHaveBeenCalled();
    });
  });

  describe('publishBatch', () => {
    beforeEach(async () => {
      await publisher.initialize();
      jest.clearAllMocks();
    });

    it('should publish batch of environmental data', async () => {
      const dataPoints = [
        mockEnvironmentalData,
        { ...mockEnvironmentalData, pollutant: 'NO2', value: 45.2 }
      ];

      await publisher.publishBatch(dataPoints);

      expect(mockChannel.publish).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Publishing environmental data batch',
        expect.objectContaining({
          count: 2,
          exchange: mockConfig.exchangeName
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Environmental data batch published successfully',
        expect.objectContaining({ count: 2 })
      );
    });

    it('should handle individual publish failures in batch', async () => {
      const dataPoints = [mockEnvironmentalData];
      mockChannel.publish.mockReturnValue(false);

      await expect(publisher.publishBatch(dataPoints)).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to publish data point in batch',
        expect.any(Object)
      );
    });

    it('should use custom routing key prefix', async () => {
      const dataPoints = [mockEnvironmentalData];
      const routingKeyPrefix = 'custom.prefix';

      await publisher.publishBatch(dataPoints, undefined, routingKeyPrefix);

      expect(mockChannel.publish).toHaveBeenCalledWith(
        mockConfig.exchangeName,
        'custom.prefix.openaq.pm2.5',
        expect.any(Buffer),
        expect.any(Object)
      );
    });
  });

  describe('healthCheck', () => {
    it('should return true when connection and channel are healthy', async () => {
      await publisher.initialize();

      const isHealthy = await publisher.healthCheck();

      expect(isHealthy).toBe(true);
      expect(mockChannel.checkExchange).toHaveBeenCalledWith(mockConfig.exchangeName);
    });

    it('should return false when connection is not established', async () => {
      const isHealthy = await publisher.healthCheck();

      expect(isHealthy).toBe(false);
    });

    it('should return false when exchange check fails', async () => {
      await publisher.initialize();
      mockChannel.checkExchange.mockRejectedValue(new Error('Exchange not found'));

      const isHealthy = await publisher.healthCheck();

      expect(isHealthy).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Message queue health check failed',
        expect.any(Object)
      );
    });
  });

  describe('close', () => {
    it('should close channel and connection gracefully', async () => {
      await publisher.initialize();

      await publisher.close();

      expect(mockChannel.close).toHaveBeenCalled();
      expect(mockConnection.close).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Message queue connection closed');
    });

    it('should handle close errors gracefully', async () => {
      await publisher.initialize();
      const error = new Error('Close error');
      mockChannel.close.mockRejectedValue(error);

      await publisher.close();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error closing message queue connection',
        { error }
      );
    });

    it('should clear reconnect timer if active', async () => {
      jest.useFakeTimers();
      
      await publisher.initialize();
      
      // Trigger connection error to start reconnect timer
      const errorHandler = mockConnection.on.mock.calls.find(
        call => call[0] === 'error'
      )?.[1];
      if (errorHandler) {
        errorHandler(new Error('Connection lost'));
      }

      await publisher.close();

      jest.useRealTimers();
    });
  });

  describe('connection error handling', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should handle connection errors and attempt reconnection', async () => {
      await publisher.initialize();

      // Trigger connection error
      const errorHandler = mockConnection.on.mock.calls.find(
        call => call[0] === 'error'
      )?.[1];

      if (errorHandler) {
        errorHandler(new Error('Connection lost'));
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Message queue connection error',
        expect.any(Object)
      );

      // Fast-forward time to trigger reconnection attempt
      jest.advanceTimersByTime(mockConfig.reconnectDelay);

      expect(mockLogger.info).toHaveBeenCalledWith('Attempting to reconnect to message queue');
    });

    it('should handle connection close and attempt reconnection', async () => {
      await publisher.initialize();

      // Trigger connection close
      const closeHandler = mockConnection.on.mock.calls.find(
        call => call[0] === 'close'
      )?.[1];

      if (closeHandler) {
        closeHandler();
      }

      expect(mockLogger.warn).toHaveBeenCalledWith('Message queue connection closed');

      // Fast-forward time to trigger reconnection attempt
      jest.advanceTimersByTime(mockConfig.reconnectDelay);

      expect(mockLogger.info).toHaveBeenCalledWith('Attempting to reconnect to message queue');
    });
  });

  describe('getConnectionStatus', () => {
    it('should return correct connection status', async () => {
      let status = publisher.getConnectionStatus();
      expect(status.connected).toBe(false);
      expect(status.connecting).toBe(false);

      await publisher.initialize();

      status = publisher.getConnectionStatus();
      expect(status.connected).toBe(true);
      expect(status.connecting).toBe(false);
    });
  });
});