// Offline Data Redux Slice
// Implements requirement 10.5: Offline data caching

import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';
import {OfflineService} from '@/services/OfflineService';
import {EnvironmentalDataPoint, CommunityRecommendation} from '@/types/api';

interface OfflineState {
  isOnline: boolean;
  cachedEnvironmentalData: EnvironmentalDataPoint[];
  cachedRecommendations: CommunityRecommendation[];
  pendingUploads: any[];
  syncInProgress: boolean;
  lastSyncTime: Date | null;
  cacheSize: number;
  error: string | null;
}

const initialState: OfflineState = {
  isOnline: true,
  cachedEnvironmentalData: [],
  cachedRecommendations: [],
  pendingUploads: [],
  syncInProgress: false,
  lastSyncTime: null,
  cacheSize: 0,
  error: null,
};

// Async thunks
export const syncOfflineData = createAsyncThunk(
  'offline/syncData',
  async (_, {rejectWithValue}) => {
    try {
      const result = await OfflineService.syncPendingData();
      return result;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const cacheEnvironmentalData = createAsyncThunk(
  'offline/cacheEnvironmentalData',
  async (data: EnvironmentalDataPoint[], {rejectWithValue}) => {
    try {
      await OfflineService.cacheEnvironmentalData(data);
      return data;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const getCachedData = createAsyncThunk(
  'offline/getCachedData',
  async (_, {rejectWithValue}) => {
    try {
      const data = await OfflineService.getCachedData();
      return data;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const addPendingUpload = createAsyncThunk(
  'offline/addPendingUpload',
  async (uploadData: any, {rejectWithValue}) => {
    try {
      await OfflineService.addPendingUpload(uploadData);
      return uploadData;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const clearCache = createAsyncThunk(
  'offline/clearCache',
  async (_, {rejectWithValue}) => {
    try {
      await OfflineService.clearCache();
      return true;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const offlineSlice = createSlice({
  name: 'offline',
  initialState,
  reducers: {
    setOnlineStatus: (state, action: PayloadAction<boolean>) => {
      state.isOnline = action.payload;
    },
    updateCacheSize: (state, action: PayloadAction<number>) => {
      state.cacheSize = action.payload;
    },
    removePendingUpload: (state, action: PayloadAction<string>) => {
      state.pendingUploads = state.pendingUploads.filter(
        upload => upload.id !== action.payload
      );
    },
    clearOfflineError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Sync offline data
    builder
      .addCase(syncOfflineData.pending, (state) => {
        state.syncInProgress = true;
        state.error = null;
      })
      .addCase(syncOfflineData.fulfilled, (state, action) => {
        state.syncInProgress = false;
        state.lastSyncTime = new Date();
        state.pendingUploads = action.payload.remainingUploads || [];
        state.error = null;
      })
      .addCase(syncOfflineData.rejected, (state, action) => {
        state.syncInProgress = false;
        state.error = action.payload as string;
      });

    // Cache environmental data
    builder
      .addCase(cacheEnvironmentalData.fulfilled, (state, action) => {
        state.cachedEnvironmentalData = action.payload;
      })
      .addCase(cacheEnvironmentalData.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    // Get cached data
    builder
      .addCase(getCachedData.fulfilled, (state, action) => {
        state.cachedEnvironmentalData = action.payload.environmentalData || [];
        state.cachedRecommendations = action.payload.recommendations || [];
        state.pendingUploads = action.payload.pendingUploads || [];
      })
      .addCase(getCachedData.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    // Add pending upload
    builder
      .addCase(addPendingUpload.fulfilled, (state, action) => {
        state.pendingUploads.push(action.payload);
      })
      .addCase(addPendingUpload.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    // Clear cache
    builder
      .addCase(clearCache.fulfilled, (state) => {
        state.cachedEnvironmentalData = [];
        state.cachedRecommendations = [];
        state.pendingUploads = [];
        state.cacheSize = 0;
        state.lastSyncTime = null;
      })
      .addCase(clearCache.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const {
  setOnlineStatus,
  updateCacheSize,
  removePendingUpload,
  clearOfflineError,
} = offlineSlice.actions;

export default offlineSlice.reducer;