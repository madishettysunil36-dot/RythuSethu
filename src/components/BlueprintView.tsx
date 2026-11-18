import React from 'react';
import {Download} from 'lucide-react';

const SPEC_MARKDOWN = `# RythuSethu: End-to-End Telangana Farmer Agri-Intelligence Platform
System Architecture, Database Schema & API Contract

## 1. Executive Project Abstract
Smallholder farmers across Telangana (Warangal, Hanamkonda, Karimnagar, Khammam, Nizamabad, Nalgonda) need an end-to-end daily companion from sowing to mandi payout. RythuSethu unifies 5 mobile-first workspaces into an offline-capable Progressive Web Application (PWA):

1. Home Command Hub: Instant live status for spray weather, active Crop Calendar plots, Farm Khata net balance, and 1-tap photography cards.
2. Doctor (KisanVision + Visual Pest Atlas + Spray Calculator + Mandi Net Profit): Multimodal AI leaf diagnosis + Telugu/Hindi/English voice advisory + deterministic per-tank pesticide dosage calculator + Agmarknet/e-NAM transport-adjusted profit estimator.
3. Plan (Crop Calendar + Soil NPK Engine + 7-Day Spray Alerts): Sowing-to-harvest stage checklists with toggleable milestones, Soil Health Card NPK & pH crop recommender, and hyper-local rain/wind spray window guardrails.
4. AgriMap (MapHub): Google Maps Platform live discovery prioritizing Nearby Fertilizer/Seed/Pesticide Shops, Soil Labs & Rythu Vedika centers, Mandis & Grain Godowns, and Tractor/Harvester/Drone dealers with GPS anchor & turn-by-turn routes.
5. Hub (Farm Khata + Telangana Schemes & Rythu Bharosa + AgriLink P2P): Full farm income/expense/crop loan interest ledger, Telangana state & central scheme tracker with live Google Search verification, P2P machinery booking, and zero-commission direct F2B harvest auctions.

## 2. System Architecture
- Client Layer: React 19 + TypeScript + Tailwind CSS v4 + VitePWA (Workbox offline asset precache + localStorage offline state cache) + Web Speech API (te-IN / hi-IN / en-IN STT & TTS) + @vis.gl/react-google-maps.
- API & Inference Gateway: Node.js + Express REST API (\`/api/vision/*\`, \`/api/chat\`, \`/api/pests\`, \`/api/calendar\`, \`/api/schemes\`, \`/api/khata\`, \`/api/mandi/*\`, \`/api/smartfasal/*\`, \`/api/agrilink/*\`, \`/api/maps/config\`).
- AI Engine: Server-side Google GenAI SDK (\`gemini-4-hydrogen\`, \`gemini-3.1-flash-lite\`) with exponential-backoff retry + fallback, structured JSON schemas, and Google Search grounding.

## 3. Core Database Schema (Document / Persistent Store)
- CropScan: { id, createdAt, cropDetected, diseaseName, localName, severity, confidencePercent, organicTreatment, chemicalTreatment, localizedSummary }
- CropSchedule: { id, crop, variety, district, sowingDate, acres, completedStageIds[] }
- FarmerScheme: { id, name, teluguName, authority, benefitSummary, eligibility, documentsRequired[], status, updatedAt }
- KhataEntry: { id, type ('income' | 'input_cost' | 'loan' | 'subsidy'), title, crop, amountInr, date, counterparty, interestRatePercent, tenureMonths }
- EquipmentBooking: { id, equipmentId, farmerName, acres, scheduledDate, totalAmountInr, weatherRiskFlag, status, upiRef, paymentStatus }
- F2BHarvestListing: { id, farmerName, village, district, crop, variety, quantityQuintals, expectedHarvestDate, askingPrice, bids[] }
`;

export const BlueprintView: React.FC = () => {
  const downloadSpec = () => {
    const blob = new Blob([SPEC_MARKDOWN], {type: 'text/markdown;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'RythuSethu_Architecture_Spec.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs text-slate-500">
            End-to-End Platform Documentation Package
          </p>
          <h2 className="text-xl font-semibold text-slate-900 mt-0.5">
            System Architecture, Database Schema & API Contract
          </h2>
        </div>
        <button
          type="button"
          onClick={downloadSpec}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg transition-colors whitespace-nowrap"
        >
          <Download className="w-4 h-4" />
          Download Architecture Spec (.md)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
          <div className="text-xs font-mono text-emerald-800 font-semibold">
            01. Doctor & Spray Pipeline
          </div>
          <h3 className="text-base font-bold text-slate-900">
            Leaf Pathology, Tank Math & Mandi Profit
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Multimodal leaf diagnosis (<code className="font-mono text-slate-900">POST /api/vision/diagnose</code>)
            paired with a Telangana Visual Pest Atlas (<code className="font-mono text-slate-900">GET /api/pests</code>),
            deterministic per-tank ml/gram dosage calculator, and transport-adjusted mandi net profit math.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
          <div className="text-xs font-mono text-emerald-800 font-semibold">
            02. Plan & Weather Pipeline
          </div>
          <h3 className="text-base font-bold text-slate-900">
            Crop Calendar, Soil NPK & Spray Guardrails
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Persists plot sowing dates and stage completion (<code className="font-mono text-slate-900">/api/calendar</code>),
            runs Soil Health Card N-P-K recommendations (<code className="font-mono text-slate-900">/api/smartfasal/recommend</code>),
            and enforces 7-day rain and wind spray guardrails.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
          <div className="text-xs font-mono text-emerald-800 font-semibold">
            03. AgriMap & Farmer Hub
          </div>
          <h3 className="text-base font-bold text-slate-900">
            Nearby Agro-Shops, Khata & Schemes
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Uses Google Maps Places + Routes APIs to locate nearby fertilizer/seed dealers, soil labs,
            and mandis from GPS or district centers, alongside Farm Khata (<code className="font-mono text-slate-900">/api/khata</code>),
            Telangana Schemes (<code className="font-mono text-slate-900">/api/schemes</code>), and P2P AgriLink.
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="text-base font-semibold text-slate-900 pb-3 border-b border-slate-200">
          REST API & Persistent Data Collections
        </h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                <th className="py-2 pr-4">Endpoint</th>
                <th className="py-2 px-4">Workspace</th>
                <th className="py-2 px-4">Schema / Entity</th>
                <th className="py-2 pl-4">Purpose</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="py-2.5 pr-4 font-mono text-slate-900">POST /api/vision/diagnose</td>
                <td className="py-2.5 px-4">Doctor</td>
                <td className="py-2.5 px-4 font-mono text-slate-600">LeafDiagnosis</td>
                <td className="py-2.5 pl-4 text-slate-600">
                  Gemini Vision leaf pathology, dosage & Telugu/Hindi summary
                </td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-mono text-slate-900">GET /api/pests</td>
                <td className="py-2.5 px-4">Doctor</td>
                <td className="py-2.5 px-4 font-mono text-slate-600">PestGuideItem</td>
                <td className="py-2.5 pl-4 text-slate-600">
                  Telangana visual pest atlas with pre-harvest intervals & spray dosage constants
                </td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-mono text-slate-900">GET / POST / PATCH /api/calendar</td>
                <td className="py-2.5 px-4">Plan</td>
                <td className="py-2.5 px-4 font-mono text-slate-600">CropSchedule</td>
                <td className="py-2.5 pl-4 text-slate-600">
                  Sowing-to-harvest stage alerts & completed milestone persistence
                </td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-mono text-slate-900">POST /api/smartfasal/recommend</td>
                <td className="py-2.5 px-4">Plan</td>
                <td className="py-2.5 px-4 font-mono text-slate-600">SmartFasalAdvice</td>
                <td className="py-2.5 pl-4 text-slate-600">
                  Soil Health Card NPK & season crop ranking + fertilizer savings
                </td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-mono text-slate-900">GET / PATCH /api/schemes</td>
                <td className="py-2.5 px-4">Hub</td>
                <td className="py-2.5 px-4 font-mono text-slate-600">FarmerScheme</td>
                <td className="py-2.5 pl-4 text-slate-600">
                  Telangana Rythu Bharosa, Bima & PM-KISAN status tracker + live web check
                </td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-mono text-slate-900">GET / POST / DELETE /api/khata</td>
                <td className="py-2.5 px-4">Hub</td>
                <td className="py-2.5 px-4 font-mono text-slate-600">KhataEntry</td>
                <td className="py-2.5 pl-4 text-slate-600">
                  Harvest sales, input expenses, subsidy DBT & crop loan interest ledger
                </td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-mono text-slate-900">POST / PATCH /api/agrilink/bookings</td>
                <td className="py-2.5 px-4">Hub</td>
                <td className="py-2.5 px-4 font-mono text-slate-600">EquipmentBooking</td>
                <td className="py-2.5 pl-4 text-slate-600">
                  P2P machinery booking with weather-delay reschedule & direct F2B buyer bids
                </td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-mono text-slate-900">POST /api/chat</td>
                <td className="py-2.5 px-4">Floating AI</td>
                <td className="py-2.5 px-4 font-mono text-slate-600">ChatTurn</td>
                <td className="py-2.5 pl-4 text-slate-600">
                  Free-tier Gemini Hydrogen / Flash Lite chatbot with Google Search grounding
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
