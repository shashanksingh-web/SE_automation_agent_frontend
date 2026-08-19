import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import type { RoutePlan } from "@/shared/types/routing";

// Leaflet's default marker icon references image URLs that don't resolve under
// bundlers unless re-pointed - use an inline DivIcon instead.
const originIcon = new L.DivIcon({
  html: '<div style="background:#0f766e;width:14px;height:14px;border-radius:9999px;border:2px solid white;box-shadow:0 0 0 1px #0f766e"></div>',
  className: "",
  iconSize: [14, 14],
});

// §10 - plots origin (origin_lat/lon) as the first pin, labeled with origin_basis.
// stops[] carries no lat/lon (only directory/dcs/, §6, has DC geo) so individual
// stops render as the ordered list beside this map, not as additional pins.
export function RouteMap({ plan }: { plan: RoutePlan }) {
  if (plan.origin_lat == null || plan.origin_lon == null) {
    return (
      <div className="flex h-48 items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground">
        No origin geo available for this plan.
      </div>
    );
  }

  const center: [number, number] = [plan.origin_lat, plan.origin_lon];

  return (
    <div className="h-56 overflow-hidden rounded-md border">
      <MapContainer center={center} zoom={11} className="h-full w-full">
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={center} icon={originIcon}>
          <Popup>Origin{plan.origin_basis && ` - ${plan.origin_basis}`}</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
