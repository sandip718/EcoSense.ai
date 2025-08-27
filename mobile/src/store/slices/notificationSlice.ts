// Notifications Redux Slice

import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';
import {NotificationService, NotificationHistory} from '@/services/NotificationService';
import {NotificationPreferences} from '@/services/PushNotificationService';
import {Notification} from '@/types/api';

interface NotificationState {
  notifications: Notification[];
  history: NotificationHistory[];
  preferences: NotificationPreferences | null;
  unreadCount: number;
  loading: boolean;
  error: string | null;
  fcmToken: string | null;
}

const initialState: NotificationState = {
  notifications: [],
  history: [],
  preferences: null,
  unreadCount: 0,
  loading: false,
  error: null,
  fcmToken: null,
};

// Async thunks
export const fetchNotifications = createAsyncThunk(
  'notifications/fetchNotifications',
  async (_, {rejectWithValue}) => {
    try {
      const notifications = await NotificationService.getNotifications();
      return notifications;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const markNotificationAsRead = createAsyncThunk(
  'notifications/markAsRead',
  async (notificationId: string, {rejectWithValue}) => {
    try {
      await NotificationService.markAsRead(notificationId);
      return notificationId;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const markAllAsRead = createAsyncThunk(
  'notifications/markAllAsRead',
  async (_, {rejectWithValue}) => {
    try {
      await NotificationService.markAllAsRead();
      return true;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchNotificationHistory = createAsyncThunk(
  'notifications/fetchHistory',
  async (_, {rejectWithValue}) => {
    try {
      const history = NotificationService.getNotificationHistory();
      return history;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchNotificationPreferences = createAsyncThunk(
  'notifications/fetchPreferences',
  async (_, {rejectWithValue}) => {
    try {
      const preferences = NotificationService.getNotificationPreferences();
      return preferences;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateNotificationPreferences = createAsyncThunk(
  'notifications/updatePreferences',
  async (preferences: NotificationPreferences, {rejectWithValue}) => {
    try {
      await NotificationService.updateNotificationPreferences(preferences);
      return preferences;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const initializeNotifications = createAsyncThunk(
  'notifications/initialize',
  async (_, {rejectWithValue}) => {
    try {
      await NotificationService.initialize();
      const token = NotificationService.getFCMToken();
      const preferences = NotificationService.getNotificationPreferences();
      const history = NotificationService.getNotificationHistory();
      
      return {
        token,
        preferences,
        history,
      };
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    addNotification: (state, action: PayloadAction<Notification>) => {
      state.notifications.unshift(action.payload);
      if (!action.payload.read_at) {
        state.unreadCount += 1;
      }
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find(n => n.id === action.payload);
      if (notification && !notification.read_at) {
        state.unreadCount -= 1;
      }
      state.notifications = state.notifications.filter(n => n.id !== action.payload);
    },
    clearNotifications: (state) => {
      state.notifications = [];
      state.unreadCount = 0;
    },
    clearNotificationError: (state) => {
      state.error = null;
    },
    updateFCMToken: (state, action: PayloadAction<string>) => {
      state.fcmToken = action.payload;
    },
    addToHistory: (state, action: PayloadAction<NotificationHistory>) => {
      state.history.unshift(action.payload);
      if (!action.payload.readAt) {
        state.unreadCount += 1;
      }
    },
    markHistoryAsRead: (state, action: PayloadAction<string>) => {
      const item = state.history.find(h => h.id === action.payload);
      if (item && !item.readAt) {
        item.readAt = new Date();
        state.unreadCount -= 1;
      }
    },
  },
  extraReducers: (builder) => {
    // Fetch notifications
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.notifications = action.payload;
        state.unreadCount = action.payload.filter(n => !n.read_at).length;
        state.error = null;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Mark as read
    builder
      .addCase(markNotificationAsRead.fulfilled, (state, action) => {
        const notification = state.notifications.find(n => n.id === action.payload);
        if (notification && !notification.read_at) {
          notification.read_at = new Date();
          state.unreadCount -= 1;
        }
      })
      .addCase(markNotificationAsRead.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    // Mark all as read
    builder
      .addCase(markAllAsRead.fulfilled, (state) => {
        state.notifications.forEach(notification => {
          if (!notification.read_at) {
            notification.read_at = new Date();
          }
        });
        state.unreadCount = 0;
      })
      .addCase(markAllAsRead.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    // Fetch notification history
    builder
      .addCase(fetchNotificationHistory.fulfilled, (state, action) => {
        state.history = action.payload;
        state.unreadCount = action.payload.filter(h => !h.readAt).length;
      })
      .addCase(fetchNotificationHistory.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    // Fetch notification preferences
    builder
      .addCase(fetchNotificationPreferences.fulfilled, (state, action) => {
        state.preferences = action.payload;
      })
      .addCase(fetchNotificationPreferences.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    // Update notification preferences
    builder
      .addCase(updateNotificationPreferences.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateNotificationPreferences.fulfilled, (state, action) => {
        state.loading = false;
        state.preferences = action.payload;
      })
      .addCase(updateNotificationPreferences.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Initialize notifications
    builder
      .addCase(initializeNotifications.pending, (state) => {
        state.loading = true;
      })
      .addCase(initializeNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.fcmToken = action.payload.token;
        state.preferences = action.payload.preferences;
        state.history = action.payload.history;
        state.unreadCount = action.payload.history.filter(h => !h.readAt).length;
      })
      .addCase(initializeNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  addNotification,
  removeNotification,
  clearNotifications,
  clearNotificationError,
  updateFCMToken,
  addToHistory,
  markHistoryAsRead,
} = notificationSlice.actions;

export default notificationSlice.reducer;