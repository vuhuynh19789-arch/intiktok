package com.example.util

import com.example.model.Customer
import com.example.model.OrderItem
import com.example.model.Platform
import java.text.Normalizer
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.regex.Pattern
import kotlin.math.abs

object PriceUtils {

    const val SHOP_NAME = "Hiền Phạm | 0965.286.096"

    data class ParsedPriceResult(
        val unitPrice: Int,
        val quantity: Int,
        val totalPrice: Int
    )

    fun parsePriceAndQuantity(input: String?): ParsedPriceResult {
        val str = input?.trim().orEmpty()
        if (str.isEmpty()) return ParsedPriceResult(0, 1, 0)

        // Hỗ trợ định dạng nhân SL: "99*2", "2*99", "99x2", "2 x 99", "99×2"
        val mulRegex = Pattern.compile("^(\\d+(?:\\.\\d+)?)\\s*(?:k|ka|ca|cành)?\\s*[*xX×]\\s*(\\d+(?:\\.\\d+)?)\\s*(?:k|ka|ca|cành)?$", Pattern.CASE_INSENSITIVE)
        val matcher = mulRegex.matcher(str)
        if (matcher.find()) {
            val n1 = matcher.group(1)?.toFloatOrNull() ?: 0f
            val n2 = matcher.group(2)?.toFloatOrNull() ?: 0f
            var unitPrice = n1
            var qty = n2
            if (n1 < 10 && n2 >= 10 && n1 == n1.toInt().toFloat()) {
                unitPrice = n2
                qty = n1
            }
            val roundedPrice = unitPrice.toInt()
            val roundedQty = qty.toInt().coerceAtLeast(1)
            return ParsedPriceResult(
                unitPrice = roundedPrice,
                quantity = roundedQty,
                totalPrice = roundedPrice * roundedQty
            )
        }

        val clean = str.replace(Regex("k|ka|ca|cành", RegexOption.IGNORE_CASE), "").trim()
        val num = clean.toIntOrNull() ?: 0
        return ParsedPriceResult(unitPrice = num, quantity = 1, totalPrice = num)
    }

    data class ExtractedPrice(
        val priceFormula: String,
        val content: String
    )

    fun extractPriceFromContent(rawText: String?): ExtractedPrice {
        val text = rawText?.trim().orEmpty()
        if (text.isEmpty()) return ExtractedPrice("", "")

        // 1. Phép nhân: "99*2", "áo 99*2", "2*99", "99x2"
        val mulRegex = Pattern.compile("(?:^|\\s)(\\d+)\\s*(?:k|ka|ca|cành)?\\s*[*xX×]\\s*(\\d+)\\s*(?:k|ka|ca|cành)?(?:\\s|$)", Pattern.CASE_INSENSITIVE)
        val mulMatcher = mulRegex.matcher(text)
        if (mulMatcher.find()) {
            val n1 = mulMatcher.group(1)?.toIntOrNull() ?: 0
            val n2 = mulMatcher.group(2)?.toIntOrNull() ?: 0
            if (n1 > 0 && n2 > 0) {
                var unitPrice = n1
                var qty = n2
                if (n1 < 10 && n2 >= 10) {
                    unitPrice = n2
                    qty = n1
                }
                if (unitPrice >= 10) {
                    val fullFormula = "$unitPrice*$qty"
                    val matchedRaw = mulMatcher.group(0)?.trim().orEmpty()
                    val lastIdx = text.lastIndexOf(matchedRaw)
                    val content = (text.substring(0, lastIdx) + " " + text.substring(lastIdx + matchedRaw.length))
                        .replace(Regex("\\s+"), " ").trim()
                    return ExtractedPrice(fullFormula, if (content.isEmpty()) text else content)
                }
            }
        }

        // 2. Số đơn lẻ ở cuối: "áo thun 99k"
        val endRegex = Pattern.compile("\\s+(\\d+)\\s*(k|ka|ca|cành)?$", Pattern.CASE_INSENSITIVE)
        val endMatcher = endRegex.matcher(text)
        if (endMatcher.find()) {
            val num = endMatcher.group(1)?.toIntOrNull() ?: 0
            if (num >= 10) {
                val content = text.replace(endRegex.toRegex(), "").trim()
                return ExtractedPrice(num.toString(), content)
            }
        }

        // 3. Số đơn lẻ bất kỳ >= 10
        val numbers = Pattern.compile("\\d+").matcher(text)
        val list = mutableListOf<String>()
        while (numbers.find()) {
            list.add(numbers.group())
        }
        for (i in list.indices.reversed()) {
            val p = list[i].toIntOrNull() ?: 0
            if (p >= 10) {
                val lastIdx = text.lastIndexOf(list[i])
                val content = (text.substring(0, lastIdx).trim() + " " + text.substring(lastIdx + list[i].length).replace(Regex("k|ka|ca|cành", RegexOption.IGNORE_CASE), "").trim())
                    .replace(Regex("\\s+"), " ").trim()
                return ExtractedPrice(list[i], content)
            }
        }

        return ExtractedPrice("", text)
    }

    fun removeVietnameseAccents(str: String?): String {
        if (str.isNullOrEmpty()) return ""
        val normalized = Normalizer.normalize(str, Normalizer.Form.NFD)
        return normalized.replace(Regex("\\p{InCombiningDiacriticalMarks}+"), "")
            .replace('đ', 'd')
            .replace('Đ', 'D')
    }

    fun getShortId(name: String?): String {
        val cleanName = (name ?: "Khách").lowercase().trim()
        if (cleanName.isEmpty() || cleanName == "khách") return "1000"
        var hash = 5381
        for (c in cleanName) {
            hash = ((hash shl 5) + hash) + c.code
        }
        val num = (abs(hash) % 9000) + 1000
        return num.toString()
    }

    fun formatPriceK(priceK: Int): String {
        return "${priceK}k"
    }

    fun formatFullCurrency(priceK: Int): String {
        return "${priceK}.000đ"
    }

    fun generateReceiptText(customer: Customer, items: List<OrderItem>, platform: Platform): String {
        val sdf = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault())
        val dateStr = sdf.format(Date())
        val totalRevenue = items.sumOf { it.price }
        val totalQty = items.sumOf { it.quantity }

        val sb = StringBuilder()
        sb.append("================================\n")
        sb.append("        $SHOP_NAME        \n")
        sb.append("================================\n")
        sb.append("Nền tảng: ${platform.label}\n")
        sb.append("Thời gian: $dateStr\n")
        sb.append("Khách: ${customer.user} (#${getShortId(customer.user)})\n")
        if (customer.nickname.isNotEmpty()) {
            sb.append("Biệt danh: ${customer.nickname}\n")
        }
        sb.append("--------------------------------\n")
        items.forEachIndexed { index, item ->
            val desc = item.content.ifEmpty { "Sản phẩm ${item.unitPrice}k" }
            sb.append("${index + 1}. $desc\n")
            sb.append("   ${item.unitPrice}.000đ x ${item.quantity} = ${item.price}.000đ\n")
        }
        sb.append("--------------------------------\n")
        sb.append("TỔNG CỘNG: ${totalRevenue}.000đ ($totalQty món)\n")
        sb.append("================================\n")
        sb.append("   CẢM ƠN QUÝ KHÁCH & HẸN GẶP LẠI!\n")
        return sb.toString()
    }
}
