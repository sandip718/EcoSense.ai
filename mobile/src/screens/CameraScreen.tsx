// Camera Screen for EcoSense.ai Mobile App
// Implements requirement 10.2: Camera integration for environmental photo capture

import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useAppDispatch, useAppSelector} from '@/store/hooks';
import {
  requestCameraPermission,
  captureImage,
  analyzeImage,
} from '@/store/slices/cameraSlice';
import {addPendingUpload} from '@/store/slices/offlineSlice';
import {logger} from '@/utils/logger';

const CameraScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const {
    cameraPermission,
    capturedImages,
    currentAnalysis,
    loading,
    analyzing,
    error,
  } = useAppSelector(state => state.camera);

  const {
    currentLocation,
  } = useAppSelector(state => state.location);

  const {
    isOnline,
  } = useAppSelector(state => state.offline);

  useEffect(() => {
    if (cameraPermission === 'not_requested') {
      dispatch(requestCameraPermission());
    }
  }, []);

  const handleCapturePhoto = async () => {
    try {
      if (cameraPermission !== 'granted') {
        Alert.alert(
          'Camera Permission Required',
          'Please grant camera permission to capture photos.',
          [
            {text: 'Cancel'},
            {
              text: 'Grant Permission',
              onPress: () => dispatch(requestCameraPermission()),
            },
          ]
        );
        return;
      }

      logger.userAction('capture_photo_initiated');

      const imageUri = await dispatch(captureImage({
        quality: 0.8,
        maxWidth: 1920,
        maxHeight: 1080,
      })).unwrap();

      setSelectedImage(imageUri);
      logger.userAction('photo_captured', {imageUri});

    } catch (error) {
      logger.error('Failed to capture photo:', error);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    }
  };

  const handleAnalyzePhoto = async () => {
    if (!selectedImage) return;

    try {
      logger.userAction('analyze_photo_initiated', {imageUri: selectedImage});

      if (isOnline) {
        // Analyze online
        await dispatch(analyzeImage({
          imageUri: selectedImage,
          location: currentLocation,
        })).unwrap();

        logger.userAction('photo_analyzed_online');
        Alert.alert(
          'Analysis Complete',
          'Your photo has been analyzed. Check the results below.',
          [{text: 'OK'}]
        );
      } else {
        // Queue for offline analysis
        await dispatch(addPendingUpload({
          type: 'image',
          data: {
            imageUri: selectedImage,
            location: currentLocation,
          },
        })).unwrap();

        logger.userAction('photo_queued_offline');
        Alert.alert(
          'Photo Queued',
          'You are offline. Your photo will be analyzed when you reconnect to the internet.',
          [{text: 'OK'}]
        );
      }
    } catch (error) {
      logger.error('Failed to analyze photo:', error);
      Alert.alert('Error', 'Failed to analyze photo. Please try again.');
    }
  };

  const handleSelectFromGallery = () => {
    // This would open the image picker for gallery selection
    Alert.alert(
      'Select Photo',
      'Choose a photo from your gallery to analyze.',
      [
        {text: 'Cancel'},
        {text: 'Open Gallery', onPress: () => {
          // Implementation would use CameraService.selectFromGallery()
          logger.userAction('gallery_selection_initiated');
        }},
      ]
    );
  };

  const renderAnalysisResults = () => {
    if (!currentAnalysis) return null;

    const results = currentAnalysis.analysis_results;
    
    return (
      <View style={styles.analysisResults}>
        <Text style={styles.analysisTitle}>Analysis Results</Text>
        
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreLabel}>Overall Environmental Score</Text>
          <Text style={styles.scoreValue}>
            {Math.round(results.overall_score)}/100
          </Text>
        </View>

        {results.pollution_indicators.air_quality && (
          <View style={styles.indicatorCard}>
            <Text style={styles.indicatorTitle}>Air Quality</Text>
            <Text style={styles.indicatorText}>
              Smog Density: {Math.round(results.pollution_indicators.air_quality.smog_density * 100)}%
            </Text>
            <Text style={styles.indicatorText}>
              Visibility: {Math.round(results.pollution_indicators.air_quality.visibility * 100)}%
            </Text>
          </View>
        )}

        {results.pollution_indicators.water_quality && (
          <View style={styles.indicatorCard}>
            <Text style={styles.indicatorTitle}>Water Quality</Text>
            <Text style={styles.indicatorText}>
              Turbidity: {Math.round(results.pollution_indicators.water_quality.turbidity * 100)}%
            </Text>
            <Text style={styles.indicatorText}>
              Color Index: {Math.round(results.pollution_indicators.water_quality.color_index * 100)}%
            </Text>
          </View>
        )}

        {results.recommendations.length > 0 && (
          <View style={styles.recommendationsCard}>
            <Text style={styles.recommendationsTitle}>Recommendations</Text>
            {results.recommendations.map((rec, index) => (
              <Text key={index} style={styles.recommendationText}>
                • {rec}
              </Text>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* Camera Controls */}
      <View style={styles.cameraControls}>
        <TouchableOpacity
          style={styles.captureButton}
          onPress={handleCapturePhoto}
          disabled={loading}>
          <Icon name="camera-alt" size={32} color="#FFFFFF" />
          <Text style={styles.buttonText}>Capture Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.galleryButton}
          onPress={handleSelectFromGallery}>
          <Icon name="photo-library" size={24} color="#2E7D32" />
          <Text style={styles.galleryButtonText}>Gallery</Text>
        </TouchableOpacity>
      </View>

      {/* Selected Image */}
      {selectedImage && (
        <View style={styles.imageContainer}>
          <Image source={{uri: selectedImage}} style={styles.selectedImage} />
          
          <View style={styles.imageActions}>
            <TouchableOpacity
              style={styles.analyzeButton}
              onPress={handleAnalyzePhoto}
              disabled={analyzing}>
              {analyzing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Icon name="analytics" size={20} color="#FFFFFF" />
              )}
              <Text style={styles.buttonText}>
                {analyzing ? 'Analyzing...' : 'Analyze Photo'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.retakeButton}
              onPress={() => setSelectedImage(null)}>
              <Icon name="refresh" size={20} color="#666666" />
              <Text style={styles.retakeButtonText}>Retake</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Analysis Results */}
      {renderAnalysisResults()}

      {/* Recent Captures */}
      {capturedImages.length > 0 && (
        <View style={styles.recentCaptures}>
          <Text style={styles.sectionTitle}>Recent Captures</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {capturedImages.slice(-5).map((imageUri, index) => (
              <TouchableOpacity
                key={index}
                style={styles.thumbnailContainer}
                onPress={() => setSelectedImage(imageUri)}>
                <Image source={{uri: imageUri}} style={styles.thumbnail} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Offline Notice */}
      {!isOnline && (
        <View style={styles.offlineNotice}>
          <Icon name="cloud-off" size={20} color="#FF9800" />
          <Text style={styles.offlineText}>
            Offline mode: Photos will be analyzed when you reconnect.
          </Text>
        </View>
      )}

      {/* Error Display */}
      {error && (
        <View style={styles.errorContainer}>
          <Icon name="error" size={20} color="#F44336" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionsTitle}>Tips for Better Analysis</Text>
        <Text style={styles.instructionText}>
          • Ensure good lighting conditions
        </Text>
        <Text style={styles.instructionText}>
          • Hold the camera steady
        </Text>
        <Text style={styles.instructionText}>
          • Capture clear views of the environment
        </Text>
        <Text style={styles.instructionText}>
          • Include visible pollution sources if present
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  captureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E7D32',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
    justifyContent: 'center',
  },
  galleryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2E7D32',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  galleryButtonText: {
    color: '#2E7D32',
    fontSize: 14,
    marginLeft: 4,
  },
  imageContainer: {
    margin: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 2,
  },
  selectedImage: {
    width: '100%',
    height: 300,
    resizeMode: 'cover',
  },
  imageActions: {
    flexDirection: 'row',
    padding: 16,
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
    marginRight: 8,
    justifyContent: 'center',
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retakeButtonText: {
    color: '#666666',
    fontSize: 14,
    marginLeft: 4,
  },
  analysisResults: {
    margin: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    elevation: 2,
  },
  analysisTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  scoreContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
  },
  scoreLabel: {
    fontSize: 16,
    color: '#2E7D32',
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  indicatorCard: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
  },
  indicatorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  indicatorText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  recommendationsCard: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 6,
    marginTop: 8,
  },
  recommendationsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 8,
  },
  recommendationText: {
    fontSize: 14,
    color: '#1976D2',
    marginBottom: 4,
  },
  recentCaptures: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 12,
  },
  thumbnailContainer: {
    marginRight: 12,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  offlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    margin: 16,
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  offlineText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#F57C00',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    margin: 16,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  errorText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#D32F2F',
  },
  instructions: {
    margin: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    elevation: 1,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 6,
  },
});

export default CameraScreen;