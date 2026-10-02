import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PlusCircle, Plus, Clipboard, Smartphone, Phone, MapPin, ShoppingBag, Package, Sparkles, RefreshCw, ChevronDown, ChevronUp, Calendar, Truck, ExternalLink, Edit3, LayoutGrid, List, Calculator, Minus, Printer, Trash2, Check, RotateCcw, Hash, Tag, Receipt } from 'lucide-react';
import { useStore, CustomerData, OrderItem, deduplicateOrderItems } from '../store';
import { PLATFORMS, printLabel, printBill, getShortId, Platform, normalizeUser, getLastClosedPrice, getRecentSearchPrices, getRecentClosedPrices } from '../lib/core';
import { CustomerAvatar } from './UserAvatar';
import { openPancakeApp, parsePancakeContact } from '../lib/pancakeDeepLink';
import { getCustomerInsight, getOrderStatusLabel, getPartnerStatusLabel, syncSingleCustomerPancakeOrders, checkCustomerPancakeShippedStatus, formatDateTime, parseOrderTimestamp, toStartOfDay } from '../lib/pancakeSync';
import { PancakeOrderPushModal } from './PancakeOrderPushModal';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';


export function CopyButton({ text, className = "" }: { text: string, className?: string }) {
    const [copied, setCopied] = useState(false);
    
    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        }
    };

    return (
        <button onClick={handleCopy} className={`opacity-60 hover:opacity-100 ${copied ? 'opacity-100' : ''} ${className}`}>
            {copied ? '✅' : '📋'}
        </button>
    );
}

function DeleteConfirmButton({ onDelete, className = "" }: { onDelete: () => void, className?: string }) {
    const [confirming, setConfirming] = useState(false);

    useEffect(() => {
        if (!confirming) return;
        const timer = setTimeout(() => setConfirming(false), 3000);
        return () => clearTimeout(timer);
    }, [confirming]);

    if (confirming) {
        return (
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                }}
                className={`bg-red-600 hover:bg-red-700 text-white font-bold text-xs whitespace-nowrap animate-pulse ${className}`}
            >
                ⚠️
            </button>
        );
    }

    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                setConfirming(true);
            }}
            className={`bg-red-100 hover:bg-red-200 text-red-700 font-bold text-xs whitespace-nowrap ${className}`}
        >
            🗑️
        </button>
    );
}

import { ItemCalculatorModal, parseOrderFormula } from './ItemCalculatorModal';
export type { ParsedCalculatorItem } from './ItemCalculatorModal';
export { ItemCalculatorModal, parseOrderFormula };

export function PriceModal({ pendingPrint, onClose }: { pendingPrint: { id: string | null, user: string, platform: Platform, defaultPrice?: string }, onClose: () => void }) {
    const store = useStore();
    const cleanUser = normalizeUser(pendingPrint.user);
    const pStore = store[pendingPrint.platform];
    const flowPrice = pStore.flowPrice;

    // Smart price calculation:
    const lastClosed = getLastClosedPrice();
    const searchPrices = getRecentSearchPrices(); // 3 giá chủ live nhập gần nhất ở ô tìm kiếm
    const recentClosedPrices = getRecentClosedPrices();

    // Priority for initial price to jump right into input:
    // 1. defaultPrice (from comment extracted price)
    // 2. flowPrice (from host price)
    // 3. lastClosed (giá chốt gần nhất - nhảy vào ô nhập giá luôn)
    // 4. searchPrices[0] (giá gần nhất nhập ở ô tìm kiếm)
    const initialPrice = pendingPrint.defaultPrice 
        || (flowPrice?.price ? flowPrice.price : '') 
        || (lastClosed ? lastClosed : '')
        || (searchPrices.length > 0 ? searchPrices[0] : '');

    const [price, setPrice] = useState(initialPrice);
    const [useFormulaCalc, setUseFormulaCalc] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const [printQueue, setPrintQueue] = useState<string[]>([]);
    const [printIndex, setPrintIndex] = useState(0);
    const [isMulti, setIsMulti] = useState(false);

    useEffect(() => {
        if (initialPrice) {
            setPrice(initialPrice);
        }
        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
                inputRef.current.select();
            }
        }, 100);
    }, [initialPrice]);

    if (useFormulaCalc) {
        return (
            <ItemCalculatorModal
                user={cleanUser}
                platform={pendingPrint.platform}
                sourceCommentId={pendingPrint.id}
                defaultPrice={price || initialPrice}
                onClose={onClose}
                onAdded={onClose}
            />
        );
    }

    const cust = store[pendingPrint.platform].customers[cleanUser];

    const executePrint = (p: string, isFirst: boolean) => {
        let content = "";
        let time = new Date().toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit'});
        if (pendingPrint.id) {
            const item = store[pendingPrint.platform].comments.find(x => x.id === pendingPrint.id);
            if (item) { 
                content = typeof item.content === 'object' ? JSON.stringify(item.content) : String(item.content || ''); 
                time = item.time; 
            }
        }
        store.printNewOrder(pendingPrint.platform, cleanUser, content, p, time, isFirst ? pendingPrint.id : null, true);
    };

    const confirm = () => {
        if (!price.trim()) return;
        const prices = price.trim().split('-').map(p => p.trim()).filter(p => p);
        if (prices.length === 0) return;

        if (prices.length === 1) {
            executePrint(prices[0], true);
            onClose();
        } else {
            setPrintQueue(prices);
            setIsMulti(true);
            setPrintIndex(1);
            executePrint(prices[0], true);
        }
    };

    const printNext = () => {
        if (printIndex < printQueue.length) {
            executePrint(printQueue[printIndex], false);
            setPrintIndex(printIndex + 1);
        }
    };

    if (isMulti) {
        return (
            <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-2 sm:p-4">
                <div className="bg-[#1c242f] rounded-xl p-5 w-full max-w-sm flex flex-col items-center shadow-2xl">
                    <h3 className="text-xl font-bold text-blue-400 mb-2">🖨️ Đang in nhiều tem</h3>
                    <p className="text-gray-400 mb-6 font-medium text-lg">Tiến độ: {printIndex} / {printQueue.length} tem</p>
                    
                    {printIndex < printQueue.length ? (
                        <button 
                            onClick={printNext} 
                            className="bg-blue-600 hover:bg-blue-700 text-white w-full py-4 rounded-xl font-bold text-xl shadow-md transition-transform active:scale-95 mb-3 cursor-pointer"
                        >
                            IN TEM TIẾP THEO ({printQueue[printIndex]}k)
                        </button>
                    ) : (
                        <button 
                            onClick={onClose} 
                            className="bg-green-600 hover:bg-green-700 text-white w-full py-4 rounded-xl font-bold text-xl shadow-md transition-transform active:scale-95 mb-3 cursor-pointer"
                        >
                            ✅ HOÀN TẤT
                        </button>
                    )}
                    
                    {printIndex < printQueue.length && (
                        <button 
                            onClick={onClose} 
                            className="text-gray-400 hover:text-white font-bold py-2 mt-2 cursor-pointer"
                        >
                            Hủy in các tem còn lại
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-start justify-center pt-32 px-4">
            <div className="bg-[#1c242f] rounded-xl p-5 w-full max-w-sm flex flex-col overflow-hidden shadow-2xl border border-white/10">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold text-blue-400">💰 Nhập giá</h3>
                    <button
                        type="button"
                        onClick={() => setUseFormulaCalc(true)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-950/70 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-xs"
                    >
                        <span>🧮 Bảng tính (Giá x SL)</span>
                    </button>
                </div>
                <div className="text-center font-black text-xl text-red-500 flex items-center justify-center gap-1.5 flex-wrap">
                    <span>{PLATFORMS[pendingPrint.platform].label} -</span>
                    {store[pendingPrint.platform].tags?.[cleanUser] && store[pendingPrint.platform].tags?.[cleanUser] !== 'NORMAL' && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold text-white shrink-0 ${
                            store[pendingPrint.platform].tags?.[cleanUser] === 'HOST' ? 'bg-yellow-500 text-black border border-yellow-400 font-black' :
                            store[pendingPrint.platform].tags?.[cleanUser] === 'VIP' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                            store[pendingPrint.platform].tags?.[cleanUser] === 'COC' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
                            store[pendingPrint.platform].tags?.[cleanUser] === 'COC_100' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                            store[pendingPrint.platform].tags?.[cleanUser] === 'DAO' ? 'bg-gray-500/20 text-gray-300 border border-white/10' :
                            store[pendingPrint.platform].tags?.[cleanUser] === 'BOM' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                            'bg-black text-red-400 border border-red-500/40'
                        }`}>
                            {store[pendingPrint.platform].tags?.[cleanUser] === 'HOST' ? '👑 HOST' :
                             store[pendingPrint.platform].tags?.[cleanUser] === 'VIP' ? '🌟 Quen' :
                             store[pendingPrint.platform].tags?.[cleanUser] === 'COC' ? '💧 Cọc 50k' :
                             store[pendingPrint.platform].tags?.[cleanUser] === 'COC_100' ? '💧 Cọc 100k' :
                             store[pendingPrint.platform].tags?.[cleanUser] === 'DAO' ? '👻 Dạo' :
                             store[pendingPrint.platform].tags?.[cleanUser] === 'BOM' ? '⚠️ BOM' : '⛔ Chặn'}
                        </span>
                    )}
                    <span>{store[pendingPrint.platform].nicknames?.[cleanUser] ? `${cleanUser} (${store[pendingPrint.platform].nicknames[cleanUser]})` : cleanUser}</span>
                </div>
                <div className="text-center text-sm text-gray-400 mt-1">
                    {cust ? `Phiên này: ${cust.count} cái | Tổng: ${cust.total}k` : ''}
                </div>

                {/* Quick Tag Selector */}
                <div className="flex items-center justify-center gap-1 mt-2 mb-1 flex-wrap">
                    {(['NORMAL', 'HOST', 'VIP', 'COC', 'COC_100', 'GIU', 'DAO', 'BOM'] as const).map(t => {
                        const currentTag = store[pendingPrint.platform].tags?.[cleanUser] || 'NORMAL';
                        const isSelected = currentTag === t;
                        return (
                            <button
                                key={t}
                                type="button"
                                onClick={() => store.setCustomerTag(pendingPrint.platform, cleanUser, t)}
                                className={`px-2 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                                    isSelected 
                                        ? (t === 'HOST' ? 'bg-yellow-500 border-yellow-400 text-black font-black shadow-sm ring-1 ring-yellow-300' :
                                           t === 'COC' ? 'bg-cyan-600 border-cyan-500 text-white shadow-sm ring-1 ring-cyan-400' :
                                           t === 'COC_100' ? 'bg-blue-600 border-blue-500 text-white shadow-sm ring-1 ring-blue-400' :
                                           t === 'GIU' ? 'bg-amber-600 border-amber-500 text-white shadow-sm ring-1 ring-amber-400' :
                                           t === 'VIP' ? 'bg-orange-500 border-orange-400 text-white shadow-sm' :
                                           t === 'DAO' ? 'bg-gray-600 border-gray-500 text-white' :
                                           t === 'BOM' ? 'bg-red-600 border-red-500 text-white' :
                                           'bg-green-600 border-green-500 text-white')
                                        : 'bg-[#0e1621] border-white/10 text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                {t === 'NORMAL' ? 'Thường' :
                                 t === 'HOST' ? '👑 Host' :
                                 t === 'VIP' ? '🌟 Quen' :
                                 t === 'COC' ? '💧 Cọc 50k' :
                                 t === 'COC_100' ? '💧 Cọc 100k' :
                                 t === 'GIU' ? '📦 Giữ hàng' :
                                 t === 'DAO' ? '👻 Dạo' : '⚠️ BOM'}
                            </button>
                        );
                    })}
                </div>

                {/* Smart Price Suggestions Bar */}
                <div className="mt-2.5 flex flex-col gap-1.5 bg-[#0e1621]/90 p-2.5 rounded-xl border border-white/10">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                            ⚡ Gợi ý giá thông minh
                        </span>
                        {lastClosed && (
                            <span className="text-[10px] text-gray-400">
                                Chốt gần nhất: <span className="text-emerald-400 font-bold">{lastClosed}k</span>
                            </span>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Host Flow Price Button */}
                        {flowPrice?.price && (
                            <button
                                type="button"
                                onClick={() => {
                                    setPrice(flowPrice.price);
                                    setTimeout(() => {
                                        inputRef.current?.focus();
                                        inputRef.current?.select();
                                    }, 50);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/35 border border-yellow-500/50 text-yellow-300 font-black text-xs inline-flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-xs"
                                title="Giá do Host gợi ý trên live"
                            >
                                <span>👑 Host: {flowPrice.price}k</span>
                            </button>
                        )}

                        {/* Last Closed Price Button */}
                        {lastClosed && lastClosed !== flowPrice?.price && (
                            <button
                                type="button"
                                onClick={() => {
                                    setPrice(lastClosed);
                                    setTimeout(() => {
                                        inputRef.current?.focus();
                                        inputRef.current?.select();
                                    }, 50);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-500/50 text-emerald-300 font-black text-xs inline-flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-xs"
                                title="Giá đơn hàng chốt gần nhất"
                            >
                                <span>⚡ Chốt: {lastClosed}k</span>
                            </button>
                        )}

                        {/* 3 Most Recent Search Bar Prices */}
                        {searchPrices.map((sp, idx) => (
                            <button
                                key={`sp_${idx}`}
                                type="button"
                                onClick={() => {
                                    setPrice(sp);
                                    setTimeout(() => {
                                        inputRef.current?.focus();
                                        inputRef.current?.select();
                                    }, 50);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/35 border border-blue-500/50 text-blue-300 font-bold text-xs inline-flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-xs"
                                title="Giá chủ live nhập gần nhất ở ô tìm kiếm"
                            >
                                <span>🔍 {sp}k</span>
                            </button>
                        ))}

                        {/* Other Recent Closed Prices if not in list */}
                        {recentClosedPrices
                            .filter(rp => rp !== lastClosed && rp !== flowPrice?.price && !searchPrices.includes(rp))
                            .slice(0, 2)
                            .map((rp, idx) => (
                                <button
                                    key={`rp_${idx}`}
                                    type="button"
                                    onClick={() => {
                                        setPrice(rp);
                                        setTimeout(() => {
                                            inputRef.current?.focus();
                                            inputRef.current?.select();
                                        }, 50);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-gray-200 font-bold text-xs inline-flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                                >
                                    <span>{rp}k</span>
                                </button>
                            ))
                        }
                    </div>
                </div>

                <input 
                    ref={inputRef} 
                    type="text" 
                    inputMode="decimal" 
                    value={price} 
                    onChange={e => setPrice(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && confirm()} 
                    placeholder="Nhập giá (VD: 65 hoặc 29-29)" 
                    className="w-full p-3 bg-[#0e1621] text-white placeholder-gray-400 border border-white/20 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 rounded-lg text-xl text-center mt-3 font-bold outline-none" 
                />
                <div className="flex gap-3 mt-5">
                    <button onClick={onClose} className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg cursor-pointer transition-colors">Đóng</button>
                    <button onClick={confirm} className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg cursor-pointer transition-colors">IN NGAY</button>
                </div>
            </div>
        </div>
    );
}

export function ManualModal({ onClose, onOpenProfile, isPage }: { onClose: () => void, onOpenProfile: (u: string, p: Platform) => void, isPage?: boolean }) {
    const store = useStore();
    const [platform, setPlatform] = useState<Platform>('tiktok');
    const [user, setUser] = useState('');
    const [content, setContent] = useState('');
    const [price, setPrice] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isPage) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isPage]);

    const suggestions = useMemo(() => {
        if (!user.trim()) return [];
        const keyword = user.trim().toLowerCase();
        const custs = store[platform].customers;
        const nicks = store[platform].nicknames || {};
        const tags = store[platform].tags || {};
        
        let matches: {username: string, nickname: string, tag: string, count: number, total: number}[] = [];
        Object.keys(custs).forEach(username => {
            const nickname = nicks[username] || '';
            const tag = tags[username] || 'NORMAL';
            const shortId = getShortId(username).toLowerCase();
            if (
                username.toLowerCase().includes(keyword) || 
                nickname.toLowerCase().includes(keyword) ||
                shortId.includes(keyword) ||
                ('#' + shortId).includes(keyword)
            ) {
                matches.push({ 
                    username, 
                    nickname,
                    tag,
                    count: custs[username]?.count || 0,
                    total: custs[username]?.total || 0
                });
            }
        });
        matches.sort((a,b) => (custs[b.username]?.lastTime || 0) - (custs[a.username]?.lastTime || 0));
        return matches.slice(0, 8);
    }, [user, platform, store]);

    const confirm = () => {
        const u = user.trim();
        if (!u) { inputRef.current?.focus(); return; }
        const c = content.trim();
        const p = price.trim();
        
        if (p) {
            let time = new Date().toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit'});
            store.printNewOrder(platform, u, c, p, time, null);
        } else {
            // Just init customer
            store.initCustomer(platform, u);
            onOpenProfile(u, platform);
        }
        
        setUser('');
        setContent('');
        setPrice('');
        if (!isPage) {
            inputRef.current?.focus();
            onClose();
        }
    };

    return (
        <div className={isPage ? "h-full w-full flex items-center justify-center p-2" : "fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-2 sm:p-4"}>
            <div className={`bg-[#1c242f] ${isPage ? "w-full h-full flex flex-col" : "rounded-xl p-5 w-full max-w-sm flex flex-col overflow-hidden shadow-2xl border border-white/10"}`}>
                <h3 className="text-xl font-bold text-blue-400 text-center mb-4">✍️ Tạo đơn tay</h3>
                <select 
                    value={platform} 
                    onChange={e => setPlatform(e.target.value as Platform)} 
                    className="w-full p-3 bg-[#0e1621] text-white border border-white/20 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 rounded-lg mb-3 font-bold outline-none cursor-pointer"
                >
                    <option value="tiktok" className="bg-[#1c242f] text-white">🎵 TikTok</option>
                    <option value="facebook" className="bg-[#1c242f] text-white">📘 Facebook</option>
                    <option value="shopee" className="bg-[#1c242f] text-white">🛒 Shopee</option>
                </select>
                
                <div className="relative mb-3">
                    <input 
                        ref={inputRef} 
                        value={user} 
                        onChange={e => { setUser(e.target.value); setShowSuggestions(true); }} 
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        placeholder="Tên top khách" 
                        className="w-full p-3 bg-[#0e1621] text-white placeholder-gray-400 border border-white/20 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 rounded-lg font-bold outline-none" 
                    />
                    {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 bg-[#1c242f] border border-white/20 rounded-lg shadow-xl mt-1 z-50 max-h-56 overflow-y-auto divide-y divide-white/5">
                            {suggestions.map((s, idx) => (
                                <div 
                                    key={idx} 
                                    className="p-2.5 cursor-pointer hover:bg-white/10 flex justify-between items-center transition-colors gap-2"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        setUser(s.username);
                                        setShowSuggestions(false);
                                    }}
                                >
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
                                        <span className="text-[11px] font-mono font-bold text-gray-400 bg-black/40 px-1.5 py-0.5 rounded border border-white/10 shrink-0">
                                            #{getShortId(s.username)}
                                        </span>
                                        {s.tag !== 'NORMAL' && (
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold text-white shrink-0 ${
                                                s.tag === 'VIP' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                                                s.tag === 'COC' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
                                                s.tag === 'COC_100' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                                s.tag === 'DAO' ? 'bg-gray-500/20 text-gray-300 border border-white/10' :
                                                s.tag === 'BOM' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                                'bg-black text-red-400 border border-red-500/40'
                                            }`}>
                                                {s.tag === 'VIP' ? '🌟 Quen' :
                                                 s.tag === 'COC' ? '💧 Cọc 50k' :
                                                 s.tag === 'COC_100' ? '💧 Cọc 100k' :
                                                 s.tag === 'DAO' ? '👻 Dạo' :
                                                 s.tag === 'BOM' ? '⚠️ BOM' : '⛔ Chặn'}
                                            </span>
                                        )}
                                        <span className="font-bold text-white truncate">{s.username}</span>
                                        {s.nickname && <span className="text-xs text-gray-400 italic px-1.5 py-0.5 bg-[#0e1621] rounded truncate">({s.nickname})</span>}
                                    </div>
                                    {s.count > 0 && (
                                        <span className="text-xs text-blue-400 font-bold ml-1 shrink-0">{s.count} cái</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <input 
                    value={content} 
                    onChange={e => setContent(e.target.value)} 
                    placeholder="Nội dung (không bắt buộc)" 
                    className="w-full p-3 bg-[#0e1621] text-white placeholder-gray-400 border border-white/20 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 rounded-lg mb-3 font-medium outline-none" 
                />
                <input 
                    type="number" 
                    value={price} 
                    onChange={e => setPrice(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && confirm()} 
                    placeholder="Giá (để trống nếu chỉ lưu tên)" 
                    className="w-full p-3 bg-[#0e1621] text-white placeholder-gray-400 border border-white/20 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 rounded-lg mb-4 font-bold text-lg outline-none" 
                />
                
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg cursor-pointer transition-colors">Đóng</button>
                    <button onClick={confirm} className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg cursor-pointer transition-colors">LƯU / IN</button>
                </div>
            </div>
        </div>
    );
}

export function ListModal({ filterPlatform, onClose, onOpenProfile, onOpenPrice, onOpenPancakeLink, isPage, onScroll, onSetFilter, searchKeyword = '' }: { filterPlatform?: Platform, onClose: () => void, onOpenProfile: (u: string, p: Platform) => void, onOpenPrice?: (id: string | null, u: string, p: Platform) => void, onOpenPancakeLink?: (user: string, platform: Platform, initialSearch?: string) => void, isPage?: boolean, onScroll?: (isDown: boolean) => void, onSetFilter?: (p: Platform | undefined) => void, searchKeyword?: string }) {
    const store = useStore();
    const [listSearch, setListSearch] = useState('');
    const [sortBy, setSortBy] = useState<'newest' | 'count' | 'revenue'>('newest');
    const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | '7days' | 'custom'>('all');
    const [customDate, setCustomDate] = useState<string>('');
    const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
        try {
            return (localStorage.getItem('slp_cart_view_mode') as 'list' | 'grid') || 'list';
        } catch {
            return 'list';
        }
    });
    const handleSetViewMode = (mode: 'list' | 'grid') => {
        setViewMode(mode);
        try {
            localStorage.setItem('slp_cart_view_mode', mode);
        } catch {}
    };

    const getItemTimestamp = (item: OrderItem, fallbackTs?: number): number => {
        if (item.createdAt) return item.createdAt;
        if (item.id) {
            const match = String(item.id).match(/^(\d{13})/);
            if (match) return parseInt(match[1], 10);
        }
        return fallbackTs || 0;
    };

    const isTimestampInDateFilter = (ts: number): boolean => {
        if (dateFilter === 'all') return true;
        if (!ts) return false;
        const itemDate = new Date(ts);
        const now = new Date();

        if (dateFilter === 'today') {
            return itemDate.getFullYear() === now.getFullYear() &&
                   itemDate.getMonth() === now.getMonth() &&
                   itemDate.getDate() === now.getDate();
        }
        if (dateFilter === 'yesterday') {
            const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            return itemDate.getFullYear() === y.getFullYear() &&
                   itemDate.getMonth() === y.getMonth() &&
                   itemDate.getDate() === y.getDate();
        }
        if (dateFilter === '7days') {
            const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
            return ts >= sevenDaysAgo && ts <= now.getTime();
        }
        if (dateFilter === 'custom' && customDate) {
            const [targetY, targetM, targetD] = customDate.split('-').map(Number);
            return itemDate.getFullYear() === targetY &&
                   (itemDate.getMonth() + 1) === targetM &&
                   itemDate.getDate() === targetD;
        }
        return true;
    };

    const [lastScrollY, setLastScrollY] = useState(0);
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const currentY = e.currentTarget.scrollTop;
        if (onScroll) {
            if (currentY > lastScrollY + 5 && currentY > 20) {
                onScroll(true); // Lướt xuống
            } else if (currentY < lastScrollY - 5) {
                onScroll(false); // Lướt lên
            }
        }
        setLastScrollY(currentY);
    };
    
    let allRows: {user: string, platform: Platform, c: CustomerData, displayItems: OrderItem[], originalIndices: number[]}[] = [];
    (['tiktok', 'facebook', 'shopee'] as Platform[]).forEach(p => {
        if (filterPlatform && p !== filterPlatform) return;
        const custs = store[p].customers;
        Object.keys(custs).forEach(rawUser => {
            const user = normalizeUser(rawUser);
            const cust = custs[rawUser];
            if (!cust) return;

            // 1. Loại bỏ đơn hàng / sản phẩm trùng lặp ID (đảm bảo mỗi ID chỉ hiển thị 1 lần duy nhất trong giỏ hàng)
            const uniqueCurrent = deduplicateOrderItems(cust.items || []);
            const uniquePast = deduplicateOrderItems(cust.pastItems || []);

            let displayItems: OrderItem[] = [];
            let originalIndices: number[] = [];

            if (dateFilter === 'all') {
                displayItems = uniqueCurrent;
                originalIndices = uniqueCurrent.map((_, i) => i);
            } else {
                // Khi lọc theo ngày: lọc các món trong phiên này và cả phiên cũ phù hợp với ngày được chọn
                const allItems = [...uniqueCurrent, ...uniquePast];
                displayItems = allItems.filter(it => isTimestampInDateFilter(getItemTimestamp(it, cust.lastTime)));
                originalIndices = displayItems.map(it => uniqueCurrent.findIndex(ci => ci.id === it.id));
            }

            if (displayItems.length > 0) {
                const total = displayItems.reduce((sum, it) => sum + (it.price || 0), 0);
                allRows.push({ 
                    user, 
                    platform: p, 
                    c: {
                        ...cust,
                        count: displayItems.length,
                        total,
                        items: displayItems
                    },
                    displayItems,
                    originalIndices
                });
            }
        });
    });

    const effectiveListSearch = (listSearch || searchKeyword || '').trim().toLowerCase();
    if (effectiveListSearch) {
        const query = effectiveListSearch;
        const isIdQuery = query.startsWith('#') || /^\d+$/.test(query);
        const targetId = query.startsWith('#') ? query.slice(1) : query;

        allRows = allRows.filter(r => {
            const userTag = store[r.platform].tags[r.user];
            if (query === '/coc' && userTag === 'COC') return true;
            if (query === '/quen' && userTag === 'VIP') return true;
            if (query === '/vip' && userTag === 'VIP') return true;
            if (query === '/dao' && userTag === 'DAO') return true;
            if (query === '/chan' && userTag === 'CHAN') return true;
            if (query.startsWith('/')) return false;
            
            const nick = store[r.platform].nicknames?.[r.user] || '';
            const shortId = getShortId(r.user).toLowerCase();

            // So khớp ID chính xác khi tìm kiếm mã ID (loại bỏ việc 1 ID tìm ra 3 người khác nhau)
            if (isIdQuery) {
                return shortId === targetId || ('#' + shortId) === query;
            }

            return r.user.toLowerCase().includes(query) || nick.toLowerCase().includes(query);
        });
    }

    if (sortBy === 'newest') {
        allRows.sort((a,b) => b.c.lastTime - a.c.lastTime);
    } else if (sortBy === 'count') {
        allRows.sort((a,b) => {
            if (b.c.count !== a.c.count) return b.c.count - a.c.count;
            return b.c.lastTime - a.c.lastTime;
        });
    } else {
        allRows.sort((a,b) => {
            if (b.c.total !== a.c.total) return b.c.total - a.c.total;
            return b.c.lastTime - a.c.lastTime;
        });
    }

    return (
        <div className={isPage ? "h-full w-full flex flex-col bg-[#0e1621]" : "fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-2 sm:p-4"}>
            <div className={`w-full ${isPage ? "h-full flex flex-col bg-[#0e1621]" : "bg-[#1c242f] rounded-xl border border-white/10 max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"}`}>
                {!isPage && <div className="flex justify-between items-center p-4 border-b border-white/10 shrink-0">
                    <h3 className="text-lg font-bold text-gray-100 m-0">
                        {filterPlatform ? `📋 GIỎ HÀNG - ${PLATFORMS[filterPlatform].label}` : "📋 GIỎ HÀNG - TỔNG CHUNG"}
                    </h3>
                    <button onClick={onClose} className="bg-white/10 rounded-full w-8 h-8 flex items-center justify-center font-bold text-gray-400 hover:bg-white/20">✕</button>
                </div>}
                
                {/* Platform Filter Bar & Sort Controls */}
                <div className="p-3 bg-[#1c242f] border-b border-white/10 shrink-0 space-y-2.5">
                    <div className="flex gap-1.5 overflow-x-auto pb-0.5 hide-scrollbar">
                        <button
                            onClick={() => onSetFilter?.(undefined)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                                !filterPlatform 
                                    ? 'bg-blue-600 text-white shadow-sm' 
                                    : 'bg-[#0e1621] border border-white/10 text-gray-400 hover:bg-white/5'
                            }`}
                        >
                            🌐 Tất cả ({allRows.length})
                        </button>
                        {(['tiktok', 'facebook', 'shopee'] as Platform[]).map(p => {
                            const count = Object.values(store[p].customers).filter((c: any) => c.count > 0).length;
                            return (
                                <button
                                    key={p}
                                    onClick={() => onSetFilter?.(filterPlatform === p ? undefined : p)}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                                        filterPlatform === p 
                                            ? `${PLATFORMS[p].bgClass} text-white shadow-sm ring-2 ring-white/20` 
                                            : 'bg-[#0e1621] border border-white/10 text-gray-400 hover:bg-white/5'
                                    }`}
                                >
                                    {PLATFORMS[p].label} ({count})
                                </button>
                            );
                        })}
                    </div>

                    {/* Date Filter Bar */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 hide-scrollbar text-xs">
                        <span className="text-gray-400 font-bold text-[11px] shrink-0 flex items-center gap-1">
                            <Calendar size={13} className="text-blue-400" /> Ngày:
                        </span>
                        <button
                            onClick={() => { setDateFilter('all'); setCustomDate(''); }}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                                dateFilter === 'all' ? 'bg-blue-600 text-white shadow-sm' : 'bg-[#0e1621] text-gray-400 border border-white/10 hover:text-white'
                            }`}
                        >
                            Tất cả
                        </button>
                        <button
                            onClick={() => { setDateFilter('today'); setCustomDate(''); }}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                                dateFilter === 'today' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-[#0e1621] text-gray-400 border border-white/10 hover:text-white'
                            }`}
                        >
                            🟢 Hôm nay
                        </button>
                        <button
                            onClick={() => { setDateFilter('yesterday'); setCustomDate(''); }}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                                dateFilter === 'yesterday' ? 'bg-amber-600 text-white shadow-sm' : 'bg-[#0e1621] text-gray-400 border border-white/10 hover:text-white'
                            }`}
                        >
                            🟡 Hôm qua
                        </button>
                        <button
                            onClick={() => { setDateFilter('7days'); setCustomDate(''); }}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                                dateFilter === '7days' ? 'bg-purple-600 text-white shadow-sm' : 'bg-[#0e1621] text-gray-400 border border-white/10 hover:text-white'
                            }`}
                        >
                            🕒 7 ngày qua
                        </button>
                        <div className="flex items-center gap-1 shrink-0">
                            <input 
                                type="date" 
                                value={customDate} 
                                onChange={(e) => {
                                    setCustomDate(e.target.value);
                                    if (e.target.value) setDateFilter('custom');
                                    else setDateFilter('all');
                                }}
                                className={`px-2 py-0.5 rounded-md text-[11px] bg-[#0e1621] border transition-colors text-gray-200 cursor-pointer ${
                                    dateFilter === 'custom' ? 'border-blue-500 ring-1 ring-blue-500 text-white' : 'border-white/10'
                                }`}
                                title="Chọn ngày cụ thể để xem giỏ hàng"
                            />
                            {dateFilter === 'custom' && (
                                <button 
                                    onClick={() => { setCustomDate(''); setDateFilter('all'); }}
                                    className="text-gray-400 hover:text-white text-xs px-1"
                                    title="Xóa lọc ngày"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                        <div className="flex gap-1.5 flex-1">
                            <button 
                                onClick={() => setSortBy('newest')}
                                className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${sortBy === 'newest' ? 'bg-blue-600 border-blue-500 text-white shadow-sm' : 'bg-[#0e1621] border-white/10 text-gray-400'}`}
                            >
                                🕒 Mới nhất
                            </button>
                            <button 
                                onClick={() => setSortBy('count')}
                                className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${sortBy === 'count' ? 'bg-blue-600 border-blue-500 text-white shadow-sm' : 'bg-[#0e1621] border-white/10 text-gray-400'}`}
                            >
                                📦 Số lượng
                            </button>
                            <button 
                                onClick={() => setSortBy('revenue')}
                                className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${sortBy === 'revenue' ? 'bg-blue-600 border-blue-500 text-white shadow-sm' : 'bg-[#0e1621] border-white/10 text-gray-400'}`}
                            >
                                💰 Doanh thu
                            </button>
                        </div>
                        {/* Toggle Chế độ xem: Danh sách vs Dạng ô vuông */}
                        <div className="flex items-center bg-[#0e1621] p-1 rounded-xl border border-white/10 shrink-0 shadow-inner">
                            <button
                                type="button"
                                onClick={() => handleSetViewMode('list')}
                                className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                                    viewMode === 'list'
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'text-gray-400 hover:text-white'
                                }`}
                                title="Xem dạng danh sách"
                            >
                                <List size={16} />
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSetViewMode('grid')}
                                className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                                    viewMode === 'grid'
                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md ring-1 ring-white/20'
                                        : 'text-gray-400 hover:text-white'
                                }`}
                                title="Xem dạng ô vuông (Grid)"
                            >
                                <LayoutGrid size={16} />
                            </button>
                        </div>
                    </div>
                </div>
                
                <div className="overflow-y-auto flex-1 p-2 sm:p-4 bg-[#0e1621] pb-24" onScroll={handleScroll}>
                    {allRows.length === 0 ? (
                        <div className="text-center text-gray-400 py-16 bg-[#1c242f]/50 rounded-2xl border border-dashed border-white/10">
                            <div className="text-3xl mb-2">🛒</div>
                            <div className="text-sm font-medium">Chưa có đơn chốt nào trong phiên này</div>
                        </div>
                    ) : viewMode === 'grid' ? (
                        /* CHẾ ĐỘ XEM DẠNG Ô VUÔNG (SQUARE TILES GRID) CHO GIỎ HÀNG */
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3 p-1">
                            {allRows.map((row, idx) => {
                                const tag = store[row.platform].tags[row.user] || 'NORMAL';
                                const commentWithAvatar = store[row.platform].comments.find(c => c.user === row.user && c.avatar);
                                const avatarUrl = commentWithAvatar?.avatar;
                                const pLink = store[row.platform].pancakeLinks?.[row.user];
                                const detectedPhone = row.c.items?.map(it => it.content).find(content => {
                                    if (!content) return false;
                                    const match = content.match(/(0[3|5|7|8|9][0-9]{8})/);
                                    return match ? match[0] : null;
                                });
                                const nickname = store[row.platform].nicknames?.[row.user];
                                const displayName = nickname ? `${row.user} (${nickname})` : row.user;

                                return (
                                    <div 
                                        key={`order-grid-${row.platform}-${row.user}-${idx}`} 
                                        onClick={() => onOpenProfile?.(row.user, row.platform)}
                                        className="bg-[#151f2e] hover:bg-[#1a273a] p-3 rounded-2xl border border-white/10 hover:border-blue-500/50 transition-all flex flex-col justify-between shadow-md hover:shadow-xl group relative cursor-pointer active:scale-[0.99]"
                                        title="Bấm vào thẻ để xem chi tiết giỏ hàng"
                                    >
                                        <div>
                                            {/* Top: Avatar on left, Full Name & #ID on right, Copy icon */}
                                            <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-white/10">
                                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                    <CustomerAvatar 
                                                        user={row.user} 
                                                        platform={row.platform} 
                                                        avatarUrl={avatarUrl} 
                                                        tag={tag} 
                                                        size="md" 
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-[10px] font-mono font-bold text-gray-400">
                                                            #{getShortId(row.user)}
                                                        </div>
                                                        <div 
                                                            className="font-bold text-white text-sm truncate group-hover:text-blue-400 transition-colors"
                                                            title={displayName}
                                                        >
                                                            {displayName}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div onClick={(e) => e.stopPropagation()}>
                                                    <CopyButton text={displayName} className="text-xs text-gray-500 hover:text-gray-300 shrink-0" />
                                                </div>
                                            </div>

                                            {/* Middle: Mini Price Chips of all items in cart */}
                                            {(() => {
                                                const custIns = getCustomerInsight(row.user);
                                                const custObj = store[row.platform].customers[row.user];
                                                const sStat = checkCustomerPancakeShippedStatus(custObj, custIns);
                                                if (sStat.isAllShipped && sStat.latestPancakeOrder) {
                                                    return (
                                                        <div className="flex items-center justify-center my-1.5">
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-1">
                                                                ✅ Đã đi hết đơn (#{sStat.latestPancakeOrder.orderNumber})
                                                            </span>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()}
                                            <div className="flex flex-wrap items-center justify-center gap-1.5 my-2 min-h-[26px] max-h-14 overflow-y-auto hide-scrollbar">
                                                {row.displayItems.slice(0, 4).map((item, itIdx) => (
                                                    <span key={itIdx} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-950/70 border border-red-500/30 text-red-300">
                                                        {item.price}k
                                                    </span>
                                                ))}
                                                {row.displayItems.length > 4 && (
                                                    <span className="text-[10px] font-bold text-gray-400 bg-white/10 px-1.5 py-0.5 rounded">
                                                        +{row.displayItems.length - 4}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Bottom: Total Items & Total Amount (left) + Action Icons (right) */}
                                        <div className="pt-2 mt-1 border-t border-white/10 flex items-center justify-between gap-2 bg-[#0d1520] -mx-3 -mb-3 p-2.5 rounded-b-2xl">
                                            {/* Tổng cái và Tổng tiền */}
                                            <div className="flex items-center gap-1.5 text-xs font-black min-w-0">
                                                {(() => {
                                                const custIns = getCustomerInsight(row.user);
                                                const custObj = store[row.platform].customers[row.user];
                                                const sStat = checkCustomerPancakeShippedStatus(custObj, custIns);
                                                if (sStat.isAllShipped) {
                                                    return (
                                                        <span className="text-emerald-400 font-extrabold truncate flex items-center gap-1">
                                                            <span>✅ Đã đi hết</span>
                                                            <span className="text-[10px] text-emerald-300/80 font-normal">({row.c.count} món)</span>
                                                        </span>
                                                    );
                                                }
                                                return (
                                                    <>
                                                        <span className="text-cyan-400 font-extrabold truncate">{row.c.count} món</span>
                                                        <span className="text-white/20">·</span>
                                                        <span className="text-emerald-400 font-extrabold truncate">{row.c.total}k</span>
                                                    </>
                                                );
                                            })()}
                                            </div>

                                            {/* 2 icon Pancake & Thêm đơn chuyển xuống góc dưới */}
                                            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                                {pLink ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => openPancakeApp(pLink, true)}
                                                        className="w-6 h-6 rounded-md bg-orange-600 hover:bg-orange-500 text-white font-bold flex items-center justify-center text-[10px] cursor-pointer shadow-xs active:scale-90 transition-transform"
                                                        title="Mở chat Pancake / Zalo"
                                                    >
                                                        <span>🥞</span>
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => onOpenPancakeLink?.(row.user, row.platform, detectedPhone || undefined)}
                                                        className="w-6 h-6 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 font-bold flex items-center justify-center text-[9px] cursor-pointer active:scale-90 transition-transform"
                                                        title="Gán Pancake / Zalo"
                                                    >
                                                        <span>🥞+</span>
                                                    </button>
                                                )}
                                                {onOpenPrice && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onOpenPrice(null, row.user, row.platform)}
                                                        className="w-6 h-6 rounded-md text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 hover:bg-emerald-900/60 flex items-center justify-center cursor-pointer active:scale-90 transition-transform"
                                                        title="Chốt thêm món"
                                                    >
                                                        <Plus size={13} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {allRows.map((row, idx) => (
                            <div key={`order-${row.platform}-${row.user}-${idx}`} className="mb-3 bg-[#1c242f] p-3 rounded-2xl shadow-sm border border-white/5 hover:border-white/15 transition-all">
                                <div className="flex justify-between items-center mb-2.5 pb-2 border-b border-white/10">
                                    <div className="flex-1 flex items-center gap-3 min-w-0 pr-2">
                                        {(() => {
                                            const tag = store[row.platform].tags[row.user] || 'NORMAL';
                                            const commentWithAvatar = store[row.platform].comments.find(c => c.user === row.user && c.avatar);
                                            const avatarUrl = commentWithAvatar?.avatar;
                                            return (
                                                <>
                                                    <CustomerAvatar 
                                                        user={row.user} 
                                                        platform={row.platform} 
                                                        avatarUrl={avatarUrl} 
                                                        tag={tag} 
                                                        size="md" 
                                                        onClick={() => onOpenProfile?.(row.user, row.platform)} 
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <button
                                                                onClick={() => onOpenProfile?.(row.user, row.platform)}
                                                                className="font-black text-white hover:text-blue-400 hover:underline cursor-pointer text-base sm:text-lg bg-transparent p-0 border-0 text-left break-words"
                                                                title="Bấm để xem hồ sơ"
                                                            >
                                                                {idx+1}. {store[row.platform].nicknames?.[row.user] ? `${row.user} (${store[row.platform].nicknames[row.user]})` : `#${getShortId(row.user)} ${row.user}`}
                                                            </button>
                                                            <CopyButton text={store[row.platform].nicknames?.[row.user] ? `${row.user} (${store[row.platform].nicknames[row.user]})` : `#${getShortId(row.user)} ${row.user}`} className="text-xs shrink-0 text-gray-400" />
                                                            {(() => {
                                                                const ins = getCustomerInsight(row.user);
                                                                if (ins) {
                                                                    if (ins.isReturningCustomer) {
                                                                        return (
                                                                            <span className="bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0">
                                                                                👑 {ins.totalOrdersCount} đơn
                                                                            </span>
                                                                        );
                                                                    } else {
                                                                        return (
                                                                            <span className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0">
                                                                                🆕 Mới
                                                                            </span>
                                                                        );
                                                                    }
                                                                }
                                                                return null;
                                                            })()}
                                                            {(() => {
                                                                const pLink = store[row.platform].pancakeLinks?.[row.user];
                                                                const detectedPhone = row.c.items?.map(it => it.content).find(content => {
                                                                    if (!content) return false;
                                                                    const match = content.match(/(0[3|5|7|8|9][0-9]{8})/);
                                                                    return match ? match[1] : null;
                                                                });
                                                                if (pLink) {
                                                                    return (
                                                                        <div className="relative inline-flex items-center shrink-0">
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    openPancakeApp(pLink, true);
                                                                                }}
                                                                                title="🥞 Đã nối Zalo/Pancake (Bấm mở chat ngay)"
                                                                                className="px-2 py-0.5 rounded-md text-[11px] bg-orange-600 hover:bg-orange-500 text-white font-bold flex items-center gap-0.5 transition-all cursor-pointer shadow-sm active:scale-95 border border-orange-400/40"
                                                                            >
                                                                                <span>🥞</span>
                                                                                <span>Zalo</span>
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    onOpenPancakeLink?.(row.user, row.platform, detectedPhone || undefined);
                                                                                }}
                                                                                title="Đổi hoặc gán lại Zalo Pancake"
                                                                                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#111722] border border-orange-400/60 text-orange-300 hover:text-white flex items-center justify-center text-[9px] shadow cursor-pointer hover:scale-110 transition-transform"
                                                                            >
                                                                                <Edit3 size={9} />
                                                                            </button>
                                                                        </div>
                                                                    );
                                                                }
                                                                return (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            onOpenPancakeLink?.(row.user, row.platform, detectedPhone || undefined);
                                                                        }}
                                                                        title="🥞 Gán Zalo / Pancake (Chọn khách đang inbox)"
                                                                        className="px-2 py-0.5 rounded-md text-[11px] bg-amber-500/20 hover:bg-amber-500/35 border border-amber-500/50 text-amber-300 font-bold flex items-center gap-0.5 transition-all cursor-pointer active:scale-95 shadow-sm shrink-0"
                                                                    >
                                                                        <span>🥞+</span>
                                                                        <span>Gán</span>
                                                                    </button>
                                                                );
                                                            })()}
                                                            {onOpenPrice && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onOpenPrice(null, row.user, row.platform);
                                                                    }}
                                                                    title="Thêm món mới vào đơn khách này"
                                                                    className="text-emerald-300 hover:text-white bg-emerald-950/60 hover:bg-emerald-600/50 active:scale-90 px-2 py-0.5 rounded-md border border-emerald-500/40 transition-all cursor-pointer inline-flex items-center gap-1 font-bold text-xs shadow-xs shrink-0"
                                                                >
                                                                    <Plus size={12} className="stroke-[3]" />
                                                                    <span>Thêm món</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                    <span className="bg-blue-600 text-white px-2.5 py-1 rounded-lg text-[12px] font-black whitespace-nowrap shrink-0 shadow-sm">
                                        {row.c.count} SP | {row.c.total}k
                                    </span>
                                </div>

                                <div className="space-y-1.5 pl-1">
                                    {(row.displayItems || []).length === 0 ? (
                                        <div className="text-center text-gray-400 text-xs py-1 italic">(Không có chi tiết sản phẩm)</div>
                                    ) : (
                                        [...row.displayItems].reverse().map((item, reversedIdx) => {
                                            const itemIdx = row.displayItems.length - 1 - reversedIdx;
                                            const originalIdx = row.originalIndices ? row.originalIndices[itemIdx] : itemIdx;
                                            const itemUnitPrice = item.unitPrice || item.price;
                                            const itemQty = item.quantity || 1;
                                            const itemTotalK = item.price || (itemUnitPrice * itemQty);

                                            return (
                                            <div key={item.id || `disp-${itemIdx}`} className="flex justify-between items-center py-2 px-2.5 rounded-xl bg-[#121c28] border border-white/10 gap-2 mb-1">
                                                <div className="flex-1 min-w-0 flex items-center gap-2">
                                                    <span className="font-mono text-xs text-gray-400 font-bold bg-black/40 px-1.5 py-0.5 rounded">#{itemIdx + 1}</span>
                                                    <span className="text-gray-100 font-bold text-xs sm:text-sm truncate">
                                                        {(!item.content || item.content === "(Không ghi chú)" || item.content.includes("Không ghi chú")) ? `Sản phẩm #${itemIdx + 1}` : item.content}
                                                    </span>
                                                </div>

                                                {/* Formula Badge (Giá x SL) */}
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <div className="bg-[#0b131e] border border-cyan-500/30 px-2 py-0.5 rounded-lg flex items-center gap-1 font-mono text-xs">
                                                        <span className="text-cyan-300 font-bold">{itemUnitPrice}k</span>
                                                        <span className="text-gray-400 text-[10px]">×</span>
                                                        <span className="text-emerald-400 font-black">{itemQty}</span>
                                                    </div>
                                                    <span className="text-emerald-400 font-mono font-black text-sm min-w-[45px] text-right">{itemTotalK}k</span>
                                                </div>

                                                <div className="flex items-center gap-1.5 shrink-0 pl-1 border-l border-white/10">
                                                    <button 
                                                        onClick={() => {
                                                            let time = new Date().toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit'});
                                                            const cleanPrintContent = (!item.content || item.content === "(Không ghi chú)" || item.content.includes("Không ghi chú")) ? `(${itemUnitPrice}k x ${itemQty})` : `${item.content} (${itemUnitPrice}k x ${itemQty})`;
                                                            printLabel(store[row.platform].nicknames?.[row.user] ? `${row.user} (${store[row.platform].nicknames[row.user]})` : `#${getShortId(row.user)} ${row.user}`, cleanPrintContent, itemTotalK, time, PLATFORMS[row.platform].label);
                                                        }}
                                                        className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg px-2.5 py-1 font-bold text-xs whitespace-nowrap flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                                                    >
                                                        🖨️ IN
                                                    </button>
                                                    {originalIdx >= 0 && (
                                                        <DeleteConfirmButton 
                                                            onDelete={() => store.deleteOrderItem(row.platform, row.user, originalIdx)}
                                                            className="rounded-lg px-2 py-1"
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        )})
                                    )}
                                </div>
                            </div>
                        ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export function LiveEfficiencyModal({
    onClose,
    onOpenProfile,
    onOpenPrice,
    isPage,
    onScroll
}: {
    onClose?: () => void;
    onOpenProfile?: (u: string, p: Platform) => void;
    onOpenPrice?: (id: string | null, u: string, p: Platform) => void;
    isPage?: boolean;
    onScroll?: (isDown: boolean) => void;
}) {
    const store = useStore();
    const [timeRange, setTimeRange] = useState<'today' | 'yesterday' | '7days' | 'all'>('today');
    const [selectedPlatform, setSelectedPlatform] = useState<Platform | 'all'>('all');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [categorySearch, setCategorySearch] = useState('');

    const [lastScrollY, setLastScrollY] = useState(0);
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const currentY = e.currentTarget.scrollTop;
        if (onScroll) {
            if (currentY > lastScrollY + 5 && currentY > 20) {
                onScroll(true); // Lướt xuống
            } else if (currentY < lastScrollY - 5) {
                onScroll(false); // Lướt lên
            }
        }
        setLastScrollY(currentY);
    };

    // Analytics calculations
    let totalRevenue = 0;
    let totalOrders = 0;
    let totalInteractions = 0;
    let totalCustomers = 0;
    
    const priceCounts: Record<string, { count: number, revenue: number }> = {};
    const customerAgg: Record<string, { count: number, revenue: number, user: string, platform: Platform, tag: string, isNew: boolean, nickname: string }> = {};
    const hourCounts: Record<number, number> = {};

    // Grouped customer buckets by tag
    const categorizedCustomers: Record<string, Array<{ user: string, platform: Platform, count: number, revenue: number, tag: string, nickname: string }>> = {
        'NEW': [],
        'VIP': [],
        'COC': [],
        'COC_100': [],
        'NORMAL': [],
        'DAO': [],
        'BOM': [],
        'CHAN': [],
        'HOST': []
    };

    const now = Date.now();
    const todayObj = new Date();
    const todayStart = new Date(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate(), 0, 0, 0, 0).getTime();
    
    const yesterdayObj = new Date(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate() - 1);
    const yesterdayStart = new Date(yesterdayObj.getFullYear(), yesterdayObj.getMonth(), yesterdayObj.getDate(), 0, 0, 0, 0).getTime();
    
    const sevenDaysAgoStart = new Date(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate() - 6, 0, 0, 0, 0).getTime();

    (['tiktok', 'facebook', 'shopee'] as Platform[]).forEach(p => {
        if (selectedPlatform !== 'all' && p !== selectedPlatform) return;
        const platformStore = store[p];
        
        totalInteractions += platformStore.comments.length;
        
        Object.entries(platformStore.customers).forEach(([user, data]) => {
            const custData = data as CustomerData;
            const tag = platformStore.tags[user] || 'NORMAL';
            const nickname = platformStore.nicknames?.[user] || '';
            
            const currentItems = custData.items || [];
            const pastItems = custData.pastItems || [];
            
            // Reconcile current items if custData.count or custData.total exceeds currentItems array
            const currentSumPrice = currentItems.reduce((s, it) => s + (it.price || 0), 0);
            let effectiveCurrentItems = [...currentItems];
            if (custData.count > currentItems.length || custData.total > currentSumPrice) {
                const diffCount = Math.max(0, custData.count - currentItems.length);
                const diffPrice = Math.max(0, custData.total - currentSumPrice);
                const avgPrice = diffCount > 0 ? Math.round(diffPrice / diffCount) : diffPrice;
                for (let i = 0; i < (diffCount || 1); i++) {
                    effectiveCurrentItems.push({
                        id: `synth_curr_${custData.lastTime || now}_${i}`,
                        content: `Đơn đã chốt (${avgPrice}k)`,
                        price: avgPrice,
                        sourceCommentId: null,
                        createdAt: custData.lastTime || now,
                        shipped: false
                    });
                }
            }

            const allItemsWithMeta = [
                ...effectiveCurrentItems.map(it => ({ ...it, isPast: false })),
                ...pastItems.map(it => ({ ...it, isPast: true }))
            ];
            
            let userOrderCount = 0;
            let userRevenue = 0;

            allItemsWithMeta.forEach(item => {
                let itemTime: number;
                if (item.createdAt && item.createdAt > 1000000000000) {
                    itemTime = item.createdAt;
                } else if (item.id && String(item.id).match(/^(\d{13})/)) {
                    const parsed = parseInt(String(item.id).substring(0, 13));
                    itemTime = (parsed > 1500000000000 && parsed <= now + 86400000)
                        ? parsed 
                        : (item.isPast ? (custData.lastTime && custData.lastTime < todayStart ? custData.lastTime : yesterdayStart + 12 * 3600 * 1000) : (custData.lastTime || now));
                } else {
                    itemTime = item.isPast 
                        ? (custData.lastTime && custData.lastTime < todayStart ? custData.lastTime : yesterdayStart + 12 * 3600 * 1000) 
                        : (custData.lastTime || now);
                }

                let include = false;
                if (timeRange === 'today') {
                    include = itemTime >= todayStart;
                } else if (timeRange === 'yesterday') {
                    include = itemTime >= yesterdayStart && itemTime < todayStart;
                } else if (timeRange === '7days') {
                    include = itemTime >= sevenDaysAgoStart;
                } else if (timeRange === 'all') {
                    include = true;
                }

                if (include) {
                    userOrderCount++;
                    userRevenue += (item.price || 0);

                    const hour = new Date(itemTime).getHours();
                    hourCounts[hour] = (hourCounts[hour] || 0) + 1;

                    const priceStr = (item.price || 0).toString();
                    if (!priceCounts[priceStr]) priceCounts[priceStr] = { count: 0, revenue: 0 };
                    priceCounts[priceStr].count++;
                    priceCounts[priceStr].revenue += (item.price || 0);
                }
            });

            if (userOrderCount > 0) {
                totalOrders += userOrderCount;
                totalRevenue += userRevenue;
                totalCustomers++;

                const isNew = (custData.pastItems?.length || 0) === 0 && tag !== 'VIP' && tag !== 'COC' && tag !== 'COC_100';

                let categoryKey = 'NORMAL';
                if (tag === 'VIP') categoryKey = 'VIP';
                else if (tag === 'COC') categoryKey = 'COC';
                else if (tag === 'COC_100') categoryKey = 'COC_100';
                else if (tag === 'DAO') categoryKey = 'DAO';
                else if (tag === 'BOM') categoryKey = 'BOM';
                else if (tag === 'CHAN') categoryKey = 'CHAN';
                else if (tag === 'HOST') categoryKey = 'HOST';
                else if (isNew) categoryKey = 'NEW';
                else categoryKey = 'NORMAL';

                const custItem = { user, platform: p as Platform, count: userOrderCount, revenue: userRevenue, tag, nickname };
                if (!categorizedCustomers[categoryKey]) categorizedCustomers[categoryKey] = [];
                categorizedCustomers[categoryKey].push(custItem);

                const key = `${p}_${user}`;
                if (!customerAgg[key]) customerAgg[key] = { count: 0, revenue: 0, user, platform: p as Platform, tag, isNew, nickname };
                customerAgg[key].count += userOrderCount;
                customerAgg[key].revenue += userRevenue;
            }
        });
    });

    const customersByRevenue = Object.values(customerAgg).sort((a,b) => b.revenue - a.revenue).slice(0, 10);
    const topPrices = Object.entries(priceCounts).sort((a, b) => b[1].count - a[1].count).slice(0, 10);
    const topHours = Object.entries(hourCounts)
        .map(([hour, count]) => ({ hour: parseInt(hour), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 4);

    const maxProductCount = topPrices.length > 0 ? topPrices[0][1].count : 1;

    // Filtered customer list for selected category
    const activeCategoryList = selectedCategory ? (categorizedCustomers[selectedCategory] || []).filter(c => {
        if (!categorySearch.trim()) return true;
        const q = categorySearch.toLowerCase().trim();
        return c.user.toLowerCase().includes(q) || c.nickname.toLowerCase().includes(q);
    }).sort((a, b) => b.revenue - a.revenue) : [];

    const categoryMeta: Record<string, { label: string, icon: string, color: string, border: string, bg: string, badgeBg: string }> = {
        'NEW': { label: 'Khách Mới', icon: '✨', color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/5 hover:bg-emerald-500/10', badgeBg: 'bg-emerald-500/15 text-emerald-300' },
        'VIP': { label: 'Khách Quen', icon: '🌟', color: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-500/5 hover:bg-orange-500/10', badgeBg: 'bg-orange-500/15 text-orange-300' },
        'COC': { label: 'Mới Cọc (50k)', icon: '💧', color: 'text-cyan-400', border: 'border-cyan-500/30', bg: 'bg-cyan-500/5 hover:bg-cyan-500/10', badgeBg: 'bg-cyan-500/15 text-cyan-300' },
        'COC_100': { label: 'Mới Cọc (100k)', icon: '💧', color: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/5 hover:bg-blue-500/10', badgeBg: 'bg-blue-500/15 text-blue-300' },
        'NORMAL': { label: 'Khách Thường', icon: '👤', color: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/5 hover:bg-blue-500/10', badgeBg: 'bg-blue-500/15 text-blue-300' },
        'DAO': { label: 'Khách Dạo', icon: '👻', color: 'text-gray-400', border: 'border-gray-500/30', bg: 'bg-gray-500/5 hover:bg-gray-500/10', badgeBg: 'bg-gray-500/15 text-gray-300' },
        'BOM': { label: 'BOM Hàng', icon: '⚠️', color: 'text-rose-400', border: 'border-rose-500/30', bg: 'bg-rose-500/5 hover:bg-rose-500/10', badgeBg: 'bg-rose-500/15 text-rose-300' },
        'CHAN': { label: 'Đã Chặn', icon: '⛔', color: 'text-red-500', border: 'border-red-600/30', bg: 'bg-red-600/5 hover:bg-red-600/10', badgeBg: 'bg-red-600/15 text-red-300' },
    };

    return (
        <div className={isPage ? "h-full w-full flex flex-col bg-[#0e1621]" : "fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-2 sm:p-4"}>
            <div className={`w-full ${isPage ? "h-full flex flex-col bg-[#0e1621]" : "bg-[#1c242f] rounded-2xl border border-white/10 max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"}`}>
                
                {/* Header filter controls */}
                <div className="p-3 bg-[#1c242f] border-b border-white/10 shrink-0 space-y-2.5">
                    {/* Time Range */}
                    <div className="flex gap-1.5 sm:gap-2">
                        <button onClick={() => setTimeRange('today')} className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${timeRange === 'today' ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/20' : 'bg-[#0e1621] border-white/10 text-gray-400 hover:bg-white/5'}`}>
                            📅 Hôm nay
                        </button>
                        <button onClick={() => setTimeRange('yesterday')} className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${timeRange === 'yesterday' ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/20' : 'bg-[#0e1621] border-white/10 text-gray-400 hover:bg-white/5'}`}>
                            ⏪ Hôm qua
                        </button>
                        <button onClick={() => setTimeRange('7days')} className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${timeRange === '7days' ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/20' : 'bg-[#0e1621] border-white/10 text-gray-400 hover:bg-white/5'}`}>
                            📈 7 Ngày
                        </button>
                        <button onClick={() => setTimeRange('all')} className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${timeRange === 'all' ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/20' : 'bg-[#0e1621] border-white/10 text-gray-400 hover:bg-white/5'}`}>
                            🌟 Toàn bộ
                        </button>
                    </div>

                    {/* Platform Selector */}
                    <div className="flex gap-1.5 overflow-x-auto pb-0.5 hide-scrollbar">
                        <button
                            onClick={() => setSelectedPlatform('all')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                                selectedPlatform === 'all' 
                                    ? 'bg-purple-600 text-white shadow-sm' 
                                    : 'bg-[#0e1621] border border-white/10 text-gray-400 hover:bg-white/5'
                            }`}
                        >
                            🌐 Tất cả sàn
                        </button>
                        {(['tiktok', 'facebook', 'shopee'] as Platform[]).map(p => (
                            <button
                                key={p}
                                onClick={() => setSelectedPlatform(p)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                                    selectedPlatform === p 
                                        ? `${PLATFORMS[p].bgClass} text-white shadow-sm ring-2 ring-white/20` 
                                        : 'bg-[#0e1621] border border-white/10 text-gray-400 hover:bg-white/5'
                                }`}
                            >
                                {PLATFORMS[p].label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Body Content */}
                <div className="overflow-y-auto flex-1 p-3 sm:p-4 bg-[#0e1621] pb-24 space-y-4" onScroll={handleScroll}>
                    {/* Summary KPI Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="bg-[#1c242f] p-3 rounded-2xl border border-white/10 shadow-sm relative overflow-hidden">
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tổng doanh thu</div>
                            <div className="text-2xl font-black text-rose-400">{totalRevenue.toLocaleString()}k</div>
                            <div className="text-[10px] text-gray-400 mt-1">TB: {totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0}k / sp</div>
                        </div>
                        <div className="bg-[#1c242f] p-3 rounded-2xl border border-white/10 shadow-sm relative overflow-hidden">
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Số lượng chốt</div>
                            <div className="text-2xl font-black text-blue-400">{totalOrders} <span className="text-xs font-normal text-gray-400">cái</span></div>
                            <div className="text-[10px] text-gray-400 mt-1">{totalCustomers} khách chốt</div>
                        </div>
                        <div className="bg-[#1c242f] p-3 rounded-2xl border border-white/10 shadow-sm relative overflow-hidden">
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Lượt tương tác</div>
                            <div className="text-2xl font-black text-purple-400">{totalInteractions}</div>
                            <div className="text-[10px] text-gray-400 mt-1">Bình luận live</div>
                        </div>
                        <div className="bg-[#1c242f] p-3 rounded-2xl border border-white/10 shadow-sm relative overflow-hidden">
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tỷ lệ chốt</div>
                            <div className="text-2xl font-black text-emerald-400">
                                {totalInteractions > 0 ? Math.round((totalCustomers / totalInteractions) * 100) : 0}%
                            </div>
                            <div className="text-[10px] text-gray-400 mt-1">Chốt / tương tác</div>
                        </div>
                    </div>

                    {/* Customer Segments */}
                    <div className="bg-[#1c242f] p-4 rounded-2xl border border-white/10 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="font-bold text-white text-sm flex items-center gap-2">
                                👥 Phân loại khách hàng ({totalCustomers} khách)
                            </h4>
                            {selectedCategory && (
                                <button 
                                    onClick={() => setSelectedCategory(null)}
                                    className="text-[11px] text-blue-400 hover:text-white bg-blue-500/10 hover:bg-blue-500/20 px-2 py-0.5 rounded-md transition-colors font-medium"
                                >
                                    Xem tất cả top khách ↺
                                </button>
                            )}
                        </div>

                        {/* Main Tag Classification Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                            {(['NEW', 'VIP', 'COC', 'COC_100', 'NORMAL'] as const).map(catKey => {
                                const meta = categoryMeta[catKey];
                                const list = categorizedCustomers[catKey] || [];
                                const count = list.length;
                                const percent = totalCustomers > 0 ? Math.round((count / totalCustomers) * 100) : 0;
                                const isSelected = selectedCategory === catKey;

                                return (
                                    <div
                                        key={catKey}
                                        onClick={() => {
                                            setSelectedCategory(prev => prev === catKey ? null : catKey);
                                            setCategorySearch('');
                                        }}
                                        className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between select-none active:scale-[0.98] ${
                                            isSelected 
                                                ? `${meta.border} bg-[#232e3c] ring-2 ring-blue-500/40 shadow-lg` 
                                                : `border-white/10 bg-[#0e1621] hover:border-white/20 hover:bg-[#15202d]`
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className={`text-xs font-bold flex items-center gap-1.5 ${meta.color}`}>
                                                <span>{meta.icon}</span>
                                                <span>{meta.label}</span>
                                            </span>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${meta.badgeBg}`}>
                                                {percent}%
                                            </span>
                                        </div>
                                        <div className="flex items-end justify-between mt-2.5">
                                            <div className={`text-2xl font-black ${meta.color}`}>
                                                {count}
                                            </div>
                                            <div className="text-[10px] font-medium text-gray-400 flex items-center gap-0.5">
                                                {isSelected ? (
                                                    <span className="text-blue-400 font-bold">Đang hiển thị ▾</span>
                                                ) : (
                                                    <span className="opacity-70 group-hover:opacity-100">Bấm xem list 👉</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Other secondary tags if count > 0 */}
                        {(['DAO', 'BOM', 'CHAN'] as const).some(k => (categorizedCustomers[k]?.length || 0) > 0) && (
                            <div className="flex items-center gap-1.5 pt-1 overflow-x-auto hide-scrollbar">
                                <span className="text-[10px] text-gray-500 font-bold uppercase shrink-0">Nhãn khác:</span>
                                {(['DAO', 'BOM', 'CHAN'] as const).map(catKey => {
                                    const meta = categoryMeta[catKey];
                                    const list = categorizedCustomers[catKey] || [];
                                    if (list.length === 0) return null;
                                    const isSelected = selectedCategory === catKey;
                                    return (
                                        <button
                                            key={catKey}
                                            onClick={() => {
                                                setSelectedCategory(prev => prev === catKey ? null : catKey);
                                                setCategorySearch('');
                                            }}
                                            className={`px-2 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                                                isSelected 
                                                    ? `${meta.border} bg-[#232e3c] text-white shadow-sm ring-1 ring-white/30` 
                                                    : `bg-[#0e1621] border-white/10 ${meta.color} hover:bg-white/5`
                                            }`}
                                        >
                                            <span>{meta.icon}</span>
                                            <span>{meta.label}</span>
                                            <span className={`text-[10px] px-1 rounded ${meta.badgeBg}`}>{list.length}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Customer Table - Positioned Directly Below Customer Segments */}
                    <div className="bg-[#1c242f] p-4 rounded-2xl border border-white/10 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="font-bold text-white text-sm flex items-center gap-2">
                                {selectedCategory ? (
                                    <>
                                        <span>{categoryMeta[selectedCategory]?.icon}</span>
                                        <span>Danh sách {categoryMeta[selectedCategory]?.label}</span>
                                        <span className="text-xs font-normal text-blue-400">
                                            ({activeCategoryList.length} khách)
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <span>🏆</span>
                                        <span>Top khách chốt nhiều nhất</span>
                                        <span className="text-xs font-normal text-gray-400">
                                            ({customersByRevenue.length} khách)
                                        </span>
                                    </>
                                )}
                            </h4>
                            <span className="text-xs text-gray-400 font-normal">
                                {timeRange === 'today' ? 'Hôm nay' : timeRange === 'yesterday' ? 'Hôm qua' : '7 ngày qua'}
                            </span>
                        </div>

                        {/* Search Bar when a category is selected or if list is large */}
                        {selectedCategory && (
                            <div>
                                <input
                                    type="text"
                                    value={categorySearch}
                                    onChange={e => setCategorySearch(e.target.value)}
                                    placeholder={`Tìm kiếm trong ${categoryMeta[selectedCategory]?.label}...`}
                                    className="w-full bg-[#0e1621] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                        )}

                        {/* Table List Rows */}
                        {((selectedCategory ? activeCategoryList : customersByRevenue).length === 0) ? (
                            <div className="text-xs text-gray-400 italic text-center py-6">
                                {selectedCategory && categorySearch ? 'Không tìm thấy khách hàng phù hợp' : 'Chưa có dữ liệu khách hàng'}
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-0.5 hide-scrollbar">
                                {(selectedCategory ? activeCategoryList : customersByRevenue).map((row, idx) => {
                                    const cleanUser = normalizeUser(row.user);
                                    const nickname = store[row.platform].nicknames?.[cleanUser];
                                    const displayName = nickname 
                                        ? `${cleanUser} (${nickname})` 
                                        : `#${getShortId(cleanUser)} ${cleanUser}`;

                                    return (
                                        <div 
                                            key={`${row.platform}-${cleanUser}-${idx}`}
                                            onClick={() => onOpenProfile?.(cleanUser, row.platform)}
                                            className="flex justify-between items-center p-2.5 bg-[#0e1621] hover:bg-white/5 rounded-xl border border-white/5 transition-all cursor-pointer group"
                                        >
                                            <div className="flex items-center gap-2 overflow-hidden flex-1 pr-2">
                                                <span className={`text-xs font-black w-5 text-center shrink-0 ${idx < 3 ? 'text-yellow-400' : 'text-gray-400'}`}>
                                                    {idx + 1}.
                                                </span>
                                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold text-white shrink-0 ${PLATFORMS[row.platform].bgClass}`}>
                                                    {PLATFORMS[row.platform].label.split(' ')[0]}
                                                </span>
                                                <span className="text-sm font-bold text-white truncate group-hover:text-blue-400 transition-colors">
                                                    {displayName}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                <div className="text-right">
                                                    <div className="text-sm font-black text-rose-400 leading-tight">
                                                        {row.revenue}k
                                                    </div>
                                                    <div className="text-[11px] text-gray-400 font-semibold leading-tight">
                                                        {row.count} cái
                                                    </div>
                                                </div>

                                                <CopyButton 
                                                    text={displayName} 
                                                    className="text-xs px-1 text-gray-400 hover:text-white"
                                                />

                                                {onOpenPrice && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onOpenPrice(null, row.user, row.platform);
                                                        }}
                                                        title="Tạo đơn / Thêm giá"
                                                        className="text-emerald-400 hover:text-white hover:bg-emerald-600/30 active:scale-90 p-1 rounded-full border border-emerald-500/30 transition-all cursor-pointer inline-flex items-center justify-center font-bold text-xs bg-emerald-950/40 shadow-xs shrink-0"
                                                    >
                                                        <Plus size={12} className="stroke-[2.5]" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Top Products By Price */}
                    <div className="bg-[#1c242f] p-4 rounded-2xl border border-white/10 shadow-sm">
                        <h4 className="font-bold text-white text-sm mb-3 flex items-center justify-between">
                            <span className="flex items-center gap-2">🔥 Top sản phẩm bán chạy (Theo mức giá)</span>
                            <span className="text-xs text-gray-400 font-normal">{topPrices.length} mức giá</span>
                        </h4>
                        {topPrices.length === 0 ? (
                            <div className="text-xs text-gray-400 italic text-center py-4">Chưa có dữ liệu sản phẩm</div>
                        ) : (
                            <div className="space-y-2.5">
                                {topPrices.map(([price, stats], idx) => {
                                    const percent = Math.round((stats.count / maxProductCount) * 100);
                                    return (
                                        <div key={idx} className="bg-[#0e1621] p-2.5 rounded-xl border border-white/5">
                                            <div className="flex justify-between items-center text-xs mb-1.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-blue-400 w-4 text-center">{idx + 1}.</span>
                                                    <span className="font-bold text-white">Sản phẩm {price}k</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-bold text-emerald-400">{stats.count} chốt</span>
                                                    <span className="text-gray-400 text-[11px] ml-1.5 font-medium">({stats.revenue}k)</span>
                                                </div>
                                            </div>
                                            <div className="w-full bg-[#1c242f] h-2 rounded-full overflow-hidden">
                                                <div 
                                                    className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full rounded-full transition-all duration-500" 
                                                    style={{ width: `${percent}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Peak Hours */}
                    <div className="bg-[#1c242f] p-4 rounded-2xl border border-white/10 shadow-sm">
                        <h4 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
                            ⏰ Khung giờ chốt nhiều nhất
                        </h4>
                        {topHours.length === 0 ? (
                            <div className="text-xs text-gray-400 italic text-center py-4">Chưa có dữ liệu thời gian</div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                {topHours.map((h, idx) => (
                                    <div key={idx} className="bg-[#0e1621] rounded-xl p-3 border border-white/5 text-center relative overflow-hidden">
                                        {idx === 0 && (
                                            <div className="absolute top-0 right-0 bg-yellow-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded-bl-lg shadow-sm">
                                                TOP 1
                                            </div>
                                        )}
                                        <div className="text-[11px] text-gray-400 font-bold mb-1">Khung giờ</div>
                                        <div className="text-base font-black text-white">{h.hour}:00 - {h.hour + 1}:00</div>
                                        <div className="text-xs font-bold text-blue-400 mt-1">{h.count} đơn chốt</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    {/* History Section */}
                    {store.history.length > 0 && (
                        <div className="bg-[#1c242f] p-4 rounded-2xl border border-white/10 shadow-sm">
                            <h4 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
                                📅 Lịch sử các phiên live trước
                            </h4>
                            <div className="space-y-2.5">
                                {store.history.map(h => {
                                    const dateObj = new Date(h.date);
                                    const isToday = new Date().toDateString() === dateObj.toDateString();
                                    const isYesterday = new Date(Date.now() - 86400000).toDateString() === dateObj.toDateString();
                                    const dateLabel = isToday ? "Hôm nay" : isYesterday ? "Hôm qua" : dateObj.toLocaleDateString('vi-VN');
                                    const timeLabel = dateObj.toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'});
                                    
                                    return (
                                        <div key={h.id} className="flex justify-between items-center bg-[#0e1621] p-3 rounded-xl border border-white/5 gap-3">
                                            <div className="flex-1">
                                                <div className="font-bold text-sm text-white">{dateLabel} <span className="text-xs text-gray-400 font-normal">({timeLabel})</span></div>
                                                <div className="text-xs text-gray-400 mt-1">
                                                    <span className="font-bold text-emerald-400">{h.newCustomers}</span> mới, <span className="font-bold text-orange-400">{h.returningCustomers}</span> quen
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="font-black text-rose-400 text-sm">{h.totalRevenue}k</div>
                                                <div className="text-xs font-bold text-blue-400">{h.totalOrders} cái</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export function ProfileModal({ user, platform, onClose, onOpenPrice, onOpenPancakeLink }: { user: string, platform: Platform, onClose: () => void, onOpenPrice?: (id: string | null, u: string, p: Platform) => void, onOpenPancakeLink?: (user: string, platform: Platform, initialSearch?: string) => void }) {
    const store = useStore();
    const cleanUser = normalizeUser(user);
    
    const cust = store[platform].customers[cleanUser];
    const initialNickname = store[platform].nicknames?.[cleanUser] || "";
    const [nickname, setNickname] = useState(initialNickname);
    const initialPancakeLink = store[platform].pancakeLinks?.[cleanUser] || "";
    const [pancakeInput, setPancakeInput] = useState(initialPancakeLink);
    const [insight, setInsight] = useState(() => getCustomerInsight(cleanUser));
    const [isSyncingPancake, setIsSyncingPancake] = useState(false);
    const [pancakeCopiedTip, setPancakeCopiedTip] = useState(false);
    const [showPancakeGuide, setShowPancakeGuide] = useState(false);
    const [showAllOrders, setShowAllOrders] = useState(false);
    const [showOldShippedItems, setShowOldShippedItems] = useState(false);
    const [selectedPast, setSelectedPast] = useState<Set<number>>(new Set());
    const [selectedCurrent, setSelectedCurrent] = useState<Set<number>>(new Set());
    const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);
    const [isPushModalOpen, setIsPushModalOpen] = useState(false);
    const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);

    const totalSelectedCount = selectedCurrent.size + selectedPast.size;
    const totalSelectedPriceK = 
        Array.from(selectedCurrent).reduce((sum, i) => sum + (cust?.items?.[i]?.price || 0), 0) +
        Array.from(selectedPast).reduce((sum, i) => sum + (cust?.pastItems?.[i]?.price || 0), 0);


    const triggerPancakeSync = async (linkVal: string) => {
        const clean = linkVal.trim();
        if (!clean) return;
        setIsSyncingPancake(true);
        try {
            const res = await syncSingleCustomerPancakeOrders(cleanUser, platform, clean);
            if (res) {
                setInsight(res);
            }
        } catch (err) {
            console.error("Lỗi khi đồng bộ đơn Pancake cho khách:", err);
        } finally {
            setIsSyncingPancake(false);
        }
    };

    useEffect(() => {
        const handleUpdated = (e: any) => {
            const updatedUser = e?.detail?.user;
            if (!updatedUser || normalizeUser(updatedUser) === cleanUser) {
                setInsight(e?.detail?.insight || getCustomerInsight(cleanUser));
            }
        };
        window.addEventListener("pancake_insights_updated", handleUpdated);
        
        // Auto-sync order history if link exists
        if (pancakeInput.trim()) {
            triggerPancakeSync(pancakeInput.trim());
        }

        return () => {
            window.removeEventListener("pancake_insights_updated", handleUpdated);
        };
    }, [cleanUser, platform]);

    const handleSaveLink = (linkVal: string) => {
        const clean = linkVal.trim();
        store.setCustomerPancakeLink(platform, cleanUser, clean);
        if (clean) {
            triggerPancakeSync(clean);
        }
    };

    const tag = store[platform].tags[cleanUser] || 'NORMAL';
    
    // Find avatar if available
    const commentWithAvatar = store[platform].comments.find(c => normalizeUser(c.user) === cleanUser && c.avatar);
    const avatarUrl = commentWithAvatar?.avatar;

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-2 sm:p-4">
            <div className="bg-[#1c242f] rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
                {/* Header banner */}
                <div className={`h-10 relative ${PLATFORMS[platform].bgClass} shrink-0 rounded-t-xl`}>
                    <button onClick={onClose} className="absolute top-1 right-2 bg-black/20 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/40 backdrop-blur font-bold z-10">✕</button>
                </div>
                
                {/* Sticky Profile Header */}
                <div className="px-4 pb-3 pt-3 bg-[#1c242f] shrink-0 border-b border-white/5 shadow-sm relative z-10">
                    <div className="flex items-start gap-3">
                        {/* Avatar on left */}
                        <div className="shrink-0">
                            <CustomerAvatar 
                                user={cleanUser} 
                                platform={platform} 
                                avatarUrl={avatarUrl} 
                                tag={tag} 
                                size="xl" 
                            />
                        </div>
                        
                        {/* Information on right */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between h-20">
                            {/* ID and Name & Thêm Món */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-black text-gray-500 bg-[#1c242f] px-1 py-0.5 rounded border border-white/10 shadow-sm shrink-0">
                                    #{getShortId(cleanUser)}
                                </span>
                                <div className="text-base font-black text-white truncate leading-tight text-left">{cleanUser}</div>
                                <CopyButton text={store[platform].nicknames?.[cleanUser] ? `${cleanUser} (${store[platform].nicknames[cleanUser]})` : `#${getShortId(cleanUser)} ${cleanUser}`} className="text-sm shrink-0 text-gray-400 hover:text-gray-100" />
                                
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsCalculatorOpen(true);
                                    }}
                                    title="Thêm món mới (Mở bảng tính Đơn giá x SL)"
                                    className="text-emerald-300 hover:text-white bg-emerald-950/70 hover:bg-emerald-600/50 active:scale-95 px-2.5 py-0.5 rounded-lg border border-emerald-500/50 transition-all cursor-pointer inline-flex items-center gap-1 font-black text-xs shadow-sm shrink-0"
                                >
                                    <Plus size={13} className="stroke-[3]" />
                                    <span>Thêm món</span>
                                </button>
                            </div>

                            {/* Nickname Input */}
                            <div>
                                <input
                                    type="text"
                                    value={nickname}
                                    onChange={e => setNickname(e.target.value)}
                                    onBlur={() => store.setCustomerNickname(platform, cleanUser, nickname.trim())}
                                    placeholder="Tên gợi nhớ..."
                                    className="w-full py-1.5 px-2.5 bg-[#0e1621] border border-white/20 rounded-md font-bold text-white placeholder-gray-400 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                />
                            </div>

                            {/* Stats */}
                            {/* Stats */}
                            {(() => {
                                const activeInsight = (insight || getCustomerInsight(cleanUser));
                                const sStat = checkCustomerPancakeShippedStatus(cust, activeInsight);
                                const currentItems = cust?.items || [];
                                const unshippedCurrentItems = currentItems.filter(it => !it.shipped);
                                const dispCount = sStat.isAllShipped ? 0 : unshippedCurrentItems.length;
                                const dispTotal = sStat.isAllShipped ? 0 : unshippedCurrentItems.reduce((sum, it) => sum + (it.price || 0), 0);
                                return (
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-blue-50 border border-blue-100 py-1 px-1.5 rounded-md flex items-center justify-between shadow-sm">
                                            <span className="text-[9px] font-bold text-blue-600">ĐÃ CHỐT:</span>
                                            <span className="text-[11px] font-black text-blue-800 leading-none">
                                                {dispCount}
                                                {sStat.isAllShipped && <span className="text-[9px] text-emerald-600 font-bold ml-1">✓ Đã đi</span>}
                                            </span>
                                        </div>
                                        <div className="bg-red-50 border border-red-100 py-1 px-1.5 rounded-md flex items-center justify-between shadow-sm">
                                            <span className="text-[9px] font-bold text-red-600">TỔNG:</span>
                                            <span className="text-[11px] font-black text-red-800 leading-none">
                                                {dispTotal}k
                                                {sStat.isAllShipped && <span className="text-[9px] text-emerald-600 font-bold ml-1">0k nợ</span>}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
                
                <div className="overflow-y-auto flex-1 px-4 pt-4 pb-5">
                    
                    <div className="mb-5 bg-[#0e1621] p-2.5 rounded-xl border border-white/5 flex items-center justify-between gap-2 overflow-x-auto">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider shrink-0 ml-1">🏷️ Nhãn:</span>
                        <div className="flex flex-wrap gap-1 shrink-0">
                            {(['NORMAL', 'VIP', 'COC', 'COC_100', 'GIU', 'DAO', 'BOM', 'CHAN', 'HOST'] as const).map(t => (
                                <button
                                    key={t}
                                    onClick={() => store.setCustomerTag(platform, cleanUser, t)}
                                    className={`py-1 px-2.5 text-[11px] font-bold rounded-md border transition-all cursor-pointer ${tag === t ? (
                                        t === 'NORMAL' ? 'bg-green-600 border-green-600 text-white shadow-sm' :
                                        t === 'VIP' ? 'bg-orange-500 border-orange-500 text-white shadow-sm' :
                                        t === 'COC' ? 'bg-cyan-600 border-cyan-600 text-white shadow-sm' :
                                        t === 'COC_100' ? 'bg-blue-600 border-blue-600 text-white shadow-sm' :
                                        t === 'GIU' ? 'bg-amber-600 border-amber-600 text-white shadow-sm' :
                                        t === 'DAO' ? 'bg-gray-700 border-gray-600 text-white shadow-sm' :
                                        t === 'CHAN' ? 'bg-black border-black text-white shadow-sm' :
                                        t === 'HOST' ? 'bg-purple-600 border-purple-600 text-white shadow-sm' :
                                        'bg-red-600 border-red-600 text-white shadow-sm'
                                    ) : 'bg-[#1c242f] border-white/10 text-gray-400 hover:bg-[#1c242f]'}`}
                                >
                                    {t === 'NORMAL' ? 'Thường' :
                                     t === 'VIP' ? '🌟 Quen' :
                                     t === 'COC' ? '💧 Cọc 50k' :
                                     t === 'COC_100' ? '💧 Cọc 100k' :
                                     t === 'GIU' ? '📦 Giữ' :
                                     t === 'DAO' ? '👻 Dạo' :
                                     t === 'CHAN' ? '⛔ Chặn' :
                                     t === 'HOST' ? '👑' : '⚠️ BOM'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 🥞 THÔNG TIN PANCAKE POS & LỊCH SỬ ĐI ĐƠN */}
                    {(() => {
                        const activeInsight = (insight || getCustomerInsight(cleanUser));
                        const hasLink = !!(pancakeInput && pancakeInput.trim()) || !!(activeInsight?.pancakeConvUrl);
                        const shippedStatus = checkCustomerPancakeShippedStatus(cust, activeInsight);
                        const allOrders = activeInsight?.ordersHistory || (activeInsight?.latestOrder ? [activeInsight.latestOrder] : []);
                        
                        // Lọc các đơn đã giao thành công
                        const successfulOrders = allOrders.filter(ord => {
                            const pStatus = (ord.partnerStatus || '').toLowerCase();
                            return ord.isSuccess || ord.status === 3 || ord.status === 4 || pStatus.includes('delivered') || pStatus.includes('success') || pStatus.includes('giao thanh cong');
                        });
                        // Hiển thị danh sách đơn thành công (nếu người dùng bật xem tất cả thì hiện allOrders)
                        const ordersToDisplay = showAllOrders ? allOrders : (successfulOrders.length > 0 ? successfulOrders : allOrders);
                        const displayedOrders = ordersToDisplay;
                        const succeedCount = activeInsight?.succeedOrderCount !== undefined ? activeInsight.succeedOrderCount : successfulOrders.length;
                        const returnedCount = activeInsight?.returnedOrderCount !== undefined ? activeInsight.returnedOrderCount : 0;
                        const totalPurchased = activeInsight?.purchasedAmount !== undefined ? activeInsight.purchasedAmount : (activeInsight?.totalSpent || successfulOrders.reduce((sum, o) => sum + o.totalPrice, 0));

                        if (!hasLink) {
                            return (
                                <div className="mb-4 bg-gradient-to-br from-[#1a2230] to-[#121822] p-3.5 rounded-xl border border-orange-500/20 space-y-2.5 shadow-md">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-base">🥞</span>
                                            <span className="text-xs font-black text-orange-400 uppercase tracking-wider">Pancake POS:</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => onOpenPancakeLink?.(cleanUser, platform)}
                                            className="bg-amber-500/20 hover:bg-amber-500/35 border border-amber-500/50 text-amber-300 text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer"
                                        >
                                            <span>🥞+ Chọn khách Zalo đang inbox</span>
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-gray-400 leading-relaxed">
                                        Khách chưa được gắn link Zalo Pancake. Bấm nút <strong>"Chọn khách Zalo đang inbox"</strong> ở trên hoặc dán link bên dưới để gán và đồng bộ đơn chính xác 100%.
                                    </p>
                                </div>
                            );
                        }

                        return (
                            <div className="mb-4 bg-gradient-to-br from-[#172335] to-[#121c2b] p-3.5 rounded-xl border border-orange-500/30 space-y-3 shadow-md">
                                {/* Banner trạng thái: ĐÃ ĐI HẾT ĐƠN */}
                                {shippedStatus.isAllShipped && shippedStatus.latestPancakeOrder && (
                                    <div className="bg-emerald-950/70 border border-emerald-500/50 rounded-xl p-3 flex items-start justify-between gap-2.5 shadow-md animate-fadeIn">
                                        <div className="flex items-start gap-2.5">
                                            <span className="text-xl shrink-0 mt-0.5">✅</span>
                                            <div>
                                                <div className="text-xs font-black text-emerald-300 uppercase tracking-wide flex items-center gap-1.5 flex-wrap">
                                                    <span>ĐÃ ĐI HẾT ĐƠN TRÊN PANCAKE POS</span>
                                                    <span className="bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 text-[10px] px-2 py-0.2 rounded font-mono font-bold">
                                                        #{shippedStatus.latestPancakeOrder.orderNumber}
                                                    </span>
                                                </div>
                                                <div className="text-[11px] text-emerald-100/90 mt-1 leading-relaxed">
                                                    Đơn gần nhất trên Pancake {shippedStatus.latestPancakeOrder.insertedAt ? "(" + formatDateTime(shippedStatus.latestPancakeOrder.insertedAt) + ")" : ""} đã xử lý xong toàn bộ đơn chốt!
                                                </div>
                                            </div>
                                        </div>
                                        {cust?.pastItems && cust.pastItems.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    store.clearShippedPastItems(platform, cleanUser);
                                                }}
                                                title="Dọn sạch danh sách lịch sử các đơn cũ đã đi"
                                                className="text-[10px] font-bold text-emerald-300 hover:text-white bg-emerald-900/60 hover:bg-emerald-800 px-2 py-1 rounded-lg border border-emerald-500/40 shrink-0 cursor-pointer shadow-xs transition-colors whitespace-nowrap"
                                            >
                                                🧹 Dọn lịch sử cũ ({cust.pastItems.length})
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Nếu chưa coi là all shipped, nhưng có đơn Pancake tạo hôm nay và khách có món chốt phiên này */}
                                {!shippedStatus.isAllShipped && cust?.items && cust.items.length > 0 && (
                                    shippedStatus.matchingTodayOrder ? (
                                        <div className="bg-gradient-to-r from-[#0e271c] via-[#143929] to-[#0e271c] border-2 border-emerald-500/70 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-lg shadow-emerald-950/40 animate-fadeIn">
                                            <div className="flex items-start gap-2.5 min-w-0">
                                                <span className="text-2xl shrink-0 mt-0.5">🥞</span>
                                                <div className="min-w-0">
                                                    <div className="text-xs font-black text-emerald-300 uppercase tracking-wide flex items-center gap-1.5 flex-wrap">
                                                        <span>PHÁT HIỆN ĐƠN PANCAKE HÔM NAY #{shippedStatus.matchingTodayOrder.orderNumber}</span>
                                                        <span className="text-[10px] text-emerald-200/80 font-normal">({formatDateTime(shippedStatus.matchingTodayOrder.insertedAt)})</span>
                                                        <span className="bg-emerald-500/25 text-emerald-300 text-[9px] px-1.5 py-0.2 rounded border border-emerald-500/40 font-bold">
                                                            {getOrderStatusLabel(shippedStatus.matchingTodayOrder.status).text}
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] text-emerald-100/95 mt-1 leading-snug">
                                                        Khách đã có đơn <strong>#{shippedStatus.matchingTodayOrder.orderNumber}</strong> ({shippedStatus.matchingTodayOrder.totalQuantity} món - {shippedStatus.matchingTodayOrder.totalPrice.toLocaleString('vi-VN')}đ) tạo hôm nay trên Pancake POS.
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0 justify-end">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        store.markAllCustomerItemsShipped(platform, cleanUser, false);
                                                    }}
                                                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-3.5 py-2 rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-1.5 active:scale-95 whitespace-nowrap w-full sm:w-auto justify-center"
                                                >
                                                    <span>✅ Xác nhận {cust.items.length} món này ĐÃ ĐI ĐƠN</span>
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-amber-950/50 border border-amber-500/40 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-md">
                                            <div className="flex items-start gap-2.5">
                                                <span className="text-xl shrink-0 mt-0.5">🛍️</span>
                                                <div>
                                                    <div className="text-xs font-black text-amber-300 uppercase tracking-wide flex items-center gap-1.5 flex-wrap">
                                                        <span>CÓ {shippedStatus.unshippedCurrentItemsCount || cust.items.length} MÓN CHƯA ĐI ĐƠN</span>
                                                    </div>
                                                    <div className="text-[11px] text-amber-100/90 mt-1 leading-relaxed">
                                                        Bấm nút <strong>"Đẩy đơn Pancake"</strong> bên dưới để tạo đơn mới, hoặc đánh dấu <strong>"Đã đi đơn"</strong> nếu đã gửi.
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0 justify-end">
                                                <button
                                                    type="button"
                                                    onClick={() => store.markAllCustomerItemsShipped(platform, cleanUser, false)}
                                                    className="text-[11px] font-bold text-emerald-300 hover:text-white bg-emerald-950/60 hover:bg-emerald-900 px-3 py-1.5 rounded-lg border border-emerald-500/40 cursor-pointer transition-all active:scale-95 whitespace-nowrap w-full sm:w-auto justify-center"
                                                >
                                                    <span>✅ Đã đi đơn ngoài</span>
                                                </button>
                                            </div>
                                        </div>
                                    )
                                )}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-base">🥞</span>
                                        <span className="text-xs font-black text-orange-400 uppercase tracking-wider">Pancake POS & Đơn Hàng:</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <button
                                            type="button"
                                            onClick={() => onOpenPancakeLink?.(cleanUser, platform)}
                                            title="Đổi hoặc chọn lại khách Zalo khác từ danh sách inbox"
                                            className="text-[10px] text-amber-300 hover:text-white bg-amber-950/40 hover:bg-amber-800/50 px-2 py-0.5 rounded border border-amber-500/30 flex items-center gap-1 font-semibold transition-all cursor-pointer active:scale-95"
                                        >
                                            <Edit3 size={10} />
                                            <span>Đổi Zalo</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => triggerPancakeSync(pancakeInput)}
                                            disabled={isSyncingPancake}
                                            title="Đồng bộ lại toàn bộ đơn hàng từ Pancake POS"
                                            className="text-[10px] text-orange-300 hover:text-white bg-orange-950/40 hover:bg-orange-800/50 px-2 py-0.5 rounded border border-orange-500/30 flex items-center gap-1 font-semibold transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                                        >
                                            <RefreshCw size={11} className={isSyncingPancake ? "animate-spin" : ""} />
                                            <span>{isSyncingPancake ? "Đang đồng bộ..." : "Đồng bộ lại"}</span>
                                        </button>
                                        {succeedCount > 0 ? (
                                            succeedCount >= 2 ? (
                                                <span className="bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    👑 Quen ({succeedCount} đơn thành công)
                                                </span>
                                            ) : (
                                                <span className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    🆕 Mới (1 đơn thành công)
                                                </span>
                                            )
                                        ) : (
                                            <span className="bg-blue-500/20 border border-blue-500/40 text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                                Đã nối Zalo
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Thống kê tổng số đơn thành công & tổng tiền khách đã mua chuẩn Hình 2 */}
                                <div className="grid grid-cols-2 gap-2 bg-[#0c141f] p-2.5 rounded-lg border border-orange-500/20">
                                    <div className="space-y-0.5">
                                        <div className="text-[10.5px] text-gray-400 font-medium">Thành công:</div>
                                        <div className="text-sm font-black text-emerald-400">
                                            {succeedCount} <span className="text-[11px] font-normal text-gray-300">Đơn hàng</span>
                                        </div>
                                    </div>
                                    <div className="space-y-0.5 text-right">
                                        <div className="text-[10.5px] text-gray-400 font-medium">Tổng tiền đã mua:</div>
                                        <div className="text-sm font-black text-orange-300">
                                            {new Intl.NumberFormat('vi-VN').format(totalPurchased)}đ
                                        </div>
                                    </div>
                                    {returnedCount > 0 && (
                                        <div className="col-span-2 text-[10px] text-rose-300 bg-rose-950/30 px-2 py-0.5 rounded border border-rose-500/20 flex items-center justify-between">
                                            <span>Số đơn hoàn trả:</span>
                                            <span className="font-bold">{returnedCount} đơn</span>
                                        </div>
                                    )}
                                </div>

                                {activeInsight?.matchedName && (
                                    <div className="text-xs text-gray-300 flex items-center justify-between px-0.5">
                                        <div className="flex items-center gap-1 truncate">
                                            <span className="text-gray-400">Khách Zalo/POS:</span>
                                            <strong className="text-orange-200 font-mono">{activeInsight.matchedName}</strong>
                                        </div>
                                    </div>
                                )}

                                {/* Phone & Address */}
                                {(activeInsight?.matchedPhone || activeInsight?.matchedAddress) && (
                                    <div className="bg-[#0e1622] p-2.5 rounded-lg border border-white/5 space-y-1.5 text-xs">
                                        {activeInsight.matchedPhone && (
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5 text-emerald-400 font-mono font-bold">
                                                    <Phone size={13} />
                                                    <span>{activeInsight.matchedPhone}</span>
                                                </div>
                                                <CopyButton text={activeInsight.matchedPhone} className="text-xs text-gray-400 hover:text-white" />
                                            </div>
                                        )}
                                        {activeInsight.matchedAddress && (
                                            <div className="flex items-start justify-between gap-1 text-gray-300">
                                                <div className="flex items-start gap-1.5 leading-snug">
                                                    <MapPin size={13} className="shrink-0 text-gray-400 mt-0.5" />
                                                    <span>{activeInsight.matchedAddress}</span>
                                                </div>
                                                <CopyButton text={activeInsight.matchedAddress} className="text-xs text-gray-400 hover:text-white shrink-0" />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Danh sách đơn hàng từ Pancake POS */}
                                <div className="space-y-2 pt-1 border-t border-white/10">
                                    <div className="flex items-center justify-between text-xs font-bold text-gray-300">
                                        <div className="flex items-center gap-1.5">
                                            <span>📦 Đơn trên Pancake POS ({allOrders.length}):</span>
                                        </div>
                                        {allOrders.length > 3 && (
                                            <button
                                                type="button"
                                                onClick={() => setShowAllOrders(!showAllOrders)}
                                                className="text-[11px] text-orange-400 hover:text-orange-300 font-semibold cursor-pointer underline"
                                            >
                                                {showAllOrders ? 'Thu gọn' : `Xem tất cả (${allOrders.length} đơn)`}
                                            </button>
                                        )}
                                    </div>

                                    {allOrders.length === 0 ? (
                                        <div className="text-center py-2.5 text-xs text-gray-400 bg-[#09101a] rounded-lg border border-white/5">
                                            Chưa có đơn hàng nào trên Pancake POS
                                        </div>
                                    ) : (
                                        <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5 custom-scrollbar">
                                            {allOrders.slice(0, showAllOrders ? 50 : 3).map((ord, oIdx) => {
                                                const statusMeta = getOrderStatusLabel(ord.status);
                                                const formattedDate = ord.insertedAt ? new Date(ord.insertedAt).toLocaleString('vi-VN', {
                                                    day: '2-digit', month: '2-digit', year: '2-digit',
                                                    hour: '2-digit', minute: '2-digit'
                                                }) : '';

                                                return (
                                                    <div key={ord.id || oIdx} className="bg-[#0b1320] p-2.5 rounded-lg border border-white/10 space-y-1.5 text-xs">
                                                        <div className="flex items-center justify-between gap-1">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="font-mono font-bold text-orange-300">#{ord.orderNumber}</span>
                                                                {formattedDate && <span className="text-[10px] text-gray-400">({formattedDate})</span>}
                                                            </div>
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusMeta.color}`}>
                                                                {statusMeta.text}
                                                            </span>
                                                        </div>

                                                        {/* Items list */}
                                                        {ord.items && ord.items.length > 0 && (
                                                            <div className="bg-black/20 p-1.5 rounded space-y-0.5 text-[11px] text-gray-300">
                                                                {ord.items.map((it: any, iIdx: number) => (
                                                                    <div key={iIdx} className="flex justify-between items-center gap-1 truncate">
                                                                        <span className="truncate">{it.name} <span className="text-gray-400">x{it.quantity}</span></span>
                                                                        <span className="font-mono text-orange-200 shrink-0">{(it.price || 0).toLocaleString('vi-VN')}đ</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        <div className="flex items-center justify-between pt-0.5 text-[11px]">
                                                            <div className="flex items-center gap-1 text-gray-400 truncate">
                                                                {ord.partnerName && <span>🚚 {ord.partnerName}</span>}
                                                                {ord.trackingCode && <span className="font-mono text-cyan-300">({ord.trackingCode})</span>}
                                                            </div>
                                                            <div className="font-bold text-emerald-400 font-mono text-xs">
                                                                {ord.totalPrice.toLocaleString('vi-VN')}đ
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                    {/* 🥞 LIÊN KẾT HỘI THOẠI PANCAKE / ZALO */}
                    <div className="mb-5 bg-[#0e1621] p-3 rounded-xl border border-orange-500/20 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <span className="text-base">🥞</span>
                                <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">Hội thoại Pancake / Zalo:</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => onOpenPancakeLink?.(cleanUser, platform)}
                                    className="text-[10px] text-amber-300 hover:text-amber-200 bg-amber-950/40 hover:bg-amber-900/40 px-2 py-0.5 rounded border border-amber-500/30 flex items-center gap-1 font-semibold cursor-pointer"
                                    title="Chọn nhanh từ danh sách khách Zalo đang nhắn tin"
                                >
                                    <span>🥞 Chọn inbox</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        try {
                                            if (navigator.clipboard && navigator.clipboard.readText) {
                                                const text = await navigator.clipboard.readText();
                                                if (text) {
                                                    const clean = text.trim();
                                                    setPancakeInput(clean);
                                                    handleSaveLink(clean);
                                                    setPancakeCopiedTip(true);
                                                    setTimeout(() => setPancakeCopiedTip(false), 2000);
                                                }
                                            }
                                        } catch {}
                                    }}
                                    className="text-[10px] text-orange-300 hover:text-orange-200 bg-orange-950/40 hover:bg-orange-900/40 px-2 py-0.5 rounded border border-orange-500/30 flex items-center gap-1 font-semibold cursor-pointer"
                                >
                                    <Clipboard size={11} /> {pancakeCopiedTip ? "Đã dán!" : "Dán link / SĐT"}
                                </button>
                            </div>
                        </div>
                        
                        <div className="relative">
                            <input
                                type="text"
                                value={pancakeInput}
                                onChange={e => setPancakeInput(e.target.value)}
                                onBlur={() => handleSaveLink(pancakeInput)}
                                placeholder="Dán link https://pages.fm/... hoặc SĐT Zalo khách"
                                className="w-full py-1.5 px-2.5 pr-7 bg-[#141d29] border border-white/15 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all placeholder-gray-500"
                            />
                            {pancakeInput && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPancakeInput('');
                                        store.setCustomerPancakeLink(platform, cleanUser, '');
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-0.5 cursor-pointer text-xs"
                                    title="Xóa liên kết"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        {pancakeInput.trim() && (
                            <div className="space-y-1.5 pt-0.5">
                                <button
                                    type="button"
                                    onClick={() => {
                                        store.setCustomerPancakeLink(platform, cleanUser, pancakeInput.trim());
                                        openPancakeApp(pancakeInput.trim(), true);
                                    }}
                                    className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-orange-950/40 active:scale-98 transition-all cursor-pointer"
                                >
                                    <Smartphone size={14} />
                                    <span>
                                        {parsePancakeContact(pancakeInput).type === 'phone_zalo' 
                                            ? '🚀 Mở App Zalo Trên Điện Thoại' 
                                            : '🚀 Mở Thẳng App Pancake Trên Điện Thoại'}
                                    </span>
                                </button>
                                <div className="flex items-center justify-between text-[11px] px-1 text-gray-400">
                                    <span className="truncate max-w-[200px] text-orange-300 font-medium">
                                        {parsePancakeContact(pancakeInput).label}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => window.open(parsePancakeContact(pancakeInput).webUrl, '_blank')}
                                        className="text-gray-400 hover:text-white underline cursor-pointer"
                                    >
                                        Mở Web (pages.fm) 🌐
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {/* Hướng dẫn cài đặt để điện thoại luôn tự động nhảy vào App Pancake */}
                        <div className="text-[10px] text-gray-400 bg-black/20 p-2 rounded-lg border border-white/5 space-y-1">
                            <button
                                type="button"
                                onClick={() => setShowPancakeGuide(!showPancakeGuide)}
                                className="w-full flex items-center justify-between font-semibold text-amber-300/90 hover:text-amber-200 cursor-pointer"
                            >
                                <span>📲 Cách để điện thoại luôn tự động mở App Pancake:</span>
                                <span>{showPancakeGuide ? '▲ Ẩn' : '▼ Xem mẹo'}</span>
                            </button>
                            {showPancakeGuide && (
                                <div className="text-gray-300 space-y-1 pt-1 border-t border-white/5 leading-relaxed">
                                    <p>
                                        1. Vào <strong className="text-white">Cài đặt máy</strong> &gt; <strong className="text-white">Ứng dụng</strong> &gt; chọn app <strong className="text-orange-400">Pancake</strong>.
                                    </p>
                                    <p>
                                        2. Bấm vào mục <strong className="text-white">"Mở theo mặc định" (Set as default)</strong>.
                                    </p>
                                    <p>
                                        3. Bật <strong className="text-emerald-400">"Mở các liên kết được hỗ trợ"</strong> và tích chọn <code className="text-orange-300">pages.fm</code>.
                                    </p>
                                    <p className="text-emerald-400">
                                        👉 Từ nay cứ bấm link Pancake là Android tự phóng thẳng vào App chat Pancake, không bị mở qua trình duyệt web!
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* 🚀 THANH THAO TÁC GỘP: ĐẨY ĐƠN PANCAKE & IN BILL */}
                    {totalSelectedCount > 0 && (
                        <div className="bg-gradient-to-r from-orange-950/80 via-[#221815] to-amber-950/80 p-3.5 rounded-xl border border-orange-500/50 mb-5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl shadow-orange-950/40 animate-fadeIn">
                            <div className="text-left w-full sm:w-auto">
                                <div className="text-xs font-black text-orange-300 flex items-center gap-1.5">
                                    <span className="text-sm">✨</span>
                                    <span>ĐÃ CHỌN {totalSelectedCount} MÓN</span>
                                    <span className="text-gray-400 font-normal">
                                        ({selectedCurrent.size} phiên này, {selectedPast.size} phiên trước)
                                    </span>
                                </div>
                                <div className="text-sm font-black text-white mt-0.5">
                                    Tổng tiền: <span className="text-emerald-400 font-mono text-base">{totalSelectedPriceK}k</span> <span className="text-xs text-gray-300 font-medium">({(totalSelectedPriceK * 1000).toLocaleString('vi-VN')}đ)</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <button
                                    type="button"
                                    onClick={() => setIsPushModalOpen(true)}
                                    className="flex-1 sm:flex-initial bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 hover:from-orange-500 hover:to-amber-500 text-white px-4 py-2.5 rounded-xl font-black text-xs shadow-lg shadow-orange-950/60 flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                                >
                                    <span className="text-sm">🥞</span>
                                    <span>ĐẨY ĐƠN PANCAKE ({totalSelectedCount})</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const currentItemsToPrint = Array.from(selectedCurrent).sort((a,b)=>a-b).map(i => cust.items[i]);
                                        const pastItemsToPrint = Array.from(selectedPast).sort((a,b)=>a-b).map(i => cust.pastItems![i]);
                                        const allItemsToPrint = [...currentItemsToPrint, ...pastItemsToPrint];
                                        const total = allItemsToPrint.reduce((sum, item) => sum + (item.price || 0), 0);
                                        const time = new Date().toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit'});
                                        const displayName = store[platform].nicknames?.[cleanUser] ? `${cleanUser} (${store[platform].nicknames[cleanUser]})` : `#${getShortId(cleanUser)} ${cleanUser}`;
                                        printBill(displayName, allItemsToPrint, total, PLATFORMS[platform].label, time);
                                    }}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2.5 rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer"
                                >
                                    <span>🖨️ IN BILL</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {(() => {
                        const activeInsight = (insight || getCustomerInsight(cleanUser));
                        const sStat = checkCustomerPancakeShippedStatus(cust, activeInsight);
                        const currentItems = cust?.items || [];
                        const hasCurrentItems = currentItems.length > 0;
                        const unshippedCount = currentItems.filter(it => !it.shipped).length;
                        const shippedCount = currentItems.filter(it => it.shipped).length;
                        const allCurrentShipped = hasCurrentItems && shippedCount === currentItems.length;

                        return (
                            <div className="mb-6">
                                {/* Thông báo phát hiện đơn Pancake cho các món hôm nay */}
                                {sStat.matchingTodayOrder && hasCurrentItems && !allCurrentShipped && (
                                    <div className="bg-gradient-to-r from-[#0d2218] via-[#112d20] to-[#0d2218] border border-emerald-500/50 rounded-xl p-3 mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-lg shadow-emerald-950/30 animate-fadeIn">
                                        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                                            <span className="text-xl shrink-0 mt-0.5 sm:mt-0">🥞</span>
                                            <div className="min-w-0">
                                                <div className="text-xs font-black text-emerald-300 flex items-center gap-1.5 flex-wrap">
                                                    <span>ĐƠN PANCAKE #{sStat.matchingTodayOrder.orderNumber}</span>
                                                    <span className="text-[10px] text-emerald-200/80 font-normal">({formatDateTime(sStat.matchingTodayOrder.insertedAt)})</span>
                                                    <span className="bg-emerald-500/20 text-emerald-300 text-[9px] px-1.5 py-0.2 rounded border border-emerald-500/30 font-bold">
                                                        {getOrderStatusLabel(sStat.matchingTodayOrder.status).text}
                                                    </span>
                                                </div>
                                                <div className="text-[11px] text-emerald-100/90 leading-tight mt-0.5">
                                                    Khách đã có đơn trên Pancake POS hôm nay. Bấm nút để đánh dấu giỏ hàng này đã đi đơn:
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0 justify-end">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    store.markAllCustomerItemsShipped(platform, cleanUser, false);
                                                }}
                                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-3.5 py-2 rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-1.5 active:scale-95 whitespace-nowrap w-full sm:w-auto justify-center"
                                            >
                                                <span>✅ Đã Đi Đơn (#{sStat.matchingTodayOrder.orderNumber})</span>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="text-sm font-bold text-gray-100 mb-3 flex flex-wrap justify-between items-center gap-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-base font-black text-white flex items-center gap-1.5">
                                            <span>🛒</span>
                                            <span>Đơn chốt phiên này</span>
                                            {currentItems.length > 0 && (
                                                <span className="text-xs text-orange-400 font-mono font-bold bg-orange-950/60 px-2 py-0.5 rounded-full border border-orange-500/30">
                                                    {currentItems.length} món
                                                </span>
                                            )}
                                        </span>
                                        {hasCurrentItems && (
                                            <label className="flex items-center gap-1.5 text-xs font-normal cursor-pointer text-gray-400 bg-[#1c242f] hover:bg-white/10 px-2 py-1 rounded transition-colors">
                                                <input 
                                                    type="checkbox" 
                                                    className="rounded border-white/20 w-3.5 h-3.5 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                    checked={selectedCurrent.size === currentItems.length && currentItems.length > 0}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedCurrent(new Set(currentItems.map((_, i) => i)));
                                                        } else {
                                                            setSelectedCurrent(new Set());
                                                        }
                                                    }}
                                                />
                                                Chọn tất cả ({currentItems.length})
                                            </label>
                                        )}
                                        {shippedCount > 0 && (
                                            <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                                                Đã gửi: {shippedCount}/{currentItems.length}
                                            </span>
                                        )}
                                    </div>
                                    
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        {/* Nút THÊM MÓN chính (Hình 1 -> Mở Hình 2 Bảng tính) */}
                                        <button
                                            type="button"
                                            onClick={() => setIsCalculatorOpen(true)}
                                            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs px-3 py-1.5 rounded-xl shadow-md flex items-center gap-1 cursor-pointer transition-all active:scale-95 border border-emerald-400/30"
                                        >
                                            <Plus size={13} className="stroke-[3]" />
                                            <span>+ Thêm món</span>
                                        </button>

                                        {selectedCurrent.size > 0 ? (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        store.markCurrentItemsShipped(platform, cleanUser, Array.from(selectedCurrent), true);
                                                    }}
                                                    className="text-[11px] font-bold text-emerald-300 hover:text-white bg-emerald-950/50 hover:bg-emerald-900/60 px-2.5 py-1.5 rounded-xl border border-emerald-500/40 flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                                                >
                                                    <span>✅ Đã gửi ({selectedCurrent.size})</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        store.markCurrentItemsShipped(platform, cleanUser, Array.from(selectedCurrent), false);
                                                    }}
                                                    className="text-[11px] font-bold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-xl border border-white/20 flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                                                >
                                                    <span>↩️ Chưa gửi ({selectedCurrent.size})</span>
                                                </button>
                                            </>
                                        ) : (
                                            hasCurrentItems && unshippedCount > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        store.markCurrentItemsShipped(platform, cleanUser, undefined, true);
                                                    }}
                                                    title="Đánh dấu tất cả các món hôm nay đã gửi"
                                                    className="text-[11px] font-bold text-emerald-300 hover:text-white bg-emerald-950/40 hover:bg-emerald-900/50 px-2.5 py-1.5 rounded-xl border border-emerald-500/30 flex items-center gap-1 cursor-pointer transition-colors"
                                                >
                                                    <span>✅ Đã gửi hết ({unshippedCount})</span>
                                                </button>
                                            )
                                        )}
                                        {shippedCount > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => store.archiveShippedCurrentItems(platform, cleanUser)}
                                                title="Chuyển các món đã gửi vào danh sách Lịch sử chốt đơn cũ"
                                                className="text-[11px] font-bold text-cyan-300 hover:text-white bg-cyan-950/40 hover:bg-cyan-900/50 px-2.5 py-1.5 rounded-xl border border-cyan-500/30 flex items-center gap-1 cursor-pointer transition-colors"
                                            >
                                                <span>📦 Dọn vào LS ({shippedCount})</span>
                                            </button>
                                        )}
                                        {hasCurrentItems && totalSelectedCount === 0 && unshippedCount > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedCurrent(new Set(currentItems.map((_, i) => i)));
                                                    setIsPushModalOpen(true);
                                                }}
                                                className="text-[11px] font-bold text-orange-400 hover:text-white bg-orange-950/40 hover:bg-orange-900/50 px-2.5 py-1.5 rounded-xl border border-orange-500/30 flex items-center gap-1 cursor-pointer transition-colors"
                                            >
                                                <span>🥞 Đẩy đơn Pancake</span>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="mb-4">
                                    {!hasCurrentItems ? (
                                        <div className="text-center text-gray-400 py-6 bg-[#0e1621] rounded-2xl border border-dashed border-white/10 text-xs space-y-2">
                                            <div>Phiên này chưa chốt đơn nào cho khách.</div>
                                            <button
                                                type="button"
                                                onClick={() => setIsCalculatorOpen(true)}
                                                className="text-xs text-emerald-400 hover:text-emerald-300 font-bold underline cursor-pointer"
                                            >
                                                + Bấm vào đây để mở bảng tính thêm món đầu tiên
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="bg-[#121b27] border border-white/10 rounded-2xl p-2.5 sm:p-3 shadow-md space-y-2">
                                            {allCurrentShipped && (
                                                <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-2.5 mb-2 flex items-center justify-between gap-2">
                                                    <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                                                        <span>🎉</span>
                                                        <span>Tất cả {currentItems.length} món phiên này đã được đánh dấu đi đơn!</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => store.archiveShippedCurrentItems(platform, cleanUser)}
                                                        className="text-[10px] font-bold text-emerald-200 hover:text-white bg-emerald-800/60 hover:bg-emerald-700 px-2.5 py-1 rounded-lg border border-emerald-400/40 cursor-pointer transition-all active:scale-95"
                                                    >
                                                        📦 Dọn vào lịch sử cũ
                                                    </button>
                                                </div>
                                            )}

                                            {/* KIỂU LIST ĐƠN HÀNG CHUẨN (HÌNH 3: DANH SÁCH CHI TIẾT TÊN MÓN, SL X ĐƠN GIÁ, THÀNH TIỀN & CARD TỔNG CỘNG) */}
                                            <div className="bg-[#0e1724] border border-white/10 rounded-2xl p-3 sm:p-4 shadow-lg space-y-3">
                                                {currentItems.map((item, idx) => ({ item, idx })).reverse().map(({ item, idx }) => {
                                                    const itemUnitPrice = item.unitPrice || item.price;
                                                    const itemQty = item.quantity || 1;
                                                    const itemTotalK = item.price || (itemUnitPrice * itemQty);
                                                    const itemUnitPriceVnd = itemUnitPrice * 1000;
                                                    const itemTotalVnd = itemTotalK * 1000;

                                                    const displayName = (!item.content || item.content === "(Không ghi chú)" || item.content.includes("Không ghi chú")) 
                                                        ? `Sản phẩm ${itemUnitPrice}k` 
                                                        : item.content;

                                                    return (
                                                        <div 
                                                            key={`current-item-${idx}`}
                                                            className={`p-3 rounded-xl border transition-all ${
                                                                selectedCurrent.has(idx) 
                                                                    ? 'bg-blue-950/40 border-blue-500/60 shadow-md ring-1 ring-blue-500/30' 
                                                                    : item.shipped 
                                                                    ? 'bg-[#0b121c]/80 border-emerald-500/20 opacity-80' 
                                                                    : 'bg-[#141f2e] border-white/10 hover:border-white/20 shadow-xs'
                                                            }`}
                                                        >
                                                            {/* Dòng 1: Tên sản phẩm (Trái) & Thành tiền to đậm (Phải) */}
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        className="rounded border-white/20 w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0 mt-0.5"
                                                                        checked={selectedCurrent.has(idx)}
                                                                        onChange={(e) => {
                                                                            const newSet = new Set(selectedCurrent);
                                                                            if (e.target.checked) newSet.add(idx);
                                                                            else newSet.delete(idx);
                                                                            setSelectedCurrent(newSet);
                                                                        }}
                                                                    />
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className={`font-black text-sm sm:text-base tracking-wide truncate ${item.shipped ? 'line-through text-gray-400' : 'text-white'}`}>
                                                                            {displayName}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="text-right shrink-0">
                                                                    <span className={`font-mono font-black text-base sm:text-lg tracking-tight ${item.shipped ? 'text-gray-400 line-through' : 'text-white'}`}>
                                                                        {itemTotalVnd.toLocaleString('vi-VN')}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Dòng 2: Công thức [SL x Đơn giá] (Trái) & Các nút thao tác (Phải) */}
                                                            <div className="flex items-center justify-between gap-2 mt-1.5 pt-1.5 border-t border-white/5 pl-6.5">
                                                                <div className="text-xs sm:text-sm font-medium text-gray-400 font-mono flex items-center gap-1.5">
                                                                    <span>{itemQty} x {itemUnitPriceVnd.toLocaleString('vi-VN')}</span>
                                                                    <span className="text-[10px] text-gray-500 font-sans">({itemUnitPrice}k/cái)</span>
                                                                </div>

                                                                <div className="flex items-center gap-1.5 shrink-0">
                                                                    {/* Nút toggle trạng thái Đã gửi */}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => store.toggleCurrentItemShipped(platform, cleanUser, idx)}
                                                                        title={item.shipped ? "Bấm để đổi thành Chưa gửi" : "Bấm để đánh dấu Đã gửi"}
                                                                        className={`text-[10px] font-bold px-2 py-0.8 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                                                                            item.shipped 
                                                                                ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50 hover:bg-emerald-500/35' 
                                                                                : 'bg-white/5 text-gray-400 border-white/15 hover:bg-emerald-950/40 hover:text-emerald-300 hover:border-emerald-500/40'
                                                                        }`}
                                                                    >
                                                                        {item.shipped ? '✓ GỬI' : '📦 Chưa'}
                                                                    </button>

                                                                    {/* Nút In tem */}
                                                                    <button 
                                                                        onClick={() => {
                                                                            let time = new Date().toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit'});
                                                                            const cleanPrintContent = `${displayName} (${itemUnitPrice}k x ${itemQty})`;
                                                                            printLabel(store[platform].nicknames?.[cleanUser] ? `${cleanUser} (${store[platform].nicknames[cleanUser]})` : `#${getShortId(cleanUser)} ${cleanUser}`, cleanPrintContent, itemTotalK, time, PLATFORMS[platform].label);
                                                                        }}
                                                                        className="bg-green-600 hover:bg-green-500 text-white rounded-lg px-2 py-0.8 font-bold text-[11px] flex items-center gap-1 shadow-xs cursor-pointer active:scale-95 transition-all"
                                                                        title="In tem dán món này"
                                                                    >
                                                                        🖨️ IN
                                                                    </button>

                                                                    {/* Nút Xóa món */}
                                                                    <DeleteConfirmButton 
                                                                        onDelete={() => store.deleteOrderItem(platform, cleanUser, idx, false)}
                                                                        className="rounded-lg px-2 py-0.8 text-[11px]"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                                {/* 🌟 CARD TỔNG CỘNG (CHÍNH XÁC NHƯ HÌNH 3: SL: X CÁI | TỔNG CỘNG | 679.000 đ) */}
                                                {(() => {
                                                    const totalQty = currentItems.reduce((sum, it) => sum + (it.quantity || 1), 0);
                                                    const totalPriceK = currentItems.reduce((sum, it) => sum + (it.price || 0), 0);
                                                    const totalPriceVnd = totalPriceK * 1000;

                                                    return (
                                                        <div className="bg-gradient-to-r from-[#0a121d] via-[#0f1b2b] to-[#0a121d] border-2 border-emerald-500/40 rounded-2xl p-3.5 sm:p-4.5 flex items-center justify-between shadow-xl mt-3">
                                                            <div>
                                                                <div className="text-xs sm:text-sm font-black text-gray-400 tracking-wider uppercase font-mono">
                                                                    SL: {totalQty} CÁI
                                                                </div>
                                                                <div className="text-lg sm:text-2xl font-black text-white tracking-wide uppercase mt-0.5">
                                                                    TỔNG CỘNG
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono tracking-tight">
                                                                    {totalPriceVnd.toLocaleString('vi-VN')}
                                                                </span>
                                                                <span className="text-emerald-400 font-bold text-base sm:text-lg ml-1">đ</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}

                                                {/* Nút Thêm Món Nhanh Dưới Chân */}
                                                <div className="pt-2 flex items-center justify-between gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsCalculatorOpen(true)}
                                                        className="w-full py-2.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 hover:text-white border border-emerald-500/40 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-98 shadow-md"
                                                    >
                                                        <Plus size={14} className="stroke-[3]" />
                                                        <span>+ Thêm món khác vào giỏ</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })()}
                    <div>
                        <div className="text-sm font-bold text-gray-100 mb-3 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <span>📜 Lịch sử chốt đơn cũ</span>
                                {cust?.pastItems && cust.pastItems.length > 0 && (
                                    <label className="flex items-center gap-1.5 text-xs font-normal cursor-pointer text-gray-400 bg-[#1c242f] hover:bg-white/10 px-2 py-1 rounded transition-colors">
                                        <input 
                                            type="checkbox" 
                                            className="rounded border-white/20 text-blue-600 focus:ring-blue-500 cursor-pointer w-3.5 h-3.5"
                                            checked={selectedPast.size === cust.pastItems.length && cust.pastItems.length > 0}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedPast(new Set(cust.pastItems!.map((_, i) => i)));
                                                } else {
                                                    setSelectedPast(new Set());
                                                }
                                            }}
                                        />
                                        Chọn tất cả ({cust.pastItems.length})
                                    </label>
                                )}
                            </div>
                            {selectedPast.size > 0 && (
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => {
                                            store.mergePastItems(platform, cleanUser, Array.from(selectedPast));
                                            setSelectedPast(new Set());
                                        }}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-xs font-bold shadow-sm cursor-pointer"
                                    >
                                        GỘP ({selectedPast.size})
                                    </button>
                                    {!confirmingBulkDelete ? (
                                        <button 
                                            onClick={() => setConfirmingBulkDelete(true)}
                                            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-md text-xs font-bold shadow-sm cursor-pointer transition-colors"
                                        >
                                            XÓA ({selectedPast.size})
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => {
                                                store.deletePastItems(platform, cleanUser, Array.from(selectedPast));
                                                setSelectedPast(new Set());
                                                setConfirmingBulkDelete(false);
                                            }}
                                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md text-xs font-bold shadow-sm cursor-pointer animate-pulse"
                                        >
                                            ⚠️ XÁC NHẬN XÓA
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                        {(() => {
                            const activeInsight = (insight || getCustomerInsight(cleanUser));
                            const sStat = checkCustomerPancakeShippedStatus(cust, activeInsight);
                            const displayPastItems = (cust?.pastItems || []).map((item, originalIdx) => ({ item, originalIdx })).filter(({ item }) => {
                                if (item.shipped) return false;
                                if (!sStat.isAllShipped || !sStat.latestPancakeTime) return true;
                                const itTime = item.createdAt || (item.id ? parseInt(String(item.id).substring(0, 13)) : 0) || 0;
                                return itTime > (sStat.latestPancakeTime + 120000);
                            });

                            return (
                                <div className="space-y-3">
                                    {displayPastItems.length === 0 ? (
                                        sStat.isAllShipped && sStat.latestPancakeOrder ? (
                                            <div className="text-center text-gray-400 py-3.5 bg-[#0e1621] rounded-xl border border-dashed border-emerald-500/25 text-xs space-y-1">
                                                <div className="text-emerald-400 font-bold flex items-center justify-center gap-1.5">
                                                    <span>✅ Lịch sử chốt đơn cũ đã đi hết trên Pancake POS</span>
                                                    <span className="font-mono text-emerald-300 bg-emerald-500/20 px-1.5 py-0.2 rounded text-[10px]">
                                                        #{sStat.latestPancakeOrder.orderNumber}
                                                    </span>
                                                </div>
                                                <div className="text-[11px] text-gray-400">
                                                    Toàn bộ lịch sử chốt đơn trước đó đã được lên đơn {sStat.latestPancakeOrder.insertedAt ? "(" + new Date(sStat.latestPancakeOrder.insertedAt).toLocaleString("vi-VN", {day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"}) + ")" : ""} và đã dọn sạch.
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center text-gray-400 py-4 bg-[#0e1621] rounded-xl border border-dashed border-white/10 text-xs">Chưa có lịch sử chốt đơn các phiên trước.</div>
                                        )
                                    ) : (
                                        <div className="bg-[#0e1724] border border-white/10 rounded-2xl p-3 sm:p-4 shadow-sm mt-2 space-y-3">
                                        {displayPastItems.reverse().map(({ item, originalIdx }) => {
                                            const d = new Date(item.createdAt || parseInt(item.id.substring(0,13)) || Date.now());
                                            const now = new Date();
                                            const isToday = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                                            const yesterday = new Date(now);
                                            yesterday.setDate(now.getDate() - 1);
                                            const isYesterday = d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth() && d.getFullYear() === yesterday.getFullYear();
                                            let dateStr = d.toLocaleDateString('vi-VN', {day:'2-digit', month:'2-digit'});
                                            if (isToday) dateStr = 'Hôm nay';
                                            else if (isYesterday) dateStr = 'Hôm qua';

                                            const itemUnitPrice = item.unitPrice || item.price;
                                            const itemQty = item.quantity || 1;
                                            const itemTotalK = item.price || (itemUnitPrice * itemQty);
                                            const itemUnitPriceVnd = itemUnitPrice * 1000;
                                            const itemTotalVnd = itemTotalK * 1000;

                                            const displayName = (!item.content || item.content === "(Không ghi chú)" || item.content.includes("Không ghi chú")) 
                                                ? `Sản phẩm ${itemUnitPrice}k` 
                                                : item.content;

                                            return (
                                            <div 
                                                key={`past-${originalIdx}`} 
                                                className={`p-3 rounded-xl border transition-all ${
                                                    selectedPast.has(originalIdx) 
                                                        ? 'bg-blue-950/40 border-blue-500/50 shadow-md' 
                                                        : 'bg-[#141f2e] border-white/10'
                                                }`}
                                            >
                                                {/* Dòng 1: Checkbox + Ngày + Tên món (Trái) & Thành tiền (Phải) */}
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={selectedPast.has(originalIdx)} 
                                                            onChange={() => {
                                                                const newSet = new Set(selectedPast);
                                                                if (newSet.has(originalIdx)) newSet.delete(originalIdx);
                                                                else newSet.add(originalIdx);
                                                                setSelectedPast(newSet);
                                                            }}
                                                            className="rounded border-white/20 w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0 mt-0.5"
                                                        />
                                                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-white/10 text-gray-400 rounded uppercase shrink-0 font-mono">
                                                            {dateStr}
                                                        </span>
                                                        <div className="min-w-0 flex-1">
                                                            <div className={`font-black text-sm sm:text-base tracking-wide truncate ${item.shipped ? 'line-through text-gray-400' : 'text-white'}`}>
                                                                {displayName}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="text-right shrink-0">
                                                        <span className="font-mono font-black text-base sm:text-lg tracking-tight text-white">
                                                            {itemTotalVnd.toLocaleString('vi-VN')}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Dòng 2: SL x Đơn giá (Trái) & Thao tác (Phải) */}
                                                <div className="flex items-center justify-between gap-2 mt-1.5 pt-1.5 border-t border-white/5 pl-6">
                                                    <div className="text-xs sm:text-sm font-medium text-gray-400 font-mono flex items-center gap-1.5">
                                                        <span>{itemQty} x {itemUnitPriceVnd.toLocaleString('vi-VN')}</span>
                                                        <span className="text-[10px] text-gray-500 font-sans">({itemUnitPrice}k/cái)</span>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <button 
                                                            onClick={() => {
                                                                let time = new Date().toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit'});
                                                                const cleanPrintContent = `${displayName} (${itemUnitPrice}k x ${itemQty})`;
                                                                printLabel(store[platform].nicknames?.[cleanUser] ? `${cleanUser} (${store[platform].nicknames[cleanUser]})` : `#${getShortId(cleanUser)} ${cleanUser}`, cleanPrintContent, itemTotalK, time, PLATFORMS[platform].label);
                                                            }}
                                                            className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-2 py-0.8 font-bold text-[11px] whitespace-nowrap flex items-center gap-1 shadow-xs cursor-pointer active:scale-95 transition-all"
                                                        >
                                                            🖨️ IN
                                                        </button>
                                                        <DeleteConfirmButton 
                                                            onDelete={() => store.deleteOrderItem(platform, cleanUser, originalIdx, true)}
                                                            className="rounded-lg px-2 py-0.8 text-[11px]"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )})}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </div>

            {/* Item Calculator Modal (Hình 2: Bảng tính công thức Giá x SL) */}
            {isCalculatorOpen && (
                <ItemCalculatorModal
                    user={cleanUser}
                    platform={platform}
                    onClose={() => setIsCalculatorOpen(false)}
                    onAdded={() => setIsCalculatorOpen(false)}
                />
            )}

            {/* Pancake Order Push Modal */}
            <PancakeOrderPushModal
                isOpen={isPushModalOpen}
                user={cleanUser}
                platform={platform}
                selectedCurrentIndices={selectedCurrent.size > 0 ? selectedCurrent : new Set((cust?.items || []).map((_, i) => i))}
                selectedPastIndices={selectedPast}
                onClose={() => setIsPushModalOpen(false)}
                onSuccess={(created) => {
                    // Refresh data or clear
                }}
            />
        </div>
    );
}


export function CustomersModal({
    onClose,
    onOpenProfile,
    onOpenNewOrder,
    onOpenPancakeLink,
    isPage = false,
    searchKeyword = '',
    onScroll
}: {
    onClose: () => void;
    onOpenProfile?: (u: string, p: Platform) => void;
    onOpenNewOrder?: (u: string, p: Platform) => void;
    onOpenPancakeLink?: (user: string, platform: Platform, initialSearch?: string) => void;
    isPage?: boolean;
    searchKeyword?: string;
    onScroll?: (isDown: boolean) => void;
}) {
    const store = useStore();
    const [selectedPlatform, setSelectedPlatform] = useState<Platform | 'all'>('all');
    const [selectedTag, setSelectedTag] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'has_orders' | 'holding' | 'shipped'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
        try {
            return (localStorage.getItem('slp_customers_view_mode') as 'list' | 'grid') || 'grid';
        } catch {
            return 'grid';
        }
    });

    const handleSetViewMode = (mode: 'list' | 'grid') => {
        setViewMode(mode);
        try {
            localStorage.setItem('slp_customers_view_mode', mode);
        } catch {}
    };

    const lastScrollY = useRef(0);
    const handleListScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const currentY = e.currentTarget.scrollTop;
        if (onScroll) {
            if (currentY > lastScrollY.current + 5 && currentY > 20) {
                onScroll(true); // Lướt xuống
            } else if (currentY < lastScrollY.current - 5) {
                onScroll(false); // Lướt lên
            }
        }
        lastScrollY.current = currentY;
    };

    let customerList: { 
        user: string; 
        platform: Platform; 
        data: CustomerData; 
        tag: string; 
        sevenDaysRevenue: number; 
        hasRecent: boolean; 
        hasOldItems: boolean;
        activeItemsCount: number;
        activeItemsTotal: number;
        holdingCount: number;
        holdingTotal: number;
        hasActiveOrders: boolean;
        isHolding: boolean;
        isAllShipped: boolean;
        shippedPancakeOrder: any;
        avatar?: string;
    }[] = [];

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    (['tiktok', 'facebook', 'shopee'] as Platform[]).forEach(p => {
        if (selectedPlatform !== 'all' && selectedPlatform !== p) return;
        const custs = store[p].customers;
        const comments = store[p].comments;

        Object.keys(custs).forEach(rawUser => {
            const user = normalizeUser(rawUser);
            const data = custs[rawUser];
            const tag = store[p].tags[user] || 'NORMAL';
            
            let sevenDaysRevenue = 0;
            let hasRecent = false;
            let oldestUnshippedTime = now;
            
            const allItems = [...(data.items || []), ...(data.pastItems || [])];
            allItems.forEach(item => {
                const itemTime = item.createdAt || (item.id ? parseInt(String(item.id).substring(0, 13)) : 0) || 0;
                if (itemTime >= sevenDaysAgo) {
                    sevenDaysRevenue += (item.price || 0);
                    hasRecent = true;
                }
                if (!item.shipped && itemTime > 0 && itemTime < oldestUnshippedTime) {
                    oldestUnshippedTime = itemTime;
                }
            });

            // Đơn đang còn trong giỏ
            const activeItems = data.items || [];
            const activeItemsCount = activeItems.length;
            const activeItemsTotal = data.total || activeItems.reduce((s, it) => s + (it.price || 0), 0);
            
            // Kiểm tra trạng thái đã đi hết đơn trên Pancake POS
            const custInsight = getCustomerInsight(user);
            const shippedStatus = checkCustomerPancakeShippedStatus(data, custInsight);
            const isAllShipped = shippedStatus.isAllShipped;
            const shippedPancakeOrder = shippedStatus.latestPancakeOrder;

            // Đơn còn cần xử lý (nếu đã đi hết đơn trên Pancake thì không còn coi là nợ đơn)
            const hasActiveOrders = !isAllShipped && (data.items?.some(it => !it.shipped) || (data.count > 0 && activeItemsTotal > 0));
            
            // Đơn đang giữ phiên trước chưa giao (unshipped)
            const unshippedPastItems = (data.pastItems || []).filter(it => !it.shipped);
            const holdingCount = unshippedPastItems.length;
            const holdingTotal = unshippedPastItems.reduce((s, it) => s + (it.price || 0), 0);
            const isHolding = !isAllShipped && (holdingCount > 0 || (tag as string) === 'HOLD');

            // Cảnh báo nếu có đơn giữ quá 3 ngày (72h)
            const hasOldItems = (now - oldestUnshippedTime > 3 * 24 * 60 * 60 * 1000);

            // Tìm avatar nếu có từ comments
            const userComment = comments.find(c => normalizeUser(c.user) === user && c.avatar);
            const avatar = userComment?.avatar;

            customerList.push({ 
                user, 
                platform: p, 
                data, 
                tag, 
                sevenDaysRevenue, 
                hasRecent, 
                hasOldItems, 
                activeItemsCount,
                activeItemsTotal,
                holdingCount,
                holdingTotal,
                hasActiveOrders,
                isHolding,
                isAllShipped,
                shippedPancakeOrder,
                avatar
            });
        });
    });

    // Thống kê nhanh số lượng phục vụ hiển thị trên nút lọc
    const totalCustomersWithOrders = customerList.filter(c => c.hasActiveOrders).length;
    const totalCustomersHolding = customerList.filter(c => c.isHolding).length;
    const totalCustomersShipped = customerList.filter(c => c.isAllShipped).length;

    // Filter by status (Còn đơn / Đang giữ)
    if (statusFilter === 'has_orders') {
        customerList = customerList.filter(c => c.hasActiveOrders);
    } else if (statusFilter === 'holding') {
        customerList = customerList.filter(c => c.isHolding);
    } else if (statusFilter === 'shipped') {
        customerList = customerList.filter(c => c.isAllShipped);
    }

    // Filter by tag
    if (selectedTag !== 'all') {
        customerList = customerList.filter(c => c.tag === selectedTag);
    }

    // Filter by search term (combining local searchTerm or searchKeyword from global header)
    const effectiveSearch = (searchTerm || searchKeyword || '').trim().toLowerCase();
    if (effectiveSearch) {
        customerList = customerList.filter(c => {
            if ((effectiveSearch === '/coc' || effectiveSearch === '/coc50') && c.tag === 'COC') return true;
            if ((effectiveSearch === '/coc' || effectiveSearch === '/coc100') && c.tag === 'COC_100') return true;
            if (effectiveSearch === '/quen' && c.tag === 'VIP') return true;
            if (effectiveSearch === '/vip' && c.tag === 'VIP') return true;
            if (effectiveSearch === '/dao' && c.tag === 'DAO') return true;
            if (effectiveSearch === '/chan' && c.tag === 'CHAN') return true;
            if (effectiveSearch === '/bom' && c.tag === 'BOM') return true;
            if (effectiveSearch === '/giu' && c.isHolding) return true;
            if (effectiveSearch === '/condon' && c.hasActiveOrders) return true;
            if (effectiveSearch === '/top10') return true;
            if (effectiveSearch.startsWith('/')) return false;

            const nick = store[c.platform].nicknames?.[c.user] || '';
            const shortId = getShortId(c.user).toLowerCase();
            return c.user.toLowerCase().includes(effectiveSearch) ||
                   nick.toLowerCase().includes(effectiveSearch) ||
                   shortId.includes(effectiveSearch) ||
                   ('#' + shortId).includes(effectiveSearch);
        });
    }

    // Sắp xếp: tổng 7 ngày cao nhất lên đầu, sau đó đến tổng all time
    customerList.sort((a, b) => {
        if (effectiveSearch === '/top10') {
            return (b.data.lastTime || 0) - (a.data.lastTime || 0);
        }
        if (statusFilter === 'has_orders') {
            return b.activeItemsCount - a.activeItemsCount;
        }
        if (statusFilter === 'holding') {
            return b.holdingCount - a.holdingCount;
        }
        if (b.sevenDaysRevenue !== a.sevenDaysRevenue) return b.sevenDaysRevenue - a.sevenDaysRevenue;
        return (b.data.total || 0) - (a.data.total || 0);
    });

    const totalAllPlatforms = (['tiktok', 'facebook', 'shopee'] as Platform[]).reduce(
        (sum, p) => sum + Object.keys(store[p].customers).length, 0
    );

    return (
        <div className={isPage ? "h-full w-full flex flex-col bg-[#0e1621]" : "fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-2 sm:p-4"}>
            <div className={`w-full ${isPage ? "h-full flex flex-col bg-[#0e1621]" : "bg-[#1c242f] rounded-2xl border border-white/10 max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"}`}>
                
                {/* Modal Header */}
                {!isPage && (
                    <div className="flex justify-between items-center p-4 border-b border-white/10 shrink-0 bg-[#1c242f]">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">👥</span>
                            <h3 className="text-lg font-bold text-gray-100 m-0">
                                DANH SÁCH KHÁCH HÀNG
                            </h3>
                            <span className="bg-blue-500/20 text-blue-400 text-xs font-bold px-2.5 py-0.5 rounded-full ml-1 border border-blue-500/30">
                                {customerList.length} khách
                            </span>
                        </div>
                        <button 
                            onClick={onClose} 
                            className="bg-white/10 rounded-full w-8 h-8 flex items-center justify-center font-bold text-gray-400 hover:bg-white/20 cursor-pointer"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* Filters & View Mode Bar */}
                <div className="p-3 bg-[#1c242f] border-b border-white/10 shrink-0 space-y-2.5">
                    {/* Platform Tabs & View Mode Switcher */}
                    <div className="flex justify-between items-center gap-2">
                        <div className="flex gap-1.5 overflow-x-auto pb-0.5 hide-scrollbar flex-1">
                            <button
                                onClick={() => setSelectedPlatform('all')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                                    selectedPlatform === 'all' 
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                                        : 'bg-[#0e1621] border border-white/10 text-gray-400 hover:bg-white/5'
                                }`}
                            >
                                🌐 Tất cả ({totalAllPlatforms})
                            </button>
                            {(['tiktok', 'facebook', 'shopee'] as Platform[]).map(p => {
                                const custCount = Object.keys(store[p].customers).length;
                                return (
                                    <button
                                        key={p}
                                        onClick={() => setSelectedPlatform(p)}
                                        className={`px-3 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                                            selectedPlatform === p 
                                                ? `${PLATFORMS[p].bgClass} text-white shadow-md ring-2 ring-white/20` 
                                                : 'bg-[#0e1621] border border-white/10 text-gray-400 hover:bg-white/5'
                                        }`}
                                    >
                                        {PLATFORMS[p].label} ({custCount})
                                    </button>
                                );
                            })}
                        </div>

                        {/* View Mode Toggle: Danh sách vs Dạng ô */}
                        <div className="flex items-center bg-[#0e1621] p-1 rounded-xl border border-white/10 shrink-0">
                            <button
                                type="button"
                                onClick={() => handleSetViewMode('list')}
                                className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                                    viewMode === 'list'
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-gray-400 hover:text-white'
                                }`}
                                title="Xem dạng danh sách"
                            >
                                <List size={16} />
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSetViewMode('grid')}
                                className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                                    viewMode === 'grid'
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-gray-400 hover:text-white'
                                }`}
                                title="Xem dạng ô (Grid)"
                            >
                                <LayoutGrid size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Quick Status & Tag Pills */}
                    <div className="flex gap-1.5 overflow-x-auto pb-0.5 hide-scrollbar text-[11px] items-center">
                        {/* Tất cả */}
                        <button
                            onClick={() => { setSelectedTag('all'); setStatusFilter('all'); }}
                            className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all cursor-pointer ${
                                selectedTag === 'all' && statusFilter === 'all'
                                    ? 'bg-white/25 text-white border border-white/40 shadow-sm' 
                                    : 'bg-[#0e1621] text-gray-400 border border-white/10 hover:bg-white/5'
                            }`}
                        >
                            Tất cả ({customerList.length})
                        </button>

                        {/* BỘ LỌC ĐANG CÒN ĐƠN */}
                        <button
                            onClick={() => setStatusFilter(statusFilter === 'has_orders' ? 'all' : 'has_orders')}
                            className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                                statusFilter === 'has_orders' 
                                    ? 'bg-emerald-600 text-white shadow-md ring-1 ring-emerald-400' 
                                    : 'bg-[#0e1621] text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10'
                            }`}
                            title="Lọc khách hàng đang có đơn trong giỏ hàng"
                        >
                            <span>🛍️ Còn đơn</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 font-mono">
                                {totalCustomersWithOrders}
                            </span>
                        </button>

                        {/* BỘ LỌC ĐANG GIỮ */}
                        <button
                            onClick={() => setStatusFilter(statusFilter === 'holding' ? 'all' : 'holding')}
                            className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                                statusFilter === 'holding' 
                                    ? 'bg-amber-600 text-white shadow-md ring-1 ring-amber-400' 
                                    : 'bg-[#0e1621] text-amber-400 border border-amber-500/30 hover:bg-amber-500/10'
                            }`}
                            title="Lọc khách hàng đang giữ hàng phiên trước chưa giao"
                        >
                            <span>⏳ Đang giữ</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 font-mono">
                                {totalCustomersHolding}
                            </span>
                        </button>
                        {/* BỘ LỌC ĐÃ ĐI HẾT ĐƠN */}
                        {totalCustomersShipped > 0 && (
                            <button
                                onClick={() => setStatusFilter(statusFilter === 'shipped' ? 'all' : 'shipped')}
                                className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                                    statusFilter === 'shipped' 
                                        ? 'bg-emerald-700 text-white shadow-md ring-1 ring-emerald-400' 
                                        : 'bg-[#0e1621] text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/10'
                                }`}
                                title="Lọc khách hàng đã có đơn Pancake mới hơn ngày chốt (đã đi hết đơn)"
                            >
                                <span>✅ Đã đi hết</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 font-mono">
                                    {totalCustomersShipped}
                                </span>
                            </button>
                        )}

                        <div className="w-[1px] h-3.5 bg-white/20 shrink-0 mx-0.5" />

                        {/* Tag Pills */}
                        <button
                            onClick={() => setSelectedTag(selectedTag === 'VIP' ? 'all' : 'VIP')}
                            className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all cursor-pointer ${
                                selectedTag === 'VIP' ? 'bg-orange-500 text-white shadow-sm' : 'bg-[#0e1621] text-orange-400 border border-orange-500/20'
                            }`}
                        >
                            🌟 Quen (VIP)
                        </button>

                        <button
                            onClick={() => setSelectedTag(selectedTag === 'COC' ? 'all' : 'COC')}
                            className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all cursor-pointer ${
                                selectedTag === 'COC' ? 'bg-cyan-600 text-white shadow-sm' : 'bg-[#0e1621] text-cyan-400 border border-cyan-500/20'
                            }`}
                        >
                            💧 Cọc 50k
                        </button>

                        <button
                            onClick={() => setSelectedTag(selectedTag === 'COC_100' ? 'all' : 'COC_100')}
                            className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all cursor-pointer ${
                                selectedTag === 'COC_100' ? 'bg-blue-600 text-white shadow-sm' : 'bg-[#0e1621] text-blue-400 border border-blue-500/20'
                            }`}
                        >
                            💧 Cọc 100k
                        </button>

                        <button
                            onClick={() => setSelectedTag(selectedTag === 'DAO' ? 'all' : 'DAO')}
                            className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all cursor-pointer ${
                                selectedTag === 'DAO' ? 'bg-gray-600 text-white shadow-sm' : 'bg-[#0e1621] text-gray-400 border border-white/10'
                            }`}
                        >
                            👻 Dạo
                        </button>

                        <button
                            onClick={() => setSelectedTag(selectedTag === 'BOM' ? 'all' : 'BOM')}
                            className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all cursor-pointer ${
                                selectedTag === 'BOM' ? 'bg-red-600 text-white shadow-sm' : 'bg-[#0e1621] text-red-400 border border-red-500/20'
                            }`}
                        >
                            ⚠️ BOM
                        </button>

                        <button
                            onClick={() => setSelectedTag(selectedTag === 'CHAN' ? 'all' : 'CHAN')}
                            className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all cursor-pointer ${
                                selectedTag === 'CHAN' ? 'bg-black text-white border border-red-500/40' : 'bg-[#0e1621] text-gray-500 border border-white/5'
                            }`}
                        >
                            ⛔ Chặn
                        </button>
                    </div>

                    {/* In-modal Local Search if in popup mode */}
                    {!isPage && (
                        <div className="relative flex items-center">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="🔍 Tìm tên, biệt danh, #id hoặc /condon, /giu, /vip, /coc..."
                                className="w-full pl-3 pr-8 py-2 bg-[#0e1621] border border-white/20 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 placeholder-gray-400 font-medium"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-2 text-gray-400 hover:text-white text-xs font-bold bg-white/10 rounded-full w-6 h-6 flex items-center justify-center cursor-pointer"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Customer List Content */}
                <div 
                    onScroll={handleListScroll}
                    className="overflow-y-auto flex-1 bg-[#0e1621] pb-24"
                >
                    {customerList.length === 0 ? (
                        <div className="text-center text-gray-400 py-16 px-4">
                            <div className="text-3xl mb-2">👥</div>
                            <div className="text-sm font-medium">
                                {effectiveSearch ? `Không tìm thấy khách hàng nào khớp với "${effectiveSearch}"` : 'Chưa có dữ liệu khách hàng phù hợp bộ lọc'}
                            </div>
                        </div>
                    ) : viewMode === 'grid' ? (
                        /* CHẾ ĐỘ XEM DẠNG Ô (GRID VIEW) CHO KHÁCH HÀNG */
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3 p-2.5">
                            {customerList.map((item, idx) => {
                                const cleanUser = normalizeUser(item.user);
                                const nickname = store[item.platform].nicknames?.[cleanUser];
                                const displayName = nickname ? `${cleanUser} (${nickname})` : cleanUser;
                                const pLink = store[item.platform].pancakeLinks?.[cleanUser];
                                return (
                                    <div
                                        key={`cust-grid-${item.platform}-${cleanUser}-${idx}`}
                                        onClick={() => onOpenProfile?.(cleanUser, item.platform)}
                                        className="bg-[#151f2e] hover:bg-[#1a273a] border border-white/10 hover:border-blue-500/50 rounded-2xl p-3 flex flex-col justify-between shadow-md hover:shadow-xl transition-all cursor-pointer group active:scale-[0.99]"
                                        title="Bấm vào thẻ để xem chi tiết & giỏ hàng"
                                    >
                                        <div>
                                            {/* Header Card: Avatar + Tên + Platform + Mã ID */}
                                            <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-white/10">
                                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                    <CustomerAvatar 
                                                        user={cleanUser} 
                                                        platform={item.platform} 
                                                        avatarUrl={item.avatar}
                                                        tag={item.tag}
                                                        size="md"
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-[10px] font-mono font-bold text-gray-400">
                                                            #{getShortId(cleanUser)}
                                                        </div>
                                                        <div 
                                                            className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors truncate"
                                                            title={displayName}
                                                        >
                                                            {displayName}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div onClick={(e) => e.stopPropagation()}>
                                                    <CopyButton text={displayName} className="text-xs text-gray-500 hover:text-gray-300 shrink-0" />
                                                </div>
                                            </div>

                                            {/* Badges: Đã đi hết đơn / Còn đơn / Đang giữ / Giữ > 3 ngày */}
                                            <div className="flex flex-wrap gap-1.5 mb-2.5">
                                                {item.isAllShipped ? (
                                                    <span className="bg-emerald-500/25 border border-emerald-500/50 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                                                        ✅ Đã đi hết đơn (#{item.shippedPancakeOrder.orderNumber})
                                                    </span>
                                                ) : (
                                                    <>
                                                        {item.hasActiveOrders && (
                                                            <span className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                                                                🛍️ Còn đơn ({item.activeItemsCount} món · {item.activeItemsTotal}k)
                                                            </span>
                                                        )}
                                                        {item.isHolding && (
                                                            <span className="bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                                                                ⏳ Đang giữ {item.holdingCount} món ({item.holdingTotal}k)
                                                            </span>
                                                        )}
                                                    </>
                                                )}
                                                {item.hasOldItems && (
                                                    <span className="bg-rose-500/20 border border-rose-500/30 text-rose-300 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                                                        ⏰ Giữ &gt; 3 ngày
                                                    </span>
                                                )}
                                            </div>

                                            {/* Thống kê đơn chốt */}
                                            <div className="bg-[#0c141f] p-2 rounded-xl border border-white/5 text-[11px] text-gray-400 flex items-center justify-between">
                                                <div>
                                                    Đã chốt: <strong className="text-blue-400 font-bold">{item.data.count} cái</strong> ({item.data.total}k)
                                                </div>
                                                {item.sevenDaysRevenue > 0 && (
                                                    <div>
                                                        7 ngày: <strong className="text-gray-200 font-semibold">{item.sevenDaysRevenue}k</strong>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        /* CHẾ ĐỘ XEM DẠNG DANH SÁCH (LIST VIEW) */
                        <div className="divide-y divide-white/5">
                            {customerList.map((item, idx) => {
                                const cleanUser = normalizeUser(item.user);
                                const nickname = store[item.platform].nicknames?.[cleanUser];
                                const displayName = nickname ? `${cleanUser} (${nickname})` : cleanUser;
                                const pLink = store[item.platform].pancakeLinks?.[cleanUser];

                                return (
                                    <div 
                                        key={`cust-${item.platform}-${cleanUser}-${idx}`}
                                        className="px-4 py-3 hover:bg-white/5 transition-colors flex items-center justify-between gap-3 cursor-pointer group" onClick={() => onOpenProfile?.(cleanUser, item.platform)}
                                    >
                                        {/* Left: Customer Avatar + Details */}
                                        <div className="flex items-center gap-3 flex-1 min-w-0 pr-1">
                                            <CustomerAvatar 
                                                user={cleanUser} 
                                                platform={item.platform} 
                                                avatarUrl={item.avatar}
                                                tag={item.tag}
                                                size="md"
                                                onClick={() => onOpenProfile?.(cleanUser, item.platform)}
                                            />
                                            <div 
                                                onClick={() => onOpenProfile?.(cleanUser, item.platform)}
                                                className="cursor-pointer flex-1 min-w-0"
                                            >
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    {/* Customer ID */}
                                                    <span className="text-[11px] font-mono font-bold text-gray-400 bg-black/40 px-1.5 py-0.5 rounded border border-white/10 shrink-0">
                                                        #{getShortId(cleanUser)}
                                                    </span>
                                                    {/* Customer Name */}
                                                    <span 
                                                        className="text-[15px] font-bold text-white hover:text-blue-400 transition-colors truncate"
                                                        title="Bấm để xem hồ sơ"
                                                    >
                                                        {displayName}
                                                    </span>
                                                    {/* Copy Button */}
                                                    <CopyButton 
                                                        text={displayName} 
                                                        className="text-xs shrink-0 text-gray-500 hover:text-gray-300" 
                                                    />

                                                    {item.isAllShipped && (
                                                        <span className="bg-emerald-500/25 border border-emerald-500/50 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 shadow-xs">
                                                            ✅ Đã đi hết đơn {item.shippedPancakeOrder ? '#' + item.shippedPancakeOrder.orderNumber : ''}
                                                        </span>
                                                    )}
                                                    {/* HIỂN THỊ CÒN ĐƠN */}
                                                    {item.hasActiveOrders && (
                                                        <span className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 shadow-xs">
                                                            🛍️ Còn đơn ({item.activeItemsCount} món · {item.activeItemsTotal}k)
                                                        </span>
                                                    )}

                                                    {/* HIỂN THỊ ĐANG GIỮ */}
                                                    {item.isHolding && (
                                                        <span className="bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 shadow-xs">
                                                            ⏳ Đang giữ {item.holdingCount} món ({item.holdingTotal}k)
                                                        </span>
                                                    )}

                                                    {/* Old items warning */}
                                                    {item.hasOldItems && (
                                                        <span className="bg-rose-500/20 border border-rose-500/30 text-rose-300 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0">
                                                            ⏰ Giữ &gt; 3 ngày
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Subtitle Line: Đã chốt: 0 cái - 0k */}
                                                <div className="text-[12px] text-gray-400 mt-1 flex items-center flex-wrap">
                                                    <span>Đã chốt:</span>
                                                    <span className="font-bold text-blue-400 ml-1.5">
                                                        {item.data.count} cái <span className="text-gray-500 font-normal mx-0.5">-</span> {item.data.total}k
                                                    </span>
                                                    {item.sevenDaysRevenue > 0 && (
                                                        <span className="text-gray-400 ml-2 font-medium">
                                                            <span className="text-gray-600 mr-1.5">·</span>7 ngày: <span className="text-gray-300 font-semibold">{item.sevenDaysRevenue}k</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Click to open profile chevron indicator */}
                                        <div className="text-gray-500 group-hover:text-blue-400 transition-colors text-xs font-bold shrink-0">
                                            ›
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}