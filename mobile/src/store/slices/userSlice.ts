// User Profile Redux Slice

import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';
import {UserService} from '@/services/UserService';
import {UserProfile, UserPreferences} from '@/types/api';

interface UserState {
  profile: UserProfile | null;
  hasCompletedOnboarding: boolean;
  preferences: UserPreferences;
  loading: boolean;
  error: string | null;
}

const initialState: UserState = {
  profile: null,
  hasCompletedOnboarding: false,
  preferences: {
    notifications: true,
    activity_types: [],
    health_conditions: [],
    notification_radius: 10,
    preferred_units: {
      temperature: 'celsius',
      distance: 'metric',
    },
  },
  loading: false,
  error: null,
};

// Async thunks
export const fetchUserProfile = createAsyncThunk(
  'user/fetchProfile',
  async (_, {rejectWithValue}) => {
    try {
      const profile = await UserService.getProfile();
      return profile;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateUserProfile = createAsyncThunk(
  'user/updateProfile',
  async (updates: Partial<UserProfile>, {rejectWithValue}) => {
    try {
      const updatedProfile = await UserService.updateProfile(updates);
      return updatedProfile;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateUserPreferences = createAsyncThunk(
  'user/updatePreferences',
  async (preferences: Partial<UserPreferences>, {rejectWithValue}) => {
    try {
      const updatedPreferences = await UserService.updatePreferences(preferences);
      return updatedPreferences;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setOnboardingComplete: (state, action: PayloadAction<boolean>) => {
      state.hasCompletedOnboarding = action.payload;
    },
    setUserPreferences: (state, action: PayloadAction<Partial<UserPreferences>>) => {
      state.preferences = {...state.preferences, ...action.payload};
    },
    clearUserError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch user profile
    builder
      .addCase(fetchUserProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.profile = action.payload;
        state.preferences = action.payload.preferences;
        state.error = null;
      })
      .addCase(fetchUserProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Update user profile
    builder
      .addCase(updateUserProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateUserProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.profile = action.payload;
        state.error = null;
      })
      .addCase(updateUserProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Update user preferences
    builder
      .addCase(updateUserPreferences.fulfilled, (state, action) => {
        state.preferences = action.payload;
        if (state.profile) {
          state.profile.preferences = action.payload;
        }
      })
      .addCase(updateUserPreferences.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const {
  setOnboardingComplete,
  setUserPreferences,
  clearUserError,
} = userSlice.actions;

export default userSlice.reducer;