import * as amqp from 'amqplib';
import { CreateEnvironmentalDataPoint } from '../../models/types';
import { Logger } from 'winston';

export interface MessageQueueConfig {
  connectionUrl: string;
  exchangeName: string;
  exchangeType: 'direct' | 'topic' | 'fanout' | 'headers';
  durable: boolean;
  reconnectDelay: number;
}

export interface EnvironmentalDataMessage {
  type: 'environmental_data';
  data: CreateEnvironmentalDataPoint;
  metadata: {
    publishedAt: Date;
    messageId: string;
    source: string;
  };
}

/**
 * Message queue publisher for processed environmental data
 * Implements requirement 7.1: Message queue publisher for processed environmental data
 */
export class MessageQueuePublisher {
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;
  private config: MessageQueueConfig;
  private logger: Logger;
  private isConnecting: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(config: MessageQueueConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Initialize connection to message queue
   */
  async initialize(): Promise<void> {
    if (this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    try {
      this.logger.info('Connecting to message queue', { 
        url: this.config.connectionUrl.replace(/\/\/.*@/, '//***@') // Hide credentials in logs
      });

      this.connection = await amqp.connect(this.config.connectionUrl);
      this.channel = await this.connection.createChannel();

      // Set up exchange
      await this.channel.assertExchange(
        this.config.exchangeName,
        this.config.exchangeType,
        { durable: this.config.durable }
      );

      // Set up connection event handlers
      this.connection.on('error', (error) => {
        this.logger.error('Message queue connection error', { error });
        this.handleConnectionError();
      });

      this.connection.on('close', () => {
        this.logger.warn('Message queue connection closed');
        this.handleConnectionError();
      });

      this.logger.info('Message queue connection established');

    } catch (error) {
      this.logger.error('Failed to connect to message queue', { error });
      this.handleConnectionError();
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Publish environmental data to message queue
   * Requirement 7.1: Create message queue publisher for processed environmental data
   */
  async publishEnvironmentalData(
    data: CreateEnvironmentalDataPoint,
    exchangeName?: string,
    routingKey?: string
  ): Promise<void> {
    await this.ensureConnection();

    if (!this.channel) {
      throw new Error('Message queue channel not available');
    }

    const message: EnvironmentalDataMessage = {
      type: 'environmental_data',
      data,
      metadata: {
        publishedAt: new Date(),
        messageId: this.generateMessageId(),
        source: data.source
      }
    };

    const exchange = exchangeName || this.config.exchangeName;
    const routing = routingKey || `environmental.${data.source}.${data.pollutant.toLowerCase()}`;

    try {
      const messageBuffer = Buffer.from(JSON.stringify(message));
      
      const published = this.channel.publish(
        exchange,
        routing,
        messageBuffer,
        {
          persistent: true,
          timestamp: Date.now(),
          messageId: message.metadata.messageId,
          contentType: 'application/json',
          headers: {
            source: data.source,
            pollutant: data.pollutant,
            location: `${data.location.latitude},${data.location.longitude}`
          }
        }
      );

      if (!published) {
        throw new Error('Message queue buffer full, message not published');
      }

      this.logger.debug('Environmental data published to message queue', {
        messageId: message.metadata.messageId,
        exchange,
        routingKey: routing,
        source: data.source,
        pollutant: data.pollutant
      });

    } catch (error) {
      this.logger.error('Failed to publish environmental data', {
        error,
        data: {
          source: data.source,
          pollutant: data.pollutant,
          location: data.location
        }
      });
      throw error;
    }
  }

  /**
   * Publish batch of environmental data points
   */
  async publishBatch(
    dataPoints: CreateEnvironmentalDataPoint[],
    exchangeName?: string,
    routingKeyPrefix?: string
  ): Promise<void> {
    await this.ensureConnection();

    if (!this.channel) {
      throw new Error('Message queue channel not available');
    }

    const exchange = exchangeName || this.config.exchangeName;
    const batchId = this.generateMessageId();

    this.logger.info('Publishing environmental data batch', {
      batchId,
      count: dataPoints.length,
      exchange
    });

    const publishPromises = dataPoints.map(async (dataPoint, index) => {
      const routingKey = routingKeyPrefix 
        ? `${routingKeyPrefix}.${dataPoint.source}.${dataPoint.pollutant.toLowerCase()}`
        : `environmental.${dataPoint.source}.${dataPoint.pollutant.toLowerCase()}`;

      try {
        await this.publishEnvironmentalData(dataPoint, exchange, routingKey);
      } catch (error) {
        this.logger.error('Failed to publish data point in batch', {
          batchId,
          index,
          error,
          dataPoint: {
            source: dataPoint.source,
            pollutant: dataPoint.pollutant
          }
        });
        throw error;
      }
    });

    await Promise.all(publishPromises);

    this.logger.info('Environmental data batch published successfully', {
      batchId,
      count: dataPoints.length
    });
  }

  /**
   * Health check for message queue connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.connection || !this.channel) {
        return false;
      }

      // Try to check exchange
      await this.channel.checkExchange(this.config.exchangeName);
      return true;

    } catch (error) {
      this.logger.debug('Message queue health check failed', { error });
      return false;
    }
  }

  /**
   * Close connection gracefully
   */
  async close(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }

      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }

      this.logger.info('Message queue connection closed');

    } catch (error) {
      this.logger.error('Error closing message queue connection', { error });
    }
  }

  /**
   * Ensure connection is established
   */
  private async ensureConnection(): Promise<void> {
    if (!this.connection || !this.channel) {
      await this.initialize();
    }
  }

  /**
   * Handle connection errors and implement reconnection logic
   */
  private handleConnectionError(): void {
    this.connection = null;
    this.channel = null;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(async () => {
      try {
        this.logger.info('Attempting to reconnect to message queue');
        await this.initialize();
      } catch (error) {
        this.logger.error('Reconnection attempt failed', { error });
        this.handleConnectionError(); // Try again
      }
    }, this.config.reconnectDelay);
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `${timestamp}-${random}`;
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): {
    connected: boolean;
    connecting: boolean;
    lastError?: string;
  } {
    return {
      connected: !!(this.connection && this.channel),
      connecting: this.isConnecting,
    };
  }
}