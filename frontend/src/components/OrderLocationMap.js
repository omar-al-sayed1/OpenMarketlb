import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Store, Navigation, Loader2, Map as MapIcon, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MapLocationSearch from './MapLocationSearch';

const MAP_PROVIDERS = {
  openstreetmap: { name: 'Street', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap' },
  google_roadmap: { name: 'Google', url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', attribution: '&copy; Google Maps', subdomains: [] },
  google_satellite: { name: 'Satellite', url: 'https://mt1.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', attribution: '&copy; Google Maps', subdomains: [] }
};

const OrderLocationMap = ({ shops = [], customerLocation = null, open, onOpenChange }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const [mapProvider, setMapProvider] = useState('openstreetmap');
  const [mapReady, setMapReady] = useState(false);
  const initAttemptRef = useRef(null);
  const searchMarkerRef = useRef(null);
  const routeLayerRef = useRef(null);
  const [routeInfo, setRouteInfo] = useState(null); // { label, distanceKm, durationMin }
  const [routing, setRouting] = useState(false);

  // Draw driving directions ON the map from the user's current location to a destination
  // using the free OSRM routing service (no external tab, no extra library).
  const drawRoute = ({ lat, lng, label }) => {
    if (!navigator.geolocation) { setRouteInfo({ error: 'Location not supported on this device' }); return; }
    setRouting(true);
    setRouteInfo(null);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const from = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${lng},${lat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        const route = data.routes && data.routes[0];
        const L = window.L;
        const map = mapInstanceRef.current;
        if (!route || !L || !map) { setRouteInfo({ error: 'Could not build a route' }); setRouting(false); return; }
        if (routeLayerRef.current) { map.removeLayer(routeLayerRef.current); routeLayerRef.current = null; }
        const coords = route.geometry.coordinates.map(([x, y]) => [y, x]); // GeoJSON is [lng,lat]
        const line = L.polyline(coords, { color: '#caff8a', weight: 5, opacity: 0.85 });
        // Start marker (your location)
        const startIcon = L.divIcon({ className: 'route-start', html: `<div style="background:#2563eb;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35);"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] });
        const group = L.featureGroup([line, L.marker([from.lat, from.lng], { icon: startIcon })]);
        group.addTo(map);
        routeLayerRef.current = group;
        map.fitBounds(line.getBounds().pad(0.15));
        setRouteInfo({ label, dest: { lat, lng }, distanceKm: (route.distance / 1000).toFixed(1), durationMin: Math.round(route.duration / 60) });
      } catch (e) {
        setRouteInfo({ error: 'Could not build a route' });
      } finally {
        setRouting(false);
      }
    }, () => {
      setRouteInfo({ error: 'Allow location access to get directions' });
      setRouting(false);
    }, { enableHighAccuracy: true, timeout: 8000 });
  };

  const clearRoute = () => {
    const map = mapInstanceRef.current;
    if (map && routeLayerRef.current) { map.removeLayer(routeLayerRef.current); routeLayerRef.current = null; }
    setRouteInfo(null);
  };

  const flyToLocation = ({ lat, lng, label }) => {
    const L = window.L;
    const map = mapInstanceRef.current;
    if (!L || !map) return;
    if (searchMarkerRef.current) { map.removeLayer(searchMarkerRef.current); searchMarkerRef.current = null; }
    const icon = L.divIcon({
      className: 'custom-search-marker',
      html: `<div style="background:linear-gradient(135deg,#f59e0b,#d97706);width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 3px 12px rgba(245,158,11,0.45);">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      </div>`,
      iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32],
    });
    searchMarkerRef.current = L.marker([lat, lng], { icon }).addTo(map);
    if (label) searchMarkerRef.current.bindPopup(`<div style="font-size:12px;max-width:200px;">${label}</div>`).openPopup();
    map.flyTo([lat, lng], 15, { duration: 1.0 });
  };

  useEffect(() => {
    if (open) {
      // Try multiple times to init the map as dialog animates in
      let attempts = 0;
      const tryInit = () => {
        attempts++;
        if (mapRef.current && !mapInstanceRef.current) {
          const rect = mapRef.current.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            initMap();
            setTimeout(() => {
              if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
            }, 100);
            return;
          }
        }
        if (attempts < 20 && !mapInstanceRef.current) {
          initAttemptRef.current = setTimeout(tryInit, 150);
        }
      };
      initAttemptRef.current = setTimeout(tryInit, 200);
    }
    return () => {
      if (initAttemptRef.current) clearTimeout(initAttemptRef.current);
      if (!open && mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        setMapReady(false);
      }
    };
  }, [open]);

  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    const L = window.L;
    if (!L) return;
    const provider = MAP_PROVIDERS[mapProvider];
    if (tileLayerRef.current) mapInstanceRef.current.removeLayer(tileLayerRef.current);
    const options = { attribution: provider.attribution, maxZoom: 19 };
    if (provider.subdomains) options.subdomains = provider.subdomains;
    tileLayerRef.current = L.tileLayer(provider.url, options).addTo(mapInstanceRef.current);
  }, [mapProvider, mapReady]);

  const initMap = () => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const L = window.L;
    if (!L) return;

    const map = L.map(mapRef.current).setView([33.85, 35.5], 9);
    mapInstanceRef.current = map;

    const provider = MAP_PROVIDERS[mapProvider];
    const options = { attribution: provider.attribution, maxZoom: 19 };
    if (provider.subdomains) options.subdomains = provider.subdomains;
    tileLayerRef.current = L.tileLayer(provider.url, options).addTo(map);

    const markers = [];

    // Add shop markers
    shops.forEach(shop => {
      if (!shop.shop_latitude || !shop.shop_longitude) return;
      const icon = L.divIcon({
        className: 'custom-shop-marker',
        html: `<div style="background:linear-gradient(135deg,#b4f56a,#5df6fc);width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 3px 12px rgba(99,102,241,0.45);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
        </div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -36]
      });
      const marker = L.marker([shop.shop_latitude, shop.shop_longitude], { icon }).addTo(map);
      marker.bindPopup(`
        <div style="min-width:160px;font-family:system-ui;padding:4px 0;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
            <div style="background:linear-gradient(135deg,#b4f56a,#5df6fc);width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
            </div>
            <strong style="font-size:13px;color:#1e293b;">${shop.shop_name}</strong>
          </div>
          ${shop.shop_address ? `<p style="font-size:11px;color:#64748b;margin:2px 0;">${shop.shop_address}</p>` : ''}
          ${shop.shop_state ? `<p style="font-size:10px;color:#94a3b8;margin:2px 0;">${shop.shop_state}</p>` : ''}
          <p style="font-size:10px;color:#5df6fc;margin:4px 0 0;font-weight:600;">${shop.items_count || 0} items</p>
        </div>
      `);
      markers.push(marker);
    });

    // Add customer marker
    if (customerLocation && customerLocation.lat && customerLocation.lng) {
      const custIcon = L.divIcon({
        className: 'custom-customer-marker',
        html: `<div style="background:linear-gradient(135deg,#10b981,#059669);width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 3px 12px rgba(16,185,129,0.45);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -36]
      });
      const custMarker = L.marker([customerLocation.lat, customerLocation.lng], { icon: custIcon }).addTo(map);
      custMarker.bindPopup(`
        <div style="font-family:system-ui;padding:4px 0;">
          <div style="display:flex;align-items:center;gap:6px;">
            <div style="background:linear-gradient(135deg,#10b981,#059669);width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <strong style="font-size:13px;color:#1e293b;">Customer Location</strong>
          </div>
          <p style="font-size:10px;color:#94a3b8;margin:4px 0 0;">Lat: ${customerLocation.lat.toFixed(5)}, Lng: ${customerLocation.lng.toFixed(5)}</p>
        </div>
      `);
      markers.push(custMarker);

      // Draw lines from shops to customer
      shops.forEach(shop => {
        if (!shop.shop_latitude || !shop.shop_longitude) return;
        L.polyline(
          [[shop.shop_latitude, shop.shop_longitude], [customerLocation.lat, customerLocation.lng]],
          { color: '#5df6fc', weight: 2, opacity: 0.6, dashArray: '8, 8' }
        ).addTo(map);
      });
    }

    // Fit bounds
    if (markers.length > 0) {
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.2));
      if (markers.length === 1) map.setZoom(14);
    }

    setMapReady(true);
  };

  const hasShopLocations = shops.some(s => s.shop_latitude && s.shop_longitude);
  const hasCustomerLocation = customerLocation && customerLocation.lat && customerLocation.lng;

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val && mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        routeLayerRef.current = null;
        setRouteInfo(null);
        setMapReady(false);
      }
      onOpenChange(val);
    }}>
      <DialogContent className="max-w-5xl w-[96vw] max-h-[92vh] overflow-y-auto" data-testid="order-location-map-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapIcon className="h-5 w-5 text-violet-600" />
            Order Locations Map
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Location Search */}
          <MapLocationSearch
            onSelect={flyToLocation}
            accent="violet"
            placeholder="Search a location, city, area..."
            data-testid="order-map-location-search"
          />
          {/* Map Provider Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-full p-0.5 w-fit">
            {Object.entries(MAP_PROVIDERS).map(([key, prov]) => (
              <button key={key} onClick={() => setMapProvider(key)}
                className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${mapProvider === key ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                data-testid={`map-provider-${key}`}>
                {prov.name}
              </button>
            ))}
          </div>

          {/* Map */}
          <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm relative" style={{ height: '520px' }}>
            <div ref={mapRef} style={{ height: '100%', width: '100%' }} data-testid="order-location-map" />
          </div>

          {/* In-map route info */}
          {(routing || routeInfo) && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm" data-testid="route-info">
              {routing ? (
                <span className="flex items-center gap-2 text-indigo-700"><Loader2 className="h-4 w-4 animate-spin" /> Building route from your location…</span>
              ) : routeInfo?.error ? (
                <span className="text-amber-700">{routeInfo.error}</span>
              ) : (
                <span className="text-indigo-800"><Navigation className="h-4 w-4 inline mr-1 text-indigo-600" /><strong>{routeInfo.label}</strong> — {routeInfo.distanceKm} km · ~{routeInfo.durationMin} min</span>
              )}
              {routeInfo && !routeInfo.error && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${routeInfo.dest.lat},${routeInfo.dest.lng}&travelmode=driving`, '_blank')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-full px-3 py-1"
                    data-testid="route-start-btn"
                  >
                    <Navigation className="h-3.5 w-3.5" /> Start
                  </button>
                  <button onClick={clearRoute} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Clear</button>
                </div>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-xs text-slate-600">
            {hasShopLocations && (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                  <Store className="h-3 w-3 text-white" />
                </div>
                <span>Shop Location</span>
              </div>
            )}
            {hasCustomerLocation && (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center">
                  <MapPin className="h-3 w-3 text-white" />
                </div>
                <span>Customer Location</span>
              </div>
            )}
            {!hasShopLocations && !hasCustomerLocation && (
              <div className="text-amber-600 text-sm font-medium">No location data available for this order.</div>
            )}
          </div>

          {/* Get Directions Buttons */}
          {(hasShopLocations || hasCustomerLocation) && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Get Directions</h4>
              {shops.filter(s => s.shop_latitude && s.shop_longitude).map((shop, idx) => {
                const openGm = () => navigator.geolocation.getCurrentPosition(
                  (pos) => window.open(`https://www.google.com/maps/dir/${pos.coords.latitude},${pos.coords.longitude}/${shop.shop_latitude},${shop.shop_longitude}`, '_blank'),
                  () => window.open(`https://www.google.com/maps/dir/?api=1&destination=${shop.shop_latitude},${shop.shop_longitude}&travelmode=driving`, '_blank'),
                  { enableHighAccuracy: true, timeout: 5000 }
                );
                return (
                  <div key={`shop-dir-${idx}`} className="flex items-center gap-2">
                    <button
                      onClick={() => drawRoute({ lat: shop.shop_latitude, lng: shop.shop_longitude, label: `Directions to ${shop.shop_name}` })}
                      className="flex items-center gap-3 p-3 bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-xl hover:from-indigo-100 hover:to-violet-100 transition-colors group flex-1 text-left"
                      data-testid={`get-directions-to-shop-${idx}`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center flex-shrink-0">
                        <Store className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-indigo-900">Directions to {shop.shop_name}</p>
                        <p className="text-[10px] text-indigo-600 truncate">Draws the route on the map from your location</p>
                      </div>
                      <Navigation className="h-4 w-4 text-indigo-400 group-hover:text-indigo-600 transition-colors flex-shrink-0" />
                    </button>
                    <button onClick={openGm} title="Open in Google Maps" className="p-3 rounded-xl border border-indigo-200 text-indigo-500 hover:bg-indigo-50 flex-shrink-0"><ExternalLink className="h-4 w-4" /></button>
                  </div>
                );
              })}
              {hasCustomerLocation && (() => {
                const openGm = () => navigator.geolocation.getCurrentPosition(
                  (pos) => window.open(`https://www.google.com/maps/dir/${pos.coords.latitude},${pos.coords.longitude}/${customerLocation.lat},${customerLocation.lng}`, '_blank'),
                  () => window.open(`https://www.google.com/maps/dir/?api=1&destination=${customerLocation.lat},${customerLocation.lng}&travelmode=driving`, '_blank'),
                  { enableHighAccuracy: true, timeout: 5000 }
                );
                return (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => drawRoute({ lat: customerLocation.lat, lng: customerLocation.lng, label: 'Directions to Customer' })}
                      className="flex items-center gap-3 p-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl hover:from-emerald-100 hover:to-teal-100 transition-colors group flex-1 text-left"
                      data-testid="get-directions-to-customer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0">
                        <MapPin className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-emerald-900">Directions to Customer</p>
                        <p className="text-[10px] text-emerald-600 truncate">Draws the route on the map from your location</p>
                      </div>
                      <Navigation className="h-4 w-4 text-emerald-400 group-hover:text-emerald-600 transition-colors flex-shrink-0" />
                    </button>
                    <button onClick={openGm} title="Open in Google Maps" className="p-3 rounded-xl border border-emerald-200 text-emerald-500 hover:bg-emerald-50 flex-shrink-0"><ExternalLink className="h-4 w-4" /></button>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrderLocationMap;
