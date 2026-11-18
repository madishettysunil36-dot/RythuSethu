import {useEffect, useState} from 'react';
import {
  AlertTriangle,
  Bug,
  Calculator,
  CalendarDays,
  Camera,
  CloudSun,
  Download,
  Home,
  Landmark,
  MapPin,
  Sprout,
  Tractor,
  TrendingUp,
  Wallet,
  WifiOff,
} from 'lucide-react';
import {AgriLinkView} from './components/AgriLinkView.tsx';
import {BlueprintView} from './components/BlueprintView.tsx';
import {ChatbotDrawer} from './components/ChatbotDrawer.tsx';
import {CropCalendarView} from './components/CropCalendarView.tsx';
import {FarmKhataView} from './components/FarmKhataView.tsx';
import {HomeHubView} from './components/HomeHubView.tsx';
import {KisanVisionView} from './components/KisanVisionView.tsx';
import {MapHubView} from './components/MapHubView.tsx';
import {PestAndSprayView} from './components/PestAndSprayView.tsx';
import {RythuSethuLogo} from './components/RythuSethuLogo.tsx';
import {SchemesTrackerView} from './components/SchemesTrackerView.tsx';
import {SmartFasalView} from './components/SmartFasalView.tsx';
import {useOnlineStatus, usePWAInstall} from './hooks/usePWA.ts';
import type {
  ChatRolePersona,
  District,
  DoctorSubTab,
  HubSubTab,
  LanguageCode,
  MapCategory,
  PlanSubTab,
  WorkspaceTab,
} from './types/agri.ts';

const DISTRICTS: District[] = [
  'Warangal',
  'Hanamkonda',
  'Karimnagar',
  'Khammam',
  'Nizamabad',
  'Nalgonda',
];

const NAV_TABS: Array<{
  id: WorkspaceTab;
  label: string;
  telugu: string;
  icon: React.ComponentType<{className?: string}>;
}> = [
  {id: 'home', label: 'Home', telugu: 'హోమ్', icon: Home},
  {id: 'doctor', label: 'Doctor', telugu: 'డాక్టర్', icon: Camera},
  {id: 'plan', label: 'Plan', telugu: 'ప్రణాళిక', icon: Sprout},
  {id: 'maphub', label: 'AgriMap', telugu: 'షాపులు', icon: MapPin},
  {id: 'hub', label: 'Hub', telugu: 'ఖాతా', icon: Wallet},
];

const DOCTOR_SUBTABS: Array<{
  id: DoctorSubTab;
  label: string;
  telugu: string;
  icon: React.ComponentType<{className?: string}>;
}> = [
  {id: 'scanner', label: 'Leaf Scan & Voice', telugu: 'ఆకు పరీక్ష', icon: Camera},
  {id: 'pest_guide', label: 'Visual Pest Guide', telugu: 'పురుగుల గైడ్', icon: Bug},
  {id: 'spray_calc', label: 'Spray Calculator', telugu: 'మందు కొలత', icon: Calculator},
  {id: 'mandi', label: 'Mandi Profit', telugu: 'మండి ధరలు', icon: TrendingUp},
];

const PLAN_SUBTABS: Array<{
  id: PlanSubTab;
  label: string;
  telugu: string;
  icon: React.ComponentType<{className?: string}>;
}> = [
  {id: 'calendar', label: 'Crop Calendar', telugu: 'పంట క్యాలెండర్', icon: CalendarDays},
  {id: 'soil', label: 'Soil NPK & ROI', telugu: 'మట్టి & లాభం', icon: Sprout},
  {id: 'weather', label: '7-Day Spray Alerts', telugu: 'వాతావరణం', icon: CloudSun},
];

const HUB_SUBTABS: Array<{
  id: HubSubTab;
  label: string;
  telugu: string;
  icon: React.ComponentType<{className?: string}>;
}> = [
  {id: 'khata', label: 'Farm Khata', telugu: 'రైతు ఖాతా', icon: Wallet},
  {id: 'schemes', label: 'Schemes & Bharosa', telugu: 'పథకాలు', icon: Landmark},
  {id: 'agrilink', label: 'Machinery & F2B', telugu: 'యంత్రాలు & F2B', icon: Tractor},
];

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('home');
  const [doctorSubTab, setDoctorSubTab] = useState<DoctorSubTab>('scanner');
  const [planSubTab, setPlanSubTab] = useState<PlanSubTab>('calendar');
  const [hubSubTab, setHubSubTab] = useState<HubSubTab>('khata');
  const [mapCategory, setMapCategory] = useState<MapCategory>('agro_shops');

  const [district, setDistrict] = useState<District>('Warangal');
  const [language, setLanguage] = useState<LanguageCode>('te');
  const [scanTriggerCount, setScanTriggerCount] = useState(0);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatPersona, setChatPersona] = useState<ChatRolePersona>('crop_doctor');
  const [externalChatPrompt, setExternalChatPrompt] = useState<{
    persona: ChatRolePersona;
    query: string;
    nonce: number;
  } | null>(null);
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);

  const isOnline = useOnlineStatus();
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();

  useEffect(() => {
    const onQuotaExceeded = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  const handlePrimaryAction = () => {
    if (!isInstalled && isInstallable) {
      install();
      return;
    }
    if (!isInstalled && isIOS) {
      setShowIOSGuide(true);
      return;
    }
    setActiveTab('doctor');
    setDoctorSubTab('scanner');
    setScanTriggerCount((c) => c + 1);
  };

  const handleNavigate = (
    tab: WorkspaceTab,
    options?: {
      triggerScan?: boolean;
      doctorSubTab?: DoctorSubTab;
      planSubTab?: PlanSubTab;
      hubSubTab?: HubSubTab;
      mapCategory?: MapCategory;
    },
  ) => {
    setActiveTab(tab);

    if (options?.doctorSubTab) {
      setDoctorSubTab(options.doctorSubTab);
      if (options.doctorSubTab === 'mandi') {
        setTimeout(() => {
          document.getElementById('mandi-section')?.scrollIntoView({behavior: 'smooth'});
        }, 120);
      }
    }

    if (options?.planSubTab) {
      setPlanSubTab(options.planSubTab);
      if (options.planSubTab === 'weather') {
        setTimeout(() => {
          document.getElementById('weather-section')?.scrollIntoView({behavior: 'smooth'});
        }, 120);
      }
    }

    if (options?.hubSubTab) {
      setHubSubTab(options.hubSubTab);
    }

    if (options?.mapCategory) {
      setMapCategory(options.mapCategory);
    }

    if (options?.triggerScan) {
      setScanTriggerCount((c) => c + 1);
    }

    if (!options?.doctorSubTab && !options?.planSubTab) {
      window.scrollTo({top: 0, behavior: 'smooth'});
    }
  };

  const handleNavigateMap = (category: MapCategory) => {
    setMapCategory(category);
    setActiveTab('maphub');
    window.scrollTo({top: 0, behavior: 'smooth'});
  };

  const handleOpenChat = (persona?: ChatRolePersona) => {
    if (persona) setChatPersona(persona);
    setChatOpen(true);
  };

  const handleOpenChatWithQuery = (persona: ChatRolePersona, query: string) => {
    setChatPersona(persona);
    setExternalChatPrompt({persona, query, nonce: Date.now()});
    setChatOpen(true);
  };

  const primaryActionLabel =
    !isInstalled && (isInstallable || isIOS)
      ? 'Install App'
      : language === 'te'
        ? 'ఆకు పరీక్ష'
        : 'Scan Leaf';

  const workspaceTitle = () => {
    if (activeTab === 'home') return 'RythuSethu — Telangana Farmer Companion';
    if (activeTab === 'doctor') {
      if (doctorSubTab === 'pest_guide') return 'Visual Pest Atlas — Crop Protection Guide';
      if (doctorSubTab === 'spray_calc') return 'Spray Dosage & Tank Mix Calculator';
      if (doctorSubTab === 'mandi') return 'Telangana Mandi Rates & Net Profit';
      return 'Crop Doctor — AI Leaf Diagnosis & Voice Advisor';
    }
    if (activeTab === 'plan') {
      if (planSubTab === 'calendar') return 'Sowing-to-Harvest Crop Calendar';
      if (planSubTab === 'weather') return '7-Day Hyper-Local Spray & Rain Alerts';
      return 'SmartFasal — Soil NPK Engine & Break-Even ROI';
    }
    if (activeTab === 'maphub') return 'AgriMap — Fertilizer Shops, Soil Labs & Mandis';
    if (activeTab === 'hub') {
      if (hubSubTab === 'schemes') return 'Telangana Schemes & Rythu Bharosa Tracker';
      if (hubSubTab === 'agrilink') return 'AgriLink — P2P Machinery & Direct F2B Buyers';
      return 'Farm Khata — Income, Expenses & Crop Loans';
    }
    return 'Platform Architecture & API Specification';
  };

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-slate-900 flex flex-col">
      {/* Case A Google Maps Platform Quota Exceeded Sticky Banner */}
      {gmpQuotaExceeded && (
        <div
          role="alert"
          className="sticky top-0 z-50 bg-amber-50 border-b border-amber-300 text-amber-950 px-4 py-2 text-xs font-medium"
        >
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                Google Maps Platform quota reached. If you are the app developer, check your project
                quota or billing settings in Google Cloud Console.{' '}
                <a
                  href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-semibold text-amber-900 hover:text-amber-700"
                >
                  Learn more
                </a>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setGmpQuotaExceeded(false)}
              className="text-xs font-semibold underline text-amber-900 hover:text-amber-700 shrink-0"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Compact Sticky App Header (48px mobile / 56px desktop — keeps sticky chrome <= 15% mobile height) */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 h-12 lg:h-14">
        <div className="max-w-7xl h-full mx-auto px-3 sm:px-6 flex items-center justify-between gap-4">
          {/* Zone 1: Kakatiya Kala Thoranam Crest + RythuSethu Wordmark */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('home');
              window.scrollTo({top: 0, behavior: 'smooth'});
            }}
            className="inline-flex items-center gap-2 text-lg sm:text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 rounded-lg pr-1"
          >
            <RythuSethuLogo size={32} />
            <span>RythuSethu</span>
          </button>

          {/* Zone 2 (Desktop): 5 concise single-line nav links */}
          <nav aria-label="Primary Desktop Navigation" className="hidden lg:flex items-center gap-7 text-sm font-medium">
            {NAV_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleNavigate(tab.id)}
                  className={`inline-flex items-center gap-1.5 py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'border-emerald-800 text-slate-900 font-semibold'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={handlePrimaryAction}
              className="min-h-[36px] sm:min-h-[40px] inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {!isInstalled && (isInstallable || isIOS) ? (
                <Download className="w-3.5 h-3.5" />
              ) : (
                <Camera className="w-3.5 h-3.5" />
              )}
              {primaryActionLabel}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Viewport (pb-24 clears the fixed bottom nav on mobile) */}
      <main className="max-w-7xl w-full mx-auto px-3 sm:px-6 pt-4 pb-24 lg:pb-8 flex-1 space-y-5">
        {/* Scrollable District & Language Context Strip (Not sticky to keep mobile viewport clean) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200/80">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 text-balance">
              {workspaceTitle()}
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              {district} District Cluster · Telangana · {isOnline ? 'Live Online' : 'Offline Cache'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <label htmlFor="district-select" className="text-xs font-medium text-slate-600">
                District
              </label>
              <select
                id="district-select"
                value={district}
                onChange={(e) => setDistrict(e.target.value as District)}
                className="min-h-[40px] px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              >
                {DISTRICTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-200/75 rounded-lg">
              {(
                [
                  {code: 'te', label: 'తెలుగు'},
                  {code: 'hi', label: 'हिन्दी'},
                  {code: 'en', label: 'EN'},
                ] as const
              ).map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setLanguage(lang.code)}
                  className={`min-h-[32px] px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    language === lang.code
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Offline Connectivity Banner */}
        {!isOnline && (
          <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-xl px-4 py-2.5 text-xs font-medium flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              Offline Mode — Cached diagnoses, Crop Calendar stages, Pest Guide, and Farm Khata
              remain available.
            </span>
          </div>
        )}

        {/* Segmented Sub-Navigation for Doctor Workspace */}
        {activeTab === 'doctor' && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {DOCTOR_SUBTABS.map((sub) => {
              const Icon = sub.icon;
              const isSelected = doctorSubTab === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => handleNavigate('doctor', {doctorSubTab: sub.id})}
                  className={`min-h-[44px] inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-emerald-800 text-white border-emerald-800'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{language === 'te' ? sub.telugu : sub.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Segmented Sub-Navigation for Plan Workspace */}
        {activeTab === 'plan' && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {PLAN_SUBTABS.map((sub) => {
              const Icon = sub.icon;
              const isSelected = planSubTab === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => handleNavigate('plan', {planSubTab: sub.id})}
                  className={`min-h-[44px] inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-emerald-800 text-white border-emerald-800'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{language === 'te' ? sub.telugu : sub.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Segmented Sub-Navigation for Hub Workspace */}
        {activeTab === 'hub' && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {HUB_SUBTABS.map((sub) => {
              const Icon = sub.icon;
              const isSelected = hubSubTab === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => handleNavigate('hub', {hubSubTab: sub.id})}
                  className={`min-h-[44px] inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-emerald-800 text-white border-emerald-800'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{language === 'te' ? sub.telugu : sub.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Active Workspace Views */}
        {activeTab === 'home' && (
          <HomeHubView
            district={district}
            language={language}
            isOnline={isOnline}
            onNavigate={handleNavigate}
            onOpenChat={handleOpenChat}
          />
        )}

        {activeTab === 'doctor' && (doctorSubTab === 'scanner' || doctorSubTab === 'mandi') && (
          <KisanVisionView
            district={district}
            language={language}
            isOnline={isOnline}
            scanTriggerCount={scanTriggerCount}
          />
        )}

        {activeTab === 'doctor' &&
          (doctorSubTab === 'pest_guide' || doctorSubTab === 'spray_calc') && (
            <PestAndSprayView
              mode={doctorSubTab}
              district={district}
              language={language}
              onNavigateMap={handleNavigateMap}
              onSelectMode={(mode) => setDoctorSubTab(mode)}
            />
          )}

        {activeTab === 'plan' && planSubTab === 'calendar' && (
          <CropCalendarView district={district} language={language} />
        )}

        {activeTab === 'plan' && (planSubTab === 'soil' || planSubTab === 'weather') && (
          <SmartFasalView district={district} language={language} isOnline={isOnline} />
        )}

        {activeTab === 'maphub' && (
          <MapHubView
            district={district}
            language={language}
            initialCategory={mapCategory}
          />
        )}

        {activeTab === 'hub' && hubSubTab === 'khata' && (
          <FarmKhataView district={district} language={language} />
        )}

        {activeTab === 'hub' && hubSubTab === 'schemes' && (
          <SchemesTrackerView
            district={district}
            language={language}
            onOpenChatWithQuery={handleOpenChatWithQuery}
            onNavigateMap={handleNavigateMap}
          />
        )}

        {activeTab === 'hub' && hubSubTab === 'agrilink' && (
          <AgriLinkView district={district} />
        )}

        {activeTab === 'blueprint' && <BlueprintView />}

        {/* Quiet Footer inside scroll flow so it sits cleanly above mobile bottom nav */}
        <footer className="border-t border-slate-200 pt-4 pb-2 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>RythuSethu · End-to-End Telangana Farmer Companion</span>
          <div className="flex items-center gap-4">
            <span>Doctor · Plan · AgriMap · Farm Hub</span>
            <button
              type="button"
              onClick={() => {
                setActiveTab('blueprint');
                window.scrollTo({top: 0, behavior: 'smooth'});
              }}
              className="font-medium text-emerald-800 hover:underline"
            >
              System Blueprint
            </button>
          </div>
        </footer>
      </main>

      {/* Mobile-First Fixed Bottom Navigation Bar (60px height, 5 tabs >= 48px touch targets) */}
      <nav
        aria-label="Primary Mobile Navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 h-[60px] flex items-stretch justify-around px-1"
      >
        {NAV_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleNavigate(tab.id)}
              className={`relative flex-1 min-h-[48px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                isActive ? 'text-emerald-800 font-semibold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {isActive && (
                <span className="absolute top-0 inset-x-3 h-0.5 bg-emerald-800 rounded-full" />
              )}
              <Icon className="w-5 h-5 shrink-0" />
              <span className="text-[11px] leading-tight whitespace-nowrap">
                {language === 'te' ? tab.telugu : tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Persistent Multi-Turn Floating Gemini Chatbot Drawer */}
      <ChatbotDrawer
        isOpen={chatOpen}
        onOpenChange={setChatOpen}
        district={district}
        language={language}
        isOnline={isOnline}
        initialPersona={chatPersona}
        externalPrompt={externalChatPrompt}
      />

      {/* iOS Safari Install Instructions Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl space-y-3">
            <h3 className="text-lg font-semibold text-slate-900">
              Install RythuSethu on iPhone / iPad
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              1. Tap the <strong>Share</strong> button in Safari&apos;s toolbar.
              <br />
              2. Scroll down and tap <strong>Add to Home Screen</strong> for offline field
              access.
            </p>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full rounded-lg bg-slate-100 py-2 text-sm font-medium text-slate-800 hover:bg-slate-200"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
