import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Leaf,
  Loader2,
  Mic,
  MicOff,
  Search,
  Send,
  ShieldAlert,
  TrendingUp,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {readOfflineCache, writeOfflineCache} from '../hooks/usePWA.ts';
import {fetchWithRetry} from '../utils/fetchWithRetry.ts';
import type {
  District,
  LanguageCode,
  LeafDiagnosis,
  MandiPriceRecord,
  VoiceTurn,
} from '../types/agri.ts';

interface MandiWithDistance extends MandiPriceRecord {
  distanceKm: number;
}

interface KisanVisionViewProps {
  district: District;
  language: LanguageCode;
  isOnline: boolean;
  scanTriggerCount: number;
}

const SAMPLE_SPECIMENS = [
  {
    id: 'paddy-blast',
    label: 'Paddy Leaf Blast',
    crop: 'Paddy',
    region: 'Warangal Kharif',
    imageUrl: '/src/assets/images/crop_paddy_blast_1795028875777.jpg',
  },
  {
    id: 'cotton-bollworm',
    label: 'Cotton Pink Bollworm',
    crop: 'Cotton',
    region: 'Hanamkonda Black Soil',
    imageUrl: '/src/assets/images/crop_cotton_bollworm_1795028893387.jpg',
  },
  {
    id: 'chili-curl',
    label: 'Chili Leaf Curl',
    crop: 'Chili',
    region: 'Khammam / Enumamula',
    imageUrl: '/src/assets/images/crop_chili_leafcurl_1795028891502.jpg',
  },
];

const QUICK_VOICE_PROMPTS: Record<LanguageCode, string[]> = {
  te: [
    'వరిలో అగ్గి తెగులుకు ఏ మందు పిచికారీ చేయాలి?',
    'వరంగల్ ఎనుమాముల మార్కెట్లో తేజ మిర్చి ధర ఎంత ఉంది?',
    'పత్తిలో గులాబీ రంగు పురుగు నివారణ చర్యలు చెప్పండి.',
  ],
  hi: [
    'धान में झुलसा रोग (ब्लास्ट) के लिए कौन सी दवा छिड़कें?',
    'कपास में गुलाबी सुंडी की रोकथाम कैसे करें?',
    'मिर्च की फसल में पत्ती मरोड़ रोग का जैविक उपचार क्या है?',
  ],
  en: [
    'What is the exact dosage of Tricyclazole for paddy blast per acre?',
    'Should I sell Teja chili at Enumamula today or hold for 5 days?',
    'How to control pink bollworm in Bt cotton organically?',
  ],
};

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: {results: ArrayLike<ArrayLike<{transcript: string}>>}) => void) | null;
  onerror: ((event: {error: string}) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export const KisanVisionView: React.FC<KisanVisionViewProps> = ({
  district,
  language,
  isOnline,
  scanTriggerCount,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const [cropHint, setCropHint] = useState<string>('Auto-detect');
  const [previewUrl, setPreviewUrl] = useState<string>(SAMPLE_SPECIMENS[0].imageUrl);
  const [uploadedBase64, setUploadedBase64] = useState<string | null>(null);
  const [uploadedMime, setUploadedMime] = useState<string>('image/jpeg');
  const [selectedSamplePath, setSelectedSamplePath] = useState<string>(SAMPLE_SPECIMENS[0].imageUrl);

  const [scans, setScans] = useState<LeafDiagnosis[]>(() =>
    readOfflineCache<LeafDiagnosis[]>('scans', []),
  );
  const [activeDiagnosis, setActiveDiagnosis] = useState<LeafDiagnosis | null>(null);
  const [scannerStep, setScannerStep] = useState<1 | 2 | 3>(1);
  const [diagnosing, setDiagnosing] = useState(false);
  const [scanRetryStatus, setScanRetryStatus] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Voice assistant state
  const [question, setQuestion] = useState('');
  const [askingVoice, setAskingVoice] = useState(false);
  const [voiceRetryStatus, setVoiceRetryStatus] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceHistory, setVoiceHistory] = useState<VoiceTurn[]>([
    {
      id: 'v-welcome',
      role: 'advisor',
      language: 'te',
      timestamp: 'Ready',
      text: 'నమస్కారం! పంట ఆకు తెగుళ్లు, పిచికారీ మోతాదు లేదా ఎనుమాముల మార్కెట్ ధరల గురించి తెలుగు, హిందీ లేదా ఇంగ్లీష్‌లో అడగండి.',
    },
  ]);

  // Mandi price & profit estimator state
  const [mandiList, setMandiList] = useState<MandiWithDistance[]>(() =>
    readOfflineCache<MandiWithDistance[]>(`mandi:${district}`, []),
  );
  const [mandiLoading, setMandiLoading] = useState(false);
  const [mandiCropFilter, setMandiCropFilter] = useState('All');
  const [mandiSearch, setMandiSearch] = useState('');
  const [selectedMandiId, setSelectedMandiId] = useState<string>('mnd-enumamula-chili');
  const [lotQuintals, setLotQuintals] = useState<number>(25);
  const [transportRatePerKmQuintal, setTransportRatePerKmQuintal] = useState<number>(2.4);
  const [hamaliPercent, setHamaliPercent] = useState<number>(1.5);

  useEffect(() => {
    if (scanTriggerCount > 0) {
      fileInputRef.current?.click();
    }
  }, [scanTriggerCount]);

  // Fetch initial scan history & mandi prices
  useEffect(() => {
    let active = true;
    fetch('/api/vision/scans')
      .then((r) => r.json())
      .then((data) => {
        if (!active || !Array.isArray(data.scans)) return;
        setScans(data.scans);
        writeOfflineCache('scans', data.scans);
        if (data.scans.length > 0 && !activeDiagnosis) {
          setActiveDiagnosis(data.scans[0]);
        }
      })
      .catch(() => {
        const cached = readOfflineCache<LeafDiagnosis[]>('scans', []);
        if (active && cached.length > 0 && !activeDiagnosis) {
          setActiveDiagnosis(cached[0]);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setMandiLoading(true);
    fetch(`/api/mandi/prices?district=${encodeURIComponent(district)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!active || !Array.isArray(data.records)) return;
        setMandiList(data.records);
        writeOfflineCache(`mandi:${district}`, data.records);
      })
      .catch(() => {
        const cached = readOfflineCache<MandiWithDistance[]>(`mandi:${district}`, []);
        if (active && cached.length > 0) {
          setMandiList(cached);
        }
      })
      .finally(() => {
        if (active) setMandiLoading(false);
      });
    return () => {
      active = false;
    };
  }, [district]);

  const handleFileSelected = (file: File) => {
    setScanError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPreviewUrl(result);
      setUploadedBase64(result);
      setUploadedMime(file.type || 'image/jpeg');
      setSelectedSamplePath('');
    };
    reader.readAsDataURL(file);
  };

  const handleSelectSample = (specimen: (typeof SAMPLE_SPECIMENS)[number]) => {
    setScanError(null);
    setCropHint(specimen.crop);
    setPreviewUrl(specimen.imageUrl);
    setSelectedSamplePath(specimen.imageUrl);
    setUploadedBase64(null);
  };

  const runDiagnosis = async () => {
    if (!isOnline) {
      setScanError(
        'Offline mode active — viewing cached leaf diagnoses below. Reconnect to run live Gemini Vision inference.',
      );
      return;
    }
    setDiagnosing(true);
    setScanRetryStatus(null);
    setScanError(null);
    try {
      const res = await fetchWithRetry(
        '/api/vision/diagnose',
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            imageBase64: uploadedBase64 || undefined,
            mimeType: uploadedMime,
            sampleAssetPath: uploadedBase64 ? undefined : selectedSamplePath,
            cropHint,
            language,
            district,
          }),
        },
        {
          maxRetries: 3,
          baseDelayMs: 900,
          onRetry: ({attempt, maxRetries, status}) => {
            setScanRetryStatus(
              `Service busy (${status ?? 'network'}) — retrying automatically (${attempt}/${maxRetries})...`,
            );
          },
        },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Diagnosis failed');
      }
      const diag: LeafDiagnosis = {
        ...data.diagnosis,
        imagePreview: previewUrl,
      };
      setActiveDiagnosis(diag);
      setScannerStep(3);
      const updated = [diag, ...scans.filter((s) => s.id !== diag.id)].slice(0, 20);
      setScans(updated);
      writeOfflineCache('scans', updated);
    } catch (err: unknown) {
      setScanError(err instanceof Error ? err.message : 'Unable to analyze leaf photo.');
    } finally {
      setDiagnosing(false);
      setScanRetryStatus(null);
    }
  };

  const speakText = (text: string, lang: LanguageCode) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'te' ? 'te-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN';
    utterance.rate = 0.95;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  const toggleVoiceMic = () => {
    setVoiceError(null);
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const Rec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!Rec) {
      setVoiceError(
        'Browser speech recognition is unavailable here. Type your question or use a quick prompt below.',
      );
      return;
    }
    const rec = new Rec();
    rec.lang = language === 'te' ? 'te-IN' : language === 'hi' ? 'hi-IN' : 'en-IN';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) {
        setQuestion(transcript);
      }
    };
    rec.onerror = (ev) => {
      setVoiceError(`Microphone error: ${ev.error}`);
      setIsListening(false);
    };
    rec.onend = () => setIsListening(false);
    recognitionRef.current = rec;
    setIsListening(true);
    rec.start();
  };

  const askVoiceAssistant = async (promptText?: string) => {
    const query = (promptText ?? question).trim();
    if (!query) return;
    setVoiceError(null);

    const farmerTurn: VoiceTurn = {
      id: `f-${Date.now()}`,
      role: 'farmer',
      text: query,
      language,
      timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}),
    };
    setVoiceHistory((prev) => [...prev, farmerTurn]);
    if (!promptText) setQuestion('');

    if (!isOnline) {
      setVoiceError('Offline mode — voice advisor requires network connectivity.');
      return;
    }

    setAskingVoice(true);
    setVoiceRetryStatus(null);
    try {
      const res = await fetchWithRetry(
        '/api/assistant/ask',
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            question: query,
            language,
            district,
            recentDiagnosis: activeDiagnosis
              ? `${activeDiagnosis.cropDetected}: ${activeDiagnosis.diseaseName} (${activeDiagnosis.severity})`
              : undefined,
          }),
        },
        {
          maxRetries: 3,
          baseDelayMs: 800,
          onRetry: ({attempt, maxRetries, status}) => {
            setVoiceRetryStatus(
              `High load (${status ?? 'network'}) — retrying (${attempt}/${maxRetries})...`,
            );
          },
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Voice assistant failed');
      const advisorTurn: VoiceTurn = {
        id: `a-${Date.now()}`,
        role: 'advisor',
        text: data.answer,
        language,
        timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}),
      };
      setVoiceHistory((prev) => [...prev, advisorTurn]);
      speakText(data.answer, language);
    } catch (err: unknown) {
      setVoiceError(err instanceof Error ? err.message : 'Unable to reach advisor.');
    } finally {
      setAskingVoice(false);
      setVoiceRetryStatus(null);
    }
  };

  const filteredMandi = useMemo(() => {
    return mandiList
      .filter((m) =>
        mandiCropFilter === 'All'
          ? true
          : m.crop.toLowerCase().includes(mandiCropFilter.toLowerCase()),
      )
      .filter((m) =>
        mandiSearch.trim()
          ? m.marketName.toLowerCase().includes(mandiSearch.toLowerCase()) ||
            m.crop.toLowerCase().includes(mandiSearch.toLowerCase()) ||
            m.variety.toLowerCase().includes(mandiSearch.toLowerCase())
          : true,
      );
  }, [mandiList, mandiCropFilter, mandiSearch]);

  const selectedMandi = useMemo(() => {
    return (
      filteredMandi.find((m) => m.id === selectedMandiId) ||
      filteredMandi[0] ||
      mandiList[0] ||
      null
    );
  }, [filteredMandi, mandiList, selectedMandiId]);

  const profitCalc = useMemo(() => {
    if (!selectedMandi) return null;
    const gross = lotQuintals * selectedMandi.modalPricePerQuintal;
    const transportCost = Math.round(
      lotQuintals * selectedMandi.distanceKm * transportRatePerKmQuintal,
    );
    const hamaliFees = Math.round(gross * (hamaliPercent / 100));
    const netProfit = gross - transportCost - hamaliFees;
    const netPerQuintal = lotQuintals > 0 ? Math.round(netProfit / lotQuintals) : 0;

    // Compare alternative mandis for the same crop
    const sameCropMandis = mandiList
      .filter((m) => m.crop === selectedMandi.crop)
      .map((m) => {
        const g = lotQuintals * m.modalPricePerQuintal;
        const t = Math.round(lotQuintals * m.distanceKm * transportRatePerKmQuintal);
        const h = Math.round(g * (hamaliPercent / 100));
        return {
          marketName: m.marketName,
          distanceKm: m.distanceKm,
          net: g - t - h,
        };
      })
      .sort((a, b) => b.net - a.net);

    const chartData = selectedMandi.trend7d.map((price, idx) => ({
      day: idx === 6 ? 'Today' : `D-${6 - idx}`,
      price,
    }));

    return {
      gross,
      transportCost,
      hamaliFees,
      netProfit,
      netPerQuintal,
      bestOption: sameCropMandis[0] ?? null,
      chartData,
    };
  }, [selectedMandi, mandiList, lotQuintals, transportRatePerKmQuintal, hamaliPercent]);

  const severityColor = (severity: LeafDiagnosis['severity']) => {
    if (severity === 'High') return 'text-red-700';
    if (severity === 'Moderate') return 'text-amber-700';
    return 'text-emerald-700';
  };

  return (
    <div className="space-y-8">
      {/* Section 1: AI Leaf Scanner + Diagnosis Workbench */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: 3-Step Farmer Leaf Scanner Wizard */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <p className="text-xs font-medium text-slate-500">
                  KisanVision · 3-Step Pathology Wizard
                </p>
                <h2 className="text-xl font-semibold text-slate-900 mt-0.5">
                  {language === 'te' ? 'ఆకు & తెగులు పరీక్ష' : 'AI Leaf & Pest Diagnosis'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[44px] inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Upload className="w-4 h-4" />
                {language === 'te' ? 'ఫోటో అప్‌లోడ్' : 'Upload Photo'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleFileSelected(file);
                    setScannerStep(2);
                  }
                }}
              />
            </div>

            {/* 3-Step Wizard Header Tabs */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {(
                [
                  {step: 1 as const, te: '1. ఫోటో', en: '1. Photo'},
                  {step: 2 as const, te: '2. పంట', en: '2. Crop'},
                  {step: 3 as const, te: '3. ఫలితం', en: '3. Result'},
                ]
              ).map((item) => {
                const active = scannerStep === item.step;
                return (
                  <button
                    key={item.step}
                    type="button"
                    onClick={() => setScannerStep(item.step)}
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

            {scannerStep === 1 && (
              <div className="mt-4 space-y-4">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                  <img
                    src={previewUrl}
                    alt="Selected crop leaf specimen for disease diagnosis"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-3 flex items-center justify-between text-white">
                    <span className="text-xs font-medium">
                      {uploadedBase64 ? 'Custom Field Photo Ready' : `Field Specimen · ${cropHint}`}
                    </span>
                    <span className="text-xs font-mono tabular-nums text-white/90">{district}</span>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">
                    {language === 'te'
                      ? 'నమూనా ఆకులు (1-ట్యాప్ పరీక్ష)'
                      : 'Telangana Field Specimens (1-Click Test)'}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {SAMPLE_SPECIMENS.map((sp) => {
                      const active = !uploadedBase64 && selectedSamplePath === sp.imageUrl;
                      return (
                        <button
                          key={sp.id}
                          type="button"
                          onClick={() => handleSelectSample(sp)}
                          className={`min-h-[52px] text-left p-2.5 rounded-lg border transition-colors ${
                            active
                              ? 'border-emerald-700 bg-emerald-50/70 text-emerald-950'
                              : 'border-slate-200 hover:border-slate-300 text-slate-700'
                          }`}
                        >
                          <div className="text-xs font-semibold truncate">{sp.label}</div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">
                            {sp.region}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {scannerStep === 2 && (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-2">
                    {language === 'te'
                      ? 'మీ పంటను ఎంచుకోండి (Select Crop)'
                      : 'Select Crop Context'}
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      {val: 'Auto-detect', label: 'Auto-detect', te: 'ఆటో గుర్తింపు'},
                      {val: 'Paddy', label: 'Paddy (Rice)', te: 'వరి (Paddy)'},
                      {val: 'Cotton', label: 'Cotton', te: 'పత్తి (Cotton)'},
                      {val: 'Chili', label: 'Chili (Mirchi)', te: 'మిర్చి (Chili)'},
                      {val: 'Turmeric', label: 'Turmeric', te: 'పసుపు (Turmeric)'},
                      {val: 'Maize', label: 'Maize', te: 'మొక్కజొన్న (Maize)'},
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setCropHint(opt.val)}
                        className={`min-h-[48px] px-3 py-2 rounded-xl border text-left transition-colors ${
                          cropHint === opt.val
                            ? 'border-emerald-700 bg-emerald-50 text-emerald-950 font-semibold'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-xs font-semibold">
                          {language === 'te' ? opt.te : opt.label}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                  Selected specimen: <strong className="text-slate-900">{cropHint}</strong> ·{' '}
                  District: <strong className="text-slate-900">{district}</strong> · Output Language:{' '}
                  <strong className="text-slate-900">{language.toUpperCase()}</strong>
                </div>
              </div>
            )}

            {scannerStep === 3 && (
              <div className="mt-4 space-y-4">
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 space-y-2">
                  <div className="text-xs font-semibold text-emerald-900">
                    {language === 'te' ? 'రోగ నిర్ధారణ సిద్ధంగా ఉంది' : 'Diagnosis Ready'}
                  </div>
                  {activeDiagnosis ? (
                    <>
                      <div className="text-base font-bold text-slate-900">
                        {activeDiagnosis.diseaseName}
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {activeDiagnosis.localizedSummary}
                      </p>
                      <div className="pt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            isSpeaking
                              ? stopSpeaking()
                              : speakText(activeDiagnosis.localizedSummary, activeDiagnosis.language)
                          }
                          className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg"
                        >
                          {isSpeaking ? (
                            <>
                              <VolumeX className="w-4 h-4" />
                              Stop Audio
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-4 h-4" />
                              {language === 'te' ? 'సలహా వినండి' : 'Listen Summary'}
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setScannerStep(1)}
                          className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                        >
                          {language === 'te' ? 'కొత్త ఆకు పరీక్ష' : 'Scan Another'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-slate-600">
                      Run diagnosis in Step 2 to view localized treatment & audio guidance.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-slate-200 space-y-3">
            {scanError && (
              <div className="flex items-start justify-between gap-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{scanError}</span>
                </div>
                <button
                  type="button"
                  onClick={runDiagnosis}
                  disabled={diagnosing}
                  className="font-semibold underline shrink-0 hover:text-red-900"
                >
                  Retry
                </button>
              </div>
            )}

            {scannerStep === 1 ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setScannerStep(2)}
                  className="flex-1 min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors"
                >
                  {language === 'te' ? 'తదుపరి: పంట ఎంచుకోండి →' : 'Next: Select Crop →'}
                </button>
                <button
                  type="button"
                  onClick={runDiagnosis}
                  disabled={diagnosing}
                  className="min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-800 hover:bg-emerald-900 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
                >
                  {diagnosing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                  {language === 'te' ? 'వెంటనే పరీక్షించు' : 'Quick Scan'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={runDiagnosis}
                disabled={diagnosing}
                className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-800 hover:bg-emerald-900 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
              >
                {diagnosing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {scanRetryStatus ?? 'Analyzing Leaf Pathology...'}
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" />
                    {language === 'te' ? 'ఆకు తెగులు నిర్ధారించండి' : 'Diagnose Crop Disease'}
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Right: Structured Agronomy Diagnosis + Voice Assistant */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Active Diagnosis Panel */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            {diagnosing ? (
              <div className="space-y-4 py-6">
                <div className="h-5 w-48 bg-slate-100 rounded animate-pulse" />
                <div className="h-8 w-80 bg-slate-100 rounded animate-pulse" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="h-28 bg-slate-100 rounded animate-pulse" />
                  <div className="h-28 bg-slate-100 rounded animate-pulse" />
                </div>
              </div>
            ) : activeDiagnosis ? (
              <div>
                <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{activeDiagnosis.cropDetected}</span>
                      <span aria-hidden="true">·</span>
                      <span className={`font-semibold ${severityColor(activeDiagnosis.severity)}`}>
                        {activeDiagnosis.severity} Severity
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {activeDiagnosis.confidencePercent}% Confidence
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">
                      {activeDiagnosis.diseaseName}
                    </h3>
                    <p className="text-sm text-slate-600 mt-0.5">{activeDiagnosis.localName}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      isSpeaking
                        ? stopSpeaking()
                        : speakText(activeDiagnosis.localizedSummary, activeDiagnosis.language)
                    }
                    className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    {isSpeaking ? (
                      <>
                        <VolumeX className="w-3.5 h-3.5" />
                        Stop Audio
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5" />
                        Listen Summary
                      </>
                    )}
                  </button>
                </div>

                {/* Localized Summary */}
                <p className="mt-4 text-sm text-slate-800 leading-relaxed">
                  {activeDiagnosis.localizedSummary}
                </p>

                {/* Two-column treatment comparison separated by hairline divider (no nested cards) */}
                <div className="mt-5 pt-5 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                      <Leaf className="w-4 h-4" />
                      Organic Bio-Control
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">
                      {activeDiagnosis.organicTreatment.agent}
                    </div>
                    <div className="mt-1 text-xs font-mono tabular-nums text-slate-700">
                      Dosage: {activeDiagnosis.organicTreatment.dosage}
                    </div>
                    <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                      {activeDiagnosis.organicTreatment.applicationMethod}
                    </p>
                  </div>

                  <div className="md:border-l md:border-slate-200 md:pl-6">
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                      <ShieldAlert className="w-4 h-4" />
                      Targeted Chemical Treatment
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">
                      {activeDiagnosis.chemicalTreatment.molecule}
                    </div>
                    <div className="mt-1 text-xs font-mono tabular-nums text-slate-700">
                      Dosage: {activeDiagnosis.chemicalTreatment.dosage} · PHI:{' '}
                      {activeDiagnosis.chemicalTreatment.preHarvestIntervalDays} days
                    </div>
                    <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                      {activeDiagnosis.chemicalTreatment.safetyNote}
                    </p>
                  </div>
                </div>

                {/* Observed Symptoms & Preventive Actions */}
                <div className="mt-5 pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600">
                  <div>
                    <span className="font-semibold text-slate-800 block mb-1">
                      Symptoms Identified
                    </span>
                    <ul className="space-y-1 list-disc list-inside">
                      {activeDiagnosis.symptomsObserved.map((s, idx) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800 block mb-1">
                      Field Prevention Steps
                    </span>
                    <ul className="space-y-1 list-disc list-inside">
                      {activeDiagnosis.preventiveSteps.map((s, idx) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-10 text-center">
                <p className="text-sm font-medium text-slate-700">
                  Select a field specimen or upload a crop leaf photo to run diagnosis.
                </p>
              </div>
            )}
          </div>

          {/* Local Language Voice Assistant (Telugu / Hindi / English) */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 flex-1 flex flex-col">
            <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-200">
              <div>
                <p className="text-xs text-slate-500">
                  Hands-Free Speech-to-Text & Text-to-Speech
                </p>
                <h3 className="text-base font-semibold text-slate-900">
                  Multilingual Voice Agronomist ({language === 'te' ? 'తెలుగు' : language === 'hi' ? 'हिन्दी' : 'English'})
                </h3>
              </div>
              {isSpeaking && (
                <button
                  type="button"
                  onClick={stopSpeaking}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 whitespace-nowrap"
                >
                  <VolumeX className="w-3.5 h-3.5" />
                  Mute Voice
                </button>
              )}
            </div>

            {/* Conversation Stream */}
            <div className="mt-4 space-y-3 max-h-48 overflow-y-auto pr-1">
              {voiceHistory.map((turn) => (
                <div
                  key={turn.id}
                  className={`flex flex-col ${turn.role === 'farmer' ? 'items-end' : 'items-start'}`}
                >
                  <div className="text-[11px] text-slate-400 mb-1">
                    {turn.role === 'farmer' ? 'You' : 'RythuSethu Advisor'} · {turn.timestamp}
                  </div>
                  <div
                    className={`max-w-[90%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
                      turn.role === 'farmer'
                        ? 'bg-emerald-800 text-white'
                        : 'bg-slate-100 text-slate-900'
                    }`}
                  >
                    <p>{turn.text}</p>
                    {turn.role === 'advisor' && (
                      <button
                        type="button"
                        onClick={() => speakText(turn.text, turn.language)}
                        className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-emerald-800 hover:underline"
                      >
                        <Volume2 className="w-3 h-3" />
                        Play Voice
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Voice Prompts */}
            <div className="mt-3 flex flex-wrap gap-2">
              {QUICK_VOICE_PROMPTS[language].map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => askVoiceAssistant(q)}
                  disabled={askingVoice}
                  className="text-left text-xs px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>

            {voiceRetryStatus && (
              <p className="mt-2 text-xs text-amber-800">{voiceRetryStatus}</p>
            )}

            {voiceError && (
              <p className="mt-2 text-xs text-red-700">{voiceError}</p>
            )}

            {/* Input + Mic Controls */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                askVoiceAssistant();
              }}
              className="mt-4 pt-3 border-t border-slate-200 flex items-center gap-2"
            >
              <button
                type="button"
                onClick={toggleVoiceMic}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  isListening
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                {isListening ? 'Listening...' : 'Speak'}
              </button>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={
                  language === 'te'
                    ? 'తెలుగులో లేదా ఇంగ్లీష్‌లో ప్రశ్న అడగండి...'
                    : language === 'hi'
                      ? 'अपना सवाल बोलें या लिखें...'
                      : 'Ask about dosage, pests, or mandi prices...'
                }
                className="flex-1 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
              <button
                type="submit"
                disabled={askingVoice || !question.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {askingVoice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Ask
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Offline / Cached Scan History Strip */}
      {scans.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Recent Field Scan Log (Offline-Cached)
              </h3>
              <p className="text-xs text-slate-500">
                Saved locally for zero-connectivity field reference
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {scans.length} saved records
            </span>
          </div>
          <div className="mt-3 divide-y divide-slate-200">
            {scans.slice(0, 4).map((scan) => (
              <button
                key={scan.id}
                type="button"
                onClick={() => setActiveDiagnosis(scan)}
                className="w-full py-2.5 flex items-center justify-between gap-4 text-left hover:bg-slate-50 px-2 rounded transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">
                    {scan.cropDetected} — {scan.diseaseName}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{scan.localName}</div>
                </div>
                <div className="flex items-center gap-4 shrink-0 text-xs font-mono tabular-nums">
                  <span className={`font-semibold ${severityColor(scan.severity)}`}>
                    {scan.severity}
                  </span>
                  <span className="text-slate-500">
                    {new Date(scan.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Section 2: Live Telangana Mandi Price Tracker & Transport Profit Estimator */}
      <section id="mandi-section" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <p className="text-xs text-slate-500">
                Agmarknet & e-NAM Reference Feed · Distance from {district}
              </p>
              <h2 className="text-lg font-semibold text-slate-900 mt-0.5">
                Live Telangana Mandi Rates
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={mandiSearch}
                  onChange={(e) => setMandiSearch(e.target.value)}
                  placeholder="Search market or crop..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {['All', 'Paddy', 'Cotton', 'Chili', 'Turmeric'].map((crop) => (
                  <button
                    key={crop}
                    type="button"
                    onClick={() => setMandiCropFilter(crop)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      mandiCropFilter === crop
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {crop}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {mandiLoading && mandiList.length === 0 ? (
            <div className="py-8 space-y-2">
              <div className="h-10 bg-slate-100 rounded animate-pulse" />
              <div className="h-10 bg-slate-100 rounded animate-pulse" />
              <div className="h-10 bg-slate-100 rounded animate-pulse" />
            </div>
          ) : filteredMandi.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              No mandis matched your filter. Try clearing the search box.
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                    <th className="py-2.5 pr-3">Mandi & Crop</th>
                    <th className="py-2.5 px-3 text-right">Distance</th>
                    <th className="py-2.5 px-3 text-right">Modal ₹/qtl</th>
                    <th className="py-2.5 px-3 text-right">Range ₹/qtl</th>
                    <th className="py-2.5 pl-3 text-right">Arrivals</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {filteredMandi.map((row) => {
                    const isSelected = selectedMandi?.id === row.id;
                    return (
                      <tr
                        key={row.id}
                        onClick={() => setSelectedMandiId(row.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-2.5 pr-3">
                          <div className="font-semibold text-slate-900">{row.marketName}</div>
                          <div className="text-xs text-slate-500">
                            {row.crop} · {row.variety}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs text-slate-700">
                          {row.distanceKm} km
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-emerald-800">
                          ₹{row.modalPricePerQuintal.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs text-slate-600">
                          ₹{row.minPricePerQuintal.toLocaleString('en-IN')}–
                          {row.maxPricePerQuintal.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 pl-3 text-right font-mono tabular-nums text-xs text-slate-600">
                          {row.arrivalsQuintals.toLocaleString('en-IN')} qtl
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: Net Profit & Transport Deduction Calculator */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
          <div className="pb-4 border-b border-slate-200">
            <p className="text-xs text-slate-500">Transport & Commission Adjusted</p>
            <h3 className="text-lg font-semibold text-slate-900 mt-0.5">
              Mandi Net Profit Estimator
            </h3>
          </div>

          {selectedMandi && profitCalc ? (
            <div className="mt-4 space-y-4">
              <div className="text-xs text-slate-600">
                Selected Market:{' '}
                <span className="font-semibold text-slate-900">{selectedMandi.marketName}</span> ·{' '}
                {selectedMandi.crop} ({selectedMandi.distanceKm} km from {district})
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Harvest (Qtls)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={lotQuintals}
                    onChange={(e) => setLotQuintals(Math.max(1, Number(e.target.value)))}
                    className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Freight ₹/km/qtl
                  </label>
                  <input
                    type="number"
                    step={0.2}
                    min={0.5}
                    max={15}
                    value={transportRatePerKmQuintal}
                    onChange={(e) =>
                      setTransportRatePerKmQuintal(Math.max(0.5, Number(e.target.value)))
                    }
                    className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Mandi Fee (%)
                  </label>
                  <input
                    type="number"
                    step={0.5}
                    min={0}
                    max={10}
                    value={hamaliPercent}
                    onChange={(e) => setHamaliPercent(Math.max(0, Number(e.target.value)))}
                    className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
              </div>

              {/* Ledger Breakdown */}
              <div className="pt-3 border-t border-slate-200 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Gross Sale Value</span>
                  <span className="font-mono tabular-nums font-medium text-slate-900">
                    ₹{profitCalc.gross.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">
                    Transport Deduction ({selectedMandi.distanceKm} km)
                  </span>
                  <span className="font-mono tabular-nums text-red-700">
                    -₹{profitCalc.transportCost.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Hamali & Weighing ({hamaliPercent}%)</span>
                  <span className="font-mono tabular-nums text-red-700">
                    -₹{profitCalc.hamaliFees.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                  <span className="font-semibold text-slate-900">Net Take-Home</span>
                  <div className="text-right">
                    <div className="text-xl font-bold font-mono tabular-nums text-emerald-800">
                      ₹{profitCalc.netProfit.toLocaleString('en-IN')}
                    </div>
                    <div className="text-xs font-mono tabular-nums text-slate-500">
                      ₹{profitCalc.netPerQuintal.toLocaleString('en-IN')} net / quintal
                    </div>
                  </div>
                </div>
              </div>

              {profitCalc.bestOption && (
                <div className="pt-3 border-t border-slate-200 flex items-start gap-2 text-xs text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <span>
                    Best net return for {selectedMandi.crop}:{' '}
                    <strong>{profitCalc.bestOption.marketName}</strong> (
                    {profitCalc.bestOption.distanceKm} km) at{' '}
                    <span className="font-mono tabular-nums font-semibold">
                      ₹{profitCalc.bestOption.net.toLocaleString('en-IN')}
                    </span>
                  </span>
                </div>
              )}

              {/* 7-Day Modal Price Trend Chart */}
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
                  <span className="inline-flex items-center gap-1 font-medium">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
                    7-Day Modal Price Trend (₹/qtl)
                  </span>
                  <span className="font-mono tabular-nums text-slate-500">
                    {selectedMandi.updatedAt}
                  </span>
                </div>
                <div className="h-32 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={profitCalc.chartData}>
                      <XAxis dataKey="day" tick={{fontSize: 11, fill: '#64748b'}} />
                      <YAxis
                        domain={['auto', 'auto']}
                        tick={{fontSize: 11, fill: '#64748b'}}
                        width={54}
                      />
                      <Tooltip
                        formatter={(val) => [`₹${Number(val ?? 0).toLocaleString('en-IN')}`, 'Modal']}
                      />
                      <Area
                        type="monotone"
                        dataKey="price"
                        stroke="#15803d"
                        fill="#dcfce7"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
};
