import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus, Trash2, DollarSign, Plane, Home, Utensils, Car, Activity, MoreHorizontal } from 'lucide-react';
import { useTripStore } from '../store/useTripStore';
import { Expense } from '../types';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  flights: Plane,
  lodging: Home,
  food: Utensils,
  transport: Car,
  activities: Activity,
  other: MoreHorizontal,
};

const CATEGORY_COLORS: Record<string, string> = {
  flights: 'bg-blue-100 text-blue-600',
  lodging: 'bg-purple-100 text-purple-600',
  food: 'bg-orange-100 text-orange-600',
  transport: 'bg-green-100 text-green-600',
  activities: 'bg-pink-100 text-pink-600',
  other: 'bg-gray-100 text-gray-600',
};

export default function BudgetModule() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const trip = useTripStore((state) => state.trips.find((t) => t.id === id));
  const { addExpense, removeExpense } = useTripStore();

  const [isAdding, setIsAdding] = useState(false);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [category, setCategory] = useState<Expense['category']>('other');

  if (!trip) return null;

  const expenses = trip.expenses || [];

  // Group expenses by currency to show totals
  const totalsByCurrency = expenses.reduce((acc, expense) => {
    acc[expense.currency] = (acc[expense.currency] || 0) + expense.amount;
    return acc;
  }, {} as Record<string, number>);

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc.trim() || !amount || isNaN(Number(amount))) return;

    addExpense(trip.id, {
      description: desc,
      amount: Number(amount),
      currency,
      category,
    });

    setDesc('');
    setAmount('');
    setIsAdding(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/trip/${trip.id}`} className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h2 className="text-2xl font-bold text-gray-900">{t('budget_module')}</h2>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          {t('add_expense')}
        </button>
      </div>

      {/* Totals Summary */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">{t('total_expenses')}</h3>
        {Object.keys(totalsByCurrency).length === 0 ? (
          <p className="text-3xl font-bold text-gray-900">0.00</p>
        ) : (
          <div className="flex flex-wrap gap-6">
            {Object.entries(totalsByCurrency).map(([curr, total]) => (
              <div key={curr} className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">
                  {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-lg font-medium text-gray-500">{curr}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Expense Form */}
      {isAdding && (
        <div className="bg-white p-6 rounded-2xl border border-green-200 shadow-sm">
          <form onSubmit={handleAddExpense} className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('expense_desc')}</label>
              <input
                type="text"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                placeholder="Ej. Cena en restaurante"
                required
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('expense_amount')}</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  placeholder="0.00"
                  required
                />
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none bg-gray-50"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="ARS">ARS</option>
                  <option value="BRL">BRL</option>
                  <option value="ILS">ILS</option>
                </select>
              </div>
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('expense_category')}</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Expense['category'])}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none bg-white"
              >
                <option value="flights">{t('cat_flights')}</option>
                <option value="lodging">{t('cat_lodging')}</option>
                <option value="food">{t('cat_food')}</option>
                <option value="transport">{t('cat_transport')}</option>
                <option value="activities">{t('cat_activities')}</option>
                <option value="other">{t('cat_other')}</option>
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
                className="w-full px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
              >
                {t('create')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Expenses List */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {expenses.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{t('no_expenses')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {expenses.map((expense) => {
              const Icon = CATEGORY_ICONS[expense.category] || CATEGORY_ICONS.other;
              const colorClass = CATEGORY_COLORS[expense.category] || CATEGORY_COLORS.other;
              
              return (
                <div key={expense.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClass}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{expense.description}</h4>
                      <p className="text-sm text-gray-500">{t(`cat_${expense.category}`)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="font-bold text-gray-900">
                        {expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-sm text-gray-500 ml-1">{expense.currency}</span>
                    </div>
                    <button
                      onClick={() => removeExpense(trip.id, expense.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
