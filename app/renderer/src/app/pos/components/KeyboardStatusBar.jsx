function PriceHints({ pendingLineId, cart }) {
  const line = cart.find(c => c.lineId === pendingLineId);
  return (
    <>
      <kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-200 mx-0.5">Enter</kbd> confirm
      {line && line.halfPrice !== null && (
        <>
          {' | '}<kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-200 mx-0.5">F2</kbd> half
          {' | '}<kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-200 mx-0.5">0-9</kbd> custom
        </>
      )}
      {' | '}<kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-200 mx-0.5">Esc</kbd> cancel
    </>
  );
}

function QtyHints() {
  return (
    <>
      <kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-200 mx-0.5">Enter</kbd> confirm
      {' | '}<kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-200 mx-0.5">0-9</kbd> set qty
      {' | '}<kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-200 mx-0.5">Esc</kbd> cancel
    </>
  );
}

function TableHints({ tableBuffer }) {
  return (
    <>
      Type table #
      {tableBuffer
        ? <span className="text-white font-mono mx-1 px-1.5 py-0.5 bg-slate-700 rounded">{tableBuffer}</span>
        : <span className="text-slate-600 mx-1">—</span>
      }
      {' | '}<kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-200 mx-0.5">Enter</kbd> confirm
      {' | '}<kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-200 mx-0.5">Esc</kbd> cancel
    </>
  );
}

function DiscountHints({ discountBuffer }) {
  return (
    <>
      Enter discount amount
      {discountBuffer
        ? <span className="text-white font-mono mx-1 px-1.5 py-0.5 bg-slate-700 rounded">PKR {discountBuffer}</span>
        : <span className="text-slate-600 mx-1">—</span>
      }
      {' | '}<kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-200 mx-0.5">Enter</kbd> confirm
      {' | '}<kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-200 mx-0.5">Esc</kbd> cancel
    </>
  );
}

export default function KeyboardStatusBar({ fsm, cart, heldBills, pendingLineId, tableBuffer, itemBuffer, discountBuffer }) {
  if (fsm !== 'IDLE') {
    return (
      <div className="mb-3 px-3 py-2 rounded-lg bg-primary-900/30 border border-primary-700/50 flex items-center gap-3">
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
          fsm === 'PRICE'      ? 'bg-yellow-500/20 text-yellow-300'
          : fsm === 'TABLE'    ? 'bg-green-500/20 text-green-300'
          : fsm === 'DISCOUNT' ? 'bg-purple-500/20 text-purple-300'
          : 'bg-blue-500/20 text-blue-300'
        }`}>
          {fsm === 'PRICE'      ? 'STEP 2: SET PRICE'
          : fsm === 'TABLE'     ? 'TABLE SELECT'
          : fsm === 'DISCOUNT'  ? 'DISCOUNT'
          : 'STEP 3: SET QTY'}
        </span>
        <span className="text-xs text-slate-400">
          {fsm === 'PRICE'    && <PriceHints pendingLineId={pendingLineId} cart={cart} />}
          {fsm === 'QTY'      && <QtyHints />}
          {fsm === 'TABLE'    && <TableHints tableBuffer={tableBuffer} />}
          {fsm === 'DISCOUNT' && <DiscountHints discountBuffer={discountBuffer} />}
        </span>
      </div>
    );
  }

  if (itemBuffer) {
    return (
      <div className="mb-3 px-3 py-2 rounded-lg bg-yellow-900/30 border border-yellow-700/50 flex items-center gap-3">
        <span className="text-xs font-bold px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300">
          ADD ITEM
        </span>
        <span className="text-xs text-slate-400">
          Item #<span className="text-white font-mono mx-1 px-1.5 py-0.5 bg-slate-700 rounded">{itemBuffer}</span>
          {' | '}<kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-200 mx-0.5">Enter</kbd> confirm
          {' | '}<kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-200 mx-0.5">Esc</kbd> cancel
        </span>
      </div>
    );
  }

  return (
    <div className="mb-3 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700">
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-slate-500">
        <span><kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-300">0-9</kbd> add item</span>
        <span><kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-300">F5</kbd> hold bill</span>
        <span className={heldBills.length === 0 ? 'opacity-40' : ''}>
          <kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-300">F6</kbd> recall hold
        </span>
        <span><kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-300">F7</kbd> table</span>
        <span><kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-300">F8</kbd> remove item</span>
        <span><kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-300">F9</kbd> discount</span>
        <span><kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-300">F11</kbd> bill (no print)</span>
        <span><kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-300">F12</kbd> print bill</span>
      </div>
    </div>
  );
}