import React, { useState, useEffect, useRef, useMemo } from 'react';

export default function POSPage() {
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(true);
  const [billSuccess, setBillSuccess] = useState(null);
  const [fsm, setFsm] = useState('IDLE');           // 'IDLE' | 'PRICE' | 'QTY'
  const [pendingLineId, setPendingLineId] = useState(null);
  const inputBufferRef = useRef('');

  useEffect(() => {
    (async () => {
      const [itemsRes, catsRes] = await Promise.all([
        window.api.pos.getMenuItems(),
        window.api.pos.getMenuCategories(),
      ]);
      if (itemsRes.success) setMenuItems(itemsRes.data);
      if (catsRes.success) setCategories(catsRes.data);
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

  const filteredItems = activeCategory === 'All'
    ? menuItems
    : menuItems.filter(i => i.categoryName === activeCategory);

  const keyToItem = useMemo(() => {
    const map = {};
    filteredItems.forEach((item, idx) => {
      if (idx < 26) map[String.fromCharCode(97 + idx)] = item;
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

  const updateLine = (lineId, updates) => {
    setCart(prev => prev.map(c => c.lineId === lineId ? { ...c, ...updates } : c));
  };

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const tax = subtotal * 0.05;
  const discountAmt = subtotal * (discount / 100);
  const total = subtotal + tax - discountAmt;

  const createBill = async () => {
    if (cart.length === 0) return;
    const res = await window.api.pos.createBill({
      items: cart.map(i => ({ menuItemId: i.id, quantity: i.quantity, priceOverride: i.price })),
      discount,
      paymentMethod,
    });
    if (res.success) {
      setBillSuccess(res.data);
      setCart([]);
      setDiscount(0);
    }
  };

  // Keyboard state machine for fast billing
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      const key = e.key.toLowerCase();

      // ── IDLE STATE ──
      if (fsm === 'IDLE') {
        if (key.length === 1 && key >= 'a' && key <= 'z' && !e.repeat) {
          e.preventDefault();
          const item = keyToItem[key];
          if (!item || !item.isAvailable) return;
          const lineId = addToCart(item);
          setPendingLineId(lineId);
          inputBufferRef.current = '';
          setFsm('PRICE');
          return;
        }
        if (e.key === 'Escape' && cart.length > 0) {
          e.preventDefault();
          createBill();
          return;
        }
        return;
      }

      // ── PRICE STATE ──
      if (fsm === 'PRICE') {
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
          setCart(prev => prev.filter(c => c.lineId !== pendingLineId));
          setPendingLineId(null);
          inputBufferRef.current = '';
          setFsm('IDLE');
          return;
        }
        return;
      }

      // ── QTY STATE ──
      if (fsm === 'QTY') {
        e.preventDefault();
        if (e.key === 'Enter') {
          if (inputBufferRef.current !== '') {
            const qty = Number(inputBufferRef.current);
            if (Number.isFinite(qty) && qty > 0) {
              updateLine(pendingLineId, { quantity: qty });
            }
          }
          setPendingLineId(null);
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
          setCart(prev => prev.filter(c => c.lineId !== pendingLineId));
          setPendingLineId(null);
          inputBufferRef.current = '';
          setFsm('IDLE');
          return;
        }
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fsm, pendingLineId, keyToItem, cart]);

  if (loading) return <div className="text-slate-400">Loading POS...</div>;

  return (
    <div className="flex h-full gap-4" style={{ minHeight: 'calc(100vh - 96px)' }}>
      {/* Left: Menu */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-white">Point of Sale</h1>
        </div>

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
            const shortcutKey = idx < 26 ? String.fromCharCode(65 + idx) : null;
            const isBeingConfigured = pendingLineId && fsm !== 'IDLE' &&
              cart.find(c => c.lineId === pendingLineId)?.id === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (fsm !== 'IDLE' || !item.isAvailable) return;
                  const lineId = addToCart(item);
                  setPendingLineId(lineId);
                  inputBufferRef.current = '';
                  setFsm('PRICE');
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
              <button onClick={() => { setCart([]); setPendingLineId(null); inputBufferRef.current = ''; setFsm('IDLE'); }} className="text-xs text-red-400 hover:text-red-300">Clear</button>
            )}
          </h2>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {cart.length === 0 ? (
              <p className="text-slate-600 text-xs text-center py-8">No items in order</p>
            ) : (
              cart.map(item => (
                <div
                  key={item.lineId}
                  className={`bg-slate-700/50 rounded-lg px-3 py-2 border ${
                    pendingLineId === item.lineId ? 'border-primary-500' : 'border-transparent'
                  }`}
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
                          : 'Unit price'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
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
              ))
            )}
          </div>

          {/* Totals & Controls */}
          <div className="border-t border-slate-700 mt-3 pt-3 space-y-2">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Subtotal</span><span>PKR {subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Tax (5%)</span><span>PKR {tax.toLocaleString()}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-xs text-green-400">
                <span>Discount ({discount}%)</span><span>−PKR {discountAmt.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-semibold text-white border-t border-slate-700 pt-2">
              <span>Total</span><span>PKR {total.toLocaleString()}</span>
            </div>

            {/* Discount */}
            <div>
              <label className="label text-xs">Discount %</label>
              <input
                type="number"
                min="0" max="100"
                value={discount}
                onChange={e => setDiscount(Math.min(100, Math.max(0, Number(e.target.value))))}
                disabled={fsm !== 'IDLE'}
                className="input-field py-1.5 text-xs"
              />
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
              Create Bill — PKR {total.toLocaleString()}
            </button>
          </div>
        </div>

        {/* Success Toast */}
        {billSuccess && (
          <div className="mt-3 bg-green-900/30 border border-green-700/50 text-green-300 text-xs rounded-lg px-4 py-3 text-center">
            ✓ Bill created successfully!
          </div>
        )}
      </div>
    </div>
  );
}
