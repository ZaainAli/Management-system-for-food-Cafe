import React from 'react';
import { formatPkDateTime } from '../../../utils/datetime';

export default function HeldBillsPanel({ heldBills, fsm, onRecall, onDelete }) {
  if (heldBills.length === 0) return null;

  return (
    <div className="mt-2 border border-slate-700 rounded-lg p-2 bg-slate-800/70">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-slate-300">Held Orders ({heldBills.length})</p>
        <button
          onClick={() => onRecall(heldBills[0].id)}
          disabled={fsm !== 'IDLE'}
          className="text-[11px] text-primary-300 hover:text-primary-200 disabled:opacity-50"
        >
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
                PKR {Number(held.total || 0).toLocaleString()} | {formatPkDateTime(held.updatedAt)}
              </p>
            </div>
            <button
              onClick={() => onRecall(held.id)}
              disabled={fsm !== 'IDLE'}
              className="text-[11px] px-2 py-0.5 rounded bg-primary-700/70 hover:bg-primary-600 text-white disabled:opacity-50"
            >
              Recall
            </button>
            <button
              onClick={() => onDelete(held.id)}
              disabled={fsm !== 'IDLE'}
              className="text-[11px] px-2 py-0.5 rounded bg-red-700/70 hover:bg-red-600 text-white disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
