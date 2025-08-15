"""
Environmental AI Analysis Service

This Flask application provides AI-powered analysis of environmental images
for pollution indicators including water turbidity, air quality, and visual contamination.
"""

import os
from flask import Flask, request, jsonify
from loguru import logger
from dotenv import load_dotenv

from services.image_analyzer import EnvironmentalImageAnalyzer
from services.confidence_scorer import ConfidenceScorer
from utils.image_processor import ImageProcessor
from utils.validators import validate_image_request

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Initialize services
image_analyzer = EnvironmentalImageAnalyzer()
confidence_scorer = ConfidenceScorer()
image_processor = ImageProcessor()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'environmental-ai-analysis',
        'version': '1.0.0'
    })

@app.route('/analyze', methods=['POST'])
def analyze_image():
    """
    Analyze environmental image for pollution indicators
    
    Expected JSON payload:
    {
        "image_url": "https://example.com/image.jpg",
        "location": {
            "latitude": 40.7128,
            "longitude": -74.0060
        },
        "analysis_types": ["water_quality", "air_quality", "visual_contamination"]
    }
    """
    try:
        # Validate request
        validation_result = validate_image_request(request.json)
        if not validation_result['valid']:
            return jsonify({
                'error': validation_result['error'],
                'status': 'validation_failed'
            }), 400

        data = request.json
        image_url = data['image_url']
        location = data.get('location')
        analysis_types = data.get('analysis_types', ['water_quality', 'air_quality', 'visual_contamination'])

        logger.info(f"Starting analysis for image: {image_url}")

        # Download and preprocess image
        image_data = image_processor.download_and_preprocess(image_url)
        if image_data is None:
            return jsonify({
                'error': 'Failed to download or process image',
                'status': 'processing_failed'
            }), 400

        # Perform AI analysis
        analysis_results = {}
        
        if 'water_quality' in analysis_types:
            water_analysis = image_analyzer.analyze_water_quality(image_data)
            analysis_results['water_quality'] = water_analysis

        if 'air_quality' in analysis_types:
            air_analysis = image_analyzer.analyze_air_quality(image_data)
            analysis_results['air_quality'] = air_analysis

        if 'visual_contamination' in analysis_types:
            contamination_analysis = image_analyzer.analyze_visual_contamination(image_data)
            analysis_results['visual_contamination'] = contamination_analysis

        # Calculate overall confidence and score
        overall_confidence = confidence_scorer.calculate_overall_confidence(analysis_results)
        overall_score = confidence_scorer.calculate_environmental_score(analysis_results)

        # Generate recommendations
        recommendations = image_analyzer.generate_recommendations(analysis_results, location)

        response = {
            'status': 'success',
            'pollution_indicators': analysis_results,
            'overall_score': overall_score,
            'overall_confidence': overall_confidence,
            'recommendations': recommendations,
            'processing_metadata': {
                'model_version': image_analyzer.get_model_version(),
                'analysis_types': analysis_types,
                'image_dimensions': image_data.shape[:2] if image_data is not None else None
            }
        }

        logger.info(f"Analysis completed for image: {image_url}")
        return jsonify(response)

    except Exception as e:
        logger.error(f"Error analyzing image: {str(e)}")
        return jsonify({
            'error': 'Internal server error during analysis',
            'status': 'analysis_failed'
        }), 500

@app.route('/models/info', methods=['GET'])
def get_model_info():
    """Get information about loaded models"""
    return jsonify({
        'models': {
            'water_quality': {
                'version': image_analyzer.get_water_model_version(),
                'capabilities': ['turbidity_detection', 'color_analysis']
            },
            'air_quality': {
                'version': image_analyzer.get_air_model_version(),
                'capabilities': ['visibility_assessment', 'smog_detection']
            },
            'contamination': {
                'version': image_analyzer.get_contamination_model_version(),
                'capabilities': ['waste_detection', 'pollution_classification']
            }
        },
        'confidence_scorer': {
            'version': confidence_scorer.get_version(),
            'algorithms': ['weighted_average', 'uncertainty_quantification']
        }
    })

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('DEBUG', 'false').lower() == 'true'
    
    logger.info(f"Starting Environmental AI Analysis Service on port {port}")
    app.run(host='0.0.0.0', port=port, debug=debug)