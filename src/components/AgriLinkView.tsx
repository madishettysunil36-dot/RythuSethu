import React, {useEffect, useState} from 'react';
import {
  CalendarClock,
  CheckCircle2,
  CloudRain,
  Handshake,
  IndianRupee,
  MapPin,
  Plus,
  ShieldCheck,
  Tractor,
} from 'lucide-react';
import type {
  District,
  EquipmentBooking,
  EquipmentListing,
  F2BHarvestListing,
} from '../types/agri.ts';

interface EquipmentWithDistance extends EquipmentListing {
  distanceKm: number;
}

interface AgriLinkViewProps {
  district: District;
}

export const AgriLinkView: React.FC<AgriLinkViewProps> = ({district}) => {
  const [subMode, setSubMode] = useState<'equipment' | 'f2b'>('equipment');

  // Equipment state
  const [radiusKm, setRadiusKm] = useState<number>(50);
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [equipment, setEquipment] = useState<EquipmentWithDistance[]>([]);
  const [bookings, setBookings] = useState<EquipmentBooking[]>([]);
  const [bookingTarget, setBookingTarget] = useState<EquipmentWithDistance | null>(null);
  const [bookingForm, setBookingForm] = useState({
    farmerName: 'Srinivasulu M.',
    acres: 3,
    scheduledDate: '2026-11-20',
  });
  const [bookingMsg, setBookingMsg] = useState<string | null>(null);

  // F2B Pre-Harvest Marketplace state
  const [f2bListings, setF2bListings] = useState<F2BHarvestListing[]>([]);
  const [showNewLotForm, setShowNewLotForm] = useState(false);
  const [newLot, setNewLot] = useState({
    farmerName: '',
    village: '',
    crop: 'Paddy',
    variety: 'RNR-15048',
    quantityQuintals: 50,
    expectedHarvestDate: '2026-12-06',
    askingPricePerQuintalInr: 2650,
    grade: 'A-Grade · Moisture <13%',
  });
  const [activeBidLotId, setActiveBidLotId] = useState<string | null>(null);
  const [bidForm, setBidForm] = useState({
    buyerName: '',
    buyerType: 'Food Processor' as const,
    pricePerQuintalInr: 2680,
    quantityQuintals: 50,
    note: '',
  });

  const loadEquipment = () => {
    fetch(
      `/api/agrilink/equipment?district=${encodeURIComponent(district)}&maxKm=${radiusKm}&category=${encodeURIComponent(categoryFilter)}`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.equipment)) setEquipment(data.equipment);
        if (Array.isArray(data.bookings)) setBookings(data.bookings);
      })
      .catch(() => {});
  };

  const loadF2B = () => {
    fetch('/api/agrilink/f2b')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.listings)) setF2bListings(data.listings);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadEquipment();
  }, [district, radiusKm, categoryFilter]);

  useEffect(() => {
    loadF2B();
  }, []);

  const submitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingTarget) return;
    setBookingMsg(null);
    const res = await fetch('/api/agrilink/bookings', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        equipmentId: bookingTarget.id,
        farmerName: bookingForm.farmerName,
        acres: bookingForm.acres,
        scheduledDate: bookingForm.scheduledDate,
        district,
      }),
    });
    const data = await res.json();
    if (res.ok && data.booking) {
      setBookings((prev) => [data.booking, ...prev]);
      setBookingMsg(
        `Booked ${data.booking.equipmentName} (UPI Ref: ${data.booking.upiRef}). ${data.booking.weatherNote}`,
      );
      setBookingTarget(null);
    }
  };

  const handleBookingAction = async (
    bookingId: string,
    action: 'pay_upi' | 'weather_reschedule',
  ) => {
    const res = await fetch(`/api/agrilink/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        action,
        newDate: action === 'weather_reschedule' ? '2026-11-23' : undefined,
      }),
    });
    const data = await res.json();
    if (res.ok && data.booking) {
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? data.booking : b)));
    }
  };

  const createF2BLot = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/agrilink/f2b', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({...newLot, district}),
    });
    const data = await res.json();
    if (res.ok && data.listing) {
      setF2bListings((prev) => [data.listing, ...prev]);
      setShowNewLotForm(false);
      setNewLot((p) => ({...p, farmerName: '', village: ''}));
    }
  };

  const submitBid = async (e: React.FormEvent, listingId: string) => {
    e.preventDefault();
    const res = await fetch(`/api/agrilink/f2b/${listingId}/bid`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(bidForm),
    });
    const data = await res.json();
    if (res.ok && data.listing) {
      setF2bListings((prev) => prev.map((l) => (l.id === listingId ? data.listing : l)));
      setActiveBidLotId(null);
      setBidForm((p) => ({...p, buyerName: '', note: ''}));
    }
  };

  const acceptBid = async (listingId: string, bidId: string) => {
    const res = await fetch(`/api/agrilink/f2b/${listingId}/bid`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({acceptBidId: bidId}),
    });
    const data = await res.json();
    if (res.ok && data.listing) {
      setF2bListings((prev) => prev.map((l) => (l.id === listingId ? data.listing : l)));
    }
  };

  return (
    <div className="space-y-6">
      {/* Segmented Workspace Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-4">
        <div>
          <p className="text-xs text-slate-500">
            AgriLink · Geospatial Cluster & Direct Commerce ({district})
          </p>
          <h2 className="text-lg font-semibold text-slate-900">
            Peer-to-Peer Machinery Rental & Direct F2B Pre-Harvest Bids
          </h2>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setSubMode('equipment')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              subMode === 'equipment'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Tractor className="w-3.5 h-3.5" />
            Equipment Sharing
          </button>
          <button
            type="button"
            onClick={() => setSubMode('f2b')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              subMode === 'f2b'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Handshake className="w-3.5 h-3.5" />
            Direct F2B Buyers
          </button>
        </div>
      </div>

      {subMode === 'equipment' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Equipment Discovery + Booking Modal/Inline Drawer */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {['All', 'Agri-Drone', 'Tractor', 'Harvester'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      categoryFilter === cat
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs">
                <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                <span className="text-slate-600">Radius from {district}:</span>
                <select
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg font-mono tabular-nums text-xs"
                >
                  <option value={15}>Within 15 km</option>
                  <option value={25}>Within 25 km</option>
                  <option value={50}>Within 50 km</option>
                  <option value={300}>All Telangana</option>
                </select>
              </div>
            </div>

            {bookingMsg && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-4 text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span>{bookingMsg}</span>
              </div>
            )}

            {equipment.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-2">
                <p className="text-sm font-medium text-slate-700">
                  No machinery found within {radiusKm} km of {district}.
                </p>
                <button
                  type="button"
                  onClick={() => setRadiusKm(300)}
                  className="px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 rounded-lg hover:bg-emerald-100"
                >
                  Expand Search to All Telangana
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {equipment.map((eq) => (
                  <div
                    key={eq.id}
                    className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      <div className="aspect-[4/3] w-full bg-slate-100 overflow-hidden">
                        <img
                          src={eq.imageUrl}
                          alt={eq.name}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-4 space-y-2">
                        <div className="text-xs text-slate-500">
                          {eq.category} · {eq.village}, {eq.district} ·{' '}
                          <span className="font-mono tabular-nums font-semibold text-slate-800">
                            {eq.distanceKm} km away
                          </span>
                        </div>
                        <h3 className="text-base font-semibold text-slate-900">{eq.name}</h3>
                        <p className="text-xs text-slate-600">{eq.specs}</p>
                        <div className="pt-2 border-t border-slate-200 flex items-baseline justify-between">
                          <div>
                            <div className="text-sm font-bold font-mono tabular-nums text-emerald-800">
                              ₹{eq.suggestedDynamicRateInr.toLocaleString('en-IN')} / acre
                            </div>
                            <div className="text-[11px] font-mono tabular-nums text-slate-500">
                              Base ₹{eq.ratePerHourInr}/hr · Owner: {eq.ownerName}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setBookingTarget(eq)}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg transition-colors whitespace-nowrap"
                          >
                            Book Slot
                          </button>
                        </div>
                        <div className="text-[11px] text-amber-800">{eq.dynamicPricingNote}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Booking Form + Weather-Protected Bookings & UPI Ledger */}
          <div className="lg:col-span-4 space-y-6">
            {bookingTarget && (
              <form
                onSubmit={submitBooking}
                className="bg-white border border-emerald-700 rounded-xl p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-200">
                  <div>
                    <p className="text-xs text-emerald-800 font-semibold">
                      Weather-Protected Booking
                    </p>
                    <h3 className="text-sm font-bold text-slate-900">{bookingTarget.name}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBookingTarget(null)}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Farmer Name
                  </label>
                  <input
                    type="text"
                    value={bookingForm.farmerName}
                    onChange={(e) =>
                      setBookingForm((p) => ({...p, farmerName: e.target.value}))
                    }
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Acres
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={bookingForm.acres}
                      onChange={(e) =>
                        setBookingForm((p) => ({...p, acres: Number(e.target.value)}))
                      }
                      className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums border border-slate-300 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Service Date
                    </label>
                    <select
                      value={bookingForm.scheduledDate}
                      onChange={(e) =>
                        setBookingForm((p) => ({...p, scheduledDate: e.target.value}))
                      }
                      className="w-full px-2 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                    >
                      <option value="2026-11-18">2026-11-18 (Dry)</option>
                      <option value="2026-11-19">2026-11-19 (Dry)</option>
                      <option value="2026-11-20">2026-11-20 (Rain Alert)</option>
                      <option value="2026-11-23">2026-11-23 (Dry)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-600">Estimated Total</span>
                  <span className="font-bold font-mono tabular-nums text-slate-900">
                    ₹
                    {(
                      bookingTarget.suggestedDynamicRateInr * bookingForm.acres
                    ).toLocaleString('en-IN')}
                  </span>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg"
                >
                  Confirm Weather-Protected Booking
                </button>
              </form>
            )}

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="pb-3 border-b border-slate-200">
                <h3 className="text-base font-semibold text-slate-900">
                  Active Bookings & UPI Status
                </h3>
                <p className="text-xs text-slate-500">
                  Free rescheduling if forecast rain exceeds 50%
                </p>
              </div>

              <div className="divide-y divide-slate-200">
                {bookings.map((bk) => (
                  <div key={bk.id} className="py-3 first:pt-0 last:pb-0 space-y-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-slate-900">{bk.equipmentName}</div>
                        <div className="text-slate-500">
                          {bk.farmerName} · {bk.acres} ac ·{' '}
                          <span className="font-mono tabular-nums">{bk.scheduledDate}</span>
                        </div>
                      </div>
                      <span className="font-mono tabular-nums font-bold text-slate-900">
                        ₹{bk.totalAmountInr.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="flex items-start gap-1.5 text-[11px]">
                      {bk.weatherRiskFlag ? (
                        <CloudRain className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                      )}
                      <span className={bk.weatherRiskFlag ? 'text-amber-800' : 'text-slate-600'}>
                        {bk.weatherNote}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <span className="font-mono tabular-nums text-[11px] text-slate-500">
                        {bk.upiRef} · {bk.paymentStatus}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {bk.weatherRiskFlag && (
                          <button
                            type="button"
                            onClick={() => handleBookingAction(bk.id, 'weather_reschedule')}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded"
                          >
                            <CalendarClock className="w-3 h-3" />
                            Reschedule Free
                          </button>
                        )}
                        {bk.paymentStatus === 'Pending UPI' && (
                          <button
                            type="button"
                            onClick={() => handleBookingAction(bk.id, 'pay_upi')}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded"
                          >
                            <IndianRupee className="w-3 h-3" />
                            Mark UPI Paid
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Direct Farm-to-Business (F2B) Marketplace */
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-slate-600">
              Farmers list upcoming harvests directly to rice millers, spice processors & hostels
              without multi-tier commission cuts.
            </p>
            <button
              type="button"
              onClick={() => setShowNewLotForm((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              {showNewLotForm ? 'Close Form' : 'Post Pre-Harvest Lot'}
            </button>
          </div>

          {showNewLotForm && (
            <form
              onSubmit={createF2BLot}
              className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-4 gap-3"
            >
              <input
                type="text"
                placeholder="Farmer / FPO Name"
                value={newLot.farmerName}
                onChange={(e) => setNewLot((p) => ({...p, farmerName: e.target.value}))}
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
                required
              />
              <input
                type="text"
                placeholder="Village / Cluster"
                value={newLot.village}
                onChange={(e) => setNewLot((p) => ({...p, village: e.target.value}))}
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
                required
              />
              <input
                type="text"
                placeholder="Crop (e.g. Paddy, Chili)"
                value={newLot.crop}
                onChange={(e) => setNewLot((p) => ({...p, crop: e.target.value}))}
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
                required
              />
              <input
                type="text"
                placeholder="Variety (e.g. RNR-15048)"
                value={newLot.variety}
                onChange={(e) => setNewLot((p) => ({...p, variety: e.target.value}))}
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
              <input
                type="number"
                min={5}
                placeholder="Quantity (Quintals)"
                value={newLot.quantityQuintals}
                onChange={(e) =>
                  setNewLot((p) => ({...p, quantityQuintals: Number(e.target.value)}))
                }
                className="px-3 py-2 text-xs font-mono tabular-nums border border-slate-300 rounded-lg"
                required
              />
              <input
                type="number"
                min={500}
                placeholder="Asking ₹/Quintal"
                value={newLot.askingPricePerQuintalInr}
                onChange={(e) =>
                  setNewLot((p) => ({...p, askingPricePerQuintalInr: Number(e.target.value)}))
                }
                className="px-3 py-2 text-xs font-mono tabular-nums border border-slate-300 rounded-lg"
                required
              />
              <input
                type="date"
                value={newLot.expectedHarvestDate}
                onChange={(e) =>
                  setNewLot((p) => ({...p, expectedHarvestDate: e.target.value}))
                }
                className="px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
              />
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg"
              >
                Publish Harvest Lot
              </button>
            </form>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {f2bListings.map((lot) => {
              const premiumVsMandi =
                lot.askingPricePerQuintalInr - lot.mandiReferencePriceInr;
              return (
                <div
                  key={lot.id}
                  className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
                >
                  <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-200">
                    <div>
                      <div className="text-xs text-slate-500">
                        {lot.village}, {lot.district} · Harvest{' '}
                        <span className="font-mono tabular-nums">
                          {lot.expectedHarvestDate}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                        {lot.crop} — {lot.variety}
                      </h3>
                      <div className="text-xs text-slate-600 mt-0.5">
                        Seller: {lot.farmerName} · {lot.grade}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold font-mono tabular-nums text-emerald-800">
                        ₹{lot.askingPricePerQuintalInr.toLocaleString('en-IN')}/qtl
                      </div>
                      <div className="text-xs font-mono tabular-nums text-slate-500">
                        {lot.quantityQuintals} qtl lot
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-emerald-700">
                        {premiumVsMandi >= 0 ? `+₹${premiumVsMandi}` : `-₹${Math.abs(premiumVsMandi)}`}{' '}
                        vs Mandi
                      </div>
                    </div>
                  </div>

                  {/* Bids List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">
                        Direct Buyer Pre-Harvest Bids ({lot.bids.length})
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveBidLotId((cur) => (cur === lot.id ? null : lot.id))
                        }
                        className="text-xs font-semibold text-emerald-800 hover:underline"
                      >
                        {activeBidLotId === lot.id ? 'Close Bid Form' : '+ Place Buyer Bid'}
                      </button>
                    </div>

                    {activeBidLotId === lot.id && (
                      <form
                        onSubmit={(e) => submitBid(e, lot.id)}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-2 gap-2"
                      >
                        <input
                          type="text"
                          placeholder="Buyer / Mill / Hostel Name"
                          value={bidForm.buyerName}
                          onChange={(e) =>
                            setBidForm((p) => ({...p, buyerName: e.target.value}))
                          }
                          className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                          required
                        />
                        <select
                          value={bidForm.buyerType}
                          onChange={(e) =>
                            setBidForm((p) => ({
                              ...p,
                              buyerType: e.target.value as typeof bidForm.buyerType,
                            }))
                          }
                          className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                        >
                          <option value="Food Processor">Food Processor</option>
                          <option value="Wholesaler">Wholesaler</option>
                          <option value="Hostel / Institutional">Hostel / Institutional</option>
                          <option value="Retail Chain">Retail Chain</option>
                        </select>
                        <input
                          type="number"
                          min={500}
                          placeholder="Bid ₹/Qtl"
                          value={bidForm.pricePerQuintalInr}
                          onChange={(e) =>
                            setBidForm((p) => ({
                              ...p,
                              pricePerQuintalInr: Number(e.target.value),
                            }))
                          }
                          className="px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded"
                          required
                        />
                        <input
                          type="number"
                          min={5}
                          placeholder="Qty (Qtl)"
                          value={bidForm.quantityQuintals}
                          onChange={(e) =>
                            setBidForm((p) => ({
                              ...p,
                              quantityQuintals: Number(e.target.value),
                            }))
                          }
                          className="px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded"
                          required
                        />
                        <input
                          type="text"
                          placeholder="Pickup & advance terms"
                          value={bidForm.note}
                          onChange={(e) => setBidForm((p) => ({...p, note: e.target.value}))}
                          className="col-span-2 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                        />
                        <button
                          type="submit"
                          className="col-span-2 py-1.5 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded"
                        >
                          Submit Direct F2B Bid
                        </button>
                      </form>
                    )}

                    {lot.bids.length === 0 ? (
                      <p className="text-xs text-slate-500 py-2">
                        No pre-harvest bids yet. Local processors can submit the opening offer.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-200">
                        {lot.bids.map((bid) => (
                          <div
                            key={bid.id}
                            className="py-2.5 flex items-center justify-between gap-3 text-xs"
                          >
                            <div>
                              <div className="font-semibold text-slate-900">
                                {bid.buyerName}{' '}
                                <span className="font-normal text-slate-500">
                                  · {bid.buyerType}
                                </span>
                              </div>
                              <div className="text-slate-600">{bid.note}</div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right font-mono tabular-nums">
                                <div className="font-bold text-slate-900">
                                  ₹{bid.pricePerQuintalInr.toLocaleString('en-IN')}/qtl
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {bid.quantityQuintals} qtl
                                </div>
                              </div>
                              {bid.status === 'Accepted' ? (
                                <span className="inline-flex items-center gap-1 font-semibold text-emerald-800">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Accepted
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => acceptBid(lot.id, bid.id)}
                                  className="px-2.5 py-1 text-[11px] font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded"
                                >
                                  Accept Bid
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
