package com.example.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.model.LivePlatformStatus
import com.example.model.Platform
import com.example.model.SearchSuggestionItem
import com.example.ui.theme.*

@Composable
fun TopLiveHeader(
    totalUnits: Int,
    totalRevenueK: Int,
    searchQuery: String,
    onSearchChange: (String) -> Unit,
    activeTab: Int,
    suggestions: List<SearchSuggestionItem>,
    onSelectSuggestion: (SearchSuggestionItem) -> Unit,
    platformStatuses: Map<Platform, LivePlatformStatus>,
    onOpenMonitor: () -> Unit,
    onNavigateToCart: () -> Unit,
    onOpenMenu: () -> Unit,
    modifier: Modifier = Modifier
) {
    var isSearchFocused by remember { mutableStateOf(false) }

    val searchBadge = when (activeTab) {
        0 -> "💬 Chat Live" to AccentCyan
        1 -> "🛒 Giỏ hàng" to PrimaryBlue
        2 -> "👥 Khách hàng" to AccentEmerald
        3 -> "📊 Hiệu quả" to Color(0xFFA855F7)
        4 -> "✍️ Tạo mới" to AccentYellow
        else -> "🔍 Tìm kiếm" to TextGrayMuted
    }

    val searchHint = when (activeTab) {
        0 -> "Tìm nội dung cmt, tên khách trên Live... (hoặc /top10)"
        1 -> "Tìm giỏ hàng theo tên khách, #id, tên món..."
        2 -> "Tìm khách hàng theo tên, biệt danh, #id, SĐT..."
        3 -> "Tìm số liệu khách trong bảng hiệu quả..."
        4 -> "Nhập tên khách để tìm hoặc tạo mới..."
        else -> "Tìm kiếm..."
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(SurfaceDark)
            .border(width = 1.dp, color = BorderSubtle)
            .padding(horizontal = 12.dp, vertical = 8.dp)
    ) {
        // Top row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Left: Title + status dot + smart monitor chip
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = "Chốt Đơn",
                    fontWeight = FontWeight.Black,
                    fontSize = 17.sp,
                    color = TextWhite
                )

                // Realtime active dot
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(AccentEmerald)
                )

                // Smart Live Monitor mini badge
                val tikTokStatus = platformStatuses[Platform.TIKTOK]
                val fbStatus = platformStatuses[Platform.FACEBOOK]
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(CardDark)
                        .clickable { onOpenMonitor() }
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = "🎵 ${tikTokStatus?.viewerCount ?: 0}",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = AccentCyan
                    )
                    Text(text = "|", fontSize = 10.sp, color = TextGrayMuted)
                    Text(
                        text = "📘 ${fbStatus?.viewerCount ?: 0}",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = PrimaryBlueLight
                    )
                }
            }

            // Right: Summary badge & Menu button
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Cart summary
                Column(
                    modifier = Modifier
                        .clip(RoundedCornerShape(10.dp))
                        .background(CardDark)
                        .border(1.dp, BorderSubtle, RoundedCornerShape(10.dp))
                        .clickable { onNavigateToCart() }
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                        .testTag("header_cart_summary"),
                    horizontalAlignment = Alignment.End
                ) {
                    Text(
                        text = "TỔNG CHUNG",
                        fontSize = 8.5.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextGrayMuted
                    )
                    Text(
                        text = "$totalUnits cái | ${totalRevenueK}k",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Black,
                        color = TextWhite
                    )
                }

                // Menu button
                IconButton(
                    onClick = onOpenMenu,
                    modifier = Modifier
                        .size(36.dp)
                        .testTag("menu_more_button")
                ) {
                    Icon(
                        imageVector = Icons.Default.MoreVert,
                        contentDescription = "Menu tùy chọn",
                        tint = TextWhite
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Search Bar with Context Badge
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(CardDark)
                .border(1.dp, if (isSearchFocused) PrimaryBlue else BorderSubtle, RoundedCornerShape(12.dp))
                .padding(horizontal = 10.dp, vertical = 6.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                // Badge
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(searchBadge.second.copy(alpha = 0.2f))
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = searchBadge.first,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = searchBadge.second
                    )
                }

                BasicTextField(
                    value = searchQuery,
                    onValueChange = onSearchChange,
                    singleLine = true,
                    textStyle = MaterialTheme.typography.bodyMedium.copy(
                        color = TextWhite,
                        fontSize = 13.sp
                    ),
                    cursorBrush = SolidColor(PrimaryBlue),
                    modifier = Modifier
                        .weight(1f)
                        .testTag("search_text_input"),
                    decorationBox = { innerTextField ->
                        if (searchQuery.isEmpty()) {
                            Text(
                                text = searchHint,
                                fontSize = 12.sp,
                                color = TextGrayMuted
                            )
                        }
                        innerTextField()
                    }
                )

                if (searchQuery.isNotEmpty()) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Xóa tìm kiếm",
                        tint = TextGrayMuted,
                        modifier = Modifier
                            .size(16.dp)
                            .clickable { onSearchChange("") }
                    )
                } else {
                    Icon(
                        imageVector = Icons.Default.Search,
                        contentDescription = "Tìm",
                        tint = TextGrayMuted,
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
        }

        // Suggestions Dropdown
        AnimatedVisibility(visible = searchQuery.isNotEmpty() && suggestions.isNotEmpty()) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(CardHoverDark)
                    .border(1.dp, BorderSubtle, RoundedCornerShape(8.dp))
            ) {
                suggestions.forEach { item ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onSelectSuggestion(item) }
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(
                                text = "#${item.shortId}",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = PrimaryBlueLight
                            )
                            Text(
                                text = item.user,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = TextWhite
                            )
                            if (item.nickname.isNotEmpty()) {
                                Text(
                                    text = "(${item.nickname})",
                                    fontSize = 12.sp,
                                    color = TextGrayMuted
                                )
                            }
                        }
                        Text(
                            text = "${item.count} món | ${item.total}k",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = AccentYellow
                        )
                    }
                }
            }
        }
    }
}
