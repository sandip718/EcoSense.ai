"""
Confidence Scorer for Environmental AI Analysis

This module provides confidence scoring algorithms for environmental image analysis results.
It implements weighted averaging and uncertainty quantification methods.
"""

from typing import Dict, List, Any

# Try to import numpy, provide fallback
try:
    import numpy as np
except ImportError:
    # Simple fallback for basic numpy operations
    class MockNumpy:
        @staticmethod
        def array(data):
            return data
        @staticmethod
        def sum(arr):
            if hasattr(arr, '__iter__'):
                return sum(arr)
            return arr
    np = MockNumpy()

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

class ConfidenceScorer:
    """Confidence scoring system for AI predictions"""
    
    def __init__(self):
        self.version = "1.0.0"
        self.scoring_weights = {
            'water_quality': 0.35,
            'air_quality': 0.35,
            'visual_contamination': 0.30
        }
        
        # Confidence adjustment factors
        self.confidence_factors = {
            'high_confidence_threshold': 0.8,
            'medium_confidence_threshold': 0.6,
            'low_confidence_threshold': 0.4,
            'uncertainty_penalty': 0.1
        }
        
        logger.info("Confidence Scorer initialized")
    
    def calculate_overall_confidence(self, analysis_results: Dict[str, Any]) -> float:
        """
        Calculate overall confidence score across all analysis types
        
        Args:
            analysis_results: Dictionary containing results from different analysis types
            
        Returns:
            Overall confidence score between 0 and 1
        """
        try:
            confidences = []
            weights = []
            
            # Extract confidence scores from each analysis type
            for analysis_type, weight in self.scoring_weights.items():
                if analysis_type in analysis_results:
                    result = analysis_results[analysis_type]
                    confidence = result.get('confidence', 0.5)
                    
                    # Apply confidence adjustments based on result quality
                    adjusted_confidence = self._adjust_confidence_by_quality(
                        confidence, result, analysis_type
                    )
                    
                    confidences.append(adjusted_confidence)
                    weights.append(weight)
            
            if not confidences:
                logger.warning("No analysis results found for confidence calculation")
                return 0.3
            
            # Calculate weighted average confidence
            weights = np.array(weights)
            confidences = np.array(confidences)
            
            # Normalize weights
            weights = weights / np.sum(weights)
            
            # Calculate weighted confidence
            overall_confidence = np.sum(confidences * weights)
            
            # Apply uncertainty penalty if results are inconsistent
            uncertainty_penalty = self._calculate_uncertainty_penalty(analysis_results)
            overall_confidence = max(0.1, overall_confidence - uncertainty_penalty)
            
            logger.info(f"Overall confidence calculated: {overall_confidence:.3f}")
            return min(max(overall_confidence, 0.0), 1.0)
            
        except Exception as e:
            logger.error(f"Error calculating overall confidence: {str(e)}")
            return 0.3
    
    def calculate_environmental_score(self, analysis_results: Dict[str, Any]) -> float:
        """
        Calculate overall environmental quality score
        
        Args:
            analysis_results: Dictionary containing results from different analysis types
            
        Returns:
            Environmental quality score between 0 (poor) and 1 (excellent)
        """
        try:
            scores = []
            weights = []
            
            # Extract quality scores from each analysis type
            for analysis_type, weight in self.scoring_weights.items():
                if analysis_type in analysis_results:
                    result = analysis_results[analysis_type]
                    score = result.get('overall_score', 0.5)
                    confidence = result.get('confidence', 0.5)
                    
                    # Weight score by confidence
                    weighted_score = score * confidence + 0.5 * (1 - confidence)
                    
                    scores.append(weighted_score)
                    weights.append(weight)
            
            if not scores:
                logger.warning("No analysis results found for environmental score calculation")
                return 0.5
            
            # Calculate weighted average score
            weights = np.array(weights)
            scores = np.array(scores)
            
            # Normalize weights
            weights = weights / np.sum(weights)
            
            # Calculate weighted environmental score
            environmental_score = np.sum(scores * weights)
            
            logger.info(f"Environmental score calculated: {environmental_score:.3f}")
            return min(max(environmental_score, 0.0), 1.0)
            
        except Exception as e:
            logger.error(f"Error calculating environmental score: {str(e)}")
            return 0.5
    
    def get_confidence_level(self, confidence_score: float) -> str:
        """
        Convert numerical confidence score to descriptive level
        
        Args:
            confidence_score: Numerical confidence between 0 and 1
            
        Returns:
            Descriptive confidence level
        """
        if confidence_score >= self.confidence_factors['high_confidence_threshold']:
            return 'high'
        elif confidence_score >= self.confidence_factors['medium_confidence_threshold']:
            return 'medium'
        elif confidence_score >= self.confidence_factors['low_confidence_threshold']:
            return 'low'
        else:
            return 'very_low'
    
    def get_version(self) -> str:
        """Get the confidence scorer version"""
        return self.version
    
    def _adjust_confidence_by_quality(self, base_confidence: float, result: Dict[str, Any], 
                                    analysis_type: str) -> float:
        """
        Adjust confidence based on result quality indicators
        
        Args:
            base_confidence: Base confidence score
            result: Analysis result dictionary
            analysis_type: Type of analysis performed
            
        Returns:
            Adjusted confidence score
        """
        adjusted_confidence = base_confidence
        
        try:
            if analysis_type == 'water_quality':
                # Boost confidence for clear turbidity readings
                turbidity_data = result.get('turbidity', {})
                if turbidity_data.get('level') in ['clear', 'highly_turbid']:
                    adjusted_confidence += 0.1
                
                # Reduce confidence for unclear color classification
                color_data = result.get('color_index', {})
                if color_data.get('dominant_color') == 'unclear':
                    adjusted_confidence -= 0.15
            
            elif analysis_type == 'air_quality':
                # Boost confidence for extreme visibility conditions
                visibility_data = result.get('visibility', {})
                if visibility_data.get('level') in ['excellent', 'poor']:
                    adjusted_confidence += 0.1
                
                # Reduce confidence when no clear smog type is detected
                smog_data = result.get('smog_density', {})
                if smog_data.get('type') == 'none':
                    adjusted_confidence -= 0.05
            
            elif analysis_type == 'visual_contamination':
                # Boost confidence for clear contamination detection
                if result.get('detected', False):
                    contamination_type = result.get('type', 'unknown')
                    if contamination_type != 'unknown':
                        adjusted_confidence += 0.1
                
                # Reduce confidence for low texture anomaly scores
                texture_data = result.get('texture_anomalies', {})
                if texture_data.get('anomaly_score', 0) < 0.2:
                    adjusted_confidence -= 0.1
        
        except Exception as e:
            logger.warning(f"Error adjusting confidence for {analysis_type}: {str(e)}")
        
        return min(max(adjusted_confidence, 0.1), 1.0)
    
    def _calculate_uncertainty_penalty(self, analysis_results: Dict[str, Any]) -> float:
        """
        Calculate uncertainty penalty based on result inconsistencies
        
        Args:
            analysis_results: Dictionary containing all analysis results
            
        Returns:
            Uncertainty penalty value
        """
        try:
            # Check for inconsistencies between different analysis types
            penalty = 0.0
            
            # Extract overall scores
            scores = []
            for analysis_type in self.scoring_weights.keys():
                if analysis_type in analysis_results:
                    score = analysis_results[analysis_type].get('overall_score', 0.5)
                    scores.append(score)
            
            if len(scores) > 1:
                # Calculate variance in scores
                score_variance = np.var(scores)
                
                # High variance indicates inconsistent results
                if score_variance > 0.1:
                    penalty += self.confidence_factors['uncertainty_penalty']
                
                # Check for extreme disagreements
                score_range = max(scores) - min(scores)
                if score_range > 0.6:
                    penalty += self.confidence_factors['uncertainty_penalty'] * 0.5
            
            # Check for low confidence across multiple analysis types
            low_confidence_count = 0
            for analysis_type in self.scoring_weights.keys():
                if analysis_type in analysis_results:
                    confidence = analysis_results[analysis_type].get('confidence', 0.5)
                    if confidence < self.confidence_factors['low_confidence_threshold']:
                        low_confidence_count += 1
            
            if low_confidence_count >= 2:
                penalty += self.confidence_factors['uncertainty_penalty'] * 0.3
            
            return min(penalty, 0.3)  # Cap penalty at 0.3
            
        except Exception as e:
            logger.warning(f"Error calculating uncertainty penalty: {str(e)}")
            return 0.0
    
    def generate_confidence_report(self, analysis_results: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate detailed confidence report
        
        Args:
            analysis_results: Dictionary containing all analysis results
            
        Returns:
            Detailed confidence report
        """
        try:
            overall_confidence = self.calculate_overall_confidence(analysis_results)
            environmental_score = self.calculate_environmental_score(analysis_results)
            confidence_level = self.get_confidence_level(overall_confidence)
            
            # Individual analysis confidences
            individual_confidences = {}
            for analysis_type in self.scoring_weights.keys():
                if analysis_type in analysis_results:
                    confidence = analysis_results[analysis_type].get('confidence', 0.5)
                    individual_confidences[analysis_type] = {
                        'confidence': confidence,
                        'level': self.get_confidence_level(confidence)
                    }
            
            # Quality indicators
            quality_indicators = self._assess_quality_indicators(analysis_results)
            
            report = {
                'overall_confidence': overall_confidence,
                'confidence_level': confidence_level,
                'environmental_score': environmental_score,
                'individual_confidences': individual_confidences,
                'quality_indicators': quality_indicators,
                'uncertainty_penalty': self._calculate_uncertainty_penalty(analysis_results),
                'recommendations': self._generate_confidence_recommendations(overall_confidence, quality_indicators)
            }
            
            return report
            
        except Exception as e:
            logger.error(f"Error generating confidence report: {str(e)}")
            return {
                'overall_confidence': 0.3,
                'confidence_level': 'low',
                'environmental_score': 0.5,
                'error': 'Failed to generate confidence report'
            }
    
    def _assess_quality_indicators(self, analysis_results: Dict[str, Any]) -> Dict[str, Any]:
        """Assess various quality indicators from the analysis results"""
        indicators = {
            'data_completeness': len(analysis_results) / len(self.scoring_weights),
            'result_consistency': 1.0 - self._calculate_uncertainty_penalty(analysis_results) / 0.3,
            'detection_clarity': 0.5
        }
        
        # Assess detection clarity
        clear_detections = 0
        total_detections = 0
        
        for analysis_type, result in analysis_results.items():
            total_detections += 1
            
            if analysis_type == 'water_quality':
                turbidity_level = result.get('turbidity', {}).get('level', 'unknown')
                if turbidity_level in ['clear', 'highly_turbid']:
                    clear_detections += 1
            elif analysis_type == 'air_quality':
                visibility_level = result.get('visibility', {}).get('level', 'unknown')
                if visibility_level in ['excellent', 'poor']:
                    clear_detections += 1
            elif analysis_type == 'visual_contamination':
                contamination_type = result.get('type', 'unknown')
                if contamination_type != 'unknown':
                    clear_detections += 1
        
        if total_detections > 0:
            indicators['detection_clarity'] = clear_detections / total_detections
        
        return indicators
    
    def _generate_confidence_recommendations(self, overall_confidence: float, 
                                           quality_indicators: Dict[str, Any]) -> List[str]:
        """Generate recommendations based on confidence analysis"""
        recommendations = []
        
        if overall_confidence < 0.4:
            recommendations.append("Low confidence detected - consider additional data sources")
        
        if quality_indicators.get('data_completeness', 1.0) < 0.8:
            recommendations.append("Incomplete analysis - some environmental factors not assessed")
        
        if quality_indicators.get('result_consistency', 1.0) < 0.6:
            recommendations.append("Inconsistent results detected - manual verification recommended")
        
        if quality_indicators.get('detection_clarity', 1.0) < 0.5:
            recommendations.append("Unclear detection results - image quality may be insufficient")
        
        if overall_confidence > 0.8:
            recommendations.append("High confidence analysis - results are reliable")
        
        return recommendations