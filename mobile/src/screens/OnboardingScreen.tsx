// Onboarding Screen for EcoSense.ai Mobile App

import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useAppDispatch} from '@/store/hooks';
import {setOnboardingComplete} from '@/store/slices/userSlice';
import {requestPermissions} from '@/utils/permissions';
import {logger} from '@/utils/logger';

const {width} = Dimensions.get('window');

interface OnboardingStep {
  title: string;
  description: string;
  icon: string;
  color: string;
}

const onboardingSteps: OnboardingStep[] = [
  {
    title: 'Welcome to EcoSense',
    description: 'Monitor environmental conditions in your area and contribute to community environmental awareness.',
    icon: 'eco',
    color: '#4CAF50',
  },
  {
    title: 'Capture & Analyze',
    description: 'Take photos of your environment and get AI-powered analysis of pollution levels and environmental conditions.',
    icon: 'camera-alt',
    color: '#2196F3',
  },
  {
    title: 'Real-time Data',
    description: 'Access real-time environmental data from multiple sources including air quality, water quality, and local sensors.',
    icon: 'timeline',
    color: '#FF9800',
  },
  {
    title: 'Community Impact',
    description: 'Get personalized recommendations and contribute to community environmental improvement initiatives.',
    icon: 'people',
    color: '#9C27B0',
  },
];

const OnboardingScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const [currentStep, setCurrentStep] = useState(0);
  const [permissionsRequested, setPermissionsRequested] = useState(false);

  const handleNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = async () => {
    try {
      logger.userAction('onboarding_completed', {step: currentStep});

      if (!permissionsRequested) {
        await requestAppPermissions();
      }

      dispatch(setOnboardingComplete(true));
    } catch (error) {
      logger.error('Error completing onboarding:', error);
      // Continue anyway
      dispatch(setOnboardingComplete(true));
    }
  };

  const requestAppPermissions = async () => {
    try {
      setPermissionsRequested(true);
      logger.userAction('permissions_request_initiated');

      const results = await requestPermissions();
      
      logger.userAction('permissions_request_completed', results);
    } catch (error) {
      logger.error('Error requesting permissions:', error);
    }
  };

  const renderStep = (step: OnboardingStep, index: number) => (
    <View key={index} style={styles.stepContainer}>
      <View style={[styles.iconContainer, {backgroundColor: step.color}]}>
        <Icon name={step.icon} size={64} color="#FFFFFF" />
      </View>
      
      <Text style={styles.stepTitle}>{step.title}</Text>
      <Text style={styles.stepDescription}>{step.description}</Text>
    </View>
  );

  const renderPagination = () => (
    <View style={styles.pagination}>
      {onboardingSteps.map((_, index) => (
        <View
          key={index}
          style={[
            styles.paginationDot,
            index === currentStep && styles.paginationDotActive,
          ]}
        />
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        contentOffset={{x: currentStep * width, y: 0}}>
        {onboardingSteps.map((step, index) => (
          <View key={index} style={styles.slide}>
            {renderStep(step, index)}
          </View>
        ))}
      </ScrollView>

      {renderPagination()}

      <View style={styles.navigation}>
        <TouchableOpacity
          style={[styles.navButton, styles.skipButton]}
          onPress={handleSkip}>
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>

        <View style={styles.navButtonsRight}>
          {currentStep > 0 && (
            <TouchableOpacity
              style={[styles.navButton, styles.previousButton]}
              onPress={handlePrevious}>
              <Icon name="chevron-left" size={24} color="#666666" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.navButton, styles.nextButton]}
            onPress={handleNext}>
            {currentStep === onboardingSteps.length - 1 ? (
              <Text style={styles.nextButtonText}>Get Started</Text>
            ) : (
              <>
                <Text style={styles.nextButtonText}>Next</Text>
                <Icon name="chevron-right" size={24} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  slide: {
    width,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  stepContainer: {
    alignItems: 'center',
    maxWidth: 300,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 16,
  },
  stepDescription: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: '#2E7D32',
    width: 24,
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 32,
  },
  navButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  skipButton: {
    backgroundColor: 'transparent',
  },
  skipButtonText: {
    fontSize: 16,
    color: '#666666',
  },
  navButtonsRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previousButton: {
    backgroundColor: '#F5F5F5',
    marginRight: 12,
  },
  nextButton: {
    backgroundColor: '#2E7D32',
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default OnboardingScreen;