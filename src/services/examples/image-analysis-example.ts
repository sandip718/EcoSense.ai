/**
 * Example usage of the Image Analysis Service
 * This demonstrates how to use the core functionality for image upload and analysis
 */

import { ImageAnalysisService } from '../ImageAnalysisService';
import { ImageStorageService } from '../ImageStorageService';
import { AIAnalysisService } from '../AIAnalysisService';
import { logger } from '../../utils/logger';

async function demonstrateImageAnalysis() {
  try {
    console.log('🌍 EcoSense.ai Image Analysis Service Demo');
    console.log('==========================================\n');

    // Initialize services
    const imageAnalysisService = new ImageAnalysisService();
    const imageStorageService = new ImageStorageService();
    const aiAnalysisService = new AIAnalysisService();

    // Example 1: Create a new image analysis record
    console.log('1. Creating image analysis record...');
    const imageAnalysis = await imageAnalysisService.createImageAnalysis({
      userId: 'demo-user-123',
      imageUrl: 'https://example.com/environmental-photo.jpg',
      location: {
        latitude: 40.7128,
        longitude: -74.0060,
        address: 'New York, NY'
      },
      uploadTimestamp: new Date(),
      originalFilename: 'environmental-photo.jpg',
      fileSize: 2048000, // 2MB
      mimeType: 'image/jpeg'
    });

    console.log(`✅ Created image analysis: ${imageAnalysis.id}`);
    console.log(`   Status: ${imageAnalysis.status}`);
    console.log(`   Image URL: ${imageAnalysis.image_url}`);
    console.log(`   Location: ${imageAnalysis.location?.latitude}, ${imageAnalysis.location?.longitude}\n`);

    // Example 2: Process the image analysis (this would normally be async)
    console.log('2. Processing image analysis...');
    await imageAnalysisService.processImageAnalysis(imageAnalysis.id);
    
    // Get the updated analysis
    const processedAnalysis = await imageAnalysisService.getImageAnalysis(imageAnalysis.id);
    if (processedAnalysis) {
      console.log(`✅ Analysis completed with status: ${processedAnalysis.status}`);
      console.log(`   Overall score: ${processedAnalysis.overall_score}`);
      console.log(`   Recommendations: ${processedAnalysis.analysis_results.recommendations.length} items\n`);
    }

    // Example 3: Demonstrate AI analysis directly
    console.log('3. Direct AI analysis example...');
    const directAnalysis = await aiAnalysisService.analyzeEnvironmentalImage(
      'https://example.com/water-quality-test.jpg',
      { latitude: 37.7749, longitude: -122.4194, address: 'San Francisco, CA' }
    );

    console.log('✅ AI Analysis Results:');
    console.log(`   Overall Score: ${directAnalysis.overall_score}`);
    
    if (directAnalysis.pollution_indicators.air_quality) {
      console.log(`   Air Quality - Smog Density: ${directAnalysis.pollution_indicators.air_quality.smog_density}`);
      console.log(`   Air Quality - Visibility: ${directAnalysis.pollution_indicators.air_quality.visibility}`);
    }
    
    if (directAnalysis.pollution_indicators.water_quality) {
      console.log(`   Water Quality - Turbidity: ${directAnalysis.pollution_indicators.water_quality.turbidity}`);
      console.log(`   Water Quality - Color Index: ${directAnalysis.pollution_indicators.water_quality.color_index}`);
    }
    
    if (directAnalysis.pollution_indicators.visual_contamination) {
      console.log(`   Visual Contamination: ${directAnalysis.pollution_indicators.visual_contamination.detected ? 'Detected' : 'Not detected'}`);
      if (directAnalysis.pollution_indicators.visual_contamination.detected) {
        console.log(`   Contamination Type: ${directAnalysis.pollution_indicators.visual_contamination.type}`);
      }
    }

    console.log(`   Recommendations:`);
    directAnalysis.recommendations.forEach((rec, index) => {
      console.log(`     ${index + 1}. ${rec}`);
    });
    console.log();

    // Example 4: Image storage validation
    console.log('4. Image validation example...');
    const testImageBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]); // JPEG header
    const validationResult = imageStorageService.validateImage(testImageBuffer, 'test.jpg');
    
    console.log(`✅ Image validation result: ${validationResult.isValid ? 'Valid' : 'Invalid'}`);
    if (validationResult.error) {
      console.log(`   Error: ${validationResult.error}`);
    }
    console.log();

    // Example 5: Get user analysis statistics
    console.log('5. User analysis statistics...');
    const stats = await imageAnalysisService.getUserAnalysisStats('demo-user-123');
    console.log('✅ User Statistics:');
    console.log(`   Total analyses: ${stats.total}`);
    console.log(`   Completed: ${stats.completed}`);
    console.log(`   Pending: ${stats.pending}`);
    console.log(`   Failed: ${stats.failed}`);
    if (stats.averageScore !== undefined) {
      console.log(`   Average score: ${stats.averageScore.toFixed(2)}`);
    }
    console.log();

    // Example 6: AI service configuration
    console.log('6. AI service configuration...');
    const aiConfig = aiAnalysisService.getConfig();
    console.log('✅ AI Configuration:');
    console.log(`   Model version: ${aiConfig.modelVersion}`);
    console.log(`   Confidence threshold: ${aiConfig.confidenceThreshold}`);
    console.log(`   Enabled indicators:`);
    console.log(`     - Air quality: ${aiConfig.enabledIndicators.airQuality}`);
    console.log(`     - Water quality: ${aiConfig.enabledIndicators.waterQuality}`);
    console.log(`     - Visual contamination: ${aiConfig.enabledIndicators.visualContamination}`);
    
    const supportedTypes = aiAnalysisService.getSupportedAnalysisTypes();
    console.log(`   Supported analysis types: ${supportedTypes.join(', ')}`);
    console.log();

    // Example 7: Batch processing simulation
    console.log('7. Batch processing example...');
    const pendingAnalyses = await imageAnalysisService.getPendingAnalyses(3);
    console.log(`✅ Found ${pendingAnalyses.length} pending analyses for batch processing`);
    
    if (pendingAnalyses.length > 0) {
      console.log('   Processing batch...');
      await imageAnalysisService.processPendingAnalysesBatch(3);
      console.log('   ✅ Batch processing completed');
    }
    console.log();

    console.log('🎉 Image Analysis Service demo completed successfully!');
    console.log('==========================================');

  } catch (error) {
    console.error('❌ Error in image analysis demo:', error);
    logger.error('Image analysis demo error:', error);
  }
}

// Example of how to handle image upload in a real application
export async function handleImageUpload(
  imageBuffer: Buffer,
  filename: string,
  userId: string,
  location?: { latitude: number; longitude: number; address?: string }
): Promise<{ success: boolean; analysisId?: string; error?: string }> {
  try {
    const imageStorageService = new ImageStorageService();
    const imageAnalysisService = new ImageAnalysisService();

    // Validate the image
    const validation = imageStorageService.validateImage(imageBuffer, filename);
    if (!validation.isValid) {
      return { success: false, error: validation.error || 'Validation failed' };
    }

    // Store the image
    const imageUrl = await imageStorageService.storeImage(imageBuffer, filename);

    // Create analysis record
    const analysis = await imageAnalysisService.createImageAnalysis({
      userId,
      imageUrl,
      location,
      uploadTimestamp: new Date(),
      originalFilename: filename,
      fileSize: imageBuffer.length,
      mimeType: getMimeTypeFromFilename(filename)
    });

    // Start async processing
    imageAnalysisService.processImageAnalysis(analysis.id).catch(error => {
      logger.error('Error in async image processing:', error);
    });

    return { success: true, analysisId: analysis.id };

  } catch (error) {
    logger.error('Error handling image upload:', error);
    return { success: false, error: 'Failed to process image upload' };
  }
}

// Helper function to determine MIME type from filename
function getMimeTypeFromFilename(filename: string): string {
  const extension = filename.toLowerCase().split('.').pop();
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateImageAnalysis().catch(console.error);
}

export { demonstrateImageAnalysis };