import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle2, 
  X, 
  Radio
} from 'lucide-react';
import { 
  getTikTokStatus, 
  subscribeTikTokStatus, 
  connectTikTokLive, 
  TikTokLiveStatus,
  DEFAULT_TIKTOK_CHANNEL,
  isMuteNotLiveAlert
} from '../lib/tiktokLiveClient';

interface LiveSupervisorModalProps {
  onOpenManualModal?: () => void;
}

export const LiveSupervisorModal: React.FC<LiveSupervisorModalProps> = () => {
  const [status, setStatus] = useState<TikTokLiveStatus>(getTikTokStatus());
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastType, setToastType] = useState<'connected' | 'offline' | 'scanning'>('connected');
  
  const initialBootDoneRef = useRef<boolean>(false);
  const prevConnectedRef = useRef<boolean>(false);
  const toastTimeoutRef = useRef<any>(null);

  // 1. Khởi chạy tự động quét kết nối kênh chính trong background (không hiện popup quấy rầy)
  useEffect(() => {
    if (initialBootDoneRef.current) return;
    initialBootDoneRef.current = true;

    const targetChan = localStorage.getItem('slp_last_tiktok_channel') || DEFAULT_TIKTOK_CHANNEL;
    // Kích hoạt kết nối kênh trong nền nếu chưa kết nối
    const currentSt = getTikTokStatus();
    if (!currentSt.isConnected) {
      connectTikTokLive(targetChan).catch(() => {});
    }

    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // 2. Lắng nghe trạng thái TikTok Live theo thời gian thực
  // CHỈ hiện toast 1 lần duy nhất khi kênh thực sự VỪA BẮT ĐẦU LIVE thành công
  // Tuyệt đối không hiện popup chặn màn hình quấy rầy người dùng
  useEffect(() => {
    const unsub = subscribeTikTokStatus((newStatus) => {
      setStatus(newStatus);

      // Trường hợp: Kênh VỪA KẾT NỐI THÀNH CÔNG (từ false -> true)
      if (newStatus.isConnected && !prevConnectedRef.current) {
        prevConnectedRef.current = true;
        
        // Nếu người dùng không tắt cảnh báo
        if (!isMuteNotLiveAlert()) {
          setToastType('connected');
          setToastMessage(`✅ Kênh @${newStatus.username} Đang Live! Đã kết nối cào bình luận.`);
          setShowToast(true);

          if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
          toastTimeoutRef.current = setTimeout(() => {
            setShowToast(false);
          }, 3500);
        }
      } 
      // Trường hợp: Trước đó đang live mà bị tắt (từ true -> false)
      else if (!newStatus.isConnected && prevConnectedRef.current) {
        prevConnectedRef.current = false;
        
        // Không hiện popup chặn màn hình, chỉ toast nhẹ 3s nếu không mute
        if (!isMuteNotLiveAlert()) {
          setToastType('offline');
          setToastMessage(`ℹ️ Phiên Live @${newStatus.username || 'TikTok'} vừa kết thúc.`);
          setShowToast(true);

          if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
          toastTimeoutRef.current = setTimeout(() => {
            setShowToast(false);
          }, 3000);
        }
      }
    });

    return () => {
      unsub();
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // Nếu không có toast thì không render gì để không chiếm DOM / không chặn click
  if (!showToast) {
    return null;
  }

  return (
    <div className="fixed top-14 sm:top-16 left-0 right-0 mx-auto z-[9999] w-[92%] max-w-md animate-slide-down pointer-events-none">
      <div className={`pointer-events-auto p-3 rounded-2xl backdrop-blur-xl border shadow-2xl flex items-center justify-between gap-3 text-xs sm:text-sm font-medium transition-all ${
        toastType === 'connected' 
          ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200 shadow-emerald-950/50' 
          : 'bg-amber-950/90 border-amber-500/40 text-amber-200 shadow-amber-950/50'
      }`}>
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {toastType === 'connected' ? (
            <div className="w-7 h-7 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 size={16} />
            </div>
          ) : (
            <div className="w-7 h-7 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <Radio size={16} />
            </div>
          )}
          <div className="truncate flex-1">
            <span className="font-semibold block truncate">{toastMessage}</span>
          </div>
        </div>
        <button 
          onClick={() => setShowToast(false)}
          className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 shrink-0 cursor-pointer"
          title="Đóng thông báo"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
