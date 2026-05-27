import { create } from 'zustand';
import { Notification } from '../types/notification';

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'read' | 'createdAt'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  notifications: [],
  unreadCount: 0,
  addNotification: (notification) => {
    set((state) => {
      const newNotification: Notification = {
        ...notification,
        read: false,
        createdAt: new Date().toISOString(),
      };
      const updated = [newNotification, ...state.notifications];
      return {
        notifications: updated,
        unreadCount: updated.filter((n) => !n.read).length,
      };
    });
  },
  markRead: (id) => {
    set((state) => {
      const updated = state.notifications.map((n) => {
        if (n.id === id) {
          return { ...n, read: true };
        }
        return n;
      });
      return {
        notifications: updated,
        unreadCount: updated.filter((n) => !n.read).length,
      };
    });
  },
  markAllRead: () => {
    set((state) => {
      const updated = state.notifications.map((n) => ({ ...n, read: true }));
      return {
        notifications: updated,
        unreadCount: 0,
      };
    });
  },
  clearAll: () => {
    set({
      notifications: [],
      unreadCount: 0,
    });
  },
}));
