import React from 'react';
import { QUICK_KEY_LIST } from '../constants.js';

export default function QuickKeysBar({ quickKeyToItem, fsm, cart, pendingLineId, onAddItem, dispatch, inputBufferRef }) {
  if (!Object.keys(quickKeyToItem).length) return null;

  return (
    <div className="flex gap-2 mb-3 flex-wrap">
      {QUICK_KEY_LIST.map(k => {
        const item = quickKeyToItem[k];
        if (!item) return null;
        const isBeingConfigured =
          pendingLineId && fsm !== 'IDLE' &&
          cart.find(c => c.lineId === pendingLineId)?.id === item.id;
        return (
          <button
            key={k}
            onClick={() => {
              if (fsm !== 'IDLE' || !item.isAvailable) return;
              const lineId = onAddItem(item);
              inputBufferRef.current = '';
              dispatch({ type: 'START_ITEM', lineId, hasPriceOption: item.halfPrice != null });
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
  );
}
