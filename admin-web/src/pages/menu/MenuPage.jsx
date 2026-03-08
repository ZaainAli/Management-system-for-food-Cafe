import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../store/AuthContext';
import MenuItemModal from './MenuItemModal';
import BranchSelector from '../../components/BranchSelector';

export default function MenuPage() {
  const { activeBranch } = useAuth();
  const [categories, setCategories] = useState([]);
  const [items, setItems]           = useState([]);
  const [activeTab, setActiveTab]   = useState('all');
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [editing, setEditing]       = useState(null);
  const [newCatName, setNewCatName] = useState('');
  const [addingCat, setAddingCat]   = useState(false);
  const catInputRef = useRef(null);

  const branchId = activeBranch?.id;

  const fetchAll = useCallback(async () => {
    if (!branchId) return;
    const [catRes, itemRes] = await Promise.all([
      supabase.from('menu_categories').select('id, name').eq('branch_id', branchId).order('name'),
      supabase.from('menu_items').select('id, name, price, available, category_id').eq('branch_id', branchId).order('name'),
    ]);
    setCategories(catRes.data ?? []);
    setItems(itemRes.data ?? []);
    setLoading(false);
  }, [branchId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Filter items by active tab
  const visibleItems = activeTab === 'all'
    ? items
    : items.filter((i) => i.category_id === activeTab);

  const getCatName = (id) => categories.find((c) => c.id === id)?.name ?? '—';

  const handleDeleteItem = async (id) => {
    if (!confirm('Delete this menu item?')) return;
    await supabase.from('menu_items').delete().eq('id', id);
    fetchAll();
  };

  const handleDeleteCat = async (id) => {
    if (!confirm('Delete this category? Items in it will become uncategorized.')) return;
    await supabase.from('menu_categories').delete().eq('id', id);
    if (activeTab === id) setActiveTab('all');
    fetchAll();
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    await supabase.from('menu_categories').insert({ branch_id: branchId, name: newCatName.trim() });
    setNewCatName(''); setAddingCat(false);
    fetchAll();
  };

  const startAddCat = () => {
    setAddingCat(true);
    setTimeout(() => catInputRef.current?.focus(), 50);
  };

  if (!branchId) return <div className="text-slate-500 text-sm">Select a branch to manage its menu.</div>;

  if (loading) return (
    <div className="space-y-3">
      {[1,2,3].map((i) => <div key={i} className="card h-14 animate-pulse bg-slate-700/50" />)}
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">Menu</h1>
            <p className="text-slate-500 text-sm mt-0.5">{activeBranch.name} — {items.length} items</p>
          </div>
          <BranchSelector />
        </div>
        <button onClick={() => { setEditing(null); setShowModal(true); }} className="btn-primary text-sm">
          + Add Item
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
            ${activeTab === 'all' ? 'bg-primary-500 text-white' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'}`}
        >
          All ({items.length})
        </button>

        {categories.map((c) => (
          <div key={c.id} className="relative group">
            <button
              onClick={() => setActiveTab(c.id)}
              className={`pl-3 pr-7 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${activeTab === c.id ? 'bg-primary-500 text-white' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'}`}
            >
              {c.name} ({items.filter((i) => i.category_id === c.id).length})
            </button>
            <button
              onClick={() => handleDeleteCat(c.id)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-600
                         hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
              title="Delete category"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}

        {/* Add category */}
        {addingCat ? (
          <div className="flex items-center gap-1">
            <input
              ref={catInputRef}
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(); if (e.key === 'Escape') setAddingCat(false); }}
              placeholder="Category name"
              className="input-field !w-32 !py-1 text-xs"
            />
            <button onClick={handleAddCategory} className="text-green-400 hover:text-green-300 p-1"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => setAddingCat(false)} className="text-slate-500 hover:text-white p-1"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <button onClick={startAddCat} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:text-white border border-dashed border-slate-700 hover:border-slate-500 transition-colors">
            <Plus className="w-3 h-3" /> Category
          </button>
        )}
      </div>

      {/* Items table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Name</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase hidden sm:table-cell">Category</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Price</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase hidden md:table-cell">Status</th>
              <th className="px-4 py-3 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item) => (
              <tr key={item.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-3 text-white font-medium">{item.name}</td>
                <td className="px-4 py-3 text-slate-400 text-xs hidden sm:table-cell">{getCatName(item.category_id)}</td>
                <td className="px-4 py-3 text-slate-300">Rs {Number(item.price).toLocaleString()}</td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${item.available ? 'bg-green-900/40 text-green-400' : 'bg-slate-700 text-slate-500'}`}>
                    {item.available ? 'Available' : 'Unavailable'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={() => { setEditing(item); setShowModal(true); }} className="text-slate-400 hover:text-white transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDeleteItem(item.id)} className="text-slate-400 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {visibleItems.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-600 text-sm">
                No items{activeTab !== 'all' ? ' in this category' : ''}. Click <strong className="text-slate-500">+ Add Item</strong>.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <MenuItemModal
          item={editing}
          categories={categories}
          branchId={branchId}
          onClose={() => setShowModal(false)}
          onSaved={fetchAll}
        />
      )}
    </div>
  );
}
