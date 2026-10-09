package com.example.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.LivestreamRepository
import com.example.model.*
import com.example.util.PriceUtils
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class PendingOrderState(
    val commentId: String? = null,
    val user: String,
    val platform: Platform,
    val defaultPriceFormula: String = "",
    val defaultContent: String = ""
)

data class UiState(
    val activeTab: Int = 0,
    val searchQuery: String = "",
    val filterPlatform: Platform? = null,
    val pendingOrder: PendingOrderState? = null,
    val profileCustomer: Customer? = null,
    val showSmartMonitor: Boolean = false,
    val showMinigame: Boolean = false,
    val showAutoComment: Boolean = false,
    val showAutoClose: Boolean = false,
    val showResetSession: Boolean = false,
    val showClearFeed: Boolean = false,
    val showPancakeSync: Boolean = false,
    val toastMessage: String? = null,
    val lastPrintedReceipt: String? = null
)

class LivestreamViewModel(
    private val repository: LivestreamRepository = LivestreamRepository()
) : ViewModel() {

    private val _uiState = MutableStateFlow(UiState())
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()

    val comments = repository.comments
    val customers = repository.customers
    val pinnedComments = repository.pinnedComments
    val flowPrices = repository.flowPrices
    val printedMap = repository.printedMap
    val platformStatuses = repository.platformStatuses

    val searchSuggestions: StateFlow<List<SearchSuggestionItem>> = combine(
        _uiState.map { it.searchQuery },
        customers
    ) { query, custMap ->
        val q = query.trim().lowercase()
        if (q.isEmpty() || q.startsWith("/")) return@combine emptyList<SearchSuggestionItem>()

        val qNoAccent = PriceUtils.removeVietnameseAccents(q)
        val isId = q.startsWith("#") || q.all { it.isDigit() }
        val targetId = if (q.startsWith("#")) q.drop(1) else q

        custMap.values.filter { c ->
            val userLower = c.user.lowercase()
            val userNoAccent = PriceUtils.removeVietnameseAccents(userLower)
            val nickLower = c.nickname.lowercase()
            val nickNoAccent = PriceUtils.removeVietnameseAccents(nickLower)
            val shortId = PriceUtils.getShortId(c.user).lowercase()

            if (isId) {
                shortId.contains(targetId)
            } else {
                userLower.contains(q) || userNoAccent.contains(qNoAccent) ||
                        nickLower.contains(q) || nickNoAccent.contains(qNoAccent)
            }
        }.map { c ->
            SearchSuggestionItem(
                user = c.user,
                nickname = c.nickname,
                shortId = PriceUtils.getShortId(c.user),
                platform = c.platform,
                tag = c.tag,
                count = c.count,
                total = c.total,
                lastTime = c.lastTime
            )
        }.take(8)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val sessionStats: StateFlow<SessionStats> = customers.map {
        repository.getSessionStats()
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), repository.getSessionStats())

    fun selectTab(tab: Int) {
        _uiState.update { it.copy(activeTab = tab) }
    }

    fun setSearchQuery(query: String) {
        _uiState.update { it.copy(searchQuery = query) }
    }

    fun setFilterPlatform(platform: Platform?) {
        _uiState.update { it.copy(filterPlatform = platform) }
    }

    fun openPendingOrder(
        user: String,
        platform: Platform,
        commentId: String? = null,
        defaultFormula: String = "",
        defaultContent: String = ""
    ) {
        _uiState.update {
            it.copy(
                pendingOrder = PendingOrderState(
                    commentId = commentId,
                    user = user,
                    platform = platform,
                    defaultPriceFormula = defaultFormula,
                    defaultContent = defaultContent
                )
            )
        }
    }

    fun closePendingOrder() {
        _uiState.update { it.copy(pendingOrder = null) }
    }

    fun confirmOrder(
        platform: Platform,
        user: String,
        content: String,
        priceFormula: String,
        sourceCommentId: String? = null,
        shouldPrint: Boolean = true
    ) {
        repository.addOrder(platform, user, content, priceFormula, sourceCommentId)
        closePendingOrder()

        if (shouldPrint) {
            val cust = customers.value[user]
            if (cust != null) {
                val receipt = PriceUtils.generateReceiptText(cust, cust.items, platform)
                _uiState.update { it.copy(lastPrintedReceipt = receipt) }
            }
            showToast("Đã chốt đơn $priceFormula cho $user và in tem!")
        } else {
            showToast("Đã chốt đơn $priceFormula cho $user!")
        }
    }

    fun openProfile(customer: Customer) {
        _uiState.update { it.copy(profileCustomer = customer) }
    }

    fun closeProfile() {
        _uiState.update { it.copy(profileCustomer = null) }
    }

    fun updateItemQuantity(user: String, itemId: String, delta: Int) {
        repository.updateItemQuantity(user, itemId, delta)
    }

    fun updateItemPriceAndQuantity(user: String, itemId: String, newPrice: Int, newQty: Int) {
        repository.updateItemPriceAndQuantity(user, itemId, newPrice, newQty)
        showToast("Đã cập nhật giá và số lượng!")
    }

    fun deleteItem(user: String, itemId: String) {
        repository.deleteItem(user, itemId)
        showToast("Đã xóa món khỏi giỏ hàng!")
    }

    fun toggleItemShipped(user: String, itemId: String) {
        repository.toggleItemShipped(user, itemId)
    }

    fun archiveCustomerShippedItems(user: String) {
        repository.archiveCustomerShippedItems(user)
        showToast("Đã lưu trữ các món đã gửi!")
    }

    fun clearCustomerCart(user: String) {
        repository.clearCustomerCart(user)
        showToast("Đã dọn giỏ hàng của $user!")
    }

    fun setCustomerTag(user: String, tag: CustomerTag) {
        repository.setCustomerTag(user, tag)
        showToast("Đã gắn tag ${tag.label} cho $user!")
    }

    fun setCustomerNickname(user: String, nickname: String) {
        repository.setCustomerNickname(user, nickname)
        showToast("Đã lưu biệt danh cho $user!")
    }

    fun togglePinComment(platform: Platform, commentId: String) {
        repository.togglePinComment(platform, commentId)
    }

    fun setFlowPrice(platform: Platform, price: String, hostUser: String, content: String) {
        repository.setFlowPrice(platform, price, hostUser, content)
        showToast("Đã đặt giá ghim phiên: ${price}k")
    }

    fun clearFlowPrice(platform: Platform) {
        repository.clearFlowPrice(platform)
        showToast("Đã xóa giá ghim phiên!")
    }

    fun resetSession() {
        repository.resetSession()
        _uiState.update { it.copy(showResetSession = false) }
        showToast("Đã reset số liệu phiên live!")
    }

    fun clearFeed(platform: Platform?) {
        repository.clearFeed(platform)
        _uiState.update { it.copy(showClearFeed = false) }
        showToast("Đã dọn sạch bình luận!")
    }

    fun setShowSmartMonitor(show: Boolean) {
        _uiState.update { it.copy(showSmartMonitor = show) }
    }

    fun setShowMinigame(show: Boolean) {
        _uiState.update { it.copy(showMinigame = show) }
    }

    fun setShowAutoComment(show: Boolean) {
        _uiState.update { it.copy(showAutoComment = show) }
    }

    fun setShowAutoClose(show: Boolean) {
        _uiState.update { it.copy(showAutoClose = show) }
    }

    fun setShowResetSession(show: Boolean) {
        _uiState.update { it.copy(showResetSession = show) }
    }

    fun setShowClearFeed(show: Boolean) {
        _uiState.update { it.copy(showClearFeed = show) }
    }

    fun setShowPancakeSync(show: Boolean) {
        _uiState.update { it.copy(showPancakeSync = show) }
    }

    fun printCustomerBill(customer: Customer) {
        val receipt = PriceUtils.generateReceiptText(customer, customer.items, customer.platform)
        _uiState.update { it.copy(lastPrintedReceipt = receipt) }
        showToast("Đã gửi lệnh in hóa đơn cho ${customer.user}!")
    }

    fun showToast(msg: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(toastMessage = msg) }
            kotlinx.coroutines.delay(3000)
            _uiState.update { if (it.toastMessage == msg) it.copy(toastMessage = null) else it }
        }
    }
}
