package com.example.data

import com.example.model.*
import com.example.util.PriceUtils
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

class LivestreamRepository(
    private val scope: CoroutineScope = CoroutineScope(Dispatchers.Default)
) {
    private val _comments = MutableStateFlow<Map<Platform, List<CommentData>>>(
        mapOf(
            Platform.TIKTOK to emptyList(),
            Platform.FACEBOOK to emptyList(),
            Platform.SHOPEE to emptyList()
        )
    )
    val comments: StateFlow<Map<Platform, List<CommentData>>> = _comments.asStateFlow()

    private val _customers = MutableStateFlow<Map<String, Customer>>(emptyMap())
    val customers: StateFlow<Map<String, Customer>> = _customers.asStateFlow()

    private val _pinnedComments = MutableStateFlow<Map<Platform, Map<String, Long>>>(
        mapOf(
            Platform.TIKTOK to emptyMap(),
            Platform.FACEBOOK to emptyMap(),
            Platform.SHOPEE to emptyMap()
        )
    )
    val pinnedComments: StateFlow<Map<Platform, Map<String, Long>>> = _pinnedComments.asStateFlow()

    private val _flowPrices = MutableStateFlow<Map<Platform, FlowPrice?>>(
        mapOf(
            Platform.TIKTOK to null,
            Platform.FACEBOOK to null,
            Platform.SHOPEE to null
        )
    )
    val flowPrices: StateFlow<Map<Platform, FlowPrice?>> = _flowPrices.asStateFlow()

    private val _printedMap = MutableStateFlow<Map<String, Long>>(emptyMap())
    val printedMap: StateFlow<Map<String, Long>> = _printedMap.asStateFlow()

    private val _platformStatuses = MutableStateFlow<Map<Platform, LivePlatformStatus>>(
        mapOf(
            Platform.TIKTOK to LivePlatformStatus(Platform.TIKTOK, true, 842, 1280, "@hienpham_live"),
            Platform.FACEBOOK to LivePlatformStatus(Platform.FACEBOOK, true, 315, 490, "Hiền Phạm Official"),
            Platform.SHOPEE to LivePlatformStatus(Platform.SHOPEE, true, 190, 230, "hienpham_live_shopee")
        )
    )
    val platformStatuses: StateFlow<Map<Platform, LivePlatformStatus>> = _platformStatuses.asStateFlow()

    private val initialSampleCustomers = listOf(
        Customer(
            user = "Mai Phương",
            platform = Platform.TIKTOK,
            nickname = "Phương Sài Gòn",
            tag = CustomerTag.VIP,
            pancakeLink = "https://pancake.vn/chat/1029481",
            count = 3,
            total = 297,
            items = listOf(
                OrderItem("i1", "Áo sơ mi croptop 99k", 99, 1, 99),
                OrderItem("i2", "Chân váy chữ A 99k", 99, 2, 198)
            )
        ),
        Customer(
            user = "Thanh Hằng",
            platform = Platform.FACEBOOK,
            nickname = "Chị Hằng Hà Nội",
            tag = CustomerTag.COC,
            count = 2,
            total = 258,
            items = listOf(
                OrderItem("i3", "Đầm hoa nhí vintage 129k", 129, 2, 258)
            )
        ),
        Customer(
            user = "Ngọc Linh",
            platform = Platform.TIKTOK,
            tag = CustomerTag.NORMAL,
            count = 1,
            total = 89,
            items = listOf(
                OrderItem("i4", "Quần ống suông lưng cao 89k", 89, 1, 89)
            )
        ),
        Customer(
            user = "Thu Trang",
            platform = Platform.SHOPEE,
            nickname = "Trang Cần Thơ",
            tag = CustomerTag.VIP,
            count = 4,
            total = 396,
            items = listOf(
                OrderItem("i5", "Set vest lửng cao cấp 99k", 99, 4, 396)
            )
        )
    )

    private val sampleLiveComments = listOf(
        Triple("Hoàng Yến", "Chốt áo đen 99k cho em với ạ", Platform.TIKTOK),
        Triple("Lan Anh 99", "99*2 lấy 2 áo màu be", Platform.TIKTOK),
        Triple("Chủ Live (Hiền)", "Áo blazer mẫu mới 129k form chuẩn nha cả nhà!", Platform.TIKTOK),
        Triple("Trần Thu Hà", "129k em chốt 1 cái", Platform.FACEBOOK),
        Triple("Bảo Trâm", "Có màu xanh mint không shop? chốt 99k", Platform.FACEBOOK),
        Triple("Thúy Hằng", "Chốt chân váy 89*2 nha shop", Platform.SHOPEE),
        Triple("Thuỳ Dung", "Chốt đầm 129k", Platform.TIKTOK),
        Triple("Lê Hương", "Cho xem lại mẫu vừa live đi shop, chốt 99k", Platform.FACEBOOK),
        Triple("Ngọc Bích", "99k màu đen", Platform.TIKTOK),
        Triple("Minh Thư", "Set 149k còn size M ko ạ? chốt 149k", Platform.SHOPEE)
    )

    init {
        // Populate initial customer state
        val initialMap = initialSampleCustomers.associateBy { it.user }.toMutableMap()
        _customers.value = initialMap

        // Seed initial comments
        val timeFmt = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
        val seededTiktok = mutableListOf<CommentData>()
        val seededFb = mutableListOf<CommentData>()
        val seededShopee = mutableListOf<CommentData>()

        sampleLiveComments.forEachIndexed { idx, (user, content, plat) ->
            val ext = PriceUtils.extractPriceFromContent(content)
            val c = CommentData(
                id = "c_$idx",
                user = user,
                content = content,
                time = timeFmt.format(Date(System.currentTimeMillis() - (sampleLiveComments.size - idx) * 15000L)),
                ts = System.currentTimeMillis() - (sampleLiveComments.size - idx) * 15000L,
                platform = plat,
                extractedPrice = if (ext.priceFormula.isNotEmpty()) ext.priceFormula else null
            )
            when (plat) {
                Platform.TIKTOK -> seededTiktok.add(c)
                Platform.FACEBOOK -> seededFb.add(c)
                Platform.SHOPEE -> seededShopee.add(c)
            }
        }

        _comments.value = mapOf(
            Platform.TIKTOK to seededTiktok.reversed(),
            Platform.FACEBOOK to seededFb.reversed(),
            Platform.SHOPEE to seededShopee.reversed()
        )

        // Set default host flow price
        _flowPrices.value = mapOf(
            Platform.TIKTOK to FlowPrice("99", "Chủ Live (Hiền)", "Mẫu áo thun hot trend 99k"),
            Platform.FACEBOOK to FlowPrice("129", "Hiền Phạm Host", "Đầm hoa nhí 129k"),
            Platform.SHOPEE to null
        )

        startSimulatedLiveStream()
    }

    private fun startSimulatedLiveStream() {
        scope.launch {
            val randomUsers = listOf(
                "Diệu Linh", "Bảo Châu", "Khánh Vy", "Tường Vi", "Ánh Tuyết",
                "Quỳnh Như", "Cẩm Ly", "Hồng Nhung", "Thanh Mai", "Yến Nhi"
            )
            val randomTexts = listOf(
                "Em chốt 99k màu kem", "99*2 áo nha chị", "129k em chốt màu trắng",
                "Cho em xin số ký mẫu đang mặc ạ", "Chốt áo 99k", "149k lấy em size L nha",
                "Chốt 89k màu be", "Chị ơi còn mẫu này ko chốt 99k", "99*3 chia 3 màu giúp em",
                "Ship Hà Nội mấy ngày tới ạ? chốt 129k"
            )
            val timeFmt = SimpleDateFormat("HH:mm:ss", Locale.getDefault())

            while (true) {
                delay(7000L)
                val platform = listOf(Platform.TIKTOK, Platform.FACEBOOK, Platform.SHOPEE).random()
                val user = randomUsers.random()
                val text = randomTexts.random()
                val ext = PriceUtils.extractPriceFromContent(text)

                val newComment = CommentData(
                    id = "live_${System.currentTimeMillis()}_${(100..999).random()}",
                    user = user,
                    content = text,
                    time = timeFmt.format(Date()),
                    ts = System.currentTimeMillis(),
                    platform = platform,
                    extractedPrice = if (ext.priceFormula.isNotEmpty()) ext.priceFormula else null
                )

                _comments.update { current ->
                    val list = current[platform].orEmpty().toMutableList()
                    list.add(0, newComment)
                    current + (platform to list.take(200))
                }

                _platformStatuses.update { statuses ->
                    val curr = statuses[platform] ?: LivePlatformStatus(platform)
                    statuses + (platform to curr.copy(totalComments = curr.totalComments + 1))
                }
            }
        }
    }

    fun addOrder(
        platform: Platform,
        user: String,
        content: String,
        priceFormula: String,
        sourceCommentId: String? = null
    ) {
        val parsed = PriceUtils.parsePriceAndQuantity(priceFormula)
        val newItem = OrderItem(
            id = "ord_${System.currentTimeMillis()}_${(100..999).random()}",
            content = content.ifEmpty { "Sản phẩm ${parsed.unitPrice}k" },
            unitPrice = parsed.unitPrice,
            quantity = parsed.quantity,
            price = parsed.totalPrice,
            sourceCommentId = sourceCommentId,
            createdAt = System.currentTimeMillis()
        )

        _customers.update { map ->
            val existing = map[user] ?: Customer(
                user = user,
                platform = platform,
                lastTime = System.currentTimeMillis()
            )
            val updatedItems = existing.items + newItem
            val updated = existing.copy(
                items = updatedItems,
                count = updatedItems.sumOf { it.quantity },
                total = updatedItems.sumOf { it.price },
                lastTime = System.currentTimeMillis()
            )
            map + (user to updated)
        }

        sourceCommentId?.let { markPrinted(it) }
    }

    fun updateItemQuantity(user: String, itemId: String, delta: Int) {
        _customers.update { map ->
            val cust = map[user] ?: return@update map
            val updatedItems = cust.items.mapNotNull { item ->
                if (item.id == itemId) {
                    val newQty = item.quantity + delta
                    if (newQty <= 0) null
                    else item.copy(quantity = newQty, price = item.unitPrice * newQty)
                } else item
            }
            val updated = cust.copy(
                items = updatedItems,
                count = updatedItems.sumOf { it.quantity },
                total = updatedItems.sumOf { it.price }
            )
            map + (user to updated)
        }
    }

    fun updateItemPriceAndQuantity(user: String, itemId: String, newUnitPrice: Int, newQuantity: Int) {
        _customers.update { map ->
            val cust = map[user] ?: return@update map
            val updatedItems = cust.items.map { item ->
                if (item.id == itemId) {
                    item.copy(
                        unitPrice = newUnitPrice,
                        quantity = newQuantity,
                        price = newUnitPrice * newQuantity
                    )
                } else item
            }
            val updated = cust.copy(
                items = updatedItems,
                count = updatedItems.sumOf { it.quantity },
                total = updatedItems.sumOf { it.price }
            )
            map + (user to updated)
        }
    }

    fun deleteItem(user: String, itemId: String) {
        _customers.update { map ->
            val cust = map[user] ?: return@update map
            val updatedItems = cust.items.filterNot { it.id == itemId }
            val updated = cust.copy(
                items = updatedItems,
                count = updatedItems.sumOf { it.quantity },
                total = updatedItems.sumOf { it.price }
            )
            map + (user to updated)
        }
    }

    fun toggleItemShipped(user: String, itemId: String) {
        _customers.update { map ->
            val cust = map[user] ?: return@update map
            val updatedItems = cust.items.map { item ->
                if (item.id == itemId) item.copy(isShipped = !item.isShipped)
                else item
            }
            map + (user to cust.copy(items = updatedItems))
        }
    }

    fun archiveCustomerShippedItems(user: String) {
        _customers.update { map ->
            val cust = map[user] ?: return@update map
            val (shipped, pending) = cust.items.partition { it.isShipped }
            val updated = cust.copy(
                items = pending,
                pastItems = cust.pastItems + shipped,
                count = pending.sumOf { it.quantity },
                total = pending.sumOf { it.price }
            )
            map + (user to updated)
        }
    }

    fun clearCustomerCart(user: String) {
        _customers.update { map ->
            val cust = map[user] ?: return@update map
            val updated = cust.copy(
                pastItems = cust.pastItems + cust.items,
                items = emptyList(),
                count = 0,
                total = 0
            )
            map + (user to updated)
        }
    }

    fun setCustomerTag(user: String, tag: CustomerTag) {
        _customers.update { map ->
            val cust = map[user] ?: Customer(user = user)
            map + (user to cust.copy(tag = tag))
        }
    }

    fun setCustomerNickname(user: String, nickname: String) {
        _customers.update { map ->
            val cust = map[user] ?: Customer(user = user)
            map + (user to cust.copy(nickname = nickname))
        }
    }

    fun setCustomerPancakeLink(user: String, link: String) {
        _customers.update { map ->
            val cust = map[user] ?: Customer(user = user)
            map + (user to cust.copy(pancakeLink = link))
        }
    }

    fun togglePinComment(platform: Platform, commentId: String) {
        _pinnedComments.update { current ->
            val platMap = current[platform].orEmpty().toMutableMap()
            if (platMap.containsKey(commentId)) {
                platMap.remove(commentId)
            } else {
                platMap[commentId] = System.currentTimeMillis() + 5 * 60 * 1000L
            }
            current + (platform to platMap)
        }
    }

    fun setFlowPrice(platform: Platform, price: String, hostUser: String, content: String) {
        _flowPrices.update { current ->
            current + (platform to FlowPrice(price, hostUser, content, System.currentTimeMillis()))
        }
    }

    fun clearFlowPrice(platform: Platform) {
        _flowPrices.update { current ->
            current + (platform to null)
        }
    }

    fun markPrinted(commentId: String) {
        _printedMap.update { it + (commentId to System.currentTimeMillis()) }
    }

    fun resetSession() {
        _customers.update { map ->
            map.mapValues { (_, cust) ->
                cust.copy(
                    pastItems = cust.pastItems + cust.items,
                    items = emptyList(),
                    count = 0,
                    total = 0
                )
            }
        }
        _printedMap.value = emptyMap()
    }

    fun clearFeed(platform: Platform?) {
        if (platform == null) {
            _comments.value = mapOf(
                Platform.TIKTOK to emptyList(),
                Platform.FACEBOOK to emptyList(),
                Platform.SHOPEE to emptyList()
            )
        } else {
            _comments.update { it + (platform to emptyList()) }
        }
    }

    fun getSessionStats(): SessionStats {
        val allCusts = _customers.value.values
        val totalCount = allCusts.sumOf { it.totalQuantity }
        val totalRev = allCusts.sumOf { it.totalRevenue }

        val pStats = Platform.entries.associateWith { p ->
            val pCusts = allCusts.filter { it.platform == p }
            Pair(pCusts.sumOf { it.totalQuantity }, pCusts.sumOf { it.totalRevenue })
        }

        val top = allCusts.filter { it.totalRevenue > 0 }
            .sortedByDescending { it.totalRevenue }
            .take(10)

        return SessionStats(totalCount, totalRev, pStats, top)
    }
}
