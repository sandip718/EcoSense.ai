import { Request, Response, NextFunction } from 'express';
import { errorHandler, createError } from '../errorHandler';

describe('Error Handler Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      url: '/test',
      method: 'GET',
      headers: {},
    };
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    
    mockNext = jest.fn();
  });

  it('should handle errors with default status code', () => {
    const error = new Error('Test error');
    
    errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);
    
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        code: 500,
        message: 'Test error',
        timestamp: expect.any(String),
        requestId: 'unknown',
      },
    });
  });

  it('should handle errors with custom status code', () => {
    const error = createError('Custom error', 400);
    
    errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);
    
    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        code: 400,
        message: 'Custom error',
        timestamp: expect.any(String),
        requestId: 'unknown',
      },
    });
  });
});

describe('createError function', () => {
  it('should create error with default status code', () => {
    const error = createError('Test message');
    
    expect(error.message).toBe('Test message');
    expect(error.statusCode).toBe(500);
    expect(error.isOperational).toBe(true);
  });

  it('should create error with custom status code', () => {
    const error = createError('Not found', 404);
    
    expect(error.message).toBe('Not found');
    expect(error.statusCode).toBe(404);
    expect(error.isOperational).toBe(true);
  });
});