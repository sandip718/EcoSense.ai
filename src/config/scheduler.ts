import { SchedulerConfig } from '../services/ScheduledDataIngestionService';

/**
 * Configuration for Scheduled Data Ingestion Service
 * Implements requirements 1.1, 1.2, 1.3, 7.1
 */
export const getSchedulerConfig = (): SchedulerConfig => {
  return {
    airQuality: {
      enabled: process.env.AIR_QUALITY_SCHEDULER_ENABLED !== 'false',
      cronExpression: process.env.AIR_QUALITY_CRON || '0 * * * *' // Every hour at minute 0
    },
    waterQuality: {
      enabled: process.env.WATER_QUALITY_SCHEDULER_ENABLED !== 'false',
      cronExpression: process.env.WATER_QUALITY_CRON || '0 * * * *' // Every hour at minute 0
    },
    retryConfig: {
      maxRetries: parseInt(process.env.INGESTION_MAX_RETRIES || '3'),
      baseDelayMs: parseInt(process.env.INGESTION_BASE_DELAY_MS || '1000'), // 1 second
      maxDelayMs: parseInt(process.env.INGESTION_MAX_DELAY_MS || '30000'), // 30 seconds
      backoffMultiplier: parseFloat(process.env.INGESTION_BACKOFF_MULTIPLIER || '2.0')
    }
  };
};

/**
 * Validate scheduler configuration
 */
export const validateSchedulerConfig = (config: SchedulerConfig): void => {
  // Validate cron expressions (basic validation)
  if (config.airQuality.enabled && !isValidCronExpression(config.airQuality.cronExpression)) {
    throw new Error(`Invalid air quality cron expression: ${config.airQuality.cronExpression}`);
  }

  if (config.waterQuality.enabled && !isValidCronExpression(config.waterQuality.cronExpression)) {
    throw new Error(`Invalid water quality cron expression: ${config.waterQuality.cronExpression}`);
  }

  // Validate retry configuration
  if (config.retryConfig.maxRetries < 0 || config.retryConfig.maxRetries > 10) {
    throw new Error('Max retries must be between 0 and 10');
  }

  if (config.retryConfig.baseDelayMs <= 0) {
    throw new Error('Base delay must be positive');
  }

  if (config.retryConfig.maxDelayMs <= 0) {
    throw new Error('Max delay must be positive');
  }

  if (config.retryConfig.maxDelayMs < config.retryConfig.baseDelayMs) {
    throw new Error('Max delay must be greater than or equal to base delay');
  }

  if (config.retryConfig.backoffMultiplier <= 1) {
    throw new Error('Backoff multiplier must be greater than 1');
  }
};

/**
 * Basic cron expression validation
 * Validates the format: minute hour day month day-of-week
 */
function isValidCronExpression(expression: string): boolean {
  const parts = expression.trim().split(/\s+/);
  
  // Must have exactly 5 parts
  if (parts.length !== 5) {
    return false;
  }

  const [minute, hour, day, month, dayOfWeek] = parts;

  // Basic validation for each part
  return (
    isValidCronField(minute, 0, 59) &&
    isValidCronField(hour, 0, 23) &&
    isValidCronField(day, 1, 31) &&
    isValidCronField(month, 1, 12) &&
    isValidCronField(dayOfWeek, 0, 7) // 0 and 7 both represent Sunday
  );
}

/**
 * Validate individual cron field
 */
function isValidCronField(field: string, min: number, max: number): boolean {
  // Allow wildcard
  if (field === '*') {
    return true;
  }

  // Allow ranges (e.g., 1-5)
  if (field.includes('-')) {
    const [start, end] = field.split('-');
    const startNum = parseInt(start);
    const endNum = parseInt(end);
    return (
      !isNaN(startNum) &&
      !isNaN(endNum) &&
      startNum >= min &&
      endNum <= max &&
      startNum <= endNum
    );
  }

  // Allow lists (e.g., 1,3,5)
  if (field.includes(',')) {
    const values = field.split(',');
    return values.every(value => {
      const num = parseInt(value);
      return !isNaN(num) && num >= min && num <= max;
    });
  }

  // Allow step values (e.g., */5)
  if (field.includes('/')) {
    const [base, step] = field.split('/');
    const stepNum = parseInt(step);
    
    if (isNaN(stepNum) || stepNum <= 0) {
      return false;
    }

    if (base === '*') {
      return true;
    }

    return isValidCronField(base, min, max);
  }

  // Single number
  const num = parseInt(field);
  return !isNaN(num) && num >= min && num <= max;
}

/**
 * Get human-readable description of cron expression
 */
export const describeCronExpression = (expression: string): string => {
  const parts = expression.trim().split(/\s+/);
  
  if (parts.length !== 5) {
    return 'Invalid cron expression';
  }

  const [minute, hour, day, month, dayOfWeek] = parts;

  // Handle common patterns
  if (expression === '0 * * * *') {
    return 'Every hour';
  }

  if (expression === '0 0 * * *') {
    return 'Daily at midnight';
  }

  if (expression === '0 0 * * 0') {
    return 'Weekly on Sunday at midnight';
  }

  if (expression === '0 0 1 * *') {
    return 'Monthly on the 1st at midnight';
  }

  // Build description from parts
  let description = 'At ';

  if (minute === '0') {
    description += 'the top of ';
  } else if (minute === '*') {
    description += 'every minute of ';
  } else {
    description += `minute ${minute} of `;
  }

  if (hour === '*') {
    description += 'every hour';
  } else {
    description += `hour ${hour}`;
  }

  if (day !== '*') {
    description += ` on day ${day}`;
  }

  if (month !== '*') {
    description += ` of month ${month}`;
  }

  if (dayOfWeek !== '*') {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayNum = parseInt(dayOfWeek);
    if (!isNaN(dayNum) && dayNum >= 0 && dayNum <= 7) {
      const dayName = dayNames[dayNum === 7 ? 0 : dayNum];
      description += ` on ${dayName}`;
    }
  }

  return description;
};

/**
 * Common cron expressions for reference
 */
export const COMMON_CRON_EXPRESSIONS = {
  EVERY_MINUTE: '* * * * *',
  EVERY_5_MINUTES: '*/5 * * * *',
  EVERY_15_MINUTES: '*/15 * * * *',
  EVERY_30_MINUTES: '*/30 * * * *',
  EVERY_HOUR: '0 * * * *',
  EVERY_2_HOURS: '0 */2 * * *',
  EVERY_6_HOURS: '0 */6 * * *',
  EVERY_12_HOURS: '0 */12 * * *',
  DAILY_MIDNIGHT: '0 0 * * *',
  DAILY_NOON: '0 12 * * *',
  WEEKLY_SUNDAY: '0 0 * * 0',
  MONTHLY_FIRST: '0 0 1 * *'
} as const;