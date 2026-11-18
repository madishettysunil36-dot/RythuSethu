import React, {useEffect, useMemo, useState} from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  CloudRain,
  Copy,
  Droplets,
  Loader2,
  Plus,
  Sprout,
  Trash2,
  Wind,
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
import {fetchWithRetry} from '../utils/fetchWithRetry.ts';
import type {
  District,
  FarmCostEntry,
  LanguageCode,
  SmartFasalAdvice,
  SoilProfileInput,
  WeatherDay,
} from '../types/agri.ts';

interface SmartFasalViewProps {
  district: District;
  language: LanguageCode;
  isOnline: boolean;
}

export const SmartFasalView: React.FC<SmartFasalViewProps> = ({
  district,
  language,
  isOnline,
}) => {
  const [soilInput, setSoilInput] = useState<SoilProfileInput>({
    district,
    season: 'Rabi',
    soilType: 'Black Cotton',
    nitrogen: 195,
    phosphorus: 24,
    potassium: 210,
    ph: 7.2,
    acres: 4,
  });

  useEffect(() => {
    setSoilInput((prev) => ({...prev, district}));
  }, [district]);

  const [soilStep, setSoilStep] = useState<1 | 2 | 3>(1);
  const [advice, setAdvice] = useState<SmartFasalAdvice | null>(() =>
    readOfflineCache<SmartFasalAdvice | null>('smartfasal:advice', null),
  );
  const [recommending, setRecommending] = useState(false);
  const [recRetryStatus, setRecRetryStatus] = useState<string | null>(null);
  const [recError, setRecError] = useState<string | null>(null);

  const [weatherDays, setWeatherDays] = useState<WeatherDay[]>(() =>
    readOfflineCache<WeatherDay[]>(`weather:${district}`, []),
  );
  const [alertCopied, setAlertCopied] = useState(false);

  const [costs, setCosts] = useState<FarmCostEntry[]>(() =>
    readOfflineCache<FarmCostEntry[]>('costs', []),
  );
  const [newCost, setNewCost] = useState<{
    crop: string;
    category: FarmCostEntry['category'];
    description: string;
    amountInr: number;
    acres: number;
  }>({
    crop: 'Paddy (RNR-15048)',
    category: 'Fertilizer',
    description: '',
    amountInr: 2400,
    acres: 4,
  });
  const [savingCost, setSavingCost] = useState(false);

  // Expected revenue inputs for break-even ROI calculation
  const [expectedYieldPerAcre, setExpectedYieldPerAcre] = useState<number>(24);
  const [expectedPricePerQuintal, setExpectedPricePerQuintal] = useState<number>(2500);

  useEffect(() => {
    let active = true;
    fetch(`/api/smartfasal/weather?district=${encodeURIComponent(district)}`)
      .then((r) => r.json())
      .then((data) => {
        if (active && Array.isArray(data.days)) {
          setWeatherDays(data.days);
          writeOfflineCache(`weather:${district}`, data.days);
        }
      })
      .catch(() => {
        const cached = readOfflineCache<WeatherDay[]>(`weather:${district}`, []);
        if (active && cached.length > 0) setWeatherDays(cached);
      });
    return () => {
      active = false;
    };
  }, [district]);

  useEffect(() => {
    let active = true;
    fetch('/api/smartfasal/costs')
      .then((r) => r.json())
      .then((data) => {
        if (active && Array.isArray(data.costs)) {
          setCosts(data.costs);
          writeOfflineCache('costs', data.costs);
        }
      })
      .catch(() => {
        const cached = readOfflineCache<FarmCostEntry[]>('costs', []);
        if (active && cached.length > 0) setCosts(cached);
      });
    return () => {
      active = false;
    };
  }, []);

  const runSoilRecommendation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) {
      setRecError('Offline mode — connect to run live Soil Health Card AI recommendation.');
      return;
    }
    setRecommending(true);
    setRecRetryStatus(null);
    setRecError(null);
    try {
      const res = await fetchWithRetry(
        '/api/smartfasal/recommend',
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(soilInput),
        },
        {
          maxRetries: 3,
          baseDelayMs: 900,
          onRetry: ({attempt, maxRetries, status}) => {
            setRecRetryStatus(
              `Service busy (${status ?? 'network'}) — retrying (${attempt}/${maxRetries})...`,
            );
          },
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to compute crop recommendations');
      setAdvice(data.advice);
      writeOfflineCache('smartfasal:advice', data.advice);
      setSoilStep(3);
    } catch (err: unknown) {
      setRecError(err instanceof Error ? err.message : 'Recommendation request failed.');
    } finally {
      setRecommending(false);
      setRecRetryStatus(null);
    }
  };

  const addCostEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCost.amountInr || newCost.amountInr <= 0) return;
    setSavingCost(true);
    try {
      const res = await fetch('/api/smartfasal/costs', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          ...newCost,
          description: newCost.description.trim() || `${newCost.category} input`,
          date: new Date().toISOString().slice(0, 10),
        }),
      });
      const data = await res.json();
      if (res.ok && data.entry) {
        const updated = [data.entry, ...costs];
        setCosts(updated);
        writeOfflineCache('costs', updated);
        setNewCost((prev) => ({...prev, description: ''}));
      }
    } finally {
      setSavingCost(false);
    }
  };

  const deleteCostEntry = async (id: string) => {
    const updated = costs.filter((c) => c.id !== id);
    setCosts(updated);
    writeOfflineCache('costs', updated);
    await fetch(`/api/smartfasal/costs/${id}`, {method: 'DELETE'}).catch(() => {});
  };

  const analytics = useMemo(() => {
    const totalCost = costs.reduce((sum, c) => sum + c.amountInr, 0);
    const activeAcres = soilInput.acres || 4;
    const costPerAcre = Math.round(totalCost / activeAcres);
    const projectedRevenue = Math.round(
      activeAcres * expectedYieldPerAcre * expectedPricePerQuintal,
    );
    const projectedProfit = projectedRevenue - totalCost;
    const roiPercent = totalCost > 0 ? Math.round((projectedProfit / totalCost) * 100) : 0;
    const breakEvenQuintalsTotal =
      expectedPricePerQuintal > 0 ? (totalCost / expectedPricePerQuintal).toFixed(1) : '0';
    const breakEvenPerAcre =
      expectedPricePerQuintal > 0 && activeAcres > 0
        ? (totalCost / expectedPricePerQuintal / activeAcres).toFixed(1)
        : '0';

    const byCategoryMap = new Map<string, number>();
    for (const c of costs) {
      byCategoryMap.set(c.category, (byCategoryMap.get(c.category) ?? 0) + c.amountInr);
    }
    const categoryChart = Array.from(byCategoryMap.entries()).map(([category, amount]) => ({
      category,
      amount,
    }));

    return {
      totalCost,
      costPerAcre,
      projectedRevenue,
      projectedProfit,
      roiPercent,
      breakEvenQuintalsTotal,
      breakEvenPerAcre,
      categoryChart,
    };
  }, [costs, soilInput.acres, expectedYieldPerAcre, expectedPricePerQuintal]);

  const holdDays = useMemo(
    () => weatherDays.filter((d) => d.sprayStatus === 'Hold'),
    [weatherDays],
  );

  const smsAlertText = useMemo(() => {
    if (holdDays.length === 0) {
      return `RythuSethu (${district}): Clear dry spray window for next 48h. Wind < 12 km/h. Safe for foliar pesticide or nutrient spray before 09:00 AM.`;
    }
    const holdSummary = holdDays
      .map((d) => `${d.dayLabel} (${d.rainProbabilityPercent}% rain, ${d.windKmh} km/h wind)`)
      .join(', ');
    if (language === 'te') {
      return `రైతుసేతు (${district}) వాతావరణ హెచ్చరిక: ${holdSummary} రోజుల్లో వర్షం/గాలి ఎక్కువగా ఉన్నందున పురుగుమందులు పిచికారీ చేయకండి. నీటి తడిని తాత్కాలికంగా ఆపండి.`;
    }
    if (language === 'hi') {
      return `रैतुसेतु (${district}) मौसम चेतावनी: ${holdSummary} को बारिश और तेज हवा की संभावना है। कीटनाशक छिड़काव न करें और सिंचाई रोकें।`;
    }
    return `RythuSethu (${district}) Spray Alert: HOLD pesticide spraying on ${holdSummary} due to wash-off/drift risk. Skip irrigation on high-rain days.`;
  }, [district, holdDays, language]);

  const copyAlert = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(smsAlertText).catch(() => {});
    }
    setAlertCopied(true);
    setTimeout(() => setAlertCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Section 1: Soil Health Card NPK & Crop Recommender */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={runSoilRecommendation}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          <div className="pb-4 border-b border-slate-200">
            <p className="text-xs text-slate-500">
              SmartFasal · 3-Step Soil Health Card NPK Wizard
            </p>
            <h2 className="text-xl font-semibold text-slate-900 mt-0.5">
              {language === 'te' ? 'మట్టి & సీజన్ పంట ప్రణాళిక' : 'Soil & Season Crop Recommender'}
            </h2>
          </div>

          {/* 3-Step Wizard Header Tabs */}
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                {step: 1 as const, te: '1. సీజన్ & నేల', en: '1. Season'},
                {step: 2 as const, te: '2. NPK విలువలు', en: '2. NPK & pH'},
                {step: 3 as const, te: '3. ప్రణాళిక', en: '3. Plan'},
              ]
            ).map((item) => {
              const active = soilStep === item.step;
              return (
                <button
                  key={item.step}
                  type="button"
                  onClick={() => setSoilStep(item.step)}
                  className={`min-h-[44px] px-2 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-emerald-800 text-white border-emerald-800'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {language === 'te' ? item.te : item.en}
                </button>
              );
            })}
          </div>

          {soilStep === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  {language === 'te' ? 'పంట సీజన్ ఎంచుకోండి (Season)' : 'Select Growing Season'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      {val: 'Kharif' as const, te: 'వానాకాలం', en: 'Kharif'},
                      {val: 'Rabi' as const, te: 'యాసంగి', en: 'Rabi'},
                      {val: 'Yasangi' as const, te: 'వేసవి', en: 'Yasangi'},
                    ]
                  ).map((s) => (
                    <button
                      key={s.val}
                      type="button"
                      onClick={() => setSoilInput((p) => ({...p, season: s.val}))}
                      className={`min-h-[48px] px-2.5 py-2 rounded-xl border text-center transition-colors ${
                        soilInput.season === s.val
                          ? 'border-emerald-700 bg-emerald-50 text-emerald-950 font-semibold'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-xs font-semibold">
                        {language === 'te' ? s.te : s.en}
                      </div>
                      {language === 'te' && (
                        <div className="text-[10px] text-slate-500">{s.en}</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  {language === 'te' ? 'నేల రకం ఎంచుకోండి (Soil Type)' : 'Select Soil Type'}
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {(
                    [
                      {val: 'Black Cotton' as const, te: 'నల్లరేగడి నేల (Black Cotton Regur)'},
                      {val: 'Red Loam' as const, te: 'ఎర్ర నేల / చల్కా (Red Loam)'},
                      {val: 'Sandy Loam' as const, te: 'ఇసుక కలిసిన నేల (Sandy Loam)'},
                    ]
                  ).map((st) => (
                    <button
                      key={st.val}
                      type="button"
                      onClick={() => setSoilInput((p) => ({...p, soilType: st.val}))}
                      className={`min-h-[46px] px-3.5 py-2 rounded-xl border text-left text-xs font-semibold transition-colors ${
                        soilInput.soilType === st.val
                          ? 'border-emerald-700 bg-emerald-50 text-emerald-950'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {language === 'te' ? st.te : st.val}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSoilStep(2)}
                className="w-full min-h-[48px] inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors"
              >
                {language === 'te' ? 'తదుపరి: NPK విలువలు →' : 'Next: Enter Soil NPK & Acres →'}
              </button>
            </div>
          )}

          {soilStep === 2 && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setSoilInput((p) => ({...p, nitrogen: 145, phosphorus: 18, potassium: 190, ph: 7.4}))
                  }
                  className="px-2.5 py-1.5 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
                >
                  Low N Sample
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSoilInput((p) => ({...p, nitrogen: 220, phosphorus: 32, potassium: 260, ph: 7.0}))
                  }
                  className="px-2.5 py-1.5 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
                >
                  Balanced Regur
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSoilInput((p) => ({...p, nitrogen: 260, phosphorus: 44, potassium: 320, ph: 6.7}))
                  }
                  className="px-2.5 py-1.5 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
                >
                  Chili High-K
                </button>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-700">
                    {language === 'te' ? 'నత్రజని / Nitrogen (N)' : 'Nitrogen (N)'}
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900">
                    {soilInput.nitrogen} kg/ha
                  </span>
                </div>
                <input
                  type="range"
                  min={60}
                  max={420}
                  value={soilInput.nitrogen}
                  onChange={(e) =>
                    setSoilInput((p) => ({...p, nitrogen: Number(e.target.value)}))
                  }
                  className="w-full accent-emerald-700 h-2"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-700">
                    {language === 'te' ? 'భాస్వరం / Phosphorus (P)' : 'Phosphorus (P)'}
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900">
                    {soilInput.phosphorus} kg/ha
                  </span>
                </div>
                <input
                  type="range"
                  min={8}
                  max={90}
                  value={soilInput.phosphorus}
                  onChange={(e) =>
                    setSoilInput((p) => ({...p, phosphorus: Number(e.target.value)}))
                  }
                  className="w-full accent-emerald-700 h-2"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-700">
                    {language === 'te' ? 'పొటాష్ / Potassium (K)' : 'Potassium (K)'}
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900">
                    {soilInput.potassium} kg/ha
                  </span>
                </div>
                <input
                  type="range"
                  min={80}
                  max={450}
                  value={soilInput.potassium}
                  onChange={(e) =>
                    setSoilInput((p) => ({...p, potassium: Number(e.target.value)}))
                  }
                  className="w-full accent-emerald-700 h-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Soil pH</label>
                  <input
                    type="number"
                    step={0.1}
                    min={4.5}
                    max={9.5}
                    value={soilInput.ph}
                    onChange={(e) =>
                      setSoilInput((p) => ({...p, ph: Number(e.target.value)}))
                    }
                    className="w-full min-h-[44px] px-3 py-1.5 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    {language === 'te' ? 'ఎకరాలు (Acres)' : 'Cultivated Acres'}
                  </label>
                  <input
                    type="number"
                    min={0.5}
                    max={100}
                    step={0.5}
                    value={soilInput.acres}
                    onChange={(e) =>
                      setSoilInput((p) => ({...p, acres: Math.max(0.5, Number(e.target.value))}))
                    }
                    className="w-full min-h-[44px] px-3 py-1.5 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
              </div>
            </div>
          )}

          {soilStep === 3 && (
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 space-y-2.5 text-xs">
              <div className="font-semibold text-emerald-950">
                {language === 'te'
                  ? 'ప్రస్తుత మట్టి ప్రొఫైల్ సిద్ధం'
                  : 'Active Soil Card Profile Summary'}
              </div>
              <div className="font-mono tabular-nums text-slate-700">
                {district} · {soilInput.season} · {soilInput.soilType} · {soilInput.acres} ac
              </div>
              <div className="font-mono tabular-nums text-slate-700">
                N: {soilInput.nitrogen} · P: {soilInput.phosphorus} · K: {soilInput.potassium} · pH:{' '}
                {soilInput.ph}
              </div>
              <button
                type="button"
                onClick={() => setSoilStep(2)}
                className="min-h-[40px] px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold text-slate-800 hover:bg-slate-50"
              >
                {language === 'te' ? '← NPK మార్చండి' : '← Adjust NPK Values'}
              </button>
            </div>
          )}

          {recError && (
            <div className="flex items-start justify-between gap-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              <span>{recError}</span>
              <button
                type="submit"
                disabled={recommending}
                className="font-semibold underline shrink-0 hover:text-red-900"
              >
                Retry
              </button>
            </div>
          )}

          {soilStep !== 1 && (
            <button
              type="submit"
              disabled={recommending}
              className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-800 hover:bg-emerald-900 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
            >
              {recommending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {recRetryStatus ?? 'Computing NPK & Profit Matrix...'}
                </>
              ) : (
                <>
                  <Sprout className="w-4 h-4" />
                  {language === 'te'
                    ? 'పంట & ఎరువుల ప్రణాళిక రూపొందించండి'
                    : 'Generate Crop & Fertilizer Plan'}
                </>
              )}
            </button>
          )}
        </form>

        {/* Right: AI Crop Recommendations */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <p className="text-xs text-slate-500">
                Calibrated for {district} · {soilInput.soilType} · {soilInput.season}
              </p>
              <h3 className="text-lg font-semibold text-slate-900 mt-0.5">
                Recommended Cropping & NPK Plan
              </h3>
            </div>
          </div>

          {recommending ? (
            <div className="py-8 space-y-4">
              <div className="h-14 bg-slate-100 rounded animate-pulse" />
              <div className="h-24 bg-slate-100 rounded animate-pulse" />
              <div className="h-24 bg-slate-100 rounded animate-pulse" />
            </div>
          ) : advice ? (
            <div className="mt-4 space-y-5">
              <div className="space-y-1.5 text-sm text-slate-700">
                <p>{advice.soilHealthSummary}</p>
                <p className="text-xs font-medium text-emerald-800">
                  Fertilizer Savings: {advice.fertilizerSavingsNote}
                </p>
                <p className="text-xs font-medium text-amber-800">
                  Weather & Spray Window: {advice.sprayAdvisory}
                </p>
              </div>

              <div className="divide-y divide-slate-200 border-t border-slate-200">
                {advice.recommendations.map((rec, idx) => (
                  <div key={idx} className="py-4 first:pt-4 last:pb-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <div>
                        <span className="text-xs font-mono text-slate-500 mr-2">
                          0{idx + 1}.
                        </span>
                        <span className="text-base font-bold text-slate-900">
                          {rec.cropName}
                        </span>
                        <span className="text-xs text-slate-500 ml-2">({rec.variety})</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
                        <span className="font-semibold text-emerald-800">
                          {rec.suitabilityScore}% Match
                        </span>
                        <span className="text-slate-700">
                          {rec.expectedYieldQuintalsPerAcre} qtl/acre
                        </span>
                        <span className="font-bold text-slate-900">
                          ₹{rec.estimatedNetProfitPerAcre.toLocaleString('en-IN')}/acre net
                        </span>
                      </div>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">{rec.reason}</p>
                    <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-700">
                      <span>
                        <strong>NPK Adjustment:</strong> {rec.npkAdjustment}
                      </span>
                      <span>
                        <strong>Irrigation:</strong> {rec.waterRequirement}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center space-y-3">
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                Enter your Soil Health Card N-P-K values and pH on the left, then click{' '}
                <strong>Generate Crop & Fertilizer Plan</strong> for Telangana-calibrated crop
                rankings and fertilizer savings.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Section 2: 7-Day Hyper-Local Spray & Irrigation Scheduler */}
      <section id="weather-section" className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <p className="text-xs text-slate-500">
              Hyper-Local Agronomy Forecast · {district} Mandal Cluster
            </p>
            <h2 className="text-lg font-semibold text-slate-900 mt-0.5">
              7-Day Spray Window & Irrigation Alerts
            </h2>
          </div>

          <button
            type="button"
            onClick={copyAlert}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
          >
            <Copy className="w-3.5 h-3.5" />
            {alertCopied ? 'Copied SMS/WhatsApp Alert' : 'Copy Farmer Alert'}
          </button>
        </div>

        {/* Ready-to-send SMS / WhatsApp Alert Preview */}
        <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs text-slate-800">
          <div>
            <span className="font-semibold text-slate-900 mr-2">Automated SMS / WhatsApp Advisory:</span>
            <span>{smsAlertText}</span>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                <th className="py-2.5 pr-3">Day</th>
                <th className="py-2.5 px-3 text-right">Temp °C</th>
                <th className="py-2.5 px-3 text-right">Humidity</th>
                <th className="py-2.5 px-3 text-right">Wind</th>
                <th className="py-2.5 px-3 text-right">Rain Risk</th>
                <th className="py-2.5 px-3">Spray Window</th>
                <th className="py-2.5 pl-3">Irrigation Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {weatherDays.map((d) => (
                <tr key={d.date} className="hover:bg-slate-50">
                  <td className="py-2.5 pr-3">
                    <div className="font-semibold text-slate-900">{d.dayLabel}</div>
                    <div className="font-mono tabular-nums text-[11px] text-slate-500">
                      {d.date}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                    {d.tempMinC}°–{d.tempMaxC}°
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                    {d.humidityPercent}%
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                    <span className="inline-flex items-center gap-1 justify-end">
                      <Wind className="w-3 h-3 text-slate-400" />
                      {d.windKmh} km/h
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                    <span className="inline-flex items-center gap-1 justify-end">
                      <CloudRain className="w-3 h-3 text-slate-400" />
                      {d.rainProbabilityPercent}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5 font-semibold">
                      {d.sprayStatus === 'Hold' ? (
                        <>
                          <AlertOctagon className="w-3.5 h-3.5 text-red-700 shrink-0" />
                          <span className="text-red-700">Hold Spray</span>
                        </>
                      ) : d.sprayStatus === 'Caution' ? (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          <span className="text-amber-700">Early AM Only</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                          <span className="text-emerald-700">Safe Window</span>
                        </>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{d.sprayReason}</div>
                  </td>
                  <td className="py-2.5 pl-3 text-slate-700">
                    <span className="inline-flex items-center gap-1.5">
                      <Droplets className="w-3.5 h-3.5 text-sky-700 shrink-0" />
                      {d.irrigationAdvice}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 3: Yield & Input Cost ROI Analytics Dashboard */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <p className="text-xs text-slate-500">
                Season Input Cost & Break-Even Yield Tracker
              </p>
              <h2 className="text-lg font-semibold text-slate-900 mt-0.5">
                Farm ROI & Cost Breakdown ({soilInput.acres} Acres)
              </h2>
            </div>
          </div>

          {/* 4-metric clean horizontal strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-4 border-b border-slate-200">
            <div>
              <div className="text-xs text-slate-500">Total Logged Cost</div>
              <div className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                ₹{analytics.totalCost.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500">
                ₹{analytics.costPerAcre.toLocaleString('en-IN')} / acre
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Projected Revenue</div>
              <div className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                ₹{analytics.projectedRevenue.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500">
                {soilInput.acres * expectedYieldPerAcre} qtl total
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Net Profit & ROI</div>
              <div
                className={`text-lg font-bold font-mono tabular-nums mt-0.5 ${
                  analytics.projectedProfit >= 0 ? 'text-emerald-800' : 'text-red-700'
                }`}
              >
                ₹{analytics.projectedProfit.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500">
                {analytics.roiPercent}% ROI
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Break-Even Yield</div>
              <div className="text-lg font-bold font-mono tabular-nums text-amber-800 mt-0.5">
                {analytics.breakEvenPerAcre} qtl/ac
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500">
                {analytics.breakEvenQuintalsTotal} qtl total
              </div>
            </div>
          </div>

          {/* Yield & Price Assumptions */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Expected Yield (Quintals / Acre)
              </label>
              <input
                type="number"
                min={1}
                max={80}
                value={expectedYieldPerAcre}
                onChange={(e) => setExpectedYieldPerAcre(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-1.5 text-sm font-mono tabular-nums border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Expected Sale Price (₹ / Quintal)
              </label>
              <input
                type="number"
                min={500}
                max={30000}
                step={50}
                value={expectedPricePerQuintal}
                onChange={(e) =>
                  setExpectedPricePerQuintal(Math.max(500, Number(e.target.value)))
                }
                className="w-full px-3 py-1.5 text-sm font-mono tabular-nums border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* Cost Breakdown Recharts BarChart */}
          <div className="h-56 w-full pt-2">
            {analytics.categoryChart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.categoryChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="category" tick={{fontSize: 12, fill: '#475569'}} />
                  <YAxis tick={{fontSize: 11, fill: '#475569'}} width={60} />
                  <Tooltip
                    formatter={(value) => [`₹${Number(value ?? 0).toLocaleString('en-IN')}`, 'Spent']}
                  />
                  <Bar dataKey="amount" fill="#15803d" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">
                Log your first farm input cost to view spend distribution.
              </div>
            )}
          </div>
        </div>

        {/* Right: Expense Logger & Ledger */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="pb-3 border-b border-slate-200">
            <h3 className="text-base font-semibold text-slate-900">Input Expense Ledger</h3>
            <p className="text-xs text-slate-500">
              Track seed, fertilizer, spray, labor & irrigation costs
            </p>
          </div>

          <form onSubmit={addCostEntry} className="space-y-3 pb-4 border-b border-slate-200">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={newCost.crop}
                onChange={(e) => setNewCost((p) => ({...p, crop: e.target.value}))}
                placeholder="Crop (e.g. Paddy)"
                className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                required
              />
              <select
                value={newCost.category}
                onChange={(e) =>
                  setNewCost((p) => ({
                    ...p,
                    category: e.target.value as FarmCostEntry['category'],
                  }))
                }
                className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
              >
                <option value="Seeds">Seeds</option>
                <option value="Fertilizer">Fertilizer</option>
                <option value="Pesticide">Pesticide</option>
                <option value="Labor">Labor</option>
                <option value="Irrigation">Irrigation</option>
                <option value="Machinery">Machinery</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                value={newCost.description}
                onChange={(e) => setNewCost((p) => ({...p, description: e.target.value}))}
                placeholder="Item description"
                className="col-span-2 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
              />
              <input
                type="number"
                min={50}
                value={newCost.amountInr}
                onChange={(e) =>
                  setNewCost((p) => ({...p, amountInr: Number(e.target.value)}))
                }
                placeholder="₹ Amount"
                className="px-2.5 py-1.5 text-xs font-mono tabular-nums border border-slate-300 rounded-lg"
                required
              />
            </div>
            <button
              type="submit"
              disabled={savingCost}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Log Expense Entry
            </button>
          </form>

          <div className="divide-y divide-slate-200 max-h-72 overflow-y-auto">
            {costs.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">
                No expenses logged yet.
              </p>
            ) : (
              costs.map((c) => (
                <div
                  key={c.id}
                  className="py-2.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">
                      {c.category} · {c.description}
                    </div>
                    <div className="text-slate-500">
                      {c.crop} · {c.date}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono tabular-nums font-semibold text-slate-900">
                      ₹{c.amountInr.toLocaleString('en-IN')}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteCostEntry(c.id)}
                      aria-label={`Delete ${c.description}`}
                      className="p-1 text-slate-400 hover:text-red-700 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
