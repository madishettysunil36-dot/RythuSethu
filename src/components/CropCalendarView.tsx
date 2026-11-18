import React, {useEffect, useMemo, useState} from 'react';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Circle,
  Droplets,
  Plus,
  Sprout,
  Trash2,
} from 'lucide-react';
import {readOfflineCache, writeOfflineCache} from '../hooks/usePWA.ts';
import type {
  CalendarCropName,
  CropCalendarTemplate,
  CropSchedule,
  District,
  LanguageCode,
} from '../types/agri.ts';

interface CropCalendarViewProps {
  district: District;
  language: LanguageCode;
}

function addDays(isoDate: string, days: number): string {
  const base = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) return isoDate;
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function diffDaysFromSowing(sowingDate: string): number {
  const start = new Date(`${sowingDate}T00:00:00Z`);
  const today = new Date();
  const utcToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  if (Number.isNaN(start.getTime())) return 0;
  return Math.max(0, Math.floor((utcToday - start.getTime()) / (1000 * 60 * 60 * 24)));
}

export const CropCalendarView: React.FC<CropCalendarViewProps> = ({district, language}) => {
  const [templates, setTemplates] = useState<CropCalendarTemplate[]>(() =>
    readOfflineCache<CropCalendarTemplate[]>('calendar:templates', []),
  );
  const [schedules, setSchedules] = useState<CropSchedule[]>(() =>
    readOfflineCache<CropSchedule[]>('calendar:schedules', []),
  );
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState(false);

  const [newCrop, setNewCrop] = useState<CalendarCropName>('Paddy');
  const [newVariety, setNewVariety] = useState('');
  const [newSowingDate, setNewSowingDate] = useState('2026-10-15');
  const [newAcres, setNewAcres] = useState(3);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/calendar')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.templates)) {
          setTemplates(data.templates);
          writeOfflineCache('calendar:templates', data.templates);
        }
        if (Array.isArray(data.schedules)) {
          setSchedules(data.schedules);
          writeOfflineCache('calendar:schedules', data.schedules);
          if (data.schedules.length > 0 && !selectedScheduleId) {
            setSelectedScheduleId(data.schedules[0].id);
          }
        }
      })
      .catch(() => {});
  }, []);

  const activeSchedule = useMemo(() => {
    return schedules.find((s) => s.id === selectedScheduleId) ?? schedules[0] ?? null;
  }, [schedules, selectedScheduleId]);

  const activeTemplate = useMemo(() => {
    if (!activeSchedule) return null;
    return templates.find((t) => t.crop === activeSchedule.crop) ?? null;
  }, [activeSchedule, templates]);

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          crop: newCrop,
          variety: newVariety.trim() || undefined,
          sowingDate: newSowingDate,
          acres: newAcres,
          district,
        }),
      });
      const data = await res.json();
      if (res.ok && data.schedule) {
        const next = [data.schedule, ...schedules];
        setSchedules(next);
        writeOfflineCache('calendar:schedules', next);
        setSelectedScheduleId(data.schedule.id);
        setShowAddForm(false);
        setNewVariety('');
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleStage = async (scheduleId: string, stageId: string) => {
    // Optimistic update + offline cache
    setSchedules((prev) => {
      const updated = prev.map((s) => {
        if (s.id !== scheduleId) return s;
        const exists = s.completedStageIds.includes(stageId);
        return {
          ...s,
          completedStageIds: exists
            ? s.completedStageIds.filter((id) => id !== stageId)
            : [...s.completedStageIds, stageId],
        };
      });
      writeOfflineCache('calendar:schedules', updated);
      return updated;
    });

    await fetch(`/api/calendar/${scheduleId}/toggle`, {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({stageId}),
    }).catch(() => {});
  };

  const deleteSchedule = async (scheduleId: string) => {
    const remaining = schedules.filter((s) => s.id !== scheduleId);
    setSchedules(remaining);
    writeOfflineCache('calendar:schedules', remaining);
    if (selectedScheduleId === scheduleId) {
      setSelectedScheduleId(remaining[0]?.id ?? '');
    }
    await fetch(`/api/calendar/${scheduleId}`, {method: 'DELETE'}).catch(() => {});
  };

  const daysSinceSowing = activeSchedule ? diffDaysFromSowing(activeSchedule.sowingDate) : 0;

  return (
    <div className="space-y-6">
      {/* Header Banner with Soil & Drip Photo */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-4 relative h-44 lg:h-auto bg-slate-100">
          <img
            src="/src/assets/images/soil_testing_irrigation_1795036061027.jpg"
            alt="Telangana regur soil with drip irrigation tubing"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent flex items-end p-4 text-white">
            <div>
              <div className="text-[11px] font-medium text-emerald-200">
                PJTSAU Growth Timeline
              </div>
              <div className="text-sm font-bold">Sowing-to-Harvest Alerts</div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                {language === 'te'
                  ? 'విత్తనం నుండి కోత వరకు పంట క్యాలెండర్'
                  : language === 'hi'
                    ? 'बुवाई से कटाई तक फसल कैलेंडर और अलर्ट'
                    : 'Sowing-to-Harvest Crop Calendar & Alerts'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                {language === 'te'
                  ? 'విత్తిన తేదీ ఆధారంగా ఎరువులు, నీటి తడి మరియు తెగులు నివారణ దశలను ట్రాక్ చేయండి.'
                  : 'Track exact top-dressing, pest scouting, irrigation & harvest dates per plot.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-xl whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              {showAddForm ? 'Close Form' : 'Add Crop Plot'}
            </button>
          </div>

          {/* Plot Selector Tabs */}
          {schedules.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {schedules.map((sc) => {
                const isSelected = activeSchedule?.id === sc.id;
                const das = diffDaysFromSowing(sc.sowingDate);
                return (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => setSelectedScheduleId(sc.id)}
                    className={`min-h-[46px] px-3.5 py-2 rounded-xl border text-left transition-colors ${
                      isSelected
                        ? 'bg-emerald-800 text-white border-emerald-800'
                        : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-xs font-bold">
                      {sc.crop} ({sc.acres} ac)
                    </div>
                    <div
                      className={`text-[11px] font-mono tabular-nums ${
                        isSelected ? 'text-emerald-100' : 'text-slate-500'
                      }`}
                    >
                      Day {das} · Sown {sc.sowingDate}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Add New Crop Plot Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreateSchedule}
          className="bg-white border border-emerald-700 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Crop</label>
            <select
              value={newCrop}
              onChange={(e) => setNewCrop(e.target.value as CalendarCropName)}
              className="w-full min-h-[44px] px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
            >
              <option value="Paddy">Paddy (వరి)</option>
              <option value="Cotton">Cotton (పత్తి)</option>
              <option value="Chili">Chili (మిర్చి)</option>
              <option value="Turmeric">Turmeric (పసుపు)</option>
              <option value="Maize">Maize (మొక్కజొన్న)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Variety (Optional)
            </label>
            <input
              type="text"
              value={newVariety}
              onChange={(e) => setNewVariety(e.target.value)}
              placeholder="e.g. RNR-15048"
              className="w-full min-h-[44px] px-3 py-2 text-xs border border-slate-300 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Sowing Date</label>
            <input
              type="date"
              value={newSowingDate}
              onChange={(e) => setNewSowingDate(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Acres</label>
            <input
              type="number"
              min={0.5}
              max={100}
              step={0.5}
              value={newAcres}
              onChange={(e) => setNewAcres(Number(e.target.value))}
              className="w-full min-h-[44px] px-3 py-2 text-xs font-mono tabular-nums border border-slate-300 rounded-xl"
              required
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-xl"
          >
            {saving ? 'Saving...' : 'Create Calendar'}
          </button>
        </form>
      )}

      {/* Active Crop Timeline */}
      {activeSchedule && activeTemplate ? (
        <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <CalendarDays className="w-4 h-4 text-emerald-700" />
                <span>{activeSchedule.district} Cluster</span>
                <span>·</span>
                <span className="font-mono tabular-nums">
                  {activeSchedule.completedStageIds.length}/{activeTemplate.stages.length} stages completed
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 mt-1">
                {activeSchedule.crop} — {activeSchedule.variety} ({activeSchedule.acres} Acres)
              </h3>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs text-slate-500">Expected Harvest</div>
                <div className="text-sm font-bold font-mono tabular-nums text-emerald-800">
                  {addDays(activeSchedule.sowingDate, activeTemplate.durationDays)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => deleteSchedule(activeSchedule.id)}
                aria-label="Delete crop schedule"
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-red-700 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {activeTemplate.stages.map((stage) => {
              const isDone = activeSchedule.completedStageIds.includes(stage.id);
              const isActiveNow =
                !isDone && daysSinceSowing >= stage.dayStart && daysSinceSowing <= stage.dayEnd;
              const isOverdue = !isDone && daysSinceSowing > stage.dayEnd;
              const startDate = addDays(activeSchedule.sowingDate, stage.dayStart);
              const endDate = addDays(activeSchedule.sowingDate, stage.dayEnd);

              const localizedTitle =
                language === 'te'
                  ? stage.teluguStage
                  : language === 'hi'
                    ? stage.hindiStage
                    : stage.stageName;

              return (
                <div
                  key={stage.id}
                  className={`p-4 rounded-xl border transition-colors ${
                    isDone
                      ? 'bg-slate-50/70 border-slate-200'
                      : isOverdue
                        ? 'bg-red-50/40 border-red-200'
                        : isActiveNow
                          ? 'bg-emerald-50/70 border-emerald-600'
                          : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleStage(activeSchedule.id, stage.id)}
                      aria-label={`Toggle ${stage.stageName}`}
                      className="min-h-[44px] min-w-[44px] -ml-2 -mt-1 inline-flex items-center justify-center rounded-xl hover:bg-white/80 shrink-0"
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-700" />
                      ) : isOverdue ? (
                        <AlertCircle className="w-6 h-6 text-red-600" />
                      ) : (
                        <Circle
                          className={`w-6 h-6 ${
                            isActiveNow ? 'text-emerald-800' : 'text-slate-300'
                          }`}
                        />
                      )}
                    </button>

                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div>
                          <div className="text-sm sm:text-base font-bold text-slate-900">
                            {localizedTitle}
                          </div>
                          {language !== 'en' && (
                            <div className="text-xs text-slate-500">{stage.stageName}</div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
                          <span
                            className={`font-semibold ${
                              isDone
                                ? 'text-emerald-700'
                                : isOverdue
                                  ? 'text-red-700'
                                  : isActiveNow
                                    ? 'text-emerald-900'
                                    : 'text-slate-500'
                            }`}
                          >
                            {isDone
                              ? 'Completed'
                              : isOverdue
                                ? 'Action Due / Overdue'
                                : isActiveNow
                                  ? 'Active Stage Now'
                                  : 'Upcoming'}
                          </span>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-600">
                            {startDate} → {endDate}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                        {stage.keyAction}
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                        <div className="flex items-start gap-1.5 text-emerald-900">
                          <Sprout className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                          <span>
                            <strong>Fertilizer:</strong> {stage.fertilizerTip}
                          </span>
                        </div>
                        <div className="flex items-start gap-1.5 text-sky-900">
                          <Droplets className="w-3.5 h-3.5 text-sky-700 shrink-0 mt-0.5" />
                          <span>
                            <strong>Irrigation:</strong> {stage.irrigationTip}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
          <CalendarDays className="w-8 h-8 text-emerald-700 mx-auto" />
          <p className="text-sm font-semibold text-slate-800">No active crop schedules yet.</p>
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-emerald-800 rounded-xl"
          >
            Add First Crop Calendar
          </button>
        </div>
      )}
    </div>
  );
};
