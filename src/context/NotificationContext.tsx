'use client';
import { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react';

export type NotifType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotifType;
  title: string;
  message?: string;
  read: boolean;
  timestamp: Date;
}

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  notify: (type: NotifType, title: string, message?: string) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
  // Toast-style ephemeral notifications
  toasts: Notification[];
  dismissToast: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toasts, setToasts] = useState<Notification[]>([]);
  const toastTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const notify = useCallback((type: NotifType, title: string, message?: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const notif: Notification = { id, type, title, message, read: false, timestamp: new Date() };

    // Add to persistent list
    setNotifications(prev => [notif, ...prev].slice(0, 100));

    // Add as toast (ephemeral)
    setToasts(prev => [notif, ...prev].slice(0, 5));

    // Auto-dismiss toast after 4s
    toastTimers.current[id] = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      delete toastTimers.current[id];
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    if (toastTimers.current[id]) {
      clearTimeout(toastTimers.current[id]);
      delete toastTimers.current[id];
    }
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, notify, markRead, markAllRead, clearAll, toasts, dismissToast }}>
      {children}
    </NotificationContext.Provider>
  );
}
