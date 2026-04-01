import React from 'react';
import HeldBillsPanel from './HeldBillsPanel.jsx';

export default function CartPanel({
  cart,
  discount,
  setDiscount,
  paymentMethod,
  setPaymentMethod,
  total,
  tables,
  selectedTableId,
  setSelectedTableId,
  heldBills,
  fsm,
  pendingLineId,
  inputBufferRef,
  stockByMenuName,
  discountInputRef,
  onClear,
  onUpdateLine,
  onRemoveLine,
  onDeleteLine,
  onCreateBill,
  onHoldBill,
  onRecallHeld,
  onDeleteHeld,
  dispatch,
}) {
  return (
    <div className="flex flex-col flex-1">
      <div className="card flex-1 flex flex-col overflow-hidden">
        <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center justify-between">
          <span>Current Order</span>
          {cart.length > 0 && (
            <button onClick={onClear} className="text-xs text-red-400 hover:text-red-300">
              Clear
            </button>
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
                    inputBufferRef.current = '';
                    dispatch({ type: 'SELECT_LINE', lineId: item.lineId, hasPriceOption: item.halfPrice !== null });
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
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteLine(item.lineId); }}
                        className="w-5 h-5 rounded bg-red-700/70 hover:bg-red-600 text-white text-xs flex items-center justify-center"
                      >×</button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onRemoveLine(item.lineId); }}
                        className="w-5 h-5 rounded bg-slate-600 hover:bg-slate-500 text-white text-xs flex items-center justify-center"
                      >−</button>
                      <span className="text-white text-xs w-5 text-center">{item.quantity}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onUpdateLine(item.lineId, { quantity: item.quantity + 1 }); }}
                        className="w-5 h-5 rounded bg-slate-600 hover:bg-slate-500 text-white text-xs flex items-center justify-center"
                      >+</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="number"
                      min="0"
                      value={item.price}
                      onChange={e => onUpdateLine(item.lineId, { price: Math.max(0, Number(e.target.value)) })}
                      disabled={item.halfPrice === null}
                      className="input-field py-1.5 text-xs w-24 disabled:opacity-50"
                    />
                    <button onClick={() => onUpdateLine(item.lineId, { price: item.basePrice })} className="text-xs text-slate-300 hover:text-white">
                      Full
                    </button>
                    {item.halfPrice !== null && item.halfPrice !== undefined && (
                      <button onClick={() => onUpdateLine(item.lineId, { price: item.halfPrice })} className="text-xs text-slate-300 hover:text-white">
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
              type="text"
              inputMode="numeric"
              value={discount}
              onFocus={(e) => e.target.select()}
              onChange={e => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                setDiscount(val === '' ? 0 : Math.max(0, Number(val)));
              }}
              disabled={fsm !== 'IDLE' && fsm !== 'DISCOUNT'}
              className="input-field py-1.5 text-xs"
            />
          </div>

          {/* Table */}
          <div>
            <label className="label text-xs">Table</label>
            <select
              value={selectedTableId}
              onChange={e => setSelectedTableId(e.target.value)}
              disabled={fsm !== 'IDLE'}
              className="input-field py-1.5 text-xs bg-slate-700"
            >
              <option value="">No table</option>
              {tables.map(t => (
                <option key={t.id} value={t.id}>Table {t.number}</option>
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

          <button
            onClick={onCreateBill}
            disabled={cart.length === 0 || fsm !== 'IDLE'}
            className="btn-primary w-full text-sm py-2.5"
          >
            Create Bill — PKR {Math.max(0, total).toLocaleString()}
          </button>
          <button
            onClick={onHoldBill}
            disabled={cart.length === 0 || fsm !== 'IDLE'}
            className="w-full text-sm py-2 rounded-lg bg-yellow-700/70 hover:bg-yellow-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Hold Bill (F6)
          </button>

          <HeldBillsPanel
            heldBills={heldBills}
            fsm={fsm}
            onRecall={onRecallHeld}
            onDelete={onDeleteHeld}
          />
        </div>
      </div>
    </div>
  );
}
