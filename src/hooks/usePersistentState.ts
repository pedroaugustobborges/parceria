import { useState, useEffect, Dispatch, SetStateAction } from 'react';

/**
 * Custom hook that persists state in sessionStorage
 * State is preserved when navigating between tabs but cleared when browser closes
 *
 * @param key - Unique key for sessionStorage
 * @param initialValue - Initial value if no persisted value exists
 * @returns [state, setState] tuple like useState
 */
export function usePersistentState<T>(
  key: string,
  initialValue: T
): [T, Dispatch<SetStateAction<T>>] {
  // Get initial state from sessionStorage or use initialValue
  const [state, setState] = useState<T>(() => {
    try {
      const item = sessionStorage.getItem(key);
      if (item) {
        // Parse stored JSON
        const parsed = JSON.parse(item);

        // Debug log for acessos specifically
        if (key === 'dashboard_acessos' && Array.isArray(parsed)) {
          console.log(`📥 Loaded dashboard_acessos from storage: ${parsed.length} records`);
        }

        // Handle Date objects specially
        if (key.includes('Data') && parsed) {
          return parsed ? new Date(parsed) : initialValue;
        }

        return parsed ?? initialValue;
      }

      // Debug: no data found in storage
      if (key === 'dashboard_acessos') {
        console.log('📭 No dashboard_acessos found in sessionStorage');
      }

      return initialValue;
    } catch (error) {
      console.error(`❌ Error loading persisted state for key "${key}":`, error);
      return initialValue;
    }
  });

  // Save to sessionStorage whenever state changes
  useEffect(() => {
    try {
      const valueToStore = state instanceof Date ? state.toISOString() : state;
      const jsonString = JSON.stringify(valueToStore);

      // Check size before saving (warn if > 2MB)
      const sizeKB = jsonString.length / 1024;
      if (sizeKB > 2048) {
        console.warn(`Large data for key "${key}": ${sizeKB.toFixed(2)} KB. Consider pagination or compression.`);
      }

      sessionStorage.setItem(key, jsonString);

      // Debug log for acessos specifically
      if (key === 'dashboard_acessos' && Array.isArray(valueToStore)) {
        console.log(`✅ Saved dashboard_acessos: ${valueToStore.length} records, ${sizeKB.toFixed(2)} KB`);
      }
    } catch (error) {
      console.error(`❌ Error saving persisted state for key "${key}":`, error);

      // If quota exceeded, try to clear old data
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.error('SessionStorage quota exceeded! Clearing old dashboard data...');
        try {
          // Clear all dashboard keys except the current one
          const dashboardKeys = Object.keys(sessionStorage).filter(
            k => k.startsWith('dashboard_') && k !== key
          );
          dashboardKeys.forEach(k => sessionStorage.removeItem(k));

          // Try saving again
          sessionStorage.setItem(key, JSON.stringify(state instanceof Date ? state.toISOString() : state));
          console.log('✅ Saved after clearing old data');
        } catch (retryError) {
          console.error('❌ Still failed after clearing:', retryError);
        }
      }
    }
  }, [key, state]);

  return [state, setState];
}

/**
 * Custom hook for persisting arrays in sessionStorage
 * Optimized for array types
 */
export function usePersistentArray<T>(
  key: string,
  initialValue: T[] = []
): [T[], Dispatch<SetStateAction<T[]>>] {
  return usePersistentState<T[]>(key, initialValue);
}

/**
 * Hook to clear all persisted Dashboard state
 * Useful for "reset filters" functionality
 */
export function useClearDashboardState() {
  return () => {
    const dashboardKeys = Object.keys(sessionStorage).filter(
      key => key.startsWith('dashboard_')
    );
    dashboardKeys.forEach(key => sessionStorage.removeItem(key));
  };
}
