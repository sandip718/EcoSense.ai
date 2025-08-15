"""
Validators for Environmental AI Analysis Service

This module provides validation functions for API requests and data.
"""

from typing import Dict, Any, List, Optional
import re
from urllib.parse import urlparse

# Try to import logger, provide fallback
try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger(__name__)
    logger.setLevel(logging.INFO)
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
    logger.addHandler(handler)

def validate_image_request(request_data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Validate image analysis request data
    
    Args:
        request_data: Request data dictionary
        
    Returns:
        Validation result with 'valid' boolean and 'error' message if invalid
    """
    if not request_data:
        return {
            'valid': False,
            'error': 'Request data is required'
        }
    
    # Check required fields
    if 'image_url' not in request_data:
        return {
            'valid': False,
            'error': 'image_url is required'
        }
    
    # Validate image URL
    image_url = request_data['image_url']
    url_validation = validate_image_url(image_url)
    if not url_validation['valid']:
        return url_validation
    
    # Validate location if provided
    if 'location' in request_data:
        location_validation = validate_location(request_data['location'])
        if not location_validation['valid']:
            return location_validation
    
    # Validate analysis types if provided
    if 'analysis_types' in request_data:
        analysis_validation = validate_analysis_types(request_data['analysis_types'])
        if not analysis_validation['valid']:
            return analysis_validation
    
    return {'valid': True}

def validate_image_url(url: str) -> Dict[str, Any]:
    """
    Validate image URL format and accessibility
    
    Args:
        url: Image URL to validate
        
    Returns:
        Validation result
    """
    if not url or not isinstance(url, str):
        return {
            'valid': False,
            'error': 'Image URL must be a non-empty string'
        }
    
    # Check URL format
    try:
        parsed_url = urlparse(url)
        if not parsed_url.scheme or not parsed_url.netloc:
            return {
                'valid': False,
                'error': 'Invalid URL format'
            }
        
        # Check if scheme is http or https
        if parsed_url.scheme not in ['http', 'https']:
            return {
                'valid': False,
                'error': 'URL must use http or https protocol'
            }
        
    except Exception as e:
        return {
            'valid': False,
            'error': f'Invalid URL format: {str(e)}'
        }
    
    # Check file extension (basic check)
    supported_extensions = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff']
    url_lower = url.lower()
    
    # Extract potential file extension
    path = parsed_url.path.lower()
    has_valid_extension = any(path.endswith(ext) for ext in supported_extensions)
    
    # Allow URLs without clear extensions (some services don't show extensions)
    # but warn about it
    if not has_valid_extension:
        logger.warning(f"URL does not have a clear image extension: {url}")
    
    return {'valid': True}

def validate_location(location: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate location data
    
    Args:
        location: Location dictionary with latitude and longitude
        
    Returns:
        Validation result
    """
    if not isinstance(location, dict):
        return {
            'valid': False,
            'error': 'Location must be a dictionary'
        }
    
    # Check required fields
    required_fields = ['latitude', 'longitude']
    for field in required_fields:
        if field not in location:
            return {
                'valid': False,
                'error': f'Location must include {field}'
            }
    
    # Validate latitude
    try:
        lat = float(location['latitude'])
        if lat < -90 or lat > 90:
            return {
                'valid': False,
                'error': 'Latitude must be between -90 and 90'
            }
    except (ValueError, TypeError):
        return {
            'valid': False,
            'error': 'Latitude must be a valid number'
        }
    
    # Validate longitude
    try:
        lng = float(location['longitude'])
        if lng < -180 or lng > 180:
            return {
                'valid': False,
                'error': 'Longitude must be between -180 and 180'
            }
    except (ValueError, TypeError):
        return {
            'valid': False,
            'error': 'Longitude must be a valid number'
        }
    
    return {'valid': True}

def validate_analysis_types(analysis_types: List[str]) -> Dict[str, Any]:
    """
    Validate analysis types list
    
    Args:
        analysis_types: List of analysis types to perform
        
    Returns:
        Validation result
    """
    if not isinstance(analysis_types, list):
        return {
            'valid': False,
            'error': 'Analysis types must be a list'
        }
    
    if not analysis_types:
        return {
            'valid': False,
            'error': 'At least one analysis type must be specified'
        }
    
    # Valid analysis types
    valid_types = ['water_quality', 'air_quality', 'visual_contamination']
    
    # Check each analysis type
    for analysis_type in analysis_types:
        if not isinstance(analysis_type, str):
            return {
                'valid': False,
                'error': 'Analysis types must be strings'
            }
        
        if analysis_type not in valid_types:
            return {
                'valid': False,
                'error': f'Invalid analysis type: {analysis_type}. Valid types: {valid_types}'
            }
    
    # Check for duplicates
    if len(analysis_types) != len(set(analysis_types)):
        return {
            'valid': False,
            'error': 'Duplicate analysis types are not allowed'
        }
    
    return {'valid': True}

def validate_confidence_threshold(threshold: float) -> Dict[str, Any]:
    """
    Validate confidence threshold value
    
    Args:
        threshold: Confidence threshold between 0 and 1
        
    Returns:
        Validation result
    """
    try:
        threshold_float = float(threshold)
        if threshold_float < 0 or threshold_float > 1:
            return {
                'valid': False,
                'error': 'Confidence threshold must be between 0 and 1'
            }
        return {'valid': True}
    except (ValueError, TypeError):
        return {
            'valid': False,
            'error': 'Confidence threshold must be a valid number'
        }

def validate_image_dimensions(width: int, height: int, 
                            min_size: tuple = (100, 100), 
                            max_size: tuple = (4096, 4096)) -> Dict[str, Any]:
    """
    Validate image dimensions
    
    Args:
        width: Image width in pixels
        height: Image height in pixels
        min_size: Minimum allowed dimensions (width, height)
        max_size: Maximum allowed dimensions (width, height)
        
    Returns:
        Validation result
    """
    try:
        width = int(width)
        height = int(height)
        
        if width < min_size[0] or height < min_size[1]:
            return {
                'valid': False,
                'error': f'Image too small. Minimum size: {min_size[0]}x{min_size[1]}'
            }
        
        if width > max_size[0] or height > max_size[1]:
            return {
                'valid': False,
                'error': f'Image too large. Maximum size: {max_size[0]}x{max_size[1]}'
            }
        
        return {'valid': True}
        
    except (ValueError, TypeError):
        return {
            'valid': False,
            'error': 'Image dimensions must be valid integers'
        }

def validate_file_size(file_size: int, max_size: int = 10 * 1024 * 1024) -> Dict[str, Any]:
    """
    Validate file size
    
    Args:
        file_size: File size in bytes
        max_size: Maximum allowed file size in bytes (default 10MB)
        
    Returns:
        Validation result
    """
    try:
        file_size = int(file_size)
        
        if file_size <= 0:
            return {
                'valid': False,
                'error': 'File size must be greater than 0'
            }
        
        if file_size > max_size:
            max_mb = max_size / (1024 * 1024)
            return {
                'valid': False,
                'error': f'File too large. Maximum size: {max_mb:.1f}MB'
            }
        
        return {'valid': True}
        
    except (ValueError, TypeError):
        return {
            'valid': False,
            'error': 'File size must be a valid integer'
        }

def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename for safe storage
    
    Args:
        filename: Original filename
        
    Returns:
        Sanitized filename
    """
    if not filename:
        return 'unnamed_file'
    
    # Remove or replace dangerous characters
    sanitized = re.sub(r'[<>:"/\\|?*]', '_', filename)
    
    # Remove leading/trailing whitespace and dots
    sanitized = sanitized.strip(' .')
    
    # Limit length
    if len(sanitized) > 255:
        name, ext = sanitized.rsplit('.', 1) if '.' in sanitized else (sanitized, '')
        max_name_length = 255 - len(ext) - 1 if ext else 255
        sanitized = name[:max_name_length] + ('.' + ext if ext else '')
    
    # Ensure it's not empty after sanitization
    if not sanitized:
        sanitized = 'unnamed_file'
    
    return sanitized

def validate_model_version(version: str) -> Dict[str, Any]:
    """
    Validate model version string
    
    Args:
        version: Model version string
        
    Returns:
        Validation result
    """
    if not version or not isinstance(version, str):
        return {
            'valid': False,
            'error': 'Model version must be a non-empty string'
        }
    
    # Basic semantic version pattern (e.g., 1.0.0, 2.1.3-beta)
    version_pattern = r'^\d+\.\d+\.\d+(-[a-zA-Z0-9]+)?$'
    
    if not re.match(version_pattern, version):
        return {
            'valid': False,
            'error': 'Model version must follow semantic versioning (e.g., 1.0.0)'
        }
    
    return {'valid': True}