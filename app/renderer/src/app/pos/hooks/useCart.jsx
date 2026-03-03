import { useState, useEffect, useCallback } from 'react';

const makeLineId = (menuItemId) =>
  `${menuItemId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export function useCart() {
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');

  // Reset discount when cart empties
  useEffect(() => {
    if (cart.length === 0) setDiscount(0);
  }, [cart.length]);

  const addItem = useCallback((item) => {
    const lineId = makeLineId(item.id);
    setCart(prev => [...prev, {
      lineId,
      id: item.id,
      name: item.name,
      description: item.description,
      isAvailable: item.isAvailable,
      basePrice: Number(item.price),
      halfPrice: item.halfPrice != null ? Number(item.halfPrice) : null,
      price: Number(item.price),
      quantity: 1,
    }]);
    return lineId;
  }, []);

  const removeLine = useCallback((lineId) => {
    setCart(prev => {
      const item = prev.find(c => c.lineId === lineId);
      if (item && item.quantity > 1) {
        return prev.map(c => c.lineId === lineId ? { ...c, quantity: c.quantity - 1 } : c);
      }
      return prev.filter(c => c.lineId !== lineId);
    });
  }, []);

  const deleteLine = useCallback((lineId) => {
    setCart(prev => prev.filter(c => c.lineId !== lineId));
  }, []);

  const updateLine = useCallback((lineId, updates) => {
    setCart(prev => {
      if ('price' in updates && Number(updates.price) <= 0) {
        return prev.filter(c => c.lineId !== lineId);
      }
      return prev.map(c => c.lineId === lineId ? { ...c, ...updates } : c);
    });
  }, []);

  const clear = useCallback(() => setCart([]), []);

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const total = cartTotal - discount;

  return {
    cart, setCart,
    discount, setDiscount,
    paymentMethod, setPaymentMethod,
    addItem, removeLine, deleteLine, updateLine, clear,
    cartTotal, total,
  };
}
