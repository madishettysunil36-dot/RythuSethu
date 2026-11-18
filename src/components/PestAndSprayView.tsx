import React, {useEffect, useMemo, useState} from 'react';
import {
  AlertTriangle,
  Bug,
  Calculator,
  CheckCircle2,
  Droplets,
  Leaf,
  MapPin,
  ShieldAlert,
  Store,
} from 'lucide-react';
import {readOfflineCache, writeOfflineCache} from '../hooks/usePWA.ts';
import type {District, LanguageCode, MapCategory, PestGuideItem} from '../types/agri.ts';

interface PestAndSprayViewProps {
  mode: 'pest_guide' | 'spray_calc';
  district: District;
  language: LanguageCode;
  onNavigateMap: (category: MapCategory) => void;
  onSelectMode: (mode: 'pest_guide' | 'spray_calc') => void;
}

const TANK_PRESETS = [
  {id: 'knapsack-15', label: '15L Knapsack Pump', liters: 15, defaultWaterPerAcre: 180},
  {id: 'battery-16', label: '16L Battery Sprayer', liters: 16, defaultWaterPerAcre: 192},
  {id: 'drone-10', label: '10L Agri-Drone Rig', liters: 10, defaultWaterPerAcre: 10},
  {id: 'tractor-200', label: '200L Tractor Boom/Drum', liters: 200, defaultWaterPerAcre: 200},
];

const FALLBACK_PESTS: PestGuideItem[] = [
  {
    id: 'pest-paddy-blast',
    crop: 'Paddy (వరి)',
    pestName: 'Paddy Leaf & Neck Blast',
    teluguName: 'వరి అగ్గి తెగులు',
    hindiName: 'धान का झुलसा (ब्लास्ट) रोग',
    category: 'Fungal Disease',
    riskLevel: 'High',
    imageUrl: '/src/assets/images/crop_paddy_blast_1795028875777.jpg',
    symptoms:
      'Spindle/diamond spots with gray centers & dark brown edges; neck turns black & breaks before grain filling.',
    organicControl:
      'Pseudomonas fluorescens 10 g/L foliar spray; reduce excess Urea & drain stagnant water.',
    chemicalMolecule: 'Tricyclazole 75% WP',
    dosePerLiter: 0.6,
    doseUnit: 'g/L',
    waterLitersPerAcre: 200,
    phiDays: 21,
    safetyNote: 'Spray before 09:00 AM on dry foliage; do not spray within 24h of rain.',
  },
  {
    id: 'pest-cotton-bollworm',
    crop: 'Cotton (పత్తి)',
    pestName: 'Pink Bollworm (Pectinophora)',
    teluguName: 'గులాబీ రంగు పురుగు',
    hindiName: 'कपास की गुलाबी सुंडी',
    category: 'Borer / Larva',
    riskLevel: 'High',
    imageUrl: '/src/assets/images/crop_cotton_bollworm_1795028893387.jpg',
    symptoms:
      'Rosette flowers that fail to open normally; pink larvae boring inside green bolls ruining lint & seeds.',
    organicControl:
      'Install 4–6 Pheromone traps/acre + spray Neem Seed Kernel Extract (NSKE 5%) or Beauveria.',
    chemicalMolecule: 'Profenofos 50% EC',
    dosePerLiter: 2.0,
    doseUnit: 'ml/L',
    waterLitersPerAcre: 200,
    phiDays: 15,
    safetyNote: 'Wear nitrile gloves & mask; avoid spraying during bee peak hours.',
  },
  {
    id: 'pest-chili-curl',
    crop: 'Chili (మిర్చి)',
    pestName: 'Chili Leaf Curl (Thrips & Mites Vector)',
    teluguName: 'మిర్చి ముడత తెగులు (తామర/నల్లి)',
    hindiName: 'मिर्च पर्ण कुंचन (थ्रिप्स/माइट)',
    category: 'Viral Vector',
    riskLevel: 'High',
    imageUrl: '/src/assets/images/crop_chili_leafcurl_1795028891502.jpg',
    symptoms:
      'Upward boat-shaped leaf curling (Thrips) or downward cupping (Mites), stunted shoots, flower drop.',
    organicControl:
      'Place 10 blue + yellow sticky traps/acre; spray Neem Oil 1500 ppm (3 ml/L) + Verticillium.',
    chemicalMolecule: 'Diafenthiuron 50% WP',
    dosePerLiter: 1.2,
    doseUnit: 'g/L',
    waterLitersPerAcre: 200,
    phiDays: 14,
    safetyNote: 'Rotate chemistries so mites/thrips do not develop resistance.',
  },
];

export const PestAndSprayView: React.FC<PestAndSprayViewProps> = ({
  mode,
  district,
  language,
  onNavigateMap,
  onSelectMode,
}) => {
  const [pests, setPests] = useState<PestGuideItem[]>(() =>
    readOfflineCache<PestGuideItem[]>('pests:atlas', FALLBACK_PESTS),
  );
  const [cropFilter, setCropFilter] = useState<string>('All');

  // Spray Calculator state
  const [selectedPresetName, setSelectedPresetName] = useState<string>('Tricyclazole 75% WP (Paddy Blast)');
  const [tankTypeId, setTankTypeId] = useState<string>('battery-16');
  const [tankLiters, setTankLiters] = useState<number>(16);
  const [waterPerAcre, setWaterPerAcre] = useState<number>(192);
  const [acres, setAcres] = useState<number>(3);
  const [dosePerLiter, setDosePerLiter] = useState<number>(0.6);
  const [doseUnit, setDoseUnit] = useState<'g/L' | 'ml/L'>('g/L');
  const [packSize, setPackSize] = useState<number>(250);
  const [phiDays, setPhiDays] = useState<number>(21);
  const [safetyNote, setSafetyNote] = useState<string>(
    'Spray before 09:00 AM on dry leaves; wear mask and gloves.',
  );

  useEffect(() => {
    fetch('/api/pests')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.pests) && data.pests.length > 0) {
          setPests(data.pests);
          writeOfflineCache('pests:atlas', data.pests);
        }
      })
      .catch(() => {});
  }, []);

  const filteredPests = useMemo(() => {
    if (cropFilter === 'All') return pests;
    return pests.filter((p) => p.crop.toLowerCase().includes(cropFilter.toLowerCase()));
  }, [pests, cropFilter]);

  const applyPestToCalculator = (pest: PestGuideItem) => {
    setSelectedPresetName(`${pest.chemicalMolecule} (${pest.pestName})`);
    setDosePerLiter(pest.dosePerLiter);
    setDoseUnit(pest.doseUnit);
    setWaterPerAcre(pest.waterLitersPerAcre);
    setPhiDays(pest.phiDays);
    setSafetyNote(pest.safetyNote);
    if (tankTypeId === 'drone-10') {
      setTankTypeId('battery-16');
      setTankLiters(16);
    }
    onSelectMode('spray_calc');
  };

  const handleTankPresetChange = (id: string) => {
    setTankTypeId(id);
    const preset = TANK_PRESETS.find((t) => t.id === id);
    if (preset) {
      setTankLiters(preset.liters);
      setWaterPerAcre(preset.defaultWaterPerAcre);
    }
  };

  const calc = useMemo(() => {
    const safeTank = Math.max(1, tankLiters);
    const safeWaterPerAcre = Math.max(5, waterPerAcre);
    const safeAcres = Math.max(0.25, acres);
    const safeDose = Math.max(0.05, dosePerLiter);

    // For agri-drone (ultra-low volume 10L/acre), concentration scales up proportionally
    const totalWaterLiters = Math.round(safeWaterPerAcre * safeAcres);
    const tanksPerAcre = Number((safeWaterPerAcre / safeTank).toFixed(1));
    const totalTanks = Number((totalWaterLiters / safeTank).toFixed(1));

    // Standard per-acre active dosage based on 200L conventional benchmark when drone is selected
    const effectiveTotalProduct =
      tankTypeId === 'drone-10'
        ? Number((200 * safeDose * safeAcres).toFixed(1))
        : Number((totalWaterLiters * safeDose).toFixed(1));

    const dosePerTank =
      totalTanks > 0 ? Number((effectiveTotalProduct / totalTanks).toFixed(1)) : 0;

    const packsNeeded = Math.max(1, Math.ceil(effectiveTotalProduct / Math.max(50, packSize)));
    const baseUnit = doseUnit === 'g/L' ? 'g' : 'ml';
    const largeUnit = doseUnit === 'g/L' ? 'kg' : 'L';

    return {
      totalWaterLiters,
      tanksPerAcre,
      totalTanks,
      dosePerTank,
      effectiveTotalProduct,
      packsNeeded,
      baseUnit,
      largeUnit,
    };
  }, [tankLiters, waterPerAcre, acres, dosePerLiter, doseUnit, packSize, tankTypeId]);

  if (mode === 'pest_guide') {
    return (
      <div className="space-y-6">
        {/* Visual Header Banner */}
        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          <div className="lg:col-span-5 relative h-48 lg:h-auto bg-slate-100">
            <img
              src="/src/assets/images/spray_crop_protection_1795036061187.jpg"
              alt="Telangana farmer safely spraying crop rows"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex items-end p-4">
              <span className="text-xs font-semibold text-white">
                {district} Pest & Disease Photo Field Guide
              </span>
            </div>
          </div>

          <div className="lg:col-span-7 p-5 sm:p-6 flex flex-col justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-emerald-800">
                PJTSAU Visual Reference · Offline Ready
              </p>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                {language === 'te'
                  ? 'పంట తెగుళ్లు & పురుగుల చిత్ర సహాయకారి'
                  : language === 'hi'
                    ? 'फसल रोग एवं कीट फोटो मार्गदर्शिका'
                    : 'Visual Crop Pest & Disease Atlas'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
                {language === 'te'
                  ? 'లక్షణాలను ఫోటోలతో పోల్చి, సరైన సేంద్రియ లేదా రసాయన మందు ట్యాంక్ మోతాదును ఒక్క ట్యాప్‌తో లెక్కించండి.'
                  : 'Compare leaf & boll symptoms visually, compute exact sprayer tank dosages, or locate verified nearby agro-shops.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                {['All', 'Paddy', 'Cotton', 'Chili'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCropFilter(c)}
                    className={`min-h-[44px] px-3.5 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                      cropFilter === c
                        ? 'bg-emerald-800 text-white border-emerald-800'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => onNavigateMap('agro_shops')}
                className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl whitespace-nowrap"
              >
                <Store className="w-4 h-4 text-emerald-800" />
                Find Agro-Shops Near {district}
              </button>
            </div>
          </div>
        </section>

        {/* Visual Pest Specimen Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPests.map((pest) => (
            <article
              key={pest.id}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col justify-between"
            >
              <div>
                <div className="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden">
                  <img
                    src={pest.imageUrl}
                    alt={pest.pestName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-3.5 text-white">
                    <div className="text-[11px] font-medium text-emerald-200">
                      {pest.crop} · {pest.category}
                    </div>
                    <h3 className="text-base font-bold leading-snug mt-0.5">
                      {language === 'te'
                        ? pest.teluguName
                        : language === 'hi'
                          ? pest.hindiName
                          : pest.pestName}
                    </h3>
                    <div className="text-[11px] text-slate-200">
                      {language === 'en' ? pest.teluguName : pest.pestName}
                    </div>
                  </div>
                </div>

                <div className="p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <span
                      className={`font-semibold ${
                        pest.riskLevel === 'High' ? 'text-red-700' : 'text-amber-700'
                      }`}
                    >
                      <Bug className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                      {pest.riskLevel} Spread Risk
                    </span>
                    <span className="font-mono tabular-nums text-slate-600">
                      Dose: {pest.dosePerLiter} {pest.doseUnit}
                    </span>
                  </div>

                  <div>
                    <span className="font-semibold text-slate-800 block mb-0.5">
                      Field Symptoms
                    </span>
                    <p className="text-slate-600 leading-relaxed">{pest.symptoms}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <div className="text-emerald-900">
                      <Leaf className="w-3.5 h-3.5 inline mr-1 -mt-0.5 text-emerald-700" />
                      <strong>Organic:</strong> {pest.organicControl}
                    </div>
                    <div className="text-amber-900">
                      <ShieldAlert className="w-3.5 h-3.5 inline mr-1 -mt-0.5 text-amber-700" />
                      <strong>Chemical:</strong> {pest.chemicalMolecule} (PHI {pest.phiDays}d)
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 pt-0 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => applyPestToCalculator(pest)}
                  className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-xl transition-colors"
                >
                  <Calculator className="w-3.5 h-3.5 shrink-0" />
                  Tank Dose
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateMap('agro_shops')}
                  className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  Agro-Shop
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Interactive Tank & Acreage Controls */}
      <section className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="pb-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-emerald-800">
              Deterministic Tank Dilution Engine · Zero Over-Spraying
            </p>
            <h2 className="text-xl font-bold text-slate-900 mt-0.5">
              {language === 'te'
                ? 'ట్యాంక్ & ఎకరం పిచికారీ మందు లెక్కింపు'
                : 'Spray Tank & Acreage Dosage Calculator'}
            </h2>
          </div>
          <Calculator className="w-6 h-6 text-emerald-800 shrink-0" />
        </div>

        {/* Quick Crop Chemical Preset Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            {language === 'te' ? '1. వ్యాధి / మందు ఎంచుకోండి (Preset)' : '1. Quick Crop Chemical Preset'}
          </label>
          <div className="flex flex-wrap gap-2">
            {pests.slice(0, 4).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPestToCalculator(p)}
                className={`min-h-[40px] px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors ${
                  selectedPresetName.includes(p.chemicalMolecule)
                    ? 'bg-emerald-800 text-white border-emerald-800'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {p.chemicalMolecule}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5">
            Active Mix: <strong className="text-slate-800">{selectedPresetName}</strong>
          </p>
        </div>

        {/* Sprayer Pump Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            {language === 'te' ? '2. మీ పిచికారీ పంపు (Sprayer Type)' : '2. Select Sprayer / Tank Size'}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {TANK_PRESETS.map((tp) => {
              const active = tankTypeId === tp.id;
              return (
                <button
                  key={tp.id}
                  type="button"
                  onClick={() => handleTankPresetChange(tp.id)}
                  className={`min-h-[48px] px-3 py-2 rounded-xl border text-left transition-colors ${
                    active
                      ? 'bg-emerald-50 border-emerald-700 text-emerald-950 font-semibold'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-xs font-semibold">{tp.label}</div>
                  <div className="text-[11px] font-mono tabular-nums text-slate-500">
                    {tp.defaultWaterPerAcre}L water/acre
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Numeric Steppers */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {language === 'te' ? 'పొలం విస్తీర్ణం (Acres)' : 'Field Area (Acres)'}
            </label>
            <input
              type="number"
              min={0.5}
              max={100}
              step={0.5}
              value={acres}
              onChange={(e) => setAcres(Math.max(0.5, Number(e.target.value)))}
              className="w-full min-h-[44px] px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Tank Capacity (Liters)
            </label>
            <input
              type="number"
              min={5}
              max={500}
              value={tankLiters}
              onChange={(e) => setTankLiters(Math.max(1, Number(e.target.value)))}
              className="w-full min-h-[44px] px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Dose per Liter Water
            </label>
            <div className="flex gap-1.5">
              <input
                type="number"
                min={0.1}
                max={50}
                step={0.1}
                value={dosePerLiter}
                onChange={(e) => setDosePerLiter(Math.max(0.1, Number(e.target.value)))}
                className="w-full min-h-[44px] px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
              <select
                value={doseUnit}
                onChange={(e) => setDoseUnit(e.target.value as 'g/L' | 'ml/L')}
                className="min-h-[44px] px-2.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl"
              >
                <option value="g/L">g/L</option>
                <option value="ml/L">ml/L</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Shop Pack Size ({calc.baseUnit})
            </label>
            <select
              value={packSize}
              onChange={(e) => setPackSize(Number(e.target.value))}
              className="w-full min-h-[44px] px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-xl"
            >
              <option value={100}>100 {calc.baseUnit} pack</option>
              <option value={250}>250 {calc.baseUnit} pack</option>
              <option value={500}>500 {calc.baseUnit} pack</option>
              <option value={1000}>1000 {calc.baseUnit} (1 {calc.largeUnit})</option>
            </select>
          </div>
        </div>
      </section>

      {/* Right: Exact Mixing Card + Agro Shop Link */}
      <section className="lg:col-span-6 space-y-5">
        <div className="bg-emerald-950 text-white rounded-2xl p-6 space-y-5">
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-emerald-800">
            <div>
              <p className="text-xs text-emerald-300 font-medium">
                {language === 'te' ? 'సరైన ట్యాంక్ మిశ్రమ కొలత' : 'Exact Field Mixing Prescription'}
              </p>
              <h3 className="text-2xl sm:text-3xl font-bold font-mono tabular-nums mt-1">
                {calc.dosePerTank} {calc.baseUnit} per {tankLiters}L tank
              </h3>
            </div>
            <Droplets className="w-7 h-7 text-emerald-300 shrink-0" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-[11px] text-emerald-300">Total Tanks</div>
              <div className="text-xl font-bold font-mono tabular-nums mt-0.5">
                {calc.totalTanks}
              </div>
              <div className="text-[11px] text-emerald-200/80">
                {calc.tanksPerAcre} / acre
              </div>
            </div>
            <div>
              <div className="text-[11px] text-emerald-300">Total Chemical</div>
              <div className="text-xl font-bold font-mono tabular-nums mt-0.5">
                {calc.effectiveTotalProduct >= 1000
                  ? `${(calc.effectiveTotalProduct / 1000).toFixed(2)} ${calc.largeUnit}`
                  : `${calc.effectiveTotalProduct} ${calc.baseUnit}`}
              </div>
              <div className="text-[11px] text-emerald-200/80">
                For {acres} acres
              </div>
            </div>
            <div>
              <div className="text-[11px] text-emerald-300">Packs to Buy</div>
              <div className="text-xl font-bold font-mono tabular-nums text-amber-300 mt-0.5">
                {calc.packsNeeded} × {packSize}
                {calc.baseUnit}
              </div>
              <div className="text-[11px] text-emerald-200/80">
                {calc.totalWaterLiters}L water
              </div>
            </div>
          </div>

          {tankTypeId === 'drone-10' && (
            <div className="p-3 rounded-xl bg-emerald-900/70 border border-emerald-700 text-xs text-emerald-100 leading-relaxed">
              Agri-Drone Ultra-Low Volume Mode active: keeps active molecule per acre identical across{' '}
              <span className="font-mono font-bold">10L/acre</span> carrier water. Use fine-mist
              nozzles and verify tank agitation before takeoff.
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-white/10 space-y-1.5 text-xs">
            <div className="flex items-center gap-2 font-semibold text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Pre-Harvest Safety Waiting Period (PHI): {phiDays} Days
            </div>
            <p className="text-emerald-100 leading-relaxed">{safetyNote}</p>
          </div>
        </div>

        {/* Shop Locator Card with Custom Photo */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col sm:flex-row">
          <div className="sm:w-44 h-36 sm:h-auto bg-slate-100 shrink-0">
            <img
              src="/src/assets/images/agro_fertilizer_shop_1795036060934.jpg"
              alt="Nearby fertilizer, seed and pesticide retail shop"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                <CheckCircle2 className="w-4 h-4" />
                Ready to Purchase Exact Quantity?
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Locate licensed fertilizer, seed, and pesticide shops around{' '}
                <strong>{district}</strong> with live driving distance & routes.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateMap('agro_shops')}
              className="min-h-[44px] w-full sm:w-fit inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-xl transition-colors"
            >
              <MapPin className="w-4 h-4" />
              Open Fertilizer & Pesticide Shops Map
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
