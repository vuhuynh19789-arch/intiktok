import { useEffect, useRef, useState, useCallback } from 'react';

interface SwipeToDismissOptions {
  onClose: () => void;
  enabled?: boolean;
  edgeThreshold?: number; // max pixels from left edge to start gesture (default: 80px)
  distanceThreshold?: number; // min swipe distance in px to trigger close (default: 55px)
  allowRightEdge?: boolean; // also allow swipe from right edge to left (default: true)
  headerSwipe?: boolean; // allow swipe anywhere on top header (default: true)
  allowSwipeDown?: boolean; // allow swiping down on header to dismiss (default: true)
}

/**
 * Hook to enable native-like swipe back / edge swipe to dismiss modals on mobile
 * AND intercepts Android / iOS system back gesture (popstate) so the phone's edge swipe closes the modal instead of exiting the app!
 */
export function useSwipeToDismiss({
  onClose,
  enabled = true,
  edgeThreshold = 80,
  distanceThreshold = 55,
  allowRightEdge = true,
  headerSwipe = true,
  allowSwipeDown = true,
}: SwipeToDismissOptions) {
  const [swipeOffset, setSwipeOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isSwiping, setIsSwiping] = useState<boolean>(false);

  const touchStartRef = useRef<{ x: number; y: number; time: number; isEdge: boolean; isRightEdge: boolean; isHeader: boolean } | null>(null);
  const isClosingRef = useRef<boolean>(false);
  const hasPushedHistoryRef = useRef<boolean>(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // 1. Chặn vuốt cạnh thoát App: Đăng ký History PushState khi Modal mở
  // Khi người dùng vuốt mép màn hình hệ điều hành (Android / iOS Back Gesture), trình duyệt sẽ kích hoạt sự kiện popstate
  // Hệ thống sẽ bắt sự kiện này và đóng modal thay vì bị văng/thoát khỏi app!
  useEffect(() => {
    if (!enabled) return;

    const modalId = `modal_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    try {
      window.history.pushState({ isModalOpen: true, modalId }, '');
      hasPushedHistoryRef.current = true;
    } catch {}

    const handlePopState = (e: PopStateEvent) => {
      // Khi người dùng vuốt cạnh thoát màn hình hoặc bấm nút Back của điện thoại
      if (hasPushedHistoryRef.current) {
        hasPushedHistoryRef.current = false;
        try {
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(10);
          }
        } catch {}
        onCloseRef.current();
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      // Nếu modal đóng chủ động bằng nút X hoặc vuốt trong app mà state vẫn còn -> dọn sạch history
      if (hasPushedHistoryRef.current) {
        hasPushedHistoryRef.current = false;
        try {
          if (window.history.state && window.history.state.isModalOpen) {
            window.history.back();
          }
        } catch {}
      }
    };
  }, [enabled]);

  // 2. Xử lý cử chỉ vuốt chạm trực tiếp trên màn hình Modal
  const handleTouchStart = useCallback((e: TouchEvent | React.TouchEvent) => {
    if (!enabled || isClosingRef.current) return;
    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    const clientX = touch.clientX;
    const clientY = touch.clientY;
    const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 400;

    const isLeftEdge = clientX <= edgeThreshold;
    const isRightEdge = allowRightEdge && clientX >= windowWidth - edgeThreshold;
    const isHeaderArea = headerSwipe && clientY <= 120;

    if (isLeftEdge || isRightEdge || isHeaderArea) {
      touchStartRef.current = {
        x: clientX,
        y: clientY,
        time: Date.now(),
        isEdge: isLeftEdge,
        isRightEdge: isRightEdge,
        isHeader: isHeaderArea,
      };
      setIsSwiping(false);
      setSwipeOffset({ x: 0, y: 0 });
    } else {
      touchStartRef.current = null;
    }
  }, [enabled, edgeThreshold, allowRightEdge, headerSwipe]);

  const handleTouchMove = useCallback((e: TouchEvent | React.TouchEvent) => {
    if (!enabled || !touchStartRef.current || isClosingRef.current) return;
    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    const { isEdge, isRightEdge, isHeader } = touchStartRef.current;

    // A. Vuốt xuống từ thanh tiêu đề Header để đóng modal
    if (isHeader && allowSwipeDown && dy > 15 && dy > absDx * 1.2) {
      setIsSwiping(true);
      setSwipeOffset({ x: 0, y: Math.min(dy, 180) });
      if (e.cancelable) e.preventDefault();

      if (dy >= distanceThreshold + 20) {
        isClosingRef.current = true;
        touchStartRef.current = null;
        try {
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(10);
          }
        } catch {}
        onCloseRef.current();
      }
      return;
    }

    // Nếu chuyển động phần lớn là cuộn dọc danh sách, huỷ gesture vuốt ngang
    if (!isSwiping && absDy > 25 && absDy > absDx * 1.5) {
      touchStartRef.current = null;
      setSwipeOffset({ x: 0, y: 0 });
      setIsSwiping(false);
      return;
    }

    // B. Vuốt sang phải từ mép trái (hoặc từ Header)
    if ((isEdge || isHeader) && dx > 10 && absDx > absDy * 0.8) {
      setIsSwiping(true);
      setSwipeOffset({ x: Math.min(dx, 220), y: 0 });
      if (e.cancelable) e.preventDefault();

      if (dx >= distanceThreshold) {
        isClosingRef.current = true;
        touchStartRef.current = null;
        try {
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(10);
          }
        } catch {}
        onCloseRef.current();
      }
    }
    // C. Vuốt sang trái từ mép phải
    else if (isRightEdge && dx < -10 && absDx > absDy * 0.8) {
      setIsSwiping(true);
      setSwipeOffset({ x: Math.max(dx, -220), y: 0 });
      if (e.cancelable) e.preventDefault();

      if (absDx >= distanceThreshold) {
        isClosingRef.current = true;
        touchStartRef.current = null;
        try {
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(10);
          }
        } catch {}
        onCloseRef.current();
      }
    }
  }, [enabled, distanceThreshold, isSwiping, allowSwipeDown]);

  const handleTouchEnd = useCallback(() => {
    touchStartRef.current = null;
    setIsSwiping(false);
    setSwipeOffset({ x: 0, y: 0 });
  }, []);

  // Lắng nghe touchmove trên toàn window để bắt gọn cử chỉ ngay sát viền màn hình cảm ứng
  useEffect(() => {
    if (!enabled) return;
    isClosingRef.current = false;

    const onWinTouchStart = (e: TouchEvent) => handleTouchStart(e);
    const onWinTouchMove = (e: TouchEvent) => handleTouchMove(e);
    const onWinTouchEnd = () => handleTouchEnd();

    window.addEventListener('touchstart', onWinTouchStart, { passive: true });
    window.addEventListener('touchmove', onWinTouchMove, { passive: false });
    window.addEventListener('touchend', onWinTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onWinTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onWinTouchStart);
      window.removeEventListener('touchmove', onWinTouchMove);
      window.removeEventListener('touchend', onWinTouchEnd);
      window.removeEventListener('touchcancel', onWinTouchEnd);
    };
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  const modalStyle: React.CSSProperties = isSwiping && (swipeOffset.x !== 0 || swipeOffset.y !== 0)
    ? {
        transform: `translate3d(${swipeOffset.x * 0.45}px, ${swipeOffset.y * 0.45}px, 0)`,
        opacity: Math.max(0.65, 1 - (Math.abs(swipeOffset.x) + Math.abs(swipeOffset.y)) / 350),
        transition: 'none',
      }
    : {
        transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease-out',
      };

  return {
    swipeOffset,
    isSwiping,
    modalStyle,
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
}
