import { useState, useCallback } from 'react';

export interface OptimisticState<T> {
  data: T;
  isPending: boolean;
  error: string | null;
}

/**
 * Hook for optimistic UI updates.
 *
 * Immediately applies the optimistic value to the UI (< 200ms visual feedback,
 * Req 19.4), then performs the async operation. On failure, rolls back to the
 * previous value and surfaces the error.
 *
 * Usage:
 * ```tsx
 * const { state, update } = useOptimisticUpdate(initialValue);
 *
 * async function handleConfirm() {
 *   await update(
 *     { ...state.data, confirmed: true },   // optimistic value
 *     () => api.confirmGroup(groupId),       // async operation
 *   );
 * }
 * ```
 */
export function useOptimisticUpdate<T>(initialValue: T) {
  const [state, setState] = useState<OptimisticState<T>>({
    data: initialValue,
    isPending: false,
    error: null,
  });

  const update = useCallback(
    async (optimisticValue: T, asyncOperation: () => Promise<T>) => {
      const previousValue = state.data;

      // Apply optimistic update immediately (< 200ms visual feedback)
      setState({ data: optimisticValue, isPending: true, error: null });

      try {
        const result = await asyncOperation();
        setState({ data: result, isPending: false, error: null });
      } catch (err) {
        // Roll back to previous value on failure
        setState({
          data: previousValue,
          isPending: false,
          error: err instanceof Error ? err.message : 'Something went wrong.',
        });
      }
    },
    [state.data],
  );

  const reset = useCallback((value: T) => {
    setState({ data: value, isPending: false, error: null });
  }, []);

  return { state, update, reset };
}
