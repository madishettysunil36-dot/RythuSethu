import React, {useEffect, useMemo, useState} from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Wallet,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {readOfflineCache, writeOfflineCache} from '../hooks/usePWA.ts';
import type {District, KhataEntry, KhataEntryType, LanguageCode} from '../types/agri.ts';

interface FarmKhataViewProps {
  district: District;
  language: LanguageCode;
}

const TYPE_META: Record<
  KhataEntryType,
  {label: string; telugu: string; colorClass: string; sign: string}
> = {
  income: {
    label: 'Harvest Sale',
    telugu: 'పంట అమ్మకం ఆదాయం',
    colorClass: 'text-emerald-800',
    sign: '+',
  },
  subsidy: {
    label: 'Govt Subsidy / DBT',
    telugu: 'రైతు భరోసా / సబ్సిడీ',
    colorClass: 'text-sky-800',
    sign: '+',
  },
  input_cost: {
    label: 'Farm Expense',
    telugu: 'పెట్టుబడి ఖర్చు',
    colorClass: 'text-red-700',
    sign: '-',
  },
  loan: {
    label: 'Crop Loan',
    telugu: 'పంట రుణం',
    colorClass: 'text-amber-800',
    sign: '',
  },
};

export const FarmKhataView: React.FC<FarmKhataViewProps> = ({district, language}) => {
  const [entries, setEntries] = useState<KhataEntry[]>(() =>
    readOfflineCache<KhataEntry[]>('khata:entries', []),
  );
  const [filterType, setFilterType] = useState<'all' | KhataEntryType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const [form, setForm] = useState<{
    type: KhataEntryType;
    title: string;
    crop: string;
    amountInr: number;
    date: string;
    counterparty: string;
    interestRatePercent: number;
    tenureMonths: number;
    notes: string;
  }>({
    type: 'input_cost',
    title: '',
    crop: 'Paddy (RNR-15048)',
    amountInr: 4500,
    date: new Date().toISOString().slice(0, 10),
    counterparty: '',
    interestRatePercent: 7,
    tenureMonths: 12,
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/khata')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.entries)) {
          setEntries(data.entries);
          writeOfflineCache('khata:entries', data.entries);
        }
      })
      .catch(() => {});
  }, []);

  const addEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || form.amountInr <= 0) return;
    setSaving(true);
    try {
      const res = await fetch('/api/khata', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok && data.entry) {
        const updated = [data.entry, ...entries];
        setEntries(updated);
        writeOfflineCache('khata:entries', updated);
        setShowAddForm(false);
        setForm((p) => ({...p, title: '', counterparty: '', notes: ''}));
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async (id: string) => {
    const updated = entries.filter((e) => e.id !== id);
    setEntries(updated);
    writeOfflineCache('khata:entries', updated);
    await fetch(`/api/khata/${id}`, {method: 'DELETE'}).catch(() => {});
  };

  const summary = useMemo(() => {
    const income = entries
      .filter((e) => e.type === 'income')
      .reduce((s, e) => s + e.amountInr, 0);
    const subsidies = entries
      .filter((e) => e.type === 'subsidy')
      .reduce((s, e) => s + e.amountInr, 0);
    const expenses = entries
      .filter((e) => e.type === 'input_cost')
      .reduce((s, e) => s + e.amountInr, 0);
    const loans = entries.filter((e) => e.type === 'loan');
    const loanPrincipal = loans.reduce((s, e) => s + e.amountInr, 0);
    const estimatedAnnualInterest = loans.reduce((s, e) => {
      const rate = e.interestRatePercent ?? 0;
      const months = e.tenureMonths ?? 12;
      return s + Math.round((e.amountInr * (rate / 100) * months) / 12);
    }, 0);

    const netCashPosition = income + subsidies - expenses;
    const netAfterDebtService = netCashPosition - estimatedAnnualInterest;

    const chartData = [
      {bucket: 'Sales', amount: income},
      {bucket: 'Subsidies', amount: subsidies},
      {bucket: 'Expenses', amount: expenses},
      {bucket: 'Loans', amount: loanPrincipal},
    ];

    return {
      income,
      subsidies,
      expenses,
      loanPrincipal,
      estimatedAnnualInterest,
      netCashPosition,
      netAfterDebtService,
      chartData,
    };
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return entries
      .filter((e) => (filterType === 'all' ? true : e.type === filterType))
      .filter((e) =>
        searchQuery.trim()
          ? `${e.title} ${e.crop} ${e.counterparty ?? ''}`
              .toLowerCase()
              .includes(searchQuery.toLowerCase())
          : true,
      );
  }, [entries, filterType, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header + Grain Mandi Photo */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-4 relative h-44 lg:h-auto bg-slate-100">
          <img
            src="/src/assets/images/grain_mandi_godown_1795036061467.jpg"
            alt="Telangana grain mandi harvest weighing and godown"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent flex items-end p-4 text-white">
            <div>
              <div className="text-[11px] font-medium text-amber-200">
                {district} Season Ledger
              </div>
              <div className="text-sm font-bold">Income, Loans & Profit Khata</div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                {language === 'te'
                  ? 'రైతు ఖాతా — ఆదాయం, రుణాలు & నికర లాభం'
                  : language === 'hi'
                    ? 'किसान खाता — आय, फसल ऋण और शुद्ध मुनाफा'
                    : 'Farm Khata — Income, Loan & Profit Ledger'}
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                Track crop sales, input expenses, KCC/private interest burden, and Rythu Bharosa credits in one place.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-xl whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              {showAddForm ? 'Close Form' : 'Log Khata Entry'}
            </button>
          </div>

          {/* 4 Tabular Financial KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-slate-200">
            <div>
              <div className="text-xs text-slate-500">Sales + Subsidies</div>
              <div className="text-lg font-bold font-mono tabular-nums text-emerald-800 mt-0.5">
                ₹{(summary.income + summary.subsidies).toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500">
                DBT: ₹{summary.subsidies.toLocaleString('en-IN')}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Input Costs</div>
              <div className="text-lg font-bold font-mono tabular-nums text-red-700 mt-0.5">
                ₹{summary.expenses.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-500">Seeds, NPK, Labor</div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Crop Loans</div>
              <div className="text-lg font-bold font-mono tabular-nums text-amber-800 mt-0.5">
                ₹{summary.loanPrincipal.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500">
                Est. Int: ₹{summary.estimatedAnnualInterest.toLocaleString('en-IN')}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Net Season Surplus</div>
              <div
                className={`text-lg font-bold font-mono tabular-nums mt-0.5 ${
                  summary.netAfterDebtService >= 0 ? 'text-emerald-800' : 'text-red-700'
                }`}
              >
                ₹{summary.netAfterDebtService.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-500">After loan interest</div>
            </div>
          </div>
        </div>
      </section>

      {/* Add Khata Entry Form */}
      {showAddForm && (
        <form
          onSubmit={addEntry}
          className="bg-white border border-emerald-700 rounded-2xl p-5 space-y-4"
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(
              [
                {id: 'income', label: 'Harvest Sale (+)'},
                {id: 'input_cost', label: 'Farm Expense (-)'},
                {id: 'loan', label: 'Crop Loan'},
                {id: 'subsidy', label: 'Subsidy / DBT (+)'},
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setForm((p) => ({...p, type: t.id}))}
                className={`min-h-[44px] px-3 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                  form.type === t.id
                    ? 'bg-emerald-800 text-white border-emerald-800'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Title (e.g. Teja Chili Sale / DAP Bags)"
              value={form.title}
              onChange={(e) => setForm((p) => ({...p, title: e.target.value}))}
              className="min-h-[44px] px-3 py-2 text-xs border border-slate-300 rounded-xl"
              required
            />
            <input
              type="text"
              placeholder="Crop (e.g. Paddy, Cotton)"
              value={form.crop}
              onChange={(e) => setForm((p) => ({...p, crop: e.target.value}))}
              className="min-h-[44px] px-3 py-2 text-xs border border-slate-300 rounded-xl"
            />
            <input
              type="number"
              min={50}
              placeholder="Amount ₹"
              value={form.amountInr}
              onChange={(e) => setForm((p) => ({...p, amountInr: Number(e.target.value)}))}
              className="min-h-[44px] px-3 py-2 text-xs font-mono tabular-nums border border-slate-300 rounded-xl"
              required
            />
            <input
              type="text"
              placeholder={form.type === 'loan' ? 'Bank / Lender Name' : 'Buyer / Shop Name'}
              value={form.counterparty}
              onChange={(e) => setForm((p) => ({...p, counterparty: e.target.value}))}
              className="min-h-[44px] px-3 py-2 text-xs border border-slate-300 rounded-xl"
            />
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((p) => ({...p, date: e.target.value}))}
              className="min-h-[44px] px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl"
            />
            {form.type === 'loan' ? (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={0}
                  max={60}
                  step={0.5}
                  value={form.interestRatePercent}
                  onChange={(e) =>
                    setForm((p) => ({...p, interestRatePercent: Number(e.target.value)}))
                  }
                  placeholder="% Rate"
                  className="min-h-[44px] px-3 py-2 text-xs font-mono tabular-nums border border-slate-300 rounded-xl"
                />
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={form.tenureMonths}
                  onChange={(e) => setForm((p) => ({...p, tenureMonths: Number(e.target.value)}))}
                  placeholder="Months"
                  className="min-h-[44px] px-3 py-2 text-xs font-mono tabular-nums border border-slate-300 rounded-xl"
                />
              </div>
            ) : (
              <input
                type="text"
                placeholder="Notes (optional)"
                value={form.notes}
                onChange={(e) => setForm((p) => ({...p, notes: e.target.value}))}
                className="min-h-[44px] px-3 py-2 text-xs border border-slate-300 rounded-xl"
              />
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto min-h-[44px] px-6 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-xl"
          >
            {saving ? 'Saving Entry...' : 'Save to Farm Khata'}
          </button>
        </form>
      )}

      {/* Cashflow Visual Chart + Filterable Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="pb-3 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Season Cashflow Mix</h3>
              <p className="text-xs text-slate-500">Revenue vs Expenses vs Credit</p>
            </div>
            <Wallet className="w-5 h-5 text-emerald-700" />
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="bucket" tick={{fontSize: 12, fill: '#475569'}} />
                <YAxis tick={{fontSize: 11, fill: '#475569'}} width={60} />
                <Tooltip
                  formatter={(value) => [`₹${Number(value ?? 0).toLocaleString('en-IN')}`, 'Amount']}
                />
                <Bar dataKey="amount" fill="#166534" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  {id: 'all', label: 'All'},
                  {id: 'income', label: 'Income'},
                  {id: 'input_cost', label: 'Expenses'},
                  {id: 'loan', label: 'Loans'},
                  {id: 'subsidy', label: 'Subsidies'},
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterType(tab.id)}
                  className={`min-h-[38px] px-3 py-1 text-xs font-semibold rounded-xl border transition-colors ${
                    filterType === tab.id
                      ? 'bg-emerald-800 text-white border-emerald-800'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-48">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search khata..."
                className="w-full min-h-[38px] pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          {filteredEntries.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-500">
              No matching Khata entries found. Log a sale, expense, or loan above.
            </p>
          ) : (
            <div className="divide-y divide-slate-200 max-h-[380px] overflow-y-auto pr-1">
              {filteredEntries.map((entry) => {
                const meta = TYPE_META[entry.type];
                return (
                  <div
                    key={entry.id}
                    className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                        {entry.type === 'income' ? (
                          <ArrowDownLeft className="w-4 h-4 text-emerald-700" />
                        ) : entry.type === 'subsidy' ? (
                          <Sparkles className="w-4 h-4 text-sky-700" />
                        ) : entry.type === 'loan' ? (
                          <Landmark className="w-4 h-4 text-amber-700" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4 text-red-700" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate">
                          {entry.title}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {language === 'te' ? meta.telugu : meta.label} · {entry.crop} ·{' '}
                          <span className="font-mono tabular-nums">{entry.date}</span>
                          {entry.counterparty ? ` · ${entry.counterparty}` : ''}
                        </div>
                        {entry.type === 'loan' && entry.interestRatePercent !== undefined && (
                          <div className="text-[11px] font-mono tabular-nums text-amber-800 mt-0.5">
                            Interest: {entry.interestRatePercent}% p.a. ({entry.tenureMonths ?? 12} mo)
                          </div>
                        )}
                        {entry.notes && (
                          <div className="text-[11px] text-slate-500 mt-0.5">{entry.notes}</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-sm font-bold font-mono tabular-nums ${meta.colorClass}`}
                      >
                        {meta.sign}₹{entry.amountInr.toLocaleString('en-IN')}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteEntry(entry.id)}
                        aria-label={`Delete ${entry.title}`}
                        className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
