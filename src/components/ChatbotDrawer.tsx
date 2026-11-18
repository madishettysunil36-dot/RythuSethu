import React, {useEffect, useRef, useState} from 'react';
import {
  ExternalLink,
  Globe,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  Send,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import {fetchWithRetry} from '../utils/fetchWithRetry.ts';
import {RythuSethuLogo} from './RythuSethuLogo.tsx';
import type {
  ChatMessage,
  ChatModelTier,
  ChatRolePersona,
  District,
  LanguageCode,
} from '../types/agri.ts';

interface ChatbotDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  district: District;
  language: LanguageCode;
  isOnline: boolean;
  initialPersona?: ChatRolePersona;
  externalPrompt?: {persona: ChatRolePersona; query: string; nonce: number} | null;
}

const CHAT_STORAGE_KEY = 'rythusethu:chat:v1';

const PERSONAS: {
  id: ChatRolePersona;
  label: string;
  telugu: string;
  prompts: Record<LanguageCode, string[]>;
}[] = [
  {
    id: 'crop_doctor',
    label: 'Crop Doctor',
    telugu: 'పంట డాక్టర్',
    prompts: {
      te: [
        'వరిలో అగ్గి తెగులుకు ఎకరాకు ఎంత మందు కలపాలి?',
        'పత్తిలో గులాబీ పురుగు నివారణ ఎలా చేయాలి?',
      ],
      hi: [
        'धान में ब्लास्ट रोग के लिए प्रति एकड़ कितनी दवा डालें?',
        'कपास में गुलाबी सुंडी का जैविक नियंत्रण कैसे करें?',
      ],
      en: [
        'Exact Tricyclazole dosage per acre for paddy leaf blast?',
        'How to protect chili crop from leaf curl virus?',
      ],
    },
  },
  {
    id: 'mandi_scheme',
    label: 'Mandi & Schemes',
    telugu: 'మండి & పథకాలు',
    prompts: {
      te: [
        'తెలంగాణ రైతు భరోసా మరియు పంట బీమా తాజా వివరాలు చెప్పండి.',
        '2025-26 వరి మరియు పత్తి కనీస మద్దతు ధర (MSP) ఎంత?',
      ],
      hi: [
        'तेलंगाना रायतु भरोसा और पीएम-किसान योजना की ताजा जानकारी दें।',
        'धान और कपास का ताजा न्यूनतम समर्थन मूल्य (MSP) क्या है?',
      ],
      en: [
        'Latest Telangana Rythu Bharosa & crop insurance updates?',
        'Current MSP for Paddy Grade-A and Cotton in Telangana?',
      ],
    },
  },
  {
    id: 'soil_irrigation',
    label: 'Soil & Irrigation',
    telugu: 'మట్టి & నీరు',
    prompts: {
      te: [
        'నల్లరేగడి నేలలో నత్రజని తక్కువగా ఉంటే ఏ ఎరువు వాడాలి?',
        'గాలి వేగం ఎక్కువగా ఉన్నప్పుడు పిచికారీ ఎందుకు చేయకూడదు?',
      ],
      hi: [
        'काली मिट्टी में नाइट्रोजन कम होने पर कौन सा उर्वरक डालें?',
        'तेज हवा में कीटनाशक छिड़काव क्यों रोकना चाहिए?',
      ],
      en: [
        'Best urea & DAP schedule for Black Cotton soil in Rabi?',
        'When is the safest wind & humidity window for drone spraying?',
      ],
    },
  },
];

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

function getWelcomeMessage(language: LanguageCode): ChatMessage {
  const text =
    language === 'te'
      ? 'నమస్కారం! నేను రైతుసేతు AI సహాయకుడిని. పంట తెగుళ్లు, మండి ధరలు, రైతు భరోసా పథకాలు లేదా మట్టి ఆరోగ్యం గురించి తెలుగులో అడగండి.'
      : language === 'hi'
        ? 'नमस्कार! मैं रैतुसेतु AI सहायक हूं। फसल रोग, मंडी भाव, सरकारी योजनाओं या मिट्टी उर्वरक के बारे में पूछें।'
        : 'Namaskaram! I am RythuSethu AI. Ask multi-turn questions about crop diseases, Telangana mandi prices, Rythu Bharosa updates, or soil NPK plans.';
  return {
    id: 'chat-welcome',
    role: 'model',
    text,
    timestamp: 'Ready',
    modelUsed: 'gemini-4-hydrogen',
  };
}

export const ChatbotDrawer: React.FC<ChatbotDrawerProps> = ({
  isOpen,
  onOpenChange,
  district,
  language,
  isOnline,
  initialPersona,
  externalPrompt,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return [getWelcomeMessage(language)];
  });

  const [rolePersona, setRolePersona] = useState<ChatRolePersona>(initialPersona ?? 'crop_doctor');
  const [modelTier, setModelTier] = useState<ChatModelTier>('hydrogen');
  const [useSearchGrounding, setUseSearchGrounding] = useState<boolean>(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [retryStatus, setRetryStatus] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const lastHandledNonceRef = useRef<number>(0);

  useEffect(() => {
    if (initialPersona) {
      setRolePersona(initialPersona);
      if (initialPersona === 'mandi_scheme') {
        setModelTier('hydrogen');
        setUseSearchGrounding(true);
      }
    }
  }, [initialPersona]);

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-24)));
    } catch {
      // ignore
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => scrollEndRef.current?.scrollIntoView({behavior: 'smooth'}), 80);
    }
  }, [isOpen, messages.length]);

  const activePersonaObj = PERSONAS.find((p) => p.id === rolePersona) ?? PERSONAS[0];

  const speakReply = (id: string, text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#_`]/g, '');
    const utt = new SpeechSynthesisUtterance(cleanText);
    utt.lang = language === 'te' ? 'te-IN' : language === 'hi' ? 'hi-IN' : 'en-IN';
    utt.rate = 0.95;
    utt.onstart = () => setSpeakingId(id);
    utt.onend = () => setSpeakingId(null);
    utt.onerror = () => setSpeakingId(null);
    window.speechSynthesis.speak(utt);
  };

  const toggleMic = () => {
    setErrorMsg(null);
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
      setErrorMsg('Voice microphone is not supported in this browser. Please type your question.');
      return;
    }
    const rec = new Rec();
    rec.lang = language === 'te' ? 'te-IN' : language === 'hi' ? 'hi-IN' : 'en-IN';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (ev) => {
      const transcript = ev.results[0]?.[0]?.transcript;
      if (transcript) setInput(transcript);
    };
    rec.onerror = (ev) => {
      setErrorMsg(`Mic error: ${ev.error}`);
      setIsListening(false);
    };
    rec.onend = () => setIsListening(false);
    recognitionRef.current = rec;
    setIsListening(true);
    rec.start();
  };

  const sendMessage = async (
    overrideText?: string,
    overrideConfig?: {persona?: ChatRolePersona; search?: boolean},
  ) => {
    const trimmed = (overrideText ?? input).trim();
    if (!trimmed || sending) return;
    setErrorMsg(null);

    const effectivePersona = overrideConfig?.persona ?? rolePersona;
    const effectiveSearch = overrideConfig?.search ?? useSearchGrounding;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    if (!overrideText) setInput('');

    if (!isOnline) {
      setErrorMsg('You are offline. Reconnect to chat with RythuSethu AI.');
      return;
    }

    setSending(true);
    setRetryStatus(null);
    try {
      const payloadMessages = nextHistory
        .filter((m) => m.id !== 'chat-welcome')
        .map((m) => ({role: m.role, text: m.text}));

      const res = await fetchWithRetry(
        '/api/chat',
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            messages: payloadMessages,
            rolePersona: effectivePersona,
            modelTier: effectiveSearch ? 'hydrogen' : modelTier,
            useSearchGrounding: effectiveSearch,
            district,
            language,
          }),
        },
        {
          maxRetries: 3,
          baseDelayMs: 850,
          onRetry: ({attempt, maxRetries, status}) => {
            setRetryStatus(
              `AI busy (${status ?? 'network'}) — retrying automatically (${attempt}/${maxRetries})...`,
            );
          },
        },
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chat request failed');

      const modelMsg: ChatMessage = {
        id: `m-${Date.now()}`,
        role: 'model',
        text: data.reply,
        timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}),
        modelUsed: data.modelUsed,
        groundingSources: Array.isArray(data.groundingSources) ? data.groundingSources : [],
      };
      setMessages((prev) => [...prev, modelMsg]);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to reach RythuSethu AI.');
    } finally {
      setSending(false);
      setRetryStatus(null);
    }
  };

  useEffect(() => {
    if (externalPrompt && externalPrompt.nonce !== lastHandledNonceRef.current) {
      lastHandledNonceRef.current = externalPrompt.nonce;
      setRolePersona(externalPrompt.persona);
      setModelTier('hydrogen');
      setUseSearchGrounding(true);
      void sendMessage(externalPrompt.query, {
        persona: externalPrompt.persona,
        search: true,
      });
    }
  }, [externalPrompt]);

  const clearHistory = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingId(null);
    setMessages([getWelcomeMessage(language)]);
  };

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          aria-label="Open RythuSethu AI Assistant"
          className="fixed bottom-20 lg:bottom-6 right-4 lg:right-6 z-40 min-h-[48px] inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-emerald-800 hover:bg-emerald-900 text-white shadow-lg border border-emerald-950/20 transition-all"
        >
          <MessageSquare className="w-5 h-5 shrink-0" />
          <div className="text-left leading-tight">
            <div className="text-xs font-bold">
              {language === 'te' ? 'రైతుసేతు AI' : language === 'hi' ? 'रैतुसेतु AI' : 'RythuSethu AI'}
            </div>
            <div className="text-[10px] text-emerald-100 hidden sm:block">
              {language === 'te' ? 'సహాయం అడగండి' : 'Free Gemini Chat'}
            </div>
          </div>
        </button>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[1px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) onOpenChange(false);
          }}
        >
          <aside
            aria-label="RythuSethu Multi-Turn AI Chatbot"
            className="w-full max-w-md h-full bg-white border-l border-slate-200 shadow-2xl flex flex-col"
          >
            <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3 bg-[#F6F8F5]">
              <div className="flex items-center gap-2.5 min-w-0">
                <RythuSethuLogo size={32} className="shrink-0" />
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-slate-900 truncate">
                    RythuSethu AI Agronomist
                  </h2>
                  <p className="text-[11px] text-slate-500 truncate">
                    {district} · Free-Tier Gemini · {language.toUpperCase()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={clearHistory}
                  title="Clear chat history"
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-slate-500 hover:text-red-700 hover:bg-slate-100 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  aria-label="Close AI chat drawer"
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="px-4 py-3 border-b border-slate-200 space-y-2.5 bg-white">
              <div className="grid grid-cols-3 gap-1.5">
                {PERSONAS.map((p) => {
                  const active = rolePersona === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setRolePersona(p.id);
                        if (p.id === 'mandi_scheme') {
                          setUseSearchGrounding(true);
                        }
                      }}
                      className={`min-h-[44px] px-2 py-1.5 rounded-xl border text-center transition-colors ${
                        active
                          ? 'bg-emerald-800 text-white border-emerald-800'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-[11px] font-semibold leading-tight">
                        {language === 'te' ? p.telugu : p.label}
                      </div>
                      {language === 'te' && (
                        <div
                          className={`text-[10px] leading-tight mt-0.5 ${
                            active ? 'text-emerald-100' : 'text-slate-500'
                          }`}
                        >
                          {p.label}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setModelTier('hydrogen')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                      useSearchGrounding || modelTier === 'hydrogen'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600'
                    }`}
                  >
                    <Sparkles className="w-3 h-3 text-emerald-700" />
                    Hydrogen
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModelTier('flash-lite');
                      setUseSearchGrounding(false);
                    }}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                      !useSearchGrounding && modelTier === 'flash-lite'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600'
                    }`}
                  >
                    <Zap className="w-3 h-3 text-amber-600" />
                    Flash Lite
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const next = !useSearchGrounding;
                    setUseSearchGrounding(next);
                    if (next) setModelTier('hydrogen');
                  }}
                  className={`min-h-[36px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-semibold transition-colors ${
                    useSearchGrounding
                      ? 'bg-sky-50 border-sky-300 text-sky-900'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  {useSearchGrounding ? 'Live Web Search: ON' : 'Live Web Search'}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F6F8F5]">
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div className="text-[11px] text-slate-500 mb-1">
                      {isUser ? 'You' : 'RythuSethu AI'} · {msg.timestamp}
                      {!isUser && msg.modelUsed ? ` · ${msg.modelUsed}` : ''}
                    </div>
                    <div
                      className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                        isUser
                          ? 'bg-emerald-800 text-white'
                          : 'bg-white border border-slate-200 text-slate-900'
                      }`}
                    >
                      <p>{msg.text}</p>

                      {!isUser && msg.groundingSources && msg.groundingSources.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-slate-200 space-y-1.5">
                          <div className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                            <Globe className="w-3 h-3 text-sky-700" />
                            Verified Web Sources
                          </div>
                          <div className="flex flex-col gap-1">
                            {msg.groundingSources.slice(0, 4).map((src, idx) => (
                              <a
                                key={`${msg.id}-src-${idx}`}
                                href={src.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-sky-800 hover:underline truncate"
                              >
                                <ExternalLink className="w-3 h-3 shrink-0" />
                                <span className="truncate">{src.title}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {!isUser && (
                        <button
                          type="button"
                          onClick={() => speakReply(msg.id, msg.text)}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-800 hover:underline"
                        >
                          {speakingId === msg.id ? (
                            <>
                              <VolumeX className="w-3.5 h-3.5" />
                              Stop Audio
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5" />
                              {language === 'te' ? 'వినండి' : 'Listen'}
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {sending && (
                <div className="flex items-center gap-2 text-xs text-slate-600 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 w-fit">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
                  <span>{retryStatus ?? 'Thinking...'}</span>
                </div>
              )}

              <div ref={scrollEndRef} />
            </div>

            <div className="p-3.5 border-t border-slate-200 bg-white space-y-2.5">
              <div className="flex flex-wrap gap-1.5">
                {activePersonaObj.prompts[language].map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => sendMessage(prompt)}
                    disabled={sending}
                    className="text-left text-xs px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors line-clamp-1"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {errorMsg && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  {errorMsg}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage();
                }}
                className="flex items-center gap-2"
              >
                <button
                  type="button"
                  onClick={toggleMic}
                  aria-label="Speak question"
                  className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl transition-colors shrink-0 ${
                    isListening
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    language === 'te'
                      ? 'తెలుగులో లేదా ఇంగ్లీష్‌లో అడగండి...'
                      : language === 'hi'
                        ? 'अपना सवाल पूछें...'
                        : 'Ask about crops, MSP, or schemes...'
                  }
                  className="flex-1 min-h-[44px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  aria-label="Send message"
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-3.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white transition-colors shrink-0"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </form>
            </div>
          </aside>
        </div>
      )}
    </>
  );
};
