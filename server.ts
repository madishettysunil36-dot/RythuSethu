import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {createServer as createViteServer} from 'vite';
import {GoogleGenAI, Type} from '@google/genai';
import {
  CROP_CALENDAR_TEMPLATES,
  DISTRICTS,
  INITIAL_BOOKINGS,
  INITIAL_COST_ENTRIES,
  INITIAL_CROP_SCHEDULES,
  INITIAL_EQUIPMENT,
  INITIAL_F2B_LISTINGS,
  INITIAL_KHATA_ENTRIES,
  INITIAL_SCANS,
  INITIAL_SCHEMES,
  MANDI_PRICES,
  PEST_ATLAS,
  getDistrictWeather,
} from './server/data.ts';
import type {
  CalendarCropName,
  ChatModelTier,
  ChatRolePersona,
  CropSchedule,
  District,
  EquipmentBooking,
  EquipmentListing,
  F2BHarvestListing,
  FarmCostEntry,
  FarmerScheme,
  GroundingSource,
  KhataEntry,
  KhataEntryType,
  LanguageCode,
  LeafDiagnosis,
  SchemeStatus,
  SmartFasalAdvice,
  SoilProfileInput,
} from './src/types/agri.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORE_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(STORE_DIR, 'store.json');

interface StoreState {
  scans: LeafDiagnosis[];
  costs: FarmCostEntry[];
  equipment: EquipmentListing[];
  bookings: EquipmentBooking[];
  f2bListings: F2BHarvestListing[];
  cropSchedules: CropSchedule[];
  schemeStatuses: Record<string, {status: SchemeStatus; updatedAt?: string}>;
  khataEntries: KhataEntry[];
}

function loadStore(): StoreState {
  const defaultSchemeStatuses: Record<string, {status: SchemeStatus; updatedAt?: string}> = {};
  for (const s of INITIAL_SCHEMES) {
    defaultSchemeStatuses[s.id] = {status: s.status, updatedAt: s.updatedAt};
  }

  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<StoreState>;
      return {
        scans: parsed.scans ?? INITIAL_SCANS,
        costs: parsed.costs ?? INITIAL_COST_ENTRIES,
        equipment: parsed.equipment ?? INITIAL_EQUIPMENT,
        bookings: parsed.bookings ?? INITIAL_BOOKINGS,
        f2bListings: parsed.f2bListings ?? INITIAL_F2B_LISTINGS,
        cropSchedules: parsed.cropSchedules ?? INITIAL_CROP_SCHEDULES,
        schemeStatuses: parsed.schemeStatuses ?? defaultSchemeStatuses,
        khataEntries: parsed.khataEntries ?? INITIAL_KHATA_ENTRIES,
      };
    }
  } catch (err) {
    console.warn('Could not read store.json, using initial datasets:', err);
  }
  return {
    scans: [...INITIAL_SCANS],
    costs: [...INITIAL_COST_ENTRIES],
    equipment: [...INITIAL_EQUIPMENT],
    bookings: [...INITIAL_BOOKINGS],
    f2bListings: [...INITIAL_F2B_LISTINGS],
    cropSchedules: [...INITIAL_CROP_SCHEDULES],
    schemeStatuses: defaultSchemeStatuses,
    khataEntries: [...INITIAL_KHATA_ENTRIES],
  };
}

function saveStore(state: StoreState) {
  try {
    fs.mkdirSync(STORE_DIR, {recursive: true});
    fs.writeFileSync(STORE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Failed to persist store.json:', err);
  }
}

const store = loadStore();

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please add your Gemini API key in Settings > Secrets.',
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function languageName(code: LanguageCode): string {
  if (code === 'te') return 'Telugu (written in clear, everyday Telugu script)';
  if (code === 'hi') return 'Hindi (written in clear, everyday Devanagari script)';
  return 'simple, practical Indian agricultural English';
}

function parseApiError(err: unknown): {status: number; message: string; isTransient: boolean} {
  const rawMessage = err instanceof Error ? err.message : String(err ?? 'Unknown AI error');
  let status =
    typeof err === 'object' && err !== null && 'status' in err
      ? Number((err as {status?: unknown}).status) || 500
      : 500;
  let message = rawMessage;

  const jsonStart = rawMessage.indexOf('{');
  if (jsonStart !== -1) {
    try {
      const parsed = JSON.parse(rawMessage.slice(jsonStart)) as {
        error?: {code?: number; message?: string; status?: string};
      };
      if (parsed?.error) {
        if (parsed.error.code) status = Number(parsed.error.code);
        if (parsed.error.message) message = parsed.error.message;
      }
    } catch {
      // Keep rawMessage if JSON slice is incomplete
    }
  }

  const lower = `${rawMessage} ${message}`.toLowerCase();
  const isTransient =
    status === 503 ||
    status === 429 ||
    status === 502 ||
    status === 504 ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('resource_exhausted') ||
    lower.includes('econnreset') ||
    lower.includes('etimedout');

  if (status === 403 || status === 400 || lower.includes('api_key_invalid') || lower.includes('permission_denied')) {
    return {
      status,
      isTransient: false,
      message: 'Gemini API key issue detected. Please check or select your key in Settings > Secrets.',
    };
  }

  if (status === 503 || lower.includes('high demand') || lower.includes('unavailable')) {
    return {
      status: 503,
      isTransient: true,
      message: 'The AI model is experiencing temporary high demand. Please retry in a few seconds.',
    };
  }

  return {status, message, isTransient};
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateFreeTierWithRetry(
  ai: GoogleGenAI,
  params: Omit<Parameters<GoogleGenAI['models']['generateContent']>[0], 'model'>,
  options?: {
    preferredModel?: 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite';
    useSearchGrounding?: boolean;
  },
) {
  const preferred = options?.useSearchGrounding
    ? 'gemini-4-hydrogen'
    : (options?.preferredModel ?? 'gemini-4-hydrogen');

  const modelPlan: Array<{model: string; attempts: number; stripTools?: boolean}> =
    preferred === 'gemini-3.1-flash-lite'
      ? [
          {model: 'gemini-3.1-flash-lite', attempts: 3},
          {model: 'gemini-4-hydrogen', attempts: 2},
        ]
      : [
          {model: 'gemini-4-hydrogen', attempts: 3},
          {model: 'gemini-3.1-flash-lite', attempts: 2, stripTools: Boolean(options?.useSearchGrounding)},
        ];

  let lastError: unknown;

  for (const stage of modelPlan) {
    for (let attempt = 1; attempt <= stage.attempts; attempt++) {
      try {
        const nextConfig =
          stage.stripTools && params.config
            ? {...params.config, tools: undefined}
            : params.config;
        const response = await ai.models.generateContent({
          ...params,
          config: nextConfig,
          model: stage.model,
        });
        return {response, modelUsed: stage.model};
      } catch (err) {
        lastError = err;
        const parsed = parseApiError(err);
        if (!parsed.isTransient) {
          throw err;
        }
        const jitter = Math.floor(Math.random() * 300);
        const delayMs = Math.min(8000, 600 * Math.pow(2, attempt - 1) + jitter);
        console.warn(
          `Transient ${parsed.status} on ${stage.model} (attempt ${attempt}/${stage.attempts}); retrying in ${delayMs}ms...`,
        );
        await sleep(delayMs);
      }
    }
  }

  throw lastError;
}

async function generateWithRetryAndFallback(
  ai: GoogleGenAI,
  params: Omit<Parameters<GoogleGenAI['models']['generateContent']>[0], 'model'>,
) {
  const {response} = await generateFreeTierWithRetry(ai, params);
  return response;
}

function sendGeminiError(res: express.Response, err: unknown, logPrefix: string) {
  const parsed = parseApiError(err);
  console.error(`${logPrefix}:`, err);
  if (parsed.status === 503 || parsed.status === 429) {
    res.setHeader('Retry-After', '3');
  }
  return res.status(parsed.status).json({error: parsed.message});
}

function getPersonaInstruction(
  persona: ChatRolePersona,
  district: District,
  language: LanguageCode,
): string {
  const baseLang = `Always respond in ${languageName(language)}. Keep formatting clean and mobile-friendly for farmers in ${district}, Telangana.`;
  if (persona === 'mandi_scheme') {
    return `You are RythuSethu Mandi & Scheme Advisor. Help Telangana farmers understand MSP rates, Enumamula/Karimnagar/Nizamabad/Khammam mandi trends, transport break-even tips, and government schemes like Rythu Bharosa, Rythu Bima, PM-KISAN, and crop insurance. ${baseLang}`;
  }
  if (persona === 'soil_irrigation') {
    return `You are RythuSethu Soil & Irrigation Planner calibrated to PJTSAU Telangana Soil Health Card norms. Advise clearly on NPK dosages, Black Cotton vs Red Loam irrigation timing, and wind/rain spray safety. ${baseLang}`;
  }
  return `You are RythuSethu Crop Doctor, an approachable Telangana agronomy assistant trained on PJTSAU advisories for Paddy, Cotton, Chili, Turmeric, and Maize. Provide exact organic and chemical dosages per liter of water and per acre, plus safety pre-harvest intervals. ${baseLang}`;
}

async function startServer() {
  const app = express();
  app.use(express.json({limit: '12mb'}));

  app.get('/api/health', (_req, res) => {
    res.json({ok: true, service: 'RythuSethu API'});
  });

  app.get('/api/maps/config', (_req, res) => {
    const apiKey =
      process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
    res.json({apiKey});
  });

  // Multi-turn Free-Tier Gemini Chatbot with optional Google Search Grounding
  app.post('/api/chat', async (req, res) => {
    try {
      const {
        messages = [],
        rolePersona = 'crop_doctor',
        modelTier = 'hydrogen',
        useSearchGrounding = false,
        district = 'Warangal',
        language = 'te',
      } = req.body as {
        messages: Array<{role: 'user' | 'model'; text: string}>;
        rolePersona?: ChatRolePersona;
        modelTier?: ChatModelTier;
        useSearchGrounding?: boolean;
        district?: District;
        language?: LanguageCode;
      };

      const cleanMessages = messages
        .filter((m) => m && typeof m.text === 'string' && m.text.trim().length > 0)
        .slice(-14);

      if (cleanMessages.length === 0) {
        return res.status(400).json({error: 'Message history cannot be empty.'});
      }

      const ai = getGeminiClient();
      const preferredModel: 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite' =
        useSearchGrounding || modelTier !== 'flash-lite'
          ? 'gemini-4-hydrogen'
          : 'gemini-3.1-flash-lite';

      const contents = cleanMessages.map((m) => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{text: m.text.trim()}],
      }));

      const {response, modelUsed} = await generateFreeTierWithRetry(
        ai,
        {
          contents,
          config: {
            systemInstruction: getPersonaInstruction(rolePersona, district, language),
            ...(useSearchGrounding ? {tools: [{googleSearch: {}}]} : {}),
          },
        },
        {
          preferredModel,
          useSearchGrounding,
        },
      );

      const reply = (response.text ?? '').trim();
      if (!reply) {
        throw new Error('Empty reply received from RythuSethu AI.');
      }

      const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const seenUris = new Set<string>();
      const groundingSources: GroundingSource[] = [];
      for (const chunk of rawChunks) {
        const uri = chunk?.web?.uri;
        if (uri && !seenUris.has(uri)) {
          seenUris.add(uri);
          groundingSources.push({
            uri,
            title: chunk.web?.title || uri,
          });
        }
      }

      res.json({reply, modelUsed, groundingSources});
    } catch (err: unknown) {
      sendGeminiError(res, err, 'RythuSethu chat error');
    }
  });

  // 1. KisanVision: Real Gemini Vision Leaf Disease & Pest Diagnosis
  app.get('/api/vision/scans', (_req, res) => {
    res.json({scans: store.scans});
  });

  app.post('/api/vision/diagnose', async (req, res) => {
    try {
      const {
        imageBase64,
        mimeType = 'image/jpeg',
        sampleAssetPath,
        cropHint = 'Auto-detect',
        language = 'en',
        district = 'Warangal',
      } = req.body as {
        imageBase64?: string;
        mimeType?: string;
        sampleAssetPath?: string;
        cropHint?: string;
        language?: LanguageCode;
        district?: District;
      };

      let resolvedBase64 = imageBase64;
      let resolvedMime = mimeType;

      if (!resolvedBase64 && sampleAssetPath) {
        const cleanRel = sampleAssetPath.replace(/^\/+/, '');
        const resolvedFile = path.resolve(__dirname, cleanRel);
        const allowedDir = path.resolve(__dirname, 'src/assets/images');
        if (!resolvedFile.startsWith(allowedDir) || !fs.existsSync(resolvedFile)) {
          return res.status(400).json({error: 'Sample leaf specimen image not found.'});
        }
        resolvedBase64 = fs.readFileSync(resolvedFile).toString('base64');
        resolvedMime = 'image/jpeg';
      }

      if (!resolvedBase64) {
        return res.status(400).json({error: 'Please upload or select a crop leaf image.'});
      }

      const cleanBase64 = resolvedBase64.includes(',')
        ? resolvedBase64.split(',')[1]
        : resolvedBase64;

      const ai = getGeminiClient();
      const response = await generateWithRetryAndFallback(ai, {
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: resolvedMime,
                data: cleanBase64,
              },
            },
            {
              text: `Analyze this crop image for a farmer in ${district}, Telangana, India.
Crop hint provided by farmer: ${cropHint}.
Provide an accurate plant pathology / entomology diagnosis, exact organic and chemical treatment dosages (per liter of water and per acre), preventive steps, and a concise localizedSummary written in ${languageName(language)}.
Keep localName in Telugu or regional vernacular alongside transliteration if helpful.`,
            },
          ],
        },
        config: {
          systemInstruction:
            'You are an expert ICAR / PJTSAU (Professor Jayashankar Telangana State Agricultural University) plant pathologist and entomologist advising smallholder farmers in Telangana.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              cropDetected: {type: Type.STRING},
              diseaseName: {type: Type.STRING},
              localName: {type: Type.STRING},
              severity: {type: Type.STRING, enum: ['Low', 'Moderate', 'High']},
              confidencePercent: {type: Type.INTEGER},
              symptomsObserved: {
                type: Type.ARRAY,
                items: {type: Type.STRING},
              },
              organicTreatment: {
                type: Type.OBJECT,
                properties: {
                  agent: {type: Type.STRING},
                  dosage: {type: Type.STRING},
                  applicationMethod: {type: Type.STRING},
                },
                required: ['agent', 'dosage', 'applicationMethod'],
              },
              chemicalTreatment: {
                type: Type.OBJECT,
                properties: {
                  molecule: {type: Type.STRING},
                  dosage: {type: Type.STRING},
                  preHarvestIntervalDays: {type: Type.INTEGER},
                  safetyNote: {type: Type.STRING},
                },
                required: ['molecule', 'dosage', 'preHarvestIntervalDays', 'safetyNote'],
              },
              preventiveSteps: {
                type: Type.ARRAY,
                items: {type: Type.STRING},
              },
              localizedSummary: {type: Type.STRING},
            },
            required: [
              'cropDetected',
              'diseaseName',
              'localName',
              'severity',
              'confidencePercent',
              'symptomsObserved',
              'organicTreatment',
              'chemicalTreatment',
              'preventiveSteps',
              'localizedSummary',
            ],
          },
        },
      });

      const rawJson = (response.text ?? '').trim();
      if (!rawJson) {
        throw new Error('Empty diagnosis received from Gemini model.');
      }
      const parsed = JSON.parse(rawJson);

      const diagnosis: LeafDiagnosis = {
        id: `scan-${Date.now()}`,
        createdAt: new Date().toISOString(),
        ...parsed,
        language,
        imagePreview: sampleAssetPath || undefined,
      };

      store.scans = [diagnosis, ...store.scans].slice(0, 20);
      saveStore(store);

      res.json({diagnosis});
    } catch (err: unknown) {
      sendGeminiError(res, err, 'Vision diagnose error');
    }
  });

  // 2. KisanVision: Voice & Text Multilingual Assistant
  app.post('/api/assistant/ask', async (req, res) => {
    try {
      const {
        question,
        language = 'te',
        district = 'Warangal',
        recentDiagnosis,
      } = req.body as {
        question: string;
        language?: LanguageCode;
        district?: District;
        recentDiagnosis?: string;
      };

      if (!question?.trim()) {
        return res.status(400).json({error: 'Question cannot be empty.'});
      }

      const ai = getGeminiClient();
      const response = await generateWithRetryAndFallback(ai, {
        contents: `Farmer District: ${district}, Telangana.
${recentDiagnosis ? `Recent Leaf Scan Context: ${recentDiagnosis}` : ''}
Farmer Question: ${question}

Respond strictly in ${languageName(language)} in 3 to 5 clear, actionable sentences suitable to be read aloud over voice assistant.`,
        config: {
          systemInstruction:
            'You are RythuSethu Voice Advisor, a practical Telugu/Hindi/English agronomy assistant trained on Telangana PJTSAU crop advisories, Agmarknet mandi trends, and safe pesticide dosages. Avoid markdown formatting like asterisks or hashes since your answer will be spoken aloud via Text-to-Speech.',
        },
      });

      const answer = (response.text ?? '').trim();
      if (!answer) {
        throw new Error('Empty response received from voice advisor.');
      }
      res.json({answer, language});
    } catch (err: unknown) {
      sendGeminiError(res, err, 'Assistant error');
    }
  });

  // 3. KisanVision: Live Mandi Price Tracker
  app.get('/api/mandi/prices', (req, res) => {
    const cropFilter = (req.query.crop as string) || 'All';
    const district = (req.query.district as District) || 'Warangal';
    const validDistrict = DISTRICTS.includes(district) ? district : 'Warangal';

    const records = MANDI_PRICES.filter((m) =>
      cropFilter === 'All' ? true : m.crop.toLowerCase().includes(cropFilter.toLowerCase()),
    ).map((m) => ({
      ...m,
      distanceKm: m.distanceByDistrictKm[validDistrict] ?? 50,
    }));

    res.json({district: validDistrict, records});
  });

  // 4. Visual Pest Atlas
  app.get('/api/pests', (_req, res) => {
    res.json({pests: PEST_ATLAS});
  });

  // 5. SmartFasal: Weather Forecast + AI Soil & Crop Recommender
  app.get('/api/smartfasal/weather', (req, res) => {
    const district = (req.query.district as District) || 'Warangal';
    const validDistrict = DISTRICTS.includes(district) ? district : 'Warangal';
    res.json({
      district: validDistrict,
      days: getDistrictWeather(validDistrict),
    });
  });

  app.post('/api/smartfasal/recommend', async (req, res) => {
    try {
      const input = req.body as SoilProfileInput;
      const weather = getDistrictWeather(input.district);
      const rainDays = weather.filter((d) => d.rainProbabilityPercent >= 50).map((d) => d.dayLabel);

      const ai = getGeminiClient();
      const response = await generateWithRetryAndFallback(ai, {
        contents: `Evaluate this Telangana farmer's Soil Health Card & farm profile:
- District: ${input.district}
- Season: ${input.season}
- Soil Type: ${input.soilType}
- Nitrogen (N): ${input.nitrogen} kg/ha
- Phosphorus (P): ${input.phosphorus} kg/ha
- Potassium (K): ${input.potassium} kg/ha
- Soil pH: ${input.ph}
- Cultivated Area: ${input.acres} acres
- 7-Day Weather Summary: High rain/wind spray-hold expected on ${rainDays.length ? rainDays.join(', ') : 'none'}.

Return the top 3 profitable, sustainable crops for ${input.district} in ${input.season}, exact NPK fertilizer correction to avoid waste, expected yield (quintals/acre), realistic net profit per acre (INR), and spray advisory.`,
        config: {
          systemInstruction:
            'You are SmartFasal Agronomy Engine calibrated for Telangana Soil Health Card standards (PJTSAU benchmarks). Be quantitatively realistic with Indian yields (quintals/acre) and net INR profit.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              soilHealthSummary: {type: Type.STRING},
              fertilizerSavingsNote: {type: Type.STRING},
              sprayAdvisory: {type: Type.STRING},
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    cropName: {type: Type.STRING},
                    variety: {type: Type.STRING},
                    suitabilityScore: {type: Type.INTEGER},
                    expectedYieldQuintalsPerAcre: {type: Type.NUMBER},
                    estimatedNetProfitPerAcre: {type: Type.INTEGER},
                    npkAdjustment: {type: Type.STRING},
                    waterRequirement: {type: Type.STRING},
                    reason: {type: Type.STRING},
                  },
                  required: [
                    'cropName',
                    'variety',
                    'suitabilityScore',
                    'expectedYieldQuintalsPerAcre',
                    'estimatedNetProfitPerAcre',
                    'npkAdjustment',
                    'waterRequirement',
                    'reason',
                  ],
                },
              },
            },
            required: [
              'soilHealthSummary',
              'fertilizerSavingsNote',
              'sprayAdvisory',
              'recommendations',
            ],
          },
        },
      });

      const raw = (response.text ?? '').trim();
      if (!raw) {
        throw new Error('Empty recommendation returned from SmartFasal AI.');
      }
      const advice = JSON.parse(raw) as SmartFasalAdvice;
      res.json({advice});
    } catch (err: unknown) {
      sendGeminiError(res, err, 'SmartFasal error');
    }
  });

  // 6. SmartFasal: Farm Cost & ROI Ledger
  app.get('/api/smartfasal/costs', (_req, res) => {
    res.json({costs: store.costs});
  });

  app.post('/api/smartfasal/costs', (req, res) => {
    const {crop, category, description, amountInr, acres, date} = req.body as Omit<
      FarmCostEntry,
      'id'
    >;
    if (!crop || !category || !amountInr || amountInr <= 0) {
      return res.status(400).json({error: 'Valid crop, category, and positive amount required.'});
    }
    const entry: FarmCostEntry = {
      id: `cost-${Date.now()}`,
      crop,
      category,
      description: description || category,
      amountInr: Number(amountInr),
      acres: Number(acres) || 1,
      date: date || new Date().toISOString().slice(0, 10),
    };
    store.costs = [entry, ...store.costs];
    saveStore(store);
    res.status(201).json({entry});
  });

  app.delete('/api/smartfasal/costs/:id', (req, res) => {
    store.costs = store.costs.filter((c) => c.id !== req.params.id);
    saveStore(store);
    res.json({ok: true});
  });

  // 7. Crop Calendar & Stage Alerts
  app.get('/api/calendar', (_req, res) => {
    res.json({
      templates: CROP_CALENDAR_TEMPLATES,
      schedules: store.cropSchedules,
    });
  });

  app.post('/api/calendar', (req, res) => {
    const {crop, variety, sowingDate, acres, district = 'Warangal'} = req.body as {
      crop: CalendarCropName;
      variety?: string;
      sowingDate: string;
      acres: number;
      district?: District;
    };
    const template = CROP_CALENDAR_TEMPLATES.find((t) => t.crop === crop);
    if (!template || !sowingDate || !acres || acres <= 0) {
      return res.status(400).json({error: 'Valid crop, sowing date, and positive acres required.'});
    }
    const schedule: CropSchedule = {
      id: `sched-${Date.now()}`,
      crop,
      variety: variety?.trim() || template.defaultVariety,
      sowingDate,
      acres: Number(acres),
      district,
      completedStageIds: [],
      createdAt: new Date().toISOString(),
    };
    store.cropSchedules = [schedule, ...store.cropSchedules];
    saveStore(store);
    res.status(201).json({schedule});
  });

  app.patch('/api/calendar/:id/toggle', (req, res) => {
    const {stageId} = req.body as {stageId: string};
    const idx = store.cropSchedules.findIndex((s) => s.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({error: 'Crop schedule not found.'});
    }
    const cur = store.cropSchedules[idx];
    const exists = cur.completedStageIds.includes(stageId);
    const completedStageIds = exists
      ? cur.completedStageIds.filter((id) => id !== stageId)
      : [...cur.completedStageIds, stageId];
    store.cropSchedules[idx] = {...cur, completedStageIds};
    saveStore(store);
    res.json({schedule: store.cropSchedules[idx]});
  });

  app.delete('/api/calendar/:id', (req, res) => {
    store.cropSchedules = store.cropSchedules.filter((s) => s.id !== req.params.id);
    saveStore(store);
    res.json({ok: true});
  });

  // 8. Telangana Schemes & Rythu Bharosa Tracker
  app.get('/api/schemes', (_req, res) => {
    const merged: FarmerScheme[] = INITIAL_SCHEMES.map((base) => {
      const saved = store.schemeStatuses[base.id];
      return saved
        ? {...base, status: saved.status, updatedAt: saved.updatedAt ?? base.updatedAt}
        : base;
    });
    res.json({schemes: merged});
  });

  app.patch('/api/schemes/:id', (req, res) => {
    const {status} = req.body as {status: SchemeStatus};
    const valid: SchemeStatus[] = ['not_checked', 'eligible', 'applied', 'received'];
    if (!valid.includes(status)) {
      return res.status(400).json({error: 'Invalid scheme status.'});
    }
    const base = INITIAL_SCHEMES.find((s) => s.id === req.params.id);
    if (!base) {
      return res.status(404).json({error: 'Scheme not found.'});
    }
    const updatedAt = new Date().toISOString().slice(0, 10);
    store.schemeStatuses[base.id] = {status, updatedAt};
    saveStore(store);
    res.json({scheme: {...base, status, updatedAt}});
  });

  // 9. Farm Khata (Income, Input Cost, Loan & Subsidy Ledger)
  app.get('/api/khata', (_req, res) => {
    res.json({entries: store.khataEntries});
  });

  app.post('/api/khata', (req, res) => {
    const {
      type,
      title,
      crop,
      amountInr,
      date,
      counterparty,
      interestRatePercent,
      tenureMonths,
      notes,
    } = req.body as {
      type: KhataEntryType;
      title: string;
      crop: string;
      amountInr: number;
      date?: string;
      counterparty?: string;
      interestRatePercent?: number;
      tenureMonths?: number;
      notes?: string;
    };
    const validTypes: KhataEntryType[] = ['income', 'input_cost', 'loan', 'subsidy'];
    if (!validTypes.includes(type) || !title?.trim() || !amountInr || Number(amountInr) <= 0) {
      return res.status(400).json({error: 'Valid type, title, and positive Rupee amount required.'});
    }
    const entry: KhataEntry = {
      id: `kh-${Date.now()}`,
      type,
      title: title.trim(),
      crop: crop?.trim() || 'All Farm',
      amountInr: Math.round(Number(amountInr)),
      date: date || new Date().toISOString().slice(0, 10),
      counterparty: counterparty?.trim() || undefined,
      interestRatePercent:
        type === 'loan' && interestRatePercent !== undefined
          ? Number(interestRatePercent)
          : undefined,
      tenureMonths:
        type === 'loan' && tenureMonths !== undefined ? Number(tenureMonths) : undefined,
      notes: notes?.trim() || undefined,
    };
    store.khataEntries = [entry, ...store.khataEntries];
    saveStore(store);
    res.status(201).json({entry});
  });

  app.delete('/api/khata/:id', (req, res) => {
    store.khataEntries = store.khataEntries.filter((e) => e.id !== req.params.id);
    saveStore(store);
    res.json({ok: true});
  });

  // 10. AgriLink: P2P Equipment Rental & Weather-Protected Bookings
  app.get('/api/agrilink/equipment', (req, res) => {
    const district = (req.query.district as District) || 'Warangal';
    const maxKm = Number(req.query.maxKm) || 100;
    const category = (req.query.category as string) || 'All';
    const validDistrict = DISTRICTS.includes(district) ? district : 'Warangal';

    const items = store.equipment
      .map((eq) => ({
        ...eq,
        distanceKm: eq.distanceKmByDistrict[validDistrict] ?? 45,
      }))
      .filter((eq) => eq.distanceKm <= maxKm)
      .filter((eq) => (category === 'All' ? true : eq.category === category))
      .sort((a, b) => a.distanceKm - b.distanceKm);

    res.json({equipment: items, bookings: store.bookings});
  });

  app.post('/api/agrilink/bookings', (req, res) => {
    const {equipmentId, farmerName, acres, scheduledDate, district = 'Warangal'} = req.body as {
      equipmentId: string;
      farmerName: string;
      acres: number;
      scheduledDate: string;
      district?: District;
    };

    const eq = store.equipment.find((e) => e.id === equipmentId);
    if (!eq) {
      return res.status(404).json({error: 'Equipment listing not found.'});
    }
    if (!farmerName?.trim() || !acres || acres <= 0) {
      return res.status(400).json({error: 'Farmer name and valid acreage are required.'});
    }

    const forecast = getDistrictWeather(district);
    const matchingDay = forecast.find((d) => d.date === scheduledDate);
    const weatherRiskFlag = matchingDay ? matchingDay.rainProbabilityPercent >= 50 : false;
    const weatherNote = weatherRiskFlag
      ? `Rain risk (${matchingDay?.rainProbabilityPercent}%) on ${scheduledDate} — free weather reschedule active`
      : 'Clear weather window verified for scheduled operation';

    const booking: EquipmentBooking = {
      id: `bk-${Date.now().toString().slice(-5)}`,
      equipmentId: eq.id,
      equipmentName: eq.name,
      farmerName: farmerName.trim(),
      acres: Number(acres),
      scheduledDate,
      totalAmountInr: Math.round(eq.suggestedDynamicRateInr * Number(acres)),
      weatherRiskFlag,
      weatherNote,
      status: 'Confirmed',
      upiRef: `UPI-${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      paymentStatus: 'Pending UPI',
    };

    store.bookings = [booking, ...store.bookings];
    saveStore(store);
    res.status(201).json({booking});
  });

  app.patch('/api/agrilink/bookings/:id', (req, res) => {
    const {action, newDate} = req.body as {
      action: 'pay_upi' | 'weather_reschedule';
      newDate?: string;
    };
    const idx = store.bookings.findIndex((b) => b.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({error: 'Booking not found.'});
    }

    const existing = store.bookings[idx];
    if (action === 'pay_upi') {
      store.bookings[idx] = {...existing, paymentStatus: 'Paid via UPI'};
    } else if (action === 'weather_reschedule' && newDate) {
      store.bookings[idx] = {
        ...existing,
        scheduledDate: newDate,
        status: 'Weather Rescheduled',
        weatherRiskFlag: false,
        weatherNote: `Rescheduled penalty-free to dry window (${newDate})`,
      };
    }
    saveStore(store);
    res.json({booking: store.bookings[idx]});
  });

  // 11. AgriLink: Direct Farm-to-Business (F2B) Pre-Harvest Marketplace
  app.get('/api/agrilink/f2b', (_req, res) => {
    res.json({listings: store.f2bListings});
  });

  app.post('/api/agrilink/f2b', (req, res) => {
    const {
      farmerName,
      village,
      district,
      crop,
      variety,
      quantityQuintals,
      expectedHarvestDate,
      askingPricePerQuintalInr,
      grade,
    } = req.body as Omit<F2BHarvestListing, 'id' | 'bids' | 'mandiReferencePriceInr'>;

    if (!farmerName || !crop || !quantityQuintals || !askingPricePerQuintalInr) {
      return res.status(400).json({error: 'Missing required harvest listing fields.'});
    }

    const mandiRef =
      MANDI_PRICES.find((m) => m.crop.toLowerCase().includes(crop.toLowerCase().split(' ')[0]))
        ?.modalPricePerQuintal ?? Number(askingPricePerQuintalInr);

    const listing: F2BHarvestListing = {
      id: `f2b-${Date.now()}`,
      farmerName,
      village: village || 'Local Cluster',
      district: district || 'Warangal',
      crop,
      variety: variety || 'FAQ Standard',
      quantityQuintals: Number(quantityQuintals),
      expectedHarvestDate: expectedHarvestDate || '2026-12-05',
      askingPricePerQuintalInr: Number(askingPricePerQuintalInr),
      mandiReferencePriceInr: mandiRef,
      grade: grade || 'Grade A · Farm-Gate Direct',
      bids: [],
    };

    store.f2bListings = [listing, ...store.f2bListings];
    saveStore(store);
    res.status(201).json({listing});
  });

  app.post('/api/agrilink/f2b/:id/bid', (req, res) => {
    const {buyerName, buyerType, pricePerQuintalInr, quantityQuintals, note, acceptBidId} =
      req.body as {
        buyerName?: string;
        buyerType?: 'Wholesaler' | 'Food Processor' | 'Hostel / Institutional' | 'Retail Chain';
        pricePerQuintalInr?: number;
        quantityQuintals?: number;
        note?: string;
        acceptBidId?: string;
      };

    const idx = store.f2bListings.findIndex((l) => l.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({error: 'F2B listing not found.'});
    }

    const listing = store.f2bListings[idx];
    if (acceptBidId) {
      listing.bids = listing.bids.map((b) =>
        b.id === acceptBidId ? {...b, status: 'Accepted'} : b,
      );
      saveStore(store);
      return res.json({listing});
    }

    if (!buyerName || !pricePerQuintalInr || !quantityQuintals) {
      return res.status(400).json({error: 'Buyer name, bid price, and quantity are required.'});
    }

    listing.bids = [
      {
        id: `bid-${Date.now()}`,
        buyerName,
        buyerType: buyerType || 'Wholesaler',
        pricePerQuintalInr: Number(pricePerQuintalInr),
        quantityQuintals: Number(quantityQuintals),
        note: note || 'Direct farm-gate pickup · 0% middleman commission',
        createdAt: 'Just now',
        status: 'Open',
      },
      ...listing.bids,
    ];
    saveStore(store);
    res.status(201).json({listing});
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RythuSethu full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
