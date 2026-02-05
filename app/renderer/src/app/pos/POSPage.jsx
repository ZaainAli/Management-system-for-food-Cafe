import React, { useState, useEffect, useRef } from 'react';

export default function POSPage() {
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(true);
  const [billSuccess, setBillSuccess] = useState(null);
  const [activeLineId, setActiveLineId] = useState(null);
  const qtyBufferRef = useRef('');
  const qtyTimerRef = useRef(null);

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

  // Keyboard quantity entry for selected cart line
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!activeLineId) return;
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      const isDigit = e.key >= '0' && e.key <= '9';
      if (!isDigit && e.key !== 'Backspace' && e.key !== 'Escape' && e.key !== 'Enter') return;
      e.preventDefault();

      if (e.key === 'Escape') {
        qtyBufferRef.current = '';
        return;
      }
      if (e.key === 'Backspace') {
        qtyBufferRef.current = qtyBufferRef.current.slice(0, -1);
      } else if (isDigit) {
        qtyBufferRef.current += e.key;
      } else if (e.key === 'Enter') {
        qtyBufferRef.current = '';
        return;
      }

      const nextQty = Number(qtyBufferRef.current);
      if (Number.isFinite(nextQty) && nextQty >= 0) {
        updateLine(activeLineId, { quantity: Math.max(0, nextQty) });
      }

      if (qtyTimerRef.current) clearTimeout(qtyTimerRef.current);
      qtyTimerRef.current = setTimeout(() => { qtyBufferRef.current = ''; }, 1500);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (qtyTimerRef.current) clearTimeout(qtyTimerRef.current);
    };
  }, [activeLineId]);

  const filteredItems = activeCategory === 'All'
    ? menuItems
    : menuItems.filter(i => i.categoryName === activeCategory);

  const makeLineId = (menuItemId) => `${menuItemId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id && Number(c.price) === Number(item.price));
      if (existing) {
        return prev.map(c => c.lineId === existing.lineId ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, {
        lineId: makeLineId(item.id),
        id: item.id,
        name: item.name,
        description: item.description,
        isAvailable: item.isAvailable,
        basePrice: Number(item.price),
        halfPrice: item.halfPrice !== null && item.halfPrice !== undefined ? Number(item.halfPrice) : null,
        price: Number(item.price),
        quantity: 1,
      }];
    });
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

        {/* Menu Grid */}
        <div className="grid grid-cols-3 gap-3 flex-1 overflow-y-auto pr-1">
          {filteredItems.map(item => (
            <button
              key={item.id}
              onClick={() => addToCart(item)}
              disabled={!item.isAvailable}
              className="card text-left hover:border-primary-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed p-3"
            >
              <div className="flex justify-between items-start">
                <span className="text-white text-sm font-medium leading-tight">{item.name}</span>
                {!item.isAvailable && <span className="text-xs bg-red-900/40 text-red-400 px-1.5 py-0.5 rounded">Out</span>}
              </div>
              {item.description && <p className="text-slate-500 text-xs mt-1 line-clamp-1">{item.description}</p>}
              <p className="text-primary-400 font-semibold text-sm mt-2">PKR {item.price.toLocaleString()}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-80 flex flex-col">
        <div className="card flex-1 flex flex-col overflow-hidden">
          <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center justify-between">
            <span>Current Order</span>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="text-xs text-red-400 hover:text-red-300">Clear</button>
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
                  onClick={() => setActiveLineId(item.lineId)}
                  className={`bg-slate-700/50 rounded-lg px-3 py-2 border ${
                    activeLineId === item.lineId ? 'border-primary-500' : 'border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-medium truncate">{item.name}</p>
                      <p className="text-slate-500 text-xs">Unit price</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => removeFromCart(item.lineId)} className="w-5 h-5 rounded bg-slate-600 hover:bg-slate-500 text-white text-xs flex items-center justify-center">−</button>
                      <span className="text-white text-xs w-5 text-center">{item.quantity}</span>
                      <button onClick={() => addToCart({ ...item, price: item.price })} className="w-5 h-5 rounded bg-slate-600 hover:bg-slate-500 text-white text-xs flex items-center justify-center">+</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="number"
                      min="0"
                      value={item.price}
                      onChange={e => updateLine(item.lineId, { price: Math.max(0, Number(e.target.value)) })}
                      className="input-field py-1.5 text-xs w-24"
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
                className="input-field py-1.5 text-xs"
              />
            </div>

            {/* Payment Method */}
            <div>
              <label className="label text-xs">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="input-field py-1.5 text-xs bg-slate-700"
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="online">Online</option>
              </select>
            </div>

            {/* Create Bill */}
            <button onClick={createBill} disabled={cart.length === 0} className="btn-primary w-full text-sm py-2.5">
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
