// Tests for Natural Language Processor
import { naturalLanguageProcessor } from '../NaturalLanguageProcessor';
import { ConversationContext } from '../../models/ChatbotTypes';

describe('NaturalLanguageProcessor', () => {
  describe('processMessage', () => {
    it('should classify greeting messages correctly', async () => {
      const result = await naturalLanguageProcessor.processMessage('Hello there!');
      
      expect(result.intent).toBe('greeting');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.requires_location).toBe(false);
    });

    it('should classify current conditions queries', async () => {
      const result = await naturalLanguageProcessor.processMessage('What is the current air quality?');
      
      expect(result.intent).toBe('current_conditions');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.requires_location).toBe(true);
      expect(result.query_type).toBe('current_conditions');
    });

    it('should classify safety check queries', async () => {
      const result = await naturalLanguageProcessor.processMessage('Is it safe to run outside?');
      
      expect(result.intent).toBe('safety_check');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.requires_location).toBe(true);
      expect(result.query_type).toBe('safety');
    });

    it('should extract pollutant entities', async () => {
      const result = await naturalLanguageProcessor.processMessage('What is the PM2.5 level?');
      
      const pollutantEntities = result.entities.filter(e => e.type === 'pollutant');
      expect(pollutantEntities.length).toBeGreaterThan(0);
      expect(pollutantEntities[0].value).toBe('pm2.5');
    });

    it('should extract activity entities', async () => {
      const result = await naturalLanguageProcessor.processMessage('Is it safe for jogging?');
      
      const activityEntities = result.entities.filter(e => e.type === 'activity');
      expect(activityEntities.length).toBeGreaterThan(0);
      expect(activityEntities[0].value).toBe('jogging');
    });

    it('should extract time entities', async () => {
      const result = await naturalLanguageProcessor.processMessage('How was the air quality today?');
      
      const timeEntities = result.entities.filter(e => e.type === 'time');
      expect(timeEntities.length).toBeGreaterThan(0);
      expect(timeEntities[0].value).toBe('today');
    });

    it('should handle help requests', async () => {
      const result = await naturalLanguageProcessor.processMessage('What can you help me with?');
      
      expect(result.intent).toBe('help');
      expect(result.requires_location).toBe(false);
    });

    it('should handle trend queries', async () => {
      const result = await naturalLanguageProcessor.processMessage('Show me pollution trends');
      
      expect(result.intent).toBe('trends');
      expect(result.query_type).toBe('trends');
      expect(result.requires_location).toBe(true);
    });

    it('should handle recommendation requests', async () => {
      const result = await naturalLanguageProcessor.processMessage('What should I do to improve air quality?');
      
      expect(result.intent).toBe('recommendations');
      expect(result.query_type).toBe('recommendations');
      expect(result.requires_location).toBe(true);
    });

    it('should handle unknown messages with fallback', async () => {
      const result = await naturalLanguageProcessor.processMessage('xyz random text');
      
      expect(result.intent).toBe('unknown');
      expect(result.confidence).toBeLessThan(0.5);
    });
  });

  describe('buildEnvironmentalQuery', () => {
    const mockLocation = { latitude: 40.7128, longitude: -74.0060 };

    it('should build query for current conditions', () => {
      const nlpResult = {
        intent: 'current_conditions',
        confidence: 0.9,
        entities: [
          { type: 'pollutant', value: 'pm2.5', confidence: 0.9, resolved_value: 'air_quality' }
        ],
        requires_location: true,
        query_type: 'current_conditions' as const
      };

      const query = naturalLanguageProcessor.buildEnvironmentalQuery(nlpResult, mockLocation);
      
      expect(query.location).toEqual(mockLocation);
      expect(query.query_type).toBe('current_conditions');
      expect(query.pollutants).toContain('air_quality');
    });

    it('should build query for safety assessment', () => {
      const nlpResult = {
        intent: 'safety_check',
        confidence: 0.9,
        entities: [
          { type: 'activity', value: 'running', confidence: 0.8 }
        ],
        requires_location: true,
        query_type: 'safety' as const
      };

      const query = naturalLanguageProcessor.buildEnvironmentalQuery(nlpResult, mockLocation);
      
      expect(query.location).toEqual(mockLocation);
      expect(query.query_type).toBe('safety');
      expect(query.activity_context).toBe('running');
    });

    it('should build query with time range', () => {
      const nlpResult = {
        intent: 'trends',
        confidence: 0.9,
        entities: [
          { 
            type: 'time', 
            value: 'today', 
            confidence: 0.9,
            resolved_value: {
              start: new Date('2024-01-01T00:00:00Z'),
              end: new Date('2024-01-01T23:59:59Z')
            }
          }
        ],
        requires_location: true,
        query_type: 'trends' as const
      };

      const query = naturalLanguageProcessor.buildEnvironmentalQuery(nlpResult, mockLocation);
      
      expect(query.location).toEqual(mockLocation);
      expect(query.query_type).toBe('trends');
      expect(query.time_range).toBeDefined();
      expect(query.time_range?.start).toBeInstanceOf(Date);
      expect(query.time_range?.end).toBeInstanceOf(Date);
    });
  });
});