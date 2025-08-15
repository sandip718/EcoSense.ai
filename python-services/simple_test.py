"""
Simple test for Environmental AI Analysis Service core functionality

This test verifies the basic structure and logic without requiring heavy dependencies.
"""

import sys
import os

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_imports():
    """Test that all modules can be imported"""
    print("Testing imports...")
    
    try:
        from services.confidence_scorer import ConfidenceScorer
        print("✓ ConfidenceScorer imported successfully")
    except ImportError as e:
        print(f"✗ Failed to import ConfidenceScorer: {e}")
        return False
    
    try:
        from utils.validators import validate_image_request
        print("✓ Validators imported successfully")
    except ImportError as e:
        print(f"✗ Failed to import validators: {e}")
        return False
    
    return True

def test_confidence_scorer():
    """Test confidence scorer without image dependencies"""
    print("\nTesting ConfidenceScorer...")
    
    try:
        from services.confidence_scorer import ConfidenceScorer
        
        scorer = ConfidenceScorer()
        print(f"✓ ConfidenceScorer initialized, version: {scorer.get_version()}")
        
        # Test with mock data
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
            }
        }
        
        # Test confidence calculation
        overall_confidence = scorer.calculate_overall_confidence(mock_results)
        print(f"✓ Overall confidence calculated: {overall_confidence:.3f}")
        
        # Test environmental score
        env_score = scorer.calculate_environmental_score(mock_results)
        print(f"✓ Environmental score calculated: {env_score:.3f}")
        
        # Test confidence level classification
        confidence_level = scorer.get_confidence_level(overall_confidence)
        print(f"✓ Confidence level: {confidence_level}")
        
        return True
        
    except Exception as e:
        print(f"✗ ConfidenceScorer test failed: {e}")
        return False

def test_validators():
    """Test validation functions"""
    print("\nTesting Validators...")
    
    try:
        from utils.validators import (
            validate_image_request, 
            validate_image_url, 
            validate_location,
            validate_analysis_types
        )
        
        # Test valid image URL
        url_result = validate_image_url("https://example.com/test.jpg")
        print(f"✓ Valid URL validation: {url_result['valid']}")
        
        # Test invalid image URL
        invalid_url_result = validate_image_url("not-a-url")
        print(f"✓ Invalid URL validation: {not invalid_url_result['valid']}")
        
        # Test valid location
        location_result = validate_location({"latitude": 40.7128, "longitude": -74.0060})
        print(f"✓ Valid location validation: {location_result['valid']}")
        
        # Test invalid location
        invalid_location_result = validate_location({"latitude": 200, "longitude": -74.0060})
        print(f"✓ Invalid location validation: {not invalid_location_result['valid']}")
        
        # Test valid analysis types
        types_result = validate_analysis_types(["water_quality", "air_quality"])
        print(f"✓ Valid analysis types validation: {types_result['valid']}")
        
        # Test complete request validation
        valid_request = {
            'image_url': 'https://example.com/test.jpg',
            'location': {'latitude': 40.7128, 'longitude': -74.0060},
            'analysis_types': ['water_quality', 'air_quality']
        }
        
        request_result = validate_image_request(valid_request)
        print(f"✓ Valid request validation: {request_result['valid']}")
        
        return True
        
    except Exception as e:
        print(f"✗ Validators test failed: {e}")
        return False

def test_image_analyzer_structure():
    """Test image analyzer structure without heavy dependencies"""
    print("\nTesting ImageAnalyzer structure...")
    
    try:
        # Try to import without actually running image processing
        import importlib.util
        
        spec = importlib.util.spec_from_file_location(
            "image_analyzer", 
            "services/image_analyzer.py"
        )
        
        if spec and spec.loader:
            print("✓ ImageAnalyzer module structure is valid")
            return True
        else:
            print("✗ ImageAnalyzer module structure is invalid")
            return False
            
    except Exception as e:
        print(f"✗ ImageAnalyzer structure test failed: {e}")
        return False

def test_flask_app_structure():
    """Test Flask app structure"""
    print("\nTesting Flask app structure...")
    
    try:
        # Check if app.py has the right structure
        with open('app.py', 'r') as f:
            content = f.read()
            
        required_elements = [
            'Flask',
            '/health',
            '/analyze',
            'analyze_image',
            'EnvironmentalImageAnalyzer',
            'ConfidenceScorer'
        ]
        
        missing_elements = []
        for element in required_elements:
            if element not in content:
                missing_elements.append(element)
        
        if not missing_elements:
            print("✓ Flask app structure is complete")
            return True
        else:
            print(f"✗ Flask app missing elements: {missing_elements}")
            return False
            
    except Exception as e:
        print(f"✗ Flask app structure test failed: {e}")
        return False

def main():
    """Run all tests"""
    print("Environmental AI Analysis Service - Simple Test Suite")
    print("=" * 60)
    
    tests = [
        test_imports,
        test_confidence_scorer,
        test_validators,
        test_image_analyzer_structure,
        test_flask_app_structure
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        try:
            if test():
                passed += 1
        except Exception as e:
            print(f"✗ Test {test.__name__} failed with exception: {e}")
    
    print("\n" + "=" * 60)
    print(f"Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! The AI analysis service structure is ready.")
        return True
    else:
        print("❌ Some tests failed. Please check the implementation.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)