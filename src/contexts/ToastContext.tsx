'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import Toast, { ToastProps } from '@/components/Toast';

interface ToastContextType {
  showToast: (toast: Omit<ToastProps, 'id' | 'onClose'>) => void;
  hideToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

interface ToastItem extends Omit<ToastProps, 'id' | 'onClose'> {
  id: string;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((toast: Omit<ToastProps, 'id' | 'onClose'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: ToastItem = { ...toast, id };
    
    setToasts(prev => [...prev, newToast]);
  }, []);

  const hideToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      
              {/* Toast 컨테이너 */}
        <div 
          className="fixed top-0 right-0 p-4 space-y-2"
          style={{
            zIndex: 99999,
            position: 'fixed',
            top: 0,
            right: 0,
            pointerEvents: 'none'
          }}
        >
        {toasts.map((toast, index) => (
          <div
            key={toast.id}
            className="transform transition-all duration-300 ease-in-out"
            style={{
              transform: `translateY(${index * 80}px)`,
            }}
          >
            <Toast
              {...toast}
              onClose={hideToast}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
