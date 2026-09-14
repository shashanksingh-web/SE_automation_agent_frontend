import { useEffect, useMemo, useState } from "react";
import { GoogleMap, DirectionsRenderer, Marker, useJsApiLoader } from "@react-google-maps/api";
import type { RoutePlan, RouteStop } from "@/shared/types/routing";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

// Must be a stable reference across renders (useJsApiLoader reloads the script if this
// array's identity changes) - a module-level constant, not created inside the component.
const GOOGLE_MAPS_LIBRARIES: "places"[] = [];

// RoutePlan.origin_basis (rewritten 2026-09-04 - see planning/models.py's
// ORIGIN_BASIS_CHOICES) - a plain CharField on the backend, not an enum here, so an
// unrecognized value still renders as-is (the raw string) rather than breaking.
const ORIGIN_BASIS_LABELS: Record<string, string> = {
  prev_30d_punch_in: "majority of last 30 days' punch-ins (500m cluster)",
  prev_day_punch_in: "previous working day's punch-in (legacy, pre-2026-09-04)",
};

function hasGeo(stop: RouteStop): stop is RouteStop & { latitude: number; longitude: number } {
  return stop.latitude != null && stop.longitude != null;
}

// §10 - real embedded Google Map (switched from Leaflet/OpenStreetMap 2026-09-15,
// explicit user request: "real dc mapped and route visible according to google map
// api"). Plots the origin pin (origin_lat/lon) plus one pin per stop that has real
// geo (planning/routing.py's list_route_plans now joins DC_Master_Normalized.json for
// this - see RouteStop's own note on why some stops still won't have it), and asks
// Google's own DirectionsService for the real road path through them in the algorithm's
// chosen order (waypoints, optimizeWaypoints: false - Google is never asked to
// re-sequence a route the Routing Agent already decided, same convention as the
// backend's own google_directions_route_legs).
export function RouteMap({ plan }: { plan: RoutePlan }) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: GOOGLE_MAPS_API_KEY ?? "",
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const geoStops = useMemo(() => plan.stops.filter(hasGeo), [plan.stops]);
  const missingGeoCount = plan.stops.length - geoStops.length;

  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [directionsError, setDirectionsError] = useState<string | null>(null);

  // Keyed on the actual ordered coordinates so a re-fetch only happens when the route
  // itself changes (a new plan, not just this component re-rendering).
  const routeKey = useMemo(
    () =>
      JSON.stringify([
        plan.origin_lat,
        plan.origin_lon,
        geoStops.map((s) => [s.dc_id, s.latitude, s.longitude]),
      ]),
    [plan.origin_lat, plan.origin_lon, geoStops],
  );

  useEffect(() => {
    setDirections(null);
    setDirectionsError(null);
    if (!isLoaded || plan.origin_lat == null || plan.origin_lon == null || geoStops.length === 0) return;

    const origin = { lat: plan.origin_lat, lng: plan.origin_lon };
    const directionsService = new google.maps.DirectionsService();
    directionsService.route(
      {
        origin,
        destination: origin, // closed loop, R3.3 - same convention as the backend's own Directions call
        waypoints: geoStops.map((s) => ({ location: { lat: s.latitude, lng: s.longitude }, stopover: true })),
        optimizeWaypoints: false, // the Routing Agent already chose this order - Google only draws it
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          setDirections(result);
        } else {
          setDirectionsError(`Could not load the real road route from Google Maps (${status}).`);
        }
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- routeKey is the intentional dependency
  }, [isLoaded, routeKey]);

  if (plan.origin_lat == null || plan.origin_lon == null) {
    return (
      <div className="flex h-64 items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground">
        No origin geo available for this plan.
      </div>
    );
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="flex h-64 items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground">
        Map unavailable - VITE_GOOGLE_MAPS_API_KEY isn't configured.
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-64 items-center justify-center rounded-md border bg-destructive/10 text-sm text-destructive">
        Google Maps failed to load - check VITE_GOOGLE_MAPS_API_KEY's referrer restriction in Google Cloud Console.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-64 items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground">
        Loading map...
      </div>
    );
  }

  const origin = { lat: plan.origin_lat, lng: plan.origin_lon };

  return (
    <div className="space-y-1">
      <div className="h-64 overflow-hidden rounded-md border">
        <GoogleMap
          center={origin}
          zoom={11}
          mapContainerClassName="h-full w-full"
          options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
        >
          {directions ? (
            <DirectionsRenderer directions={directions} options={{ suppressMarkers: true }} />
          ) : null}

          <Marker
            position={origin}
            label={{ text: "O", color: "white", fontSize: "11px", fontWeight: "bold" }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 9,
              fillColor: "#0f766e",
              fillOpacity: 1,
              strokeColor: "white",
              strokeWeight: 2,
            }}
            title={`Origin${plan.origin_basis ? ` - ${ORIGIN_BASIS_LABELS[plan.origin_basis] ?? plan.origin_basis}` : ""}`}
          />

          {geoStops.map((stop) => (
            <Marker
              key={stop.dc_id}
              position={{ lat: stop.latitude, lng: stop.longitude }}
              label={{ text: String(stop.sequence_no), color: "white", fontSize: "11px", fontWeight: "bold" }}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: "#1d4ed8",
                fillOpacity: 1,
                strokeColor: "white",
                strokeWeight: 2,
              }}
              title={`${stop.sequence_no}. ${stop.dc_name ?? stop.dc_id} - ${stop.purposes}`}
            />
          ))}
        </GoogleMap>
      </div>
      {directionsError && <p className="text-xs text-destructive">{directionsError}</p>}
      {missingGeoCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {geoStops.length} of {plan.stops.length} stops shown on the map - {missingGeoCount} DC
          {missingGeoCount === 1 ? " has" : "s have"} no location on file.
        </p>
      )}
    </div>
  );
}
