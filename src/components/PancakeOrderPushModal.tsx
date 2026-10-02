import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, 
  Package, 
  Check, 
  X, 
  ExternalLink, 
  Smartphone, 
  Truck, 
  MapPin, 
  Phone, 
  User, 
  AlertCircle, 
  Sparkles, 
  RefreshCw, 
  Tag, 
  CheckCircle2, 
  Copy,
  Plus,
  Search,
  Minus,
  Trash2,
  Layers,
  Edit3,
  MessageSquare,
  Clipboard,
  Send,
  MessageCircle
} from 'lucide-react';
import { useStore, OrderItem } from '../store';
import { Platform, PLATFORMS, getShortId, normalizeUser, printBill } from '../lib/core';
import { CustomerAvatar } from './UserAvatar';
import { ItemCalculatorModal, ParsedCalculatorItem } from './ItemCalculatorModal';
import { openPancakeApp, parsePancakeContact } from '../lib/pancakeDeepLink';
import { 
  getCustomerInsight, 
  fetchRecentZaloConversations, 
  ZaloInboxConversation,
  pushCustomerOrderToPancake,
  syncSingleCustomerPancakeOrders,
  generateSuggestedPancakeName,
  lookupCustomerByPhone,
  fetchPancakeVariations,
  PancakeVariation,
  parsePancakeUrlIds,
  sendPancakeMessage,
  PushOrderResult,
  isShopPhone
} from '../lib/pancakeSync';

interface EditablePushItem {
  id?: string;
  content: string;
  priceK: number;
  quantity: number;
  isPast?: boolean;
  originalIndex?: number;
  variationId?: string;
  variationName?: string;
  productName?: string;
  displayId?: string;
}

interface PancakeOrderPushModalProps {
  isOpen: boolean;
  user: string;
  platform: Platform;
  selectedCurrentIndices: Set<number>;
  selectedPastIndices: Set<number>;
  onClose: () => void;
  onSuccess?: (order: any) => void;
}

export const PancakeOrderPushModal: React.FC<PancakeOrderPushModalProps> = ({
  isOpen,
  user,
  platform,
  selectedCurrentIndices,
  selectedPastIndices,
  onClose,
  onSuccess
}) => {
  const store = useStore();
  const cleanUser = normalizeUser(user);
  const cust = store[platform].customers[cleanUser];
  const nickname = store[platform].nicknames?.[cleanUser] || '';
  const tag = store[platform].tags?.[cleanUser] || 'NORMAL';
  const existingLink = store[platform].pancakeLinks?.[cleanUser] || '';

  const [pancakeLink, setPancakeLink] = useState(existingLink);
  const [insight, setInsight] = useState(() => getCustomerInsight(cleanUser));
  const [isSearchingZalo, setIsSearchingZalo] = useState(false);
  const [zaloConvs, setZaloConvs] = useState<ZaloInboxConversation[]>([]);
  const [showZaloPicker, setShowZaloPicker] = useState(false);
  const [zaloSearchQuery, setZaloSearchQuery] = useState('');

  // Item Calculator Modal
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);

  // Editable items state
  const [orderItems, setOrderItems] = useState<EditablePushItem[]>([]);
  const [editingItemIdx, setEditingItemIdx] = useState<number | null>(null);

  // Shop variations from Pancake POS
  const [shopVariations, setShopVariations] = useState<PancakeVariation[]>([]);
  const [isLoadingVariations, setIsLoadingVariations] = useState(false);
  const [pickingVarForIdx, setPickingVarForIdx] = useState<number | null>(null);
  const [variationSearchQuery, setVariationSearchQuery] = useState('');

  const [customNote, setCustomNote] = useState<string>('');

  // Editable customer recipient details
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [shippingFee, setShippingFee] = useState<number>(20000);
  const [prepaidAmount, setPrepaidAmount] = useState<number>(0);
  const [isLookingUpPhone, setIsLookingUpPhone] = useState(false);

  // Tự động nhận diện phí vận chuyển: Ninh Thuận 15.000₫, các tỉnh khác 20.000₫
  useEffect(() => {
    const raw = (recipientAddress || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (raw.includes('ninh thuan') || raw.includes('phan rang') || raw.includes('thap cham')) {
      setShippingFee(15000);
    } else {
      setShippingFee(20000);
    }
  }, [recipientAddress]);

  // Options
  const [autoMarkShipped, setAutoMarkShipped] = useState(true);
  const [autoSendMessage, setAutoSendMessage] = useState(true);
  const [showMessagePreview, setShowMessagePreview] = useState(false);

  // Status & states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<any | null>(null);
  const [pushResult, setPushResult] = useState<PushOrderResult | null>(null);
  const [isSendingManualMessage, setIsSendingManualMessage] = useState(false);
  const [manualMessageStatus, setManualMessageStatus] = useState<string | null>(null);
  const [isParsingLink, setIsParsingLink] = useState(false);
  const [linkedConvCustomer, setLinkedConvCustomer] = useState<{
    name: string;
    phone?: string;
    address?: string;
    customerId?: string;
    conversationId?: string;
    pageId?: string;
  } | null>(null);

  // Xử lý dán link Pancake và tự động nhận diện hội thoại
  const handleLinkChange = async (newLink: string) => {
    setPancakeLink(newLink);
    const trimmed = newLink.trim();
    if (!trimmed) {
      setLinkedConvCustomer(null);
      return;
    }

    store.setCustomerPancakeLink(platform, cleanUser, trimmed);
    const parsed = parsePancakeUrlIds(trimmed);

    // Nếu link có chứa SĐT (khác số của shop)
    if (parsed.phone && !isShopPhone(parsed.phone) && (!recipientPhone || recipientPhone !== parsed.phone)) {
      setRecipientPhone(parsed.phone);
      handleLookupByPhone(parsed.phone);
    }

    // Nếu link có conversation ID, tra cứu insight để điền Tên/SĐT/Địa chỉ
    if (parsed.convId) {
      setIsParsingLink(true);
      try {
        const query = new URLSearchParams({ link: trimmed });
        const res = await fetch(`/api/pancake/customer-insight?${query.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.insight) {
            const ins = data.insight;
            // Tự động gán tên tài khoản Zalo liên kết
            if (ins.matchedName) {
              setRecipientName(ins.matchedName);
            }
            if (ins.matchedPhone && !isShopPhone(ins.matchedPhone)) {
              setRecipientPhone(ins.matchedPhone);
            }
            if (ins.matchedAddress) {
              setRecipientAddress(ins.matchedAddress);
            }
            setLinkedConvCustomer({
              name: ins.matchedName || "",
              phone: isShopPhone(ins.matchedPhone) ? undefined : ins.matchedPhone,
              address: ins.matchedAddress,
              customerId: ins.customerId,
              conversationId: ins.conversationId || parsed.convId,
              pageId: ins.pageId || parsed.pageId
            });
          }
        }
      } catch (e) {
        console.warn("Lỗi đọc thông tin từ Pancake link:", e);
      } finally {
        setIsParsingLink(false);
      }
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      if (navigator?.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          handleLinkChange(text.trim());
        }
      }
    } catch {}
  };

  // Gửi lại tin nhắn báo đơn thủ công nếu cần
  const handleSendOrderMessageManually = async () => {
    if (!createdOrder) return;
    const orderCode = createdOrder.display_id || createdOrder.id;
    const parsed = parsePancakeUrlIds(pancakeLink);
    const pId = pushResult?.pageId || parsed.pageId || "";
    const cId = pushResult?.conversationId || parsed.convId || "";

    if (!cId) {
      setManualMessageStatus("Chưa có ID hội thoại Pancake để gửi tin nhắn. Vui lòng kiểm tra lại link Pancake.");
      return;
    }

    setIsSendingManualMessage(true);
    setManualMessageStatus(null);
    try {
      const itemNotices = orderItems.map(it => `  + ${it.content} (${it.priceK}k x ${it.quantity})`).join('\n');
      const finalCod = Math.max(0, totalItemsPriceVnd + shippingFee - prepaidAmount);
      let autoMsg = `Dạ em chào ${recipientName || cleanUser}, Shop đã tạo đơn thành công cho mình trên Live ạ! ❤️\n\n` +
        `📦 Mã đơn hàng: #${orderCode}\n` +
        `🛍️ Chi tiết sản phẩm (${orderItems.length} món):\n${itemNotices}\n` +
        `💰 Tiền hàng: ${totalItemsPriceVnd.toLocaleString('vi-VN')}đ\n` +
        `🚚 Phí vận chuyển: ${shippingFee.toLocaleString('vi-VN')}đ\n`;

      if (prepaidAmount > 0) {
        autoMsg += `💳 Đã trừ cọc chuyển khoản: -${prepaidAmount.toLocaleString('vi-VN')}đ\n`;
      }

      autoMsg += `💵 Còn lại thu COD: ${finalCod.toLocaleString('vi-VN')}đ\n\n` +
        `Shop sẽ sớm đóng gói và gửi hàng cho mình nhé. Cảm ơn chị yêu đã ủng hộ shop ạ! 🥰`;

      const sendRes = await sendPancakeMessage({
        pageId: pId,
        conversationId: cId,
        message: autoMsg
      });

      if (sendRes.success) {
        setManualMessageStatus("Đã gửi tin nhắn báo đơn thành công vào hội thoại của khách!");
        setPushResult(prev => prev ? { ...prev, messageSent: true } : { success: true, messageSent: true });
      } else {
        setManualMessageStatus(`Chưa thể gửi tin: ${sendRes.error || "Hội thoại có thể đã hết hạn 24h hoặc bị chặn"}`);
      }
    } catch (err: any) {
      setManualMessageStatus(`Lỗi khi gửi tin: ${err.message}`);
    } finally {
      setIsSendingManualMessage(false);
    }
  };

  // Load Zalo conversations if needed
  const loadZaloConvs = async () => {
    setIsSearchingZalo(true);
    try {
      const res = await fetchRecentZaloConversations(undefined, platform === 'facebook' ? 'facebook' : 'all');
      setZaloConvs(res.conversations || []);
    } catch (err) {
      console.error("Lỗi tải Pancake conversations:", err);
    } finally {
      setIsSearchingZalo(false);
    }
  };

  // Load shop variations
  const loadShopVariations = async () => {
    setIsLoadingVariations(true);
    try {
      const res = await fetchPancakeVariations();
      if (res.success && res.variations) {
        setShopVariations(res.variations);
      }
    } catch (err) {
      console.warn("Lỗi tải danh mục Pancake POS:", err);
    } finally {
      setIsLoadingVariations(false);
    }
  };

  // Tra cứu tự động thông tin khách hàng từ Pancake dựa vào Số điện thoại
  const handleLookupByPhone = async (phoneToLookup?: string) => {
    const targetPhone = (phoneToLookup || recipientPhone || '').trim();
    const cleanDigits = targetPhone.replace(/\D/g, '');
    if (cleanDigits.length < 9 || isShopPhone(cleanDigits)) return;

    setIsLookingUpPhone(true);
    try {
      const result = await lookupCustomerByPhone(cleanDigits);
      if (result.success) {
        if (result.name && result.name.trim()) {
          setRecipientName(result.name.trim());
        }
        if (result.address && result.address.trim()) {
          setRecipientAddress(result.address.trim());
        }
        if (result.phone && !isShopPhone(result.phone)) {
          setRecipientPhone(result.phone);
        }
        if (!pancakeLink) {
          setPancakeLink(result.phone || cleanDigits);
          store.setCustomerPancakeLink(platform, cleanUser, result.phone || cleanDigits);
        }
        if (result.conversationId || result.pageId) {
          setLinkedConvCustomer(prev => ({
            name: result.name || prev?.name || "",
            phone: (result.phone && !isShopPhone(result.phone)) ? result.phone : prev?.phone,
            address: result.address || prev?.address || "",
            customerId: result.customerId || prev?.customerId,
            conversationId: result.conversationId || prev?.conversationId,
            pageId: result.pageId || prev?.pageId
          }));
        }
      }
    } catch (err) {
      console.error("Lỗi tra cứu SĐT Pancake:", err);
    } finally {
      setIsLookingUpPhone(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const currentLink = store[platform].pancakeLinks?.[cleanUser] || '';
      setPancakeLink(currentLink);
      setCreatedOrder(null);
      setPushResult(null);
      setManualMessageStatus(null);
      setIsSendingManualMessage(false);
      setIsParsingLink(false);
      setErrorMessage(null);
      setPickingVarForIdx(null);
      setEditingItemIdx(null);

      // Build initial order items from store
      const currentItems = cust?.items || [];
      const pastItems = cust?.pastItems || [];

      const initialItems: EditablePushItem[] = [];

      selectedCurrentIndices.forEach(idx => {
        const it = currentItems[idx];
        if (it) {
          const rawContent = (it.content || '').trim();
          const cleanContent = (!rawContent || rawContent === "(Không ghi chú)" || rawContent.toLowerCase().includes("không ghi chú")) ? "" : rawContent;
          const itemUnitPrice = it.unitPrice || it.price || 0;
          const itemQty = it.quantity || 1;
          initialItems.push({
            id: it.id,
            content: cleanContent || `Sản phẩm ${itemUnitPrice}k`,
            priceK: itemUnitPrice,
            quantity: itemQty,
            isPast: false,
            originalIndex: idx
          });
        }
      });

      selectedPastIndices.forEach(idx => {
        const it = pastItems[idx];
        if (it) {
          const rawContent = (it.content || '').trim();
          const cleanContent = (!rawContent || rawContent === "(Không ghi chú)" || rawContent.toLowerCase().includes("không ghi chú")) ? "" : rawContent;
          const itemUnitPrice = it.unitPrice || it.price || 0;
          const itemQty = it.quantity || 1;
          initialItems.push({
            id: it.id,
            content: cleanContent || `Sản phẩm ${itemUnitPrice}k`,
            priceK: itemUnitPrice,
            quantity: itemQty,
            isPast: true,
            originalIndex: idx
          });
        }
      });

      setOrderItems(initialItems);
      setCustomNote('');

      // Insight lookup
      const currentInsight = getCustomerInsight(cleanUser);
      setInsight(currentInsight);

      // Trích xuất SĐT từ nhiều nguồn: Insight -> Link -> Nickname/Note/Comments (loại trừ số shop)
      let detectedPhone = currentInsight?.matchedPhone || '';
      if (isShopPhone(detectedPhone)) detectedPhone = '';

      if (!detectedPhone && currentLink) {
        const parsed = parsePancakeContact(currentLink);
        if (parsed.type === 'phone_zalo' && parsed.phone && !isShopPhone(parsed.phone)) {
          detectedPhone = parsed.phone;
        }
      }
      if (!detectedPhone) {
        const phoneRegex = /(?:0|\+?84)(?:3|5|7|8|9)\d{8}/;
        const nickMatch = (nickname || '').match(phoneRegex);
        if (nickMatch && !isShopPhone(nickMatch[0])) detectedPhone = nickMatch[0];
      }

      setRecipientName(currentInsight?.matchedName || nickname || cleanUser);
      setRecipientPhone(detectedPhone || '');
      setRecipientAddress(currentInsight?.matchedAddress || '');

      // Tự động nhận diện tiền cọc theo tag: COC (50k), COC_100 (100k)
      const currentTag = store[platform].tags?.[cleanUser] || 'NORMAL';
      if (currentTag === 'COC') {
        setPrepaidAmount(50000);
      } else if (currentTag === 'COC_100') {
        setPrepaidAmount(100000);
      } else {
        setPrepaidAmount(0);
      }

      // Nếu có Link hoặc SĐT hợp lệ, tra cứu Pancake POS
      if (currentLink) {
        handleLinkChange(currentLink);
      } else if (detectedPhone && !isShopPhone(detectedPhone)) {
        handleLookupByPhone(detectedPhone);
      } else {
        loadZaloConvs();
      }

      // Load shop variations from Pancake POS
      loadShopVariations();
    }
  }, [isOpen, cleanUser, platform]);

  if (!isOpen) return null;

  // Pricing calculations (Toàn bộ tiền hàng, Pancake POS tự động tính cước vận chuyển)
  const totalItemsPriceK = orderItems.reduce((sum, it) => sum + ((it.priceK || 0) * (it.quantity || 1)), 0);
  const totalItemsPriceVnd = totalItemsPriceK * 1000;

  const handleSelectZaloConv = (conv: ZaloInboxConversation) => {
    const link = conv.deepLink;
    setPancakeLink(link);
    store.setCustomerPancakeLink(platform, cleanUser, link);
    
    // Gán trực tiếp tên tài khoản Zalo liên kết cho người nhận đơn trên Pancake POS
    if (conv.name) {
      setRecipientName(conv.name);
    }
    const cleanConvPhone = conv.phone && !isShopPhone(conv.phone) ? conv.phone : "";
    if (cleanConvPhone) {
      setRecipientPhone(cleanConvPhone);
      handleLookupByPhone(cleanConvPhone);
    }
    if (conv.address) {
      setRecipientAddress(conv.address);
    }

    setLinkedConvCustomer({
      name: conv.name,
      phone: cleanConvPhone || undefined,
      address: conv.address,
      customerId: conv.customerId,
      conversationId: conv.id,
      pageId: conv.pageId
    });

    syncSingleCustomerPancakeOrders(cleanUser, platform, link);
    setShowZaloPicker(false);
  };

  const handleQuantityChange = (idx: number, delta: number) => {
    setOrderItems(prev => {
      const updated = [...prev];
      const target = updated[idx];
      if (target) {
        const nextQty = Math.max(1, (target.quantity || 1) + delta);
        updated[idx] = { ...target, quantity: nextQty };
      }
      return updated;
    });
  };

  const handleItemFieldChange = (idx: number, field: keyof EditablePushItem, value: any) => {
    setOrderItems(prev => {
      const updated = [...prev];
      if (updated[idx]) {
        updated[idx] = { ...updated[idx], [field]: value };
      }
      return updated;
    });
  };

  const handleRemoveItem = (idx: number) => {
    setOrderItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAddNewItem = () => {
    setOrderItems(prev => [
      ...prev,
      {
        content: `Sản phẩm ${prev.length + 1}`,
        priceK: 100,
        quantity: 1,
        isPast: false
      }
    ]);
  };

  const handleSelectVariationForItem = (itemIdx: number, variation: PancakeVariation) => {
    setOrderItems(prev => {
      const updated = [...prev];
      if (updated[itemIdx]) {
        const priceInK = Math.round(variation.retailPrice / 1000) || updated[itemIdx].priceK;
        updated[itemIdx] = {
          ...updated[itemIdx],
          content: variation.name,
          priceK: priceInK > 0 ? priceInK : updated[itemIdx].priceK,
          variationId: variation.id,
          variationName: variation.variationName || variation.name,
          productName: variation.productName || variation.name,
          displayId: variation.displayId
        };
      }
      return updated;
    });
    setPickingVarForIdx(null);
  };

  const handlePushOrder = async () => {
    if (orderItems.length === 0) {
      setErrorMessage("Vui lòng có ít nhất 1 sản phẩm để đẩy đơn vào Pancake POS.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const itemsPayload = orderItems.map(it => {
        const rawContent = (it.content || '').trim();
        const cleanContent = (!rawContent || rawContent === "(Không ghi chú)" || rawContent.toLowerCase().includes("không ghi chú")) ? "" : rawContent;
        return {
          id: it.id,
          content: cleanContent || `Sản phẩm ${it.priceK}k`,
          price: it.priceK || 0,
          quantity: it.quantity || 1,
          variationId: it.variationId,
          variationName: it.variationName,
          productName: it.productName,
          isPast: it.isPast
        };
      });

      const finalPhone = isShopPhone(recipientPhone) ? "" : recipientPhone.trim();
      const parsed = parsePancakeUrlIds(pancakeLink.trim());
      const pId = linkedConvCustomer?.pageId || parsed.pageId || (pancakeLink.includes('pzl') ? 'pzl_2007152536191688636' : undefined);
      const cId = linkedConvCustomer?.conversationId || parsed.convId || (pancakeLink.startsWith('pzl_') ? pancakeLink.trim() : undefined);
      const custId = linkedConvCustomer?.customerId || undefined;

      const currentCustTag = store[platform].tags?.[cleanUser];

      const res = await pushCustomerOrderToPancake({
        platform,
        user: cleanUser,
        nickname,
        pancakeLink: pancakeLink.trim(),
        items: itemsPayload,
        shippingFee,
        prepaid: prepaidAmount,
        tag: currentCustTag,
        customCustomerInfo: {
          name: recipientName.trim() || undefined,
          phone: finalPhone || undefined,
          address: recipientAddress.trim() || undefined,
          pageId: pId,
          conversationId: cId,
          customerId: custId
        },
        sendNotificationMessage: autoSendMessage
      });

      if (!res.success) {
        setErrorMessage(res.error || "Không thể đẩy đơn lên Pancake. Vui lòng kiểm tra lại SĐT hoặc kết nối.");
        setIsSubmitting(false);
        return;
      }

      setCreatedOrder(res.order);
      setPushResult(res);

      // Tự động gỡ tag Cọc (COC / COC_100) và chuyển khách về khách thường (NORMAL) sau khi đẩy đơn thành công
      if (currentCustTag === 'COC' || currentCustTag === 'COC_100') {
        store.setCustomerTag(platform, cleanUser, 'NORMAL');
      }

      // Nếu khách có nhập SĐT và chưa có link, lưu SĐT làm liên kết mặc định
      if (finalPhone && !pancakeLink) {
        store.setCustomerPancakeLink(platform, cleanUser, finalPhone);
      }

      // Auto mark past items as shipped if checked
      const pastItemsInOrder = orderItems.filter(it => it.isPast && it.originalIndex !== undefined);
      if (autoMarkShipped && pastItemsInOrder.length > 0) {
        pastItemsInOrder.forEach(it => {
          if (it.originalIndex !== undefined) {
            store.togglePastItemShipped(platform, cleanUser, it.originalIndex);
          }
        });
      }

      onSuccess?.(res.order);
    } catch (err: any) {
      setErrorMessage(err?.message || "Lỗi khi gửi yêu cầu tạo đơn lên Pancake");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredZaloConvs = zaloConvs.filter(c => {
    if (!zaloSearchQuery.trim()) return true;
    const q = zaloSearchQuery.toLowerCase().trim();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.snippet && c.snippet.toLowerCase().includes(q))
    );
  });

  const filteredShopVariations = shopVariations.filter(v => {
    if (!variationSearchQuery.trim()) return true;
    const q = variationSearchQuery.toLowerCase().trim();
    return (
      v.name.toLowerCase().includes(q) ||
      (v.productName && v.productName.toLowerCase().includes(q)) ||
      (v.variationName && v.variationName.toLowerCase().includes(q)) ||
      (v.displayId && v.displayId.toLowerCase().includes(q)) ||
      (v.barcode && v.barcode.includes(q))
    );
  });

  const parsedContact = parsePancakeContact(pancakeLink || recipientPhone);
  const hasPhone = !!recipientPhone.trim() || parsedContact.type === 'phone_zalo';

  return (
    <div className="fixed inset-0 bg-black/75 z-[120] flex items-center justify-center p-2 sm:p-4 overflow-y-auto backdrop-blur-xs">
      <div className="bg-[#182230] rounded-2xl w-full max-w-xl max-h-[94vh] flex flex-col overflow-hidden shadow-2xl border border-orange-500/30 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 p-3.5 sm:p-4 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🥞</span>
            <div>
              <h3 className="font-black text-base sm:text-lg leading-tight flex items-center gap-1.5">
                Đẩy Đơn Vào Pancake POS
              </h3>
              <div className="text-xs text-orange-100 font-medium">
                Tạo đơn hàng tự động & chuẩn hóa sản phẩm với Pancake POS
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-white font-bold transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto flex-1 p-3.5 sm:p-5 space-y-4 text-gray-200">

          {/* Success Screen */}
          {createdOrder ? (
            <div className="py-6 flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 text-3xl animate-bounce">
                ✓
              </div>
              <div className="space-y-1">
                <h4 className="text-xl font-black text-emerald-400">
                  TẠO ĐƠN PANCAKE THÀNH CÔNG!
                </h4>
                <p className="text-sm text-gray-300">
                  Mã đơn hàng: <strong className="text-orange-400 text-base font-mono">#{createdOrder.display_id || createdOrder.id}</strong> {createdOrder.custom_id ? `(${createdOrder.custom_id})` : ''}
                </p>
                <p className="text-xs text-gray-400">
                  Khách: <span className="text-white font-bold">{recipientName || cleanUser}</span> • Tiền hàng: <span className="text-emerald-300 font-black">{totalItemsPriceVnd.toLocaleString('vi-VN')}đ</span>
                </p>
                {recipientPhone && (
                  <p className="text-xs text-emerald-400 font-mono font-bold">
                    📞 SĐT đơn: {recipientPhone}
                  </p>
                )}
              </div>

              {/* Trạng thái gửi tin nhắn tự động vào hội thoại Pancake */}
              {pushResult?.messageSent ? (
                <div className="w-full p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center justify-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span className="font-bold">Đã gửi tin nhắn báo đơn thành công vào hội thoại của khách trên Pancake!</span>
                </div>
              ) : (
                <div className="w-full p-3 bg-amber-500/20 border border-amber-500/40 rounded-xl text-xs text-amber-300 space-y-2 text-left">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} className="text-amber-400 shrink-0" />
                    <span className="font-bold">
                      {pancakeLink 
                        ? (pushResult?.messageError || "Chưa gửi tin nhắn báo khách qua Pancake API") 
                        : "Khách chưa liên kết hội thoại Pancake nên chưa thể tự động gửi tin nhắn."}
                    </span>
                  </div>
                  {pancakeLink && (
                    <button
                      type="button"
                      onClick={handleSendOrderMessageManually}
                      disabled={isSendingManualMessage}
                      className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isSendingManualMessage ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                      <span>Gửi lại tin nhắn báo đơn vào Pancake ngay</span>
                    </button>
                  )}
                  {manualMessageStatus && (
                    <div className="text-[11px] text-amber-200 font-medium pt-1">
                      {manualMessageStatus}
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons on Success */}
              <div className="w-full space-y-2 pt-2">
                {pancakeLink && (
                  <button
                    type="button"
                    onClick={() => openPancakeApp(pancakeLink, true)}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-950/50 active:scale-98 transition-all cursor-pointer"
                  >
                    <Smartphone size={16} />
                    <span>Mở Đơn / Chat Với Khách Trên App Pancake</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const itemsToPrint = orderItems.map(it => ({
                      content: `${it.content}${it.quantity > 1 ? ` (x${it.quantity})` : ''}`,
                      price: (it.priceK || 0) * (it.quantity || 1)
                    }));
                    const timeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                    const displayName = nickname ? `${cleanUser} (${nickname})` : `#${getShortId(cleanUser)} ${cleanUser}`;
                    printBill(displayName, itemsToPrint, totalItemsPriceK, PLATFORMS[platform].label, timeStr);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#233246] hover:bg-[#2c3e56] text-blue-300 font-bold text-xs flex items-center justify-center gap-2 border border-blue-500/30 transition-all cursor-pointer"
                >
                  <span>🖨️ In Bill Tính Tiền / Hóa Đơn Khách</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 font-bold text-xs transition-colors cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Customer & Pancake Link Banner */}
              <div className="bg-[#0f1723] p-3 rounded-xl border border-white/10 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CustomerAvatar user={cleanUser} platform={platform} tag={tag} size="md" />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-white text-sm">@{cleanUser}</span>
                        {nickname && <span className="text-xs text-orange-300 font-bold">({nickname})</span>}
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold text-white ${PLATFORMS[platform].bgClass}`}>
                          {PLATFORMS[platform].label.split(' ')[0]}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {pancakeLink ? (
                          <span className="text-emerald-400 font-medium flex items-center gap-1">
                            <CheckCircle2 size={12} /> {parsePancakeContact(pancakeLink).label}
                          </span>
                        ) : hasPhone ? (
                          <span className="text-emerald-400 font-medium flex items-center gap-1">
                            <Phone size={12} /> SĐT: <strong className="font-mono">{recipientPhone}</strong>
                          </span>
                        ) : (
                          <span className="text-amber-400 font-medium flex items-center gap-1">
                            <AlertCircle size={12} /> Dán link hội thoại Pancake bên dưới để liên kết & nhắn tin
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowZaloPicker(!showZaloPicker)}
                    className="text-xs text-orange-300 hover:text-white bg-orange-950/40 hover:bg-orange-900/60 px-2.5 py-1.5 rounded-lg border border-orange-500/40 flex items-center gap-1 font-bold transition-colors cursor-pointer shrink-0"
                  >
                    <span>{showZaloPicker ? "Đóng danh sách Zalo ▲" : "Chọn từ Zalo ▼"}</span>
                  </button>
                </div>

                {/* Ô dán trực tiếp link hội thoại Pancake (từ app Pancake) */}
                <div className="bg-[#141e2c] p-2.5 rounded-xl border border-white/10 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-gray-300 flex items-center gap-1.5">
                      <MessageSquare size={13} className="text-orange-400" />
                      <span>Link hội thoại Pancake (sao chép từ App Pancake):</span>
                    </label>
                    <button
                      type="button"
                      onClick={handlePasteFromClipboard}
                      className="text-[10px] text-orange-300 hover:text-white bg-orange-950/50 hover:bg-orange-900/70 px-2 py-0.5 rounded border border-orange-500/30 flex items-center gap-1 font-bold cursor-pointer transition-colors"
                      title="Dán link từ bộ nhớ tạm clipboard"
                    >
                      <Clipboard size={11} />
                      <span>Dán nhanh</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={pancakeLink}
                      onChange={e => handleLinkChange(e.target.value)}
                      placeholder="Dán link cuộc trò chuyện từ app Pancake (ví dụ: https://pages.fm/...)"
                      className="w-full py-1.5 px-2.5 bg-[#0f1723] border border-white/15 focus:border-orange-500 rounded-lg text-xs text-white placeholder-gray-500 outline-none"
                    />
                    {pancakeLink && (
                      <button
                        type="button"
                        onClick={() => handleLinkChange('')}
                        className="text-gray-400 hover:text-white text-xs px-2 py-1 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                        title="Xóa link"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {isParsingLink && (
                    <div className="text-[11px] text-orange-300 flex items-center gap-1">
                      <RefreshCw size={11} className="animate-spin" />
                      <span>Đang tải thông tin khách từ hội thoại Pancake...</span>
                    </div>
                  )}

                  {pancakeLink && (() => {
                    const parsed = parsePancakeUrlIds(pancakeLink);
                    if (parsed.convId) {
                      return (
                        <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                          <CheckCircle2 size={12} />
                          <span>Đã liên kết hội thoại Pancake! Sẵn sàng tự động gửi tin nhắn báo chốt đơn khi tạo thành công.</span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* Tùy chọn tự động gửi tin nhắn báo chốt đơn vào Pancake */}
                <div className="bg-[#141e2c] p-2.5 rounded-xl border border-orange-500/30 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={autoSendMessage}
                        onChange={e => setAutoSendMessage(e.target.checked)}
                        className="rounded border-white/20 w-4 h-4 text-orange-600 focus:ring-orange-500 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <MessageCircle size={14} className="text-orange-400" />
                        <span>Tự động gửi tin nhắn báo chốt đơn vào Pancake sau khi tạo đơn</span>
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowMessagePreview(!showMessagePreview)}
                      className="text-[11px] text-orange-400 hover:text-orange-300 font-medium cursor-pointer"
                    >
                      {showMessagePreview ? "Ẩn mẫu tin ▲" : "Xem mẫu tin ▼"}
                    </button>
                  </div>

                  {showMessagePreview && (
                    <div className="p-2.5 bg-[#0d131c] rounded-md border border-white/10 text-[11px] text-gray-300 whitespace-pre-wrap font-mono leading-relaxed mt-1">
                      {`Dạ em chào ${recipientName || cleanUser}, Shop đã tạo đơn thành công cho mình trên Live ạ! ❤️\n\n📦 Mã đơn hàng: #(Mã đơn Pancake)\n🛍️ Chi tiết sản phẩm (${orderItems.length} món):\n${orderItems.map(it => `  + ${it.content} (${it.priceK}k x ${it.quantity})`).join('\n')}\n💰 Tiền hàng: ${totalItemsPriceVnd.toLocaleString('vi-VN')}đ\n🚚 Phí vận chuyển: ${shippingFee.toLocaleString('vi-VN')}đ\n${prepaidAmount > 0 ? `💳 Đã trừ cọc chuyển khoản: -${prepaidAmount.toLocaleString('vi-VN')}đ\n` : ''}💵 Còn lại thu COD: ${Math.max(0, totalItemsPriceVnd + shippingFee - prepaidAmount).toLocaleString('vi-VN')}đ\n\nShop sẽ sớm đóng gói và gửi hàng cho mình nhé. Cảm ơn chị yêu đã ủng hộ shop ạ! 🥰`}
                    </div>
                  )}
                </div>

                {/* Inline Zalo Picker Dropdown */}
                {showZaloPicker && (
                  <div className="mt-1 pt-2 border-t border-white/10 space-y-2">
                    <input
                      type="text"
                      value={zaloSearchQuery}
                      onChange={e => setZaloSearchQuery(e.target.value)}
                      placeholder="Tìm tên hoặc SĐT khách trong Zalo..."
                      className="w-full py-1 px-2.5 bg-[#182433] border border-white/15 rounded-lg text-xs text-white focus:outline-none focus:border-orange-500"
                    />
                    <div className="max-h-36 overflow-y-auto space-y-1">
                      {isSearchingZalo ? (
                        <div className="text-center py-2 text-xs text-gray-400 flex items-center justify-center gap-1.5">
                          <RefreshCw size={12} className="animate-spin" /> Đang tải Zalo...
                        </div>
                      ) : filteredZaloConvs.length === 0 ? (
                        <div className="text-center py-2 text-xs text-gray-500 italic">
                          Không tìm thấy cuộc trò chuyện Zalo phù hợp.
                        </div>
                      ) : (
                        filteredZaloConvs.map(c => (
                          <div
                            key={c.id}
                            className="p-1.5 rounded-lg hover:bg-orange-500/20 flex items-center justify-between gap-2 border border-white/5 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-white truncate">{c.name}</div>
                              {c.phone && <div className="text-[10px] text-emerald-400 font-mono">{c.phone}</div>}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSelectZaloConv(c)}
                              className="text-[11px] font-bold bg-orange-600 hover:bg-orange-500 text-white px-2 py-0.5 rounded shrink-0 cursor-pointer"
                            >
                              Chọn
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* PRODUCTS & ORDER ITEMS SECTION (KIỂU HOÁ ĐƠN CHUẨN HÌNH 3 & BẢNG TÍNH MÁY TÍNH) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Package size={14} className="text-orange-400" />
                    <span>Chi tiết sản phẩm ({orderItems.length} món):</span>
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCalculatorOpen(true)}
                      className="text-[11px] font-bold text-emerald-300 hover:text-white bg-emerald-950/60 hover:bg-emerald-900/80 px-2.5 py-1 rounded-lg border border-emerald-500/40 flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-sm"
                    >
                      <Plus size={12} className="stroke-[3]" />
                      <span>+ Thêm món (Bảng tính)</span>
                    </button>
                    <div className="text-xs font-black text-emerald-400 font-mono">
                      {totalItemsPriceVnd.toLocaleString('vi-VN')}đ
                    </div>
                  </div>
                </div>

                {/* Items List - FORMAT DẠNG HOÁ ĐƠN CHUẨN (HÌNH 3) */}
                <div className="bg-[#0e1724] rounded-2xl border border-white/10 p-3 sm:p-3.5 space-y-3 shadow-md">
                  {orderItems.length === 0 ? (
                    <div className="text-xs text-gray-400 text-center py-6 italic space-y-2.5 bg-[#09101a] rounded-xl border border-dashed border-white/10">
                      <div>Chưa có sản phẩm nào trong đơn hàng.</div>
                      <button
                        type="button"
                        onClick={() => setIsCalculatorOpen(true)}
                        className="text-xs text-emerald-400 font-bold underline hover:text-emerald-300 cursor-pointer"
                      >
                        + Bấm vào đây để mở Bảng tính thêm món
                      </button>
                    </div>
                  ) : (
                    <>
                      {orderItems.map((item, idx) => {
                        const itemUnitPrice = item.priceK || 0;
                        const itemQty = item.quantity || 1;
                        const itemTotalK = itemUnitPrice * itemQty;
                        const itemUnitPriceVnd = itemUnitPrice * 1000;
                        const itemTotalVnd = itemTotalK * 1000;
                        const displayName = item.content || `Sản phẩm ${itemUnitPrice}k`;
                        const isPickingThisVar = pickingVarForIdx === idx;

                        return (
                          <div
                            key={`order-item-${idx}`}
                            className="p-3 rounded-xl bg-[#141f2e] border border-white/10 hover:border-white/20 shadow-xs space-y-2 relative transition-all"
                          >
                            {/* Dòng 1: Tên sản phẩm (Trái) & Thành tiền to đậm (Phải) */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="text-gray-400 font-mono text-xs font-bold w-4 shrink-0">{idx + 1}.</span>
                                <input
                                  type="text"
                                  value={item.content}
                                  onChange={e => handleItemFieldChange(idx, 'content', e.target.value)}
                                  placeholder="Tên sản phẩm / mã hàng..."
                                  className="bg-[#0b1320] border border-white/15 focus:border-cyan-500 rounded-lg px-2.5 py-1 text-sm font-black text-white w-full outline-none"
                                />
                              </div>

                              <div className="text-right shrink-0">
                                <span className="font-mono font-black text-base sm:text-lg text-white tracking-tight">
                                  {itemTotalVnd.toLocaleString('vi-VN')}
                                </span>
                                <span className="text-xs text-gray-400 font-normal ml-0.5">đ</span>
                              </div>
                            </div>

                            {/* Dòng 2: Công thức [SL x Đơn giá] (Trái) & Thao tác (Phải) */}
                            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/5 pl-6">
                              <div className="text-xs sm:text-sm font-medium text-gray-400 font-mono flex items-center gap-1.5">
                                <span>{itemQty} x {itemUnitPriceVnd.toLocaleString('vi-VN')}</span>
                                <span className="text-[10px] text-gray-500 font-sans">({itemUnitPrice}k/cái)</span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {/* Quantity Stepper */}
                                <div className="flex items-center bg-[#0b1320] rounded-lg border border-white/15 p-0.5">
                                  <button
                                    type="button"
                                    onClick={() => handleQuantityChange(idx, -1)}
                                    className="w-5 h-5 rounded flex items-center justify-center text-gray-300 hover:bg-white/10 hover:text-white font-bold cursor-pointer"
                                  >
                                    -
                                  </button>
                                  <span className="w-5 text-center font-bold text-white text-xs font-mono">
                                    {itemQty}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleQuantityChange(idx, 1)}
                                    className="w-5 h-5 rounded flex items-center justify-center text-gray-300 hover:bg-white/10 hover:text-white font-bold cursor-pointer"
                                  >
                                    +
                                  </button>
                                </div>

                                {/* POS Variation Picker */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPickingVarForIdx(isPickingThisVar ? null : idx);
                                    setVariationSearchQuery('');
                                  }}
                                  className="text-[10px] font-bold text-orange-300 hover:text-white bg-orange-950/30 hover:bg-orange-900/50 px-2 py-1 rounded-lg border border-orange-500/30 flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
                                >
                                  <Layers size={10} />
                                  <span>{item.variationId ? "Đổi POS" : "Kho POS"}</span>
                                </button>

                                {/* Delete button */}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="text-gray-500 hover:text-red-400 p-1 rounded-md hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                                  title="Xóa món này"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>

                            {/* Barcode & Past item badge */}
                            <div className="flex items-center gap-1.5 pl-6 pt-0.5 flex-wrap">
                              {item.variationId ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30 text-[10px] truncate max-w-full">
                                  <Check size={10} />
                                  <strong className="font-mono">Barcode: {item.displayId || `0${item.priceK}`}</strong>
                                  <span className="truncate">• {item.variationName || item.productName || item.content}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/15 text-blue-300 rounded border border-blue-500/20 text-[10px]">
                                  <Sparkles size={10} className="text-blue-400" />
                                  <span>Barcode: <strong className="font-mono text-cyan-300">0{item.priceK}</strong> (Tự tìm / tạo POS)</span>
                                </span>
                              )}
                              {item.isPast && (
                                <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded border border-amber-500/30 font-bold text-[10px] shrink-0">
                                  Giữ phiên trước
                                </span>
                              )}
                            </div>

                            {/* Inline Variation Picker Dropdown */}
                            {isPickingThisVar && (
                              <div className="mt-2 p-2.5 bg-[#0a111b] rounded-xl border border-orange-500/40 space-y-2 z-10 animate-in fade-in zoom-in-95">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-[11px] font-black text-orange-300 flex items-center gap-1">
                                    <Layers size={12} />
                                    <span>Chọn sản phẩm từ kho Pancake POS:</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setPickingVarForIdx(null)}
                                    className="text-gray-400 hover:text-white text-xs"
                                  >
                                    ✕
                                  </button>
                                </div>

                                <div className="relative">
                                  <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                                  <input
                                    type="text"
                                    value={variationSearchQuery}
                                    onChange={e => setVariationSearchQuery(e.target.value)}
                                    placeholder="Tìm theo tên sản phẩm, mã SKU, barcode..."
                                    className="w-full py-1 pl-6 pr-2 bg-[#141f2e] border border-white/15 rounded-lg text-xs text-white placeholder-gray-500 outline-none focus:border-orange-500"
                                  />
                                </div>

                                <div className="max-h-40 overflow-y-auto space-y-1 hide-scrollbar">
                                  {isLoadingVariations ? (
                                    <div className="text-center py-3 text-xs text-gray-400 flex items-center justify-center gap-1.5">
                                      <RefreshCw size={12} className="animate-spin text-orange-400" />
                                      <span>Đang tải danh mục kho Pancake POS...</span>
                                    </div>
                                  ) : filteredShopVariations.length === 0 ? (
                                    <div className="text-center py-2 text-xs text-gray-400 italic">
                                      Không tìm thấy sản phẩm phù hợp trong kho.
                                    </div>
                                  ) : (
                                    filteredShopVariations.map(v => (
                                      <div
                                        key={v.id}
                                        onClick={() => handleSelectVariationForItem(idx, v)}
                                        className="p-1.5 rounded-lg hover:bg-orange-500/20 flex items-center justify-between gap-2 border border-white/5 cursor-pointer text-xs transition-colors"
                                      >
                                        <div className="min-w-0 flex-1">
                                          <div className="font-bold text-white truncate">{v.name}</div>
                                          <div className="text-[10px] text-gray-400 flex items-center gap-2">
                                            {v.displayId && <span className="font-mono text-orange-300">SKU: {v.displayId}</span>}
                                            {v.remainQuantity !== null && <span>Kho: {v.remainQuantity}</span>}
                                          </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                          <span className="font-bold text-cyan-300 text-xs">
                                            {v.retailPrice.toLocaleString('vi-VN')}đ
                                          </span>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* 🌟 CARD TỔNG CỘNG (CHÍNH XÁC NHƯ HÌNH 3: SL: X CÁI | TỔNG CỘNG | xxx.000 đ) */}
                      {(() => {
                        const totalQty = orderItems.reduce((sum, it) => sum + (it.quantity || 1), 0);
                        return (
                          <div className="bg-gradient-to-r from-[#0a121d] via-[#0f1b2b] to-[#0a121d] border-2 border-emerald-500/40 rounded-2xl p-3.5 sm:p-4.5 flex items-center justify-between shadow-xl mt-3">
                            <div>
                              <div className="text-xs sm:text-sm font-black text-gray-400 tracking-wider uppercase font-mono">
                                SL: {totalQty} CÁI
                              </div>
                              <div className="text-lg sm:text-2xl font-black text-white tracking-wide uppercase mt-0.5">
                                TỔNG CỘNG
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono tracking-tight">
                                {totalItemsPriceVnd.toLocaleString('vi-VN')}
                              </span>
                              <span className="text-emerald-400 font-bold text-base sm:text-lg ml-1">đ</span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Nút Thêm Món Bằng Bảng Tính */}
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => setIsCalculatorOpen(true)}
                          className="w-full py-2.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 hover:text-white border border-emerald-500/40 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-98 shadow-md"
                        >
                          <Plus size={14} className="stroke-[3]" />
                          <span>+ Thêm món bằng Bảng tính máy tính</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Shipping Recipient Info */}
              <div className="bg-[#0f1723] p-3 rounded-xl border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin size={13} className="text-orange-400" />
                    <span>Thông tin nhận hàng & SĐT tạo đơn:</span>
                  </div>
                  {recipientPhone && (
                    <button
                      type="button"
                      onClick={() => handleLookupByPhone(recipientPhone)}
                      disabled={isLookingUpPhone}
                      className="text-[10px] text-orange-300 hover:text-white bg-orange-950/40 hover:bg-orange-900/60 px-2 py-0.5 rounded border border-orange-500/30 flex items-center gap-1 font-bold cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw size={10} className={isLookingUpPhone ? "animate-spin" : ""} />
                      <span>{isLookingUpPhone ? "Đang tra cứu..." : "Tra cứu Pancake"}</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 mb-0.5">Số điện thoại (SĐT):</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={recipientPhone}
                        onChange={e => {
                          const val = e.target.value;
                          setRecipientPhone(val);
                          const digits = val.replace(/\D/g, '');
                          if (digits.length === 10 || digits.length === 11) {
                            handleLookupByPhone(digits);
                          }
                        }}
                        placeholder="Nhập SĐT khách (ví dụ 0987...)"
                        className="w-full py-1.5 px-2 bg-[#182433] border border-white/15 rounded-lg text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-orange-500 placeholder-gray-500"
                      />
                      {recipientPhone && (
                        <button
                          type="button"
                          onClick={() => handleLookupByPhone(recipientPhone)}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-orange-400 font-bold hover:text-orange-300 cursor-pointer"
                          title="Tra cứu tên & địa chỉ từ Pancake"
                        >
                          🔍
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 mb-0.5">Tên người nhận:</label>
                    <input
                      type="text"
                      value={recipientName}
                      onChange={e => setRecipientName(e.target.value)}
                      placeholder="Tên khách hàng"
                      className="w-full py-1.5 px-2 bg-[#182433] border border-white/15 rounded-lg text-xs font-bold text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-0.5">Địa chỉ giao hàng:</label>
                  <input
                    type="text"
                    value={recipientAddress}
                    onChange={e => setRecipientAddress(e.target.value)}
                    placeholder="Địa chỉ nhà, phường/xã, quận/huyện, tỉnh/thành..."
                    className="w-full py-1.5 px-2 bg-[#182433] border border-white/15 rounded-lg text-xs font-medium text-white focus:outline-none focus:border-orange-500"
                  />
                </div>

                {/* Phí vận chuyển mặc định: Ninh Thuận 15k, các tỉnh khác 20k */}
                <div className="bg-[#141e2c] p-2.5 rounded-lg border border-orange-500/20 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <label className="text-[11px] font-bold text-gray-300 flex items-center gap-1.5">
                      <span>🚚 Phí vận chuyển (Ship):</span>
                      <span className="text-[10px] font-medium text-amber-400">
                        {shippingFee === 15000 ? "Ninh Thuận (15.000₫)" : shippingFee === 20000 ? "Tỉnh khác (20.000₫)" : `${shippingFee.toLocaleString('vi-VN')}₫`}
                      </span>
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShippingFee(15000)}
                        className={`text-[10px] px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                          shippingFee === 15000
                            ? "bg-orange-600 text-white shadow-sm shadow-orange-950"
                            : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                        }`}
                      >
                        Ninh Thuận (15k)
                      </button>
                      <button
                        type="button"
                        onClick={() => setShippingFee(20000)}
                        className={`text-[10px] px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                          shippingFee === 20000
                            ? "bg-orange-600 text-white shadow-sm shadow-orange-950"
                            : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                        }`}
                      >
                        Tỉnh khác (20k)
                      </button>
                      <button
                        type="button"
                        onClick={() => setShippingFee(0)}
                        className={`text-[10px] px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                          shippingFee === 0
                            ? "bg-emerald-600 text-white shadow-sm shadow-emerald-950"
                            : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                        }`}
                      >
                        Freeship (0đ)
                      </button>
                    </div>
                  </div>
                  {/* Tiền cọc trước (Chuyển khoản) */}
                  <div className="flex items-center justify-between text-xs pt-1.5 border-t border-white/5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-gray-400 text-[11px]">Cọc trước (CK):</span>
                      {store[platform].tags?.[cleanUser] === 'COC' && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded font-bold">💧 Cọc 50k</span>
                      )}
                      {store[platform].tags?.[cleanUser] === 'COC_100' && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded font-bold">💧 Cọc 100k</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPrepaidAmount(0)}
                        className={`text-[10px] px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                          prepaidAmount === 0
                            ? "bg-gray-600 text-white shadow-sm"
                            : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                        }`}
                      >
                        0đ
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrepaidAmount(50000)}
                        className={`text-[10px] px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                          prepaidAmount === 50000
                            ? "bg-cyan-600 text-white shadow-sm shadow-cyan-950"
                            : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                        }`}
                      >
                        -50k
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrepaidAmount(100000)}
                        className={`text-[10px] px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                          prepaidAmount === 100000
                            ? "bg-blue-600 text-white shadow-sm shadow-blue-950"
                            : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                        }`}
                      >
                        -100k
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1.5 border-t border-white/5">
                    <div className="text-gray-400 text-[11px] flex items-center gap-1 flex-wrap">
                      <span>Hàng:</span>
                      <span className="font-bold text-white">{totalItemsPriceVnd.toLocaleString('vi-VN')}đ</span>
                      <span>+ Ship:</span>
                      <span className="font-bold text-orange-400">{shippingFee.toLocaleString('vi-VN')}đ</span>
                      {prepaidAmount > 0 && (
                        <>
                          <span>- Cọc:</span>
                          <span className="font-bold text-cyan-400">-{prepaidAmount.toLocaleString('vi-VN')}đ</span>
                        </>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-gray-400 mr-1.5">Còn thu (COD):</span>
                      <span className="font-black text-sm text-emerald-400 font-mono">
                        {Math.max(0, totalItemsPriceVnd + shippingFee - prepaidAmount).toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-0.5">Ghi chú thêm cho đơn:</label>
                  <input
                    type="text"
                    value={customNote}
                    onChange={e => setCustomNote(e.target.value)}
                    placeholder="Ghi chú giao hàng hoặc dặn dò..."
                    className="w-full py-1.5 px-2 bg-[#182433] border border-white/15 rounded-lg text-xs font-medium text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Options */}
              {orderItems.some(it => it.isPast) && (
                <label className="flex items-center gap-2 p-2 bg-[#0f1723] rounded-xl border border-white/10 text-xs text-gray-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoMarkShipped}
                    onChange={e => setAutoMarkShipped(e.target.checked)}
                    className="rounded border-white/20 w-4 h-4 text-orange-600 focus:ring-orange-500 cursor-pointer shrink-0"
                  />
                  <span>
                    Đánh dấu các món giữ phiên trước là "ĐÃ GỬI" sau khi tạo đơn thành công.
                  </span>
                </label>
              )}

              {/* Error Banner */}
              {errorMessage && (
                <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-xs text-red-300 flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Submit CTA Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handlePushOrder}
                  disabled={isSubmitting || orderItems.length === 0}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 hover:from-orange-500 hover:to-amber-500 active:scale-[0.99] text-white font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-xl shadow-orange-950/60 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" />
                      <span>Đang đẩy đơn vào Pancake POS...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-lg">🚀</span>
                      <span>XÁC NHẬN TẠO ĐƠN TRÊN PANCAKE POS</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}

        </div>
      </div>

      {/* Smart Calculator Modal inside Order Push Modal */}
      {isCalculatorOpen && (
        <ItemCalculatorModal
          user={cleanUser}
          platform={platform}
          onClose={() => setIsCalculatorOpen(false)}
          onAdded={(addedItems) => {
            setIsCalculatorOpen(false);
            if (addedItems && addedItems.length > 0) {
              const newPushItems: EditablePushItem[] = addedItems.map(it => ({
                id: it.id,
                content: it.name || `Sản phẩm ${it.unitPrice}k`,
                priceK: it.unitPrice,
                quantity: it.quantity,
                isPast: false
              }));
              setOrderItems(prev => [...prev, ...newPushItems]);
            }
          }}
        />
      )}
    </div>
  );
};
