import { useEffect, useCallback } from 'react';
import { QUICK_KEY_SET } from '../constants.js';

export function usePOSKeyboard({
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
}) {
  const { fsm, pendingLineId, pendingIsNewLine, itemBuffer } = fsmState;

  const pickCartLineByArrow = useCallback((arrowKey) => {
    if (cart.length === 0) return;
    const currentIdx = cart.findIndex(c => c.lineId === pendingLineId);
    const nextIdx = currentIdx === -1
      ? (arrowKey === 'ArrowUp' ? cart.length - 1 : 0)
      : (arrowKey === 'ArrowUp'
        ? (currentIdx - 1 + cart.length) % cart.length
        : (currentIdx + 1) % cart.length);
    const line = cart[nextIdx];
    inputBufferRef.current = '';
    dispatch({ type: 'SELECT_LINE', lineId: line.lineId, hasPriceOption: line.halfPrice !== null });
  }, [cart, pendingLineId, dispatch, inputBufferRef]);

  useEffect(() => {
    const onKeyDown = (e) => {
      const key = e.key.toLowerCase();
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isFormFieldFocused = tag === 'input' || tag === 'textarea' || tag === 'select';

      if (isFormFieldFocused && fsm === 'IDLE') {
        // Only letter quick-keys are intercepted when a form field is focused.
        // Digit keys always pass through so inputs (discount, table) still work.
        const isQuickKeyHotkey = QUICK_KEY_SET.has(key) && key.length === 1 && !e.repeat &&
          !(key >= '0' && key <= '9');
        const isGlobalIdleHotkey =
          e.key === 'Escape' || e.key === 'F8' || e.key === 'F9' ||
          e.key === 'F10' || e.key === 'F6' || e.key === 'F7' ||
          e.key === 'F12' || e.key === 'ArrowUp' || e.key === 'ArrowDown';
        if (!isQuickKeyHotkey && !isGlobalIdleHotkey) return;
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
        inputBufferRef.current = '';
        dispatch({ type: 'START_TABLE' });
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
        deleteLine(targetLineId);
        if (pendingLineId === targetLineId) {
          inputBufferRef.current = '';
          dispatch({ type: 'RESET' });
        }
        return;
      }

      // ── IDLE ──
      if (fsm === 'IDLE') {
        // Letter quick keys (a-z): single press fires instantly
        if (QUICK_KEY_SET.has(key) && key.length === 1 && !e.repeat && !(key >= '0' && key <= '9')) {
          e.preventDefault();
          const item = quickKeyToItem[key];
          if (item && item.isAvailable) {
            const lineId = addItem(item);
            inputBufferRef.current = '';
            dispatch({ type: 'START_ITEM', lineId, hasPriceOption: item.halfPrice != null });
          }
          // unassigned letter: swallow keystroke, do nothing
          return;
        }
        // Digit keys: build item buffer, Enter confirms
        // Digit quick keys (1-9) are confirmed the same way — buffer shows them highlighted
        if (key >= '0' && key <= '9' && !e.repeat) {
          e.preventDefault();
          dispatch({ type: 'UPDATE_ITEM_BUFFER', buffer: itemBuffer + key });
          return;
        }
        if (e.key === 'Backspace' && itemBuffer) {
          e.preventDefault();
          dispatch({ type: 'UPDATE_ITEM_BUFFER', buffer: itemBuffer.slice(0, -1) });
          return;
        }
        if (e.key === 'Enter' && itemBuffer) {
          e.preventDefault();
          // Single digit assigned as quick key → fire it
          const qkItem = itemBuffer.length === 1 ? quickKeyToItem[itemBuffer] : null;
          if (qkItem && qkItem.isAvailable) {
            const lineId = addItem(qkItem);
            inputBufferRef.current = '';
            dispatch({ type: 'START_ITEM', lineId, hasPriceOption: qkItem.halfPrice != null });
            return;
          }
          // Otherwise look up in grid
          const bufferNum = parseInt(itemBuffer, 10);
          const gridIdx = gridItemNumbers.indexOf(bufferNum);
          const item = gridIdx !== -1 ? filteredItems[gridIdx] : null;
          if (item && item.isAvailable) {
            const lineId = addItem(item);
            inputBufferRef.current = '';
            dispatch({ type: 'START_ITEM', lineId, hasPriceOption: item.halfPrice != null });
          } else {
            dispatch({ type: 'UPDATE_ITEM_BUFFER', buffer: '' });
          }
          return;
        }
        if (e.key === 'Escape') {
          if (e.repeat) return;
          e.preventDefault();
          if (itemBuffer) {
            dispatch({ type: 'UPDATE_ITEM_BUFFER', buffer: '' });
          } else if (cart.length > 0) {
            createBill();
          }
          return;
        }
        if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && cart.length > 0) {
          e.preventDefault();
          pickCartLineByArrow(e.key);
          return;
        }
        return;
      }

      // ── PRICE ──
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
            } else if (customPrice === 0) {
              deleteLine(pendingLineId);
              inputBufferRef.current = '';
              dispatch({ type: 'RESET' });
              return;
            }
          }
          inputBufferRef.current = '';
          dispatch({ type: 'ADVANCE_TO_QTY' });
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
              if (customPrice === 0) {
                deleteLine(pendingLineId);
                inputBufferRef.current = '';
                dispatch({ type: 'RESET' });
              } else {
                updateLine(pendingLineId, { price: customPrice });
              }
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
          if (pendingIsNewLine) deleteLine(pendingLineId);
          inputBufferRef.current = '';
          dispatch({ type: 'RESET' });
          return;
        }
        return;
      }

      // ── QTY ──
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
          inputBufferRef.current = '';
          dispatch({ type: 'RESET' });
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
          if (pendingIsNewLine) deleteLine(pendingLineId);
          inputBufferRef.current = '';
          dispatch({ type: 'RESET' });
          return;
        }
        return;
      }

      // ── TABLE ──
      if (fsm === 'TABLE') {
        e.preventDefault();
        if (e.key === 'Enter') {
          if (inputBufferRef.current !== '') {
            const num = parseInt(inputBufferRef.current, 10);
            const found = tables.find(t => t.number === num);
            if (found) setSelectedTableId(found.id);
          }
          inputBufferRef.current = '';
          dispatch({ type: 'RESET' });
          return;
        }
        if (e.key >= '0' && e.key <= '9') {
          inputBufferRef.current += e.key;
          dispatch({ type: 'UPDATE_TABLE_BUFFER', buffer: inputBufferRef.current });
          return;
        }
        if (e.key === 'Backspace') {
          inputBufferRef.current = inputBufferRef.current.slice(0, -1);
          dispatch({ type: 'UPDATE_TABLE_BUFFER', buffer: inputBufferRef.current });
          return;
        }
        if (e.key === 'Escape') {
          inputBufferRef.current = '';
          dispatch({ type: 'RESET' });
          return;
        }
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    fsm, pendingLineId, pendingIsNewLine, itemBuffer,
    quickKeyToItem, filteredItems, gridItemNumbers,
    cart, tables, heldBills,
    addItem, updateLine, deleteLine,
    createBill, holdCurrentOrder, recallHeldBill,
    setSelectedTableId, discountInputRef, inputBufferRef,
    dispatch, pickCartLineByArrow,
  ]);
}
