/// <reference types="google.maps" />
// Source: Google Maps Platform Code Assist
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map,
  Pin,
  useAdvancedMarkerRef,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  Compass,
  ExternalLink,
  Hotel,
  Loader2,
  MapPin,
  Navigation,
  Search,
  Sparkles,
  Star,
} from 'lucide-react';
import { EventRecord, LiveNearbyHotelDeal } from '../types/domain';
import { safeHttpUrl } from '../lib/url';
import { getMapsKey, isValidMapsKey, osmEmbedUrl, osmViewUrl, setMapsKey } from '../lib/mapsConfig';
import { postJson } from '../lib/api';

interface EventVenueAndHotelsMapProps {
  event: EventRecord;
  liveHotelDeals: LiveNearbyHotelDeal[];
  onSelectVenueLocation?: (formattedLocation: string) => void;
  onLockInHotelDeal?: (deal: LiveNearbyHotelDeal) => void;
}

interface LatLngPoint {
  lat: number;
  lng: number;
}

interface DiscoveredGmpPlace {
  id: string;
  displayName: string;
  formattedAddress: string;
  location: LatLngPoint;
  rating?: number;
  websiteURI?: string;
}

const VenueAdvancedMarkerWithInfo: React.FC<{
  position: LatLngPoint;
  title: string;
  subtitle: string;
}> = ({ position, title, subtitle }) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [infoOpen, setInfoOpen] = useState(true);

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={position}
        title={title}
        onClick={() => setInfoOpen((prev) => !prev)}
      >
        <Pin
          background="#B88B4A"
          borderColor="#7A5621"
          glyphColor="#FAF6EC"
          scale={1.3}
        />
      </AdvancedMarker>
      {infoOpen && marker && (
        <InfoWindow
          anchor={marker}
          maxWidth={260}
          onCloseClick={() => setInfoOpen(false)}
        >
          <div className="p-1 text-stone-900 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#8C6226]">
              Event Venue
            </div>
            <div className="text-xs font-bold">{title}</div>
            <div className="text-[11px] text-stone-600">{subtitle}</div>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

const HotelAdvancedMarkerWithInfo: React.FC<{
  place: DiscoveredGmpPlace;
  onCalculateRoute: (place: DiscoveredGmpPlace) => void;
}> = ({ place, onCalculateRoute }) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={place.location}
        title={place.displayName}
        onClick={() => setInfoOpen((prev) => !prev)}
      >
        <Pin
          background="#4A6B53"
          borderColor="#2E4635"
          glyphColor="#FAF6EC"
          scale={1.1}
        />
      </AdvancedMarker>
      {infoOpen && marker && (
        <InfoWindow
          anchor={marker}
          maxWidth={260}
          onCloseClick={() => setInfoOpen(false)}
        >
          <div className="p-1 text-stone-900 space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#4A6B53]">
              Nearby Hotel (Places API New)
            </div>
            <div className="text-xs font-bold">{place.displayName}</div>
            <div className="text-[11px] text-stone-600">
              {place.formattedAddress}
            </div>
            {typeof place.rating === 'number' && (
              <div className="text-[11px] font-mono font-semibold text-amber-700">
                ★ {place.rating.toFixed(1)} rating
              </div>
            )}
            <div className="pt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => onCalculateRoute(place)}
                className="px-2.5 py-1 text-[11px] font-semibold text-white bg-[#4A6B53] hover:bg-[#3A5642] rounded-lg transition-colors"
              >
                Compute Route to Venue
              </button>
              {place.websiteURI && (
                <a
                  href={safeHttpUrl(place.websiteURI) ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-semibold text-[#8C6226] hover:underline"
                >
                  Website
                </a>
              )}
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

/**
 * Inner interactive map controller using @vis.gl/react-google-maps hooks:
 * - Places API (New): AutocompleteSuggestion.fetchAutocompleteSuggestions, AutocompleteSessionToken, Place.fetchFields, Place.searchByText
 * - Routes API: Route.computeRoutes via useMapsLibrary('routes')
 * - Markers: AdvancedMarker + Pin + InfoWindow (Zero legacy APIs)
 */
const GoogleMapsSdkWorkspaceInner: React.FC<{
  event: EventRecord;
  onSelectVenueLocation?: (formattedLocation: string) => void;
}> = ({ event, onSelectVenueLocation }) => {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const routesLib = useMapsLibrary('routes');

  const [venueCenter, setVenueCenter] = useState<LatLngPoint>({
    lat: 37.7749,
    lng: -122.4194,
  });
  const [venueAddressLabel, setVenueAddressLabel] = useState<string>(
    event.location
  );
  const [nearbyPlaces, setNearbyPlaces] = useState<DiscoveredGmpPlace[]>([]);
  const [searchInput, setSearchInput] = useState<string>('');
  const [suggestions, setSuggestions] = useState<
    google.maps.places.AutocompleteSuggestion[]
  >([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState<boolean>(false);
  const [routeSummary, setRouteSummary] = useState<{
    hotelName: string;
    distanceText: string;
    durationText: string;
  } | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const sessionTokenRef =
    useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const activePolylinesRef = useRef<google.maps.Polyline[]>([]);

  // Resolve current event.location via Places API (New) searchByText and search nearby hotels
  const resolveVenueAndNearbyHotels = useCallback(
    async (queryText: string) => {
      if (!placesLib) return;
      setIsLoadingPlaces(true);
      setStatusError(null);
      try {
        const { Place } = placesLib;
        const venueResp = await Place.searchByText({
          textQuery: queryText,
          fields: ['displayName', 'formattedAddress', 'location', 'viewport'],
          maxResultCount: 1,
        });

        const topVenue = venueResp.places?.[0];
        if (topVenue?.location) {
          const lat = topVenue.location.lat();
          const lng = topVenue.location.lng();
          const nextCenter = { lat, lng };
          setVenueCenter(nextCenter);
          setVenueAddressLabel(
            topVenue.formattedAddress || topVenue.displayName || queryText
          );
          if (map) {
            map.panTo(nextCenter);
            map.setZoom(14);
          }

          // Fetch nearby budget-friendly hotels via Places API (New) searchByText
          const hotelsResp = await Place.searchByText({
            textQuery: `hotels near ${topVenue.displayName || queryText}`,
            fields: [
              'displayName',
              'formattedAddress',
              'location',
              'rating',
              'websiteURI',
            ],
            maxResultCount: 6,
          });

          const mappedHotels: DiscoveredGmpPlace[] = (
            hotelsResp.places || []
          )
            .filter((p: google.maps.places.Place) => Boolean(p.location))
            .map((p: google.maps.places.Place, idx: number) => ({
              id: p.id || `gmp-hotel-${idx}`,
              displayName: p.displayName || 'Nearby Hotel',
              formattedAddress: p.formattedAddress || '',
              location: {
                lat: p.location!.lat(),
                lng: p.location!.lng(),
              },
              rating: p.rating ?? undefined,
              websiteURI: p.websiteURI ?? undefined,
            }));

          setNearbyPlaces(mappedHotels);
        }
      } catch (err: unknown) {
        console.error('Places API (New) lookup error:', err);
        setStatusError(
          'Unable to load place data from Google Maps Platform. Please check your network or API key configuration.'
        );
      } finally {
        setIsLoadingPlaces(false);
      }
    },
    [placesLib, map]
  );

  useEffect(() => {
    if (placesLib && event.location) {
      void resolveVenueAndNearbyHotels(event.location);
    }
  }, [placesLib, event.location, resolveVenueAndNearbyHotels]);

  // Modern Places API (New) AutocompleteSuggestion with AutocompleteSessionToken
  useEffect(() => {
    if (!placesLib) return;
    const trimmed = searchInput.trim();
    if (!trimmed) {
      setSuggestions([]);
      return;
    }

    const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new AutocompleteSessionToken();
    }

    let cancelled = false;
    AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input: trimmed,
      sessionToken: sessionTokenRef.current,
    })
      .then((res: { suggestions: google.maps.places.AutocompleteSuggestion[] }) => {
        if (!cancelled) {
          setSuggestions(res.suggestions || []);
        }
      })
      .catch((err: unknown) => {
        console.error('AutocompleteSuggestion error:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [placesLib, searchInput]);

  const handleSelectSuggestion = async (
    suggestion: google.maps.places.AutocompleteSuggestion
  ) => {
    if (!placesLib || !suggestion.placePrediction) return;
    try {
      const place = suggestion.placePrediction.toPlace();
      // Fetch fields with NO prefix and capitalized acronyms per Places API (New) JS SDK spec
      await place.fetchFields({
        fields: [
          'displayName',
          'formattedAddress',
          'location',
          'viewport',
          'websiteURI',
        ],
      });

      // Reset session token after fetchFields completes
      sessionTokenRef.current = null;
      setSuggestions([]);
      setSearchInput('');

      if (place.location) {
        const nextPos = {
          lat: place.location.lat(),
          lng: place.location.lng(),
        };
        const formatted =
          place.formattedAddress || place.displayName || event.location;
        setVenueCenter(nextPos);
        setVenueAddressLabel(formatted);
        if (map) {
          map.panTo(nextPos);
          map.setZoom(14);
        }
        if (onSelectVenueLocation) {
          onSelectVenueLocation(formatted);
        }
        void resolveVenueAndNearbyHotels(formatted);
      }
    } catch (err: unknown) {
      console.error('Error fetching selected place fields:', err);
      setStatusError(
        'Unable to fetch place details. Please check your network or API quota.'
      );
    }
  };

  // Modern Routes API: Route.computeRoutes() via useMapsLibrary('routes')
  const handleCalculateRouteToVenue = async (hotel: DiscoveredGmpPlace) => {
    if (!routesLib || !map) return;
    setStatusError(null);
    try {
      // Clear previous route polylines
      activePolylinesRef.current.forEach((line) => line.setMap(null));
      activePolylinesRef.current = [];

      const { Route } = routesLib as unknown as {
        Route: {
          computeRoutes: (req: Record<string, unknown>) => Promise<{
            routes?: Array<{
              distanceMeters?: number;
              durationMillis?: number;
              createPolylines?: () => google.maps.Polyline[];
            }>;
          }>;
        };
      };

      const response = await Route.computeRoutes({
        origin: hotel.location,
        destination: venueCenter,
        travelMode: 'DRIVING',
        fields: ['path', 'distanceMeters', 'durationMillis'],
      });

      const primaryRoute = response?.routes?.[0];
      if (primaryRoute) {
        if (typeof primaryRoute.createPolylines === 'function') {
          const polylines = primaryRoute.createPolylines();
          polylines.forEach((p) => {
            p.setOptions({
              strokeColor: '#4A6B53',
              strokeWeight: 5,
            });
            p.setMap(map);
          });
          activePolylinesRef.current = polylines;
        }
        const distKm = primaryRoute.distanceMeters
          ? `${(primaryRoute.distanceMeters / 1000).toFixed(1)} km`
          : 'Nearby';
        const durMin = primaryRoute.durationMillis
          ? `${Math.max(1, Math.round(primaryRoute.durationMillis / 60000))} min drive`
          : 'Short drive';

        setRouteSummary({
          hotelName: hotel.displayName,
          distanceText: distKm,
          durationText: durMin,
        });
      }
    } catch (err) {
      console.error('Routes API computeRoutes error:', err);
      setStatusError(
        'Unable to load route data. Please check your network or API quota.'
      );
    }
  };

  return (
    <div className="space-y-4">
      {/* Places API (New) Autocomplete Bar + Route Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[260px]">
          <div className="flex items-center gap-2 px-3.5 py-2 bg-[#FAF6EC] border border-stone-300/80 rounded-xl">
            <Search className="w-4 h-4 text-[#8C6226] shrink-0" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search venue or destination via Places API (New) Autocomplete..."
              className="w-full text-xs bg-transparent text-stone-900 placeholder:text-stone-400 focus:outline-none"
            />
            {isLoadingPlaces && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#4A6B53] shrink-0" />
            )}
          </div>

          {suggestions.length > 0 && (
            <ul className="absolute z-30 left-0 right-0 mt-1.5 bg-white border border-stone-200 rounded-2xl shadow-lg divide-y divide-stone-100 max-h-60 overflow-y-auto text-xs">
              {suggestions.map((suggestion, index) => (
                <li
                  key={index}
                  onClick={() => void handleSelectSuggestion(suggestion)}
                  className="px-4 py-2.5 hover:bg-[#FAF6EC] cursor-pointer flex items-center justify-between gap-2 text-stone-800"
                >
                  <span className="truncate font-medium">
                    {suggestion.placePrediction?.text.text}
                  </span>
                  <span className="text-[10px] font-semibold text-[#4A6B53] shrink-0">
                    Select Venue →
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {routeSummary && (
          <div className="px-3.5 py-2 rounded-xl bg-[#EDF3EE] border border-[#4A6B53]/30 text-xs text-[#2E4635] flex items-center gap-2">
            <Navigation className="w-3.5 h-3.5 text-[#4A6B53] shrink-0" />
            <span>
              Route from <strong>{routeSummary.hotelName}</strong>:{' '}
              <strong className="font-mono">{routeSummary.durationText}</strong> (
              <span className="font-mono">{routeSummary.distanceText}</span>)
            </span>
          </div>
        )}
      </div>

      {statusError && (
        <div className="px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
          {statusError}
        </div>
      )}

      {/* Mandatory Sized Parent Container (CF2) + Map with DEMO_MAP_ID (CF9) and internalUsageAttributionIds */}
      <div
        style={{ height: '420px', width: '100%' }}
        className="rounded-2xl overflow-hidden border border-stone-200/90 shadow-inner relative"
      >
        <Map
          mapId="DEMO_MAP_ID"
          defaultZoom={13}
          defaultCenter={venueCenter}
          gestureHandling="cooperative"
          disableDefaultUI={false}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        >
          <VenueAdvancedMarkerWithInfo
            position={venueCenter}
            title={event.title}
            subtitle={venueAddressLabel}
          />
          {nearbyPlaces.map((hotelPlace) => (
            <HotelAdvancedMarkerWithInfo
              key={hotelPlace.id}
              place={hotelPlace}
              onCalculateRoute={(p) => void handleCalculateRouteToVenue(p)}
            />
          ))}
        </Map>
      </div>
    </div>
  );
};

export const EventVenueAndHotelsMap: React.FC<EventVenueAndHotelsMapProps> = ({
  event,
  liveHotelDeals,
  onSelectVenueLocation,
  onLockInHotelDeal,
}) => {
  // Default: OpenStreetMap (keyless, permitted). The Google Maps JS SDK is used only when the USER
  // supplies their own Maps key (their account, their billing, their Terms acceptance).
  const [envApiKey, setEnvApiKey] = useState<string>(() => getMapsKey());
  const [keyDraft, setKeyDraft] = useState('');
  const [keyError, setKeyError] = useState<string | null>(null);
  const [selectedMapQuery, setSelectedMapQuery] = useState<string>(event.location);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [venuePoint, setVenuePoint] = useState<{ lat: number; lng: number } | null>(null);
  const [geoFailed, setGeoFailed] = useState(false);
  const [activeMapMode, setActiveMapMode] = useState<'js_sdk' | 'embed'>(envApiKey ? 'js_sdk' : 'embed');

  useEffect(() => {
    setSelectedMapQuery(event.location);
    setPin(null);
  }, [event.location]);

  // Geocode the venue (server-side, cached + rate-limited per the Nominatim policy)
  useEffect(() => {
    let cancelled = false;
    setGeoFailed(false);
    const t = setTimeout(async () => {
      const res = await postJson<{ lat: number; lng: number }>('/api/geocode', { query: event.location }, { timeoutMs: 12_000 });
      if (cancelled) return;
      if (res.ok && Number.isFinite(res.data?.lat)) setVenuePoint({ lat: res.data.lat, lng: res.data.lng });
      else {
        setVenuePoint(null);
        setGeoFailed(true);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [event.location]);

  const point = pin ?? venuePoint;
  const saveMapsKey = () => {
    if (!keyDraft.trim()) {
      setMapsKey('');
      setEnvApiKey(getMapsKey());
      setActiveMapMode('embed');
      setKeyError(null);
      return;
    }
    if (!isValidMapsKey(keyDraft)) {
      setKeyError('That does not look like a Google Maps API key.');
      return;
    }
    setMapsKey(keyDraft);
    setEnvApiKey(keyDraft.trim());
    setActiveMapMode('js_sdk');
    setKeyDraft('');
    setKeyError(null);
  };

  return (
    <div className="bg-white border border-stone-200/80 rounded-3xl p-7 sm:p-8 shadow-sm hover:shadow-md transition-shadow duration-200 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#4A6B53]">
            <Compass className="w-4 h-4" />
            <span>
              Venue &amp; Guest Hotel Map
            </span>
          </div>
          <h3 className="text-xl font-bold text-stone-900">
            Interactive Venue &amp; Nearby Hotel Map —{' '}
            {event.location.split('—')[0].trim()}
          </h3>
          <p className="text-xs text-stone-500 leading-relaxed">
            Explore your event venue and nearby guest hotels on OpenStreetMap, or bring your own Google Maps key for the interactive Google map.
          </p>
        </div>

        {/* Map Mode Switcher + External Google Maps Directions Link */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedMapQuery(event.location);
              setPin(null);
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors ${
              selectedMapQuery === event.location
                ? 'bg-[#B88B4A] text-white'
                : 'bg-[#FAF6EC] text-[#8C6226] hover:bg-[#F3E8D3]'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 inline mr-1" />
            Center on Venue
          </button>

          {envApiKey && (
            <button
              type="button"
              onClick={() =>
                setActiveMapMode((prev) =>
                  prev === 'js_sdk' ? 'embed' : 'js_sdk'
                )
              }
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#EDF3EE] text-[#4A6B53] hover:bg-[#DFECE1] transition-colors"
            >
              {activeMapMode === 'js_sdk'
                ? 'Switch to OpenStreetMap'
                : 'Switch to Google Map (my key)'}
            </button>
          )}

          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              selectedMapQuery
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors"
          >
            Open in Google Maps <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      <details className="text-xs text-stone-500">
        <summary className="cursor-pointer font-semibold text-stone-600">Use Google Maps with my own API key (optional)</summary>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="password"
            autoComplete="off"
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            placeholder={envApiKey ? 'Key saved — paste a new one or leave blank and Save to remove' : 'Maps JavaScript API key'}
            className="flex-1 min-w-[220px] px-3 py-2 border border-stone-300 rounded-xl font-mono"
          />
          <button type="button" onClick={saveMapsKey} className="px-3.5 py-2 font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl">Save</button>
        </div>
        {keyError && <p role="alert" className="mt-1 text-rose-700">{keyError}</p>}
        <p className="mt-1.5 leading-relaxed">
          Stored only in this browser. Create a key in your own Google Cloud project and restrict it to this site
          (HTTP referrers) — usage is billed to you under the{' '}
          <a href="https://cloud.google.com/maps-platform/terms" target="_blank" rel="noopener noreferrer" className="text-[#4A6B53] hover:underline">Google Maps Platform Terms</a>.
        </p>
      </details>

      {/* Quick Filter Chips to Pin Any Discovered Nearby Hotel on the Map */}
      {liveHotelDeals.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mr-1">
            Pin on Map:
          </span>
          <button
            type="button"
            onClick={() => {
              setSelectedMapQuery(event.location);
              setPin(null);
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors ${
              selectedMapQuery === event.location
                ? 'bg-stone-900 text-white border-stone-900'
                : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
            }`}
          >
            ★ Venue: {event.location.split('—')[0].trim()}
          </button>
          {liveHotelDeals.map((deal) => {
            const dealQuery = `${deal.hotel_name}, ${deal.neighborhood_or_address}`;
            const isSelected = selectedMapQuery === dealQuery;
            return (
              <button
                key={deal.id}
                type="button"
                onClick={() => {
                            setSelectedMapQuery(dealQuery);
                            setPin(typeof deal.lat === 'number' && typeof deal.lng === 'number' ? { lat: deal.lat, lng: deal.lng } : null);
                          }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors ${
                  isSelected
                    ? 'bg-[#4A6B53] text-white border-[#4A6B53]'
                    : 'bg-[#EDF3EE]/70 text-[#2E4635] border-[#4A6B53]/20 hover:bg-[#EDF3EE]'
                }`}
              >
                <Hotel className="w-3 h-3 shrink-0" />
                <span>{deal.hotel_name}</span>
                {deal.price_per_night > 0 && (
                  <span className="font-mono text-[11px] opacity-85">
                    (${deal.price_per_night}/nt)
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Render @vis.gl/react-google-maps when API key is configured, or seamless interactive Google Maps Embed */}
      {envApiKey && activeMapMode === 'js_sdk' ? (
        <APIProvider
          apiKey={envApiKey}
          libraries={['places', 'marker', 'routes']}
        >
          <GoogleMapsSdkWorkspaceInner
            event={event}
            onSelectVenueLocation={onSelectVenueLocation}
          />
        </APIProvider>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          <div
            style={{ height: '420px', width: '100%' }}
            className="lg:col-span-8 rounded-2xl overflow-hidden border border-stone-200/90 shadow-inner bg-[#FAF6EC] relative"
          >
            {point ? (
              <iframe
                title={`Map of ${selectedMapQuery}`}
                src={osmEmbedUrl(point.lat, point.lng)}
                className="w-full h-full border-0"
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-center p-6 text-xs text-stone-600">
                <MapPin className="w-6 h-6 text-[#B88B4A]" />
                {geoFailed
                  ? 'We could not locate this venue on the map. Try a more specific address, or open it in Google Maps.'
                  : 'Locating venue…'}
              </div>
            )}
          </div>

          <div className="lg:col-span-4 flex flex-col justify-between gap-4 bg-[#FAF6EC]/80 border border-stone-200/80 rounded-2xl p-5">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#B88B4A]/15 text-[#8C6226] text-[11px] font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                Pinned Location Details
              </div>
              <h4 className="text-base font-bold text-stone-900">
                {selectedMapQuery}
              </h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                Click any hotel chip above to inspect its exact neighborhood
                placement, road access, and proximity to{' '}
                <strong className="text-stone-900">{event.title}</strong>.
              </p>

              <div className="pt-2 border-t border-stone-200/70 space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                  Nearby Hotels ({liveHotelDeals.length})
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {liveHotelDeals.map((deal) => {
                    const dealQuery = `${deal.hotel_name}, ${deal.neighborhood_or_address}`;
                    return (
                      <div
                        key={deal.id}
                        className="p-2.5 rounded-xl bg-white border border-stone-200/80 flex items-center justify-between gap-2 text-xs"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMapQuery(dealQuery);
                            setPin(typeof deal.lat === 'number' && typeof deal.lng === 'number' ? { lat: deal.lat, lng: deal.lng } : null);
                          }}
                          className="text-left min-w-0 flex-1"
                        >
                          <div className="font-bold text-stone-900 truncate">
                            {deal.hotel_name}
                          </div>
                          <div className="text-[11px] text-stone-500 truncate">
                            {deal.distance_from_venue}
                            {deal.star_rating > 0 ? ` · ${deal.star_rating.toFixed(0)}★` : ''}
                          </div>
                        </button>
                        <div className="text-right shrink-0 space-y-1">
                          {deal.price_per_night > 0 && (
                            <div className="font-mono font-bold text-[#4A6B53]">
                              ${deal.price_per_night}/nt
                            </div>
                          )}
                          {onLockInHotelDeal && (
                            <button
                              type="button"
                              onClick={() => onLockInHotelDeal(deal)}
                              className="px-2 py-0.5 text-[10px] font-semibold text-white bg-[#B88B4A] hover:bg-[#9E7336] rounded-md transition-colors"
                            >
                              + Block
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-stone-200/70 text-[11px] text-stone-500 flex items-center justify-between gap-2">
              <span>
                Map ©{' '}
                <a
                  href="https://www.openstreetmap.org/copyright"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[#4A6B53] hover:underline"
                >
                  OpenStreetMap contributors
                </a>
                {point && (
                  <>
                    {' · '}
                    <a href={osmViewUrl(point.lat, point.lng)} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      larger map
                    </a>
                  </>
                )}
              </span>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                  event.location
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#8C6226] hover:underline inline-flex items-center gap-1"
              >
                Directions <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
