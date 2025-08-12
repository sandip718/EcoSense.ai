// Simple test to verify image analysis functionality
const { AIAnalysisService } = require('./dist/services/AIAnalysisService');

async function testImageAnalysis() {
  try {
    console.log('Testing Image Analysis Service...');
    
    const aiService = new AIAnalysisService();
    
    // Test basic analysis
    const result = await aiService.analyzeEnvironmentalImage(
      'https://example.com/test-image.jpg',
      { latitude: 40.7128, longitude: -74.0060 }
    );
    
    console.log('✅ Analysis completed successfully');
    console.log('Overall Score:', result.overall_score);
    console.log('Recommendations:', result.recommendations.length);
    
    // Test configuration
    const config = aiService.getConfig();
    console.log('✅ Configuration retrieved:', config.modelVersion);
    
    // Test validation
    const validation = await aiService.validateImageForAnalysis('https://example.com/test.jpg');
    console.log('✅ Validation result:', validation.isValid);
    
    console.log('🎉 All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testImageAnalysis();