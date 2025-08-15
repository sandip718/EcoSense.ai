"""
Test script for Environmental AI Analysis Service

This script tests the core functionality of the AI analysis components.
"""

import numpy as np
import cv2
from services.image_analyzer import EnvironmentalImageAnalyzer
from services.confidence_scorer import ConfidenceScorer
from utils.image_processor import ImageProcessor
from utils.validators import validate_image_request
import json

def create_test_image(image_type='water'):
    """Create a synthetic test image for analysis"""
    if image_type == 'water':
        # Create a blue-ish image simulating water
        image = np.zeros((400, 600, 3), dtype=np.uint8)
        image[:, :, 2] = 150  # Blue channel
        image[:, :, 1] = 100  # Green channel
        image[:, :, 0] = 50   # Red channel
        
        # Add some noise to simulate turbidity
        noise = np.random.normal(0, 20, image.shape).astype(np.int16)
        image = np.clip(image.astype(np.int16) + noise, 0, 255).astype(np.uint8)
        
    elif image_type == 'air':
        # Create a hazy/smoggy image
        image = np.ones((400, 600, 3), dtype=np.uint8) * 180  # Grayish base
        
        # Add gradient to simulate haze
        for i in range(image.shape[0]):
            factor = 1.0 - (i / image.shape[0]) * 0.3
            image[i, :, :] = (image[i, :, :] * factor).astype(np.uint8)
    
    elif image_type == 'contaminated':
        # Create an image with visible contamination
        image = np.zeros((400, 600, 3), dtype=np.uint8)
        image[:, :, 2] = 120  # Blue water base
        image[:, :, 1] = 80
        image[:, :, 0] = 40
        
        # Add bright colored patches (simulating plastic waste)
        cv2.rectangle(image, (100, 100), (150, 150), (0, 255, 255), -1)  # Yellow patch
        cv2.rectangle(image, (200, 200), (250, 250), (255, 0, 255), -1)  # Magenta patch
        
    else:
        # Default clean environment
        image = np.ones((400, 600, 3), dtype=np.uint8) * 128
    
    return image

def test_image_analyzer():
    """Test the environmental image analyzer"""
    print("Testing Environmental Image Analyzer...")
    
    analyzer = EnvironmentalImageAnalyzer()
    
    # Test with different image types
    test_cases = ['water', 'air', 'contaminated']
    
    for test_case in test_cases:
        print(f"\n--- Testing {test_case} image ---")
        
        # Create test image
        test_image = create_test_image(test_case)
        
        # Perform analysis
        if test_case == 'water':
            result = analyzer.analyze_water_quality(test_image)
            print(f"Water Quality Analysis:")
            print(f"  Turbidity: {result['turbidity']['value']:.3f} ({result['turbidity']['level']})")
            print(f"  Color Index: {result['color_index']['value']:.3f}")
            print(f"  Overall Score: {result['overall_score']:.3f}")
            print(f"  Confidence: {result['confidence']:.3f}")
            
        elif test_case == 'air':
            result = analyzer.analyze_air_quality(test_image)
            print(f"Air Quality Analysis:")
            print(f"  Visibility: {result['visibility']['value']:.3f} ({result['visibility']['level']})")
            print(f"  Smog Density: {result['smog_density']['value']:.3f}")
            print(f"  Overall Score: {result['overall_score']:.3f}")
            print(f"  Confidence: {result['confidence']:.3f}")
            
        elif test_case == 'contaminated':
            result = analyzer.analyze_visual_contamination(test_image)
            print(f"Visual Contamination Analysis:")
            print(f"  Detected: {result['detected']}")
            print(f"  Type: {result['type']}")
            print(f"  Overall Score: {result['overall_score']:.3f}")
            print(f"  Confidence: {result['confidence']:.3f}")

def test_confidence_scorer():
    """Test the confidence scoring system"""
    print("\n\nTesting Confidence Scorer...")
    
    scorer = ConfidenceScorer()
    
    # Create mock analysis results
    mock_results = {
        'water_quality': {
            'turbidity': {'value': 0.3, 'level': 'slightly_turbid', 'confidence': 0.8},
            'color_index': {'value': 0.2, 'dominant_color': 'blue', 'confidence': 0.7},
            'clarity': {'value': 0.7, 'confidence': 0.8},
            'overall_score': 0.75,
            'confidence': 0.8
        },
        'air_quality': {
            'smog_density': {'value': 0.4, 'type': 'gray_smog', 'confidence': 0.6},
            'visibility': {'value': 0.6, 'level': 'moderate', 'confidence': 0.7},
            'haze_intensity': {'value': 0.3, 'confidence': 0.6},
            'overall_score': 0.65,
            'confidence': 0.65
        },
        'visual_contamination': {
            'detected': True,
            'type': 'plastic',
            'indicators': {'plastic': {'presence': 0.6, 'confidence': 0.7}},
            'texture_anomalies': {'anomaly_score': 0.4, 'confidence': 0.6},
            'overall_score': 0.4,
            'confidence': 0.65
        }
    }
    
    # Test overall confidence calculation
    overall_confidence = scorer.calculate_overall_confidence(mock_results)
    print(f"Overall Confidence: {overall_confidence:.3f}")
    
    # Test environmental score calculation
    environmental_score = scorer.calculate_environmental_score(mock_results)
    print(f"Environmental Score: {environmental_score:.3f}")
    
    # Test confidence report generation
    report = scorer.generate_confidence_report(mock_results)
    print(f"Confidence Level: {report['confidence_level']}")
    print(f"Quality Indicators: {report['quality_indicators']}")
    print(f"Recommendations: {report['recommendations']}")

def test_image_processor():
    """Test the image processor"""
    print("\n\nTesting Image Processor...")
    
    processor = ImageProcessor()
    
    # Create a test image
    test_image = create_test_image('water')
    
    # Test preprocessing
    processed_image = processor._preprocess_image(test_image)
    print(f"Original image shape: {test_image.shape}")
    print(f"Processed image shape: {processed_image.shape}")
    
    # Test metadata extraction (mock)
    metadata = {
        'url': 'test://example.com/test.jpg',
        'dimensions': test_image.shape[:2],
        'format': 'JPEG',
        'file_size': test_image.nbytes,
        'color_mode': 'RGB',
        'has_exif': False,
        'processing_timestamp': '2024-01-01T00:00:00'
    }
    print(f"Mock metadata: {metadata}")

def test_validators():
    """Test the validation functions"""
    print("\n\nTesting Validators...")
    
    # Test valid request
    valid_request = {
        'image_url': 'https://example.com/test.jpg',
        'location': {'latitude': 40.7128, 'longitude': -74.0060},
        'analysis_types': ['water_quality', 'air_quality']
    }
    
    result = validate_image_request(valid_request)
    print(f"Valid request validation: {result}")
    
    # Test invalid request
    invalid_request = {
        'image_url': 'not-a-url',
        'location': {'latitude': 200, 'longitude': -74.0060}  # Invalid latitude
    }
    
    result = validate_image_request(invalid_request)
    print(f"Invalid request validation: {result}")

def test_full_analysis_pipeline():
    """Test the complete analysis pipeline"""
    print("\n\nTesting Full Analysis Pipeline...")
    
    analyzer = EnvironmentalImageAnalyzer()
    scorer = ConfidenceScorer()
    
    # Create test image
    test_image = create_test_image('contaminated')
    
    # Perform all analyses
    analysis_results = {}
    
    # Water quality analysis
    water_result = analyzer.analyze_water_quality(test_image)
    analysis_results['water_quality'] = water_result
    
    # Air quality analysis
    air_result = analyzer.analyze_air_quality(test_image)
    analysis_results['air_quality'] = air_result
    
    # Visual contamination analysis
    contamination_result = analyzer.analyze_visual_contamination(test_image)
    analysis_results['visual_contamination'] = contamination_result
    
    # Calculate overall scores
    overall_confidence = scorer.calculate_overall_confidence(analysis_results)
    environmental_score = scorer.calculate_environmental_score(analysis_results)
    
    # Generate recommendations
    recommendations = analyzer.generate_recommendations(analysis_results)
    
    # Print summary
    print(f"=== Analysis Summary ===")
    print(f"Overall Environmental Score: {environmental_score:.3f}")
    print(f"Overall Confidence: {overall_confidence:.3f}")
    print(f"Recommendations:")
    for i, rec in enumerate(recommendations, 1):
        print(f"  {i}. {rec}")
    
    # Print detailed results
    print(f"\n=== Detailed Results ===")
    print(json.dumps(analysis_results, indent=2, default=str))

if __name__ == "__main__":
    print("Environmental AI Analysis Service - Test Suite")
    print("=" * 50)
    
    try:
        test_image_analyzer()
        test_confidence_scorer()
        test_image_processor()
        test_validators()
        test_full_analysis_pipeline()
        
        print("\n" + "=" * 50)
        print("All tests completed successfully!")
        
    except Exception as e:
        print(f"\nTest failed with error: {str(e)}")
        import traceback
        traceback.print_exc()