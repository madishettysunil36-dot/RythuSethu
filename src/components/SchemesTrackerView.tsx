import React, {useEffect, useMemo, useState} from 'react';
import {
  CheckCircle2,
  FileCheck2,
  Globe,
  Landmark,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import {readOfflineCache, writeOfflineCache} from '../hooks/usePWA.ts';
import type {
  ChatRolePersona,
  District,
  FarmerScheme,
  LanguageCode,
  MapCategory,
  SchemeStatus,
} from '../types/agri.ts';

interface SchemesTrackerViewProps {
  district: District;
  language: LanguageCode;
  onOpenChatWithQuery: (persona: ChatRolePersona, query: string) => void;
  onNavigateMap: (category: MapCategory) => void;
}

const STATUS_OPTIONS: Array<{id: SchemeStatus; label: string; color: string}> = [
  {id: 'not_checked', label: 'Not Checked', color: 'text-slate-600 bg-slate-100 border-slate-200'},
  {id: 'eligible', label: 'Eligible', color: 'text-sky-900 bg-sky-50 border-sky-300'},
  {id: 'applied', label: 'Applied', color: 'text-amber-900 bg-amber-50 border-amber-300'},
  {id: 'received', label: 'Credited', color: 'text-emerald-900 bg-emerald-50 border-emerald-400'},
];

export const SchemesTrackerView: React.FC<SchemesTrackerViewProps> = ({
  district,
  language,
  onOpenChatWithQuery,
  onNavigateMap,
}) => {
  const [schemes, setSchemes] = useState<FarmerScheme[]>(() =>
    readOfflineCache<FarmerScheme[]>('schemes:list', []),
  );
  const [filterAuthority, setFilterAuthority] = useState<'All' | 'Telangana State' | 'Other'>('All');

  useEffect(() => {
    fetch('/api/schemes')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.schemes)) {
          setSchemes(data.schemes);
          writeOfflineCache('schemes:list', data.schemes);
        }
      })
      .catch(() => {});
  }, []);

  const updateStatus = async (schemeId: string, status: SchemeStatus) => {
    const today = new Date().toISOString().slice(0, 10);
    setSchemes((prev) => {
      const updated = prev.map((s) =>
        s.id === schemeId ? {...s, status, updatedAt: today} : s,
      );
      writeOfflineCache('schemes:list', updated);
      return updated;
    });

    await fetch(`/api/schemes/${schemeId}`, {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({status}),
    }).catch(() => {});
  };

  const filtered = useMemo(() => {
    if (filterAuthority === 'All') return schemes;
    if (filterAuthority === 'Telangana State') {
      return schemes.filter((s) => s.authority === 'Telangana State');
    }
    return schemes.filter((s) => s.authority !== 'Telangana State');
  }, [schemes, filterAuthority]);

  const counts = useMemo(() => {
    return {
      total: schemes.length,
      received: schemes.filter((s) => s.status === 'received').length,
      active: schemes.filter((s) => s.status === 'applied' || s.status === 'eligible').length,
    };
  }, [schemes]);

  return (
    <div className="space-y-6">
      {/* Header Summary Strip */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-emerald-800">
              {district} Farmer Entitlement & DBT Checklist
            </p>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
              {language === 'te'
                ? 'తెలంగాణ పథకాలు & రైతు భరోసా ట్రాకర్'
                : language === 'hi'
                  ? 'तेलंगाना सरकारी योजनाएं और रायतु भरोसा ट्रैकर'
                  : 'Telangana Schemes & Rythu Bharosa Tracker'}
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onNavigateMap('soil_labs')}
              className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl"
            >
              <MapPin className="w-4 h-4 text-emerald-800" />
              Find Rythu Vedika
            </button>
            <button
              type="button"
              onClick={() =>
                onOpenChatWithQuery(
                  'mandi_scheme',
                  `Give latest official updates on Telangana Rythu Bharosa, Rythu Bima, and PM-KISAN DBT release dates for farmers in ${district}.`,
                )
              }
              className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-xl"
            >
              <Globe className="w-4 h-4" />
              Live Web Verify
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200">
          <div>
            <div className="text-xs text-slate-500">Tracked Schemes</div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
              {counts.total}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Eligible / Applied</div>
            <div className="text-xl font-bold font-mono tabular-nums text-amber-700">
              {counts.active}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Credited / Active</div>
            <div className="text-xl font-bold font-mono tabular-nums text-emerald-800">
              {counts.received}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          {(
            [
              {id: 'All', label: 'All Schemes'},
              {id: 'Telangana State', label: 'Telangana State'},
              {id: 'Other', label: 'Central & Joint Schemes'},
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilterAuthority(f.id)}
              className={`min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition-colors ${
                filterAuthority === f.id
                  ? 'bg-emerald-800 text-white border-emerald-800'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      {/* Schemes Checklist Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filtered.map((scheme) => {
          const title =
            language === 'te'
              ? scheme.teluguName
              : language === 'hi'
                ? scheme.hindiName
                : scheme.name;
          return (
            <article
              key={scheme.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                      <Landmark className="w-3.5 h-3.5 text-emerald-700" />
                      {scheme.authority}
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">{title}</h3>
                    {language !== 'en' && (
                      <div className="text-xs text-slate-500">{scheme.name}</div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold font-mono tabular-nums text-emerald-800">
                      {scheme.benefitAmountLabel}
                    </div>
                    {scheme.updatedAt && (
                      <div className="text-[11px] font-mono tabular-nums text-slate-400">
                        Updated {scheme.updatedAt}
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                  {scheme.benefitSummary}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="font-semibold text-slate-800 flex items-center gap-1 mb-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                      Eligibility
                    </div>
                    <ul className="space-y-1 text-slate-600 list-disc list-inside">
                      {scheme.eligibilityRules.map((rule, idx) => (
                        <li key={idx}>{rule}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800 flex items-center gap-1 mb-1">
                      <FileCheck2 className="w-3.5 h-3.5 text-amber-700" />
                      Required Documents
                    </div>
                    <div className="text-slate-600 leading-relaxed">
                      {scheme.requiredDocs.join(' · ')}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-2.5">
                <div className="text-[11px] font-semibold text-slate-500">
                  Your Application Status
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {STATUS_OPTIONS.map((opt) => {
                    const active = scheme.status === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updateStatus(scheme.id, opt.id)}
                        className={`min-h-[40px] px-2 py-1.5 text-[11px] font-semibold rounded-xl border transition-colors ${
                          active
                            ? opt.color
                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {active && <CheckCircle2 className="w-3 h-3 inline mr-1 -mt-0.5" />}
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => onOpenChatWithQuery('mandi_scheme', scheme.searchPrompt)}
                  className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl transition-colors"
                >
                  <Globe className="w-3.5 h-3.5" />
                  Verify Latest 2026 Updates via Web Search
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
