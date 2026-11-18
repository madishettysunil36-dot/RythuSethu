export type District =
  | 'Warangal'
  | 'Hanamkonda'
  | 'Karimnagar'
  | 'Khammam'
  | 'Nizamabad'
  | 'Nalgonda';

export type LanguageCode = 'en' | 'te' | 'hi';

export type WorkspaceTab =
  | 'home'
  | 'doctor'
  | 'plan'
  | 'maphub'
  | 'hub'
  | 'blueprint';

export type DoctorSubTab = 'scanner' | 'pest_guide' | 'spray_calc' | 'mandi';
export type PlanSubTab = 'calendar' | 'soil' | 'weather';
export type HubSubTab = 'khata' | 'schemes' | 'agrilink';

export type ChatRolePersona = 'crop_doctor' | 'mandi_scheme' | 'soil_irrigation';

export type ChatModelTier = 'hydrogen' | 'flash-lite';

export interface GroundingSource {
  uri: string;
  title: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  modelUsed?: string;
  groundingSources?: GroundingSource[];
}

export type MapCategory =
  | 'agro_shops'
  | 'soil_labs'
  | 'mandis_storage'
  | 'machinery_dealers';

export interface LeafDiagnosis {
  id: string;
  createdAt: string;
  cropDetected: string;
  diseaseName: string;
  localName: string;
  severity: 'Low' | 'Moderate' | 'High';
  confidencePercent: number;
  symptomsObserved: string[];
  organicTreatment: {
    agent: string;
    dosage: string;
    applicationMethod: string;
  };
  chemicalTreatment: {
    molecule: string;
    dosage: string;
    preHarvestIntervalDays: number;
    safetyNote: string;
  };
  preventiveSteps: string[];
  localizedSummary: string;
  language: LanguageCode;
  imagePreview?: string;
}

export interface MandiPriceRecord {
  id: string;
  marketName: string;
  district: District | string;
  crop: string;
  variety: string;
  minPricePerQuintal: number;
  modalPricePerQuintal: number;
  maxPricePerQuintal: number;
  arrivalsQuintals: number;
  trend7d: number[];
  distanceByDistrictKm: Record<District, number>;
  updatedAt: string;
}

export interface VoiceTurn {
  id: string;
  role: 'farmer' | 'advisor';
  text: string;
  language: LanguageCode;
  timestamp: string;
}

export interface SoilProfileInput {
  district: District;
  season: 'Kharif' | 'Rabi' | 'Yasangi';
  soilType: 'Black Cotton' | 'Red Loam' | 'Sandy Loam';
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  ph: number;
  acres: number;
}

export interface CropRecommendation {
  cropName: string;
  variety: string;
  suitabilityScore: number;
  expectedYieldQuintalsPerAcre: number;
  estimatedNetProfitPerAcre: number;
  npkAdjustment: string;
  waterRequirement: string;
  reason: string;
}

export interface SmartFasalAdvice {
  recommendations: CropRecommendation[];
  soilHealthSummary: string;
  fertilizerSavingsNote: string;
  sprayAdvisory: string;
}

export interface WeatherDay {
  date: string;
  dayLabel: string;
  tempMinC: number;
  tempMaxC: number;
  humidityPercent: number;
  windKmh: number;
  rainProbabilityPercent: number;
  rainfallMm: number;
  sprayStatus: 'Safe' | 'Caution' | 'Hold';
  sprayReason: string;
  irrigationAdvice: string;
}

export interface FarmCostEntry {
  id: string;
  crop: string;
  category: 'Seeds' | 'Fertilizer' | 'Pesticide' | 'Labor' | 'Irrigation' | 'Machinery';
  description: string;
  amountInr: number;
  acres: number;
  date: string;
}

export interface EquipmentListing {
  id: string;
  name: string;
  category: 'Tractor' | 'Agri-Drone' | 'Harvester' | 'Tiller';
  ownerName: string;
  village: string;
  district: District;
  distanceKmByDistrict: Record<District, number>;
  ratePerHourInr: number;
  ratePerAcreInr: number;
  suggestedDynamicRateInr: number;
  dynamicPricingNote: string;
  availableDates: string[];
  imageUrl: string;
  specs: string;
}

export interface EquipmentBooking {
  id: string;
  equipmentId: string;
  equipmentName: string;
  farmerName: string;
  acres: number;
  scheduledDate: string;
  totalAmountInr: number;
  weatherRiskFlag: boolean;
  weatherNote: string;
  status: 'Confirmed' | 'Weather Rescheduled' | 'Completed';
  upiRef: string;
  paymentStatus: 'Pending UPI' | 'Paid via UPI';
}

export interface F2BBid {
  id: string;
  buyerName: string;
  buyerType: 'Wholesaler' | 'Food Processor' | 'Hostel / Institutional' | 'Retail Chain';
  pricePerQuintalInr: number;
  quantityQuintals: number;
  note: string;
  createdAt: string;
  status: 'Open' | 'Accepted';
}

export interface F2BHarvestListing {
  id: string;
  farmerName: string;
  village: string;
  district: District;
  crop: string;
  variety: string;
  quantityQuintals: number;
  expectedHarvestDate: string;
  askingPricePerQuintalInr: number;
  mandiReferencePriceInr: number;
  grade: string;
  bids: F2BBid[];
}

export type CalendarCropName = 'Paddy' | 'Cotton' | 'Chili' | 'Turmeric' | 'Maize';

export interface CropStageTemplate {
  id: string;
  dayStart: number;
  dayEnd: number;
  stageName: string;
  teluguStage: string;
  hindiStage: string;
  keyAction: string;
  fertilizerTip: string;
  irrigationTip: string;
}

export interface CropCalendarTemplate {
  crop: CalendarCropName;
  defaultVariety: string;
  durationDays: number;
  stages: CropStageTemplate[];
}

export interface CropSchedule {
  id: string;
  crop: CalendarCropName;
  variety: string;
  sowingDate: string;
  acres: number;
  district: District;
  completedStageIds: string[];
  createdAt: string;
}

export type SchemeStatus = 'not_checked' | 'eligible' | 'applied' | 'received';

export interface FarmerScheme {
  id: string;
  name: string;
  teluguName: string;
  hindiName: string;
  authority: 'Telangana State' | 'Central Govt' | 'Joint State-Center';
  benefitSummary: string;
  benefitAmountLabel: string;
  eligibilityRules: string[];
  requiredDocs: string[];
  searchPrompt: string;
  status: SchemeStatus;
  updatedAt?: string;
}

export interface PestGuideItem {
  id: string;
  crop: string;
  pestName: string;
  teluguName: string;
  hindiName: string;
  category: 'Fungal Disease' | 'Sucking Pest' | 'Borer / Larva' | 'Viral Vector';
  riskLevel: 'High' | 'Moderate';
  imageUrl: string;
  symptoms: string;
  organicControl: string;
  chemicalMolecule: string;
  dosePerLiter: number;
  doseUnit: 'ml/L' | 'g/L';
  waterLitersPerAcre: number;
  phiDays: number;
  safetyNote: string;
}

export interface SprayPreset {
  label: string;
  chemicalName: string;
  dosePerLiter: number;
  doseUnit: 'ml/L' | 'g/L';
  waterLitersPerAcre: number;
  phiDays: number;
  safetyNote: string;
}

export type KhataEntryType = 'income' | 'input_cost' | 'loan' | 'subsidy';

export interface KhataEntry {
  id: string;
  type: KhataEntryType;
  title: string;
  crop: string;
  amountInr: number;
  date: string;
  counterparty?: string;
  interestRatePercent?: number;
  tenureMonths?: number;
  notes?: string;
}
