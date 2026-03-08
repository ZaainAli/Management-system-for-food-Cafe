import React, { useState } from 'react';
import { ChevronDown, GitBranch } from 'lucide-react';
import { useAuth } from '../store/AuthContext';

export default function BranchSelector() {
  const { branches, activeBranch, setActiveBranch } = useAuth();
  const [open, setOpen] = useState(false);

  if (branches.length <= 1) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700
                   rounded-lg text-sm text-slate-200 hover:bg-slate-700 transition-colors"
      >
        <GitBranch className="w-3.5 h-3.5 text-primary-400 flex-shrink-0" />
        <span className="truncate max-w-[140px]">{activeBranch?.name ?? 'Select Branch'}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-1 min-w-[180px] bg-slate-800 border
                       border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden"
          >
            {branches.map((b) => (
              <button
                key={b.id}
                onClick={() => { setActiveBranch(b); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors
                  ${activeBranch?.id === b.id
                    ? 'bg-primary-500/20 text-primary-400'
                    : 'text-slate-300 hover:bg-slate-700'}`}
              >
                {b.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
