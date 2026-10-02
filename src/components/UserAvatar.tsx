import React, { useState } from 'react';
import { Platform, PLATFORMS, normalizeUser } from '../lib/core';

interface CustomerAvatarProps {
    user: any;
    platform?: Platform;
    avatarUrl?: string | null;
    tag?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    showPlatformBadge?: boolean;
    className?: string;
    onClick?: (e: React.MouseEvent) => void;
}

const AVATAR_PALETTES = [
    { bg: 'bg-emerald-600', text: 'text-white' },
    { bg: 'bg-blue-600', text: 'text-white' },
    { bg: 'bg-purple-600', text: 'text-white' },
    { bg: 'bg-amber-600', text: 'text-white' },
    { bg: 'bg-rose-600', text: 'text-white' },
    { bg: 'bg-cyan-600', text: 'text-white' },
    { bg: 'bg-indigo-600', text: 'text-white' },
    { bg: 'bg-teal-600', text: 'text-white' },
];

export function getAvatarColor(user: any) {
    const cleanUser = normalizeUser(user);
    let hash = 0;
    for (let i = 0; i < cleanUser.length; i++) {
        hash = (hash << 5) - hash + cleanUser.charCodeAt(i);
        hash |= 0;
    }
    const index = Math.abs(hash) % AVATAR_PALETTES.length;
    return AVATAR_PALETTES[index];
}

export function getInitials(user: any) {
    const clean = normalizeUser(user).replace(/^[#@\s_]+/, '').trim();
    if (!clean) return '👤';
    const parts = clean.split(/[\s._-]+/).filter(Boolean);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return clean.substring(0, 2).toUpperCase();
}

export function getTagBorderClass(tag?: string) {
    switch (tag) {
        case 'VIP':
            return 'border-2 border-amber-400 ring-2 ring-amber-400/30';
        case 'COC':
            return 'border-2 border-cyan-400 ring-2 ring-cyan-400/30';
        case 'COC_100':
            return 'border-2 border-blue-400 ring-2 ring-blue-500/40';
        case 'DAO':
            return 'border-2 border-gray-400 ring-1 ring-gray-400/30';
        case 'BOM':
            return 'border-2 border-red-500 ring-2 ring-red-500/30';
        case 'CHAN':
            return 'border-2 border-red-700 ring-2 ring-red-800/40';
        case 'GIU':
            return 'border-2 border-amber-400 ring-2 ring-amber-500/40';
        default:
            return 'border-2 border-white/20';
    }
}

export const CustomerAvatar: React.FC<CustomerAvatarProps> = ({
    user,
    platform,
    avatarUrl,
    tag = 'NORMAL',
    size = 'md',
    showPlatformBadge = true,
    className = '',
    onClick
}) => {
    const [imgError, setImgError] = useState(false);

    const sizeClasses = {
        sm: 'w-7 h-7 text-[10px]',
        md: 'w-10 h-10 text-xs',
        lg: 'w-12 h-12 text-sm',
        xl: 'w-20 h-20 text-2xl'
    }[size];

    const palette = getAvatarColor(user);
    const initials = getInitials(user);
    const borderClass = getTagBorderClass(tag);
    const isLarge = size === 'lg' || size === 'xl';

    const hasValidImage = !!avatarUrl && !imgError;

    return (
        <div 
            onClick={onClick}
            className={`relative shrink-0 select-none pb-1 ${onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''} ${className}`}
        >
            {/* Main Avatar Circle */}
            <div className={`${sizeClasses} rounded-full overflow-hidden flex items-center justify-center font-black ${borderClass} shadow-md transition-all ${hasValidImage ? 'bg-[#0e1621]' : `${palette.bg} ${palette.text}`}`}>
                {hasValidImage ? (
                    <img 
                        src={avatarUrl} 
                        alt={normalizeUser(user)} 
                        onError={() => setImgError(true)} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                    />
                ) : (
                    <span>{initials}</span>
                )}
            </div>

            {/* Tag Badge at Top-Right Corner (VIP Crown, Water Drop for Cọc, etc.) */}
            {tag === 'VIP' && (
                <span 
                    className={`absolute -top-1.5 -right-1 z-20 font-black rounded-full flex items-center justify-center shadow-lg border border-amber-200 bg-gradient-to-tr from-amber-500 to-orange-500 text-white ${
                        isLarge ? 'text-[10px] px-1.5 py-0.5' : 'text-[8px] px-1 py-[0.5px]'
                    }`}
                    title="Khách quen (VIP)"
                >
                    👑 VIP
                </span>
            )}
            {tag === 'COC' && (
                <span 
                    className={`absolute -top-1.5 -right-1 z-20 font-black rounded-full flex items-center justify-center shadow-lg border border-cyan-200 bg-gradient-to-tr from-cyan-500 to-blue-600 text-white ${
                        isLarge ? 'w-5 h-5 text-[11px]' : 'w-4 h-4 text-[9px]'
                    }`}
                    title="Đã cọc 50k"
                >
                    💧
                </span>
            )}
            {tag === 'COC_100' && (
                <span 
                    className={`absolute -top-1.5 -right-1 z-20 font-black rounded-full flex items-center justify-center shadow-lg border border-blue-200 bg-gradient-to-tr from-blue-600 to-indigo-700 text-white ${
                        isLarge ? 'px-1.5 py-0.5 text-[9px]' : 'px-1 py-[0.5px] text-[7.5px]'
                    }`}
                    title="Đã cọc 100k"
                >
                    💧100k
                </span>
            )}
            {tag === 'DAO' && (
                <span 
                    className={`absolute -top-1.5 -right-1 z-20 font-black rounded-full flex items-center justify-center shadow-lg border border-gray-400 bg-gray-700 text-white ${
                        isLarge ? 'w-5 h-5 text-[11px]' : 'w-4 h-4 text-[9px]'
                    }`}
                    title="Khách dạo"
                >
                    👻
                </span>
            )}
            {tag === 'BOM' && (
                <span 
                    className={`absolute -top-1.5 -right-1 z-20 font-black rounded-full flex items-center justify-center shadow-lg border border-red-300 bg-red-600 text-white ${
                        isLarge ? 'w-5 h-5 text-[11px]' : 'w-4 h-4 text-[9px]'
                    }`}
                    title="Khách BOM"
                >
                    ⚠️
                </span>
            )}
            {tag === 'CHAN' && (
                <span 
                    className={`absolute -top-1.5 -right-1 z-20 font-black rounded-full flex items-center justify-center shadow-lg border border-red-500 bg-black text-red-400 ${
                        isLarge ? 'w-5 h-5 text-[11px]' : 'w-4 h-4 text-[9px]'
                    }`}
                    title="Đã chặn"
                >
                    ⛔
                </span>
            )}
            {tag === 'GIU' && (
                <span 
                    className={`absolute -top-1.5 -right-1 z-20 font-black rounded-full flex items-center justify-center shadow-lg border border-amber-300 bg-gradient-to-tr from-amber-500 to-orange-600 text-white ${
                        isLarge ? 'px-1.5 py-0.5 text-[9px]' : 'px-1 py-[0.5px] text-[7.5px]'
                    }`}
                    title="Đang giữ hàng"
                >
                    📦
                </span>
            )}

            {/* Platform Badge positioned BELOW the avatar (Centered) */}
            {showPlatformBadge && platform && PLATFORMS[platform] && (
                <span 
                    className={`absolute -bottom-1 left-1/2 -translate-x-1/2 z-20 text-[8px] px-1 py-[0.5px] rounded-full text-white font-black border border-[#0e1621] leading-none shadow-md whitespace-nowrap ${PLATFORMS[platform].bgClass}`}
                    title={PLATFORMS[platform].label}
                >
                    {PLATFORMS[platform].label}
                </span>
            )}
        </div>
    );
};
