import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  Crosshair,
  ExternalLink,
  FlaskConical,
  Loader2,
  MapPin,
  Navigation,
  Search,
  Star,
  Store,
  Tractor,
  Warehouse,
} from 'lucide-react';
import type {District, LanguageCode, MapCategory} from '../types/agri.ts';

interface MapHubViewProps {
  district: District;
  language: LanguageCode;
  initialCategory?: MapCategory;
}

interface DiscoveredPlace {
  id: string;
  displayName: string;
  formattedAddress: string;
  location: google.maps.LatLngLiteral;
  rating?: number | null;
  userRatingCount?: number | null;
  googleMapsURI?: string | null;
  businessStatus?: string | null;
  attributions?: Array<{provider?: string | null; providerURI?: string | null}>;
}

interface RouteSummary {
  destinationId: string;
  destinationName: string;
  distanceKm: string;
  durationMins: number;
}

const DISTRICT_CENTERS: Record<District, {lat: number; lng: number; label: string}> = {
  Warangal: {lat: 17.9689, lng: 79.5941, label: 'Warangal District Center'},
  Hanamkonda: {lat: 18.0005, lng: 79.5554, label: 'Hanamkonda Cluster'},
  Karimnagar: {lat: 18.4386, lng: 79.1288, label: 'Karimnagar Cluster'},
  Khammam: {lat: 17.2473, lng: 80.1514, label: 'Khammam Cluster'},
  Nizamabad: {lat: 18.6725, lng: 78.0941, label: 'Nizamabad Cluster'},
  Nalgonda: {lat: 17.0575, lng: 79.2684, label: 'Nalgonda Cluster'},
};

const CATEGORY_CONFIG: Array<{
  id: MapCategory;
  label: string;
  telugu: string;
  hindi: string;
  photoUrl: string;
  quickChips: string[];
  queryTemplate: (placeLabel: string) => string;
  pinBg: string;
  pinBorder: string;
  glyphColor: string;
  icon: React.ComponentType<{className?: string}>;
}> = [
  {
    id: 'agro_shops',
    label: 'Fertilizer & Seed Shops',
    telugu: 'ఎరువులు & విత్తన షాపులు',
    hindi: 'खाद, बीज और कीटनाशक दुकान',
    photoUrl: '/src/assets/images/agro_fertilizer_shop_1795036060934.jpg',
    quickChips: [
      'Fertilizer Pesticide Dealer',
      'Hybrid Seed Store',
      'Organic Bio-Fertilizer Shop',
    ],
    queryTemplate: (area) => `Fertilizer Seed Pesticide Agro Shop near ${area}`,
    pinBg: '#166534',
    pinBorder: '#052E16',
    glyphColor: '#FFFFFF',
    icon: Store,
  },
  {
    id: 'soil_labs',
    label: 'Soil Labs & Rythu Vedika',
    telugu: 'మట్టి ల్యాబ్ & రైతు వేదిక',
    hindi: 'मिट्टी जांच केंद्र और कृषि कार्यालय',
    photoUrl: '/src/assets/images/soil_testing_irrigation_1795036061027.jpg',
    quickChips: ['Soil Testing Lab', 'Rythu Vedika Center', 'Krishi Vigyan Kendra'],
    queryTemplate: (area) => `Soil Testing Laboratory Agriculture Office Rythu Vedika near ${area}`,
    pinBg: '#0369A1',
    pinBorder: '#0C4A6E',
    glyphColor: '#FFFFFF',
    icon: FlaskConical,
  },
  {
    id: 'mandis_storage',
    label: 'Mandis & Cold Storage',
    telugu: 'మండి & కోల్డ్ స్టోరేజ్',
    hindi: 'मंडी यार्ड और कोल्ड स्टोरेज',
    photoUrl: '/src/assets/images/grain_mandi_godown_1795036061467.jpg',
    quickChips: ['Agricultural Market Mandi', 'Cold Storage', 'Grain Warehouse Godown'],
    queryTemplate: (area) => `Agricultural Market Yard Mandi Cold Storage Godown near ${area}`,
    pinBg: '#B45309',
    pinBorder: '#78350F',
    glyphColor: '#FFFFFF',
    icon: Warehouse,
  },
  {
    id: 'machinery_dealers',
    label: 'Tractors & Agri-Drones',
    telugu: 'ట్రాక్టర్లు & డ్రోన్ డీలర్లు',
    hindi: 'ट्रैक्टर, हार्वेस्टर और ड्रोन डीलर',
    photoUrl: '/src/assets/images/equipment_farm_tractor_1795029132941.jpg',
    quickChips: ['Tractor Showroom', 'Harvester Spare Parts', 'Drip Irrigation Dealer'],
    queryTemplate: (area) => `Tractor Harvester Agricultural Machinery Drip Irrigation Dealer near ${area}`,
    pinBg: '#7C2D12',
    pinBorder: '#431407',
    glyphColor: '#FFFFFF',
    icon: Tractor,
  },
];

function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const upper = msg.toUpperCase();
  return (
    upper.includes('429') ||
    upper.includes('RESOURCE_EXHAUSTED') ||
    upper.includes('OVER_QUERY_LIMIT') ||
    upper.includes('OVERQUOTA') ||
    upper.includes('QUOTA')
  );
}

function triggerQuotaBanner() {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
}

interface PlaceMarkerProps {
  place: DiscoveredPlace;
  isSelected: boolean;
  pinBg: string;
  pinBorder: string;
  glyphColor: string;
  onSelect: (place: DiscoveredPlace) => void;
  onRequestRoute: (place: DiscoveredPlace) => void;
  routeLoadingId: string | null;
}

const PlaceMarkerWithInfo: React.FC<PlaceMarkerProps> = ({
  place,
  isSelected,
  pinBg,
  pinBorder,
  glyphColor,
  onSelect,
  onRequestRoute,
  routeLoadingId,
}) => {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={place.location}
        title={place.displayName}
        onClick={() => onSelect(place)}
      >
        <Pin
          background={isSelected ? '#DC2626' : pinBg}
          borderColor={isSelected ? '#7F1D1D' : pinBorder}
          glyphColor={glyphColor}
          scale={isSelected ? 1.25 : 1.05}
        />
      </AdvancedMarker>

      {isSelected && marker && (
        <InfoWindow anchor={marker} maxWidth={290} onCloseClick={() => onSelect(place)}>
          <div className="p-1 space-y-2 text-slate-900">
            <div className="text-sm font-bold leading-snug">{place.displayName}</div>
            {place.formattedAddress && (
              <div className="text-xs text-slate-600 leading-relaxed">{place.formattedAddress}</div>
            )}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700">
              {typeof place.rating === 'number' && (
                <span className="inline-flex items-center gap-1 font-semibold">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                  <span className="font-mono tabular-nums">{place.rating.toFixed(1)}</span>
                  {place.userRatingCount ? (
                    <span className="text-slate-500">({place.userRatingCount})</span>
                  ) : null}
                </span>
              )}
              {place.googleMapsURI && (
                <a
                  href={place.googleMapsURI}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sky-700 font-medium hover:underline"
                >
                  Open in Maps
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            {place.attributions && place.attributions.length > 0 && (
              <div className="text-[10px] text-slate-500">
                Source:{' '}
                {place.attributions.map((a, i) => (
                  <span key={i}>{a.provider ?? 'Google Maps'}</span>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => onRequestRoute(place)}
              disabled={routeLoadingId === place.id}
              className="w-full min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg"
            >
              {routeLoadingId === place.id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Navigation className="w-3.5 h-3.5" />
              )}
              Show Driving Route
            </button>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

interface MapWorkspaceInnerProps {
  district: District;
  language: LanguageCode;
  initialCategory?: MapCategory;
}

const MapWorkspaceInner: React.FC<MapWorkspaceInnerProps> = ({
  district,
  language,
  initialCategory,
}) => {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const routesLib = useMapsLibrary('routes');

  const [category, setCategory] = useState<MapCategory>(initialCategory ?? 'agro_shops');
  const [customQuery, setCustomQuery] = useState('');
  const [places, setPlaces] = useState<DiscoveredPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<DiscoveredPlace | null>(null);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);

  const [gpsAnchor, setGpsAnchor] = useState<{lat: number; lng: number; label: string} | null>(null);
  const [locatingGps, setLocatingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [routeLoadingId, setRouteLoadingId] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  const [originMarkerRef, originMarker] = useAdvancedMarkerRef();
  const [originOpen, setOriginOpen] = useState(false);

  useEffect(() => {
    if (initialCategory) {
      setCategory(initialCategory);
    }
  }, [initialCategory]);

  // Reset GPS override when farmer changes district explicitly
  useEffect(() => {
    setGpsAnchor(null);
    setGpsError(null);
  }, [district]);

  const activeOrigin = gpsAnchor ?? DISTRICT_CENTERS[district];
  const areaLabel = gpsAnchor ? 'My Farm Location, Telangana' : `${district}, Telangana`;
  const activeCatConfig =
    CATEGORY_CONFIG.find((c) => c.id === category) ?? CATEGORY_CONFIG[0];

  const clearPolylines = useCallback(() => {
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      clearPolylines();
    };
  }, [clearPolylines]);

  const runPlaceSearch = useCallback(
    async (queryText: string) => {
      if (!placesLib || !map) return;
      setLoadingPlaces(true);
      setPlacesError(null);
      setSelectedPlace(null);
      clearPolylines();
      setRouteSummary(null);

      try {
        const request: google.maps.places.SearchByTextRequest = {
          textQuery: queryText,
          fields: [
            'id',
            'displayName',
            'formattedAddress',
            'location',
            'rating',
            'userRatingCount',
            'googleMapsURI',
            'businessStatus',
          ],
          locationBias: {lat: activeOrigin.lat, lng: activeOrigin.lng},
          region: 'in',
          maxResultCount: 12,
        };

        const {places: found} = await placesLib.Place.searchByText(request);
        const mapped: DiscoveredPlace[] = [];

        for (const p of found ?? []) {
          if (!p.location) continue;
          const lat = typeof p.location.lat === 'function' ? p.location.lat() : Number(p.location.lat);
          const lng = typeof p.location.lng === 'function' ? p.location.lng() : Number(p.location.lng);
          mapped.push({
            id: p.id || `${lat}-${lng}`,
            displayName: p.displayName || 'Agricultural Store / Center',
            formattedAddress: p.formattedAddress || `${district}, Telangana`,
            location: {lat, lng},
            rating: p.rating,
            userRatingCount: p.userRatingCount,
            googleMapsURI: p.googleMapsURI,
            businessStatus: p.businessStatus,
            attributions: p.attributions as DiscoveredPlace['attributions'],
          });
        }

        setPlaces(mapped);
        if (mapped.length > 0) {
          const bounds = new google.maps.LatLngBounds();
          bounds.extend({lat: activeOrigin.lat, lng: activeOrigin.lng});
          mapped.forEach((item) => bounds.extend(item.location));
          map.fitBounds(bounds);
        } else {
          map.panTo({lat: activeOrigin.lat, lng: activeOrigin.lng});
          map.setZoom(12);
        }
      } catch (err: unknown) {
        if (isQuotaError(err)) {
          triggerQuotaBanner();
        }
        setPlacesError(
          err instanceof Error ? err.message : 'Unable to search nearby agricultural places.',
        );
      } finally {
        setLoadingPlaces(false);
      }
    },
    [placesLib, map, activeOrigin, district, clearPolylines],
  );

  useEffect(() => {
    if (!placesLib || !map) return;
    const query = activeCatConfig.queryTemplate(areaLabel);
    void runPlaceSearch(query);
  }, [district, category, gpsAnchor, placesLib, map, activeCatConfig, areaLabel, runPlaceSearch]);

  const handleLocateMe = () => {
    setGpsError(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsError('GPS location is not available on this device/browser.');
      return;
    }
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsAnchor({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: 'My Live GPS Farm Location',
        });
        setLocatingGps(false);
      },
      () => {
        setGpsError('Location permission denied — showing results around selected district.');
        setLocatingGps(false);
      },
      {enableHighAccuracy: true, timeout: 7000},
    );
  };

  const computeDrivingRoute = async (destinationPlace: DiscoveredPlace) => {
    if (!routesLib || !map) return;
    clearPolylines();
    setRouteError(null);
    setRouteLoadingId(destinationPlace.id);

    try {
      const request = {
        origin: {lat: activeOrigin.lat, lng: activeOrigin.lng},
        destination: destinationPlace.location,
        travelMode: 'DRIVING',
        fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
      };

      const routeClass = routesLib.Route as unknown as {
        computeRoutes: (req: typeof request) => Promise<{
          routes?: Array<{
            createPolylines: () => google.maps.Polyline[];
            viewport?: google.maps.LatLngBounds;
            distanceMeters?: number;
            durationMillis?: number;
          }>;
        }>;
      };

      const {routes} = await routeClass.computeRoutes(request);
      if (!routes || routes.length === 0) {
        setRouteError('No driving route returned for this location.');
        return;
      }

      const primaryRoute = routes[0];
      const newPolylines = primaryRoute.createPolylines();
      newPolylines.forEach((poly) => {
        poly.setOptions({
          strokeColor: '#166534',
          strokeOpacity: 0.92,
          strokeWeight: 6,
        });
        poly.setMap(map);
      });
      polylinesRef.current = newPolylines;

      if (primaryRoute.viewport) {
        map.fitBounds(primaryRoute.viewport);
      }

      setRouteSummary({
        destinationId: destinationPlace.id,
        destinationName: destinationPlace.displayName,
        distanceKm: ((primaryRoute.distanceMeters ?? 0) / 1000).toFixed(1),
        durationMins: Math.max(1, Math.round((primaryRoute.durationMillis ?? 0) / 60000)),
      });
    } catch (err: unknown) {
      if (isQuotaError(err)) {
        triggerQuotaBanner();
      }
      setRouteError(err instanceof Error ? err.message : 'Unable to compute driving route.');
    } finally {
      setRouteLoadingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Category Visual Banner & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12">
          <div className="lg:col-span-4 relative h-36 lg:h-auto bg-slate-100">
            <img
              src={activeCatConfig.photoUrl}
              alt={activeCatConfig.label}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex items-end p-4 text-white">
              <div>
                <div className="text-[11px] font-medium text-emerald-200">
                  Live Google Maps Discovery
                </div>
                <div className="text-sm font-bold">
                  {language === 'te'
                    ? activeCatConfig.telugu
                    : language === 'hi'
                      ? activeCatConfig.hindi
                      : activeCatConfig.label}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 p-4 sm:p-5 space-y-3.5">
            {/* 4 Nearby Agricultural Category Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CATEGORY_CONFIG.map((cat) => {
                const Icon = cat.icon;
                const active = category === cat.id;
                const catLabel =
                  language === 'te' ? cat.telugu : language === 'hi' ? cat.hindi : cat.label;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setCustomQuery('');
                      setCategory(cat.id);
                    }}
                    className={`min-h-[48px] px-3 py-2 text-left rounded-xl border transition-colors flex items-center gap-2 ${
                      active
                        ? 'bg-emerald-800 text-white border-emerald-800'
                        : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-semibold leading-tight line-clamp-2">
                      {catLabel}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search Input + Quick Filter Chips + GPS Near Me */}
            <div className="flex flex-wrap items-center gap-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (customQuery.trim()) {
                    void runPlaceSearch(`${customQuery.trim()} near ${areaLabel}`);
                  }
                }}
                className="flex items-center gap-2 flex-1 min-w-[230px]"
              >
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={customQuery}
                    onChange={(e) => setCustomQuery(e.target.value)}
                    placeholder={`Search Urea, DAP, seeds, mandi near ${district}...`}
                    className="w-full min-h-[44px] pl-9 pr-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loadingPlaces || !customQuery.trim()}
                  className="min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 rounded-xl whitespace-nowrap"
                >
                  Find
                </button>
              </form>

              <button
                type="button"
                onClick={handleLocateMe}
                disabled={locatingGps}
                className={`min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-colors whitespace-nowrap ${
                  gpsAnchor
                    ? 'bg-sky-50 text-sky-900 border-sky-300'
                    : 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200'
                }`}
              >
                {locatingGps ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Crosshair className="w-4 h-4" />
                )}
                {gpsAnchor ? 'Using My GPS' : 'Near Me (GPS)'}
              </button>
            </div>

            {/* Quick Category Sub-Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              {activeCatConfig.quickChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => {
                    setCustomQuery(chip);
                    void runPlaceSearch(`${chip} near ${areaLabel}`);
                  }}
                  className="min-h-[34px] px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-900 rounded-lg transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        </div>

        {(routeSummary || placesError || routeError || gpsError) && (
          <div className="px-4 pb-4 space-y-2">
            {routeSummary && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-950">
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>
                    Driving route from <strong>{activeOrigin.label}</strong> to{' '}
                    <strong>{routeSummary.destinationName}</strong>:{' '}
                    <span className="font-mono tabular-nums font-bold">
                      {routeSummary.distanceKm} km · ~{routeSummary.durationMins} mins
                    </span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    clearPolylines();
                    setRouteSummary(null);
                  }}
                  className="text-xs font-semibold underline text-emerald-800"
                >
                  Clear Route
                </button>
              </div>
            )}

            {(placesError || routeError || gpsError) && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                {placesError || routeError || gpsError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Interactive Map + Discovered List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="h-[400px] sm:h-[480px] lg:h-[540px] w-full relative">
            <GoogleMap
              mapId="DEMO_MAP_ID"
              defaultCenter={activeOrigin}
              defaultZoom={11}
              gestureHandling="greedy"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              className="w-full h-full"
            >
              <AdvancedMarker
                ref={originMarkerRef}
                position={{lat: activeOrigin.lat, lng: activeOrigin.lng}}
                title={activeOrigin.label}
                onClick={() => setOriginOpen((v) => !v)}
              >
                <Pin
                  background="#0F172A"
                  borderColor="#334155"
                  glyphColor="#F8FAF9"
                  scale={1.0}
                />
              </AdvancedMarker>
              {originOpen && originMarker && (
                <InfoWindow anchor={originMarker} onCloseClick={() => setOriginOpen(false)}>
                  <div className="text-xs font-semibold text-slate-900">{activeOrigin.label}</div>
                </InfoWindow>
              )}

              {places.map((place) => (
                <PlaceMarkerWithInfo
                  key={place.id}
                  place={place}
                  isSelected={selectedPlace?.id === place.id}
                  pinBg={activeCatConfig.pinBg}
                  pinBorder={activeCatConfig.pinBorder}
                  glyphColor={activeCatConfig.glyphColor}
                  onSelect={(p) => {
                    setSelectedPlace((cur) => (cur?.id === p.id ? null : p));
                    map?.panTo(p.location);
                  }}
                  onRequestRoute={computeDrivingRoute}
                  routeLoadingId={routeLoadingId}
                />
              ))}
            </GoogleMap>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="pb-3 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                {activeCatConfig.label}
              </h3>
              <p className="text-xs text-slate-500">
                {places.length} live places near {gpsAnchor ? 'your GPS' : district}
              </p>
            </div>
            {loadingPlaces && <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />}
          </div>

          {loadingPlaces && places.length === 0 ? (
            <div className="space-y-3">
              <div className="h-16 bg-slate-100 rounded-xl animate-pulse" />
              <div className="h-16 bg-slate-100 rounded-xl animate-pulse" />
              <div className="h-16 bg-slate-100 rounded-xl animate-pulse" />
            </div>
          ) : places.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No matching places found. Try typing a nearby mandal town or switching category.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 max-h-[450px] overflow-y-auto pr-1">
              {places.map((place) => {
                const isSelected = selectedPlace?.id === place.id;
                return (
                  <div
                    key={place.id}
                    className={`py-3 first:pt-0 last:pb-0 space-y-2 rounded-xl transition-colors ${
                      isSelected ? 'bg-emerald-50/70 px-2.5 -mx-2.5' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPlace(place);
                        map?.panTo(place.location);
                        map?.setZoom(13);
                      }}
                      className="w-full text-left"
                    >
                      <div className="text-sm font-semibold text-slate-900">
                        {place.displayName}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5 line-clamp-2">
                        {place.formattedAddress}
                      </div>
                    </button>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        {typeof place.rating === 'number' && (
                          <span className="inline-flex items-center gap-1 font-mono tabular-nums font-semibold text-slate-800">
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                            {place.rating.toFixed(1)}
                          </span>
                        )}
                        {place.googleMapsURI && (
                          <a
                            href={place.googleMapsURI}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sky-700 hover:underline"
                          >
                            Maps <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => computeDrivingRoute(place)}
                        disabled={routeLoadingId === place.id}
                        className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors"
                      >
                        {routeLoadingId === place.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Navigation className="w-3 h-3" />
                        )}
                        Route
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const MapHubView: React.FC<MapHubViewProps> = ({
  district,
  language,
  initialCategory,
}) => {
  const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const [apiKey, setApiKey] = useState<string>(envKey?.trim() || '');
  const [loadingKey, setLoadingKey] = useState<boolean>(!envKey?.trim());

  useEffect(() => {
    if (apiKey) return;
    let active = true;
    fetch('/api/maps/config')
      .then((r) => r.json())
      .then((data) => {
        if (active && typeof data.apiKey === 'string' && data.apiKey.trim()) {
          setApiKey(data.apiKey.trim());
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingKey(false);
      });
    return () => {
      active = false;
    };
  }, [apiKey]);

  if (loadingKey) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-10 flex items-center justify-center gap-3 text-sm text-slate-600">
        <Loader2 className="w-5 h-5 animate-spin text-emerald-700" />
        Loading Telangana AgriMap...
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
        <MapPin className="w-8 h-8 text-amber-600 mx-auto" />
        <h3 className="text-base font-semibold text-slate-900">
          Google Maps API Key Not Loaded Yet
        </h3>
        <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
          Configure <code className="font-mono">VITE_GOOGLE_MAPS_API_KEY</code> in Settings &gt; Secrets
          and restart the server to browse nearby fertilizer shops, soil labs, mandis, and dealers.
        </p>
      </div>
    );
  }

  return (
    <APIProvider
      apiKey={apiKey}
      libraries={['places', 'routes', 'marker']}
      region="IN"
      language={language === 'te' ? 'te' : language === 'hi' ? 'hi' : 'en'}
    >
      <MapWorkspaceInner
        district={district}
        language={language}
        initialCategory={initialCategory}
      />
    </APIProvider>
  );
};
