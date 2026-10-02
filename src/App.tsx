import { PWAInstallButton } from './components/PWAInstallButton';
import PrintServer from "./components/PrintServer";
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { MoreVertical, Search as SearchIcon, Home, MessageSquare, Users, PlusCircle, Maximize, Trash2, RefreshCw, Bot, ShoppingCart, BarChart3, Radio, Tv } from 'lucide-react';
import { useStore } from './store';
import { PLATFORMS, Platform, getShortId, normalizeUser, addRecentSearchPrice, extractPriceFromContent } from './lib/core';
import { PriceModal, ManualModal, ListModal, ProfileModal, CustomersModal, LiveEfficiencyModal } from './components/Modals';
import { MinigameModal } from './components/Minigame';
import { AutoCommentModal, useAutoComment } from './components/AutoComment';
import { AutoCloseModal, useAutoClose } from './components/AutoClose';
import { TikTokLiveModal } from './components/TikTokLiveModal';
import { FacebookLiveModal } from './components/FacebookLiveModal';
import { ClearFeedModal } from './components/ClearFeedModal';
import { ResetSessionModal } from './components/ResetSessionModal';
import { SmartLiveMonitor } from './components/SmartLiveMonitor';
import { LiveSupervisorModal } from './components/LiveSupervisorModal';
import { 
  startDistributedMasterCoordinator, 
  subscribeTikTokStatus, 
  fetchTikTokStatus, 
  TikTokLiveStatus, 
  getTikTokStatus, 
  DEFAULT_TIKTOK_CHANNEL 
} from './lib/tiktokLiveClient';
import {
  initFacebookMasterCoordinator,
  subscribeFacebookStatus,
  fetchFacebookStatus,
  FacebookLiveStatus,
  getFacebookStatus
} from './lib/facebookLiveClient';
import { Feed } from './components/Feed';
import { CustomerAvatar } from './components/UserAvatar';
import { PancakeLinkModal } from './components/PancakeLinkModal';
import { PancakeSyncModal } from './components/PancakeSyncModal';
import { openPancakeApp } from './lib/pancakeDeepLink';
import { ErrorBoundary } from './components/ErrorBoundary';

const COMMANDS = [
    { cmd: '/top10', desc: 'Top 10 khách chốt gần nhất' },
    { cmd: '/cam', desc: 'Top 10 khách chốt Shopee' },
    { cmd: '/tik', desc: 'Top 10 khách chốt TikTok' },
    { cmd: '/face', desc: 'Top 10 khách chốt Facebook' }
];

export default function App() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('printserver') === 'true') {
      return <PrintServer />;
  }
  const store = useStore();
  const [search, setSearch] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScrollRef = useRef(false);
  const scrollTimeoutRef = useRef<any>(null);
  const scrollRafRef = useRef<number | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [isSearchVisible, setIsSearchVisible] = useState(true);
  const [isNavVisible, setIsNavVisible] = useState(true);
  const navTimerRef = useRef<any>(null);
  const searchTimerRef = useRef<any>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showSmartLiveMonitor, setShowSmartLiveMonitor] = useState(false);
  const [liveModalSource, setLiveModalSource] = useState<'direct' | 'monitor'>('direct');
  const [showTikTokLiveModal, setShowTikTokLiveModal] = useState(false);
  const [tikTokStatus, setTikTokStatus] = useState<TikTokLiveStatus>(getTikTokStatus());
  const [showFacebookLiveModal, setShowFacebookLiveModal] = useState(false);
  const [facebookStatus, setFacebookStatus] = useState<FacebookLiveStatus>(getFacebookStatus());
  const lastScrollLeftRef = useRef(0);

  // Auto-hide navigation after 5 seconds of inactivity/appearance
  const resetNavTimer = useCallback(() => {
      if (navTimerRef.current) {
          clearTimeout(navTimerRef.current);
      }
      setIsNavVisible(true);
      navTimerRef.current = setTimeout(() => {
          setIsNavVisible(false);
      }, 5000);
  }, []);

  // Auto-hide search bar after 5 seconds of inactivity/appearance
  const resetSearchTimer = useCallback(() => {
      if (searchTimerRef.current) {
          clearTimeout(searchTimerRef.current);
      }
      setIsSearchVisible(true);
      searchTimerRef.current = setTimeout(() => {
          setIsSearchVisible(false);
      }, 5000);
  }, []);

  // Luôn mặc định mở web lên là tab Home (Chat) và kích hoạt timer 5s tự ẩn cho cả navigation & search bar
  useEffect(() => {
      setActiveTab(0);
      if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollLeft = 0;
      }
      const timer = setTimeout(() => {
          if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollLeft = 0;
          }
      }, 50);
      resetNavTimer();
      resetSearchTimer();

      // Initialize TikTok Live stream & distributed master coordinator
      startDistributedMasterCoordinator();
      fetchTikTokStatus();
      const unsubTikTok = subscribeTikTokStatus((s) => setTikTokStatus(s));

      // Initialize Facebook Live coordinator
      initFacebookMasterCoordinator();
      fetchFacebookStatus();
      const unsubFacebook = subscribeFacebookStatus((s) => setFacebookStatus(s));

      return () => {
          clearTimeout(timer);
          unsubTikTok();
          unsubFacebook();
          if (navTimerRef.current) clearTimeout(navTimerRef.current);
          if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      };
  }, [resetNavTimer, resetSearchTimer]);

  // Unified scroll direction callback:
  // - Lướt xuống (isDown = true): hiện lại navigation (hẹn giờ 5s tự ẩn), tự động ẩn thanh tìm kiếm
  // - Lướt lên (isDown = false): hiện lại thanh tìm kiếm (hẹn giờ 5s tự ẩn)
  const handleContentScroll = useCallback((isDown: boolean) => {
      if (isDown) {
          resetNavTimer();
          if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
          if (!isSearchFocused && !search) {
              setIsSearchVisible(false);
          }
      } else {
          resetSearchTimer();
      }
  }, [resetNavTimer, resetSearchTimer, isSearchFocused, search]);

  // Optimized smooth scrolling without scroll-snap fighting
  const goToTab = useCallback((index: number) => {
      setActiveTab(index);
      resetNavTimer();
      const container = scrollContainerRef.current;
      if (!container) return;

      // Mark programmatic scroll to pause onScroll event state updates
      isProgrammaticScrollRef.current = true;
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);

      const targetLeft = index * container.clientWidth;

      // Temporarily disable CSS scroll-snap to prevent mobile browser snap collision
      container.style.scrollSnapType = 'none';

      // Perform high-performance smooth scroll
      container.scrollTo({
          left: targetLeft,
          behavior: 'smooth'
      });

      const finalizeScroll = () => {
          if (container) {
              container.scrollLeft = targetLeft;
              container.style.scrollSnapType = 'x mandatory';
          }
          isProgrammaticScrollRef.current = false;
      };

      // Listen for scrollend if supported, with timeout fallback for wide mobile browser support
      if ('onscrollend' in window) {
          const handleScrollEnd = () => {
              container.removeEventListener('scrollend', handleScrollEnd);
              finalizeScroll();
          };
          container.addEventListener('scrollend', handleScrollEnd, { once: true });
          scrollTimeoutRef.current = setTimeout(() => {
              container.removeEventListener('scrollend', handleScrollEnd);
              finalizeScroll();
          }, 380);
      } else {
          scrollTimeoutRef.current = setTimeout(finalizeScroll, 320);
      }
  }, [resetNavTimer]);

  // Optimized gesture-based scroll detection using rAF throttling + Swipe detection
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      if (!el.clientWidth) return;

      const currentLeft = el.scrollLeft;
      // Khi lướt ngang sang trái hoặc phải -> hiện thanh điều hướng ngay lập tức
      if (Math.abs(currentLeft - lastScrollLeftRef.current) > 15) {
          resetNavTimer();
          lastScrollLeftRef.current = currentLeft;
      }

      if (isProgrammaticScrollRef.current) return;

      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);

      scrollRafRef.current = requestAnimationFrame(() => {
          const tabIndex = Math.round(el.scrollLeft / el.clientWidth);
          if (tabIndex !== activeTab && tabIndex >= 0 && tabIndex <= 4) {
              setActiveTab(tabIndex);
              resetNavTimer();
          }
      });
  }, [activeTab, resetNavTimer]);

  useEffect(() => {
      const handleResize = () => {
          setWindowHeight(window.innerHeight);
          if (scrollContainerRef.current) {
              const el = scrollContainerRef.current;
              el.style.scrollSnapType = 'none';
              el.scrollLeft = activeTab * el.clientWidth;
              requestAnimationFrame(() => {
                  if (scrollContainerRef.current) {
                      scrollContainerRef.current.style.scrollSnapType = 'x mandatory';
                  }
              });
          }
      };
      window.addEventListener('resize', handleResize);
      window.addEventListener('orientationchange', handleResize);
      return () => {
          window.removeEventListener('resize', handleResize);
          window.removeEventListener('orientationchange', handleResize);
          if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
          if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
      };
  }, [activeTab]);
  
  // Modals state
  const [activeModal, setActiveModal] = useState<'stats' | 'manual' | 'list' | 'customers' | 'profile' | 'price' | 'minigame' | 'autocomment' | 'autoclose' | null>(null);
  const [listFilter, setListFilter] = useState<Platform | null>(null);
  const [profileUser, setProfileUser] = useState<{user: string, platform: Platform} | null>(null);
  const [pancakeModalUser, setPancakeModalUser] = useState<{user: string, platform: Platform, initialSearch?: string} | null>(null);
  const autoComment = useAutoComment();
    const autoClose = useAutoClose();
  const [pendingPrint, setPendingPrint] = useState<{id: string | null, user: string, platform: Platform, defaultPrice?: string} | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hostMode, setHostMode] = useState(false);
  const [showClearFeedModal, setShowClearFeedModal] = useState(false);
  const [showResetSessionModal, setShowResetSessionModal] = useState(false);
  const [showPancakeSyncModal, setShowPancakeSyncModal] = useState(false);
  const [toastNotification, setToastNotification] = useState<string | null>(null);

  const triggerToast = useCallback((msg: string) => {
      setToastNotification(msg);
      setTimeout(() => {
          setToastNotification(prev => prev === msg ? null : prev);
      }, 3500);
  }, []);

  useEffect(() => {
    store.initPolling();
    
    // Prevent screen sleep safely
    let wakeLockSentinel: any = null;
    const requestWakeLock = async () => {
        try {
            if ('wakeLock' in navigator && (navigator as any).wakeLock?.request) {
                wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
            }
        } catch {
            // Silently ignore permissions policy disallow or ungranted permissions
        }
    };
    requestWakeLock();
    const handleVisibility = () => {
        if (document.visibilityState === 'visible') requestWakeLock();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    
    const handleFullscreenChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
        document.removeEventListener('visibilitychange', handleVisibility);
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        if (wakeLockSentinel && typeof wakeLockSentinel.release === 'function') {
            wakeLockSentinel.release().catch(() => {});
        }
    };
  }, []);


  // Đảm bảo không tự động xoá dữ liệu chốt đơn khi mở máy hoặc sang ngày mới
  // Mọi thao tác reset phiên chốt đơn PHẢI do người dùng chủ động bấm trong modal ResetSessionModal
  useEffect(() => {
      const todayStr = new Date().toLocaleDateString('en-GB');
      localStorage.setItem('slp_webapp_last_reset', todayStr);
  }, []);

  const toggleFullscreen = () => {
      if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(err => {
              console.log(`Error attempting to enable fullscreen: ${err.message}`);
          });
      } else {
          if (document.exitFullscreen) {
              document.exitFullscreen();
          }
      }
  };

  // Calculate totals for header
  let totalCount = 0;
  let totalRevenue = 0;
  const platformStats = { tiktok: { c: 0, r: 0 }, facebook: { c: 0, r: 0 }, shopee: { c: 0, r: 0 } };

  (['tiktok', 'facebook', 'shopee'] as Platform[]).forEach(p => {
    const custs = store[p].customers as Record<string, any>;
    Object.values(custs).forEach(c => {
        platformStats[p].c += c.count || 0;
        platformStats[p].r += c.total || 0;
    });
    totalCount += platformStats[p].c;
    totalRevenue += platformStats[p].r;
  });

  const quickResults = useMemo(() => {
      const keyword = search.trim().toLowerCase();
      const isDefault = !keyword && isSearchFocused;
      if (!keyword && !isSearchFocused) return { items: [], title: '' };

      let matches: any[] = [];
      let platformsToSearch: Platform[] = ['tiktok', 'facebook', 'shopee'];
      let topCount = 10;
      let isCommand = false;
      let title = `👤 Khách đã chốt khớp "${search}"`;

      if (keyword === '/top10' || isDefault) {
          isCommand = true;
          topCount = 10;
          title = "👤 TOP 10 KHÁCH CHỐT GẦN NHẤT";
      } else if (keyword === '/cam') {
          isCommand = true;
          topCount = 10;
          platformsToSearch = ['shopee'];
          title = "👤 Top 10 khách chốt sàn Shopee";
      } else if (keyword === '/tik') {
          isCommand = true;
          topCount = 10;
          platformsToSearch = ['tiktok'];
          title = "👤 Top 10 khách chốt sàn TikTok";
      } else if (keyword === '/face') {
          isCommand = true;
          topCount = 10;
          platformsToSearch = ['facebook'];
          title = "👤 Top 10 khách chốt sàn Facebook";
      }

      platformsToSearch.forEach(p => {
          Object.entries(store[p].customers as Record<string, any>).forEach(([user, data]) => {
              const tag = store[p].tags?.[user] || 'NORMAL';
              if (isDefault || isCommand) {
                  matches.push({ user, platform: p, data, tag });
              } else {
                  const nick = store[p].nicknames?.[user] || '';
                  const shortId = getShortId(user).toLowerCase();
                  const isIdSearch = keyword.startsWith('#') || /^\d+$/.test(keyword);

                  if (isIdSearch) {
                      const cleanKw = keyword.startsWith('#') ? keyword.slice(1) : keyword;
                      if (shortId === cleanKw || ('#' + shortId) === keyword) {
                          matches.push({ user, platform: p, data, tag });
                      }
                  } else if (
                      user.toLowerCase().includes(keyword) || 
                      nick.toLowerCase().includes(keyword)
                  ) {
                      matches.push({ user, platform: p, data, tag });
                  }
              }
          });
      });

      if (isDefault || isCommand) {
          matches.sort((a,b) => (b.data.lastTime || 0) - (a.data.lastTime || 0));
          matches = matches.slice(0, topCount);
      }
      return { items: matches, title };
  }, [search, isSearchFocused, store.tiktok.customers, store.facebook.customers, store.shopee.customers, store.tiktok.nicknames, store.facebook.nicknames, store.shopee.nicknames, store.tiktok.tags, store.facebook.tags, store.shopee.tags]);

  return (
    <div className="max-w-[720px] mx-auto bg-[#0e1621] flex flex-col relative overflow-hidden" style={{ height: windowHeight }}>
        {/* Header */}
        <div className="bg-[#1c242f] text-white py-2 shrink-0 z-50 shadow-md border-b border-white/5">
            {/* Main Header Bar */}
            <div className="flex items-center justify-between px-3 gap-2">
                {/* Left: Brand & TikTok Live Status */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-white text-[17px] font-black tracking-tight flex items-center gap-1">
                            Chốt Đơn
                        </span>
                        <span 
                            className="w-2 h-2 rounded-full shrink-0" 
                            style={{ backgroundColor: store.syncStatus.color }}
                            title={store.syncStatus.text}
                        />
                    </div>

                    {/* Smart Live Monitor: Unified Health Status Dashboard & Quick Override */}
                    <SmartLiveMonitor 
                        isOpen={showSmartLiveMonitor}
                        onOpen={() => setShowSmartLiveMonitor(true)}
                        onClose={() => setShowSmartLiveMonitor(false)}
                        onOpenTikTokModal={() => {
                            setLiveModalSource('monitor');
                            setShowSmartLiveMonitor(false);
                            setShowTikTokLiveModal(true);
                        }}
                        onOpenFacebookModal={() => {
                            setLiveModalSource('monitor');
                            setShowSmartLiveMonitor(false);
                            setShowFacebookLiveModal(true);
                        }}
                    />
                </div>

                {/* Right: Summary Card & Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                    <button 
                        onClick={() => goToTab(1)}
                        className="bg-[#232e3c] hover:bg-[#2c3a4b] active:scale-95 rounded-xl px-2.5 py-1 text-center cursor-pointer border border-white/10 shadow-sm transition-all flex flex-col justify-center shrink-0"
                        title="Xem danh sách & thống kê giỏ hàng"
                    >
                        <div className="text-[8.5px] text-gray-400 font-bold uppercase tracking-wider leading-none">TỔNG CHUNG</div>
                        <div className="text-[13px] font-black text-white leading-tight mt-0.5 whitespace-nowrap">
                            {totalCount} <span className="text-[10px] font-normal text-gray-400">cái</span> <span className="text-gray-500 font-normal mx-0.5">|</span> {totalRevenue}k
                        </div>
                    </button>

                    {!isSearchVisible && (
                        <button 
                            onClick={() => resetSearchTimer()} 
                            className="p-1.5 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5 active:scale-95 cursor-pointer"
                            title="Mở tìm kiếm"
                        >
                            <SearchIcon size={18} />
                        </button>
                    )}

                    <div className="relative">
                        <button 
                            onClick={() => setShowMenu(!showMenu)} 
                            className="p-1.5 text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-white/5 active:scale-95 cursor-pointer"
                        >
                            <MoreVertical size={20} />
                        </button>
                        {showMenu && (
                        <div className="absolute right-0 top-full mt-1 w-64 bg-[#232e3c] rounded-xl shadow-2xl border border-white/10 overflow-hidden z-[100] animate-in fade-in zoom-in duration-200">
                            <div className="p-2 border-b border-white/5 bg-emerald-950/30">
                                <PWAInstallButton className="w-full justify-center py-2" />
                            </div>
                            <button 
                                onClick={() => { setShowMenu(false); setLiveModalSource('direct'); setShowTikTokLiveModal(true); }} 
                                className="w-full text-left px-4 py-3 text-[14px] text-white hover:bg-white/10 flex items-center gap-3 bg-gradient-to-r from-[#00f2ea]/10 to-transparent border-b border-white/5"
                            >
                                <Radio size={18} className={tikTokStatus.isConnected ? "text-[#00f2ea] animate-pulse" : "text-[#00f2ea]"} />
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold">Cào TikTok Live</span>
                                        {tikTokStatus.isConnected && (
                                            <span className="text-[9px] font-black bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded-full border border-emerald-500/30">LIVE</span>
                                        )}
                                    </div>
                                    <div className="text-[11px] text-gray-400">
                                        {tikTokStatus.isConnected ? `@${tikTokStatus.username} (${tikTokStatus.viewerCount} mắt)` : 'Hút comment TikTok trực tiếp'}
                                    </div>
                                </div>
                            </button>
                            <button 
                                onClick={() => { setShowMenu(false); setLiveModalSource('direct'); setShowFacebookLiveModal(true); }} 
                                className="w-full text-left px-4 py-3 text-[14px] text-white hover:bg-white/10 flex items-center gap-3 bg-gradient-to-r from-blue-600/10 to-transparent border-b border-white/5"
                            >
                                <Tv size={18} className={facebookStatus.isConnected ? "text-blue-400 animate-pulse" : "text-blue-400"} />
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold">Cào Facebook Live</span>
                                        {facebookStatus.isConnected && (
                                            <span className="text-[9px] font-black bg-blue-500/20 text-blue-400 px-1.5 py-0.2 rounded-full border border-blue-500/30">LIVE</span>
                                        )}
                                    </div>
                                    <div className="text-[11px] text-gray-400">
                                        {facebookStatus.isConnected ? `${facebookStatus.target} (${facebookStatus.totalCommentsCount} cmt)` : 'Nhập link live / ID Fanpage'}
                                    </div>
                                </div>
                            </button>
                            <button onClick={() => { setShowMenu(false); setActiveModal('autocomment'); }} className="w-full text-left px-4 py-3 text-[14px] text-white hover:bg-white/10 flex items-center gap-3">
                                <Bot size={18} className="text-[#4ade80]" />
                                <span>Auto Comment</span>
                            </button>
                            <button onClick={() => { setShowMenu(false); toggleFullscreen(); }} className="w-full text-left px-4 py-3 text-[14px] text-white hover:bg-white/10 flex items-center gap-3">
                                <Maximize size={18} className="text-gray-400" />
                                <span>Toàn màn hình</span>
                            </button>
                            <button onClick={async (e) => { 
                                const b = e.currentTarget; const icon = b.querySelector('svg');
                                if(icon) icon.classList.add('animate-spin');
                                await store.refreshPlatform('tiktok'); 
                                setShowMenu(false);
                            }} className="w-full text-left px-4 py-3 text-[14px] text-white hover:bg-white/10 flex items-center gap-3 border-t border-white/5">
                                <RefreshCw size={18} className="text-blue-400" />
                                <span>Làm mới dữ liệu</span>
                            </button>
                            <button onClick={() => { 
                                setShowMenu(false);
                                setShowResetSessionModal(true);
                            }} className="w-full text-left px-4 py-3 text-[14px] text-amber-400 hover:bg-white/10 flex items-center gap-3 border-t border-white/5 cursor-pointer">
                                <Trash2 size={18} />
                                <span>Reset số liệu phiên</span>
                            </button>
                            <button onClick={() => { 
                                setShowMenu(false);
                                setShowClearFeedModal(true);
                            }} className="w-full text-left px-4 py-3 text-[14px] text-[#ff6b6b] hover:bg-white/10 flex items-center gap-3 cursor-pointer">
                                <Trash2 size={18} />
                                <span>Xoá Feed (Bắt đầu live mới)</span>
                            </button>
                        </div>
                    )}
                    </div>
                </div>
            </div>
            


            {/* Search Bar under Stats - Smooth collapse/expand based on scroll direction & auto-hide */}
            <div className={`px-4 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] overflow-hidden ${
                isSearchVisible 
                    ? 'max-h-16 opacity-100 mt-3 transform translate-y-0 scale-100' 
                    : 'max-h-0 opacity-0 mt-0 pointer-events-none transform -translate-y-2 scale-95'
            }`}>
                <div className="relative flex items-center bg-[#0e1621] rounded-full border border-white/5 shadow-inner">
                    <span className="absolute left-3 text-gray-400"><SearchIcon size={18} /></span>
                    <input 
                        value={search}
                        onChange={(e) => {
                            const val = e.target.value;
                            setSearch(val);
                            setIsSearchVisible(true);
                            if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
                            if (val.trim()) {
                                const numMatch = val.trim().match(/^(\d+)\s*(k|ka|ca|cành)?$/i);
                                if (numMatch && parseInt(numMatch[1], 10) >= 5) {
                                    addRecentSearchPrice(numMatch[1]);
                                } else {
                                    const extracted = extractPriceFromContent(val);
                                    if (extracted.price && parseInt(extracted.price, 10) >= 5) {
                                        addRecentSearchPrice(extracted.price);
                                    }
                                }
                            }
                        }}
                        onFocus={() => {
                            setIsSearchFocused(true);
                            setIsSearchVisible(true);
                            if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
                        }}
                        onBlur={() => {
                            if (search.trim()) {
                                const numMatch = search.trim().match(/^(\d+)\s*(k|ka|ca|cành)?$/i);
                                if (numMatch && parseInt(numMatch[1], 10) >= 5) {
                                    addRecentSearchPrice(numMatch[1]);
                                } else {
                                    const extracted = extractPriceFromContent(search);
                                    if (extracted.price && parseInt(extracted.price, 10) >= 5) {
                                        addRecentSearchPrice(extracted.price);
                                    }
                                }
                            }
                            setTimeout(() => {
                                setIsSearchFocused(false);
                                if (!search) {
                                    resetSearchTimer();
                                }
                            }, 250);
                        }}
                        placeholder="Tìm chat, tên khách, lệnh /top10, /vip..."
                        className="w-full pl-10 pr-10 py-2.5 bg-transparent text-white text-sm focus:outline-none placeholder-gray-400 font-medium"
                    />
                    {(search || isSearchFocused) && (
                        <button 
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                                setSearch('');
                                setIsSearchFocused(false);
                                resetSearchTimer();
                            }} 
                            className="absolute right-3 text-gray-400 hover:text-white bg-white/10 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>
        </div>

        {/* Quick Results / Commands Overlay across all tabs */}
        {search.startsWith('/') && COMMANDS.filter(c => c.cmd.startsWith(search.toLowerCase()) && c.cmd !== search.toLowerCase()).length > 0 ? (
            <div 
                onMouseDown={(e) => e.preventDefault()}
                className={`bg-[#1c242f] border-b border-white/10 z-50 absolute w-full shadow-2xl transition-all duration-300 bottom-[58px] overflow-y-auto ${isSearchVisible ? "top-[96px] sm:top-[98px]" : "top-[48px] sm:top-[50px]"}`}
            >
                <div className="sticky top-0 z-10 flex items-center justify-between px-4 pt-3 pb-2 border-b border-white/5 bg-[#131d2a]">
                    <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">
                        ⌨️ Lệnh tìm kiếm nhanh
                    </span>
                    <button 
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setSearch(''); setIsSearchFocused(false); }} 
                        className="text-xs text-gray-400 hover:text-white cursor-pointer px-2 py-1 rounded hover:bg-white/5"
                    >
                        Đóng
                    </button>
                </div>
                {COMMANDS.filter(c => c.cmd.startsWith(search.toLowerCase()) && c.cmd !== search.toLowerCase()).map((c, idx) => (
                    <div 
                        key={idx} 
                        className="flex items-center gap-3 px-4 py-3 border-t border-white/5 cursor-pointer hover:bg-white/5 transition-colors"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setSearch(c.cmd); document.querySelector('input')?.focus(); }}
                    >
                        <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded-lg font-bold text-xs border border-blue-500/30">{c.cmd}</span>
                        <span className="text-sm font-medium text-gray-300">{c.desc}</span>
                    </div>
                ))}
            </div>
        ) : (isSearchFocused || search) && quickResults.items.length > 0 ? (
            <div 
                onMouseDown={(e) => e.preventDefault()}
                className={`bg-[#1c242f] border-b border-white/10 z-50 absolute w-full shadow-2xl overflow-y-auto transition-all duration-300 bottom-[58px] ${isSearchVisible ? "top-[96px] sm:top-[98px]" : "top-[48px] sm:top-[50px]"}`}
            >
                <div className="sticky top-0 z-10 flex items-center justify-between px-4 pt-3 pb-2 border-b border-white/5 bg-[#131d2a]">
                    <span className="text-[11px] font-bold text-[#ffca28] uppercase tracking-wider">
                        {quickResults.title}
                    </span>
                    <button 
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setSearch(''); setIsSearchFocused(false); }} 
                        className="text-xs text-gray-400 hover:text-white cursor-pointer px-2 py-1 rounded hover:bg-white/5"
                    >
                        Đóng
                    </button>
                </div>
                <div className="divide-y divide-white/5 pb-4">
                    {quickResults.items.map((m, idx) => {
                        const cleanUser = normalizeUser(m.user);
                        const commentWithAvatar = store[m.platform as Platform].comments.find(c => normalizeUser(c.user) === cleanUser && c.avatar);
                        const avatarUrl = commentWithAvatar?.avatar;
                        const nickname = store[m.platform as Platform].nicknames?.[cleanUser];
                        const displayName = nickname ? `${cleanUser} (${nickname})` : cleanUser;
                        const pLink = store[m.platform as Platform].pancakeLinks?.[cleanUser];
                        return (
                        <div key={idx} className="flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors">
                            <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
                                <CustomerAvatar 
                                    user={cleanUser} 
                                    platform={m.platform as Platform} 
                                    avatarUrl={avatarUrl}
                                    tag={m.tag || 'NORMAL'}
                                    size="md"
                                    onClick={() => { setProfileUser({user: cleanUser, platform: m.platform}); setActiveModal('profile'); setIsSearchFocused(false); }}
                                />
                                <div 
                                    onClick={() => { setProfileUser({user: cleanUser, platform: m.platform}); setActiveModal('profile'); setIsSearchFocused(false); }}
                                    className="cursor-pointer flex-1 min-w-0"
                                >
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[11px] font-mono font-bold text-gray-400 bg-black/40 px-1.5 py-0.5 rounded border border-white/10 shrink-0">
                                            #{getShortId(cleanUser)}
                                        </span>
                                        <span className="text-[15px] font-bold text-white truncate">
                                            {displayName}
                                        </span>
                                    </div>
                                    <div className="text-[12px] text-gray-400 mt-1 flex items-center">
                                        Đã chốt: 
                                        <span className="font-bold text-blue-400 ml-1.5">
                                            {m.data.count} cái <span className="text-gray-500 font-normal mx-0.5">-</span> {m.data.total}k
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button 
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (pLink) {
                                            openPancakeApp(pLink, true);
                                        } else {
                                            setPancakeModalUser({ user: cleanUser, platform: m.platform as Platform });
                                        }
                                        setIsSearchFocused(false);
                                    }}
                                    className={`px-2.5 py-1.5 text-xs font-bold rounded-xl shrink-0 transition-all flex items-center gap-1 cursor-pointer shadow-sm active:scale-95 ${
                                        pLink 
                                            ? 'bg-orange-950/80 hover:bg-orange-900/90 text-orange-400 border border-orange-500/40 shadow-orange-950/40' 
                                            : 'bg-orange-950/35 hover:bg-orange-950/60 text-orange-300/90 border border-orange-500/25'
                                    }`}
                                    title={pLink ? "Mở trực tiếp hội thoại chat Pancake / Zalo" : "Liên kết Pancake / Zalo cho khách này"}
                                >
                                    <span className="text-sm leading-none">🥞</span>
                                    <span className="font-bold text-[11px]">Pancake</span>
                                </button>
                                <button 
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setPendingPrint({id: null, user: cleanUser, platform: m.platform as Platform}); 
                                        setActiveModal('price'); 
                                        setIsSearchFocused(false);
                                    }}
                                    className="bg-emerald-950/60 hover:bg-emerald-900/60 active:scale-95 text-emerald-400 border border-emerald-500/30 rounded-xl px-3 py-1.5 text-xs font-bold shrink-0 transition-all flex items-center gap-1 cursor-pointer shadow-sm"
                                >
                                    <PlusCircle size={15} /> Mới
                                </button>
                            </div>
                        </div>
                    );})}
                </div>
            </div>
        ) : null}


        <style>{`
            @keyframes pulse-red-green {
                0% { background-color: #ef4444; }
                50% { background-color: #22c55e; }
                100% { background-color: #ef4444; }
            }
            .animate-red-green {
                animation: pulse-red-green 1.5s infinite;
            }
        `}</style>
        
        
        <div 
            ref={scrollContainerRef} 
            onScroll={handleScroll} 
            onTouchStart={resetNavTimer}
            onTouchMove={resetNavTimer}
            onPointerDown={resetNavTimer}
            className="flex-1 flex overflow-x-auto snap-x snap-mandatory hide-scrollbar relative select-none"
            style={{
                WebkitOverflowScrolling: 'touch',
                overscrollBehaviorX: 'contain',
                touchAction: 'pan-x pan-y'
            }}
        >
            {/* TAB 0: HOME / FEED */}
            <div className="w-full shrink-0 snap-center h-full flex flex-col relative overflow-hidden">
                <ErrorBoundary>
                    <Feed 
                        searchKeyword={search} 
                        hostMode={hostMode} 
                        onOpenPrice={(id, user, platform, defaultPrice) => {
                            setPendingPrint({ id, user, platform, defaultPrice });
                            setActiveModal('price');
                        }}
                        onOpenProfile={(user, platform) => {
                            setProfileUser({ user, platform });
                            setActiveModal('profile');
                        }}
                        onOpenPancakeLink={(user, platform, initialSearch) => {
                            setPancakeModalUser({ user, platform, initialSearch });
                        }}
                        onScroll={handleContentScroll}
                    />
                </ErrorBoundary>
            </div>

            {/* TAB 1: LIST / CART */}
            <div className="w-full shrink-0 snap-center h-full flex flex-col bg-transparent relative overflow-hidden">
                <ListModal 
                    isPage={true}
                    filterPlatform={listFilter} 
                    searchKeyword={search}
                    onClose={() => {}} 
                    onOpenProfile={(u, p) => { 
                        setProfileUser({ user: u, platform: p }); 
                        setActiveModal('profile'); 
                    }} 
                    onOpenPrice={(id, u, p) => {
                        setPendingPrint({ id, user: u, platform: p });
                        setActiveModal('price');
                    }}
                    onOpenPancakeLink={(user, platform, initialSearch) => {
                        setPancakeModalUser({ user, platform, initialSearch });
                    }}
                    onScroll={handleContentScroll}
                    onSetFilter={setListFilter}
                />
            </div>

            {/* TAB 2: CUSTOMERS */}
            <div className="w-full shrink-0 snap-center h-full bg-transparent relative overflow-hidden">
                <CustomersModal 
                    isPage={true}
                    searchKeyword={search}
                    onClose={() => {}} 
                    onOpenProfile={(u, p) => { 
                        setProfileUser({ user: u, platform: p }); 
                        setActiveModal('profile'); 
                    }} 
                    onOpenNewOrder={(u, p) => { 
                        setPendingPrint({ id: null, user: u, platform: p }); 
                        setActiveModal('price'); 
                    }} 
                    onOpenPancakeLink={(user, platform, initialSearch) => {
                        setPancakeModalUser({ user, platform, initialSearch });
                    }}
                    onScroll={handleContentScroll}
                />
            </div>

            {/* TAB 3: EFFICIENCY / STATS */}
            <div className="w-full shrink-0 snap-center h-full bg-transparent relative overflow-hidden">
                <LiveEfficiencyModal 
                    isPage={true}
                    onClose={() => {}} 
                    onOpenProfile={(u, p) => { 
                        setProfileUser({ user: u, platform: p }); 
                        setActiveModal('profile'); 
                    }} 
                    onOpenPrice={(id, u, p) => {
                        setPendingPrint({ id, user: u, platform: p });
                        setActiveModal('price');
                    }}
                    onScroll={handleContentScroll}
                />
            </div>

            {/* TAB 4: NEW ORDER */}
            <div className="w-full shrink-0 snap-center h-full bg-transparent relative overflow-hidden">
                <ManualModal 
                    isPage={true}
                    onClose={() => {}} 
                    onOpenProfile={(u, p) => { setProfileUser({user: u, platform: p}); setActiveModal('profile'); }} 
                />
            </div>
        </div>

        {/* Bottom Navigation with 5s Auto-hide and Full-width Bottom Alignment */}
        <div 
            onTouchStart={resetNavTimer}
            onMouseEnter={resetNavTimer}
            onClick={resetNavTimer}
            className={`fixed bottom-0 left-0 right-0 w-full bg-[#0e1621]/95 backdrop-blur-2xl z-50 flex justify-around items-center border-t border-white/10 rounded-t-2xl px-1 sm:px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-6px_30px_rgba(0,0,0,0.6)] transform-gpu transition-all duration-300 ease-out ${
                isNavVisible 
                    ? 'translate-y-0 opacity-100 pointer-events-auto scale-100' 
                    : 'translate-y-[110%] opacity-0 pointer-events-none scale-[0.98]'
            }`}
        >
            <button onClick={() => goToTab(0)} className="flex flex-col items-center justify-center flex-1 min-w-0 py-1.5 relative cursor-pointer active:scale-95 transition-transform">
                <div className={`w-[32px] sm:w-[42px] h-7 sm:h-8 rounded-full flex items-center justify-center transition-all duration-300 ${activeTab === 0 ? 'bg-blue-600 text-white shadow-md shadow-blue-500/40 scale-105' : 'text-gray-400 hover:text-gray-200'}`}>
                    <Home size={17} />
                </div>
                <span className={`text-[8.5px] xs:text-[9.5px] sm:text-[11px] mt-0.5 font-bold transition-all duration-300 whitespace-nowrap leading-none tracking-tighter text-center ${activeTab === 0 ? 'text-blue-400 font-black scale-105' : 'text-gray-400'}`}>Chat</span>
            </button>

            <button onClick={() => goToTab(1)} className="flex flex-col items-center justify-center flex-1 min-w-0 py-1.5 relative cursor-pointer active:scale-95 transition-transform">
                <div className={`w-[32px] sm:w-[42px] h-7 sm:h-8 rounded-full flex items-center justify-center transition-all duration-300 ${activeTab === 1 ? 'bg-blue-600 text-white shadow-md shadow-blue-500/40 scale-105' : 'text-gray-400 hover:text-gray-200'}`}>
                    <div className="relative">
                        <ShoppingCart size={17} />
                        {totalCount > 0 && (
                            <span className={`absolute -top-1.5 -right-2 bg-red-500 text-white text-[7.5px] font-black min-w-[13px] h-[13px] rounded-full flex items-center justify-center px-0.5 border ${activeTab === 1 ? 'border-blue-600' : 'border-[#1c242f]'}`}>
                                {totalCount}
                            </span>
                        )}
                    </div>
                </div>
                <span className={`text-[8.5px] xs:text-[9.5px] sm:text-[11px] mt-0.5 font-bold transition-all duration-300 whitespace-nowrap leading-none tracking-tighter text-center ${activeTab === 1 ? 'text-blue-400 font-black scale-105' : 'text-gray-400'}`}>Giỏ hàng</span>
            </button>

            <button onClick={() => goToTab(2)} className="flex flex-col items-center justify-center flex-1 min-w-0 py-1.5 relative cursor-pointer active:scale-95 transition-transform">
                <div className={`w-[32px] sm:w-[42px] h-7 sm:h-8 rounded-full flex items-center justify-center transition-all duration-300 ${activeTab === 2 ? 'bg-blue-600 text-white shadow-md shadow-blue-500/40 scale-105' : 'text-gray-400 hover:text-gray-200'}`}>
                    <Users size={17} />
                </div>
                <span className={`text-[8.5px] xs:text-[9.5px] sm:text-[11px] mt-0.5 font-bold transition-all duration-300 whitespace-nowrap leading-none tracking-tighter text-center ${activeTab === 2 ? 'text-blue-400 font-black scale-105' : 'text-gray-400'}`}>Khách hàng</span>
            </button>

            <button onClick={() => goToTab(3)} className="flex flex-col items-center justify-center flex-1 min-w-0 py-1.5 relative cursor-pointer active:scale-95 transition-transform">
                <div className={`w-[32px] sm:w-[42px] h-7 sm:h-8 rounded-full flex items-center justify-center transition-all duration-300 ${activeTab === 3 ? 'bg-blue-600 text-white shadow-md shadow-blue-500/40 scale-105' : 'text-gray-400 hover:text-gray-200'}`}>
                    <BarChart3 size={17} />
                </div>
                <span className={`text-[8.5px] xs:text-[9.5px] sm:text-[11px] mt-0.5 font-bold transition-all duration-300 whitespace-nowrap leading-none tracking-tighter text-center ${activeTab === 3 ? 'text-blue-400 font-black scale-105' : 'text-gray-400'}`}>Hiệu quả</span>
            </button>

            <button onClick={() => goToTab(4)} className="flex flex-col items-center justify-center flex-1 min-w-0 py-1.5 relative cursor-pointer active:scale-95 transition-transform">
                <div className={`w-[32px] sm:w-[42px] h-7 sm:h-8 rounded-full flex items-center justify-center transition-all duration-300 ${activeTab === 4 ? 'bg-blue-600 text-white shadow-md shadow-blue-500/40 scale-105' : 'text-gray-400 hover:text-gray-200'}`}>
                    <PlusCircle size={17} />
                </div>
                <span className={`text-[8.5px] xs:text-[9.5px] sm:text-[11px] mt-0.5 font-bold transition-all duration-300 whitespace-nowrap leading-none tracking-tighter text-center ${activeTab === 4 ? 'text-blue-400 font-black scale-105' : 'text-gray-400'}`}>Tạo mới</span>
            </button>
        </div>

        {/* Subtle Quick Reveal Touch Bar with Fade Animation */}
        <div 
            onClick={resetNavTimer}
            onTouchStart={resetNavTimer}
            className={`absolute bottom-2 left-1/2 -translate-x-1/2 z-40 px-8 py-2 cursor-pointer flex items-center justify-center transition-all duration-500 transform-gpu active:scale-90 ${
                !isNavVisible ? 'opacity-70 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-3 pointer-events-none'
            }`}
            title="Bấm hoặc lướt để hiện thanh điều hướng"
        >
            <div className="w-14 h-1.5 bg-white/40 hover:bg-white/70 rounded-full shadow-lg backdrop-blur-sm transition-colors"></div>
        </div>

        {/* Modals */}
        
        
        
        {activeModal === 'price' && pendingPrint && <PriceModal pendingPrint={pendingPrint} onClose={() => setActiveModal(null)} />}
        {activeModal === 'profile' && profileUser && (
            <ProfileModal 
                user={profileUser.user} 
                platform={profileUser.platform} 
                onClose={() => setActiveModal(null)} 
                onOpenPrice={(id, u, p) => {
                    setPendingPrint({ id, user: u, platform: p });
                    setActiveModal('price');
                }}
                onOpenPancakeLink={(user, platform, initialSearch) => {
                    setPancakeModalUser({ user, platform, initialSearch });
                }}
            />
        )}
        {activeModal === 'minigame' && (
            <MinigameModal 
                onClose={() => setActiveModal(null)} 
                onOpenProfile={(u, p) => { setProfileUser({user: u, platform: p}); setActiveModal('profile'); }}
                onOpenPrice={(id, u, p) => { setPendingPrint({id, user: u, platform: p}); setActiveModal('price'); }}
            />
        )}
        {activeModal === 'autoclose' && (
            <AutoCloseModal 
                config={autoClose.config} 
                saveConfig={autoClose.saveConfig} 
                onClose={() => setActiveModal(null)} 
            />
        )}
        {activeModal === 'autocomment' && (
            <AutoCommentModal 
                config={autoComment.config} 
                saveConfig={autoComment.saveConfig} 
                onClose={() => setActiveModal(null)} 
            />
        )}
        <TikTokLiveModal 
            isOpen={showTikTokLiveModal} 
            onClose={() => {
                setShowTikTokLiveModal(false);
                if (liveModalSource === 'monitor') {
                    setShowSmartLiveMonitor(true);
                }
            }} 
            onBack={() => {
                setShowTikTokLiveModal(false);
                setShowSmartLiveMonitor(true);
            }}
            onOpenAutoComment={() => setActiveModal('autocomment')}
        />

        <FacebookLiveModal 
            isOpen={showFacebookLiveModal} 
            onClose={() => {
                setShowFacebookLiveModal(false);
                if (liveModalSource === 'monitor') {
                    setShowSmartLiveMonitor(true);
                }
            }} 
            onBack={() => {
                setShowFacebookLiveModal(false);
                setShowSmartLiveMonitor(true);
            }}
        />

        <LiveSupervisorModal />

        <ClearFeedModal 
            isOpen={showClearFeedModal} 
            onClose={() => setShowClearFeedModal(false)} 
            onSuccess={(msg) => triggerToast(msg)} 
        />

        <ResetSessionModal 
            isOpen={showResetSessionModal} 
            onClose={() => setShowResetSessionModal(false)} 
            onSuccess={(msg) => triggerToast(msg)} 
        />

        {pancakeModalUser && (
            <PancakeLinkModal 
                isOpen={!!pancakeModalUser}
                user={pancakeModalUser.user}
                platform={pancakeModalUser.platform}
                initialSearch={pancakeModalUser.initialSearch}
                onClose={() => setPancakeModalUser(null)}
                onSuccess={(msg) => triggerToast(msg)}
            />
        )}

        <PancakeSyncModal 
            isOpen={showPancakeSyncModal} 
            onClose={() => setShowPancakeSyncModal(false)} 
        />

        {toastNotification && (
            <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[150] bg-emerald-600 border border-emerald-400/40 text-white font-medium text-xs sm:text-sm px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-none">
                <span>{toastNotification}</span>
            </div>
        )}
    </div>
  );
}
