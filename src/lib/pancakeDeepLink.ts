/**
 * pancakeDeepLink.ts
 * Tiện ích hỗ trợ liên kết khách chốt đơn với Pancake & Zalo
 * Chuyển đổi và kích hoạt mở thẳng ứng dụng Pancake (vn.pancake.app) hoặc Zalo trên điện thoại
 */

export interface ParsedPancakeContact {
    type: 'pancake_url' | 'phone_zalo' | 'custom_url' | 'empty';
    raw: string;
    webUrl: string;
    mobileIntentUrl: string;
    iosSchemeUrl: string;
    zaloAppUrl?: string;
    phone?: string;
    conversationId?: string;
    pageId?: string;
    label: string;
}

/**
 * Kiểm tra xem thiết bị hiện tại có phải điện thoại (Android / iOS) hay không
 */
export function isMobileDevice(): boolean {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

export function isAndroidDevice(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /Android/i.test(navigator.userAgent || '');
}

export function isIOSDevice(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
}

/**
 * Tự động bóc tách (unwrap) các liên kết chuyển hướng trung gian
 * (như continue, redirect, Facebook l.php?u=, TikTok link?target=, Pancake redirect, v.v.)
 * để lấy trực tiếp URL đích cuối cùng, giảm độ trễ và tránh màn hình chờ trung gian.
 */
export function unwrapRedirectUrl(urlStr: string): string {
    if (!urlStr) return '';
    let current = urlStr.trim();
    
    // Lặp tối đa 5 lần để xử lý các redirect lồng nhau nếu có
    for (let i = 0; i < 5; i++) {
        try {
            // Giải mã URI nếu chuỗi bị encode (%3A%2F%2F)
            if (current.includes('%3A%2F%2F') || current.includes('%3a%2f%2f') || current.includes('%2F%2F')) {
                const decoded = decodeURIComponent(current);
                if (/^https?:\/\//i.test(decoded)) {
                    current = decoded;
                }
            }

            let urlObj: URL;
            if (/^https?:\/\//i.test(current)) {
                urlObj = new URL(current);
            } else if (current.includes('pages.fm') || current.includes('pancake.vn') || current.includes('pos.pages.fm')) {
                urlObj = new URL('https://' + current.replace(/^\/+/, ''));
            } else {
                break;
            }

            // Danh sách các tham số truy vấn chuyển hướng phổ biến
            const redirectParams = [
                'target', 'u', 'url', 'continue', 'dest', 'destination', 
                'redirect', 'redirect_uri', 'redirect_url', 'next', 'to', 'link', 'r'
            ];
            let foundTarget: string | null = null;

            for (const param of redirectParams) {
                const val = urlObj.searchParams.get(param);
                if (val) {
                    let decodedVal = val;
                    try { decodedVal = decodeURIComponent(val); } catch {}
                    if (/^https?:\/\//i.test(decodedVal) || decodedVal.includes('pages.fm') || decodedVal.includes('pancake.vn') || decodedVal.includes('zalo.me')) {
                        foundTarget = decodedVal;
                        break;
                    }
                }
            }

            // Quét tất cả query params nếu có chứa domain Pancake / Zalo
            if (!foundTarget) {
                for (const [_, val] of urlObj.searchParams.entries()) {
                    let decodedVal = val;
                    try { decodedVal = decodeURIComponent(val); } catch {}
                    if (decodedVal.includes('pages.fm') || decodedVal.includes('pancake.vn') || decodedVal.includes('pos.pages.fm')) {
                        if (!/^https?:\/\//i.test(decodedVal)) {
                            decodedVal = 'https://' + decodedVal.replace(/^https?:\/\//i, '');
                        }
                        foundTarget = decodedVal;
                        break;
                    }
                }
            }

            // Quét trong pathname dạng /continue/https://... hoặc /redirect/https://...
            if (!foundTarget) {
                const matchInPath = urlObj.pathname.match(/\/(?:continue|redirect|link|goto|out)\/(https?[:\/%].+)/i);
                if (matchInPath && matchInPath[1]) {
                    try {
                        foundTarget = decodeURIComponent(matchInPath[1]);
                    } catch {
                        foundTarget = matchInPath[1];
                    }
                }
            }

            if (foundTarget && foundTarget !== current) {
                current = foundTarget.trim();
            } else {
                break;
            }
        } catch {
            break;
        }
    }

    return current;
}

/**
 * Chuẩn hóa và nhận diện link Pancake hoặc Số điện thoại Zalo
 */
export function parsePancakeContact(input: string): ParsedPancakeContact {
    const rawInput = (input || '').trim();
    if (!rawInput) {
        return {
            type: 'empty',
            raw: '',
            webUrl: '',
            mobileIntentUrl: '',
            iosSchemeUrl: '',
            label: 'Chưa liên kết'
        };
    }

    // Tự động gỡ bỏ các wrapper trung gian redirect / continue
    const unwrapUrl = unwrapRedirectUrl(rawInput);
    const raw = unwrapUrl || rawInput;

    // 1. Kiểm tra nếu là Số điện thoại Việt Nam (Zalo)
    const cleanDigits = raw.replace(/\D/g, '');
    const isPhone = /^(0|\+?84)(3|5|7|8|9)\d{8}$/.test(raw.replace(/[\s\.\-]/g, '')) || 
                    (cleanDigits.length >= 10 && cleanDigits.length <= 11 && (cleanDigits.startsWith('0') || cleanDigits.startsWith('84')));

    if (isPhone) {
        let stdPhone = cleanDigits;
        if (stdPhone.startsWith('84')) {
            stdPhone = '0' + stdPhone.substring(2);
        }
        const webUrl = `https://zalo.me/${stdPhone}`;
        const zaloAppUrl = `zalo://chat?phone=${stdPhone}`;
        return {
            type: 'phone_zalo',
            raw,
            webUrl,
            mobileIntentUrl: zaloAppUrl,
            iosSchemeUrl: zaloAppUrl,
            zaloAppUrl,
            phone: stdPhone,
            label: `Zalo: ${stdPhone}`
        };
    }

    // 1b. Kiểm tra nếu là raw Conversation ID Zalo hoặc Facebook
    if (/^pzl_[ug]_[0-9]+_[0-9]+/.test(raw)) {
        const pzMatch = raw.match(/pzl_[ug]_([0-9]+)_/);
        const pId = pzMatch && pzMatch[1] ? `pzl_${pzMatch[1]}` : 'pzl_2007152536191688636';
        const webUrl = `https://pages.fm/${pId}/inbox?c_id=${raw}`;
        const iosSchemeUrl = `pancake://pages/${pId}/conversations/${raw}`;
        const mobileIntentUrl = `intent://pages.fm/${pId}/inbox?c_id=${raw}#Intent;scheme=https;package=vn.pancake.app;S.browser_fallback_url=${encodeURIComponent(webUrl)};end`;
        return {
            type: 'pancake_url',
            raw,
            webUrl,
            mobileIntentUrl,
            iosSchemeUrl,
            pageId: pId,
            conversationId: raw,
            label: `Zalo Chat #${raw.slice(-4)}`
        };
    }

    const rawFbMatch = raw.match(/^(?:fb_)?([0-9]{10,})_([0-9]{10,})$/);
    if (rawFbMatch) {
        const pId = rawFbMatch[1];
        const cId = `${rawFbMatch[1]}_${rawFbMatch[2]}`;
        const webUrl = `https://pages.fm/${pId}/inbox?c_id=${cId}`;
        const iosSchemeUrl = `pancake://pages/${pId}/conversations/${cId}`;
        const mobileIntentUrl = `intent://pages.fm/${pId}/inbox?c_id=${cId}#Intent;scheme=https;package=vn.pancake.app;S.browser_fallback_url=${encodeURIComponent(webUrl)};end`;
        return {
            type: 'pancake_url',
            raw,
            webUrl,
            mobileIntentUrl,
            iosSchemeUrl,
            pageId: pId,
            conversationId: cId,
            label: `FB Chat #${cId.slice(-4)}`
        };
    }

    // 2. Kiểm tra nếu là link Pancake (pages.fm / pancake.vn / pos.pages.fm)
    let webUrl = raw;
    if (!/^https?:\/\//i.test(webUrl)) {
        webUrl = 'https://' + webUrl;
    }

    let urlObj: URL | null = null;
    try {
        urlObj = new URL(webUrl);
    } catch {
        // Không thể parse URL, giữ nguyên
    }

    const host = urlObj ? urlObj.host.toLowerCase() : '';
    const pathname = urlObj ? urlObj.pathname : '';

    // Trích xuất Page ID & Conversation ID nếu có
    // Dạng 1: https://pancake.vn/<page_id>?c_id=<conversation_id>
    // Dạng 2: /<page_id>/conversations/<conversation_id>
    // Dạng 3: /conversations/<page_id>/<conversation_id>
    let pageId: string | undefined;
    let conversationId: string | undefined;

    if (urlObj) {
        const cIdQuery = urlObj.searchParams.get('c_id') || urlObj.searchParams.get('conversation_id');
        if (cIdQuery) {
            conversationId = cIdQuery;
            const segments = pathname.replace(/^\/+/, '').split('/');
            if (segments[0] && segments[0] !== 'pages' && segments[0] !== 'conversations') {
                pageId = segments[0];
            }
        }
        
        if (!pageId || !conversationId) {
            const convMatch = pathname.match(/\/?([^\/]+)\/conversations\/([^\/\?]+)/) ||
                              pathname.match(/\/conversations\/([^\/]+)\/([^\/\?]+)/);
            if (convMatch) {
                pageId = convMatch[1];
                conversationId = convMatch[2];
            }
        }
    }

    // Nếu có cả pageId và conversationId, chuẩn hóa sang link Pancake chính thức
    if (pageId && conversationId && (host.includes('pancake.vn') || host.includes('pages.fm'))) {
        webUrl = `https://pancake.vn/${pageId}?c_id=${conversationId}`;
    }

    // Chuẩn hóa Android Intent URL cho Pancake app: package = vn.pancake.app
    // Cú pháp Intent chuẩn: intent://<host_and_path>#Intent;scheme=https;package=vn.pancake.app;S.browser_fallback_url=<fallback>;end
    const hostAndPath = webUrl.replace(/^https?:\/\//i, '');
    const mobileIntentUrl = `intent://${hostAndPath}#Intent;scheme=https;package=vn.pancake.app;S.browser_fallback_url=${encodeURIComponent(webUrl)};end`;
    
    // Custom schemes cho iOS / Pancake
    const iosSchemeUrl = `pancake://${hostAndPath}`;

    const isPancake = host.includes('pages.fm') || host.includes('pancake.vn') || host.includes('pos.pages.fm');

    return {
        type: isPancake ? 'pancake_url' : 'custom_url',
        raw,
        webUrl,
        mobileIntentUrl,
        iosSchemeUrl,
        conversationId,
        pageId,
        label: isPancake ? (conversationId ? `Pancake #${conversationId.slice(-4)}` : 'Hội thoại Pancake') : 'Liên kết ngoài'
    };
}

/**
 * Kích hoạt mở hội thoại trên thiết bị:
 * - Trên điện thoại Android: Sử dụng Intent gọi thẳng app Pancake (vn.pancake.app) hoặc Zalo
 * - Trên iPhone: Sử dụng Universal link hoặc App Scheme, có fallback Web
 * - Trên Máy tính (PC): Mở tab web Pancake / Zalo bình thường
 */
export function openPancakeApp(input: string, openFallbackPrompt = false): void {
    const contact = parsePancakeContact(input);
    if (!contact.raw) return;

    // 1. Nếu là số điện thoại Zalo
    if (contact.type === 'phone_zalo') {
        if (isMobileDevice()) {
            // Thử mở app Zalo trước
            const now = Date.now();
            window.location.href = contact.zaloAppUrl!;
            // Nếu sau 1.2s vẫn ở trang này (chưa cài app Zalo), mở web Zalo
            setTimeout(() => {
                if (Date.now() - now < 2000) {
                    window.open(contact.webUrl, '_blank');
                }
            }, 1200);
        } else {
            window.open(contact.webUrl, '_blank');
        }
        return;
    }

    // 2. Nếu là máy tính (PC / Desktop): Mở web Pancake / pages.fm ngay trong tab mới
    if (!isMobileDevice()) {
        window.open(contact.webUrl, '_blank');
        return;
    }

    // 3. Nếu là điện thoại Android: Dùng Android Intent để gọi thẳng App Pancake (vn.pancake.app)
    if (isAndroidDevice()) {
        const intentUrl = contact.mobileIntentUrl;
        
        // Tạo thẻ a ẩn và kích hoạt click để đảm bảo Chrome xử lý Intent chuẩn
        const link = document.createElement('a');
        link.href = intentUrl;
        link.setAttribute('rel', 'noopener noreferrer');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Fallback: nếu app Pancake chưa được mở hoặc không có trên máy, mở qua web sau 1.5s
        const startTime = Date.now();
        setTimeout(() => {
            if (Date.now() - startTime < 2200 && document.visibilityState === 'visible') {
                // Người dùng vẫn đang nhìn thấy trang web -> có thể app chưa cài hoặc intent bị chặn
                if (openFallbackPrompt) {
                    window.open(contact.webUrl, '_blank');
                }
            }
        }, 1500);
        return;
    }

    // 4. Nếu là iPhone / iPad (iOS)
    if (isIOSDevice()) {
        // Thử mở qua custom scheme pancake://
        const startTime = Date.now();
        window.location.href = contact.iosSchemeUrl;

        // Nếu không có app Pancake, fallback sang web
        setTimeout(() => {
            if (Date.now() - startTime < 2000 && document.visibilityState === 'visible') {
                window.location.href = contact.webUrl;
            }
        }, 1200);
        return;
    }

    // Thiết bị khác
    window.open(contact.webUrl, '_blank');
}

/**
 * Trích xuất số điện thoại Việt Nam từ văn bản bình luận
 */
export function extractPhoneFromText(text: string): string | null {
    if (!text) return null;
    // Tìm các chuỗi SĐT có dạng 09xx, 03xx, 07xx, 08xx, 05xx, hoặc +84... (có thể chứa dấu chấm hoặc khoảng trắng)
    const match = text.match(/(?:(?:\+|00)?84|0)(?:3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])[0-9\s\.\-]{7,10}\b/);
    if (!match) return null;
    const clean = match[0].replace(/[\s\.\-]/g, '');
    if (clean.length >= 10 && clean.length <= 11) {
        if (clean.startsWith('84')) return '0' + clean.substring(2);
        if (clean.startsWith('+84')) return '0' + clean.substring(3);
        if (clean.startsWith('0084')) return '0' + clean.substring(4);
        return clean;
    }
    return null;
}
