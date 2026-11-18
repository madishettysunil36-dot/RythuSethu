import React, {useEffect, useState} from 'react';
import {
  Bug,
  Calculator,
  CalendarDays,
  Camera,
  ChevronRight,
  CloudSun,
  FileCode2,
  Landmark,
  MapPin,
  MessageSquare,
  Sprout,
  Store,
  Tractor,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {RythuSethuLogo} from './RythuSethuLogo.tsx';
import type {
  ChatRolePersona,
  CropSchedule,
  District,
  DoctorSubTab,
  HubSubTab,
  KhataEntry,
  LanguageCode,
  MapCategory,
  PlanSubTab,
  WeatherDay,
  WorkspaceTab,
} from '../types/agri.ts';

interface HomeHubViewProps {
  district: District;
  language: LanguageCode;
  isOnline: boolean;
  onNavigate: (
    tab: WorkspaceTab,
    options?: {
      triggerScan?: boolean;
      doctorSubTab?: DoctorSubTab;
      planSubTab?: PlanSubTab;
      hubSubTab?: HubSubTab;
      mapCategory?: MapCategory;
    },
  ) => void;
  onOpenChat: (persona?: ChatRolePersona) => void;
}

export const HomeHubView: React.FC<HomeHubViewProps> = ({
  district,
  language,
  isOnline,
  onNavigate,
  onOpenChat,
}) => {
  const [todayWeather, setTodayWeather] = useState<WeatherDay | null>(null);
  const [khataNet, setKhataNet] = useState<number | null>(null);
  const [activeCropsCount, setActiveCropsCount] = useState<number>(2);

  useEffect(() => {
    fetch(`/api/smartfasal/weather?district=${encodeURIComponent(district)}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.days) && data.days.length > 0) {
          setTodayWeather(data.days[0]);
        }
      })
      .catch(() => {});

    fetch('/api/khata')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.entries)) {
          const entries = data.entries as KhataEntry[];
          const inc = entries
            .filter((e) => e.type === 'income' || e.type === 'subsidy')
            .reduce((s, e) => s + e.amountInr, 0);
          const exp = entries
            .filter((e) => e.type === 'input_cost')
            .reduce((s, e) => s + e.amountInr, 0);
          setKhataNet(inc - exp);
        }
      })
      .catch(() => {});

    fetch('/api/calendar')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.schedules)) {
          setActiveCropsCount((data.schedules as CropSchedule[]).length);
        }
      })
      .catch(() => {});
  }, [district]);

  const featureCards = [
    {
      id: 'agro-shops',
      telugu: 'సమీప ఎరువులు & విత్తన షాపులు',
      hindi: 'नजदीकी खाद, बीज और दवा दुकान',
      english: 'Fertilizer & Agro-Shops Map',
      desc:
        language === 'te'
          ? `${district} దగ్గరలో ఉన్న ఎరువులు, పురుగుమందుల షాపులు, మట్టి ల్యాబ్‌లు & మార్గం`
          : `Find nearest fertilizer dealers, seed stores, Rythu Vedika, mandis & routes in ${district}`,
      imageUrl: '/src/assets/images/agro_fertilizer_shop_1795036060934.jpg',
      icon: Store,
      onClick: () => onNavigate('maphub', {mapCategory: 'agro_shops'}),
    },
    {
      id: 'leaf-doctor',
      telugu: 'AI ఆకు పరీక్ష & తెలుగు సలహా',
      hindi: 'AI पत्ती जांच और डॉक्टर सलाह',
      english: 'AI Leaf Scanner & Voice Doctor',
      desc:
        language === 'te'
          ? 'ఆకు ఫోటో తీసి తెగులు నిర్ధారణ & సేంద్రియ/రసాయన మందు వివరాలు వినండి'
          : '3-step crop pathology scanner with Telugu voice advisory & treatment plan',
      imageUrl: '/src/assets/images/crop_paddy_blast_1795028875777.jpg',
      icon: Camera,
      onClick: () => onNavigate('doctor', {doctorSubTab: 'scanner', triggerScan: true}),
    },
    {
      id: 'spray-calc',
      telugu: 'పురుగుల గైడ్ & ట్యాంక్ మందు కొలత',
      hindi: 'कीट गाइड और स्प्रे टैंक कैलकुलेटर',
      english: 'Pest Guide & Spray Calculator',
      desc:
        language === 'te'
          ? '15L/16L పంపు లేదా డ్రోన్ ట్యాంక్‌కు ఎన్ని ml/గ్రాముల మందు కలపాలో వెంటనే లెక్కించండి'
          : 'Visual pest atlas + exact per-tank ml/grams & bottle pack calculator',
      imageUrl: '/src/assets/images/spray_crop_protection_1795036061187.jpg',
      icon: Calculator,
      onClick: () => onNavigate('doctor', {doctorSubTab: 'spray_calc'}),
    },
    {
      id: 'crop-calendar',
      telugu: 'పంట క్యాలెండర్ & నీటి ప్రణాళిక',
      hindi: 'फसल कैलेंडर, खाद और मौसम अलर्ट',
      english: 'Crop Calendar & Soil NPK',
      desc:
        language === 'te'
          ? 'విత్తిన నాటి నుండి కోత వరకు ఎరువులు, నీటి తడి మరియు 7 రోజుల వర్ష హెచ్చరికలు'
          : 'Sowing-to-harvest stage checklists, Soil Card NPK & 7-day spray alerts',
      imageUrl: '/src/assets/images/soil_testing_irrigation_1795036061027.jpg',
      icon: CalendarDays,
      onClick: () => onNavigate('plan', {planSubTab: 'calendar'}),
    },
    {
      id: 'farm-khata',
      telugu: 'రైతు ఖాతా — ఆదాయం & రుణాలు',
      hindi: 'किसान खाता — आय, कर्ज और मुनाफा',
      english: 'Farm Khata & Profit Ledger',
      desc:
        language === 'te'
          ? 'పంట అమ్మకాలు, ఎరువు ఖర్చులు, KCC పంట రుణాలు & నికర సీజన్ లాభం లెక్కింపు'
          : 'Track harvest revenue, input bills, KCC/private loans & season net surplus',
      imageUrl: '/src/assets/images/grain_mandi_godown_1795036061467.jpg',
      icon: Wallet,
      onClick: () => onNavigate('hub', {hubSubTab: 'khata'}),
    },
    {
      id: 'schemes',
      telugu: 'రైతు భరోసా & ప్రభుత్వ పథకాలు',
      hindi: 'रायतु भरोसा और सरकारी योजनाएं',
      english: 'Telangana Schemes & Bharosa',
      desc:
        language === 'te'
          ? 'రైతు భరోసా, రైతు బీమా, PM-KISAN, డ్రిప్ సబ్సిడీ అర్హత & లైవ్ వెబ్ తనిఖీ'
          : 'Track Rythu Bharosa, Rythu Bima, PM-KISAN, drip subsidy & live web updates',
      imageUrl: '/src/assets/images/crop_chili_leafcurl_1795028891502.jpg',
      icon: Landmark,
      onClick: () => onNavigate('hub', {hubSubTab: 'schemes'}),
    },
    {
      id: 'mandi-rates',
      telugu: 'లైవ్ మండి ధరలు & లాభం',
      hindi: 'ताजा मंडी भाव और शुद्ध मुनाफा',
      english: 'Mandi Prices & Net Profit',
      desc:
        language === 'te'
          ? 'ఎనుమాముల, ఖమ్మం, నిజామాబాద్ మార్కెట్ ధరలు & రవాణా ఖర్చు తర్వాత నికర లాభం'
          : 'Telangana mandi rates adjusted for transport distance & hamali fees',
      imageUrl: '/src/assets/images/crop_cotton_bollworm_1795028893387.jpg',
      icon: TrendingUp,
      onClick: () => onNavigate('doctor', {doctorSubTab: 'mandi'}),
    },
    {
      id: 'machinery-f2b',
      telugu: 'ట్రాక్టర్ / డ్రోన్ అద్దె & F2B అమ్మకం',
      hindi: 'ट्रैक्टर/ड्रोन बुकिंग और सीधी बिक्री',
      english: 'Machinery Rental & Direct F2B',
      desc:
        language === 'te'
          ? 'వర్ష రక్షణతో డ్రోన్/ట్రాక్టర్ బుకింగ్ & మధ్యవర్తులు లేకుండా నేరుగా వ్యాపారులకు అమ్మకం'
          : 'P2P village machinery rental & zero-commission pre-harvest buyer bids',
      imageUrl: '/src/assets/images/equipment_agri_drone_1795028872931.jpg',
      icon: Tractor,
      onClick: () => onNavigate('hub', {hubSubTab: 'agrilink'}),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Photographic Telangana Hero Card */}
      <section className="relative rounded-3xl overflow-hidden border border-slate-200 bg-emerald-950 text-white">
        <img
          src="/src/assets/images/telangana_paddy_sunrise_1795036059433.jpg"
          alt="Sunrise over Telangana green paddy fields with Kakatiya stone arch"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/95 via-emerald-950/80 to-emerald-950/45" />

        <div className="relative p-5 sm:p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-3">
              <RythuSethuLogo size={46} className="shrink-0 bg-white/95 rounded-2xl p-1" />
              <div className="text-xs font-medium text-emerald-200">
                తెలంగాణ రైతు సమగ్ర డిజిటల్ సహాయకారి · {district} ·{' '}
                {isOnline ? 'AI & Maps Online' : 'Offline Field Mode'}
              </div>
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-balance leading-snug">
              {language === 'te'
                ? 'విత్తనం నుండి మార్కెట్ లాభం వరకు — మీ పూర్తి వ్యవసాయ యాప్'
                : language === 'hi'
                  ? 'बुवाई से मंडी मुनाफे तक — संपूर्ण किसान साथी ऐप'
                  : 'Complete End-to-End Companion for Every Telangana Farmer'}
            </h2>

            <p className="text-xs sm:text-sm text-emerald-100/95 leading-relaxed">
              {language === 'te'
                ? 'దగ్గరలోని ఎరువుల షాపులు, ఆకు తెగులు పరీక్ష, ట్యాంక్ మందు లెక్క, పంట క్యాలెండర్, రైతు భరోసా మరియు రైతు ఖాతా ఒకే చోట.'
                : 'Find fertilizer shops nearby, scan diseased leaves, calculate exact tank spray mix, track Crop Calendar stages, Rythu Bharosa & Farm Khata profits.'}
            </p>

            {/* Primary Thumb-Zone Hero Actions */}
            <div className="pt-1 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => onNavigate('maphub', {mapCategory: 'agro_shops'})}
                className="min-h-[48px] inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-emerald-950 bg-amber-300 hover:bg-amber-200 rounded-xl transition-colors"
              >
                <MapPin className="w-4 h-4 shrink-0" />
                {language === 'te' ? 'సమీప ఎరువుల షాపులు' : 'Nearby Agro-Shops'}
              </button>

              <button
                type="button"
                onClick={() =>
                  onNavigate('doctor', {doctorSubTab: 'scanner', triggerScan: true})
                }
                className="min-h-[48px] inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-600 border border-emerald-500/40 rounded-xl transition-colors"
              >
                <Camera className="w-4 h-4 shrink-0" />
                {language === 'te' ? 'ఆకు పరీక్షించండి' : 'Scan Crop Leaf'}
              </button>

              <button
                type="button"
                onClick={() => onOpenChat('crop_doctor')}
                className="min-h-[48px] inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-xl transition-colors"
              >
                <MessageSquare className="w-4 h-4 shrink-0" />
                {language === 'te' ? 'AI సలహా' : 'Ask RythuSethu AI'}
              </button>
            </div>
          </div>

          {/* Live Farm Snapshot Strip */}
          <div className="grid grid-cols-3 lg:grid-cols-1 gap-3 lg:w-64 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('plan', {planSubTab: 'weather'})}
              className="text-left p-3.5 rounded-2xl bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/15 transition-colors"
            >
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-200">
                <CloudSun className="w-3.5 h-3.5" />
                Spray Weather
              </div>
              <div className="text-sm sm:text-base font-bold font-mono tabular-nums mt-1">
                {todayWeather ? `${todayWeather.sprayStatus} (${todayWeather.windKmh} km/h)` : 'Checking...'}
              </div>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('plan', {planSubTab: 'calendar'})}
              className="text-left p-3.5 rounded-2xl bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/15 transition-colors"
            >
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-200">
                <Sprout className="w-3.5 h-3.5" />
                Crop Calendar
              </div>
              <div className="text-sm sm:text-base font-bold font-mono tabular-nums mt-1">
                {activeCropsCount} Active Plots
              </div>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('hub', {hubSubTab: 'khata'})}
              className="text-left p-3.5 rounded-2xl bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/15 transition-colors"
            >
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-200">
                <Wallet className="w-3.5 h-3.5" />
                Farm Khata Net
              </div>
              <div className="text-sm sm:text-base font-bold font-mono tabular-nums mt-1">
                {khataNet !== null ? `₹${khataNet.toLocaleString('en-IN')}` : 'Loading...'}
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* Photographic End-to-End Farmer Utilities Grid */}
      <section aria-label="End-to-End Farmer Toolkit" className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="text-lg sm:text-xl font-bold text-slate-900">
            {language === 'te'
              ? 'రైతుకు అవసరమైన అన్ని సేవలు (End-to-End Toolkit)'
              : language === 'hi'
                ? 'संपूर्ण किसान सेवाएं (एक टैप में)'
                : 'Complete End-to-End Farmer Toolkit'}
          </h3>
          <span className="text-xs text-slate-500">8 field-ready tools</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {featureCards.map((card) => {
            const Icon = card.icon;
            const title =
              language === 'te' ? card.telugu : language === 'hi' ? card.hindi : card.english;
            const subtitle = language === 'en' ? card.telugu : card.english;
            return (
              <button
                key={card.id}
                type="button"
                onClick={card.onClick}
                className="group text-left bg-white border border-slate-200 hover:border-emerald-700 hover:shadow-md rounded-2xl overflow-hidden flex flex-col justify-between transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
              >
                <div className="relative h-36 w-full bg-slate-100 overflow-hidden">
                  <img
                    src={card.imageUrl}
                    alt={card.english}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
                    <div className="w-9 h-9 rounded-xl bg-white/95 text-emerald-900 flex items-center justify-center shadow-sm">
                      <Icon className="w-4 h-4" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/90 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                      {title}
                    </div>
                    <div className="text-[11px] font-medium text-emerald-800 mt-0.5">
                      {subtitle}
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed line-clamp-2">
                    {card.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Quiet Quick Pest Banner + Architecture Spec Link */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('doctor', {doctorSubTab: 'pest_guide'})}
          className="text-left bg-white border border-slate-200 hover:border-emerald-700 rounded-2xl p-4 flex items-center justify-between gap-4 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center shrink-0">
              <Bug className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">
                {language === 'te' ? 'ఫోటో పురుగుల నివారణ అట్లాస్' : 'Visual Crop Pest Atlas'}
              </div>
              <div className="text-xs text-slate-500">
                Inspect Paddy Blast, Pink Bollworm & Chili Curl photos offline
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('blueprint')}
          className="text-left bg-white border border-slate-200 hover:border-slate-400 rounded-2xl p-4 flex items-center justify-between gap-4 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <FileCode2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">
                System Architecture & API Blueprint
              </div>
              <div className="text-xs text-slate-500">
                Inspect RythuSethu REST routes, offline PWA cache & schemas
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
        </button>
      </section>
    </div>
  );
};
