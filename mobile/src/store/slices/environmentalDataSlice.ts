// Environmental Data Redux Slice

import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';
import {EnvironmentalDataService} from '@/services/EnvironmentalDataService';
import {EnvironmentalDataPoint, Location} from '@/types/api';

interface EnvironmentalDataState {
  currentData: EnvironmentalDataPoint[];
  nearbyData: EnvironmentalDataPoint[];
  selectedLocation: Location | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

const initialState: EnvironmentalDataState = {
  currentData: [],
  nearbyData: [],
  selectedLocation: null,
  loading: false,
  error: null,
  lastUpdated: null,
};

// Async thunks
export const fetchEnvironmentalData = createAsyncThunk(
  'environmentalData/fetchData',
  async (params: {location: Location; radius?: number}, {rejectWithValue}) => {
    try {
      const data = await EnvironmentalDataService.getEnvironmentalData(
        params.location,
        params.radius
      );
      return data;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchNearbyData = createAsyncThunk(
  'environmentalData/fetchNearbyData',
  async (params: {location: Location; radius: number}, {rejectWithValue}) => {
    try {
      const data = await EnvironmentalDataService.getNearbyData(
        params.location,
        params.radius
      );
      return data;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const refreshEnvironmentalData = createAsyncThunk(
  'environmentalData/refreshData',
  async (location: Location, {rejectWithValue}) => {
    try {
      const data = await EnvironmentalDataService.getEnvironmentalData(location);
      return data;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const environmentalDataSlice = createSlice({
  name: 'environmentalData',
  initialState,
  reducers: {
    setSelectedLocation: (state, action: PayloadAction<Location>) => {
      state.selectedLocation = action.payload;
    },
    clearEnvironmentalData: (state) => {
      state.currentData = [];
      state.nearbyData = [];
      state.lastUpdated = null;
    },
    clearEnvironmentalError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch environmental data
    builder
      .addCase(fetchEnvironmentalData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchEnvironmentalData.fulfilled, (state, action) => {
        state.loading = false;
        state.currentData = action.payload;
        state.lastUpdated = new Date();
        state.error = null;
      })
      .addCase(fetchEnvironmentalData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Fetch nearby data
    builder
      .addCase(fetchNearbyData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNearbyData.fulfilled, (state, action) => {
        state.loading = false;
        state.nearbyData = action.payload;
        state.error = null;
      })
      .addCase(fetchNearbyData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Refresh environmental data
    builder
      .addCase(refreshEnvironmentalData.fulfilled, (state, action) => {
        state.currentData = action.payload;
        state.lastUpdated = new Date();
      })
      .addCase(refreshEnvironmentalData.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const {
  setSelectedLocation,
  clearEnvironmentalData,
  clearEnvironmentalError,
} = environmentalDataSlice.actions;

export default environmentalDataSlice.reducer;