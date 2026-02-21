import React, { useState, useEffect, useRef, useMemo } from 'react';

const QUICK_KEY_LIST = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'];
const QUICK_KEY_SET = new Set(QUICK_KEY_LIST);
const GRID_KEYS = 'abcdfghjklmnsvxz'.split(''); // 16 letters excluding quick keys

export default function POSPage() {
  const [menuItems, setMenuItems] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tables, setTables] = useState([]);
  const [quickKeys, setQuickKeys] = useState([]);
  const [selectedTableId, setSelectedTableId] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(true);
  const [billSuccess, setBillSuccess] = useState(null);
  const [billError, setBillError] = useState(null);
  const [printWarning, setPrintWarning] = useState(null);
  const [holdNotice, setHoldNotice] = useState(null);
  const [heldBills, setHeldBills] = useState([]);
  const [fsm, setFsm] = useState('IDLE');           // 'IDLE' | 'PRICE' | 'QTY'
  const [pendingLineId, setPendingLineId] = useState(null);
  const [pendingIsNewLine, setPendingIsNewLine] = useState(false);
  const inputBufferRef = useRef('');
  const creatingBillRef = useRef(false);
  const discountInputRef = useRef(null);
  const tableSelectRef = useRef(null);

  useEffect(() => {
    (async () => {
      const [itemsRes, stockRes, catsRes, tablesRes, qkRes, heldRes] = await Promise.all([
        window.api.pos.getMenuItems(),
        window.api.stock.getAll(),
        window.api.pos.getMenuCategories(),
        window.api.pos.getTables(),
        window.api.pos.getQuickKeys(),
        window.api.pos.getHeldBills(),
      ]);
      if (itemsRes.success) setMenuItems(itemsRes.data);
      if (stockRes.success) setStockItems(stockRes.data);
      if (catsRes.success) setCategories(catsRes.data);
      if (tablesRes.success) setTables(tablesRes.data);
      if (qkRes.success) setQuickKeys(qkRes.data);
      if (heldRes.success) setHeldBills(heldRes.data);
      setLoading(false);
    })();
  }, []);

  // Auto-dismiss success toast
  useEffect(() => {
    if (billSuccess) {
      const t = setTimeout(() => setBillSuccess(null), 3000);
      return () => clearTimeout(t);
    }
  }, [billSuccess]);

  // Auto-dismiss error toast
  useEffect(() => {
    if (billError) {
      const t = setTimeout(() => setBillError(null), 5000);
      return () => clearTimeout(t);
    }
  }, [billError]);

  // Auto-dismiss print warning toast
  useEffect(() => {
    if (printWarning) {
      const t = setTimeout(() => setPrintWarning(null), 5000);
      return () => clearTimeout(t);
    }
  }, [printWarning]);

  // Auto-dismiss hold notice
  useEffect(() => {
    if (holdNotice) {
      const t = setTimeout(() => setHoldNotice(null), 3000);
      return () => clearTimeout(t);
    }
  }, [holdNotice]);

  // Quick key map: q/w/e/r/t/y/u/i/o/p → fixed items (ignores category filter)
  const quickKeyToItem = useMemo(() => {
    const map = {};
    quickKeys.forEach(qk => {
      const fullItem = menuItems.find(mi => mi.id === qk.menuItemId);
      if (fullItem) map[qk.key] = fullItem;
    });
    return map;
  }, [quickKeys, menuItems]);

  // IDs of items already on quick keys — exclude from grid
  const quickKeyItemIds = useMemo(() => {
    return new Set(Object.values(quickKeyToItem).map(item => item.id));
  }, [quickKeyToItem]);

  const filteredItems = useMemo(() => {
    const byCategory = activeCategory === 'All'
      ? menuItems
      : menuItems.filter(i => i.categoryName === activeCategory);
    return byCategory.filter(i => i.isAvailable && !quickKeyItemIds.has(i.id));
  }, [menuItems, activeCategory, quickKeyItemIds]);

  const stockByMenuName = useMemo(() => {
    const map = {};
    stockItems.forEach(item => {
      const key = (item.name || '').trim().toLowerCase();
      if (key) map[key] = item;
    });
    return map;
  }, [stockItems]);

  // Grid key map: a,b,c,d,f,g,h,j,k,l,m,n,s,v,x,z → filtered items (changes with category)
  const keyToItem = useMemo(() => {
    const map = {};
    filteredItems.forEach((item, idx) => {
      if (idx < GRID_KEYS.length) map[GRID_KEYS[idx]] = item;
    });
    return map;
  }, [filteredItems]);

  const makeLineId = (menuItemId) => `${menuItemId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const addToCart = (item) => {
    const lineId = makeLineId(item.id);
    setCart(prev => [...prev, {
      lineId,
      id: item.id,
      name: item.name,
      description: item.description,
      isAvailable: item.isAvailable,
      basePrice: Number(item.price),
      halfPrice: item.halfPrice !== null && item.halfPrice !== undefined ? Number(item.halfPrice) : null,
      price: Number(item.price),
      quantity: 1,
    }]);
    return lineId;
  };

  const removeFromCart = (lineId) => {
    setCart(prev => {
      const item = prev.find(c => c.lineId === lineId);
      if (item && item.quantity > 1) {
        return prev.map(c => c.lineId === lineId ? { ...c, quantity: c.quantity - 1 } : c);
      }
      return prev.filter(c => c.lineId !== lineId);
    });
  };
  const deleteCartLine = (lineId) => {
    setCart(prev => prev.filter(c => c.lineId !== lineId));
  };

  const updateLine = (lineId, updates) => {
    setCart(prev => prev.map(c => c.lineId === lineId ? { ...c, ...updates } : c));
  };

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const total = cartTotal - discount;

  const createBill = async ({ skipPrint = false } = {}) => {
    if (cart.length === 0 || creatingBillRef.current) return;
    creatingBillRef.current = true;
    setBillError(null);
    try {
      const res = await window.api.pos.createBill({
        items: cart.map(i => ({ menuItemId: i.id, quantity: i.quantity, priceOverride: i.price })),
        tableId: selectedTableId || null,
        discount,
        paymentMethod,
        skipPrint,
      });
      if (res.success) {
        setBillSuccess(res.data);
        const stockRes = await window.api.stock.getAll();
        if (stockRes.success) setStockItems(stockRes.data);
        if (res.printError || res.printSkipped) {
          setPrintWarning(res.printError || 'Receipt could not be printed');
        }
        setCart([]);
        setPendingLineId(null);
        setPendingIsNewLine(false);
        inputBufferRef.current = '';
        setFsm('IDLE');
        setDiscount(0);
        setSelectedTableId('');
        return;
      }
      setBillError(res?.error || 'Could not create bill');
    } finally {
      creatingBillRef.current = false;
    }
  };

  const refreshHeldBills = async () => {
    const res = await window.api.pos.getHeldBills();
    if (res.success) setHeldBills(res.data);
  };

  const holdCurrentOrder = async () => {
    if (cart.length === 0 || fsm !== 'IDLE') return;
    setBillError(null);
    const res = await window.api.pos.holdBill({
      items: cart.map(i => ({
        menuItemId: i.id,
        name: i.name,
        description: i.description,
        isAvailable: i.isAvailable,
        basePrice: i.basePrice,
        halfPrice: i.halfPrice,
        price: i.price,
        quantity: i.quantity,
      })),
      tableId: selectedTableId || null,
      discount,
      paymentMethod,
    });
    if (!res.success) {
      setBillError(res?.error || 'Could not hold bill');
      return;
    }
    await refreshHeldBills();
    setHoldNotice('Order held successfully');
    setCart([]);
    setPendingLineId(null);
    setPendingIsNewLine(false);
    inputBufferRef.current = '';
    setFsm('IDLE');
    setDiscount(0);
    setSelectedTableId('');
    setPaymentMethod('cash');
  };

  const recallHeldBill = async (heldBillId) => {
    if (!heldBillId || fsm !== 'IDLE') return;
    setBillError(null);
    const heldRes = await window.api.pos.getHeldBillById({ id: heldBillId });
    if (!heldRes.success || !heldRes.data) {
      setBillError(heldRes?.error || 'Held bill not found');
      await refreshHeldBills();
      return;
    }
    const held = heldRes.data;
    const recalledItems = (held.items || []).map(item => ({
      lineId: makeLineId(item.menuItemId),
      id: item.menuItemId,
      name: item.name,
      description: item.description,
      isAvailable: !!item.isAvailable,
      basePrice: Number(item.basePrice),
      halfPrice: item.halfPrice !== null && item.halfPrice !== undefined ? Number(item.halfPrice) : null,
      price: Number(item.price),
      quantity: Math.max(1, Number(item.quantity) || 1),
    }));

    setCart(recalledItems);
    setDiscount(Math.max(0, Number(held.discount) || 0));
    setSelectedTableId(held.tableId || '');
    setPaymentMethod(held.paymentMethod || 'cash');
    setPendingLineId(null);
    setPendingIsNewLine(false);
    inputBufferRef.current = '';
    setFsm('IDLE');

    await window.api.pos.deleteHeldBill({ id: heldBillId });
    await refreshHeldBills();
    setHoldNotice('Held order recalled');
  };

  const deleteHeldBill = async (heldBillId) => {
    if (!heldBillId) return;
    await window.api.pos.deleteHeldBill({ id: heldBillId });
    await refreshHeldBills();
  };

  // Keyboard state machine for fast billing
  useEffect(() => {
    const onKeyDown = (e) => {
      const key = e.key.toLowerCase();
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isFormFieldFocused = tag === 'input' || tag === 'textarea' || tag === 'select';
      // In IDLE, keep most form-field typing untouched, but allow global POS shortcuts.
      if (isFormFieldFocused && fsm === 'IDLE') {
        const isAddItemHotkey = key.length === 1 && key >= 'a' && key <= 'z' && !e.repeat;
        const isGlobalIdleHotkey =
          e.key === 'Escape' ||
          e.key === 'F8' ||
          e.key === 'F9' ||
          e.key === 'F10' ||
          e.key === 'F6' ||
          e.key === 'F7' ||
          e.key === 'F12' ||
          e.key === 'ArrowUp' ||
          e.key === 'ArrowDown';
        if (!isAddItemHotkey && !isGlobalIdleHotkey) return;
      }

      if (key === 'f6' && fsm === 'IDLE' && cart.length > 0) {
        if (e.repeat) return;
        e.preventDefault();
        holdCurrentOrder();
        return;
      }

      if (key === 'f7' && fsm === 'IDLE' && heldBills.length > 0) {
        if (e.repeat) return;
        e.preventDefault();
        recallHeldBill(heldBills[0].id);
        return;
      }

      if (key === 'f9' && fsm === 'IDLE') {
        e.preventDefault();
        discountInputRef.current?.focus();
        discountInputRef.current?.select?.();
        return;
      }

      if (key === 'f10' && fsm === 'IDLE') {
        e.preventDefault();
        if (tables.length > 0) {
          setSelectedTableId(tables[0].id);
        }
        tableSelectRef.current?.focus();
        return;
      }

      if (key === 'f12' && fsm === 'IDLE' && cart.length > 0) {
        if (e.repeat) return;
        e.preventDefault();
        createBill({ skipPrint: true });
        return;
      }

      if (e.key === 'F8' && cart.length > 0) {
        e.preventDefault();
        const targetLineId = pendingLineId || cart[cart.length - 1]?.lineId;
        if (!targetLineId) return;
        setCart(prev => prev.filter(c => c.lineId !== targetLineId));
        if (pendingLineId === targetLineId) {
          setPendingLineId(null);
          setPendingIsNewLine(false);
          inputBufferRef.current = '';
          setFsm('IDLE');
        }
        return;
      }

      const pickCartLineByArrow = (arrowKey) => {
        if (cart.length === 0) return false;
        const currentIdx = cart.findIndex(c => c.lineId === pendingLineId);
        const nextIdx = currentIdx === -1
          ? (arrowKey === 'ArrowUp' ? cart.length - 1 : 0)
          : (arrowKey === 'ArrowUp'
            ? (currentIdx - 1 + cart.length) % cart.length
            : (currentIdx + 1) % cart.length);
        const line = cart[nextIdx];
        setPendingLineId(line.lineId);
        setPendingIsNewLine(false);
        inputBufferRef.current = '';
        setFsm(line.halfPrice !== null && line.halfPrice !== undefined ? 'PRICE' : 'QTY');
        return true;
      };

      // ── IDLE STATE ──
      if (fsm === 'IDLE') {
        if (key.length === 1 && key >= 'a' && key <= 'z' && !e.repeat) {
          e.preventDefault();
          // Quick keys take priority, then grid keys
          const item = QUICK_KEY_SET.has(key) ? quickKeyToItem[key] : keyToItem[key];
          if (!item || !item.isAvailable) return;
          const lineId = addToCart(item);
          setPendingLineId(lineId);
          setPendingIsNewLine(true);
          inputBufferRef.current = '';
          // Skip price step for fixed-price items (no halfPrice)
          setFsm(item.halfPrice !== null && item.halfPrice !== undefined ? 'PRICE' : 'QTY');
          return;
        }
        if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && cart.length > 0) {
          e.preventDefault();
          pickCartLineByArrow(e.key);
          return;
        }
        if (e.key === 'Escape' && cart.length > 0) {
          if (e.repeat) return;
          e.preventDefault();
          createBill();
          return;
        }
        return;
      }

      // ── PRICE STATE ──
      if (fsm === 'PRICE') {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          pickCartLineByArrow(e.key);
          return;
        }
        e.preventDefault();
        if (e.key === 'Enter') {
          if (inputBufferRef.current !== '') {
            const customPrice = Number(inputBufferRef.current);
            if (Number.isFinite(customPrice) && customPrice > 0) {
              updateLine(pendingLineId, { price: customPrice });
            }
          }
          inputBufferRef.current = '';
          setFsm('QTY');
          return;
        }
        if (e.key === 'F2') {
          const line = cart.find(c => c.lineId === pendingLineId);
          if (line && line.halfPrice !== null) {
            updateLine(pendingLineId, { price: line.halfPrice });
            inputBufferRef.current = '';
          }
          return;
        }
        if (e.key >= '0' && e.key <= '9') {
          const line = cart.find(c => c.lineId === pendingLineId);
          if (line && line.halfPrice !== null) {
            inputBufferRef.current += e.key;
            const customPrice = Number(inputBufferRef.current);
            if (Number.isFinite(customPrice)) {
              updateLine(pendingLineId, { price: customPrice });
            }
          }
          return;
        }
        if (e.key === 'Backspace') {
          const line = cart.find(c => c.lineId === pendingLineId);
          if (line && line.halfPrice !== null) {
            inputBufferRef.current = inputBufferRef.current.slice(0, -1);
            const customPrice = Number(inputBufferRef.current) || line.basePrice;
            updateLine(pendingLineId, { price: customPrice });
          }
          return;
        }
        if (e.key === 'Escape') {
          if (pendingIsNewLine) {
            setCart(prev => prev.filter(c => c.lineId !== pendingLineId));
          }
          setPendingLineId(null);
          setPendingIsNewLine(false);
          inputBufferRef.current = '';
          setFsm('IDLE');
          return;
        }
        return;
      }

      // ── QTY STATE ──
      if (fsm === 'QTY') {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          pickCartLineByArrow(e.key);
          return;
        }
        e.preventDefault();
        if (e.key === 'Enter') {
          if (inputBufferRef.current !== '') {
            const qty = Number(inputBufferRef.current);
            if (Number.isFinite(qty) && qty > 0) {
              updateLine(pendingLineId, { quantity: qty });
            }
          }
          setPendingLineId(null);
          setPendingIsNewLine(false);
          inputBufferRef.current = '';
          setFsm('IDLE');
          return;
        }
        if (e.key >= '0' && e.key <= '9') {
          inputBufferRef.current += e.key;
          const qty = Number(inputBufferRef.current);
          if (Number.isFinite(qty) && qty >= 0) {
            updateLine(pendingLineId, { quantity: Math.max(1, qty) });
          }
          return;
        }
        if (e.key === 'Backspace') {
          inputBufferRef.current = inputBufferRef.current.slice(0, -1);
          const qty = Number(inputBufferRef.current) || 1;
          updateLine(pendingLineId, { quantity: qty });
          return;
        }
        if (e.key === 'Escape') {
          if (pendingIsNewLine) {
            setCart(prev => prev.filter(c => c.lineId !== pendingLineId));
          }
          setPendingLineId(null);
          setPendingIsNewLine(false);
          inputBufferRef.current = '';
          setFsm('IDLE');
          return;
        }
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fsm, pendingLineId, pendingIsNewLine, keyToItem, quickKeyToItem, cart, tables, heldBills]);

  if (loading) return <div className="text-slate-400">Loading POS...</div>;

  return (
    <div className="flex h-full gap-4" style={{ minHeight: 'calc(100vh - 96px)' }}>
      {/* Left: Menu */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-white">Point of Sale</h1>
        </div>

        {/* Quick Keys Top Bar */}
        {quickKeys.length > 0 && (
          <div className="flex gap-2 mb-3 flex-wrap">
            {QUICK_KEY_LIST.map(k => {
              const item = quickKeyToItem[k];
              if (!item) return null;
              const isBeingConfigured = pendingLineId && fsm !== 'IDLE' &&
                cart.find(c => c.lineId === pendingLineId)?.id === item.id;
              return (
                <button
                  key={k}
                  onClick={() => {
                    if (fsm !== 'IDLE' || !item.isAvailable) return;
                    const lineId = addToCart(item);
                    setPendingLineId(lineId);
                    setPendingIsNewLine(true);
                    inputBufferRef.current = '';
                    setFsm(item.halfPrice !== null && item.halfPrice !== undefined ? 'PRICE' : 'QTY');
                  }}
                  disabled={!item.isAvailable || fsm !== 'IDLE'}
                  className={`flex flex-col items-center px-3 py-2 rounded-lg border text-center min-w-[72px] transition-colors ${
                    isBeingConfigured
                      ? 'border-primary-500 bg-primary-900/30 ring-1 ring-primary-500/50'
                      : 'border-slate-600 bg-slate-800 hover:border-primary-500 hover:bg-slate-700'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-700 rounded px-1.5 py-0.5 mb-1 uppercase">{k}</span>
                  <span className="text-white text-xs font-medium leading-tight truncate max-w-[64px]">{item.name}</span>
                  <span className="text-primary-400 text-[10px] mt-0.5">PKR {item.price.toLocaleString()}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Category Filter */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {['All', ...categories.map(c => c.name)].map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors
                ${activeCategory === cat ? 'bg-primary-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Keyboard Status Bar */}
        {fsm !== 'IDLE' && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-primary-900/30 border border-primary-700/50 flex items-center gap-3">
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
              fsm === 'PRICE' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-blue-500/20 text-blue-300'
            }`}>
              {fsm === 'PRICE' ? 'STEP 2: SET PRICE' : 'STEP 3: SET QTY'}
            </span>
            <span className="text-xs text-slate-400">
              {fsm === 'PRICE' && (
                <>
                  <kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-200 mx-0.5">Enter</kbd> confirm
                  {(() => {
                    const line = cart.find(c => c.lineId === pendingLineId);
                    if (line && line.halfPrice !== null) return (
                      <>
                        {' | '}<kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-200 mx-0.5">F2</kbd> half
                        {' | '}<kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-200 mx-0.5">0-9</kbd> custom
                      </>
                    );
                    return null;
                  })()}
                  {' | '}<kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-200 mx-0.5">Esc</kbd> cancel
                </>
              )}
              {fsm === 'QTY' && (
                <>
                  <kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-200 mx-0.5">Enter</kbd> confirm
                  {' | '}<kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-200 mx-0.5">0-9</kbd> set qty
                  {' | '}<kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-200 mx-0.5">Esc</kbd> cancel
                </>
              )}
            </span>
          </div>
        )}
        {fsm === 'IDLE' && cart.length > 0 && (
          <div className="mb-3 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 flex items-center gap-2">
            <span className="text-xs text-slate-500">
              <kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-300 mx-0.5">A-Z</kbd> add item
              {' | '}<kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-300 mx-0.5">Esc</kbd> create bill
            </span>
          </div>
        )}

        {/* Menu Grid */}
        <div className="grid grid-cols-3 gap-3 flex-1 overflow-y-auto pr-1">
          {filteredItems.map((item, idx) => {
            const shortcutKey = idx < GRID_KEYS.length ? GRID_KEYS[idx].toUpperCase() : null;
            const isBeingConfigured = pendingLineId && fsm !== 'IDLE' &&
              cart.find(c => c.lineId === pendingLineId)?.id === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (fsm !== 'IDLE' || !item.isAvailable) return;
                  const lineId = addToCart(item);
                  setPendingLineId(lineId);
                  setPendingIsNewLine(true);
                  inputBufferRef.current = '';
                  setFsm(item.halfPrice !== null && item.halfPrice !== undefined ? 'PRICE' : 'QTY');
                }}
                disabled={!item.isAvailable || fsm !== 'IDLE'}
                className={`card text-left transition-colors p-3 relative ${
                  isBeingConfigured
                    ? 'border-primary-500 ring-1 ring-primary-500/50'
                    : 'hover:border-primary-500'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {shortcutKey && (
                  <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded bg-slate-600 text-slate-300 text-[10px] font-bold flex items-center justify-center">
                    {shortcutKey}
                  </span>
                )}
                <div className="flex justify-between items-start pr-6">
                  <span className="text-white text-sm font-medium leading-tight">{item.name}</span>
                  {!item.isAvailable && <span className="text-xs bg-red-900/40 text-red-400 px-1.5 py-0.5 rounded">Out</span>}
                </div>
                {item.description && <p className="text-slate-500 text-xs mt-1 line-clamp-1">{item.description}</p>}
                <div className="flex items-center gap-2 mt-2">
                  <p className="text-primary-400 font-semibold text-sm">PKR {item.price.toLocaleString()}</p>
                  {item.halfPrice !== null && item.halfPrice !== undefined && (
                    <p className="text-slate-500 text-xs">/ Half: {item.halfPrice.toLocaleString()}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-80 flex flex-col">
        <div className="card flex-1 flex flex-col overflow-hidden">
          <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center justify-between">
            <span>Current Order</span>
            {cart.length > 0 && (
              <button onClick={() => { setCart([]); setPendingLineId(null); setPendingIsNewLine(false); inputBufferRef.current = ''; setFsm('IDLE'); }} className="text-xs text-red-400 hover:text-red-300">Clear</button>
            )}
          </h2>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {cart.length === 0 ? (
              <p className="text-slate-600 text-xs text-center py-8">No items in order</p>
            ) : (
              cart.map(item => {
                const linkedStock = stockByMenuName[(item.name || '').trim().toLowerCase()];
                return (
                <div
                  key={item.lineId}
                  onClick={() => {
                    if (fsm !== 'IDLE') return;
                    setPendingLineId(item.lineId);
                    setPendingIsNewLine(false);
                    inputBufferRef.current = '';
                    setFsm(item.halfPrice !== null && item.halfPrice !== undefined ? 'PRICE' : 'QTY');
                  }}
                  className={`bg-slate-700/50 rounded-lg px-3 py-2 border ${
                    pendingLineId === item.lineId ? 'border-primary-500' : 'border-transparent'
                  } ${fsm === 'IDLE' ? 'cursor-pointer hover:border-slate-500' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-white text-xs font-medium truncate">{item.name}</p>
                        {pendingLineId === item.lineId && fsm !== 'IDLE' && (
                          <span className={`text-[10px] font-bold px-1 py-0.5 rounded ${
                            fsm === 'PRICE' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-blue-500/20 text-blue-300'
                          }`}>
                            {fsm === 'PRICE' ? 'PRICE' : 'QTY'}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-500 text-xs">
                        {pendingLineId === item.lineId && fsm === 'PRICE' && inputBufferRef.current
                          ? `Typing: ${inputBufferRef.current}`
                          : pendingLineId === item.lineId && fsm === 'QTY' && inputBufferRef.current
                          ? `Qty: ${inputBufferRef.current}`
                          : linkedStock
                          ? `Stock: ${linkedStock.name} (${linkedStock.quantity} ${linkedStock.unit})`
                          : 'Stock: not linked'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={(e) => { e.stopPropagation(); deleteCartLine(item.lineId); }} className="w-5 h-5 rounded bg-red-700/70 hover:bg-red-600 text-white text-xs flex items-center justify-center">×</button>
                      <button onClick={(e) => { e.stopPropagation(); removeFromCart(item.lineId); }} className="w-5 h-5 rounded bg-slate-600 hover:bg-slate-500 text-white text-xs flex items-center justify-center">−</button>
                      <span className="text-white text-xs w-5 text-center">{item.quantity}</span>
                      <button onClick={(e) => { e.stopPropagation(); updateLine(item.lineId, { quantity: item.quantity + 1 }); }} className="w-5 h-5 rounded bg-slate-600 hover:bg-slate-500 text-white text-xs flex items-center justify-center">+</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="number"
                      min="0"
                      value={item.price}
                      onChange={e => updateLine(item.lineId, { price: Math.max(0, Number(e.target.value)) })}
                      disabled={item.halfPrice === null}
                      className="input-field py-1.5 text-xs w-24 disabled:opacity-50"
                    />
                    <button onClick={() => updateLine(item.lineId, { price: item.basePrice })} className="text-xs text-slate-300 hover:text-white">
                      Full
                    </button>
                    {item.halfPrice !== null && item.halfPrice !== undefined && (
                      <button onClick={() => updateLine(item.lineId, { price: item.halfPrice })} className="text-xs text-slate-300 hover:text-white">
                        Half
                      </button>
                    )}
                    <div className="ml-auto text-white text-xs font-medium">
                      PKR {(item.price * item.quantity).toLocaleString()}
                    </div>
                  </div>
                </div>
                );
              })
            )}
          </div>

          {/* Totals & Controls */}
          <div className="border-t border-slate-700 mt-3 pt-3 space-y-2">
            {discount > 0 && (
              <div className="flex justify-between text-xs text-green-400">
                <span>Discount</span><span>−PKR {discount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-semibold text-white border-t border-slate-700 pt-2">
              <span>Total</span><span>PKR {Math.max(0, total).toLocaleString()}</span>
            </div>

            {/* Discount */}
            <div>
              <label className="label text-xs">Discount Amount:</label>
              <input
                ref={discountInputRef}
                type="number"
                min="0"
                value={discount}
                onFocus={(e) => e.target.select()}
                onChange={e => setDiscount(Math.max(0, Number(e.target.value)))}
                disabled={fsm !== 'IDLE'}
                className="input-field py-1.5 text-xs"
              />
            </div>

            {/* Table */}
            <div>
              <label className="label text-xs">Table</label>
              <select
                ref={tableSelectRef}
                value={selectedTableId}
                onChange={e => setSelectedTableId(e.target.value)}
                disabled={fsm !== 'IDLE'}
                className="input-field py-1.5 text-xs bg-slate-700"
              >
                <option value="">No table</option>
                {tables.map(t => (
                  <option key={t.id} value={t.id}>
                    {`Table ${t.number}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Method */}
            <div>
              <label className="label text-xs">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                disabled={fsm !== 'IDLE'}
                className="input-field py-1.5 text-xs bg-slate-700"
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="online">Online</option>
              </select>
            </div>

            {/* Create Bill */}
            <button onClick={createBill} disabled={cart.length === 0 || fsm !== 'IDLE'} className="btn-primary w-full text-sm py-2.5">
              Create Bill — PKR {Math.max(0, total).toLocaleString()}
            </button>
            <button onClick={holdCurrentOrder} disabled={cart.length === 0 || fsm !== 'IDLE'} className="w-full text-sm py-2 rounded-lg bg-yellow-700/70 hover:bg-yellow-600 text-white disabled:opacity-50 disabled:cursor-not-allowed">
              Hold Bill (F6)
            </button>
            {heldBills.length > 0 && (
              <div className="mt-2 border border-slate-700 rounded-lg p-2 bg-slate-800/70">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-300">Held Orders ({heldBills.length})</p>
                  <button onClick={() => recallHeldBill(heldBills[0].id)} disabled={fsm !== 'IDLE'} className="text-[11px] text-primary-300 hover:text-primary-200 disabled:opacity-50">
                    Recall Latest (F7)
                  </button>
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {heldBills.map(held => (
                    <div key={held.id} className="bg-slate-700/50 rounded px-2 py-1.5 border border-slate-700 flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-white truncate">
                          {held.tableNumber ? `Table ${held.tableNumber}` : 'No table'} | {held.itemCount} items
                        </p>
                        <p className="text-[10px] text-slate-400">
                          PKR {Number(held.total || 0).toLocaleString()} | {new Date(held.updatedAt).toLocaleTimeString()}
                        </p>
                      </div>
                      <button onClick={() => recallHeldBill(held.id)} disabled={fsm !== 'IDLE'} className="text-[11px] px-2 py-0.5 rounded bg-primary-700/70 hover:bg-primary-600 text-white disabled:opacity-50">
                        Recall
                      </button>
                      <button onClick={() => deleteHeldBill(held.id)} disabled={fsm !== 'IDLE'} className="text-[11px] px-2 py-0.5 rounded bg-red-700/70 hover:bg-red-600 text-white disabled:opacity-50">
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Success Toast */}
        {billSuccess && (
          <div className="mt-3 bg-green-900/30 border border-green-700/50 text-green-300 text-xs rounded-lg px-4 py-3 text-center">
            Bill created successfully!
            {Array.isArray(billSuccess.stockAdjustments) && billSuccess.stockAdjustments.length > 0 && (
              <div className="mt-1 text-[11px] text-green-200">
                {billSuccess.stockAdjustments.map(s => `${s.stockItemName}: -${s.consumedQty} (${s.remainingQty} left)`).join(' | ')}
              </div>
            )}
          </div>
        )}

        {billError && (
          <div className="mt-3 bg-red-900/30 border border-red-700/50 text-red-300 text-xs rounded-lg px-4 py-3 text-center">
            {billError}
          </div>
        )}

        {/* Print Warning Toast */}
        {printWarning && (
          <div className="mt-3 bg-yellow-900/30 border border-yellow-700/50 text-yellow-300 text-xs rounded-lg px-4 py-3 text-center">
            Print failed: {printWarning}
          </div>
        )}
        {holdNotice && (
          <div className="mt-3 bg-blue-900/30 border border-blue-700/50 text-blue-300 text-xs rounded-lg px-4 py-3 text-center">
            {holdNotice}
          </div>
        )}
      </div>
    </div>
  );
}
