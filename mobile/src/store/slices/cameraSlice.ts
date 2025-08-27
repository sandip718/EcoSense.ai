// Camera Redux Slice
// Implements requirement 10.2: Camera integration for environmental photo capture

import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';
import {CameraService} from '@/services/CameraService';
import {ImageAnalysis} from '@/types/api';

interface CameraState {
  capturedImages: string[];
  analysisResults: ImageAnalysis[];
  currentAnalysis: ImageAnalysis | null;
  cameraPermission: 'granted' | 'denied' | 'not_requested';
  loading: boolean;
  analyzing: boolean;
  error: string | null;
}

const initialState: CameraState = {
  capturedImages: [],
  analysisResults: [],
  currentAnalysis: null,
  cameraPermission: 'not_requested',
  loading: false,
  analyzing: false,
  error: null,
};

// Async thunks
export const requestCameraPermission = createAsyncThunk(
  'camera/requestPermission',
  async (_, {rejectWithValue}) => {
    try {
      const permission = await CameraService.requestPermission();
      return permission;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const captureImage = createAsyncThunk(
  'camera/captureImage',
  async (options: any, {rejectWithValue}) => {
    try {
      const imageUri = await CameraService.captureImage(options);
      return imageUri;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const analyzeImage = createAsyncThunk(
  'camera/analyzeImage',
  async (params: {imageUri: string; location?: any}, {rejectWithValue}) => {
    try {
      const analysis = await CameraService.analyzeImage(params.imageUri, params.location);
      return analysis;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const uploadImage = createAsyncThunk(
  'camera/uploadImage',
  async (params: {imageUri: string; location?: any; metadata?: any}, {rejectWithValue}) => {
    try {
      const result = await CameraService.uploadImage(
        params.imageUri,
        params.location,
        params.metadata
      );
      return result;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const cameraSlice = createSlice({
  name: 'camera',
  initialState,
  reducers: {
    setCameraPermission: (state, action: PayloadAction<'granted' | 'denied' | 'not_requested'>) => {
      state.cameraPermission = action.payload;
    },
    addCapturedImage: (state, action: PayloadAction<string>) => {
      state.capturedImages.push(action.payload);
    },
    removeCapturedImage: (state, action: PayloadAction<string>) => {
      state.capturedImages = state.capturedImages.filter(uri => uri !== action.payload);
    },
    setCurrentAnalysis: (state, action: PayloadAction<ImageAnalysis | null>) => {
      state.currentAnalysis = action.payload;
    },
    clearCameraError: (state) => {
      state.error = null;
    },
    clearCapturedImages: (state) => {
      state.capturedImages = [];
    },
  },
  extraReducers: (builder) => {
    // Request camera permission
    builder
      .addCase(requestCameraPermission.pending, (state) => {
        state.loading = true;
      })
      .addCase(requestCameraPermission.fulfilled, (state, action) => {
        state.loading = false;
        state.cameraPermission = action.payload ? 'granted' : 'denied';
      })
      .addCase(requestCameraPermission.rejected, (state, action) => {
        state.loading = false;
        state.cameraPermission = 'denied';
        state.error = action.payload as string;
      });

    // Capture image
    builder
      .addCase(captureImage.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(captureImage.fulfilled, (state, action) => {
        state.loading = false;
        state.capturedImages.push(action.payload);
        state.error = null;
      })
      .addCase(captureImage.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Analyze image
    builder
      .addCase(analyzeImage.pending, (state) => {
        state.analyzing = true;
        state.error = null;
      })
      .addCase(analyzeImage.fulfilled, (state, action) => {
        state.analyzing = false;
        state.currentAnalysis = action.payload;
        state.analysisResults.push(action.payload);
        state.error = null;
      })
      .addCase(analyzeImage.rejected, (state, action) => {
        state.analyzing = false;
        state.error = action.payload as string;
      });

    // Upload image
    builder
      .addCase(uploadImage.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(uploadImage.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
      })
      .addCase(uploadImage.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  setCameraPermission,
  addCapturedImage,
  removeCapturedImage,
  setCurrentAnalysis,
  clearCameraError,
  clearCapturedImages,
} = cameraSlice.actions;

export default cameraSlice.reducer;