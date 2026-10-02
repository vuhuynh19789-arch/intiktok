import React, { useState, useEffect, useMemo, useRef, memo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useStore, CommentData, getFeedClearedAt, getGlobalFeedClearedAt } from '../store';
import { PLATFORMS, extractPriceFromContent, Platform, getShortId, normalizeUser, getClosedPriceForComment } from '../lib/core';
import { openPancakeApp, extractPhoneFromText } from '../lib/pancakeDeepLink';
import { getCustomerInsight, getOrderStatusLabel } from '../lib/pancakeSync';
import { CopyButton } from './Modals';
import { CustomerAvatar } from './UserAvatar';
import { PlusCircle, Edit3, Users, List, ChevronDown, ChevronUp, MessageSquare, LayoutGrid, Pin } from 'lucide-react';
import { QuickAssignModal } from './QuickAssignModal';

interface FeedProps {
    searchKeyword: string;
    hostMode?: boolean;
    onOpenPrice: (id: string | null, user: string, platform: Platform, defaultPrice?: string) => void;
    onOpenProfile: (user: string, platform: Platform) => void;
    onOpenPancakeLink?: (user: string, platform: Platform, initialSearch?: string) => void;
    onScroll?: (isDown: boolean) => void;
}

interface CommentRowProps {
    comment: CommentData;
    now: number;
    isBusy: boolean;
    onPrint: (c: CommentData, e?: React.MouseEvent) => void;
    onTogglePin: (platform: Platform, id: string, user: string) => void;
    onOpenPrice: (id: string | null, user: string, platform: Platform, defaultPrice?: string) => void;
    onOpenProfile: (user: string, platform: Platform) => void;
    onOpenPancakeLink?: (user: string, platform: Platform, initialSearch?: string) => void;
    onOpenQuickAssign?: (user: string, platform: Platform, commentPhone?: string) => void;
}

export interface UserCommentGroup {
    key: string;
    user: string;
    platform: Platform;
    avatar?: string;
    latestComment: CommentData;
    latestTs: number;
    comments: CommentData[];
    isPinned: boolean;
}

interface SubCommentRowProps {
    comment: CommentData;
    index: number;
    total: number;
    isBusy: boolean;
    now: number;
    onPrint: (c: CommentData, e?: React.MouseEvent) => void;
    onTogglePin: (platform: Platform, id: string, user: string) => void;
    onOpenPrice: (id: string | null, user: string, platform: Platform, defaultPrice?: string) => void;
    onOpenPancakeLink?: (user: string, platform: Platform, initialSearch?: string) => void;
    onOpenQuickAssign?: (user: string, platform: Platform, commentPhone?: string) => void;
}

const SubCommentRow = memo(function SubCommentRow({
    comment: c,
    index,
    total,
    isBusy,
    now,
    onPrint,
    onTogglePin,
    onOpenPrice,
    onOpenPancakeLink,
    onOpenQuickAssign
}: SubCommentRowProps) {
    const store = useStore();
    const pStore = store[c.platform] || store.tiktok;
    const count = (pStore.printed && pStore.printed[c.id]) || 0;
    const userName = normalizeUser(c.user);
    const isHost = pStore.tags && pStore.tags[userName] === 'HOST';
    const isCommentPinned = Boolean(pStore.pinned && pStore.pinned[c.id] && (pStore.pinned[c.id].expiry > now || isHost));
    const contentStr = typeof c.content === 'object' ? JSON.stringify(c.content) : String(c.content || '');
    const detectedPhone = extractPhoneFromText(contentStr);
    const extracted = extractPriceFromContent(contentStr);
    const closedPriceStr = getClosedPriceForComment(pStore.customers, userName, c.id);
    const isLatest = index === 0;

    return (
        <div className={`p-2.5 rounded-lg border transition-colors flex items-start justify-between gap-2 ${
            isCommentPinned
                ? 'bg-[#2a1b1b] border-red-500/50 shadow-xs'
                : isLatest 
                ? 'bg-[#1a2736] border-cyan-500/40 shadow-xs' 
                : 'bg-[#121b25] border-white/5 hover:bg-[#162230]'
        }`}>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                        isCommentPinned
                            ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                            : isLatest 
                            ? 'bg-[#00f2ea]/20 text-[#00f2ea] border border-[#00f2ea]/40' 
                            : 'bg-white/10 text-gray-400'
                    }`}>
                        #{total - index} {isLatest && '• Mới nhất'}
                    </span>
                    {c.time && (
                        <span className="text-[10px] text-gray-400 font-medium">
                            🕒 {c.time}
                        </span>
                    )}
                </div>

                <div 
                    onClick={() => onOpenPrice(c.id, userName, c.platform, extracted.price || closedPriceStr?.replace(/k/g, '') || undefined)}
                    className="text-red-300 hover:text-red-200 font-bold break-words mt-1 cursor-pointer text-sm"
                >
                    <span>{contentStr}</span>
                    {extracted.price ? (
                        <span className="ml-1.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-black px-1.5 py-0.2 rounded border border-emerald-500/40 inline-flex items-center gap-0.5">
                            🏷️ {extracted.price}k
                        </span>
                    ) : closedPriceStr ? (
                        <span className="ml-1.5 bg-emerald-500/25 text-emerald-200 text-[10px] font-black px-1.5 py-0.2 rounded border border-emerald-500/50 inline-flex items-center gap-0.5 shadow-xs" title="Giá đơn đã chốt">
                            🏷️ {closedPriceStr}
                        </span>
                    ) : null}
                </div>

                {detectedPhone && (
                    <div className="flex items-center gap-1 mt-1">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                openPancakeApp(detectedPhone, true);
                            }}
                            className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-blue-950/80 border border-blue-500/40 text-blue-300 text-[10px] font-semibold"
                        >
                            <span>💬 Zalo: {detectedPhone}</span>
                        </button>
                    </div>
                )}
            </div>

            <div className="shrink-0 flex items-center gap-1">
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onTogglePin(c.platform, c.id, userName);
                    }}
                    title={isCommentPinned ? "Bỏ ghim bình luận này" : "Ghim bình luận này lên đầu"}
                    className={`p-1 text-xs rounded transition-all cursor-pointer ${
                        isCommentPinned
                            ? 'bg-red-500 text-white font-bold shadow-xs'
                            : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white'
                    }`}
                >
                    <span>📌</span>
                </button>
                <button
                    disabled={isBusy}
                    onClick={(e) => onPrint(c, e)}
                    className={`w-12 h-6 rounded text-xs font-bold text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
                        isBusy ? 'bg-gray-500' : count > 0 ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                >
                    {count === 0 ? 'IN' : `(${count})`}
                </button>
            </div>
        </div>
    );
});

interface UserGroupRowProps {
    group: UserCommentGroup;
    isExpanded: boolean;
    onToggleExpand: (groupKey: string) => void;
    now: number;
    busyPrints: Record<string, boolean>;
    onPrint: (c: CommentData, e?: React.MouseEvent) => void;
    onTogglePin: (platform: Platform, id: string, user: string) => void;
    onToggleGroupPin: (group: UserCommentGroup) => void;
    onOpenPrice: (id: string | null, user: string, platform: Platform, defaultPrice?: string) => void;
    onOpenProfile: (user: string, platform: Platform) => void;
    onOpenPancakeLink?: (user: string, platform: Platform, initialSearch?: string) => void;
    onOpenQuickAssign?: (user: string, platform: Platform, commentPhone?: string) => void;
}

const UserGroupRow = memo(function UserGroupRow({
    group: g,
    isExpanded,
    onToggleExpand,
    now,
    busyPrints,
    onPrint,
    onTogglePin,
    onToggleGroupPin,
    onOpenPrice,
    onOpenProfile,
    onOpenPancakeLink,
    onOpenQuickAssign
}: UserGroupRowProps) {
    const store = useStore();
    const pStore = store[g.platform] || store.tiktok;
    const userName = normalizeUser(g.user);
    const isHost = pStore.tags && pStore.tags[userName] === 'HOST';
    const isPinned = g.isPinned;
    const cust = pStore.customers && pStore.customers[userName];
    const userTag = (pStore.tags && pStore.tags[userName]) || 'NORMAL';
    const nickname = pStore.nicknames?.[userName];
    const displayName = nickname ? `${userName} (${nickname})` : `#${getShortId(userName)} ${userName}`;
    const pancakeLink = pStore.pancakeLinks?.[userName];
    const latestC = g.latestComment;
    const latestCount = (pStore.printed && pStore.printed[latestC.id]) || 0;
    const latestContentStr = typeof latestC.content === 'object' ? JSON.stringify(latestC.content) : String(latestC.content || '');
    const detectedPhone = extractPhoneFromText(latestContentStr);
    const extracted = extractPriceFromContent(latestContentStr);
    const flowPrice = pStore.flowPrice;
    const latestClosedPriceStr = getClosedPriceForComment(pStore.customers, userName, latestC.id);

    const containerClass = isPinned 
        ? 'bg-[#2a1b1b] border-l-[6px] border-l-red-600 shadow-md my-1 py-3' 
        : 'bg-[#1c242f] hover:bg-[#202b38]';

    return (
        <div className={`p-3 border-b border-white/10 transition-colors duration-150 ${containerClass}`}>
            <div className="flex gap-2.5 items-start">
                <div className="flex flex-col items-center shrink-0 self-start mt-0.5">
                    <CustomerAvatar 
                        user={userName} 
                        platform={g.platform} 
                        avatarUrl={g.avatar}
                        tag={userTag}
                        size={isPinned ? 'lg' : 'md'}
                        onClick={() => onOpenProfile(userName, g.platform)}
                    />
                </div>

                <div className="flex-1 overflow-hidden min-w-0">
                    <div className="flex items-center flex-wrap gap-y-1">
                        {isHost && (
                            <span className="bg-gradient-to-r from-yellow-500 to-amber-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded mr-1 flex items-center gap-0.5 whitespace-nowrap shadow-sm">
                                👑 HOST
                            </span>
                        )}
                        <b 
                            onClick={() => onOpenProfile(userName, g.platform)}
                            className={`text-gray-100 cursor-pointer hover:underline truncate max-w-[180px] sm:max-w-xs ${isPinned ? 'text-lg' : 'text-base'}`}>
                            {displayName}
                        </b>
                        <CopyButton text={displayName} className="text-xs px-1" />
                        <button 
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleGroupPin(g);
                            }}
                            title={isPinned ? "Bỏ ghim khách này (bỏ ghim tất cả bình luận)" : "Ghim khách này lên đầu"}
                            className={`inline-flex items-center justify-center p-1 text-xs rounded transition-all cursor-pointer mx-0.5 shrink-0 ${
                                isPinned 
                                    ? 'bg-red-500 text-white font-bold shadow-sm' 
                                    : 'bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white'
                            }`}
                        >
                            <span>📌</span>
                        </button>

                        {(() => {
                            if (!pancakeLink) return null;
                            const insight = getCustomerInsight(userName);
                            if (insight) {
                                if (insight.isReturningCustomer) {
                                    return (
                                        <span 
                                            onClick={() => onOpenProfile(userName, g.platform)}
                                            title={`Khách quen trên Pancake POS (${insight.totalOrdersCount} đơn)`}
                                            className="bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[10px] font-bold px-1.5 py-0.5 rounded cursor-pointer mx-0.5 whitespace-nowrap inline-flex items-center gap-0.5"
                                        >
                                            👑 {insight.totalOrdersCount}đơn
                                        </span>
                                    );
                                } else if (insight.latestOrder) {
                                    const st = getOrderStatusLabel(insight.latestOrder.status);
                                    return (
                                        <span 
                                            onClick={() => onOpenProfile(userName, g.platform)}
                                            title={`Khách mới POS - Đơn gần nhất: ${st.text}`}
                                            className="bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold px-1.5 py-0.5 rounded cursor-pointer mx-0.5 whitespace-nowrap inline-flex items-center gap-0.5"
                                        >
                                            🆕 POS
                                        </span>
                                    );
                                }
                            }
                            return null;
                        })()}

                        {cust && cust.count > 0 && (
                            <span className="text-blue-400 text-[13px] font-black mx-1 whitespace-nowrap">
                                ({cust.count} cái - {cust.total}k)
                            </span>
                        )}
                    </div>

                    {/* Latest Comment Content */}
                    <div 
                        onClick={() => onOpenPrice(latestC.id, userName, g.platform, extracted.price || latestClosedPriceStr?.replace(/k/g, '') || (!extracted.price && flowPrice?.price ? flowPrice.price : undefined))}
                        className={`text-red-400 font-bold break-words mt-1 cursor-pointer flex items-center gap-1.5 flex-wrap ${isPinned ? 'text-lg' : 'text-sm'}`}
                    >
                        <span>{latestContentStr}</span>

                        {/* Interactive Dropdown Button Pill on comment line */}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleExpand(g.key);
                            }}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer border shadow-xs active:scale-95 ${
                                isExpanded
                                    ? 'bg-[#00f2ea]/25 text-[#00f2ea] border-[#00f2ea]/60 ring-1 ring-[#00f2ea]/30'
                                    : g.comments.length > 1
                                    ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40'
                                    : 'bg-white/10 hover:bg-white/20 text-gray-300 border-white/15'
                            }`}
                            title={isExpanded ? "Thu gọn danh sách bình luận" : `Sổ xuống xem toàn bộ ${g.comments.length} bình luận của ${userName}`}
                        >
                            <MessageSquare size={11} className={g.comments.length > 1 ? 'text-amber-400' : 'text-gray-400'} />
                            <span>{g.comments.length} cmt</span>
                            {g.comments.length > 1 && (
                                isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} className="animate-bounce" />
                            )}
                        </button>

                        {isHost && extracted.price && (
                            <span className="bg-yellow-500/20 border border-yellow-500/50 text-yellow-300 text-[11px] font-black px-1.5 py-0.5 rounded inline-flex items-center gap-1 shadow-xs">
                                👑 Host ra giá: {extracted.price}k
                            </span>
                        )}
                        {!isHost && extracted.price && (
                            <span className="bg-emerald-500/20 text-emerald-300 text-[11px] font-black px-1.5 py-0.5 rounded border border-emerald-500/40 inline-flex items-center gap-0.5 shadow-xs">
                                🏷️ {extracted.price}k
                            </span>
                        )}
                        {!extracted.price && latestClosedPriceStr && (
                            <span className="bg-emerald-500/25 text-emerald-200 text-[11px] font-black px-1.5 py-0.5 rounded border border-emerald-500/50 inline-flex items-center gap-0.5 shadow-xs" title="Giá đơn đã chốt">
                                🏷️ {latestClosedPriceStr}
                            </span>
                        )}
                        {latestC.time && (
                            <span className="text-[11px] text-gray-500 font-normal">
                                ({latestC.time})
                            </span>
                        )}
                    </div>

                    {/* Quick Phone / Zalo / Pancake Action Chip for Latest */}
                    {detectedPhone && (
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    openPancakeApp(detectedPhone, true);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-950/70 border border-blue-500/40 text-blue-300 hover:text-white text-[11px] font-semibold transition-colors cursor-pointer active:scale-95"
                                title="Mở App Zalo với số điện thoại này trên điện thoại"
                            >
                                <span>💬 Mở Zalo: {detectedPhone}</span>
                            </button>
                            {!pancakeLink && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (onOpenPancakeLink) {
                                            onOpenPancakeLink(userName, g.platform, detectedPhone);
                                        } else {
                                            onOpenQuickAssign?.(userName, g.platform, detectedPhone);
                                        }
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-950/70 border border-orange-500/40 text-orange-300 hover:text-white text-[11px] font-semibold transition-colors cursor-pointer active:scale-95"
                                    title="Gán số điện thoại này vào Pancake của khách"
                                >
                                    <span>🥞 Gán SĐT</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Action Buttons Column */}
                <div className="flex flex-col gap-1.5 shrink-0 ml-1">
                    {pancakeLink ? (
                        <div className="relative flex items-center">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    openPancakeApp(pancakeLink, true);
                                }}
                                title="🥞 Đã nối Zalo/Pancake (Bấm mở chat ngay)"
                                className="w-14 h-7 rounded-md text-[11px] bg-orange-600 hover:bg-orange-500 text-white font-bold flex items-center justify-center gap-0.5 transition-all cursor-pointer shadow-sm active:scale-95"
                            >
                                <span>🥞</span>
                                <span className="truncate">Zalo</span>
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (onOpenPancakeLink) {
                                        onOpenPancakeLink(userName, g.platform, detectedPhone || undefined);
                                    } else {
                                        onOpenQuickAssign?.(userName, g.platform, detectedPhone || undefined);
                                    }
                                }}
                                title="Sửa Link hoặc SĐT Zalo"
                                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#111722] border border-orange-400/60 text-orange-300 hover:text-white flex items-center justify-center text-[9px] shadow cursor-pointer hover:scale-110 transition-transform"
                            >
                                <Edit3 size={9} />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onOpenPancakeLink) {
                                    onOpenPancakeLink(userName, g.platform, detectedPhone || undefined);
                                } else {
                                    onOpenQuickAssign?.(userName, g.platform, detectedPhone || undefined);
                                }
                            }}
                            title="🥞 Gán Zalo / Pancake (Chọn khách đang inbox)"
                            className="w-14 h-7 rounded-md text-[11px] bg-amber-500/20 hover:bg-amber-500/35 border border-amber-500/50 text-amber-300 font-bold flex items-center justify-center gap-0.5 transition-all cursor-pointer active:scale-95 shadow-sm"
                        >
                            <span>🥞+</span>
                            <span className="truncate">Gán</span>
                        </button>
                    )}
                    <button 
                        disabled={!!busyPrints[latestC.id]}
                        onClick={(e) => onPrint(latestC, e)}
                        className={`w-14 h-7 rounded-md text-[13px] font-bold text-white flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer ${
                            busyPrints[latestC.id] ? 'bg-gray-400' : latestCount > 0 ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                        title="In cmt mới nhất"
                    >
                        {latestCount === 0 ? 'IN' : `(${latestCount})`}
                    </button>
                </div>
            </div>

            {/* Expanded Dropdown Nested List of All Customer's Comments */}
            {isExpanded && (
                <div className="mt-3 pt-2.5 border-t border-white/10 space-y-2 pl-2 sm:pl-3 border-l-2 border-l-[#00f2ea]/70 bg-black/30 p-2.5 rounded-xl">
                    <div className="flex items-center justify-between text-xs text-gray-300 font-bold mb-1 px-1">
                        <span className="flex items-center gap-1.5 text-[#00f2ea]">
                            <MessageSquare size={13} />
                            <span>Tất cả {g.comments.length} bình luận của @{userName}:</span>
                        </span>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleExpand(g.key);
                            }}
                            className="text-[11px] text-gray-400 hover:text-white flex items-center gap-1 bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded-md border border-white/10 cursor-pointer transition-colors"
                        >
                            <ChevronUp size={12} /> Thu gọn
                        </button>
                    </div>

                    <div className="space-y-1.5">
                        {g.comments.map((subC, idx) => (
                            <SubCommentRow 
                                key={`${subC.platform}_${subC.id}_${idx}`}
                                comment={subC}
                                index={idx}
                                total={g.comments.length}
                                isBusy={!!busyPrints[subC.id]}
                                now={now}
                                onPrint={onPrint}
                                onTogglePin={onTogglePin}
                                onOpenPrice={onOpenPrice}
                                onOpenPancakeLink={onOpenPancakeLink}
                                onOpenQuickAssign={onOpenQuickAssign}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
});

const CommentRow = memo(function CommentRow({
    comment: c,
    now,
    isBusy,
    onPrint,
    onTogglePin,
    onOpenPrice,
    onOpenProfile,
    onOpenPancakeLink,
    onOpenQuickAssign
}: CommentRowProps) {
    const store = useStore();
    const pStore = store[c.platform] || store.tiktok;
    const count = (pStore.printed && pStore.printed[c.id]) || 0;
    const userName = normalizeUser(c.user);
    const isHost = pStore.tags && pStore.tags[userName] === 'HOST';
    const isPinned = pStore.pinned && pStore.pinned[c.id] && (pStore.pinned[c.id].expiry > now || isHost);
    const cust = pStore.customers && pStore.customers[userName];
    const userTag = (pStore.tags && pStore.tags[userName]) || 'NORMAL';
    const nickname = pStore.nicknames?.[userName];
    const displayName = nickname ? `${userName} (${nickname})` : `#${getShortId(userName)} ${userName}`;
    const contentStr = typeof c.content === 'object' ? JSON.stringify(c.content) : String(c.content || '');
    const detectedPhone = extractPhoneFromText(contentStr);
    const pancakeLink = pStore.pancakeLinks?.[userName];
    const extracted = extractPriceFromContent(contentStr);
    const flowPrice = pStore.flowPrice;
    const closedPriceStr = getClosedPriceForComment(pStore.customers, userName, c.id);

    const containerClass = isPinned 
        ? 'bg-[#2a1b1b] border-l-[6px] border-l-red-600 shadow-md my-1 py-3' 
        : 'bg-[#1c242f] hover:bg-[#202b38]';

    return (
        <div className={`p-3 border-b border-white/10 flex gap-2.5 items-start transition-colors duration-150 ${containerClass}`}>
            <div className="flex flex-col items-center shrink-0 self-start mt-0.5">
                <CustomerAvatar 
                    user={userName} 
                    platform={c.platform} 
                    avatarUrl={c.avatar}
                    tag={userTag}
                    size={isPinned ? 'lg' : 'md'}
                    onClick={() => onOpenProfile(userName, c.platform)}
                />
            </div>
            <div className="flex-1 overflow-hidden min-w-0">
                <div className="flex items-center flex-wrap gap-y-1">
                    {isHost && (
                        <span className="bg-gradient-to-r from-yellow-500 to-amber-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded mr-1 flex items-center gap-0.5 whitespace-nowrap shadow-sm">
                            👑 HOST
                        </span>
                    )}
                    <b 
                        onClick={() => onOpenProfile(userName, c.platform)}
                        className={`text-gray-100 cursor-pointer hover:underline truncate max-w-[200px] sm:max-w-xs ${isPinned ? 'text-lg' : 'text-base'}`}>
                        {displayName}
                    </b>
                    <CopyButton text={displayName} className="text-xs px-1" />
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            onTogglePin(c.platform, c.id, userName);
                        }}
                        title={isPinned ? "Bỏ ghim bình luận này" : "Ghim bình luận này lên đầu"}
                        className={`inline-flex items-center justify-center p-1 text-xs rounded transition-all cursor-pointer mx-0.5 shrink-0 ${
                            isPinned 
                                
                                ? 'bg-red-500 text-white font-bold shadow-sm' 
                                : 'bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white'
                        }`}
                    >
                        <span>📌</span>
                    </button>
                    {(() => {
                        if (!pancakeLink) return null;
                        const insight = getCustomerInsight(userName);
                        if (insight) {
                            if (insight.isReturningCustomer) {
                                return (
                                    <span 
                                        onClick={() => onOpenProfile(userName, c.platform)}
                                        title={`Khách quen trên Pancake POS (${insight.totalOrdersCount} đơn)`}
                                        className="bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[10px] font-bold px-1.5 py-0.5 rounded cursor-pointer mx-0.5 whitespace-nowrap inline-flex items-center gap-0.5"
                                    >
                                        👑 {insight.totalOrdersCount}đơn
                                    </span>
                                );
                            } else if (insight.latestOrder) {
                                const st = getOrderStatusLabel(insight.latestOrder.status);
                                return (
                                    <span 
                                        onClick={() => onOpenProfile(userName, c.platform)}
                                        title={`Khách mới POS - Đơn gần nhất: ${st.text}`}
                                        className="bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold px-1.5 py-0.5 rounded cursor-pointer mx-0.5 whitespace-nowrap inline-flex items-center gap-0.5"
                                    >
                                        🆕 POS
                                    </span>
                                );
                            }
                        }
                        return null;
                    })()}
                    {cust && cust.count > 0 && (
                        <span className="text-blue-400 text-[13px] font-black mx-1 whitespace-nowrap">
                            ({cust.count} cái - {cust.total}k)
                        </span>
                    )}
                </div>
                <div 
                    onClick={() => onOpenPrice(c.id, userName, c.platform, extracted.price || closedPriceStr?.replace(/k/g, '') || (!extracted.price && flowPrice?.price ? flowPrice.price : undefined))}
                    className={`text-red-400 font-bold break-words mt-1 cursor-pointer flex items-center gap-2 flex-wrap ${isPinned ? 'text-lg' : 'text-sm'}`}
                >
                    <span>{contentStr}</span>
                    {isHost && extracted.price && (
                        <span className="bg-yellow-500/20 border border-yellow-500/50 text-yellow-300 text-[11px] font-black px-1.5 py-0.5 rounded inline-flex items-center gap-1 shadow-xs">
                            👑 Host ra giá: {extracted.price}k
                        </span>
                    )}
                    {!isHost && extracted.price && (
                        <span className="bg-emerald-500/20 text-emerald-300 text-[11px] font-black px-1.5 py-0.5 rounded border border-emerald-500/40 inline-flex items-center gap-0.5 shadow-xs">
                            🏷️ {extracted.price}k
                        </span>
                    )}
                    {!extracted.price && closedPriceStr && (
                        <span className="bg-emerald-500/25 text-emerald-200 text-[11px] font-black px-1.5 py-0.5 rounded border border-emerald-500/50 inline-flex items-center gap-0.5 shadow-xs" title="Giá đơn đã chốt">
                            🏷️ {closedPriceStr}
                        </span>
                    )}
                </div>

                {/* Quick Phone / Zalo / Pancake Action Chip */}
                {detectedPhone && (
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                openPancakeApp(detectedPhone, true);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-950/70 border border-blue-500/40 text-blue-300 hover:text-white text-[11px] font-semibold transition-colors cursor-pointer active:scale-95"
                            title="Mở App Zalo với số điện thoại này trên điện thoại"
                        >
                            <span>💬 Mở Zalo: {detectedPhone}</span>
                        </button>
                        {!pancakeLink && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (onOpenPancakeLink) {
                                        onOpenPancakeLink(userName, c.platform, detectedPhone);
                                    } else {
                                        onOpenQuickAssign?.(userName, c.platform, detectedPhone);
                                    }
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-950/70 border border-orange-500/40 text-orange-300 hover:text-white text-[11px] font-semibold transition-colors cursor-pointer active:scale-95"
                                title="Gán số điện thoại này vào Pancake của khách"
                            >
                                <span>🥞 Gán SĐT</span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-1.5 shrink-0 ml-1">
                {pancakeLink ? (
                    <div className="relative flex items-center">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                openPancakeApp(pancakeLink, true);
                            }}
                            title="🥞 Đã nối Zalo/Pancake (Bấm mở chat ngay)"
                            className="w-14 h-7 rounded-md text-[11px] bg-orange-600 hover:bg-orange-500 text-white font-bold flex items-center justify-center gap-0.5 transition-all cursor-pointer shadow-sm active:scale-95"
                        >
                            <span>🥞</span>
                            <span className="truncate">Zalo</span>
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onOpenPancakeLink) {
                                    onOpenPancakeLink(userName, c.platform, detectedPhone || undefined);
                                } else {
                                    onOpenQuickAssign?.(userName, c.platform, detectedPhone || undefined);
                                }
                            }}
                            title="Sửa Link hoặc SĐT Zalo"
                            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#111722] border border-orange-400/60 text-orange-300 hover:text-white flex items-center justify-center text-[9px] shadow cursor-pointer hover:scale-110 transition-transform"
                        >
                            <Edit3 size={9} />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onOpenPancakeLink) {
                                onOpenPancakeLink(userName, c.platform, detectedPhone || undefined);
                            } else {
                                onOpenQuickAssign?.(userName, c.platform, detectedPhone || undefined);
                            }
                        }}
                        title="🥞 Gán Zalo / Pancake (Chọn khách đang inbox)"
                        className="w-14 h-7 rounded-md text-[11px] bg-amber-500/20 hover:bg-amber-500/35 border border-amber-500/50 text-amber-300 font-bold flex items-center justify-center gap-0.5 transition-all cursor-pointer active:scale-95 shadow-sm"
                    >
                        <span>🥞+</span>
                        <span className="truncate">Gán</span>
                    </button>
                )}
                <button 
                    disabled={isBusy}
                    onClick={(e) => onPrint(c, e)}
                    className={`w-14 h-7 rounded-md text-[13px] font-bold text-white flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer ${isBusy ? 'bg-gray-400' : count > 0 ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                    {count === 0 ? 'IN' : `(${count})`}
                </button>
            </div>
        </div>
    );
});

export const Feed = memo(function Feed({ 
    searchKeyword, 
    hostMode,
    onOpenPrice, 
    onOpenProfile,
    onOpenPancakeLink,
    onScroll
}: FeedProps) {
    const store = useStore();
    const parentRef = useRef<HTMLDivElement>(null);
    const [busyPrints, setBusyPrints] = useState<Record<string, boolean>>({});
    const [now, setNow] = useState(Date.now());
    const [showAllTags, setShowAllTags] = useState(false);
    
    // Group By User Mode State (Persisted in localStorage)
    const [groupByUser, setGroupByUser] = useState<boolean>(() => {
        try {
            return localStorage.getItem('slp_feed_group_by_user') === 'true';
        } catch {
            return false;
        }
    });



    // Expanded groups state (keyed by `${platform}_${username}`)
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    const [quickAssignTarget, setQuickAssignTarget] = useState<{
        user: string;
        platform: Platform;
        commentPhone?: string;
    } | null>(null);
    const lastScrollYRef = useRef(0);

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const currentY = e.currentTarget.scrollTop;
        if (onScroll) {
            if (currentY > lastScrollYRef.current + 5 && currentY > 20) {
                onScroll(true); // Lướt xuống
            } else if (currentY < lastScrollYRef.current - 5) {
                onScroll(false); // Lướt lên
            }
        }
        lastScrollYRef.current = currentY;
    }, [onScroll]);

    useEffect(() => {
        setShowAllTags(false);
    }, [searchKeyword]);

    const handleSetGroupBy = useCallback((val: boolean) => {
        setGroupByUser(val);
        try {
            localStorage.setItem('slp_feed_group_by_user', String(val));
        } catch {}
    }, []);

    const toggleExpandGroup = useCallback((groupKey: string) => {
        setExpandedGroups(prev => ({
            ...prev,
            [groupKey]: !prev[groupKey]
        }));
    }, []);

    const keyword = searchKeyword.trim().toLowerCase();
    const isTagSearch = keyword.startsWith('/');

    // Handle Tag Search View (/top10, /coc, /vip, etc.)
    const tagCustomers = useMemo(() => {
        if (!isTagSearch) return [];
        let list: { user: string; platform: Platform; c: any; tag: string }[] = [];
        (['tiktok', 'facebook', 'shopee'] as Platform[]).forEach(p => {
            const pStore = store[p] || store.tiktok;
            const custs = pStore.customers || {};
            const tags = pStore.tags || {};
            Object.keys(custs).forEach(user => {
                const tag = tags[user];
                let match = false;
                if ((keyword === '/coc' || keyword === '/coc50') && tag === 'COC') match = true;
                else if ((keyword === '/coc' || keyword === '/coc100') && tag === 'COC_100') match = true;
                else if ((keyword === '/quen' || keyword === '/vip') && tag === 'VIP') match = true;
                else if (keyword === '/dao' && tag === 'DAO') match = true;
                else if (keyword === '/chan' && tag === 'CHAN') match = true;
                else if (keyword === '/bom' && tag === 'BOM') match = true;
                else if (keyword.startsWith('/top')) {
                    if (custs[user] && custs[user].count > 0) match = true;
                }
                if (match) {
                    list.push({ user, platform: p, c: custs[user], tag });
                }
            });
        });

        if (keyword.startsWith('/top')) {
            const numMatch = keyword.match(/\d+/);
            const num = numMatch ? parseInt(numMatch[0]) : 10;
            list.sort((a, b) => (b.c.lastTime || 0) - (a.c.lastTime || 0));
            list = list.slice(0, num);
        } else {
            list.sort((a, b) => (b.c.lastTime || 0) - (a.c.lastTime || 0));
        }
        return list;
    }, [isTagSearch, keyword, store.tiktok.customers, store.facebook.customers, store.shopee.customers, store.tiktok.tags, store.facebook.tags, store.shopee.tags]);

    // Build regular comments feed
    const displayList = useMemo(() => {
        if (isTagSearch) return [];

        let items: CommentData[] = [];
        const seenCommentKeys = new Set<string>();
        const globalClearedAt = getGlobalFeedClearedAt();

        (['tiktok', 'facebook', 'shopee'] as Platform[]).forEach(p => {
            const pStore = store[p] || store.tiktok;
            const effectiveClearedAt = Math.max(globalClearedAt, getFeedClearedAt(p));
            let platformComments = (pStore.comments || []).filter(c => {
                if (!c) return false;
                const cTs = Number(c.ts) || 0;
                if (effectiveClearedAt > 0) {
                    if (!cTs || cTs <= effectiveClearedAt) return false;
                }
                return true;
            });
            const tags = pStore.tags || {};

            if (hostMode) {
                platformComments = platformComments.filter(c => c && c.user && tags[normalizeUser(c.user)] === 'HOST');
            }

            platformComments.forEach(c => {
                if (!c) return;
                const safePlatform: Platform = (c.platform === 'facebook' || c.platform === 'shopee') ? c.platform : p;
                const cleanUser = normalizeUser(c.user);
                const contentStr = typeof c.content === 'object' ? JSON.stringify(c.content) : String(c.content || '').trim();
                const cTs = Number(c.ts) || 0;
                const idStr = c.id ? String(c.id) : '';

                // Chống trùng lặp tuyệt đối: kiểm tra ID hoặc cùng Người dùng + cùng Nội dung trong 25 giây
                const isDuplicate = items.some(existing => {
                    if (idStr && existing.id && idStr === String(existing.id)) return true;
                    const exUser = normalizeUser(existing.user);
                    const exContent = typeof existing.content === 'object' ? JSON.stringify(existing.content) : String(existing.content || '').trim();
                    if (exUser.toLowerCase() === cleanUser.toLowerCase() && 
                        exContent.toLowerCase() === contentStr.toLowerCase()) {
                        const exTs = Number(existing.ts) || 0;
                        if (Math.abs(cTs - exTs) <= 25000) {
                            return true;
                        }
                    }
                    return false;
                });

                if (!isDuplicate) {
                    items.push({
                        ...c,
                        id: idStr || `c_${cleanUser}_${contentStr.slice(0, 20)}_${cTs}`,
                        user: cleanUser,
                        content: contentStr,
                        platform: safePlatform,
                        ts: cTs
                    });
                }
            });
        });

        // Filter out blocked users
        items = items.filter(c => {
            const pStore = store[c.platform] || store.tiktok;
            const tags = pStore.tags || {};
            return tags[normalizeUser(c.user)] !== 'CHAN';
        });

        // Sort by timestamp descending (newest first)
        items.sort((a, b) => (b.ts || 0) - (a.ts || 0));

        // Keyword filter
        if (keyword) {
            const isIdQuery = keyword.startsWith('#') || /^\d+$/.test(keyword);
            const targetId = keyword.startsWith('#') ? keyword.slice(1) : keyword;

            items = items.filter(c => {
                const pStore = store[c.platform] || store.tiktok;
                const cleanUser = normalizeUser(c.user);
                const nick = pStore.nicknames?.[cleanUser] || '';
                const shortId = getShortId(cleanUser).toLowerCase();
                const contentStr = typeof c.content === 'object' ? JSON.stringify(c.content) : String(c.content || '');

                if (isIdQuery) {
                    return shortId === targetId || ('#' + shortId) === keyword;
                }

                return cleanUser.toLowerCase().includes(keyword) || 
                       contentStr.toLowerCase().includes(keyword) || 
                       nick.toLowerCase().includes(keyword);
            });
        }

        // Separate pinned and normal comments
        const pinned: CommentData[] = [];
        const normal: CommentData[] = [];

        items.forEach(c => {
            const pStore = store[c.platform] || store.tiktok;
            const pState = pStore.pinned?.[c.id];
            if (pState && (pState.expiry > now || (pStore.tags && pStore.tags[normalizeUser(c.user)] === 'HOST'))) {
                pinned.push(c);
            } else {
                normal.push(c);
            }
        });

        return [...pinned, ...normal];
    }, [isTagSearch, keyword, hostMode, now, store.tiktok.comments, store.facebook.comments, store.shopee.comments, store.tiktok.pinned, store.facebook.pinned, store.shopee.pinned, store.tiktok.tags, store.facebook.tags, store.shopee.tags, store.tiktok.nicknames, store.facebook.nicknames, store.shopee.nicknames]);

    // Build user-grouped comment list when in Group By User Mode
    const userGroupList = useMemo<UserCommentGroup[]>(() => {
        if (!groupByUser || isTagSearch) return [];

        const groupMap = new Map<string, UserCommentGroup>();

        displayList.forEach(c => {
            const cleanUser = normalizeUser(c.user);
            const safePlatform = c.platform;
            const groupKey = `${safePlatform}_${cleanUser.toLowerCase()}`;
            const cTs = Number(c.ts) || 0;

            let g = groupMap.get(groupKey);
            if (!g) {
                g = {
                    key: groupKey,
                    user: cleanUser,
                    platform: safePlatform,
                    avatar: c.avatar,
                    latestComment: c,
                    latestTs: cTs,
                    comments: [c],
                    isPinned: false
                };
                groupMap.set(groupKey, g);
            } else {
                g.comments.push(c);
                if (cTs > g.latestTs) {
                    g.latestTs = cTs;
                    g.latestComment = c;
                }
                if (!g.avatar && c.avatar) {
                    g.avatar = c.avatar;
                }
            }
        });

        const groups = Array.from(groupMap.values());

        // Sort comments inside each group by timestamp descending
        groups.forEach(g => {
            g.comments.sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0));
            g.latestComment = g.comments[0];
            g.latestTs = Number(g.latestComment?.ts) || g.latestTs;

            const pStore = store[g.platform] || store.tiktok;
            const isHost = pStore.tags && pStore.tags[g.user] === 'HOST';
            const hasPinned = g.comments.some(c => {
                const pState = pStore.pinned?.[c.id];
                return pState && (pState.expiry > now || isHost);
            });
            g.isPinned = Boolean(hasPinned);
        });

        const pinnedGroups: UserCommentGroup[] = [];
        const normalGroups: UserCommentGroup[] = [];

        groups.forEach(g => {
            if (g.isPinned) pinnedGroups.push(g);
            else normalGroups.push(g);
        });

        // Sort groups by latestTs descending so when any user comments, they jump to top!
        pinnedGroups.sort((a, b) => b.latestTs - a.latestTs);
        normalGroups.sort((a, b) => b.latestTs - a.latestTs);

        return [...pinnedGroups, ...normalGroups];
    }, [groupByUser, isTagSearch, displayList, store, now]);

    const isAllExpanded = useMemo(() => {
        if (userGroupList.length === 0) return false;
        return userGroupList.every(g => expandedGroups[g.key]);
    }, [userGroupList, expandedGroups]);

    const handleToggleExpandAll = useCallback(() => {
        if (isAllExpanded) {
            setExpandedGroups({});
        } else {
            const next: Record<string, boolean> = {};
            userGroupList.forEach(g => {
                next[g.key] = true;
            });
            setExpandedGroups(next);
        }
    }, [isAllExpanded, userGroupList]);

    const activeItemCount = groupByUser ? userGroupList.length : displayList.length;

    // Virtualizer setup for comments list
    const rowVirtualizer = useVirtualizer({
        count: activeItemCount,
        getScrollElement: () => parentRef.current,
        estimateSize: () => (groupByUser ? 95 : 78),
        overscan: 8,
        getItemKey: (index) => {
            if (groupByUser) {
                const g = userGroupList[index];
                return g ? g.key : index;
            }
            const item = displayList[index];
            return item ? `${item.platform}_${item.id}` : index;
        }
    });

    const handlePrint = useCallback((c: CommentData, e?: React.MouseEvent) => {
        if (busyPrints[c.id]) return;
        setBusyPrints(prev => ({ ...prev, [c.id]: true }));
        
        const userName = normalizeUser(c.user);
        const contentStr = typeof c.content === 'object' ? JSON.stringify(c.content) : String(c.content || '');
        let extracted = extractPriceFromContent(contentStr);
        if (extracted.price) {
            store.printNewOrder(c.platform, userName, extracted.content, extracted.price, c.time, c.id);
            if (e) {
                window.dispatchEvent(new CustomEvent('FLYING_PLUS_ONE', { detail: { x: e.clientX, y: e.clientY, platform: c.platform } }));
            }
            setTimeout(() => {
                setBusyPrints(prev => {
                    const next = {...prev}; delete next[c.id]; return next;
                });
            }, 600);
        } else {
            // TÍNH NĂNG FLOW GIÁ: Gợi ý nhanh giá từ nick HOST gắn vương miện khi bấm IN
            const pStore = store[c.platform] || store.tiktok;
            const flowPriceObj = pStore.flowPrice;
            const suggestedPrice = flowPriceObj?.price;
            onOpenPrice(c.id, userName, c.platform, suggestedPrice);
            setBusyPrints(prev => {
                const next = {...prev}; delete next[c.id]; return next;
            });
        }
    }, [busyPrints, onOpenPrice, store]);

    const handleTogglePin = useCallback((platform: Platform, id: string, user: string) => {
        store.togglePin(platform, id, user);
    }, [store]);

    const handleToggleGroupPin = useCallback((g: UserCommentGroup) => {
        const userName = normalizeUser(g.user);
        const pStore = store[g.platform] || store.tiktok;
        const isHost = pStore.tags && pStore.tags[userName] === 'HOST';
        
        // Kiểm tra xem nhóm này hiện có bất kỳ bình luận nào đang được ghim không
        const pinnedCommentIds = g.comments.filter(c => {
            const pState = pStore.pinned?.[c.id];
            return pState && (pState.expiry > now || isHost);
        }).map(c => c.id);

        if (g.isPinned || pinnedCommentIds.length > 0) {
            // BỎ GHIM: Xoá tất cả bình luận được ghim của khách này
            store.unpinAllUserComments(g.platform, userName);
            g.comments.forEach(c => {
                store.unpinComment(g.platform, c.id);
            });
        } else {
            // GHIM: Ghim bình luận mới nhất của khách này
            const targetComment = g.latestComment || g.comments[0];
            if (targetComment) {
                store.togglePin(g.platform, targetComment.id, userName);
            }
        }
    }, [now, store]);

    const activeHostFlow = store.tiktok.flowPrice || store.facebook.flowPrice || store.shopee.flowPrice;
    const activeHostFlowPlatform: Platform = store.tiktok.flowPrice ? 'tiktok' : store.facebook.flowPrice ? 'facebook' : 'shopee';

    if (isTagSearch) {
        let headerText = `Danh sách khách hàng lọc theo "${keyword}"`;
        if (keyword === '/coc') headerText = 'Khách cọc gần đây';
        if (keyword === '/quen' || keyword === '/vip') headerText = 'Khách quen chốt gần nhất';
        if (keyword.startsWith('/top')) {
            const numMatch = keyword.match(/\d+/);
            const num = numMatch ? parseInt(numMatch[0]) : 10;
            headerText = `Top ${num} khách chốt gần nhất`;
        }

        return (
            <div ref={parentRef} className="flex-1 overflow-y-auto bg-[#0e1621] p-3 space-y-2">
                <div className="text-sm font-bold text-gray-300 pb-2 border-b border-white/10 flex items-center justify-between">
                    <span>{headerText} ({tagCustomers.length})</span>
                </div>
                {tagCustomers.length === 0 ? (
                    <div className="text-center text-gray-500 py-10">Không tìm thấy khách hàng nào phù hợp</div>
                ) : (
                    <>
                        {(showAllTags ? tagCustomers : tagCustomers.slice(0, 10)).map((item, idx) => {
                            const pStore = store[item.platform] || store.tiktok;
                            const nickname = pStore.nicknames?.[item.user];
                            const displayName = nickname ? `${item.user} (${nickname})` : `#${getShortId(item.user)} ${item.user}`;
                            const commentWithAvatar = pStore.comments?.find(c => normalizeUser(c.user) === item.user && c.avatar);
                            const avatarUrl = commentWithAvatar?.avatar;
                            const pLink = pStore.pancakeLinks?.[item.user];

                            return (
                                <div key={idx} className="bg-[#1c242f] p-3 rounded-xl border border-white/5 flex items-center justify-between gap-2 shadow-sm">
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <CustomerAvatar 
                                            user={item.user} 
                                            platform={item.platform} 
                                            avatarUrl={avatarUrl}
                                            tag={item.tag}
                                            size="md"
                                            onClick={() => onOpenProfile(item.user, item.platform)}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <b onClick={() => onOpenProfile(item.user, item.platform)} className="text-gray-100 text-sm hover:underline cursor-pointer truncate">
                                                    {displayName}
                                                </b>
                                                <CopyButton text={displayName} className="text-xs px-1" />
                                            </div>
                                            <div className="text-xs text-blue-400 font-bold mt-0.5">
                                                {item.c.count || 0} cái - {item.c.total || 0}k
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {pLink && (
                                            <button 
                                                onClick={() => openPancakeApp(pLink, true)}
                                                className="bg-orange-600 hover:bg-orange-500 text-white p-2 rounded-lg text-xs font-bold transition-all shadow cursor-pointer active:scale-95 flex items-center gap-1"
                                                title="Mở Zalo/Pancake"
                                            >
                                                <span>🥞</span>
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => onOpenPrice(null, item.user, item.platform)}
                                            className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow cursor-pointer flex items-center gap-1 active:scale-95"
                                        >
                                            <PlusCircle size={14} /> Chốt
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        {!showAllTags && tagCustomers.length > 10 && (
                            <button 
                                onClick={() => setShowAllTags(true)}
                                className="w-full py-2.5 bg-[#1c242f] hover:bg-[#253243] text-blue-400 text-xs font-bold rounded-xl border border-white/5 transition-all text-center mt-2 cursor-pointer"
                            >
                                Xem thêm {tagCustomers.length - 10} khách hàng khác...
                            </button>
                        )}
                    </>
                )}
            </div>
        );
    }

    if (displayList.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400 py-16 px-4 bg-[#0e1621]">
                <div className="text-3xl mb-2">💬</div>
                <div className="text-sm font-medium">Đang đợi dữ liệu bình luận từ Live...</div>
                <div className="text-xs text-gray-500 mt-1">Bình luận mới từ TikTok sẽ tự động hiển thị tại đây</div>
            </div>
        );
    }

    return (
        <div 
            ref={parentRef} 
            className="flex-1 overflow-y-auto bg-[#0e1621] will-change-scroll relative" 
            onScroll={handleScroll}
        >
            {/* Mode Switcher & Display Filter Toolbar */}
            <div className="sticky top-0 z-20 bg-[#131d28]/95 backdrop-blur-md border-b border-white/10 px-3 py-2 flex items-center justify-between gap-2 shadow-sm">
                <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider hidden sm:inline">
                        Hiển thị:
                    </span>
                    <div className="flex items-center bg-black/40 p-0.5 rounded-lg border border-white/10">
                        <button
                            type="button"
                            onClick={() => handleSetGroupBy(false)}
                            className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                !groupByUser 
                                    ? 'bg-blue-600 text-white shadow-sm' 
                                    : 'text-gray-400 hover:text-white'
                            }`}
                            title="Hiển thị từng bình luận theo thời gian thực (Mặc định)"
                        >
                            <List size={13} />
                            <span>Mặc định</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSetGroupBy(true)}
                            className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                groupByUser 
                                    ? 'bg-[#00f2ea] text-black shadow-sm font-extrabold' 
                                    : 'text-gray-400 hover:text-white'
                            }`}
                            title="Gộp các bình luận của cùng một khách hàng lại với nhau"
                        >
                            <Users size={13} />
                            <span>Gộp theo khách</span>
                            {groupByUser && userGroupList.length > 0 && (
                                <span className="bg-black/20 text-black px-1.5 py-0.2 rounded-full text-[10px] font-black ml-0.5">
                                    {userGroupList.length}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {groupByUser ? (
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] text-gray-400 hidden sm:inline">
                            {userGroupList.length} khách ({displayList.length} cmt)
                        </span>
                        {userGroupList.length > 0 && (
                            <button
                                type="button"
                                onClick={handleToggleExpandAll}
                                className="text-[11px] font-semibold text-cyan-300 hover:text-white bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/30 px-2 py-1 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                                title={isAllExpanded ? "Thu gọn tất cả" : "Mở rộng tất cả"}
                            >
                                {isAllExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                <span>{isAllExpanded ? 'Thu gọn hết' : 'Mở rộng hết'}</span>
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="text-[11px] text-gray-400 font-medium">
                        💬 {displayList.length} bình luận
                    </div>
                )}
            </div>

            {activeHostFlow && (
                <div className="sticky top-[41px] z-10 bg-gradient-to-r from-amber-950/90 via-yellow-950/80 to-[#1c242f] border-b border-yellow-500/30 px-3 py-1.5 flex items-center justify-between gap-2 text-xs shadow-md backdrop-blur-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-yellow-400 font-black text-sm">👑</span>
                        <span className="text-yellow-300 font-bold whitespace-nowrap">Gợi ý giá từ Host:</span>
                        <span className="bg-yellow-500 text-black font-mono font-black px-1.5 py-0.5 rounded text-[12px] shadow-sm">
                            {activeHostFlow.price}k
                        </span>
                        <span className="text-gray-300 truncate hidden sm:inline text-[11px]">
                            (@{activeHostFlow.hostUser}: "{activeHostFlow.content}")
                        </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            onClick={() => store.clearFlowPrice(activeHostFlowPlatform)}
                            title="Tắt flow giá host hiện tại"
                            className="text-gray-300 hover:text-white px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[11px] font-semibold cursor-pointer transition-colors"
                        >
                            ✕ Tắt
                        </button>
                    </div>
                </div>
            )}

            <div
                    style={{
                        height: `${rowVirtualizer.getTotalSize()}px`,
                        width: '100%',
                        position: 'relative'
                    }}
                >
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        if (groupByUser) {
                            const g = userGroupList[virtualRow.index];
                            if (!g) return null;
                            return (
                                <div
                                    key={virtualRow.key}
                                    ref={rowVirtualizer.measureElement}
                                    data-index={virtualRow.index}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        transform: `translateY(${virtualRow.start}px)`
                                    }}
                                >
                                    <UserGroupRow 
                                        group={g}
                                        isExpanded={!!expandedGroups[g.key]}
                                        onToggleExpand={toggleExpandGroup}
                                        now={now}
                                        busyPrints={busyPrints}
                                        onPrint={handlePrint}
                                        onTogglePin={handleTogglePin}
                                        onToggleGroupPin={handleToggleGroupPin}
                                        onOpenPrice={onOpenPrice}
                                        onOpenProfile={onOpenProfile}
                                        onOpenPancakeLink={onOpenPancakeLink}
                                        onOpenQuickAssign={(u, p, phone) => {
                                            if (onOpenPancakeLink) {
                                                onOpenPancakeLink(u, p, phone);
                                            } else {
                                                setQuickAssignTarget({ user: u, platform: p, commentPhone: phone });
                                            }
                                        }}
                                    />
                                </div>
                            );
                        }

                        const c = displayList[virtualRow.index];
                        if (!c) return null;
                        return (
                            <div
                                key={virtualRow.key}
                                ref={rowVirtualizer.measureElement}
                                data-index={virtualRow.index}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    transform: `translateY(${virtualRow.start}px)`
                                }}
                            >
                                <CommentRow 
                                    comment={c}
                                    now={now}
                                    isBusy={!!busyPrints[c.id]}
                                    onPrint={handlePrint}
                                    onTogglePin={handleTogglePin}
                                    onOpenPrice={onOpenPrice}
                                    onOpenProfile={onOpenProfile}
                                    onOpenPancakeLink={onOpenPancakeLink}
                                    onOpenQuickAssign={(u, p, phone) => {
                                        if (onOpenPancakeLink) {
                                            onOpenPancakeLink(u, p, phone);
                                        } else {
                                            setQuickAssignTarget({ user: u, platform: p, commentPhone: phone });
                                        }
                                    }}
                                />
                            </div>
                        );
                    })}
                </div>{quickAssignTarget && (
                <QuickAssignModal
                    isOpen={!!quickAssignTarget}
                    user={quickAssignTarget.user}
                    platform={quickAssignTarget.platform}
                    commentPhone={quickAssignTarget.commentPhone}
                    onClose={() => setQuickAssignTarget(null)}
                    onOpenFullModal={() => {
                        const target = quickAssignTarget;
                        setQuickAssignTarget(null);
                        onOpenPancakeLink?.(target.user, target.platform);
                    }}
                />
            )}
        </div>
    );
});
