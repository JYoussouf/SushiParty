import React, { createContext, useCallback, useContext, useState } from 'react';

export type TransitionType = 'party-intro' | 'none';

interface TransitionContextValue {
  activeTransition: TransitionType | null;
  startTransition: (type: TransitionType, onComplete: () => Promise<void>) => Promise<void>;
  isTransitioning: boolean;
}

const TransitionContext = createContext<TransitionContextValue | null>(null);

export function TransitionProvider({ children }: { children: React.ReactNode }) {
  const [activeTransition, setActiveTransition] = useState<TransitionType | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const startTransition = useCallback(
    async (type: TransitionType, onComplete: () => Promise<void>) => {
      // Prevent overlapping transitions
      if (isTransitioning) {
        return;
      }

      setIsTransitioning(true);
      setActiveTransition(type);

      try {
        // Wait for the screen to load
        await onComplete();
      } finally {
        setActiveTransition(null);
        setIsTransitioning(false);
      }
    },
    [isTransitioning],
  );

  return (
    <TransitionContext.Provider value={{ activeTransition, startTransition, isTransitioning }}>
      {children}
    </TransitionContext.Provider>
  );
}

export function useTransition() {
  const context = useContext(TransitionContext);
  if (!context) {
    throw new Error('useTransition must be used within TransitionProvider');
  }
  return context;
}
