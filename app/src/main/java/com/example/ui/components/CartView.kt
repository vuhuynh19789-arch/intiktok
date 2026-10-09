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
import androidx.compose.runtime.*
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
fun CartView(
    customers: List<Customer>,
    searchKeyword: String,
    filterPlatform: Platform?,
    onSetFilter: (Platform?) -> Unit,
    onOpenProfile: (Customer) -> Unit,
    onOpenPriceModal: (String, Platform) -> Unit,
    onIncreaseQuantity: (String, String) -> Unit,
    onToggleShipped: (String, String) -> Unit,
    onDeleteItem: (String, String) -> Unit,
    onArchiveShipped: (String) -> Unit,
    onPrintBill: (Customer) -> Unit,
    modifier: Modifier = Modifier
) {
    val filteredCustomers = remember(customers, searchKeyword, filterPlatform) {
        val q = searchKeyword.trim().lowercase()
        val qNoAccent = PriceUtils.removeVietnameseAccents(q)
        val isId = q.startsWith("#") || q.all { it.isDigit() }
        val targetId = if (q.startsWith("#")) q.drop(1) else q

        customers.filter { c ->
            val matchesPlatform = filterPlatform == null || c.platform == filterPlatform
            val hasItems = c.items.isNotEmpty()

            val matchesSearch = if (q.isEmpty()) true else {
                val shortId = PriceUtils.getShortId(c.user).lowercase()
                val userLower = c.user.lowercase()
                val userNoAccent = PriceUtils.removeVietnameseAccents(userLower)
                val nickLower = c.nickname.lowercase()
                val nickNoAccent = PriceUtils.removeVietnameseAccents(nickLower)
                val itemsMatch = c.items.any { it.content.lowercase().contains(q) }

                if (isId) {
                    shortId.contains(targetId)
                } else {
                    userLower.contains(q) || userNoAccent.contains(qNoAccent) ||
                            nickLower.contains(q) || nickNoAccent.contains(qNoAccent) || itemsMatch
                }
            }
            matchesPlatform && hasItems && matchesSearch
        }.sortedByDescending { it.lastTime }
    }

    Column(modifier = modifier.fillMaxSize().background(BgDark)) {
        // Platform Filter Row
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FilterChip(
                selected = filterPlatform == null,
                onClick = { onSetFilter(null) },
                label = { Text("Tất cả", fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = PrimaryBlue,
                    selectedLabelColor = TextWhite,
                    containerColor = CardDark,
                    labelColor = TextGrayMuted
                ),
                border = null
            )

            Platform.entries.forEach { p ->
                FilterChip(
                    selected = filterPlatform == p,
                    onClick = { onSetFilter(if (filterPlatform == p) null else p) },
                    label = { Text(p.label, fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = p.color.copy(alpha = 0.3f),
                        selectedLabelColor = p.color,
                        containerColor = CardDark,
                        labelColor = TextGrayMuted
                    ),
                    border = null
                )
            }
        }

        if (filteredCustomers.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(text = "🛒", fontSize = 36.sp)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = if (searchKeyword.isNotEmpty()) "Không tìm thấy khách hàng nào khớp" else "Giỏ hàng hiện đang trống",
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
                verticalArrangement = Arrangement.spacedBy(10.dp),
                contentPadding = PaddingValues(vertical = 8.dp)
            ) {
                items(filteredCustomers, key = { it.user }) { customer ->
                    CartCustomerCard(
                        customer = customer,
                        onOpenProfile = { onOpenProfile(customer) },
                        onAddItem = { onOpenPriceModal(customer.user, customer.platform) },
                        onIncreaseQuantity = { itemId -> onIncreaseQuantity(customer.user, itemId) },
                        onToggleShipped = { itemId -> onToggleShipped(customer.user, itemId) },
                        onDeleteItem = { itemId -> onDeleteItem(customer.user, itemId) },
                        onArchiveShipped = { onArchiveShipped(customer.user) },
                        onPrintBill = { onPrintBill(customer) }
                    )
                }
            }
        }
    }
}

@Composable
fun CartCustomerCard(
    customer: Customer,
    onOpenProfile: () -> Unit,
    onAddItem: () -> Unit,
    onIncreaseQuantity: (String) -> Unit,
    onToggleShipped: (String) -> Unit,
    onDeleteItem: (String) -> Unit,
    onArchiveShipped: () -> Unit,
    onPrintBill: () -> Unit,
    modifier: Modifier = Modifier
) {
    val shortId = PriceUtils.getShortId(customer.user)
    val hasShippedItems = customer.items.any { it.isShipped }

    Card(
        modifier = modifier
            .fillMaxWidth()
            .testTag("cart_customer_${customer.user}"),
        colors = CardDefaults.cardColors(containerColor = CardDark),
        shape = RoundedCornerShape(14.dp),
        border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(BorderSubtle))
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            // Header: User, ID, Tag, Total
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Avatar
                    Box(
                        modifier = Modifier
                            .size(34.dp)
                            .clip(CircleShape)
                            .background(customer.platform.color.copy(alpha = 0.2f))
                            .clickable { onOpenProfile() },
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = customer.user.take(1).uppercase(),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = customer.platform.color
                        )
                    }

                    Column {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Text(
                                text = customer.user,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextWhite,
                                modifier = Modifier.clickable { onOpenProfile() }
                            )

                            Text(
                                text = "#$shortId",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = PrimaryBlueLight
                            )

                            if (customer.tag != CustomerTag.NORMAL) {
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(4.dp))
                                        .background(customer.tag.bgColor)
                                        .padding(horizontal = 4.dp, vertical = 1.dp)
                                ) {
                                    Text(
                                        text = customer.tag.label,
                                        fontSize = 8.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = customer.tag.textColor
                                    )
                                }
                            }
                        }

                        if (customer.nickname.isNotEmpty()) {
                            Text(
                                text = customer.nickname,
                                fontSize = 11.sp,
                                color = TextGrayMuted
                            )
                        }
                    }
                }

                // Summary: Items count & Total revenue
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = "${customer.totalRevenue}k",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Black,
                        color = AccentEmerald
                    )
                    Text(
                        text = "${customer.totalQuantity} món",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextGrayMuted
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))
            Divider(color = BorderSubtle, thickness = 0.5.dp)
            Spacer(modifier = Modifier.height(8.dp))

            // Items List
            customer.items.forEach { item ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        modifier = Modifier.weight(1f),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        // Shipped checkbox
                        Checkbox(
                            checked = item.isShipped,
                            onCheckedChange = { onToggleShipped(item.id) },
                            colors = CheckboxDefaults.colors(
                                checkedColor = AccentEmerald,
                                uncheckedColor = TextGrayMuted
                            ),
                            modifier = Modifier.size(20.dp)
                        )

                        Text(
                            text = item.content,
                            fontSize = 13.sp,
                            color = if (item.isShipped) TextGrayMuted else TextWhite,
                            modifier = Modifier.weight(1f)
                        )
                    }

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        // Quantity & Price Increment Button (Red highlight when >= 2!)
                        val isRed = item.quantity >= 2
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (isRed) AccentRed else Color(0xFF064E3B))
                                .border(
                                    width = 1.dp,
                                    color = if (isRed) Color(0xFFFCA5A5) else AccentEmerald,
                                    shape = RoundedCornerShape(8.dp)
                                )
                                .clickable { onIncreaseQuantity(item.id) }
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                                .testTag("btn_qty_${item.id}"),
                            contentAlignment = Alignment.Center
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                if (isRed) {
                                    Text(
                                        text = "x${item.quantity}",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Black,
                                        color = TextWhite
                                    )
                                }
                                Text(
                                    text = "${item.price}k",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Black,
                                    color = TextWhite
                                )
                            }
                        }

                        // Delete item button
                        IconButton(
                            onClick = { onDeleteItem(item.id) },
                            modifier = Modifier.size(28.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.DeleteOutline,
                                contentDescription = "Xóa món",
                                tint = TextGrayMuted,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Action row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    // Print Bill button
                    OutlinedButton(
                        onClick = onPrintBill,
                        shape = RoundedCornerShape(8.dp),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                        modifier = Modifier.height(30.dp).testTag("btn_print_bill_${customer.user}")
                    ) {
                        Icon(
                            imageVector = Icons.Default.Print,
                            contentDescription = "In bill",
                            tint = AccentCyan,
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("In bill", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = AccentCyan)
                    }

                    // Add item button
                    OutlinedButton(
                        onClick = onAddItem,
                        shape = RoundedCornerShape(8.dp),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                        modifier = Modifier.height(30.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Add,
                            contentDescription = "Thêm món",
                            tint = TextWhite,
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Thêm", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = TextWhite)
                    }
                }

                if (hasShippedItems) {
                    TextButton(
                        onClick = onArchiveShipped,
                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                        modifier = Modifier.height(30.dp)
                    ) {
                        Text(
                            text = "Lưu trữ đã gửi",
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
