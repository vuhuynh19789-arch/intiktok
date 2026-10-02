import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { fbGet, fbPut, firebaseDb, FIREBASE_URL } from '../lib/core';
import { ref, onValue } from 'firebase/database';
import { Bot, Sparkles, Check, RefreshCw, Zap, Copy, CheckCheck, Terminal, Play, Square, ExternalLink, ShieldCheck, AlertCircle } from 'lucide-react';
import { triggerRemoteBrowserReload } from '../lib/tiktokLiveClient';

export interface AutoCommentConfig {
    comments: string;
    minDelay: number;
    maxDelay: number;
    isRunning: boolean;
    autoThankDeposit?: boolean;
    thankDepositTemplate?: string;
    autoStartOnLoad?: boolean;
    autoReloadOnStreamRestart?: boolean;
}

export const DEFAULT_THANK_DEPOSIT_TEMPLATE = 'thanks {name} nha';

export function useAutoComment() {
    const store = useStore();
    const [config, setConfig] = useState<AutoCommentConfig>(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('slp_autocomment') || '{}');
            const savedThankEnabled = localStorage.getItem('slp_auto_thank_deposit');
            const savedThankTpl = localStorage.getItem('slp_thank_deposit_template');
            const savedAutoStart = localStorage.getItem('slp_auto_start_on_load');
            const savedAutoReload = localStorage.getItem('slp_auto_reload_on_stream_restart');

            const hasComments = typeof saved.comments === 'string' && saved.comments.trim().length > 0;
            const autoStart = savedAutoStart !== null ? savedAutoStart !== 'false' : true;
            const isRunningInitial = (saved.isRunning === true || autoStart) && hasComments;

            return {
                comments: saved.comments || '',
                minDelay: saved.minDelay || 5,
                maxDelay: saved.maxDelay || 15,
                isRunning: isRunningInitial,
                autoThankDeposit: savedThankEnabled !== null ? savedThankEnabled !== 'false' : true,
                thankDepositTemplate: savedThankTpl || DEFAULT_THANK_DEPOSIT_TEMPLATE,
                autoStartOnLoad: autoStart,
                autoReloadOnStreamRestart: savedAutoReload !== null ? savedAutoReload !== 'false' : true,
            };
        } catch {
            return { 
                comments: '', 
                minDelay: 5, 
                maxDelay: 15, 
                isRunning: false,
                autoThankDeposit: true,
                thankDepositTemplate: DEFAULT_THANK_DEPOSIT_TEMPLATE,
                autoStartOnLoad: true,
                autoReloadOnStreamRestart: true,
            };
        }
    });

    const queueRef = useRef<number[]>([]);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const saveConfig = (newConfig: Partial<AutoCommentConfig>) => {
        setConfig(prev => {
            const next = { ...prev, ...newConfig };
            try {
                localStorage.setItem('slp_autocomment', JSON.stringify({
                    comments: next.comments,
                    minDelay: next.minDelay,
                    maxDelay: next.maxDelay,
                    isRunning: next.isRunning,
                }));
                if (next.autoThankDeposit !== undefined) {
                    localStorage.setItem('slp_auto_thank_deposit', String(next.autoThankDeposit));
                }
                if (next.thankDepositTemplate !== undefined) {
                    localStorage.setItem('slp_thank_deposit_template', next.thankDepositTemplate);
                }
                if (next.autoStartOnLoad !== undefined) {
                    localStorage.setItem('slp_auto_start_on_load', String(next.autoStartOnLoad));
                }
                if (next.autoReloadOnStreamRestart !== undefined) {
                    localStorage.setItem('slp_auto_reload_on_stream_restart', String(next.autoReloadOnStreamRestart));
                }

                // sync to firebase
                fbPut('settings/autocomment', {
                    comments: next.comments,
                    minDelay: next.minDelay,
                    maxDelay: next.maxDelay,
                    isRunning: next.isRunning,
                    autoThankDeposit: next.autoThankDeposit,
                    thankDepositTemplate: next.thankDepositTemplate,
                    autoStartOnLoad: next.autoStartOnLoad,
                    autoReloadOnStreamRestart: next.autoReloadOnStreamRestart
                }).catch(() => {});
            } catch (e) {}
            return next;
        });
    };

    // Sync settings from Firebase
    useEffect(() => {
        let mounted = true;
        const unsubscribe = onValue(ref(firebaseDb, 'settings/autocomment'), (snapshot) => {
            if (!mounted) return;
            const data = snapshot.val();
            if (data) {
                setConfig(prev => {
                    const newComments = data.comments ?? prev.comments;
                    const newMinDelay = data.minDelay ?? prev.minDelay;
                    const newMaxDelay = data.maxDelay ?? prev.maxDelay;
                    const newThank = data.autoThankDeposit ?? prev.autoThankDeposit;
                    const newTpl = data.thankDepositTemplate ?? prev.thankDepositTemplate;
                    const newAutoStart = data.autoStartOnLoad ?? prev.autoStartOnLoad;
                    const newAutoReload = data.autoReloadOnStreamRestart ?? prev.autoReloadOnStreamRestart;

                    // If remote configured auto-running
                    const newRunning = data.isRunning !== undefined ? data.isRunning : prev.isRunning;

                    if (
                        prev.comments !== newComments || 
                        prev.minDelay !== newMinDelay || 
                        prev.maxDelay !== newMaxDelay ||
                        prev.autoThankDeposit !== newThank ||
                        prev.thankDepositTemplate !== newTpl ||
                        prev.autoStartOnLoad !== newAutoStart ||
                        prev.autoReloadOnStreamRestart !== newAutoReload ||
                        prev.isRunning !== newRunning
                    ) {
                        if (newThank !== undefined) localStorage.setItem('slp_auto_thank_deposit', String(newThank));
                        if (newTpl !== undefined) localStorage.setItem('slp_thank_deposit_template', newTpl);
                        if (newAutoStart !== undefined) localStorage.setItem('slp_auto_start_on_load', String(newAutoStart));
                        if (newAutoReload !== undefined) localStorage.setItem('slp_auto_reload_on_stream_restart', String(newAutoReload));
                        
                        return { 
                            ...prev, 
                            comments: newComments, 
                            minDelay: newMinDelay, 
                            maxDelay: newMaxDelay, 
                            autoThankDeposit: newThank,
                            thankDepositTemplate: newTpl,
                            autoStartOnLoad: newAutoStart,
                            autoReloadOnStreamRestart: newAutoReload,
                            isRunning: newRunning
                        };
                    }
                    return prev;
                });
            }
        });
        return () => { mounted = false; unsubscribe(); };
    }, []);

    // Lắng nghe tín hiệu Live lại và tín hiệu Reload browser từ Server
    useEffect(() => {
        const handleReloadEvent = () => {
            console.log('[AutoComment] 🔄 Đã nhận lệnh Reload! Làm mới hàng đợi bình luận...');
            queueRef.current = [];
            if (config.autoStartOnLoad && config.comments.trim().length > 0 && !config.isRunning) {
                setConfig(prev => ({ ...prev, isRunning: true }));
            }
        };

        window.addEventListener('tiktok_live_reload_browser', handleReloadEvent);
        return () => {
            window.removeEventListener('tiktok_live_reload_browser', handleReloadEvent);
        };
    }, [config.autoStartOnLoad, config.comments, config.isRunning]);

    // Loop execution
    useEffect(() => {
        if (!config.isRunning) {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            return;
        }

        let isCancelled = false;
        const lines = config.comments.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        if (lines.length === 0) {
            saveConfig({ isRunning: false });
            return;
        }

        const scheduleNext = () => {
            if (isCancelled) return;
            
            if (queueRef.current.length === 0) {
                // refill and shuffle
                const indices = Array.from({ length: lines.length }, (_, i) => i);
                for (let i = indices.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [indices[i], indices[j]] = [indices[j], indices[i]];
                }
                queueRef.current = indices;
            }

            const nextIndex = queueRef.current.shift()!;
            const content = lines[nextIndex];
            
            store.repostComment('tiktok', content);
            
            const delayMs = Math.floor(Math.random() * (config.maxDelay - config.minDelay + 1) + config.minDelay) * 1000;
            timeoutRef.current = setTimeout(scheduleNext, delayMs);
        };

        // Chạy lần đầu ngay khi kích hoạt
        scheduleNext();

        return () => {
            isCancelled = true;
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [config.isRunning, config.comments, config.minDelay, config.maxDelay]);

    return { config, saveConfig };
}

export function AutoCommentModal({ 
    config, 
    saveConfig, 
    onClose 
}: { 
    config: AutoCommentConfig; 
    saveConfig: (c: Partial<AutoCommentConfig>) => void; 
    onClose: () => void;
}) {
    const [activeTab, setActiveTab] = useState<'thank_deposit' | 'auto_loop' | 'auto_f5'>('auto_f5');
    const [templateInput, setTemplateInput] = useState(config.thankDepositTemplate || DEFAULT_THANK_DEPOSIT_TEMPLATE);
    const [isSendingF5, setIsSendingF5] = useState(false);
    const [f5SuccessMsg, setF5SuccessMsg] = useState('');
    const [hasCopiedScript, setHasCopiedScript] = useState(false);
    const [hasCopiedConsole, setHasCopiedConsole] = useState(false);

    const PRESET_TEMPLATES = [
        'thanks {name} nha',
        'cảm ơn {name} đã cọc nha ❤️',
        'Dạ em nhận cọc của {name} rồi nha! 🥰',
        'thanks {name} đã cọc đơn ạ 🎉',
    ];

    const previewName = 'chị yên';
    const previewMessage = (templateInput || DEFAULT_THANK_DEPOSIT_TEMPLATE).replace(/\{name\}|\{user\}|\{nick\}|\{ten\}/gi, previewName);

    const handleSendF5Now = async () => {
        setIsSendingF5(true);
        setF5SuccessMsg('');
        try {
            const res = await triggerRemoteBrowserReload('tiktok', 'manual_trigger');
            if (res.success) {
                setF5SuccessMsg('✅ Đã phát lệnh Auto F5 đến toàn bộ trình duyệt & TV Box thành công!');
                setTimeout(() => setF5SuccessMsg(''), 4000);
            }
        } catch (e: any) {
            setF5SuccessMsg('❌ Lỗi khi gửi lệnh: ' + (e.message || 'Thất bại'));
        } finally {
            setIsSendingF5(false);
        }
    };

    // Chuẩn UserScript Tampermonkey & F12 Console Script v3.5 (Siêu Cào Bình Luận DOM 0ms + Firebase Realtime + Auto F5 + Auto CMT)
    const BROWSER_RUNNER_SCRIPT = `// ==UserScript==
// @name         TikTok Live Super Scraper & Auto F5 Bot
// @namespace    https://hienpham-live.app/
// @version      3.5
// @description  Siêu cào bình luận TikTok Live trực tiếp từ trình duyệt 0ms, tự động đẩy về App Chốt Đơn & Auto F5
// @match        *://*.tiktok.com/*
// @match        *://tiktok.com/*
// @include      *://*.tiktok.com/*
// @include      *://tiktok.com/*
// @connect      *
// @connect      firebasedatabase.app
// @connect      *.firebasedatabase.app
// @connect      caotiktok.home79.cloud
// @connect      *.home79.cloud
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

(function() {
  'use strict';
  const ROOM = "hienpham_live";
  const DB_COMMENTS_ENDPOINTS = [
    "https://spry-shade-365302-default-rtdb.asia-southeast1.firebasedatabase.app/rooms/" + ROOM + "/comments.json",
    "https://hienpham-live-default-rtdb.asia-southeast1.firebasedatabase.app/rooms/" + ROOM + "/comments.json"
  ];
  const DB_COMMAND_ENDPOINTS = [
    "https://spry-shade-365302-default-rtdb.asia-southeast1.firebasedatabase.app/rooms/" + ROOM + "/refreshCommand.json",
    "https://spry-shade-365302-default-rtdb.asia-southeast1.firebasedatabase.app/rooms/" + ROOM + "/reloadBrowserCommand.json",
    "https://hienpham-live-default-rtdb.asia-southeast1.firebasedatabase.app/rooms/" + ROOM + "/refreshCommand.json",
    "https://hienpham-live-default-rtdb.asia-southeast1.firebasedatabase.app/rooms/" + ROOM + "/reloadBrowserCommand.json"
  ];
  const DB_REPLY_ENDPOINTS = [
    "https://spry-shade-365302-default-rtdb.asia-southeast1.firebasedatabase.app/rooms/" + ROOM + "/replyCommand.json",
    "https://hienpham-live-default-rtdb.asia-southeast1.firebasedatabase.app/rooms/" + ROOM + "/replyCommand.json"
  ];

  console.log("%c⚡ [TikTok Super-Scraper v3.5] Khởi động bộ cào bình luận trực tiếp & Auto F5...", "background:#111; color:#00f2ea; font-size:14px; font-weight:bold; padding:4px 8px; border-radius:4px;");

  function sendHttpRequest(url, method = 'GET', data = null) {
    return new Promise((resolve) => {
      const gmXhr = (typeof GM_xmlhttpRequest !== 'undefined') ? GM_xmlhttpRequest : 
                    (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest : null;
      if (gmXhr) {
        try {
          gmXhr({
            method: method,
            url: url + (method === 'GET' ? (url.includes('?') ? '&' : '?') + '_t=' + Date.now() : ''),
            headers: { 
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache, no-store'
            },
            data: data ? JSON.stringify(data) : undefined,
            timeout: 5000,
            onload: function(res) {
              try {
                if (res.status >= 200 && res.status < 300) {
                  resolve(JSON.parse(res.responseText));
                } else {
                  resolve(null);
                }
              } catch(e) { resolve(null); }
            },
            onerror: function() { resolve(null); },
            ontimeout: function() { resolve(null); }
          });
          return;
        } catch(e) {}
      }

      fetch(url + (method === 'GET' ? (url.includes('?') ? '&' : '?') + '_t=' + Date.now() : ''), {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: data ? JSON.stringify(data) : undefined,
        cache: 'no-store'
      })
      .then(r => r.json())
      .then(resolve)
      .catch(() => resolve(null));
    });
  }

  // Floating Status HUD
  let hudEl = null;
  let totalScrapedCount = 0;
  function createFloatingHud() {
    if (document.getElementById('tt-autocmt-hud')) return;
    hudEl = document.createElement('div');
    hudEl.id = 'tt-autocmt-hud';
    hudEl.style.cssText = 'position:fixed;bottom:14px;left:14px;z-index:999999;background:rgba(15,23,42,0.92);border:1px solid rgba(0,242,234,0.6);border-radius:12px;padding:6px 14px;font-family:sans-serif;font-size:11px;color:#f8fafc;box-shadow:0 8px 24px rgba(0,0,0,0.6);display:flex;align-items:center;gap:10px;backdrop-filter:blur(8px);pointer-events:auto;';
    
    hudEl.innerHTML = \`
      <span id="tt-hud-dot" style="width:8px;height:8px;border-radius:50%;background:#10b981;box-shadow:0 0 10px #10b981;display:inline-block;animation:pulse 1.5s infinite;"></span>
      <span id="tt-hud-text" style="font-weight:700;color:#00f2ea;">🟢 ĐANG CÀO LIVE: <b id="tt-hud-count">0</b> CMT</span>
      <button id="tt-hud-f5btn" style="background:#3b82f6;border:none;color:#fff;border-radius:6px;padding:3px 8px;font-size:10px;font-weight:700;cursor:pointer;">F5 Lại</button>
    \`;
    document.body.appendChild(hudEl);

    document.getElementById('tt-hud-f5btn')?.addEventListener('click', () => {
      window.location.reload();
    });
  }

  function setHudStatus(text, color, dotColor) {
    createFloatingHud();
    const textEl = document.getElementById('tt-hud-text');
    const dotEl = document.getElementById('tt-hud-dot');
    if (textEl) {
      textEl.innerHTML = text;
      if (color) textEl.style.color = color;
    }
    if (dotEl && dotColor) {
      dotEl.style.background = dotColor;
      dotEl.style.boxShadow = '0 0 10px ' + dotColor;
    }
  }

  function updateHudScrapedCount(count) {
    createFloatingHud();
    const countEl = document.getElementById('tt-hud-count');
    if (countEl) countEl.innerText = String(count);
  }

  setTimeout(createFloatingHud, 1000);

  // ====================================================
  // PHẦN 1: SIÊU CÀO BÌNH LUẬN TRỰC TIẾP TỪ DOM (0ms)
  // ====================================================
  const processedCommentHashes = new Set();
  const collectedComments = [];
  let syncDebounce = null;
  let directBroadcast = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      directBroadcast = new BroadcastChannel('tiktok_live_direct_feed');
    }
  } catch(e) {}

  function normalizeCommentUser(u) {
    if (!u) return 'Khách';
    return String(u).trim().replace(/^@/, '');
  }

  function broadcastAndSyncComment(commentItem) {
    totalScrapedCount++;
    updateHudScrapedCount(totalScrapedCount);

    // 1. Gửi qua BroadcastChannel (0ms cho tab web app mở cùng trình duyệt)
    if (directBroadcast) {
      try {
        directBroadcast.postMessage(commentItem);
      } catch(e) {}
    }

    // 2. Gửi qua Storage Event
    try {
      localStorage.setItem('slp_direct_comment_tiktok', JSON.stringify(commentItem));
    } catch(e) {}

    // 3. Đưa vào hàng đợi sync lên Firebase Realtime Database
    collectedComments.unshift(commentItem);
    if (collectedComments.length > 150) collectedComments.pop();

    if (!syncDebounce) {
      syncDebounce = setTimeout(async () => {
        syncDebounce = null;
        for (const url of DB_COMMENTS_ENDPOINTS) {
          try {
            await sendHttpRequest(url, 'PUT', {
              data: collectedComments.slice(0, 150),
              updatedAt: Date.now(),
              deviceId: 'browser_tampermonkey_v3.5'
            });
          } catch(err) {}
        }
      }, 150);
    }
  }

  function extractCommentFromElement(el) {
    if (!el || el.nodeType !== 1) return null;
    
    // Bỏ qua các tin nhắn hệ thống (like, vào phòng, chia sẻ, tặng quà)
    const textAll = (el.innerText || el.textContent || '').trim();
    if (!textAll) return null;
    if (textAll.includes('đã tham gia') || textAll.includes('joined') || textAll.includes('đã thích') || textAll.includes('liked the LIVE') || textAll.includes('đã chia sẻ') || textAll.includes('shared the LIVE') || textAll.includes('đã gửi') || textAll.includes('sent a')) {
      return null;
    }

    // Tìm tên người dùng
    let userEl = el.querySelector('[data-e2e="comment-username"]') || 
                 el.querySelector('span[class*="SpanUsername"]') || 
                 el.querySelector('span[class*="SpanNickname"]') || 
                 el.querySelector('span[class*="username"]') || 
                 el.querySelector('span[class*="nickname"]') ||
                 el.querySelector('a[href*="/@"]') ||
                 el.querySelector('strong') ||
                 el.querySelector('b');
    
    let username = userEl ? (userEl.innerText || userEl.textContent || '').trim() : '';
    let commentText = '';

    // Tìm nội dung comment
    let textEl = el.querySelector('[data-e2e="comment-text"]') || 
                 el.querySelector('span[class*="SpanCommentText"]') || 
                 el.querySelector('span[class*="SpanText"]') || 
                 el.querySelector('span[class*="comment-text"]') ||
                 el.querySelector('div[class*="text"]');
                 
    if (textEl) {
      commentText = (textEl.innerText || textEl.textContent || '').trim();
    } else if (username && textAll.startsWith(username)) {
      commentText = textAll.substring(username.length).replace(/^[:\s\-]+/, '').trim();
    } else {
      commentText = textAll;
    }

    if (!commentText) return null;
    if (!username) username = 'Khách';

    username = normalizeCommentUser(username);
    const hash = username.toLowerCase() + ':::' + commentText.toLowerCase();
    
    // Chống cào trùng lặp
    if (processedCommentHashes.has(hash)) return null;
    processedCommentHashes.add(hash);
    if (processedCommentHashes.size > 2000) {
      const firstEntry = processedCommentHashes.values().next().value;
      processedCommentHashes.delete(firstEntry);
    }

    // Tìm avatar
    let imgEl = el.querySelector('img[src*="tiktokcdn"]') || el.querySelector('img');
    let avatarUrl = imgEl ? (imgEl.getAttribute('src') || '') : '';

    const now = new Date();
    const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ':' + String(now.getSeconds()).padStart(2, '0');

    return {
      id: 'tt_dom_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      user: username,
      nickname: username,
      uniqueId: username,
      content: commentText,
      comment: commentText,
      time: timeStr,
      avatar: avatarUrl,
      ts: Date.now(),
      platform: 'tiktok'
    };
  }

  function scanChatContainer() {
    const chatItems = document.querySelectorAll(
      '[data-e2e="chat-message"], div[class*="DivCommentItemContainer"], div[class*="DivItemContainer"], div[class*="ChatMessage"], div[class*="tiktok-webcast-chat-item"], div[class*="chat-item"], div[class*="webcast-chat"]'
    );
    chatItems.forEach((itemEl) => {
      const parsed = extractCommentFromElement(itemEl);
      if (parsed) {
        console.log("%c💬 [Live Scraper][" + parsed.user + "]: " + parsed.content, "color: #00f2ea; font-weight: bold;");
        broadcastAndSyncComment(parsed);
      }
    });
  }

  // Khởi chạy MutationObserver giám sát tin nhắn mới xuất hiện
  function initCommentObserver() {
    const targetNode = document.body;
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) {
            const parsed = extractCommentFromElement(node);
            if (parsed) {
              console.log("%c💬 [Live Scraper][" + parsed.user + "]: " + parsed.content, "color: #00f2ea; font-weight: bold;");
              broadcastAndSyncComment(parsed);
            }
            // Quét các node con bên trong
            if (node.querySelectorAll) {
              const children = node.querySelectorAll('[data-e2e="chat-message"], div[class*="DivCommentItemContainer"], div[class*="DivItemContainer"], div[class*="ChatMessage"], div[class*="chat-item"]');
              children.forEach(cNode => {
                const cParsed = extractCommentFromElement(cNode);
                if (cParsed) {
                  broadcastAndSyncComment(cParsed);
                }
              });
            }
          }
        }
      }
    });

    observer.observe(targetNode, { childList: true, subtree: true });
    // Backup polling mỗi 400ms phòng trường hợp DOM không kích hoạt mutation
    setInterval(scanChatContainer, 400);
  }

  setTimeout(initCommentObserver, 1500);

  // ====================================================
  // PHẦN 2: TỰ ĐỘNG F5 KHI LIVE LẠI HOẶC NHẬN LỆNH TỪ XA
  // ====================================================
  let lastRefreshId = "";
  try {
    lastRefreshId = (typeof GM_getValue !== 'undefined' ? GM_getValue('last_f5_id') : null) || 
                    sessionStorage.getItem('last_f5_id') || 
                    localStorage.getItem('last_f5_id') || "";
  } catch(e) {}

  let isReloading = false;
  function doForceReload(cmdId, source) {
    if (isReloading) return;
    isReloading = true;
    lastRefreshId = cmdId;
    try {
      if (typeof GM_setValue !== 'undefined') GM_setValue('last_f5_id', cmdId);
      sessionStorage.setItem('last_f5_id', cmdId);
      localStorage.setItem('last_f5_id', cmdId);
    } catch(e) {}

    console.log("%c🔄 [Auto F5] NHẬN LỆNH F5 TỪ " + source + "! ĐANG TẢI LẠI TRANG...", "background: #ff0050; color: #fff; font-size: 15px; font-weight: bold; padding: 4px 8px;");
    setHudStatus("🔄 NHẬN LỆNH F5! ĐANG TẢI LẠI...", "#f59e0b", "#f59e0b");

    setTimeout(() => {
      try {
        window.location.reload(true);
      } catch(e) {
        window.location.reload();
      }
      setTimeout(() => {
        try {
          const u = new URL(window.location.href);
          u.searchParams.set('_f5', Date.now().toString());
          window.location.href = u.toString();
        } catch(e) {
          window.location.href = window.location.href;
        }
      }, 300);
    }, 150);
  }

  // Lắng nghe BroadcastChannel & Storage Event
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('tiktok_f5_channel');
      bc.onmessage = (ev) => {
        if (ev.data && ev.data.commandId && ev.data.commandId !== lastRefreshId) {
          doForceReload(ev.data.commandId, "BroadcastChannel");
        }
      };
    }
  } catch(e) {}

  window.addEventListener('storage', (e) => {
    if (e.key === 'tiktok_f5_trigger' && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed && parsed.commandId && parsed.commandId !== lastRefreshId) {
          doForceReload(parsed.commandId, "StorageEvent");
        }
      } catch(err) {}
    }
  });

  // Vòng lặp lắng nghe lệnh Auto F5 từ xa qua Firebase
  setInterval(async () => {
    if (isReloading) return;
    for (const url of DB_COMMAND_ENDPOINTS) {
      try {
        const data = await sendHttpRequest(url);
        if (data && data.commandId) {
          if (!lastRefreshId) {
            const age = Date.now() - (data.updatedAt || 0);
            if (Math.abs(age) > 15000) {
              lastRefreshId = data.commandId;
              try {
                if (typeof GM_setValue !== 'undefined') GM_setValue('last_f5_id', lastRefreshId);
                sessionStorage.setItem('last_f5_id', lastRefreshId);
                localStorage.setItem('last_f5_id', lastRefreshId);
              } catch(e) {}
              continue;
            }
          }

          if (data.commandId !== lastRefreshId) {
            const age = Date.now() - (data.updatedAt || 0);
            if (Math.abs(age) < 120000 || !data.updatedAt) {
              doForceReload(data.commandId, "Firebase RTDB");
              return;
            } else {
              lastRefreshId = data.commandId;
            }
          }
        }
      } catch (e) {}
    }
  }, 1000);

  // ====================================================
  // PHẦN 3: TỰ ĐỘNG GÕ & ĐĂNG BÌNH LUẬN MỒI / CẢM ƠN CỌC
  // ====================================================
  let lastReplyId = "";
  setInterval(async () => {
    if (isReloading) return;
    for (const url of DB_REPLY_ENDPOINTS) {
      try {
        const data = await sendHttpRequest(url);
        if (data && data.commandId && data.commandId !== lastReplyId) {
          const age = Date.now() - (data.updatedAt || 0);
          if (Math.abs(age) < 60000 && data.content) {
            lastReplyId = data.commandId;
            console.log("%c💬 [AutoCMT] Đang gõ bình luận:", "color: #00f2ea;", data.content);
            setHudStatus("💬 Đang gõ: " + data.content.substring(0, 20) + "...", "#00f2ea", "#00f2ea");
            postTikTokComment(data.content);
            return;
          }
        }
      } catch (e) {}
    }
  }, 1000);

  // Tự động kiểm tra nếu màn hình báo "Phiên LIVE đã kết thúc"
  let endLiveCounter = 0;
  setInterval(() => {
    if (isReloading) return;
    const isLiveEnded = document.body.innerText.includes('Phiên LIVE đã kết thúc') || 
                        document.body.innerText.includes('LIVE đã kết thúc') || 
                        document.body.innerText.includes('LIVE ended') ||
                        Boolean(document.querySelector('[data-e2e="live-end-container"]'));
    if (isLiveEnded) {
      endLiveCounter++;
      setHudStatus("⏳ Live đã kết thúc (Sẵn sàng F5)", "#f43f5e", "#f43f5e");
      if (endLiveCounter >= 25) {
        endLiveCounter = 0;
        console.log("🔄 [Auto-Recovery] Tự động tải lại trang sau khi live kết thúc để đón phiên mới...");
        window.location.reload();
      }
    } else {
      endLiveCounter = 0;
    }
  }, 1000);

  function postTikTokComment(text) {
    try {
      const input = document.querySelector('div[contenteditable="true"]') || 
                    document.querySelector('textarea') || 
                    document.querySelector('[data-e2e="comment-input"]') ||
                    document.querySelector('input[placeholder*="bình luận" i]') ||
                    document.querySelector('input[placeholder*="comment" i]');
      if (!input) {
        console.warn("⚠️ Không tìm thấy khung chat TikTok trên trang!");
        return;
      }
      input.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, text);
      
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));

      setTimeout(() => {
        const sendBtn = document.querySelector('button[data-e2e="comment-post"]') || 
                        document.querySelector('button[type="submit"]') ||
                        document.querySelector('.comment-send-btn') ||
                        document.querySelector('button[aria-label*="Send" i]');
        if (sendBtn && !sendBtn.disabled) {
          sendBtn.click();
          console.log("✅ Đã bấm nút gửi bình luận thành công!");
          setTimeout(() => setHudStatus("🟢 ĐANG CÀO LIVE: <b id='tt-hud-count'>" + totalScrapedCount + "</b> CMT", "#00f2ea", "#10b981"), 2000);
        } else {
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
          setTimeout(() => setHudStatus("🟢 ĐANG CÀO LIVE: <b id='tt-hud-count'>" + totalScrapedCount + "</b> CMT", "#00f2ea", "#10b981"), 2000);
        }
      }, 350);
    } catch (err) {
      console.error("Lỗi khi gửi cmt:", err);
    }
  }
})();`;

    const handleCopyScript = () => {
        navigator.clipboard.writeText(BROWSER_RUNNER_SCRIPT);
        setHasCopiedScript(true);
        setTimeout(() => setHasCopiedScript(false), 2500);
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4">
            <div className="bg-[#1c242f] rounded-2xl w-full max-w-[540px] overflow-hidden flex flex-col max-h-[92vh] shadow-2xl border border-white/10">
                {/* Header */}
                <div className="p-3.5 border-b border-white/10 flex justify-between items-center bg-[#131d2a]">
                    <div className="flex items-center gap-2">
                        <Bot size={18} className="text-[#00f2ea]" />
                        <h3 className="font-bold text-white text-sm m-0">Tự Động Bình Luận & Auto F5</h3>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 text-gray-300 font-bold flex items-center justify-center hover:bg-white/20 cursor-pointer transition-colors">✕</button>
                </div>

                {/* Tabs */}
                <div className="grid grid-cols-3 p-1.5 bg-[#0e1621] border-b border-white/5 gap-1 text-center">
                    <button
                        type="button"
                        onClick={() => setActiveTab('auto_f5')}
                        className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer truncate ${
                            activeTab === 'auto_f5'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <span>🔄 Auto F5 & Cài Đặt</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('thank_deposit')}
                        className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer truncate ${
                            activeTab === 'thank_deposit'
                                ? 'bg-cyan-600 text-white shadow-sm'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <span>💧 Cảm Ơn Cọc</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('auto_loop')}
                        className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer truncate ${
                            activeTab === 'auto_loop'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <span>🤖 Auto Mồi</span>
                        {config.isRunning && <span className="w-2 h-2 rounded-full bg-green-400 animate-ping shrink-0"></span>}
                    </button>
                </div>
                
                <div className="p-4 flex-1 overflow-y-auto space-y-4">
                    {activeTab === 'auto_f5' ? (
                        <>
                            {/* Auto F5 & Live Restart Configurations */}
                            <div className="space-y-3">
                                {/* Option 1: Tự động kích hoạt ngay khi mở web */}
                                <div className="p-3 bg-[#0e1621] border border-indigo-500/30 rounded-xl flex items-center justify-between">
                                    <div className="space-y-0.5 pr-2">
                                        <div className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                                            <Zap size={14} className="text-amber-400" />
                                            <span>⚡ Kích hoạt Auto CMT ngay khi vào Web</span>
                                        </div>
                                        <p className="text-[11px] text-gray-400 leading-snug">
                                            Tự động chạy bình luận mồi ngay khi load/mở trang web mà không cần bấm thủ công.
                                        </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                        <input
                                            type="checkbox"
                                            checked={config.autoStartOnLoad !== false}
                                            onChange={(e) => saveConfig({ autoStartOnLoad: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                                    </label>
                                </div>

                                {/* Option 2: Tự động gửi lệnh F5 khi Live lại */}
                                <div className="p-3 bg-[#0e1621] border border-blue-500/30 rounded-xl flex items-center justify-between">
                                    <div className="space-y-0.5 pr-2">
                                        <div className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                                            <RefreshCw size={14} className="text-cyan-400" />
                                            <span>🔄 Tự động F5 Trình duyệt cmt khi Live lại</span>
                                        </div>
                                        <p className="text-[11px] text-gray-400 leading-snug">
                                            Khi shop bật lại phiên Live mới, app tự gửi lệnh F5 đến trình duyệt đang cắm bot để tải live mới và cmt lại ngay.
                                        </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                        <input
                                            type="checkbox"
                                            checked={config.autoReloadOnStreamRestart !== false}
                                            onChange={(e) => saveConfig({ autoReloadOnStreamRestart: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                                    </label>
                                </div>

                                {/* Nút Gửi lệnh Auto F5 ngay */}
                                <div className="p-3.5 bg-gradient-to-r from-indigo-950/80 to-purple-950/80 border border-indigo-500/50 rounded-xl space-y-2.5 shadow-md">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                                <RefreshCw size={14} className={isSendingF5 ? 'animate-spin text-indigo-400' : 'text-indigo-400'} />
                                                <span>Lệnh Ép Tải Lại (F5) Tức Thì:</span>
                                            </div>
                                            <div className="text-[11px] text-gray-300">
                                                Gửi lệnh F5 qua Firebase & SSE cho toàn bộ máy/tab đang mở
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleSendF5Now}
                                            disabled={isSendingF5}
                                            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-black cursor-pointer transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center gap-1.5 shrink-0 border border-white/20"
                                        >
                                            {isSendingF5 ? <RefreshCw size={13} className="animate-spin" /> : <Zap size={13} className="text-yellow-300 fill-yellow-300" />}
                                            <span>GỬI LỆNH F5 NGAY</span>
                                        </button>
                                    </div>
                                    {f5SuccessMsg && (
                                        <div className="text-xs text-emerald-300 font-semibold bg-emerald-950/80 p-2.5 rounded-lg border border-emerald-500/40 flex items-center gap-2 animate-fadeIn">
                                            <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
                                            <span>{f5SuccessMsg}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Hướng dẫn chi tiết nếu trình duyệt chưa F5 */}
                                <div className="p-3 bg-gradient-to-br from-amber-950/40 to-slate-900 border border-amber-500/40 rounded-xl space-y-2 text-xs text-amber-200/90">
                                    <div className="font-bold flex items-center gap-1.5 text-amber-300">
                                        <AlertCircle size={15} className="text-amber-400 shrink-0" />
                                        <span>3 Bước Để Trình Duyệt Nhận Lệnh F5 Tức Thì:</span>
                                    </div>
                                    <div className="space-y-1.5 text-[11px] leading-relaxed text-gray-300">
                                        <div className="flex items-start gap-1.5">
                                            <span className="bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-bold">1</span>
                                            <span>Bấm nút <strong>SAO CHÉP SCRIPT (v3.1)</strong> bên dưới.</span>
                                        </div>
                                        <div className="flex items-start gap-1.5">
                                            <span className="bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-bold">2</span>
                                            <span>Mở <strong>Tampermonkey</strong> trên trình duyệt đang mở TikTok Live, dán đè lên script cũ và bấm <strong>Lưu (Save)</strong>.</span>
                                        </div>
                                        <div className="flex items-start gap-1.5">
                                            <span className="bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-bold">3</span>
                                            <span>F5 lại trang TikTok 1 lần: Bạn sẽ thấy huy hiệu <code className="text-emerald-400 font-bold">🟢 Auto F5 & CMT: SẴN SÀNG</code> ở góc dưới màn hình. Lúc này bấm <strong>GỬI LỆNH F5 NGAY</strong> là trang TikTok sẽ tự động tải lại ngay lập tức!</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Script Runner Code cho Trình duyệt TikTok */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-gray-300 flex items-center gap-1">
                                            <Terminal size={13} className="text-emerald-400" />
                                            <span>Mã Script Tampermonkey / Console F12 (Bản v3.1 Mới Nhất):</span>
                                        </label>
                                        <button
                                            type="button"
                                            onClick={handleCopyScript}
                                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all shadow-md active:scale-95"
                                        >
                                            {hasCopiedScript ? <CheckCheck size={14} className="text-white" /> : <Copy size={14} />}
                                            <span>{hasCopiedScript ? 'ĐÃ SAO CHÉP!' : 'SAO CHÉP SCRIPT (v3.1)'}</span>
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <pre className="p-3 bg-[#0a0f16] border border-white/10 rounded-xl text-[10px] text-emerald-400 font-mono overflow-x-auto max-h-36 leading-tight select-all">
                                            {BROWSER_RUNNER_SCRIPT}
                                        </pre>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : activeTab === 'thank_deposit' ? (
                        <>
                            {/* Toggle Feature */}
                            <div className="p-3 bg-[#0e1621] border border-cyan-500/20 rounded-xl flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <div className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                                        <span>💧 Tự động cảm ơn khi gắn tag Cọc</span>
                                    </div>
                                    <p className="text-[11px] text-gray-400 leading-snug">
                                        Khi bấm chọn tag <strong>💧 Cọc</strong>, bot tự động nhảy bình luận cảm ơn tên nick trên Live.
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                                    <input
                                        type="checkbox"
                                        checked={config.autoThankDeposit !== false}
                                        onChange={(e) => saveConfig({ autoThankDeposit: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                                </label>
                            </div>

                            {/* Template Input */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-gray-300">
                                    Mẫu câu cảm ơn cọc:
                                </label>
                                <div className="relative">
                                    <input 
                                        type="text"
                                        className="w-full p-2.5 bg-[#0e1621] text-white placeholder-gray-400 border border-cyan-500/30 rounded-xl text-sm focus:outline-none focus:border-cyan-400 font-semibold shadow-inner"
                                        placeholder="thanks {name} nha"
                                        value={templateInput}
                                        onChange={(e) => {
                                             setTemplateInput(e.target.value);
                                             saveConfig({ thankDepositTemplate: e.target.value });
                                        }}
                                    />
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-gray-400 pt-0.5">
                                    <span>Biến thay thế: <code className="text-cyan-300 font-bold bg-white/5 px-1 py-0.5 rounded">{"{name}"}</code> hoặc <code className="text-cyan-300 font-bold bg-white/5 px-1 py-0.5 rounded">{"{user}"}</code></span>
                                </div>
                            </div>

                            {/* Preset Buttons */}
                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                    Gợi ý mẫu nhanh:
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                    {PRESET_TEMPLATES.map((tpl) => (
                                        <button
                                            key={tpl}
                                            type="button"
                                            onClick={() => {
                                                setTemplateInput(tpl);
                                                saveConfig({ thankDepositTemplate: tpl });
                                            }}
                                            className={`p-2 rounded-lg text-left text-xs font-medium border transition-all flex items-center justify-between ${
                                                templateInput === tpl
                                                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-sm'
                                                    : 'bg-[#0e1621] border-white/5 text-gray-300 hover:bg-white/5 hover:border-white/20'
                                            }`}
                                        >
                                            <span className="truncate">{tpl}</span>
                                            {templateInput === tpl && <Check size={13} className="text-cyan-400 shrink-0 ml-1" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Live Preview Box */}
                            <div className="p-3 bg-[#0e1621] border border-white/10 rounded-xl space-y-1.5 shadow-sm">
                                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                    <Sparkles size={12} className="text-amber-400" />
                                    <span>Xem trước khi khách "{previewName}" cọc:</span>
                                </div>
                                <div className="p-2.5 bg-cyan-950/40 border border-cyan-500/30 rounded-lg flex items-center gap-2 text-xs">
                                    <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-[10px] shrink-0">
                                        🤖
                                    </span>
                                    <span className="text-cyan-200 font-semibold">
                                        {previewMessage}
                                    </span>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Auto Loop Periodic Comments */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="block text-sm font-bold text-gray-300">Danh sách bình luận mồi (mỗi dòng 1 câu):</label>
                                    <span className="text-xs text-gray-400 font-medium">
                                        {config.comments.split('\n').filter(l => l.trim().length > 0).length} câu
                                    </span>
                                </div>
                                <textarea 
                                    className="w-full h-28 p-2.5 bg-[#0e1621] text-white placeholder-gray-400 border border-white/20 rounded-xl text-sm focus:outline-none focus:border-blue-500 font-medium leading-relaxed"
                                    placeholder="siêu phẩm cả nhà ơi&#10;chốt nhanh kẻo hết ạ&#10;cú pháp mã + sđt nhé"
                                    value={config.comments}
                                    onChange={e => saveConfig({ comments: e.target.value })}
                                />
                            </div>
                            
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-gray-300 mb-1">Chờ tối thiểu (giây):</label>
                                    <input 
                                        type="number" 
                                        min="1"
                                        className="w-full p-2.5 bg-[#0e1621] text-white placeholder-gray-400 border border-white/20 rounded-xl font-bold focus:outline-none focus:border-blue-500 text-sm"
                                        value={config.minDelay}
                                        onChange={e => saveConfig({ minDelay: Math.max(1, parseInt(e.target.value) || 1) })}
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-gray-300 mb-1">Chờ tối đa (giây):</label>
                                    <input 
                                        type="number" 
                                        min="1"
                                        className="w-full p-2.5 bg-[#0e1621] text-white placeholder-gray-400 border border-white/20 rounded-xl font-bold focus:outline-none focus:border-blue-500 text-sm"
                                        value={config.maxDelay}
                                        onChange={e => saveConfig({ maxDelay: Math.max(config.minDelay, parseInt(e.target.value) || config.minDelay) })}
                                    />
                                </div>
                            </div>
                            
                            {/* Trạng thái hoạt động */}
                            <div className={`p-3 rounded-xl border flex items-center justify-between ${
                                config.isRunning 
                                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' 
                                    : 'bg-[#0e1621] border-white/10 text-gray-400'
                            }`}>
                                <div className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${config.isRunning ? 'bg-emerald-400 animate-ping' : 'bg-gray-500'}`} />
                                    <div>
                                        <div className="text-xs font-bold text-white">
                                            {config.isRunning ? 'Bot Đang Chạy Bình Luận Tự Động' : 'Bot Đang Tạm Dừng'}
                                        </div>
                                        <div className="text-[11px] opacity-80">
                                            {config.isRunning ? `Đang gửi mồi ngẫu nhiên sau mỗi ${config.minDelay}-${config.maxDelay}s` : 'Bấm nút Bắt Đầu bên dưới để kích hoạt'}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => saveConfig({ isRunning: !config.isRunning })}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all shadow-sm ${
                                        config.isRunning 
                                            ? 'bg-red-600 hover:bg-red-500 text-white' 
                                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                    }`}
                                >
                                    {config.isRunning ? '🛑 Dừng' : '▶️ Bắt Đầu'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
                
                {/* Footer */}
                <div className="p-3 border-t border-white/10 flex gap-2 shrink-0 bg-[#131d2a]">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 rounded-xl font-bold text-white text-sm cursor-pointer shadow-md transition-all active:scale-98"
                    >
                        ✓ Hoàn Tất & Đóng
                    </button>
                </div>
            </div>
        </div>
    );
}
