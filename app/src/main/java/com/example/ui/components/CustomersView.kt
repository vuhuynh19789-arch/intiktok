package com.example.ui.components

import androidx.compose.foundation.background
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
fun CustomersView(
    customers: List<Customer>,
    searchKeyword: String,
    onOpenProfile: (Customer) -> Unit,
    onOpenAddOrder: (String, Platform) -> Unit,
    onSetTag: (String, CustomerTag) -> Unit,
    modifier: Modifier = Modifier
) {
    var selectedTagFilter by remember { mutableStateOf<CustomerTag?>(null) }

    val filteredList = remember(customers, searchKeyword, selectedTagFilter) {
        val q = searchKeyword.trim().lowercase()
        val qNoAccent = PriceUtils.removeVietnameseAccents(q)
        val isId = q.startsWith("#") || q.all { it.isDigit() }
        val targetId = if (q.startsWith("#")) q.drop(1) else q

        customers.filter { c ->
            val matchesTag = selectedTagFilter == null || c.tag == selectedTagFilter
            val matchesSearch = if (q.isEmpty()) true else {
                val shortId = PriceUtils.getShortId(c.user).lowercase()
                val userLower = c.user.lowercase()
                val userNoAccent = PriceUtils.removeVietnameseAccents(userLower)
                val nickLower = c.nickname.lowercase()
                val nickNoAccent = PriceUtils.removeVietnameseAccents(nickLower)

                if (isId) {
                    shortId.contains(targetId)
                } else {
                    userLower.contains(q) || userNoAccent.contains(qNoAccent) ||
                            nickLower.contains(q) || nickNoAccent.contains(qNoAccent)
                }
            }
            matchesTag && matchesSearch
        }.sortedByDescending { it.lastTime }
    }

    Column(modifier = modifier.fillMaxSize().background(BgDark)) {
        // Tag filters row
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FilterChip(
                selected = selectedTagFilter == null,
                onClick = { selectedTagFilter = null },
                label = { Text("Tất cả", fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = PrimaryBlue,
                    selectedLabelColor = TextWhite,
                    containerColor = CardDark,
                    labelColor = TextGrayMuted
                ),
                border = null
            )

            listOf(CustomerTag.VIP, CustomerTag.COC, CustomerTag.BOM, CustomerTag.DAO).forEach { tag ->
                FilterChip(
                    selected = selectedTagFilter == tag,
                    onClick = { selectedTagFilter = if (selectedTagFilter == tag) null else tag },
                    label = { Text(tag.label, fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = tag.bgColor,
                        selectedLabelColor = tag.textColor,
                        containerColor = CardDark,
                        labelColor = TextGrayMuted
                    ),
                    border = null
                )
            }
        }

        if (filteredList.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(text = "👥", fontSize = 36.sp)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Không tìm thấy khách hàng nào",
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
                items(filteredList, key = { it.user }) { customer ->
                    CustomerCard(
                        customer = customer,
                        onOpenProfile = { onOpenProfile(customer) },
                        onOpenAddOrder = { onOpenAddOrder(customer.user, customer.platform) },
                        onSetTag = { tag -> onSetTag(customer.user, tag) }
                    )
                }
            }
        }
    }
}

@Composable
fun CustomerCard(
    customer: Customer,
    onOpenProfile: () -> Unit,
    onOpenAddOrder: () -> Unit,
    onSetTag: (CustomerTag) -> Unit,
    modifier: Modifier = Modifier
) {
    val shortId = PriceUtils.getShortId(customer.user)
    var showTagDropdown by remember { mutableStateOf(false) }

    Card(
        modifier = modifier
            .fillMaxWidth()
            .testTag("customer_card_${customer.user}"),
        colors = CardDefaults.cardColors(containerColor = CardDark),
        shape = RoundedCornerShape(12.dp),
        border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(BorderSubtle))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.weight(1f)
            ) {
                // Avatar
                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(customer.platform.color.copy(alpha = 0.2f))
                        .clickable { onOpenProfile() },
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = customer.user.take(1).uppercase(),
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = customer.platform.color
                    )
                }

                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
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

                        // Tag Pill with Dropdown
                        Box {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(customer.tag.bgColor)
                                    .clickable { showTagDropdown = true }
                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                            ) {
                                Text(
                                    text = customer.tag.label,
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = customer.tag.textColor
                                )
                            }

                            DropdownMenu(
                                expanded = showTagDropdown,
                                onDismissRequest = { showTagDropdown = false },
                                modifier = Modifier.background(CardHoverDark)
                            ) {
                                CustomerTag.entries.forEach { tagOption ->
                                    DropdownMenuItem(
                                        text = {
                                            Text(
                                                text = tagOption.label,
                                                color = tagOption.textColor,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 12.sp
                                            )
                                        },
                                        onClick = {
                                            onSetTag(tagOption)
                                            showTagDropdown = false
                                        }
                                    )
                                }
                            }
                        }
                    }

                    if (customer.nickname.isNotEmpty()) {
                        Text(
                            text = "Biệt danh: ${customer.nickname}",
                            fontSize = 11.sp,
                            color = TextGrayMuted
                        )
                    }

                    Text(
                        text = "Đã chốt: ${customer.totalQuantity} món | ${customer.totalRevenue}k",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = AccentYellow
                    )
                }
            }

            // Right: Actions
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                IconButton(
                    onClick = onOpenProfile,
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Person,
                        contentDescription = "Hồ sơ khách",
                        tint = AccentCyan,
                        modifier = Modifier.size(18.dp)
                    )
                }

                IconButton(
                    onClick = onOpenAddOrder,
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.AddShoppingCart,
                        contentDescription = "Thêm đơn mới",
                        tint = AccentEmerald,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }
    }
}
