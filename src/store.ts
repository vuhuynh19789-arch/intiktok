import { create } from 'zustand';
import { fbGet, fbPut, DEVICE_ID, PLATFORMS, Platform, printLabel, firebaseDb, getShortId, normalizeUser, extractPriceFromContent, addRecentClosedPrice } from './lib/core';
import { ref, onValue } from 'firebase/database';

export interface OrderItem {
  id: string;
  content: string;
  price: number;
  unitPrice?: number;
  quantity?: number;
  sourceCommentId: string | null;
  createdAt?: number;
  shipped?: boolean;
}

export interface CustomerData {
  count: number;
  total: number;
  lastTime: number;
  items: OrderItem[];
  pastItems?: OrderItem[];
}

export interface CommentData {
  id: string;
  user: string;
  content: string;
  time: string;
  avatar?: string;
  ts?: number;
  platform: Platform;
}

export interface PinnedData {
  user: string;
  expiry: number;
}

export interface FlowPriceData {
  price: string;
  hostUser: string;
  content: string;
  ts: number;
}

export type TagType = 'NORMAL' | 'VIP' | 'DAO' | 'BOM' | 'COC' | 'COC_100' | 'CHAN' | 'HOST' | 'GIU';

export interface PlatformState {
  comments: CommentData[];
  customers: Record<string, CustomerData>;
  printed: Record<string, number>;
  pinned: Record<string, PinnedData>;
  tags: Record<string, TagType>;
  nicknames: Record<string, string>;
  pancakeLinks: Record<string, string>;
  flowPrice?: FlowPriceData | null;
  lastCommentsAt: number;
  lastCustomersAt: number;
  lastPrintedAt: number;
  lastPinnedAt: number;
  lastTagsAt: number;
  lastNicknamesAt: number;
  lastPancakeLinksAt: number;
  lastFlowPriceAt?: number;
}

export interface SessionHistoryEntry {
  id: string;
  date: string;
  totalRevenue: number;
  totalOrders: number;
  newCustomers: number;
  returningCustomers: number;
}

export interface AppState {
  tiktok: PlatformState;
  facebook: PlatformState;
  shopee: PlatformState;
  syncStatus: { text: string, color: string };
  isPolling: boolean;
  isPrintServer: boolean;
  history: SessionHistoryEntry[];
  
  setSyncStatus: (text: string, color: string) => void;
  initPolling: () => void;
  togglePrintServer: () => void;
  subscribePlatformData: (platform: Platform) => void;
  
  sweepExpiredPins: () => void;

  togglePin: (platform: Platform, commentId: string, user: string) => void;
  repostComment: (platform: Platform, content: string) => Promise<boolean>;
  refreshPlatform: (platform: Platform) => Promise<boolean>;
  unpinComment: (platform: Platform, commentId: string) => void;
  unpinAllUserComments: (platform: Platform, user: string) => void;
  markPrinted: (platform: Platform, commentId: string | null) => void;
  unmarkPrinted: (platform: Platform, commentId: string | null) => void;
  setCustomerTag: (platform: Platform, user: string, tag: TagType) => void;
  setCustomerNickname: (platform: Platform, user: string, nickname: string) => void;
  setCustomerPancakeLink: (platform: Platform, user: string, link: string) => void;
  setFlowPrice: (platform: Platform, price: string, hostUser?: string, content?: string) => void;
  clearFlowPrice: (platform: Platform) => void;
  
  recordOrder: (platform: Platform, user: string, price: number | string, content: string, sourceCommentId: string | null) => void;
  addCustomOrderItem: (platform: Platform, user: string, itemData: { content?: string, unitPrice: number, quantity: number, price?: number, sourceCommentId?: string | null, printNow?: boolean }) => void;
  addMultipleCustomOrderItems: (platform: Platform, user: string, items: Array<{ content?: string, unitPrice: number, quantity: number, price?: number, sourceCommentId?: string | null }>, printNow?: boolean) => void;
  initCustomer: (platform: Platform, user: string) => void;
  updateCustomerStats: (platform: Platform, user: string, newCount: number, newTotal: number) => void;
  printNewOrder: (platform: Platform, user: string, content: string, price: number | string, time: string, sourceCommentId: string | null, bypassDebounce?: boolean, skipPrint?: boolean) => void;
  deleteOrderItem: (platform: Platform, user: string, itemIndex: number, isPast?: boolean) => void;
  toggleCurrentItemShipped: (platform: Platform, user: string, itemIndex: number, forceState?: boolean) => void;
  markCurrentItemsShipped: (platform: Platform, user: string, itemIndices?: number[], shippedState?: boolean) => void;
  archiveShippedCurrentItems: (platform: Platform, user: string) => void;
  togglePastItemShipped: (platform: Platform, user: string, itemIndex: number) => void;
  markAllCustomerItemsShipped: (platform: Platform, user: string, archiveToPast?: boolean) => void;
  mergePastItems: (platform: Platform, user: string, itemIndices: number[]) => void;
  deletePastItems: (platform: Platform, user: string, itemIndices: number[]) => void;
  archiveCustomerItems: (platform: Platform, user: string) => void;
  clearShippedPastItems: (platform: Platform, user: string) => void;
  resetSession: () => void;
  clearFeed: (platform?: Platform) => void;
  addComment: (platform?: Platform, comment?: CommentData) => void;
}

export const getTodayDateKey = (): string => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

export const getFeedClearedAt = (platform: Platform): number => {
    try {
        const pVal = Number(localStorage.getItem(`slp_feed_cleared_at_${platform}`)) || 0;
        const gVal = Number(localStorage.getItem('slp_feed_cleared_at_global')) || 0;
        return Math.max(pVal, gVal);
    } catch {
        return 0;
    }
};

export const getGlobalFeedClearedAt = (): number => {
    try {
        return Number(localStorage.getItem('slp_feed_cleared_at_global')) || 0;
    } catch {
        return 0;
    }
};

export const setFeedClearedAt = (platform: Platform, ts: number) => {
    try {
        localStorage.setItem(`slp_feed_cleared_at_${platform}`, String(ts));
    } catch {}
};

export const setGlobalFeedClearedAt = (ts: number) => {
    try {
        localStorage.setItem('slp_feed_cleared_at_global', String(ts));
        (['tiktok', 'facebook', 'shopee'] as Platform[]).forEach(p => {
            localStorage.setItem(`slp_feed_cleared_at_${p}`, String(ts));
        });
    } catch {}
};

export const isCommentFromToday = (ts: number): boolean => {
    if (!ts) return false;
    const cDate = new Date(ts);
    const now = new Date();
    return cDate.getFullYear() === now.getFullYear() &&
           cDate.getMonth() === now.getMonth() &&
           cDate.getDate() === now.getDate();
};

const loadLocal = (key: string, def: any = {}) => {
    try {
        return JSON.parse(localStorage.getItem(key) || JSON.stringify(def));
    } catch {
        return def;
    }
};

export function deduplicateOrderItems(items: OrderItem[]): OrderItem[] {
    if (!Array.isArray(items) || items.length === 0) return [];
    const seenIds = new Set<string>();
    const seenCommentIds = new Set<string>();
    const unique: OrderItem[] = [];

    for (const item of items) {
        if (!item) continue;
        const id = String(item.id || '').trim();
        const scId = item.sourceCommentId ? String(item.sourceCommentId).trim() : null;

        // Bỏ qua nếu trùng ID đơn hàng
        if (id && seenIds.has(id)) continue;
        // Bỏ qua nếu trùng ID bình luận chốt đơn
        if (scId && seenCommentIds.has(scId)) continue;

        if (id) seenIds.add(id);
        if (scId) seenCommentIds.add(scId);
        unique.push(item);
    }
    return unique;
}

// Giữ an toàn tuyệt đối cho giỏ hàng của khách hàng (chỉ xoá/lưu trữ khi người dùng bấm reset phiên thủ công)
const loadPlatformCustomers = (platform: Platform): Record<string, CustomerData> => {
    const data = loadLocal(`slp_webapp_session_${platform}`, {});
    if (!data || typeof data !== 'object') return {};
    
    const cleanCustomers: Record<string, CustomerData> = {};

    Object.entries(data).forEach(([user, cust]: [string, any]) => {
        if (!cust) return;
        const rawItems = Array.isArray(cust.items) ? cust.items : [];
        const rawPastItems = Array.isArray(cust.pastItems) ? cust.pastItems : [];
        const items = deduplicateOrderItems(rawItems);
        const pastItems = deduplicateOrderItems(rawPastItems);
        const count = items.length;
        const total = items.reduce((sum, it) => sum + (it.price || 0), 0);

        cleanCustomers[user] = {
            count,
            total,
            lastTime: Number(cust.lastTime) || Date.now(),
            items,
            pastItems
        };
    });

    return cleanCustomers;
};

export const detectHostFlowPrice = (
    comments: CommentData[],
    tags: Record<string, TagType>
): FlowPriceData | null => {
    if (!comments || comments.length === 0 || !tags) return null;
    const hostComments = comments.filter(c => {
        if (!c || !c.user) return false;
        const u = normalizeUser(c.user);
        return tags[u] === 'HOST';
    });
    if (hostComments.length === 0) return null;

    const sorted = [...hostComments].sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0));

    for (const c of sorted) {
        const contentStr = typeof c.content === 'object' ? JSON.stringify(c.content) : String(c.content || '');
        const extracted = extractPriceFromContent(contentStr);
        if (extracted.price && extracted.price.trim() !== '') {
            return {
                price: extracted.price.trim(),
                hostUser: normalizeUser(c.user),
                content: contentStr,
                ts: Number(c.ts) || Date.now()
            };
        }
    }
    return null;
};

const PIN_DURATION_MS = 5 * 60 * 1000;
const pushTimers: Record<string, any> = {};
const localLocks: Record<string, number> = {};

const createPlatformState = (p: Platform): PlatformState => ({
    comments: [],
    customers: loadPlatformCustomers(p),
    printed: loadLocal(`slp_webapp_printed_${p}`),
    pinned: loadLocal(`slp_webapp_pinned_${p}`),
    tags: loadLocal(`slp_webapp_tags_${p}`),
    nicknames: loadLocal(`slp_webapp_nicknames_${p}`),
    pancakeLinks: loadLocal(`slp_webapp_pancakelinks_${p}`),
    flowPrice: loadLocal(`slp_webapp_flowprice_${p}`, null),
    lastCommentsAt: 0, lastCustomersAt: 0, lastPrintedAt: 0, lastPinnedAt: 0, lastTagsAt: 0, lastNicknamesAt: 0, lastPancakeLinksAt: 0, lastFlowPriceAt: 0
});

export const useStore = create<AppState>((set, get) => {
    // Migrate old tags
    let oldTags = loadLocal('slp_webapp_tags', null);
    if (oldTags) {
        let hadOld = false;
        let migrated: any = { tiktok: loadLocal('slp_webapp_tags_tiktok'), facebook: loadLocal('slp_webapp_tags_facebook'), shopee: loadLocal('slp_webapp_tags_shopee') };
        Object.keys(oldTags).forEach(k => {
            let idx = k.indexOf('::'); if (idx < 0) return;
            let p = k.substring(0, idx) as Platform; let u = k.substring(idx + 2);
            if (migrated[p] && !migrated[p][u]) { migrated[p][u] = oldTags[k]; hadOld = true; }
        });
        if (hadOld) {
            Object.keys(PLATFORMS).forEach(p => localStorage.setItem(`slp_webapp_tags_${p}`, JSON.stringify(migrated[p as Platform])));
            localStorage.removeItem('slp_webapp_tags');
        }
    }

    const encodeKey = (key: string) => key.replace(/\./g, '___dot___').replace(/\#/g, '___hash___').replace(/\$/g, '___dollar___').replace(/\[/g, '___lbracket___').replace(/\]/g, '___rbracket___').replace(/\//g, '___slash___');
const decodeKey = (key: string) => key.replace(/___dot___/g, '.').replace(/___hash___/g, '#').replace(/___dollar___/g, '$').replace(/___lbracket___/g, '[').replace(/___rbracket___/g, ']').replace(/___slash___/g, '/');

const encodeKeys = (obj: any) => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
    const res: any = {};
    for (const k in obj) res[encodeKey(k)] = obj[k];
    return res;
};

const decodeKeys = (obj: any) => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
    const res: any = {};
    for (const k in obj) res[decodeKey(k)] = obj[k];
    return res;
};

    const pushData = (platform: Platform, type: string, data: any, updatedAt: number) => {
        const key = `${platform}_${type}`;
        localLocks[key] = Date.now();
        clearTimeout(pushTimers[key]);
        pushTimers[key] = setTimeout(async () => {
             const room = PLATFORMS[platform].room;
             try {
                 const encodedData = encodeKeys(data);
                 await fbPut(`rooms/${room}/${type}/${DEVICE_ID}`, { data: encodedData, updatedAt, deviceId: DEVICE_ID });
                 if (type === 'customers') get().setSyncStatus("🟢 Đã đồng bộ", "#28a745");
             } catch (e) {
                 if (type === 'customers') get().setSyncStatus("🔴 Lỗi đồng bộ", "#dc3545");
             }
        }, 500);
    };

    return {
        tiktok: createPlatformState('tiktok'),
        facebook: createPlatformState('facebook'),
        shopee: createPlatformState('shopee'),
        syncStatus: { text: "⏳ Đang kết nối...", color: "#888" },
        isPolling: false,
        isPrintServer: localStorage.getItem('slp_webapp_printserver') === 'true',
        history: loadLocal('slp_webapp_history', []),

        setSyncStatus: (text, color) => set({ syncStatus: { text, color } }),


        subscribePlatformData: (platform: Platform) => {
            const room = PLATFORMS[platform].room;
            
            const mergeData = (remote: any) => {
                const merged = {};
                if (!remote) return merged;
                const devices = Object.values(remote).sort((a: any, b: any) => (a.updatedAt || 0) - (b.updatedAt || 0));
                devices.forEach((d: any) => {
                    if (d && d.data) Object.assign(merged, decodeKeys(d.data));
                });
                return merged;
            };

            const mergeCustomers = (remote: any) => {
                const merged: any = {};
                if (!remote) return merged;
                Object.values(remote).forEach((deviceInfo: any) => {
                    if (!deviceInfo || !deviceInfo.data) return;
                    Object.entries(decodeKeys(deviceInfo.data)).forEach(([rawUser, custData]: [any, any]) => {
                        const user = normalizeUser(rawUser);
                        if (!merged[user] || custData.lastTime > merged[user].lastTime) {
                            const cd = { ...custData };
                            const rawItems = Array.isArray(cd.items) ? cd.items : [];
                            const rawPast = Array.isArray(cd.pastItems) ? cd.pastItems : [];
                            cd.items = deduplicateOrderItems(rawItems);
                            
                            const now = Date.now();
                            const sixtyDays = 60 * 24 * 60 * 60 * 1000;
                            cd.pastItems = deduplicateOrderItems(rawPast).filter((item: any) => {
                                const t = item.createdAt || (item.id ? parseInt(String(item.id).substring(0,13)) : 0) || now;
                                return (now - t) <= sixtyDays;
                            });

                            cd.count = cd.items.length;
                            cd.total = cd.items.reduce((sum: number, it: any) => sum + (it.price || 0), 0);
                            merged[user] = cd;
                        }
                    });
                });
                return merged;
            };

            // 1. Comments Listener
            const commentsRef = ref(firebaseDb, `rooms/${room}/comments`);
            onValue(commentsRef, (snapshot) => {
                get().setSyncStatus("🟢 Đã kết nối (Realtime)", "#28a745");
                const data = snapshot.val();
                if (!data) return;

                const remoteClearedAt = Number(data.clearedAt) || 0;
                if (remoteClearedAt > getFeedClearedAt(platform)) {
                    setFeedClearedAt(platform, remoteClearedAt);
                }
                const effectiveClearedAt = Math.max(getFeedClearedAt(platform), getGlobalFeedClearedAt(), remoteClearedAt);

                const rawComments = Array.isArray(data.data) 
                    ? data.data 
                    : Array.isArray(data) 
                        ? data 
                        : typeof data === 'object' 
                            ? Object.values(data).filter((x: any) => x && typeof x === 'object' && (x.user || x.nickname || x.uniqueId || x.content || x.comment))
                            : [];
                const seenIds = new Set<string>();
                const seenSignatures = new Set<string>();
                const commentsData: any[] = [];
                const nowTs = Date.now();
                for (const c of rawComments) {
                    if (!c) continue;
                    const rawContent = c.content || c.comment || c.text || c.msg || '';
                    if (!rawContent) continue;
                    const rawUser = c.user || c.nickname || c.uniqueId || 'Khách';
                    const cleanUser = normalizeUser(rawUser);
                    const cleanContent = typeof rawContent === 'object' ? JSON.stringify(rawContent) : String(rawContent).trim();
                    const cleanAvatar = c.avatar || (typeof c.user === 'object' && (c.user.profilePictureUrl || c.user.avatarThumb?.urlList?.[0])) || '';
                    let ts = Number(c.ts) || 0;
                    const idStr = c.id ? String(c.id) : `c_${cleanUser}_${cleanContent.slice(0, 25)}_${Math.floor((ts || nowTs) / 10000)}`;
                    if (!ts) {
                        const numMatch = idStr.match(/\d{13}/);
                        if (numMatch) {
                            const numId = parseInt(numMatch[0], 10);
                            if (numId > 1600000000000 && numId < 3000000000000) {
                                ts = numId;
                            }
                        }
                    }
                    const finalTs = ts || nowTs;

                    // Nếu đã từng có lệnh xoá feed, bình luận không rõ timestamp hoặc cũ hơn thời điểm xoá sẽ bị loại bỏ
                    if (effectiveClearedAt > 0) {
                        if (!finalTs || finalTs <= effectiveClearedAt) {
                            continue;
                        }
                    }

                    // Bỏ qua comment của ngày cũ
                    if (finalTs && !isCommentFromToday(finalTs)) {
                        continue;
                    }

                    // Chống trùng lặp: loại trừ nếu đã có comment cùng ID hoặc cùng User + Nội dung trong vòng 20s
                    const isDup = seenIds.has(idStr) || commentsData.some(existing => {
                        if (existing.id && idStr && String(existing.id) === idStr) return true;
                        if (existing.user.toLowerCase() === cleanUser.toLowerCase() && 
                            existing.content.toLowerCase() === cleanContent.toLowerCase() && 
                            Math.abs((existing.ts || 0) - finalTs) <= 20000) {
                            return true;
                        }
                        return false;
                    });

                    if (!isDup) {
                        seenIds.add(idStr);
                        commentsData.push({
                            ...c,
                            id: idStr,
                            user: cleanUser,
                            content: cleanContent,
                            avatar: cleanAvatar,
                            ts: finalTs,
                            platform
                        });
                    }
                }
                if (commentsData.length > 0) {
                    const state = get()[platform];
                    const currentComments = (state.comments || []).filter(c => {
                        const cTs = c.ts || 0;
                        if (effectiveClearedAt > 0 && (!cTs || cTs <= effectiveClearedAt)) return false;
                        return isCommentFromToday(cTs);
                    });

                    // Hợp nhất các bình luận mới cục bộ (vừa được thêm trong 30s) mà chưa kịp lên Firebase
                    const merged = [...commentsData];
                    for (const ex of currentComments) {
                        const exTs = ex.ts || 0;
                        if (nowTs - exTs > 30000) continue; // Chỉ giữ comment rất mới chưa kịp sync
                        const isAlreadyInMerged = merged.some(m => 
                            (m.id && ex.id && String(m.id) === String(ex.id)) ||
                            (m.user.toLowerCase() === ex.user.toLowerCase() && 
                             m.content.toLowerCase() === ex.content.toLowerCase() && 
                             Math.abs((m.ts || 0) - exTs) <= 20000)
                        );
                        if (!isAlreadyInMerged) {
                            merged.push(ex);
                        }
                    }
                    // Sắp xếp bình luận mới nhất lên đầu
                    merged.sort((a, b) => (b.ts || 0) - (a.ts || 0));

                    const detectedFlow = detectHostFlowPrice(merged, state.tags || {});
                    set(s => ({ 
                        [platform]: { 
                            ...s[platform], 
                            lastCommentsAt: data.updatedAt || nowTs, 
                            comments: merged.slice(0, 250),
                            ...(detectedFlow ? { flowPrice: detectedFlow } : {})
                        } 
                    }));
                } else {
                    // Không có bình luận hợp lệ hoặc vừa bấm xoá feed phiên cũ
                    set(s => ({ [platform]: { ...s[platform], comments: [], lastCommentsAt: nowTs } }));
                }
            }, (error) => {
                console.error("Firebase Comments Realtime Error:", error);
                get().setSyncStatus("🔴 Bị chặn quyền (Hết hạn Rule)", "#dc3545");
            });

            // 1b. Realtime Cleared_At Listener (Lắng nghe sự kiện xoá feed từ các máy khác)
            const clearedRef = ref(firebaseDb, `rooms/${room}/cleared_at`);
            onValue(clearedRef, (snapshot) => {
                const val = snapshot.val();
                if (!val) return;
                const remoteClearedAt = Number(val.clearedAt || val) || 0;
                if (remoteClearedAt > getFeedClearedAt(platform)) {
                    setFeedClearedAt(platform, remoteClearedAt);
                    set(s => ({
                        [platform]: {
                            ...s[platform],
                            comments: (s[platform].comments || []).filter(c => (c.ts || 0) > remoteClearedAt)
                        }
                    }));
                }
            });

            // 2. Customers Listener
            const customersRef = ref(firebaseDb, `rooms/${room}/customers`);
            onValue(customersRef, (snapshot) => {
                if (Date.now() - (localLocks[`${platform}_customers`] || 0) <= 3000) return;
                const data = snapshot.val();
                if (!data) return;
                const state = get()[platform];
                const mergedCustomers = mergeCustomers(data);
                let latestUpdatedAt = 0;
                Object.values(data).forEach((d: any) => { if (d && d.updatedAt > latestUpdatedAt) latestUpdatedAt = d.updatedAt; });
                if (latestUpdatedAt !== state.lastCustomersAt) {
                    set(s => ({ [platform]: { ...s[platform], lastCustomersAt: latestUpdatedAt, customers: mergedCustomers } }));
                    localStorage.setItem(`slp_webapp_session_${platform}`, JSON.stringify(mergedCustomers));
                }
            });

            // 3. Printed Listener
            const printedRef = ref(firebaseDb, `rooms/${room}/printed`);
            onValue(printedRef, (snapshot) => {
                if (Date.now() - (localLocks[`${platform}_printed`] || 0) <= 3000) return;
                const data = snapshot.val();
                if (!data) return;
                const state = get()[platform];
                const mergedPrinted = mergeData(data);
                let latestUpdatedAt = 0;
                Object.values(data).forEach((d: any) => { if (d && d.updatedAt > latestUpdatedAt) latestUpdatedAt = d.updatedAt; });
                if (latestUpdatedAt !== state.lastPrintedAt) {
                    set(s => ({ [platform]: { ...s[platform], lastPrintedAt: latestUpdatedAt, printed: mergedPrinted } }));
                    localStorage.setItem(`slp_webapp_printed_${platform}`, JSON.stringify(mergedPrinted));
                }
            });

            // 4. Pinned Listener
            const pinnedRef = ref(firebaseDb, `rooms/${room}/pinned`);
            onValue(pinnedRef, (snapshot) => {
                if (Date.now() - (localLocks[`${platform}_pinned`] || 0) <= 3000) return;
                const data = snapshot.val();
                if (!data) return;
                const state = get()[platform];
                const mergedPinned = mergeData(data);
                let latestUpdatedAt = 0;
                Object.values(data).forEach((d: any) => { if (d && d.updatedAt > latestUpdatedAt) latestUpdatedAt = d.updatedAt; });
                if (latestUpdatedAt !== state.lastPinnedAt) {
                    set(s => ({ [platform]: { ...s[platform], lastPinnedAt: latestUpdatedAt, pinned: mergedPinned } }));
                    localStorage.setItem(`slp_webapp_pinned_${platform}`, JSON.stringify(mergedPinned));
                }
            });

            // 5. Nicknames Listener
            const nicknamesRef = ref(firebaseDb, `rooms/${room}/nicknames`);
            onValue(nicknamesRef, (snapshot) => {
                if (Date.now() - (localLocks[`${platform}_nicknames`] || 0) <= 3000) return;
                const data = snapshot.val();
                if (!data) return;
                const state = get()[platform];
                const mergedNicknames = mergeData(data);
                let latestUpdatedAt = 0;
                Object.values(data).forEach((d: any) => { if (d && d.updatedAt > latestUpdatedAt) latestUpdatedAt = d.updatedAt; });
                if (latestUpdatedAt !== state.lastNicknamesAt) {
                    set(s => ({ [platform]: { ...s[platform], lastNicknamesAt: latestUpdatedAt, nicknames: mergedNicknames } }));
                    localStorage.setItem(`slp_webapp_nicknames_${platform}`, JSON.stringify(mergedNicknames));
                }
            });

            // 6. Tags Listener
            const tagsRef = ref(firebaseDb, `rooms/${room}/tags`);
            onValue(tagsRef, (snapshot) => {
                if (Date.now() - (localLocks[`${platform}_tags`] || 0) <= 3000) return;
                const data = snapshot.val();
                if (!data) return;
                const state = get()[platform];
                const mergedTags = mergeData(data);
                let latestUpdatedAt = 0;
                Object.values(data).forEach((d: any) => { if (d && d.updatedAt > latestUpdatedAt) latestUpdatedAt = d.updatedAt; });
                if (latestUpdatedAt !== state.lastTagsAt) {
                    const detectedFlow = detectHostFlowPrice(state.comments || [], mergedTags);
                    set(s => ({ 
                        [platform]: { 
                            ...s[platform], 
                            lastTagsAt: latestUpdatedAt, 
                            tags: mergedTags,
                            ...(detectedFlow ? { flowPrice: detectedFlow } : {})
                        } 
                    }));
                    localStorage.setItem(`slp_webapp_tags_${platform}`, JSON.stringify(mergedTags));
                }
            });

            // 7. Pancake Links Listener
            const pancakeLinksRef = ref(firebaseDb, `rooms/${room}/pancake_links`);
            onValue(pancakeLinksRef, (snapshot) => {
                if (Date.now() - (localLocks[`${platform}_pancake_links`] || 0) <= 3000) return;
                const data = snapshot.val();
                if (!data) return;
                const state = get()[platform];
                const mergedLinks = mergeData(data);
                let latestUpdatedAt = 0;
                Object.values(data).forEach((d: any) => { if (d && d.updatedAt > latestUpdatedAt) latestUpdatedAt = d.updatedAt; });
                if (latestUpdatedAt !== state.lastPancakeLinksAt) {
                    set(s => ({ [platform]: { ...s[platform], lastPancakeLinksAt: latestUpdatedAt, pancakeLinks: mergedLinks } }));
                    localStorage.setItem(`slp_webapp_pancakelinks_${platform}`, JSON.stringify(mergedLinks));
                }
            });

            // 8. Flow Price Listener (Realtime host price across devices)
            const flowPriceRef = ref(firebaseDb, `rooms/${room}/flow_price`);
            onValue(flowPriceRef, (snapshot) => {
                if (Date.now() - (localLocks[`${platform}_flow_price`] || 0) <= 3000) return;
                const data = snapshot.val();
                if (!data) return;
                const state = get()[platform];
                const remoteFlow = data.data !== undefined ? data.data : data;
                const latestUpdatedAt = Number(data.updatedAt) || Date.now();
                if (latestUpdatedAt !== state.lastFlowPriceAt) {
                    set(s => ({ 
                        [platform]: { 
                            ...s[platform], 
                            lastFlowPriceAt: latestUpdatedAt, 
                            flowPrice: remoteFlow ? {
                                price: String(remoteFlow.price || ''),
                                hostUser: String(remoteFlow.hostUser || ''),
                                content: String(remoteFlow.content || ''),
                                ts: Number(remoteFlow.ts) || Date.now()
                            } : null 
                        } 
                    }));
                    if (remoteFlow) {
                        try {
                            localStorage.setItem(`slp_webapp_flowprice_${platform}`, JSON.stringify(remoteFlow));
                        } catch {}
                    } else {
                        try {
                            localStorage.removeItem(`slp_webapp_flowprice_${platform}`);
                        } catch {}
                    }
                }
            });
        },

        togglePrintServer: () => {
        set(s => {
            const next = !s.isPrintServer;
            localStorage.setItem('slp_webapp_printserver', String(next));
            return { isPrintServer: next };
        });
    },
    initPolling: () => {
            if (get().isPolling) return;
            set({ isPolling: true });
            
            const platforms: Platform[] = ['tiktok', 'facebook', 'shopee'];
            platforms.forEach(p => get().subscribePlatformData(p));
            setInterval(() => get().sweepExpiredPins(), 1000);
        },

        sweepExpiredPins: () => {
            let changed = false;
            const now = Date.now();
            ['tiktok', 'facebook', 'shopee'].forEach((p) => {
                const platform = p as Platform;
                const state = get()[platform];
                const newPinned = { ...state.pinned };
                let pChanged = false;
                Object.keys(newPinned).forEach(id => {
                    const entry = newPinned[id];
                    const isHost = entry.user && state.tags[entry.user] === 'HOST';
                    if (entry.expiry <= now) {
                        if (isHost) {
                            newPinned[id] = { ...entry, expiry: now + 1000 * 60 * 60 * 24 * 365 };
                            pChanged = true;
                            changed = true;
                        } else {
                            delete newPinned[id];
                            pChanged = true;
                            changed = true;
                            if (entry.user) {
                                get().setCustomerTag(platform, entry.user, 'DAO');
                            }
                        }
                    }
                });
                if (pChanged) {
                    set(s => ({ [platform]: { ...s[platform], pinned: newPinned } }));
                    localStorage.setItem(`slp_webapp_pinned_${platform}`, JSON.stringify(newPinned));
                }
            });
        },

        togglePin: (platform, commentId, user) => {
            const state = get()[platform];
            const newPinned = { ...state.pinned };
            const isHost = state.tags[user] === 'HOST';
            if (newPinned[commentId] && (newPinned[commentId].expiry > Date.now() || isHost)) {
                delete newPinned[commentId];
            } else {
                newPinned[commentId] = { user, expiry: isHost ? Date.now() + 1000 * 60 * 60 * 24 * 365 : Date.now() + PIN_DURATION_MS };
            }
            const now = Date.now();
            set(s => ({ [platform]: { ...s[platform], pinned: newPinned, lastPinnedAt: now } }));
            localStorage.setItem(`slp_webapp_pinned_${platform}`, JSON.stringify(newPinned));
            pushData(platform, 'pinned', newPinned, now);
        },

        repostComment: async (platform, content) => {
            if (!content) return false;
            const room = PLATFORMS[platform].room;
            const commandId = DEVICE_ID + '_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
            const payload = { content: content, commandId: commandId, updatedAt: Date.now(), slowMode: true, typingDelay: 300 };
            try {
                await Promise.all([
                    fbPut(`rooms/${room}/replyCommand`, payload),
                    fetch(`https://hienpham-live-default-rtdb.asia-southeast1.firebasedatabase.app/rooms/${room}/replyCommand.json`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    }).catch(() => {})
                ]);
                return true;
            } catch (e) {
                console.error("Gửi lệnh đăng lại thất bại", e);
                return false;
            }
        },

        
        refreshPlatform: async (platform) => {
            const room = PLATFORMS[platform].room;
            const commandId = DEVICE_ID + '_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
            const refreshPayload = { 
                commandId: commandId, 
                action: 'reload_page', 
                updatedAt: Date.now(),
                reason: 'live_restart' 
            };
            const reloadPayload = { 
                commandId: commandId, 
                action: 'f5', 
                updatedAt: Date.now() 
            };
            try {
                // 1. Gửi lệnh qua cả 2 Database Firebase Realtime (spry-shade & hienpham-live)
                await Promise.all([
                    fbPut(`rooms/${room}/refreshCommand`, refreshPayload).catch(() => {}),
                    fbPut(`rooms/${room}/reloadBrowserCommand`, reloadPayload).catch(() => {}),
                    fetch(`https://hienpham-live-default-rtdb.asia-southeast1.firebasedatabase.app/rooms/${room}/refreshCommand.json`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(refreshPayload)
                    }).catch(() => {}),
                    fetch(`https://hienpham-live-default-rtdb.asia-southeast1.firebasedatabase.app/rooms/${room}/reloadBrowserCommand.json`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(reloadPayload)
                    }).catch(() => {})
                ]);

                // 2. Gửi lệnh qua API Backend TV Box & Local Server
                const endpoints = [
                    '/api/tiktok/reload-browser',
                    'https://caotiktok.home79.cloud/api/tiktok/reload-browser'
                ];
                endpoints.forEach(ep => {
                    fetch(ep, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ commandId, reason: 'live_restart' })
                    }).catch(() => {});
                });

                // 3. Phát sự kiện nội bộ trình duyệt và tab chéo
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('tiktok_live_reload_browser', { detail: { commandId, reason: 'live_restart' } }));
                    try {
                        localStorage.setItem('tiktok_f5_trigger', JSON.stringify({ commandId, timestamp: Date.now() }));
                    } catch(e) {}
                    try {
                        if (typeof BroadcastChannel !== 'undefined') {
                            const bc = new BroadcastChannel('tiktok_f5_channel');
                            bc.postMessage({ commandId, timestamp: Date.now() });
                            setTimeout(() => bc.close(), 1000);
                        }
                    } catch(e) {}
                }

                return true;
            } catch (e) {
                console.error("Gửi lệnh làm mới thất bại", e);
                return false;
            }
        },

        unpinComment: (platform, commentId) => {
            if (!commentId) return;
            const state = get()[platform];
            const newPinned = { ...state.pinned };
            if (newPinned[commentId]) {
                delete newPinned[commentId];
                const now = Date.now();
                set(s => ({ [platform]: { ...s[platform], pinned: newPinned, lastPinnedAt: now } }));
                localStorage.setItem(`slp_webapp_pinned_${platform}`, JSON.stringify(newPinned));
                pushData(platform, 'pinned', newPinned, now);
            }
        },

        unpinAllUserComments: (platform, rawUser) => {
            if (!rawUser) return;
            const user = normalizeUser(rawUser).toLowerCase();
            const state = get()[platform];
            const newPinned = { ...state.pinned };
            let hasChanged = false;
            Object.keys(newPinned).forEach(id => {
                const entry = newPinned[id];
                if (entry && normalizeUser(entry.user).toLowerCase() === user) {
                    delete newPinned[id];
                    hasChanged = true;
                }
            });
            if (hasChanged) {
                const now = Date.now();
                set(s => ({ [platform]: { ...s[platform], pinned: newPinned, lastPinnedAt: now } }));
                localStorage.setItem(`slp_webapp_pinned_${platform}`, JSON.stringify(newPinned));
                pushData(platform, 'pinned', newPinned, now);
            }
        },

        markPrinted: (platform, commentId) => {
            if (!commentId) return;
            const state = get()[platform];
            const newPrinted = { ...state.printed };
            newPrinted[commentId] = (newPrinted[commentId] || 0) + 1;
            const now = Date.now();
            set(s => ({ [platform]: { ...s[platform], printed: newPrinted, lastPrintedAt: now } }));
            localStorage.setItem(`slp_webapp_printed_${platform}`, JSON.stringify(newPrinted));
            pushData(platform, 'printed', newPrinted, now);
        },

        unmarkPrinted: (platform, commentId) => {
            if (!commentId) return;
            const state = get()[platform];
            const newPrinted = { ...state.printed };
            if (newPrinted[commentId]) {
                newPrinted[commentId] -= 1;
                if (newPrinted[commentId] <= 0) delete newPrinted[commentId];
                const now = Date.now();
                set(s => ({ [platform]: { ...s[platform], printed: newPrinted, lastPrintedAt: now } }));
                localStorage.setItem(`slp_webapp_printed_${platform}`, JSON.stringify(newPrinted));
                pushData(platform, 'printed', newPrinted, now);
            }
        },

        setCustomerNickname: (platform, rawUser, nickname) => {
            const user = normalizeUser(rawUser);
            const state = get()[platform];
            const newNicknames = { ...state.nicknames, [user]: nickname };
            if (!nickname) delete newNicknames[user];
            const now = Date.now();
            set(s => ({ [platform]: { ...s[platform], nicknames: newNicknames, lastNicknamesAt: now } }));
            localStorage.setItem(`slp_webapp_nicknames_${platform}`, JSON.stringify(newNicknames));
            pushData(platform, "nicknames", newNicknames, now);
        },

        setCustomerPancakeLink: (platform, rawUser, link) => {
            const user = normalizeUser(rawUser);
            const state = get()[platform];
            const currentLinks = state.pancakeLinks || {};
            const cleanLink = (link || '').trim();
            const newLinks = { ...currentLinks, [user]: cleanLink };
            if (!cleanLink) delete newLinks[user];
            const now = Date.now();
            set(s => ({ [platform]: { ...s[platform], pancakeLinks: newLinks, lastPancakeLinksAt: now } }));
            localStorage.setItem(`slp_webapp_pancakelinks_${platform}`, JSON.stringify(newLinks));
            pushData(platform, "pancake_links", newLinks, now);
        },

        setFlowPrice: (platform, price, hostUser = '', content = '') => {
            const cleanPrice = (price || '').trim();
            const now = Date.now();
            if (cleanPrice) {
                addRecentClosedPrice(cleanPrice);
            }
            const flowObj: FlowPriceData | null = cleanPrice ? {
                price: cleanPrice,
                hostUser: hostUser ? normalizeUser(hostUser) : 'HOST',
                content: content || `${cleanPrice}k`,
                ts: now
            } : null;
            set(s => ({
                [platform]: {
                    ...s[platform],
                    flowPrice: flowObj,
                    lastFlowPriceAt: now
                }
            }));
            if (flowObj) {
                try {
                    localStorage.setItem(`slp_webapp_flowprice_${platform}`, JSON.stringify(flowObj));
                } catch {}
            } else {
                try {
                    localStorage.removeItem(`slp_webapp_flowprice_${platform}`);
                } catch {}
            }
            pushData(platform, 'flow_price', flowObj, now);
        },

        clearFlowPrice: (platform) => {
            const now = Date.now();
            set(s => ({
                [platform]: {
                    ...s[platform],
                    flowPrice: null,
                    lastFlowPriceAt: now
                }
            }));
            try {
                localStorage.removeItem(`slp_webapp_flowprice_${platform}`);
            } catch {}
            pushData(platform, 'flow_price', null, now);
        },

        setCustomerTag: (platform, rawUser, tag) => {
            const user = normalizeUser(rawUser);
            const state = get()[platform];
            const prevTag = state.tags?.[user];
            const newTags = { ...state.tags, [user]: tag };
            const now = Date.now();
            
            // Check if user is set to HOST, auto-detect latest price from their comments
            let newFlowPrice = state.flowPrice;
            if (tag === 'HOST') {
                const hostComments = (state.comments || []).filter(c => normalizeUser(c.user) === user);
                for (const hc of hostComments) {
                    const contentStr = typeof hc.content === 'object' ? JSON.stringify(hc.content) : String(hc.content || '');
                    const extracted = extractPriceFromContent(contentStr);
                    if (extracted.price && extracted.price.trim() !== '') {
                        newFlowPrice = {
                            price: extracted.price.trim(),
                            hostUser: user,
                            content: contentStr,
                            ts: Number(hc.ts) || now
                        };
                        try {
                            localStorage.setItem(`slp_webapp_flowprice_${platform}`, JSON.stringify(newFlowPrice));
                        } catch {}
                        pushData(platform, 'flow_price', newFlowPrice, now);
                        break;
                    }
                }
            } else if (prevTag === 'HOST' && state.flowPrice?.hostUser === user) {
                // If Host unassigned, check if another HOST exists or clear
                const remainingFlow = detectHostFlowPrice(state.comments || [], newTags);
                newFlowPrice = remainingFlow;
                if (remainingFlow) {
                    try {
                        localStorage.setItem(`slp_webapp_flowprice_${platform}`, JSON.stringify(remainingFlow));
                    } catch {}
                } else {
                    try {
                        localStorage.removeItem(`slp_webapp_flowprice_${platform}`);
                    } catch {}
                }
                pushData(platform, 'flow_price', remainingFlow, now);
            }

            set(s => ({ 
                [platform]: { 
                    ...s[platform], 
                    tags: newTags, 
                    lastTagsAt: now,
                    flowPrice: newFlowPrice
                } 
            }));
            localStorage.setItem(`slp_webapp_tags_${platform}`, JSON.stringify(newTags));
            pushData(platform, 'tags', newTags, now);
            
            if (tag === 'COC' || tag === 'COC_100') {
                const newPinned = { ...state.pinned };
                let pinnedChanged = false;
                Object.keys(newPinned).forEach(commentId => {
                    if (newPinned[commentId].user === user) {
                        delete newPinned[commentId];
                        pinnedChanged = true;
                    }
                });
                if (pinnedChanged) {
                    set(s => ({ [platform]: { ...s[platform], pinned: newPinned, lastPinnedAt: now } }));
                    localStorage.setItem(`slp_webapp_pinned_${platform}`, JSON.stringify(newPinned));
                    pushData(platform, 'pinned', newPinned, now);
                }

                // TỰ ĐỘNG NHẢY BÌNH LUẬN CẢM ƠN KHI GẮN TAG CỌC
                if (prevTag !== 'COC' && prevTag !== 'COC_100') {
                    try {
                        const isAutoThankEnabled = localStorage.getItem('slp_auto_thank_deposit') !== 'false';
                        if (isAutoThankEnabled) {
                            const displayName = state.nicknames?.[user] || user;
                            const template = localStorage.getItem('slp_thank_deposit_template') || 'thanks {name} nha';
                            const thankContent = template
                                .replace(/\{name\}/gi, displayName)
                                .replace(/\{user\}/gi, displayName)
                                .replace(/\{nick\}/gi, displayName)
                                .replace(/\{ten\}/gi, displayName);

                            // 1. Gửi lệnh bình luận trực tiếp ra luồng Live (TikTok/FB)
                            get().repostComment(platform, thankContent);

                            // 2. Nhảy bình luận cảm ơn vào feed của phần mềm để chủ shop & các máy phụ thấy ngay
                            const thankComment: CommentData = {
                                id: `coc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                                user: '🤖 Bot Chốt Đơn',
                                content: `💧 ${thankContent}`,
                                time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                                avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&fit=crop&q=80',
                                ts: Date.now(),
                                platform: platform,
                            };
                            get().addComment(platform, thankComment);
                        }
                    } catch (err) {
                        console.error('Lỗi khi tự động gửi bình luận cảm ơn cọc:', err);
                    }
                }
            }
        },

        recordOrder: (platform, rawUser, price, content, sourceCommentId) => {
            const user = normalizeUser(rawUser);
            if (!user) return;
            const state = get()[platform];
            const newCusts = { ...state.customers };
            const priceNum = parseInt(price as string) || 0;
            if (priceNum > 0) {
                addRecentClosedPrice(priceNum);
            }
            if (!newCusts[user]) newCusts[user] = { count: 0, total: 0, lastTime: Date.now(), items: [], pastItems: [] };
            const cust = newCusts[user];
            
            const existingItems = deduplicateOrderItems(cust.items || []);
            // Tránh chốt trùng lặp đơn hàng có cùng sourceCommentId
            if (sourceCommentId && existingItems.some(it => it.sourceCommentId === sourceCommentId)) {
                return;
            }

            const newItemId = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
            const updatedItems = [...existingItems, {  
                id: newItemId, 
                content: (content && content.trim() !== "" && content.trim() !== "(Không ghi chú)") ? content.trim() : "", 
                price: priceNum, 
                sourceCommentId, 
                createdAt: Date.now(), 
                shipped: false 
            }];

            newCusts[user] = {
                ...cust,
                count: updatedItems.length,
                total: updatedItems.reduce((sum, it) => sum + (it.price || 0), 0),
                lastTime: Date.now(),
                items: updatedItems
            };
            const now = Date.now();
            set(s => ({ [platform]: { ...s[platform], customers: newCusts, lastCustomersAt: now } }));
            localStorage.setItem(`slp_webapp_session_${platform}`, JSON.stringify(newCusts));
            pushData(platform, 'customers', newCusts, now);
        },

        addCustomOrderItem: (platform, rawUser, itemData) => {
            const user = normalizeUser(rawUser);
            if (!user) return;
            const state = get()[platform];
            const newCusts = { ...state.customers };
            const unitPrice = Math.max(0, itemData.unitPrice || 0);
            const quantity = Math.max(1, itemData.quantity || 1);
            const totalLinePrice = itemData.price !== undefined && itemData.price > 0 
                ? itemData.price 
                : (unitPrice * quantity);

            if (unitPrice > 0) {
                addRecentClosedPrice(unitPrice);
            }
            if (!newCusts[user]) newCusts[user] = { count: 0, total: 0, lastTime: Date.now(), items: [], pastItems: [] };
            const cust = newCusts[user];
            const existingItems = deduplicateOrderItems(cust.items || []);

            const newItemId = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
            const newItem: OrderItem = {
                id: newItemId,
                content: (itemData.content && itemData.content.trim() !== "" && itemData.content.trim() !== "(Không ghi chú)") ? itemData.content.trim() : "",
                unitPrice,
                quantity,
                price: totalLinePrice,
                sourceCommentId: itemData.sourceCommentId || null,
                createdAt: Date.now(),
                shipped: false
            };

            const updatedItems = [...existingItems, newItem];

            newCusts[user] = {
                ...cust,
                count: updatedItems.length,
                total: updatedItems.reduce((sum, it) => sum + (it.price || 0), 0),
                lastTime: Date.now(),
                items: updatedItems
            };
            const now = Date.now();
            set(s => ({ [platform]: { ...s[platform], customers: newCusts, lastCustomersAt: now } }));
            localStorage.setItem(`slp_webapp_session_${platform}`, JSON.stringify(newCusts));
            pushData(platform, 'customers', newCusts, now);

            if (itemData.printNow) {
                const nickname = get()[platform].nicknames?.[user];
                const time = new Date().toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit'});
                const printContent = newItem.content ? `${newItem.content} (${unitPrice}k x ${quantity})` : `(${unitPrice}k x ${quantity})`;
                printLabel(nickname ? `${user} (${nickname})` : `#${getShortId(user)} ${user}`, printContent, totalLinePrice, time, PLATFORMS[platform].label, true);
            }
        },

        addMultipleCustomOrderItems: (platform, rawUser, items, printNow = true) => {
            const user = normalizeUser(rawUser);
            if (!user || !items || items.length === 0) return;
            const state = get()[platform];
            const newCusts = { ...state.customers };
            if (!newCusts[user]) newCusts[user] = { count: 0, total: 0, lastTime: Date.now(), items: [], pastItems: [] };
            const cust = newCusts[user];
            const existingItems = deduplicateOrderItems(cust.items || []);

            const nowTime = Date.now();
            const createdOrderItems: OrderItem[] = items.map((it, idx) => {
                const unitPrice = Math.max(0, it.unitPrice || 0);
                const quantity = Math.max(1, it.quantity || 1);
                const totalLinePrice = it.price !== undefined && it.price > 0
                    ? it.price
                    : (unitPrice * quantity);

                if (unitPrice > 0) {
                    addRecentClosedPrice(unitPrice);
                }

                return {
                    id: `${nowTime}_${idx}_${Math.random().toString(36).substr(2, 6)}`,
                    content: (it.content && it.content.trim() !== "" && it.content.trim() !== "(Không ghi chú)") ? it.content.trim() : "",
                    unitPrice,
                    quantity,
                    price: totalLinePrice,
                    sourceCommentId: it.sourceCommentId || null,
                    createdAt: nowTime + idx,
                    shipped: false
                };
            });

            const updatedItems = [...existingItems, ...createdOrderItems];

            newCusts[user] = {
                ...cust,
                count: updatedItems.length,
                total: updatedItems.reduce((sum, it) => sum + (it.price || 0), 0),
                lastTime: Date.now(),
                items: updatedItems
            };
            const now = Date.now();
            set(s => ({ [platform]: { ...s[platform], customers: newCusts, lastCustomersAt: now } }));
            localStorage.setItem(`slp_webapp_session_${platform}`, JSON.stringify(newCusts));
            pushData(platform, 'customers', newCusts, now);

            if (printNow) {
                const nickname = get()[platform].nicknames?.[user];
                const time = new Date().toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit'});
                const customerLabel = nickname ? `${user} (${nickname})` : `#${getShortId(user)} ${user}`;
                
                createdOrderItems.forEach(item => {
                    const printContent = item.content ? `${item.content} (${item.unitPrice}k x ${item.quantity})` : `(${item.unitPrice}k x ${item.quantity})`;
                    printLabel(customerLabel, printContent, item.price, time, PLATFORMS[platform].label, true);
                });
            }
        },

        initCustomer: (platform, rawUser) => {
            const user = normalizeUser(rawUser);
            if (!user) return;
            const state = get()[platform];
            const newCusts = { ...state.customers };
            if (!newCusts[user]) {
                newCusts[user] = { count: 0, total: 0, lastTime: Date.now(), items: [], pastItems: [] };
                const now = Date.now();
                set(s => ({ [platform]: { ...s[platform], customers: newCusts, lastCustomersAt: now } }));
                localStorage.setItem(`slp_webapp_session_${platform}`, JSON.stringify(newCusts));
                pushData(platform, 'customers', newCusts, now);
            }
        },
        updateCustomerStats: (platform, rawUser, newCount, newTotal) => {
            const user = normalizeUser(rawUser);
            if (!user) return;
            const state = get()[platform];
            const newCusts = { ...state.customers };
            if (!newCusts[user]) return;
            const cust = newCusts[user];

            const targetCount = newCount >= 0 ? newCount : 0;
            const targetTotal = newTotal >= 0 ? newTotal : 0;
            const currentItems = cust.items || [];
            let updatedItems = [...currentItems];

            // Reconcile items array if count is manually adjusted
            if (targetCount === 0) {
                updatedItems = [];
            } else if (targetCount > currentItems.length) {
                const currentSum = currentItems.reduce((s, it) => s + (it.price || 0), 0);
                const diffCount = targetCount - currentItems.length;
                const diffPrice = Math.max(0, targetTotal - currentSum);
                const avgPrice = diffCount > 0 ? Math.round(diffPrice / diffCount) : 0;
                for (let i = 0; i < diffCount; i++) {
                    updatedItems.push({
                        id: `${Date.now()}_adj_${i}`,
                        content: `Đơn đã chốt (${avgPrice}k)`,
                        price: avgPrice,
                        sourceCommentId: null,
                        createdAt: Date.now(),
                        shipped: false
                    });
                }
            } else if (targetCount < currentItems.length) {
                updatedItems = currentItems.slice(0, targetCount);
            }

            newCusts[user] = {
                ...cust,
                count: targetCount,
                total: targetTotal,
                items: updatedItems,
                lastTime: Date.now(),
            };
            const now = Date.now();
            set(s => ({ [platform]: { ...s[platform], customers: newCusts, lastCustomersAt: now } }));
            localStorage.setItem(`slp_webapp_session_${platform}`, JSON.stringify(newCusts));
            pushData(platform, 'customers', newCusts, now);
        },

        printNewOrder: (platform, rawUser, content, price, time, sourceCommentId, bypassDebounce, skipPrint) => {
            const user = normalizeUser(rawUser);
            get().recordOrder(platform, user, price, content, sourceCommentId);
            if (sourceCommentId) {
                get().markPrinted(platform, sourceCommentId);
                get().unpinComment(platform, sourceCommentId);
            }
            if (!skipPrint) {
                const nickname = get()[platform].nicknames?.[user];
                printLabel(nickname ? `${user} (${nickname})` : `#${getShortId(user)} ${user}`, content, price, time, PLATFORMS[platform].label, bypassDebounce);
            }
        },

                toggleCurrentItemShipped: (platform, rawUser, itemIndex, forceState) => {
            const user = normalizeUser(rawUser);
            const state = get()[platform];
            const cust = state.customers[user];
            if (!cust || !cust.items || !cust.items[itemIndex]) return;
            const newCusts = { ...state.customers };
            const newItems = [...cust.items];
            const isShipped = forceState !== undefined ? forceState : !newItems[itemIndex].shipped;
            newItems[itemIndex] = { ...newItems[itemIndex], shipped: isShipped };
            
            newCusts[user] = {
                ...cust,
                items: newItems,
                lastTime: Date.now()
            };
            const now = Date.now();
            set(s => ({ [platform]: { ...s[platform], customers: newCusts, lastCustomersAt: now } }));
            localStorage.setItem(`slp_webapp_session_${platform}`, JSON.stringify(newCusts));
            pushData(platform, 'customers', newCusts, now);
        },
        markCurrentItemsShipped: (platform, rawUser, itemIndices, shippedState = true) => {
            const user = normalizeUser(rawUser);
            const state = get()[platform];
            const cust = state.customers[user];
            if (!cust || !cust.items) return;
            const newCusts = { ...state.customers };
            const indicesToUpdate = itemIndices && itemIndices.length > 0
                ? new Set(itemIndices)
                : new Set(cust.items.map((_, i) => i));
            const newItems = cust.items.map((it, idx) => {
                if (indicesToUpdate.has(idx)) {
                    return { ...it, shipped: shippedState };
                }
                return it;
            });
            newCusts[user] = {
                ...cust,
                items: newItems,
                lastTime: Date.now()
            };
            const now = Date.now();
            set(s => ({ [platform]: { ...s[platform], customers: newCusts, lastCustomersAt: now } }));
            localStorage.setItem(`slp_webapp_session_${platform}`, JSON.stringify(newCusts));
            pushData(platform, 'customers', newCusts, now);
        },
        archiveShippedCurrentItems: (platform, rawUser) => {
            const user = normalizeUser(rawUser);
            const state = get()[platform];
            const cust = state.customers[user];
            if (!cust || !cust.items) return;
            const newCusts = { ...state.customers };
            const now = Date.now();
            const shippedItems = cust.items.filter(it => it.shipped).map(it => ({ ...it, createdAt: it.createdAt || now }));
            const remainingItems = cust.items.filter(it => !it.shipped);
            if (shippedItems.length === 0) return;
            const existingPast = cust.pastItems || [];
            newCusts[user] = {
                ...cust,
                count: remainingItems.length,
                total: remainingItems.reduce((sum, it) => sum + (it.price || 0), 0),
                lastTime: now,
                items: remainingItems,
                pastItems: [...existingPast, ...shippedItems]
            };
            set(s => ({ [platform]: { ...s[platform], customers: newCusts, lastCustomersAt: now } }));
            localStorage.setItem(`slp_webapp_session_${platform}`, JSON.stringify(newCusts));
            pushData(platform, 'customers', newCusts, now);
        },
        markAllCustomerItemsShipped: (platform, rawUser, archiveToPast = false) => {
            const user = normalizeUser(rawUser);
            const state = get()[platform];
            const cust = state.customers[user];
            if (!cust) return;
            const newCusts = { ...state.customers };
            const now = Date.now();
            const currentItems = (cust.items || []).map(it => ({ ...it, shipped: true, createdAt: it.createdAt || now }));
            const existingPast = (cust.pastItems || []).map(it => ({ ...it, shipped: true }));
            
            if (archiveToPast) {
                newCusts[user] = {
                    ...cust,
                    count: 0,
                    total: 0,
                    lastTime: now,
                    items: [],
                    pastItems: [...existingPast, ...currentItems]
                };
            } else {
                newCusts[user] = {
                    ...cust,
                    items: currentItems,
                    lastTime: now
                };
            }
            set(s => ({ [platform]: { ...s[platform], customers: newCusts, lastCustomersAt: now } }));
            localStorage.setItem(`slp_webapp_session_${platform}`, JSON.stringify(newCusts));
            pushData(platform, 'customers', newCusts, now);
        },
        togglePastItemShipped: (platform, rawUser, itemIndex) => {
            const user = normalizeUser(rawUser);
            const state = get()[platform];
            const cust = state.customers[user];
            if (!cust || !cust.pastItems || !cust.pastItems[itemIndex]) return;
            const newCusts = { ...state.customers };
            const newPastItems = [...cust.pastItems];
            newPastItems[itemIndex] = { ...newPastItems[itemIndex], shipped: !newPastItems[itemIndex].shipped };
            newCusts[user] = { ...cust, pastItems: newPastItems, lastTime: Date.now() };
            const now = Date.now();
            set(s => ({ [platform]: { ...s[platform], customers: newCusts, lastCustomersAt: now } }));
            localStorage.setItem(`slp_webapp_session_${platform}`, JSON.stringify(newCusts));
            pushData(platform, 'customers', newCusts, now);
        },
        mergePastItems: (platform, rawUser, itemIndices) => {
            const user = normalizeUser(rawUser);
            const state = get()[platform];
            const cust = state.customers[user];
            if (!cust || !cust.pastItems) return;
            const newCusts = { ...state.customers };
            const newItems = [...(cust.items || [])];
            const newPastItems = [...cust.pastItems];
            
            // Extract items to merge
            const itemsToMerge = itemIndices.map(idx => newPastItems[idx]);
            // Remove them from pastItems, sorting indices descending to avoid shifting issues
            itemIndices.sort((a,b) => b - a).forEach(idx => {
                newPastItems.splice(idx, 1);
            });
            
            // Add to items and update counts
            let addCount = 0;
            let addTotal = 0;
            itemsToMerge.forEach(item => {
                const itemTime = item.createdAt || (item.id ? parseInt(String(item.id).substring(0, 13)) : 0) || Date.now();
                const d = new Date(itemTime);
                const dateStr = d.toLocaleDateString('vi-VN', {day:'2-digit', month:'2-digit'});
                // Gắn thêm ngày vào nội dung nếu chưa có
                const newContent = item.content.includes(`(${dateStr})`) ? item.content : `${item.content} (${dateStr})`;
                newItems.push({ ...item, content: newContent, id: Date.now().toString() + Math.random().toString(), createdAt: Date.now() });
                addCount++;
                addTotal += (item.price || 0);
            });
            
            newCusts[user] = {
                ...cust,
                items: newItems,
                pastItems: newPastItems,
                count: cust.count + addCount,
                total: cust.total + addTotal,
                lastTime: Date.now()
            };
            
            const now = Date.now();
            set(s => ({ [platform]: { ...s[platform], customers: newCusts, lastCustomersAt: now } }));
            localStorage.setItem(`slp_webapp_session_${platform}`, JSON.stringify(newCusts));
            pushData(platform, 'customers', newCusts, now);
        },
        deletePastItems: (platform, user, itemIndices) => {
            const state = get()[platform];
            const cust = state.customers[user];
            if (!cust || !cust.pastItems) return;
            const newCusts = { ...state.customers };
            const newPastItems = [...cust.pastItems];
            
            itemIndices.sort((a,b) => b - a).forEach(idx => {
                newPastItems.splice(idx, 1);
            });
            
            newCusts[user] = {
                ...cust,
                pastItems: newPastItems,
                lastTime: Date.now()
            };
            
            const now = Date.now();
            set(s => ({ [platform]: { ...s[platform], customers: newCusts, lastCustomersAt: now } }));
            localStorage.setItem(`slp_webapp_session_${platform}`, JSON.stringify(newCusts));
            pushData(platform, 'customers', newCusts, now);
        },
                clearShippedPastItems: (platform, rawUser) => {
            const user = normalizeUser(rawUser);
            if (!user) return;
            const state = get()[platform];
            const cust = state.customers[user];
            if (!cust) return;
            const newCusts = { ...state.customers };
            const now = Date.now();
            newCusts[user] = {
                ...cust,
                pastItems: []
            };
            set(s => ({ [platform]: { ...s[platform], customers: newCusts, lastCustomersAt: now } }));
            localStorage.setItem(`slp_webapp_session_${platform}`, JSON.stringify(newCusts));
            pushData(platform, 'customers', newCusts, now);
        },
        archiveCustomerItems: (platform, rawUser) => {
            const user = normalizeUser(rawUser);
            if (!user) return;
            const state = get()[platform];
            const cust = state.customers[user];
            if (!cust) return;
            const newCusts = { ...state.customers };
            const now = Date.now();
            const currentItems = cust.items || [];
            const existingPast = cust.pastItems || [];
            const archivedItems = currentItems.map(it => ({
                ...it,
                createdAt: it.createdAt || cust.lastTime || now,
                shipped: true
            }));
            newCusts[user] = {
                ...cust,
                count: 0,
                total: 0,
                lastTime: now,
                items: [],
                pastItems: [...existingPast, ...archivedItems]
            };
            set(s => ({ [platform]: { ...s[platform], customers: newCusts, lastCustomersAt: now } }));
            localStorage.setItem(`slp_webapp_session_${platform}`, JSON.stringify(newCusts));
            pushData(platform, 'customers', newCusts, now);
        },
        deleteOrderItem: (platform, user, itemIndex, isPast = false) => {
            const state = get()[platform];
            const newCusts = { ...state.customers };
            const cust = newCusts[user];
            if (!cust) return;
            
            let removedCommentId: string | null = null;
            if (isPast) {
                const newPast = [...(cust.pastItems || [])];
                if (!newPast[itemIndex]) return;
                newPast.splice(itemIndex, 1);
                newCusts[user] = { ...cust, pastItems: newPast, lastTime: Date.now() };
            } else {
                if (!cust.items || !cust.items[itemIndex]) return;
                const removed = cust.items[itemIndex];
                removedCommentId = removed.sourceCommentId;
                const newItems = [...(cust.items || [])];
                newItems.splice(itemIndex, 1);
                
                let newCount = cust.count - 1;
                let newTotal = cust.total - (removed.price || 0);
                if (newCount < 0) newCount = 0;
                if (newTotal < 0) newTotal = 0;
                
                newCusts[user] = { ...cust, count: newCount, total: newTotal, items: newItems, lastTime: Date.now() };
            }
            
            const now = Date.now();
            set(s => ({ [platform]: { ...s[platform], customers: newCusts, lastCustomersAt: now } }));
            localStorage.setItem(`slp_webapp_session_${platform}`, JSON.stringify(newCusts));
            pushData(platform, 'customers', newCusts, now);
            if (!isPast && removedCommentId) {
                get().unmarkPrinted(platform, removedCommentId);
            }
        },

        resetSession: () => {
            const now = Date.now();
            const platforms: Platform[] = ['tiktok', 'facebook', 'shopee'];
            
            let totalRev = 0;
            let totalOrd = 0;
            let newCust = 0;
            let retCust = 0;
            platforms.forEach(p => {
                const custs = get()[p].customers;
                Object.entries(custs).forEach(([user, data]) => {
                    const c = data as CustomerData;
                    if (c.count > 0) {
                        totalRev += c.total;
                        totalOrd += c.count;
                        if (get()[p].tags[user] === 'VIP') retCust++;
                        else newCust++;
                    }
                });
            });
            
            if (totalOrd > 0) {
                const entry = {
                    id: now.toString(),
                    date: new Date().toISOString(),
                    totalRevenue: totalRev,
                    totalOrders: totalOrd,
                    newCustomers: newCust,
                    returningCustomers: retCust
                };
                set(s => {
                    const newHistory = [entry, ...s.history].slice(0, 30);
                    localStorage.setItem('slp_webapp_history', JSON.stringify(newHistory));
                    return { history: newHistory };
                });
            }

            platforms.forEach(p => {
                const state = get()[p];
                const newCusts = { ...state.customers };
                const newTags = { ...state.tags };
                let tagsChanged = false;

                Object.keys(newCusts).forEach(name => {
                    const cust = newCusts[name];
                    const currentItems = cust.items || [];
                    const existingPastItems = cust.pastItems || [];

                    // Reconcile items to ensure no orders are lost when archiving
                    let itemsToArchive = currentItems.map(it => ({
                        ...it,
                        createdAt: it.createdAt || cust.lastTime || now
                    }));

                    if (cust.count > itemsToArchive.length || cust.total > itemsToArchive.reduce((s, it) => s + (it.price || 0), 0)) {
                        const currentSum = itemsToArchive.reduce((s, it) => s + (it.price || 0), 0);
                        const diffCount = Math.max(0, cust.count - itemsToArchive.length);
                        const diffPrice = Math.max(0, cust.total - currentSum);
                        const avgPrice = diffCount > 0 ? Math.round(diffPrice / diffCount) : diffPrice;
                        for (let i = 0; i < diffCount; i++) {
                            itemsToArchive.push({
                                id: `${now}_archive_${i}`,
                                content: `Đơn đã chốt (${avgPrice}k)`,
                                price: avgPrice,
                                sourceCommentId: null,
                                createdAt: cust.lastTime || now,
                                shipped: false
                            });
                        }
                    }

                    // Keep past items safely for at least 60 days
                    const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;
                    const mergedPastItems = [...existingPastItems, ...itemsToArchive].filter(item => {
                        const t = item.createdAt || (item.id ? parseInt(String(item.id).substring(0, 13)) : 0) || cust.lastTime || now;
                        return t >= sixtyDaysAgo;
                    });

                    newCusts[name] = { 
                        count: 0, 
                        total: 0, 
                        lastTime: now, 
                        items: [],
                        pastItems: mergedPastItems
                    };
                    
                    if (newTags[name] === 'COC' || newTags[name] === 'COC_100') {
                        newTags[name] = 'VIP';
                        tagsChanged = true;
                    }
                });
                
                set(s => ({ [p]: { ...s[p], comments: [], customers: newCusts, printed: {}, pinned: {}, lastCommentsAt: now, lastCustomersAt: now, lastPrintedAt: now, lastPinnedAt: now, ...(tagsChanged ? { tags: newTags, lastTagsAt: now } : {}) } }));
                localStorage.setItem(`slp_webapp_session_${p}`, JSON.stringify(newCusts));
                localStorage.setItem(`slp_webapp_printed_${p}`, JSON.stringify({}));
                localStorage.setItem(`slp_webapp_pinned_${p}`, JSON.stringify({}));
                if (tagsChanged) localStorage.setItem(`slp_webapp_tags_${p}`, JSON.stringify(newTags));
                
                pushData(p, 'comments', [], now);
                pushData(p, 'customers', newCusts, now);
                pushData(p, 'printed', {}, now);
                pushData(p, 'pinned', {}, now);
                if (tagsChanged) pushData(p, 'tags', newTags, now);
            });
        },

        clearFeed: (targetPlatform?: Platform) => {
            const now = Date.now();
            const platforms: Platform[] = targetPlatform ? [targetPlatform] : ['tiktok', 'facebook', 'shopee'];

            if (!targetPlatform) {
                setGlobalFeedClearedAt(now);
            }

            platforms.forEach(p => {
                setFeedClearedAt(p, now);
                set(s => ({ [p]: { ...s[p], comments: [], lastCommentsAt: now } }));
                const room = PLATFORMS[p].room;

                // Xoá trực tiếp Firebase RTDB cho phòng này
                fbPut(`rooms/${room}/comments`, { data: [], updatedAt: now, clearedAt: now, deviceId: DEVICE_ID }).catch(() => {});
                fbPut(`rooms/${room}/cleared_at`, { clearedAt: now, updatedAt: now, deviceId: DEVICE_ID }).catch(() => {});
                // Gửi tín hiệu xoá feed đến Armbian TV box qua target_channel
                fbPut(`rooms/${room}/target_channel`, { action: "clear_feed", clearedAt: now, requestedAt: now }).catch(() => {});
            });

            try {
                localStorage.setItem('slp_webapp_last_reset', new Date().toLocaleDateString('en-GB'));
            } catch {}

            // Kích hoạt xoá cache bình luận trên backend server (SSE và API status)
            try {
                const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
                fetch(`${baseUrl}/api/tiktok/clear-comments`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ clearedAt: now, platform: targetPlatform || 'all' })
                }).catch(() => {});
                fetch(`${baseUrl}/api/facebook/clear-comments`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ clearedAt: now, platform: targetPlatform || 'all' })
                }).catch(() => {});
            } catch {}
        },

        addComment: (platform: Platform, comment: CommentData) => {
            const now = Date.now();
            const commentTs = comment.ts || now;
            const effectiveClearedAt = getFeedClearedAt(platform);
            // Chỉ thêm comment của ngày hôm nay và mới hơn thời điểm xóa feed
            if (!isCommentFromToday(commentTs)) return;
            if (effectiveClearedAt > 0 && commentTs <= effectiveClearedAt) return;

            const state = get()[platform];
            const prev = (state.comments || []).filter(c => 
                isCommentFromToday(c.ts || 0) && (!effectiveClearedAt || (c.ts || 0) > effectiveClearedAt)
            );
            const cleanUser = normalizeUser(comment.user);
            const cleanContent = typeof comment.content === 'object' ? JSON.stringify(comment.content) : String(comment.content || '');
            const isDuplicate = prev.some(c => 
                (c.id && comment.id && c.id === comment.id) ||
                (normalizeUser(c.user).toLowerCase() === cleanUser.toLowerCase() &&
                 String(c.content || '').trim().toLowerCase() === cleanContent.trim().toLowerCase() &&
                 Math.abs((c.ts || 0) - commentTs) <= 20000)
            );
            if (isDuplicate) return;
            const cleanAvatar = comment.avatar || (typeof comment.user === 'object' && ((comment.user as any).profilePictureUrl || (comment.user as any).avatarThumb?.urlList?.[0])) || '';
            const normalizedComment: CommentData = {
                ...comment,
                user: cleanUser,
                content: cleanContent,
                avatar: cleanAvatar,
                ts: commentTs
            };
            const updated = [normalizedComment, ...prev].slice(0, 300);
            
            // TÍNH NĂNG FLOW GIÁ: Bắt giá tự động khi nick HOST gắn vương miện bình luận có giá
            const isHost = state.tags && state.tags[cleanUser] === 'HOST';
            let newFlowPrice = state.flowPrice;
            if (isHost) {
                const extracted = extractPriceFromContent(cleanContent);
                if (extracted.price && extracted.price.trim() !== '') {
                    newFlowPrice = {
                        price: extracted.price.trim(),
                        hostUser: cleanUser,
                        content: cleanContent,
                        ts: commentTs
                    };
                    try {
                        localStorage.setItem(`slp_webapp_flowprice_${platform}`, JSON.stringify(newFlowPrice));
                    } catch {}
                    pushData(platform, 'flow_price', newFlowPrice, now);
                }
            }

            set(s => ({ [platform]: { ...s[platform], comments: updated, lastCommentsAt: now, flowPrice: newFlowPrice } }));
            pushData(platform, 'comments', updated, now);
        }
    };
});
