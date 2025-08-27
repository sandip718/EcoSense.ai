// Location Redux Slice
// Implements requirement 10.2: Location services integration

import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';
import {LocationService} from '@/services/LocationService';
import {Location} from '@/types/api';

interface LocationState {
  currentLocation: Location | null;
  locationPermission: 'granted' | 'denied' | 'not_requested';
  isLocationEnabled: boolean;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

const initialState: LocationState = {
  currentLocation: null,
  locationPermission: 'not_requested',
  isLocationEnabled: false,
  loading: false,
  error: null,
  lastUpdated: null,
};

// Async thunks
export const getCurrentLocation = createAsyncThunk(
  'location/getCurrentLocation',
  async (_, {rejectWithValue}) => {
    try {
      const location = await LocationService.getCurrentLocation();
      return location;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const requestLocationPermission = createAsyncThunk(
  'location/requestPermission',
  async (_, {rejectWithValue}) => {
    try {
      const permission = await LocationService.requestPermission();
      return permission;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const startLocationTracking = createAsyncThunk(
  'location/startTracking',
  async (_, {rejectWithValue}) => {
    try {
      await LocationService.startTracking();
      return true;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const stopLocationTracking = createAsyncThunk(
  'location/stopTracking',
  async (_, {rejectWithValue}) => {
    try {
      await LocationService.stopTracking();
      return true;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const locationSlice = createSlice({
  name: 'location',
  initialState,
  reducers: {
    setCurrentLocation: (state, action: PayloadAction<Location>) => {
      state.currentLocation = action.payload;
      state.lastUpdated = new Date();
    },
    setLocationPermission: (state, action: PayloadAction<'granted' | 'denied' | 'not_requested'>) => {
      state.locationPermission = action.payload;
    },
    setLocationEnabled: (state, action: PayloadAction<boolean>) => {
      state.isLocationEnabled = action.payload;
    },
    clearLocationError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Get current location
    builder
      .addCase(getCurrentLocation.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getCurrentLocation.fulfilled, (state, action) => {
        state.loading = false;
        state.currentLocation = action.payload;
        state.lastUpdated = new Date();
        state.error = null;
      })
      .addCase(getCurrentLocation.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Request permission
    builder
      .addCase(requestLocationPermission.pending, (state) => {
        state.loading = true;
      })
      .addCase(requestLocationPermission.fulfilled, (state, action) => {
        state.loading = false;
        state.locationPermission = action.payload ? 'granted' : 'denied';
      })
      .addCase(requestLocationPermission.rejected, (state, action) => {
        state.loading = false;
        state.locationPermission = 'denied';
        state.error = action.payload as string;
      });

    // Start tracking
    builder
      .addCase(startLocationTracking.fulfilled, (state) => {
        state.isLocationEnabled = true;
      })
      .addCase(startLocationTracking.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    // Stop tracking
    builder
      .addCase(stopLocationTracking.fulfilled, (state) => {
        state.isLocationEnabled = false;
      });
  },
});

export const {
  setCurrentLocation,
  setLocationPermission,
  setLocationEnabled,
  clearLocationError,
} = locationSlice.actions;

export default locationSlice.reducer;