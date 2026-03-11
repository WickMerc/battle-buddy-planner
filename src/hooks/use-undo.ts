import { useState, useCallback, useEffect, useRef } from "react";

interface UndoState<T> {
  past: T[];
  present: T;
  future: T[];
}

export function useUndo<T>(initialState: T) {
  const [state, setState] = useState<UndoState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const set = useCallback((newPresent: T | ((prev: T) => T)) => {
    setState(prev => {
      const resolved = typeof newPresent === "function"
        ? (newPresent as (prev: T) => T)(prev.present)
        : newPresent;
      // Don't push if identical reference
      if (resolved === prev.present) return prev;
      return {
        past: [...prev.past.slice(-50), prev.present],
        present: resolved,
        future: [],
      };
    });
  }, []);

  const undo = useCallback(() => {
    setState(prev => {
      if (prev.past.length === 0) return prev;
      const newPast = [...prev.past];
      const previous = newPast.pop()!;
      return {
        past: newPast,
        present: previous,
        future: [prev.present, ...prev.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState(prev => {
      if (prev.future.length === 0) return prev;
      const newFuture = [...prev.future];
      const next = newFuture.shift()!;
      return {
        past: [...prev.past, prev.present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  return {
    state: state.present,
    set,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
