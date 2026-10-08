// High-performance, bulletproof Back Navigation Stack for mobile & desktop
// Handles nested modals (e.g. List -> Profile -> Calculator) seamlessly.

type BackHandler = () => void;

interface StackItem {
  id: string;
  handler: BackHandler;
  pushedHistory: boolean;
}

const handlerStack: StackItem[] = [];
let suppressPopStateCount = 0;
let isExecutingPopState = false;

export function registerBackHandler(id: string, handler: BackHandler): () => void {
  // If already registered with this ID, update handler
  const existingIdx = handlerStack.findIndex(h => h.id === id);
  if (existingIdx !== -1) {
    handlerStack[existingIdx].handler = handler;
    return () => {
      unregister(id);
    };
  }

  let pushedHistory = false;
  try {
    window.history.pushState({ modalId: id, depth: handlerStack.length + 1 }, '');
    pushedHistory = true;
  } catch {}

  handlerStack.push({ id, handler, pushedHistory });

  return () => {
    unregister(id);
  };
}

function unregister(id: string) {
  const idx = handlerStack.findIndex(h => h.id === id);
  if (idx !== -1) {
    const item = handlerStack[idx];
    handlerStack.splice(idx, 1);
    
    // If modal was closed programmatically (via UI button, X, or in-app swipe, NOT browser popstate),
    // we must revert the history state we pushed, BUT suppress the resulting popstate event
    // so it does NOT cascade and close the parent modal!
    if (item.pushedHistory && !isExecutingPopState) {
      suppressPopStateCount++;
      try {
        window.history.back();
      } catch {
        suppressPopStateCount = Math.max(0, suppressPopStateCount - 1);
      }
    }
  }
}

export function handleGlobalBack(): boolean {
  if (handlerStack.length > 0) {
    const top = handlerStack.pop();
    if (top) {
      isExecutingPopState = true;
      try {
        top.handler();
      } catch (err) {
        console.error("Error in back handler:", err);
      } finally {
        setTimeout(() => {
          isExecutingPopState = false;
        }, 120);
      }
      return true;
    }
  }
  return false;
}

// Global popstate listener for Android physical/gesture back button & browser back button
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    // If this popstate was triggered by our own window.history.back() during programmatic modal close,
    // SUPPRESS IT completely so it does not trigger the parent modal!
    if (suppressPopStateCount > 0) {
      suppressPopStateCount--;
      return;
    }

    // Real system back button or browser back gesture pressed by user:
    handleGlobalBack();
  });
}
