import React, { useState, useEffect, useRef, useMemo, useReducer, useCallback } from 'react';
import { useCart } from './hooks/useCart.jsx';
import { usePOSKeyboard } from './hooks/usePOSKeyboard.jsx';
import QuickKeysBar from './components/QuickKeysBar.jsx';
import KeyboardStatusBar from './components/KeyboardStatusBar.jsx';
import CartPanel from './components/CartPanel.jsx';

// ── FSM Reducer ──────────────────────────────────────────────────────────────
const initialFSMState = { fsm: 'IDLE', pendingLineId: null, pendingIsNewLine: false, tableBuffer: '', itemBuffer: '' };

function fsmReducer(state, action) {
  switch (action.type) {
    case 'START_ITEM':
      return { ...state, fsm: action.hasPriceOption ? 'PRICE' : 'QTY', pendingLineId: action.lineId, pendingIsNewLine: true, itemBuffer: '' };
    case 'SELECT_LINE':
      return { ...state, fsm: action.hasPriceOption ? 'PRICE' : 'QTY', pendingLineId: action.lineId, pendingIsNewLine: false, itemBuffer: '' };
    case 'ADVANCE_TO_QTY':
      return { ...state, fsm: 'QTY' };
    case 'START_TABLE':
      return { ...state, fsm: 'TABLE', tableBuffer: '' };
    case 'UPDATE_TABLE_BUFFER':
      return { ...state, tableBuffer: action.buffer };
    case 'UPDATE_ITEM_BUFFER':
      return { ...state, itemBuffer: action.buffer };
    case 'RESET':
      return { ...initialFSMState };
    default:
      return state;
  }
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function POSPage() {
  // Data state
  const [menuItems, setMenuItems] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tables, setTables] = useState([]);
  const [quickKeys, setQuickKeys] = useState([]);
  const [selectedTableId, setSelectedTableId] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [heldBills, setHeldBills] = useState([]);
  const [loading, setLoading] = useState(true);

  // Notification state
  const [billSuccess, setBillSuccess] = useState(null);
  const [billError, setBillError] = useState(null);
  const [printWarning, setPrintWarning] = useState(null);
  const [holdNotice, setHoldNotice] = useState(null);

  // Cart hook
  const {
    cart, setCart,
    discount, setDiscount,
    paymentMethod, setPaymentMethod,
    addItem, removeLine, deleteLine, updateLine, clear,
    total,
  } = useCart();

  // FSM state
  const [fsmState, dispatch] = useReducer(fsmReducer, initialFSMState);
  const { fsm, pendingLineId, tableBuffer, itemBuffer } = fsmState;

  // Refs
  const inputBufferRef = useRef('');
  const creatingBillRef = useRef(false);
  const discountInputRef = useRef(null);

  // Reset FSM helper used by business functions
  const resetFSM = useCallback(() => {
    inputBufferRef.current = '';
    dispatch({ type: 'RESET' });
  }, []);

  // ── Data Loading ────────────────────────────────────────────────────────────
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

  // ── Notification Auto-Dismiss ───────────────────────────────────────────────
  useEffect(() => {
    if (billSuccess) { const t = setTimeout(() => setBillSuccess(null), 3000); return () => clearTimeout(t); }
  }, [billSuccess]);
  useEffect(() => {
    if (billError) { const t = setTimeout(() => setBillError(null), 5000); return () => clearTimeout(t); }
  }, [billError]);
  useEffect(() => {
    if (printWarning) { const t = setTimeout(() => setPrintWarning(null), 5000); return () => clearTimeout(t); }
  }, [printWarning]);
  useEffect(() => {
    if (holdNotice) { const t = setTimeout(() => setHoldNotice(null), 3000); return () => clearTimeout(t); }
  }, [holdNotice]);

  // ── Derived State ───────────────────────────────────────────────────────────
  const quickKeyToItem = useMemo(() => {
    const map = {};
    quickKeys.forEach(qk => {
      const fullItem = menuItems.find(mi => mi.id === qk.menuItemId);
      if (fullItem) map[qk.key] = fullItem;
    });
    return map;
  }, [quickKeys, menuItems]);

  const quickKeyItemIds = useMemo(() => {
    return new Set(Object.values(quickKeyToItem).map(item => item.id));
  }, [quickKeyToItem]);

  const filteredItems = useMemo(() => {
    const byCategory = activeCategory === 'All'
      ? menuItems
      : menuItems.filter(i => i.categoryName === activeCategory);
    return byCategory.filter(i => i.isAvailable && !quickKeyItemIds.has(i.id));
  }, [menuItems, activeCategory, quickKeyItemIds]);

  // Badge numbers for grid items — skip digits 1-9 already used as quick keys
  const gridItemNumbers = useMemo(() => {
    const assignedDigitQKs = new Set(
      Object.keys(quickKeyToItem).filter(k => k >= '1' && k <= '9')
    );
    const numbers = [];
    let d = 1;
    for (let i = 0; i < filteredItems.length; i++) {
      while (assignedDigitQKs.has(String(d))) d++;
      numbers.push(d);
      d++;
    }
    return numbers;
  }, [filteredItems.length, quickKeyToItem]);

  const stockByMenuName = useMemo(() => {
    const map = {};
    stockItems.forEach(item => {
      const key = (item.name || '').trim().toLowerCase();
      if (key) map[key] = item;
    });
    return map;
  }, [stockItems]);

  // ── Business Functions ──────────────────────────────────────────────────────
  const refreshHeldBills = async () => {
    const res = await window.api.pos.getHeldBills();
    if (res.success) setHeldBills(res.data);
  };

  const createBill = useCallback(async ({ skipPrint = false } = {}) => {
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
        clear();
        setSelectedTableId('');
        resetFSM();
        return;
      }
      setBillError(res?.error || 'Could not create bill');
    } finally {
      creatingBillRef.current = false;
    }
  }, [cart, selectedTableId, discount, paymentMethod, clear, resetFSM]);

  const holdCurrentOrder = useCallback(async () => {
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
    if (!res.success) { setBillError(res?.error || 'Could not hold bill'); return; }
    await refreshHeldBills();
    setHoldNotice('Order held successfully');
    clear();
    setSelectedTableId('');
    setPaymentMethod('cash');
    resetFSM();
  }, [cart, fsm, selectedTableId, discount, paymentMethod, clear, setPaymentMethod, resetFSM]);

  const recallHeldBill = useCallback(async (heldBillId) => {
    if (!heldBillId || fsm !== 'IDLE') return;
    setBillError(null);
    const heldRes = await window.api.pos.getHeldBillById({ id: heldBillId });
    if (!heldRes.success || !heldRes.data) {
      setBillError(heldRes?.error || 'Held bill not found');
      await refreshHeldBills();
      return;
    }
    const held = heldRes.data;
    setCart((held.items || []).map(item => ({
      lineId: `${item.menuItemId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      id: item.menuItemId,
      name: item.name,
      description: item.description,
      isAvailable: !!item.isAvailable,
      basePrice: Number(item.basePrice),
      halfPrice: item.halfPrice != null ? Number(item.halfPrice) : null,
      price: Number(item.price),
      quantity: Math.max(1, Number(item.quantity) || 1),
    })));
    setDiscount(Math.max(0, Number(held.discount) || 0));
    setSelectedTableId(held.tableId || '');
    setPaymentMethod(held.paymentMethod || 'cash');
    resetFSM();
    await window.api.pos.deleteHeldBill({ id: heldBillId });
    await refreshHeldBills();
    setHoldNotice('Held order recalled');
  }, [fsm, setCart, setDiscount, setPaymentMethod, resetFSM]);

  const deleteHeldBill = useCallback(async (heldBillId) => {
    if (!heldBillId) return;
    await window.api.pos.deleteHeldBill({ id: heldBillId });
    await refreshHeldBills();
  }, []);

  // ── Keyboard FSM ────────────────────────────────────────────────────────────
  usePOSKeyboard({
    fsmState,
    dispatch,
    inputBufferRef,
    cart,
    tables,
    heldBills,
    quickKeyToItem,
    filteredItems,
    gridItemNumbers,
    addItem,
    updateLine,
    deleteLine,
    createBill,
    holdCurrentOrder,
    recallHeldBill,
    setSelectedTableId,
    discountInputRef,
  });

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) return <div className="text-slate-400">Loading POS...</div>;

  return (
    <div className="flex h-full gap-4" style={{ minHeight: 'calc(100vh - 96px)' }}>
      {/* Left: Menu */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-white">Point of Sale</h1>
        </div>

        <QuickKeysBar
          quickKeyToItem={quickKeyToItem}
          fsm={fsm}
          cart={cart}
          pendingLineId={pendingLineId}
          onAddItem={addItem}
          dispatch={dispatch}
          inputBufferRef={inputBufferRef}
          itemBuffer={itemBuffer}
        />

        {/* Category Filter */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {['All', ...categories.map(c => c.name)].map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-primary-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <KeyboardStatusBar
          fsm={fsm}
          cart={cart}
          heldBills={heldBills}
          pendingLineId={pendingLineId}
          tableBuffer={tableBuffer}
          itemBuffer={itemBuffer}
        />

        {/* Menu Grid */}
        <div className="grid grid-cols-3 gap-3 flex-1 overflow-y-auto pr-1">
          {filteredItems.map((item, idx) => {
            const itemNumber = gridItemNumbers[idx];
            const isBeingConfigured =
              pendingLineId && fsm !== 'IDLE' &&
              cart.find(c => c.lineId === pendingLineId)?.id === item.id;
            const isHighlighted = itemBuffer && parseInt(itemBuffer, 10) === itemNumber;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (fsm !== 'IDLE' || !item.isAvailable) return;
                  const lineId = addItem(item);
                  inputBufferRef.current = '';
                  dispatch({ type: 'START_ITEM', lineId, hasPriceOption: item.halfPrice != null });
                }}
                disabled={!item.isAvailable || fsm !== 'IDLE'}
                className={`card text-left transition-colors p-3 relative ${
                  isBeingConfigured ? 'border-primary-500 ring-1 ring-primary-500/50'
                  : isHighlighted ? 'border-yellow-400 ring-1 ring-yellow-400/50'
                  : 'hover:border-primary-500'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <span className={`absolute top-1.5 right-1.5 min-w-[20px] h-5 rounded px-1 text-[10px] font-bold flex items-center justify-center ${
                  isHighlighted ? 'bg-yellow-400 text-slate-900' : 'bg-slate-600 text-slate-300'
                }`}>
                  {itemNumber}
                </span>
                <div className="flex justify-between items-start pr-6">
                  <span className="text-white text-sm font-medium leading-tight">{item.name}</span>
                  {!item.isAvailable && <span className="text-xs bg-red-900/40 text-red-400 px-1.5 py-0.5 rounded">Out</span>}
                </div>
                {item.description && <p className="text-slate-500 text-xs mt-1 line-clamp-1">{item.description}</p>}
                <div className="flex items-center gap-2 mt-2">
                  <p className="text-primary-400 font-semibold text-sm">PKR {item.price.toLocaleString()}</p>
                  {item.halfPrice != null && (
                    <p className="text-slate-500 text-xs">/ Half: {item.halfPrice.toLocaleString()}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Cart + Toasts */}
      <div className="w-80 flex flex-col">
        <CartPanel
          cart={cart}
          discount={discount}
          setDiscount={setDiscount}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          total={total}
          tables={tables}
          selectedTableId={selectedTableId}
          setSelectedTableId={setSelectedTableId}
          heldBills={heldBills}
          fsm={fsm}
          pendingLineId={pendingLineId}
          inputBufferRef={inputBufferRef}
          stockByMenuName={stockByMenuName}
          discountInputRef={discountInputRef}
          onClear={() => { clear(); resetFSM(); }}
          onUpdateLine={updateLine}
          onRemoveLine={removeLine}
          onDeleteLine={deleteLine}
          onCreateBill={createBill}
          onHoldBill={holdCurrentOrder}
          onRecallHeld={recallHeldBill}
          onDeleteHeld={deleteHeldBill}
          dispatch={dispatch}
        />

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
