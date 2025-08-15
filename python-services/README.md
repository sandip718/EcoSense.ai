# Environmental AI Analysis Service

This Python service provides AI-powered analysis of environmental images for pollution indicators including water turbidity detection, air quality assessment, and visual contamination detection.

## Features

### Core Analysis Capabilities
- **Water Quality Analysis**: Turbidity detection, color analysis, and clarity assessment
- **Air Quality Assessment**: Visibility analysis, smog detection, and haze intensity measurement
- **Visual Contamination Detection**: Plastic waste, oil contamination, foam pollution, and debris detection
- **Confidence Scoring**: Advanced confidence scoring system with uncertainty quantification
- **Recommendation Engine**: Generates actionable recommendations based on analysis results

### API Endpoints
- `GET /health` - Health check endpoint
- `POST /analyze` - Main image analysis endpoint
- `GET /models/info` - Model version and capability information

## Project Structure

```
python-services/
├── app.py                          # Main Flask application
├── requirements.txt                # Python dependencies
├── README.md                      # This file
├── services/                      # Core analysis services
│   ├── __init__.py
│   ├── image_analyzer.py          # Environmental image analysis algorithms
│   └── confidence_scorer.py       # Confidence scoring system
├── utils/                         # Utility modules
│   ├── __init__.py
│   ├── image_processor.py         # Image download and preprocessing
│   └── validators.py              # Request validation functions
└── tests/                         # Test files
    ├── simple_test.py             # Basic functionality tests
    ├── test_flask_structure.py    # Integration tests
    └── test_ai_analysis.py        # Comprehensive analysis tests
```

## Installation

### Prerequisites
- Python 3.8 or higher
- pip package manager

### Dependencies Installation

```bash
# Install core dependencies
pip install -r requirements.txt

# For full image processing capabilities (optional)
pip install numpy opencv-python scikit-image scipy tensorflow
```

### Environment Variables

Create a `.env` file in the python-services directory:

```env
PORT=5000
DEBUG=false
FLASK_ENV=production
```

## Usage

### Starting the Service

```bash
# Development mode
python app.py

# Production mode
export FLASK_ENV=production
python app.py
```

The service will start on `http://localhost:5000` by default.

### API Usage Examples

#### Health Check
```bash
curl http://localhost:5000/health
```

Response:
```json
{
  "status": "healthy",
  "service": "environmental-ai-analysis",
  "version": "1.0.0"
}
```

#### Image Analysis
```bash
curl -X POST http://localhost:5000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "image_url": "https://example.com/environmental-image.jpg",
    "location": {
      "latitude": 40.7128,
      "longitude": -74.0060
    },
    "analysis_types": ["water_quality", "air_quality", "visual_contamination"]
  }'
```

Response:
```json
{
  "status": "success",
  "pollution_indicators": {
    "water_quality": {
      "turbidity": {"value": 0.4, "level": "slightly_turbid", "confidence": 0.7},
      "color_index": {"value": 0.3, "dominant_color": "blue", "confidence": 0.7},
      "clarity": {"value": 0.6, "confidence": 0.7},
      "overall_score": 0.65,
      "confidence": 0.7
    },
    "air_quality": {
      "smog_density": {"value": 0.3, "type": "gray_smog", "confidence": 0.7},
      "visibility": {"value": 0.7, "level": "good", "confidence": 0.7},
      "haze_intensity": {"value": 0.2, "confidence": 0.7},
      "overall_score": 0.7,
      "confidence": 0.7
    },
    "visual_contamination": {
      "detected": false,
      "type": "none",
      "indicators": {
        "plastic": {"presence": 0.1, "confidence": 0.7},
        "oil": {"presence": 0.05, "confidence": 0.7},
        "foam": {"presence": 0.08, "confidence": 0.7},
        "debris": {"presence": 0.12, "confidence": 0.7}
      },
      "texture_anomalies": {"anomaly_score": 0.2, "confidence": 0.7},
      "overall_score": 0.8,
      "confidence": 0.7
    }
  },
  "overall_score": 0.72,
  "overall_confidence": 0.7,
  "recommendations": [
    "Environmental conditions appear normal based on visual analysis",
    "Consider checking local environmental monitoring stations for additional data"
  ],
  "processing_metadata": {
    "model_version": "1.0.0",
    "analysis_types": ["water_quality", "air_quality", "visual_contamination"],
    "image_dimensions": [400, 600]
  }
}
```

#### Model Information
```bash
curl http://localhost:5000/models/info
```

## Algorithm Details

### Water Quality Analysis
- **Turbidity Detection**: Analyzes edge density and local variance to assess water clarity
- **Color Analysis**: Compares water color against expected clean water characteristics
- **Clarity Assessment**: Combines multiple visual indicators for overall water quality

### Air Quality Assessment
- **Visibility Analysis**: Measures image contrast and edge definition
- **Smog Detection**: Identifies characteristic smog colors (brown/gray hues)
- **Haze Analysis**: Detects atmospheric haze through histogram analysis

### Visual Contamination Detection
- **Plastic Waste**: Detects bright, saturated colors typical of plastic debris
- **Oil Contamination**: Identifies dark patches and rainbow sheens
- **Foam Pollution**: Detects white, textured regions indicating foam
- **Debris Detection**: Uses edge detection to identify foreign objects

### Confidence Scoring
- **Weighted Averaging**: Combines confidence scores from different analysis types
- **Uncertainty Quantification**: Applies penalties for inconsistent results
- **Quality Indicators**: Assesses data completeness and detection clarity

## Testing

### Run Basic Tests
```bash
python simple_test.py
```

### Run Integration Tests
```bash
python test_flask_structure.py
```

### Run Comprehensive Tests (requires full dependencies)
```bash
python test_ai_analysis.py
```

## Development

### Adding New Analysis Types
1. Add analysis method to `EnvironmentalImageAnalyzer` class
2. Update confidence scoring weights in `ConfidenceScorer`
3. Add validation for new analysis type in `validators.py`
4. Update API documentation

### Extending Algorithms
The current implementation provides a foundation for environmental analysis. To enhance accuracy:

1. **Integrate ML Models**: Replace algorithmic approaches with trained models
2. **Add Training Data**: Collect and label environmental images for model training
3. **Implement Advanced CV**: Use deep learning for more sophisticated analysis
4. **Add Sensor Integration**: Combine visual analysis with sensor data

## Deployment

### Docker Deployment
```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 5000

CMD ["python", "app.py"]
```

### Production Considerations
- Use a production WSGI server (gunicorn, uWSGI)
- Implement proper logging and monitoring
- Add rate limiting and authentication
- Set up health checks and auto-scaling
- Configure SSL/TLS for secure communication

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

This project is part of the EcoSense.ai environmental monitoring platform.

## Support

For issues and questions, please refer to the main EcoSense.ai documentation or create an issue in the project repository.