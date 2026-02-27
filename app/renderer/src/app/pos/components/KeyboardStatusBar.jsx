import React from 'react';

export default function KeyboardStatusBar({ fsm, cart, heldBills, pendingLineId, tableBuffer, inputBufferRef }) {
  if (fsm !== 'IDLE') {
    return (
      <div className="mb-3 px-3 py-2 rounded-lg bg-primary-900/30 border border-primary-700/50 flex items-center gap-3">
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
          fsm === 'PRICE' ? 'bg-yellow-500/20 text-yellow-300'
          : fsm === 'TABLE' ? 'bg-green-500/20 text-green-300'
          : 'bg-blue-500/20 text-blue-300'
        }`}>
          {fsm === 'PRICE' ? 'STEP 2: SET PRICE' : fsm === 'TABLE' ? 'TABLE SELECT' : 'STEP 3: SET QTY'}
        </span>
        <span className="text-xs text-slate-400">
          {fsm === 'PRICE' && (
            <PriceHints pendingLineId={pendingLineId} cart={cart} inputBufferRef={inputBufferRef} />
          )}
          {fsm === 'QTY' && <QtyHints />}
          {fsm === 'TABLE' && <TableHints tableBuffer={tableBuffer} />}
        </span>
      </div>
    );
  }

  if (cart.length > 0) {
    return (
      <div className="mb-3 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700">
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-slate-500">
          <span><kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-300">A-Z</kbd> add item</span>
          <span><kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-300">Esc</kbd> create bill</span>
          <span><kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-300">F6</kbd> hold bill</span>
          <span className={heldBills.length === 0 ? 'opacity-40' : ''}>
            <kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-300">F7</kbd> recall held
          </span>
          <span><kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-300">F8</kbd> remove item</span>
          <span><kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-300">F9</kbd> discount</span>
          <span><kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-300">F10</kbd> table</span>
          <span><kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-300">F12</kbd> bill (no print)</span>
        </div>
      </div>
    );
  }

  return null;
}

function PriceHints({ pendingLineId, cart, inputBufferRef }) {
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
