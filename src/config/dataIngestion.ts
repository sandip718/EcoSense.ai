import { DataIngestionConfig } from '../services/DataIngestionService';
import { MessageQueueConfig } from '../services/messaging/MessageQueuePublisher';

/**
 * Configuration for Data Ingestion Service
 * Based on requirements 1.1, 1.2, 7.1
 */
export const getDataIngestionConfig = (): DataIngestionConfig => {
  return {
    apis: {
      openaq: {
        endpoint: process.env.OPENAQ_API_ENDPOINT || 'https://api.openaq.org',
        apiKey: process.env.OPENAQ_API_KEY, // Optional
        rateLimit: parseInt(process.env.OPENAQ_RATE_LIMIT || '60') // requests per minute
      },
      waterQuality: {
        endpoint: process.env.WQP_API_ENDPOINT || 'https://www.waterqualitydata.us',
        rateLimit: parseInt(process.env.WQP_RATE_LIMIT || '30') // requests per minute
      }
    },
    scheduledJobs: {
      airQuality: {
        interval: process.env.AIR_QUALITY_INTERVAL || '0 * * * *', // Every hour
        enabled: process.env.AIR_QUALITY_ENABLED !== 'false'
      },
      waterQuality: {
        interval: process.env.WATER_QUALITY_INTERVAL || '0 * * * *', // Every hour
        enabled: process.env.WATER_QUALITY_ENABLED !== 'false'
      }
    },
    messageQueue: {
      exchangeName: process.env.MQ_EXCHANGE_NAME || 'environmental_data',
      routingKey: process.env.MQ_ROUTING_KEY || 'environmental.data'
    }
  };
};

/**
 * Configuration for Message Queue Publisher
 */
export const getMessageQueueConfig = (): MessageQueueConfig => {
  return {
    connectionUrl: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    exchangeName: process.env.MQ_EXCHANGE_NAME || 'environmental_data',
    exchangeType: (process.env.MQ_EXCHANGE_TYPE as 'direct' | 'topic' | 'fanout' | 'headers') || 'topic',
    durable: process.env.MQ_DURABLE !== 'false',
    reconnectDelay: parseInt(process.env.MQ_RECONNECT_DELAY || '5000') // 5 seconds
  };
};

/**
 * Default locations for data ingestion (can be overridden)
 */
export const getDefaultIngestionLocations = (): Array<{
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
}> => {
  return [
    {
      name: 'Los Angeles, CA',
      latitude: 34.0522,
      longitude: -118.2437,
      radius: 50000 // 50km radius
    },
    {
      name: 'New York, NY',
      latitude: 40.7128,
      longitude: -74.0060,
      radius: 50000
    },
    {
      name: 'Chicago, IL',
      latitude: 41.8781,
      longitude: -87.6298,
      radius: 50000
    },
    {
      name: 'Houston, TX',
      latitude: 29.7604,
      longitude: -95.3698,
      radius: 50000
    },
    {
      name: 'Phoenix, AZ',
      latitude: 33.4484,
      longitude: -112.0740,
      radius: 50000
    }
  ];
};

/**
 * Validate configuration
 */
export const validateDataIngestionConfig = (config: DataIngestionConfig): void => {
  if (!config.apis.openaq.endpoint) {
    throw new Error('OpenAQ API endpoint is required');
  }

  if (!config.apis.waterQuality.endpoint) {
    throw new Error('Water Quality Portal API endpoint is required');
  }

  if (config.apis.openaq.rateLimit <= 0) {
    throw new Error('OpenAQ rate limit must be positive');
  }

  if (config.apis.waterQuality.rateLimit <= 0) {
    throw new Error('Water Quality Portal rate limit must be positive');
  }

  if (!config.messageQueue.exchangeName) {
    throw new Error('Message queue exchange name is required');
  }

  if (!config.messageQueue.routingKey) {
    throw new Error('Message queue routing key is required');
  }
};

export const validateMessageQueueConfig = (config: MessageQueueConfig): void => {
  if (!config.connectionUrl) {
    throw new Error('Message queue connection URL is required');
  }

  if (!config.exchangeName) {
    throw new Error('Message queue exchange name is required');
  }

  if (!['direct', 'topic', 'fanout', 'headers'].includes(config.exchangeType)) {
    throw new Error('Invalid message queue exchange type');
  }

  if (config.reconnectDelay <= 0) {
    throw new Error('Reconnect delay must be positive');
  }
};