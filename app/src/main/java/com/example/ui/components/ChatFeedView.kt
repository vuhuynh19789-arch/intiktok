package com.example.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.model.*
import com.example.ui.theme.*
import com.example.util.PriceUtils

@Composable
fun ChatFeedView(
    comments: List<CommentData>,
    customers: Map<String, Customer>,
    pinnedMap: Map<String, Long>,
    flowPrice: FlowPrice?,
    selectedPlatform: Platform?,
    onSelectPlatform: (Platform?) -> Unit,
    onPinComment: (Platform, String) -> Unit,
    onQuickCloseOrder: (CommentData) -> Unit,
    onOpenProfile: (Customer) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier.fillMaxSize().background(BgDark)) {
        // Platform Filter Row
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FilterChip(
                selected = selectedPlatform == null,
                onClick = { onSelectPlatform(null) },
                label = { Text("Tất cả", fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = PrimaryBlue,
                    selectedLabelColor = TextWhite,
                    containerColor = CardDark,
                    labelColor = TextGrayMuted
                ),
                border = null,
                modifier = Modifier.testTag("filter_all")
            )

            Platform.entries.forEach { p ->
                FilterChip(
                    selected = selectedPlatform == p,
                    onClick = { onSelectPlatform(if (selectedPlatform == p) null else p) },
                    label = { Text(p.label, fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = p.color.copy(alpha = 0.3f),
                        selectedLabelColor = p.color,
                        containerColor = CardDark,
                        labelColor = TextGrayMuted
                    ),
                    border = null,
                    modifier = Modifier.testTag("filter_${p.id}")
                )
            }
        }

        // Host Flow Price Bar
        if (flowPrice != null) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 4.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(Color(0xFF0F2B48))
                    .border(1.dp, PrimaryBlue, RoundedCornerShape(10.dp))
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(text = "👑", fontSize = 16.sp)
                    Column {
                        Text(
                            text = "GIÁ GHIM PHIÊN: ${flowPrice.price}k",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Black,
                            color = AccentCyan
                        )
                        if (flowPrice.content.isNotEmpty()) {
                            Text(
                                text = flowPrice.content,
                                fontSize = 11.sp,
                                color = TextGrayLight,
                                maxLines = 1
                            )
                        }
                    }
                }

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(AccentEmerald)
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "Áp dụng",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = BgDark
                    )
                }
            }
        }

        // Feed List
        if (comments.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(text = "💬", fontSize = 36.sp)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Chưa có bình luận nào trên phiên live",
                        fontSize = 14.sp,
                        color = TextGrayMuted
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                contentPadding = PaddingValues(vertical = 8.dp)
            ) {
                items(comments, key = { it.id }) { comment ->
                    val cust = customers[comment.user]
                    val isPinned = pinnedMap.containsKey(comment.id)

                    CommentItemCard(
                        comment = comment,
                        customer = cust,
                        isPinned = isPinned,
                        flowPrice = flowPrice,
                        onPin = { onPinComment(comment.platform, comment.id) },
                        onQuickClose = { onQuickCloseOrder(comment) },
                        onOpenProfile = {
                            val c = cust ?: Customer(
                                user = comment.user,
                                platform = comment.platform
                            )
                            onOpenProfile(c)
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun CommentItemCard(
    comment: CommentData,
    customer: Customer?,
    isPinned: Boolean,
    flowPrice: FlowPrice?,
    onPin: () -> Unit,
    onQuickClose: () -> Unit,
    onOpenProfile: () -> Unit,
    modifier: Modifier = Modifier
) {
    val tag = customer?.tag ?: CustomerTag.NORMAL
    val shortId = PriceUtils.getShortId(comment.user)
    val hasExtractedPrice = !comment.extractedPrice.isNullOrEmpty()

    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(if (isPinned) Color(0xFF1E293B) else CardDark)
            .border(
                width = 1.dp,
                color = if (isPinned) AccentYellow else BorderSubtle,
                shape = RoundedCornerShape(12.dp)
            )
            .padding(10.dp)
            .testTag("comment_item_${comment.id}")
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            // Header: User, ID, Tag, Time, Platform
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    // Avatar placeholder circle
                    Box(
                        modifier = Modifier
                            .size(30.dp)
                            .clip(CircleShape)
                            .background(comment.platform.color.copy(alpha = 0.2f))
                            .clickable { onOpenProfile() },
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = comment.user.take(1).uppercase(),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = comment.platform.color
                        )
                    }

                    Column {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Text(
                                text = comment.user,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextWhite,
                                modifier = Modifier.clickable { onOpenProfile() }
                            )

                            Text(
                                text = "#$shortId",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = PrimaryBlueLight
                            )

                            if (tag != CustomerTag.NORMAL) {
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(4.dp))
                                        .background(tag.bgColor)
                                        .border(1.dp, tag.borderColor, RoundedCornerShape(4.dp))
                                        .padding(horizontal = 4.dp, vertical = 1.dp)
                                ) {
                                    Text(
                                        text = tag.label,
                                        fontSize = 8.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = tag.textColor
                                    )
                                }
                            }
                        }

                        if (!customer?.nickname.isNullOrEmpty()) {
                            Text(
                                text = customer.nickname,
                                fontSize = 10.sp,
                                color = TextGrayMuted
                            )
                        }
                    }
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = comment.time,
                        fontSize = 10.sp,
                        color = TextGrayMuted
                    )

                    // Platform badge
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(4.dp))
                            .background(comment.platform.badgeColor)
                            .padding(horizontal = 4.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = comment.platform.label,
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            color = comment.platform.color
                        )
                    }
                }
            }

            // Comment text
            Text(
                text = comment.content,
                fontSize = 13.sp,
                color = TextWhite,
                modifier = Modifier.padding(start = 36.dp)
            )

            // Action row: Extracted price / Quick Close / Pin
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 36.dp, top = 2.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Price pill
                if (hasExtractedPrice) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(AccentEmerald.copy(alpha = 0.2f))
                            .border(1.dp, AccentEmerald, RoundedCornerShape(6.dp))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = "Giá: ${comment.extractedPrice}k",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Black,
                            color = AccentEmerald
                        )
                    }
                } else if (flowPrice != null) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(AccentCyan.copy(alpha = 0.15f))
                            .border(1.dp, AccentCyan.copy(alpha = 0.5f), RoundedCornerShape(6.dp))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = "Phiên: ${flowPrice.price}k",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = AccentCyan
                        )
                    }
                } else {
                    Spacer(modifier = Modifier.width(1.dp))
                }

                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Pin button
                    IconButton(
                        onClick = onPin,
                        modifier = Modifier.size(28.dp)
                    ) {
                        Icon(
                            imageVector = if (isPinned) Icons.Default.Star else Icons.Default.StarBorder,
                            contentDescription = "Ghim",
                            tint = if (isPinned) AccentYellow else TextGrayMuted,
                            modifier = Modifier.size(16.dp)
                        )
                    }

                    // Chốt đơn button
                    Button(
                        onClick = onQuickClose,
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier
                            .height(28.dp)
                            .testTag("btn_close_order_${comment.id}")
                    ) {
                        Text(
                            text = "Chốt đơn",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextWhite
                        )
                    }
                }
            }
        }
    }
}
