import React, {createContext, useContext, useState, useCallback} from 'react';
import {isTV} from './constants';

interface FocusableItem {
  id: string;
  order: number;
}

interface TVFocusContextType {
  focusedElement: string | null;
  setFocusedElement: (id: string | null) => void;
  registerFocusable: (id: string, order: number) => void;
  unregisterFocusable: (id: string) => void;
  focusNext: () => void;
  focusPrevious: () => void;
  focusUp: () => void;
  focusDown: () => void;
}

const TVFocusContext = createContext<TVFocusContextType | null>(null);

export const TVFocusProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const [focusedElement, setFocusedElement] = useState<string | null>(null);
  const [focusableItems, setFocusableItems] = useState<FocusableItem[]>([]);

  const registerFocusable = useCallback((id: string, order: number) => {
    setFocusableItems(prev => {
      const exists = prev.find(item => item.id === id);
      if (exists) {
        return prev;
      }
      return [...prev, {id, order}].sort((a, b) => a.order - b.order);
    });
  }, []);

  const unregisterFocusable = useCallback((id: string) => {
    setFocusableItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const getCurrentIndex = useCallback(() => {
    if (!focusedElement) {
      return -1;
    }
    return focusableItems.findIndex(item => item.id === focusedElement);
  }, [focusedElement, focusableItems]);

  const focusNext = useCallback(() => {
    const currentIndex = getCurrentIndex();
    if (focusableItems.length === 0) {
      return;
    }
    const nextIndex =
      currentIndex === -1 ? 0 : (currentIndex + 1) % focusableItems.length;
    setFocusedElement(focusableItems[nextIndex].id);
  }, [getCurrentIndex, focusableItems]);

  const focusPrevious = useCallback(() => {
    const currentIndex = getCurrentIndex();
    if (focusableItems.length === 0) {
      return;
    }
    const prevIndex =
      currentIndex === -1
        ? focusableItems.length - 1
        : (currentIndex - 1 + focusableItems.length) % focusableItems.length;
    setFocusedElement(focusableItems[prevIndex].id);
  }, [getCurrentIndex, focusableItems]);

  const focusUp = useCallback(() => {
    focusPrevious();
  }, [focusPrevious]);

  const focusDown = useCallback(() => {
    focusNext();
  }, [focusNext]);

  const value: TVFocusContextType = {
    focusedElement,
    setFocusedElement,
    registerFocusable,
    unregisterFocusable,
    focusNext,
    focusPrevious,
    focusUp,
    focusDown,
  };

  return (
    <TVFocusContext.Provider value={value}>{children}</TVFocusContext.Provider>
  );
};

export const useTVFocus = () => {
  const context = useContext(TVFocusContext);
  if (!context) {
    throw new Error('useTVFocus must be used within a TVFocusProvider');
  }
  return context;
};

export const useIsTV = () => isTV;
