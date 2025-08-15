"""
Image Processor for Environmental AI Analysis

This module handles image downloading, preprocessing, and validation for environmental analysis.
"""

import numpy as np
import cv2
import requests
from PIL import Image
from io import BytesIO
from loguru import logger
from typing import Optional, Tuple, Dict, Any
import tempfile
import os

class ImageProcessor:
    """Image processing utilities for environmental analysis"""
    
    def __init__(self):
        self.max_image_size = (1024, 1024)  # Maximum image dimensions
        self.min_image_size = (100, 100)    # Minimum image dimensions
        self.supported_formats = ['.jpg', '.jpeg', '.png', '.webp']
        self.max_file_size = 10 * 1024 * 1024  # 10MB max file size
        
        logger.info("Image Processor initialized")
    
    def download_and_preprocess(self, image_url: str) -> Optional[np.ndarray]:
        """
        Download image from URL and preprocess for analysis
        
        Args:
            image_url: URL of the image to download
            
        Returns:
            Preprocessed image as numpy array or None if failed
        """
        try:
            logger.info(f"Downloading image from: {image_url}")
            
            # Download image
            response = requests.get(image_url, timeout=30, stream=True)
            response.raise_for_status()
            
            # Check file size
            content_length = response.headers.get('content-length')
            if content_length and int(content_length) > self.max_file_size:
                logger.error(f"Image file too large: {content_length} bytes")
                return None
            
            # Load image
            image_data = BytesIO(response.content)
            image = Image.open(image_data)
            
            # Validate image
            if not self._validate_image(image):
                return None
            
            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Convert to numpy array
            image_array = np.array(image)
            
            # Preprocess image
            processed_image = self._preprocess_image(image_array)
            
            logger.info(f"Image successfully processed: {processed_image.shape}")
            return processed_image
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Error downloading image: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Error processing image: {str(e)}")
            return None
    
    def preprocess_local_image(self, image_path: str) -> Optional[np.ndarray]:
        """
        Load and preprocess local image file
        
        Args:
            image_path: Path to local image file
            
        Returns:
            Preprocessed image as numpy array or None if failed
        """
        try:
            logger.info(f"Loading local image: {image_path}")
            
            # Check file exists and size
            if not os.path.exists(image_path):
                logger.error(f"Image file not found: {image_path}")
                return None
            
            file_size = os.path.getsize(image_path)
            if file_size > self.max_file_size:
                logger.error(f"Image file too large: {file_size} bytes")
                return None
            
            # Load image
            image = Image.open(image_path)
            
            # Validate image
            if not self._validate_image(image):
                return None
            
            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Convert to numpy array
            image_array = np.array(image)
            
            # Preprocess image
            processed_image = self._preprocess_image(image_array)
            
            logger.info(f"Local image successfully processed: {processed_image.shape}")
            return processed_image
            
        except Exception as e:
            logger.error(f"Error processing local image: {str(e)}")
            return None
    
    def _validate_image(self, image: Image.Image) -> bool:
        """
        Validate image properties
        
        Args:
            image: PIL Image object
            
        Returns:
            True if image is valid, False otherwise
        """
        try:
            # Check image dimensions
            width, height = image.size
            
            if width < self.min_image_size[0] or height < self.min_image_size[1]:
                logger.error(f"Image too small: {width}x{height}")
                return False
            
            # Check if image is corrupted
            image.verify()
            
            # Reopen image after verify (verify closes the image)
            if hasattr(image, 'fp') and image.fp:
                image.fp.seek(0)
            
            return True
            
        except Exception as e:
            logger.error(f"Image validation failed: {str(e)}")
            return False
    
    def _preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """
        Preprocess image for environmental analysis
        
        Args:
            image: Input image as numpy array
            
        Returns:
            Preprocessed image
        """
        try:
            # Resize image if too large
            height, width = image.shape[:2]
            if width > self.max_image_size[0] or height > self.max_image_size[1]:
                # Calculate new dimensions maintaining aspect ratio
                scale = min(self.max_image_size[0] / width, self.max_image_size[1] / height)
                new_width = int(width * scale)
                new_height = int(height * scale)
                
                image = cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_AREA)
                logger.info(f"Image resized to: {new_width}x{new_height}")
            
            # Apply noise reduction
            image = cv2.bilateralFilter(image, 9, 75, 75)
            
            # Enhance contrast slightly
            image = self._enhance_contrast(image)
            
            return image
            
        except Exception as e:
            logger.error(f"Error in image preprocessing: {str(e)}")
            return image  # Return original image if preprocessing fails
    
    def _enhance_contrast(self, image: np.ndarray, alpha: float = 1.1, beta: int = 10) -> np.ndarray:
        """
        Enhance image contrast
        
        Args:
            image: Input image
            alpha: Contrast control (1.0-3.0)
            beta: Brightness control (0-100)
            
        Returns:
            Contrast enhanced image
        """
        try:
            # Apply contrast and brightness adjustment
            enhanced = cv2.convertScaleAbs(image, alpha=alpha, beta=beta)
            return enhanced
        except Exception as e:
            logger.warning(f"Contrast enhancement failed: {str(e)}")
            return image
    
    def extract_image_metadata(self, image_url: str) -> Dict[str, Any]:
        """
        Extract metadata from image
        
        Args:
            image_url: URL of the image
            
        Returns:
            Dictionary containing image metadata
        """
        metadata = {
            'url': image_url,
            'dimensions': None,
            'format': None,
            'file_size': None,
            'color_mode': None,
            'has_exif': False,
            'processing_timestamp': None
        }
        
        try:
            # Download and analyze image
            response = requests.get(image_url, timeout=30, stream=True)
            response.raise_for_status()
            
            image_data = BytesIO(response.content)
            image = Image.open(image_data)
            
            # Extract basic metadata
            metadata['dimensions'] = image.size
            metadata['format'] = image.format
            metadata['file_size'] = len(response.content)
            metadata['color_mode'] = image.mode
            
            # Check for EXIF data
            if hasattr(image, '_getexif') and image._getexif():
                metadata['has_exif'] = True
            
            # Add processing timestamp
            from datetime import datetime
            metadata['processing_timestamp'] = datetime.utcnow().isoformat()
            
            logger.info(f"Metadata extracted for image: {metadata['dimensions']}")
            
        except Exception as e:
            logger.error(f"Error extracting image metadata: {str(e)}")
        
        return metadata
    
    def create_analysis_preview(self, image: np.ndarray, analysis_results: Dict[str, Any]) -> Optional[np.ndarray]:
        """
        Create a preview image with analysis overlays
        
        Args:
            image: Original image
            analysis_results: Analysis results to overlay
            
        Returns:
            Preview image with overlays or None if failed
        """
        try:
            preview = image.copy()
            
            # Add text overlays for key findings
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 0.6
            color = (255, 255, 255)  # White text
            thickness = 2
            
            y_offset = 30
            
            # Water quality overlay
            if 'water_quality' in analysis_results:
                water_data = analysis_results['water_quality']
                turbidity_level = water_data.get('turbidity', {}).get('level', 'unknown')
                text = f"Water: {turbidity_level}"
                cv2.putText(preview, text, (10, y_offset), font, font_scale, color, thickness)
                y_offset += 25
            
            # Air quality overlay
            if 'air_quality' in analysis_results:
                air_data = analysis_results['air_quality']
                visibility_level = air_data.get('visibility', {}).get('level', 'unknown')
                text = f"Air: {visibility_level}"
                cv2.putText(preview, text, (10, y_offset), font, font_scale, color, thickness)
                y_offset += 25
            
            # Contamination overlay
            if 'visual_contamination' in analysis_results:
                contamination_data = analysis_results['visual_contamination']
                if contamination_data.get('detected', False):
                    contamination_type = contamination_data.get('type', 'unknown')
                    text = f"Contamination: {contamination_type}"
                    cv2.putText(preview, text, (10, y_offset), font, font_scale, (0, 0, 255), thickness)
            
            return preview
            
        except Exception as e:
            logger.error(f"Error creating analysis preview: {str(e)}")
            return None
    
    def save_processed_image(self, image: np.ndarray, output_path: str) -> bool:
        """
        Save processed image to file
        
        Args:
            image: Image to save
            output_path: Output file path
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Convert BGR to RGB if necessary (OpenCV uses BGR)
            if len(image.shape) == 3:
                image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            else:
                image_rgb = image
            
            # Save image
            pil_image = Image.fromarray(image_rgb)
            pil_image.save(output_path, quality=95)
            
            logger.info(f"Image saved to: {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving image: {str(e)}")
            return False