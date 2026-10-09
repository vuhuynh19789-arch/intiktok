package com.example.model

import androidx.compose.ui.graphics.Color

enum class Platform(
    val id: String,
    val label: String,
    val room: String,
    val color: Color,
    val badgeColor: Color
) {
    TIKTOK("tiktok", "🎵 TikTok", "hienpham_live", Color(0xFF00F2EA), Color(0xFF111111)),
    FACEBOOK("facebook", "📘 Facebook", "hienpham_live_fb", Color(0xFF1877F2), Color(0xFF1877F2)),
    SHOPEE("shopee", "🛒 Shopee", "hienpham_live_shopee", Color(0xFFEE4D2D), Color(0xFFEE4D2D));

    companion object {
        fun fromId(id: String?): Platform = entries.find { it.id.equals(id, ignoreCase = true) } ?: TIKTOK
    }
}

enum class CustomerTag(
    val code: String,
    val label: String,
    val textColor: Color,
    val bgColor: Color,
    val borderColor: Color
) {
    NORMAL("NORMAL", "Thường", Color(0xFF9CA3AF), Color(0xFF374151), Color(0xFF4B5563)),
    VIP("VIP", "⭐ VIP", Color(0xFFFBBF24), Color(0xFF78350F), Color(0xFFD97706)),
    BOM("BOM", "💣 BOM", Color(0xFFF87171), Color(0xFF7F1D1D), Color(0xFFDC2626)),
    COC("COC", "💵 CỌC", Color(0xFF34D399), Color(0xFF064E3B), Color(0xFF059669)),
    COC_100("COC_100", "💵 CỌC 100K", Color(0xFF34D399), Color(0xFF065F46), Color(0xFF10B981)),
    DAO("DAO", "⚠️ DẠO", Color(0xFFFCD34D), Color(0xFF713F12), Color(0xFFCA8A04)),
    CHAN("CHAN", "⛔ CHẶN", Color(0xFFFCA5A5), Color(0xFF450A0A), Color(0xFF991B1B)),
    HOST("HOST", "👑 CHỦ LIVE", Color(0xFF67E8F9), Color(0xFF164E63), Color(0xFF0891B2)),
    GIU("GIU", "🔒 GIỮ HÀNG", Color(0xFFA78BFA), Color(0xFF4C1D95), Color(0xFF7C3AED));

    companion object {
        fun fromCode(code: String?): CustomerTag = entries.find { it.code.equals(code, ignoreCase = true) } ?: NORMAL
    }
}

data class OrderItem(
    val id: String,
    val content: String,
    val unitPrice: Int,
    val quantity: Int = 1,
    val price: Int = unitPrice * quantity,
    val sourceCommentId: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val isShipped: Boolean = false
)

data class Customer(
    val user: String,
    val platform: Platform = Platform.TIKTOK,
    val nickname: String = "",
    val tag: CustomerTag = CustomerTag.NORMAL,
    val pancakeLink: String = "",
    val count: Int = 0,
    val total: Int = 0,
    val lastTime: Long = System.currentTimeMillis(),
    val items: List<OrderItem> = emptyList(),
    val pastItems: List<OrderItem> = emptyList()
) {
    val totalQuantity: Int get() = items.sumOf { it.quantity }
    val totalRevenue: Int get() = items.sumOf { it.price }
}

data class CommentData(
    val id: String,
    val user: String,
    val content: String,
    val time: String,
    val avatar: String = "",
    val ts: Long = System.currentTimeMillis(),
    val platform: Platform = Platform.TIKTOK,
    val isPinned: Boolean = false,
    val extractedPrice: String? = null
)

data class FlowPrice(
    val price: String,
    val hostUser: String,
    val content: String,
    val ts: Long = System.currentTimeMillis()
)

data class LivePlatformStatus(
    val platform: Platform,
    val isConnected: Boolean = true,
    val viewerCount: Int = 0,
    val totalComments: Int = 0,
    val target: String = ""
)

data class SearchSuggestionItem(
    val user: String,
    val nickname: String = "",
    val shortId: String = "",
    val platform: Platform = Platform.TIKTOK,
    val tag: CustomerTag = CustomerTag.NORMAL,
    val count: Int = 0,
    val total: Int = 0,
    val lastTime: Long = 0L
)

data class SessionStats(
    val totalCount: Int,
    val totalRevenue: Int,
    val platformStats: Map<Platform, Pair<Int, Int>>, // Platform -> (Count, Revenue)
    val topCustomers: List<Customer>
)
