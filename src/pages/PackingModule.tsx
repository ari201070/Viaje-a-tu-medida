import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus, Trash2, CheckCircle2, Circle, Shirt, Smartphone, FileText, Bath, Package, ListChecks } from 'lucide-react';
import { useTripStore } from '../store/useTripStore';
import { PackingItem } from '../types';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  clothes: Shirt,
  electronics: Smartphone,
  documents: FileText,
  toiletries: Bath,
  other: Package,
};

export default function PackingModule() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const trip = useTripStore((state) => state.trips.find((t) => t.id === id));
  const { addPackingItem, togglePackingItem, removePackingItem } = useTripStore();

  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<PackingItem['category']>('clothes');

  if (!trip) return null;

  const packingList = trip.packingList || [];
  
  // Calculate progress
  const totalItems = packingList.length;
  const packedItems = packingList.filter(item => item.isPacked).length;
  const progressPercentage = totalItems === 0 ? 0 : Math.round((packedItems / totalItems) * 100);

  // Group items by category
  const groupedItems = packingList.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, PackingItem[]>);

  const categories: PackingItem['category'][] = ['documents', 'clothes', 'electronics', 'toiletries', 'other'];

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    addPackingItem(trip.id, {
      name: name.trim(),
      category,
    });

    setName('');
    setIsAdding(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/trip/${trip.id}`} className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h2 className="text-2xl font-bold text-gray-900">{t('packing_module')}</h2>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          {t('add_item')}
        </button>
      </div>

      {/* Progress Bar */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex justify-between items-end mb-2">
          <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{t('packed')}</span>
          <span className="text-2xl font-bold text-gray-900">{progressPercentage}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div 
            className="bg-amber-500 h-3 rounded-full transition-all duration-500 ease-out" 
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
        <p className="text-sm text-gray-500 mt-2 text-right">
          {packedItems} / {totalItems}
        </p>
      </div>

      {/* Add Item Form */}
      {isAdding && (
        <div className="bg-white p-6 rounded-2xl border border-amber-200 shadow-sm">
          <form onSubmit={handleAddItem} className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('item_name')}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                placeholder="Ej. Pasaporte, Cargador..."
                required
                autoFocus
              />
            </div>
            <div className="md:col-span-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('expense_category')}</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as PackingItem['category'])}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white"
              >
                <option value="documents">{t('pack_cat_documents')}</option>
                <option value="clothes">{t('pack_cat_clothes')}</option>
                <option value="electronics">{t('pack_cat_electronics')}</option>
                <option value="toiletries">{t('pack_cat_toiletries')}</option>
                <option value="other">{t('pack_cat_other')}</option>
              </select>
            </div>
            <div className="md:col-span-2 flex items-end gap-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="w-full px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                className="w-full px-3 py-2 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors"
              >
                {t('create')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Items List */}
      {totalItems === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-200 shadow-sm">
          <ListChecks className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">{t('no_items')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {categories.map((cat) => {
            const itemsInCategory = groupedItems[cat];
            if (!itemsInCategory || itemsInCategory.length === 0) return null;

            const Icon = CATEGORY_ICONS[cat];

            return (
              <div key={cat} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-2">
                  <Icon className="w-5 h-5 text-gray-500" />
                  <h3 className="font-semibold text-gray-700">{t(`pack_cat_${cat}`)}</h3>
                  <span className="ml-auto text-xs font-medium bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
                    {itemsInCategory.filter(i => i.isPacked).length} / {itemsInCategory.length}
                  </span>
                </div>
                <div className="divide-y divide-gray-100">
                  {itemsInCategory.map((item) => (
                    <div 
                      key={item.id} 
                      className={`p-4 flex items-center justify-between hover:bg-gray-50 transition-colors group cursor-pointer ${item.isPacked ? 'opacity-60' : ''}`}
                      onClick={() => togglePackingItem(trip.id, item.id)}
                    >
                      <div className="flex items-center gap-3">
                        <button className="text-gray-400 hover:text-amber-500 transition-colors focus:outline-none">
                          {item.isPacked ? (
                            <CheckCircle2 className="w-6 h-6 text-amber-500" />
                          ) : (
                            <Circle className="w-6 h-6" />
                          )}
                        </button>
                        <span className={`font-medium transition-all ${item.isPacked ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                          {item.name}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removePackingItem(trip.id, item.id);
                        }}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
