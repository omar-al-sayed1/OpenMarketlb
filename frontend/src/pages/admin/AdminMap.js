import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Store, Search, Save, Loader2, CheckCircle, Navigation, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import AdminLayout from '../../components/AdminLayout';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const MAP_PROVIDERS = {
  openstreetmap: { name: 'Street', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap' },
  google_roadmap: { name: 'Google', url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', attribution: '&copy; Google Maps', subdomains: [] },
  google_satellite: { name: 'Satellite', url: 'https://mt1.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', attribution: '&copy; Google Maps', subdomains: [] }
};

export default function AdminMap() {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedShop, setSelectedShop] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [newLat, setNewLat] = useState(null);
  const [newLng, setNewLng] = useState(null);
  const [saving, setSaving] = useState(false);
  const [mapProvider, setMapProvider] = useState('openstreetmap');
  const [searchQuery, setSearchQuery] = useState('');
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markersRef = useRef([]);
  const editMarkerRef = useRef(null);
  const routeLayerRef = useRef(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routing, setRouting] = useState(false);

  // Draw driving directions ON the map from admin's current location to a shop (OSRM).
  const drawRouteOnMap = (shop) => {
    if (!shop?.latitude || !shop?.longitude) return;
    if (!navigator.geolocation) { setRouteInfo({ error: 'Location not supported' }); return; }
    setRouting(true); setRouteInfo(null);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const from = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${shop.longitude},${shop.latitude}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        const route = data.routes && data.routes[0];
        const L = window.L; const map = mapInstanceRef.current;
        if (!route || !L || !map) { setRouteInfo({ error: 'Could not build a route' }); setRouting(false); return; }
        if (routeLayerRef.current) { map.removeLayer(routeLayerRef.current); routeLayerRef.current = null; }
        const coords = route.geometry.coordinates.map(([x, y]) => [y, x]);
        const line = L.polyline(coords, { color: '#caff8a', weight: 5, opacity: 0.85 });
        const startIcon = L.divIcon({ className: 'route-start', html: `<div style="background:#2563eb;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35);"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] });
        const group = L.featureGroup([line, L.marker([from.lat, from.lng], { icon: startIcon })]);
        group.addTo(map); routeLayerRef.current = group;
        map.fitBounds(line.getBounds().pad(0.15));
        setRouteInfo({ label: shop.name, dest: { lat: shop.latitude, lng: shop.longitude }, distanceKm: (route.distance / 1000).toFixed(1), durationMin: Math.round(route.duration / 60) });
      } catch { setRouteInfo({ error: 'Could not build a route' }); }
      finally { setRouting(false); }
    }, () => { setRouteInfo({ error: 'Allow location access to get directions' }); setRouting(false); }, { enableHighAccuracy: true, timeout: 8000 });
  };

  useEffect(() => { fetchShops(); }, []);

  useEffect(() => {
    if (!loading && shops.length >= 0) {
      setTimeout(() => initMap(), 200);
    }
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [loading]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const L = window.L;
    const provider = MAP_PROVIDERS[mapProvider];
    if (tileLayerRef.current) mapInstanceRef.current.removeLayer(tileLayerRef.current);
    const options = { attribution: provider.attribution, maxZoom: 19 };
    if (provider.subdomains) options.subdomains = provider.subdomains;
    tileLayerRef.current = L.tileLayer(provider.url, options).addTo(mapInstanceRef.current);
  }, [mapProvider]);

  const fetchShops = async () => {
    try {
      const { data } = await api.admin.getShops();
      setShops(data || []);
    } catch (err) {
      console.error('Failed to fetch shops:', err);
    } finally {
      setLoading(false);
    }
  };

  const initMap = () => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const L = window.L;
    if (!L) return;

    const map = L.map(mapRef.current).setView([33.8938, 35.5018], 9);
    mapInstanceRef.current = map;

    const provider = MAP_PROVIDERS[mapProvider];
    const options = { attribution: provider.attribution, maxZoom: 19 };
    if (provider.subdomains) options.subdomains = provider.subdomains;
    tileLayerRef.current = L.tileLayer(provider.url, options).addTo(map);

    addShopMarkers(map, L);
  };

  const addShopMarkers = (map, L) => {
    // Clear existing markers
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];

    shops.forEach(shop => {
      if (!shop.latitude || !shop.longitude) return;
      
      const icon = L.divIcon({
        className: 'custom-shop-marker',
        html: `<div style="background:${shop.is_verified ? '#10b981' : '#5df6fc'};width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      });

      const marker = L.marker([shop.latitude, shop.longitude], { icon }).addTo(map);
      marker.bindPopup(`
        <div style="min-width:180px;font-family:system-ui;">
          <strong style="font-size:14px;">${shop.name}</strong>
          <br/><span style="color:#64748b;font-size:11px;">${shop.state || ''} ${shop.city || ''}</span>
          <br/><span style="color:#64748b;font-size:10px;">Tier: ${shop.tier || 'starter'} ${shop.is_verified ? '✅ Verified' : ''}</span>
          <br/><span style="color:#94a3b8;font-size:10px;">Lat: ${shop.latitude?.toFixed(5)}, Lng: ${shop.longitude?.toFixed(5)}</span>
          <br/><button onclick="(function(){navigator.geolocation.getCurrentPosition(function(p){window.open('https://www.google.com/maps/dir/'+p.coords.latitude+','+p.coords.longitude+'/${shop.latitude},${shop.longitude}','_blank')},function(){window.open('https://www.google.com/maps/dir/?api=1&destination=${shop.latitude},${shop.longitude}&travelmode=driving','_blank')},{enableHighAccuracy:true,timeout:5000})})()" style="margin-top:6px;display:inline-flex;align-items:center;gap:4px;font-size:11px;color:white;font-weight:600;padding:4px 10px;border-radius:6px;background:linear-gradient(135deg,#10b981,#059669);border:none;cursor:pointer;">🧭 Get Directions</button>
        </div>
      `);

      marker.on('click', () => {
        setSelectedShop(shop);
        setNewLat(shop.latitude);
        setNewLng(shop.longitude);
        setEditMode(false);
      });

      markersRef.current.push(marker);
    });

    // Fit bounds if markers exist
    if (markersRef.current.length > 0) {
      const group = L.featureGroup(markersRef.current);
      map.fitBounds(group.getBounds().pad(0.1));
    }
  };

  const handleEditLocation = () => {
    setEditMode(true);
    if (!mapInstanceRef.current || !selectedShop) return;
    const L = window.L;

    // Remove existing edit marker
    if (editMarkerRef.current) {
      mapInstanceRef.current.removeLayer(editMarkerRef.current);
    }

    const lat = selectedShop.latitude || 33.8938;
    const lng = selectedShop.longitude || 35.5018;

    const editIcon = L.divIcon({
      className: 'edit-marker',
      html: `<div style="background:#ef4444;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 12px rgba(239,68,68,0.5);animation:pulse 1.5s infinite;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      </div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 36]
    });

    const editMarker = L.marker([lat, lng], { icon: editIcon, draggable: true }).addTo(mapInstanceRef.current);
    editMarkerRef.current = editMarker;

    editMarker.on('dragend', (e) => {
      const pos = e.target.getLatLng();
      setNewLat(pos.lat);
      setNewLng(pos.lng);
    });

    mapInstanceRef.current.on('click', (e) => {
      const { lat: clickLat, lng: clickLng } = e.latlng;
      setNewLat(clickLat);
      setNewLng(clickLng);
      editMarker.setLatLng([clickLat, clickLng]);
    });

    mapInstanceRef.current.setView([lat, lng], 14);
  };

  const handleSaveLocation = async () => {
    if (!selectedShop || newLat === null || newLng === null) return;
    setSaving(true);
    try {
      await api.admin.updateShop(selectedShop.id, { latitude: newLat, longitude: newLng });
      toast.success(`Location updated for ${selectedShop.name}`);
      setEditMode(false);
      if (editMarkerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(editMarkerRef.current);
        editMarkerRef.current = null;
      }
      // Refresh shops and re-render markers
      const { data } = await api.admin.getShops();
      setShops(data || []);
      if (mapInstanceRef.current) {
        addShopMarkers(mapInstanceRef.current, window.L);
      }
      setSelectedShop(prev => prev ? { ...prev, latitude: newLat, longitude: newLng } : null);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save location');
    } finally {
      setSaving(false);
    }
  };

  // Use the browser's current location for the editing shop
  const handleUseCurrentLocation = () => {
    if (!editMode) {
      handleEditLocation();
    }
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    toast.info('Detecting your current location...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setNewLat(latitude);
        setNewLng(longitude);
        if (editMarkerRef.current) {
          editMarkerRef.current.setLatLng([latitude, longitude]);
        }
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([latitude, longitude], 15);
        }
        toast.success('Location set to your current position');
      },
      (err) => {
        console.error(err);
        if (err.code === 1) {
          toast.error('Location access denied. Please allow location in your browser settings.');
        } else if (err.code === 2) {
          toast.error('Location unavailable. Try again or set manually.');
        } else if (err.code === 3) {
          toast.error('Location request timed out. Please retry.');
        } else {
          toast.error('Failed to get current location');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    if (editMarkerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(editMarkerRef.current);
      editMarkerRef.current = null;
    }
    // Remove click listener
    if (mapInstanceRef.current) {
      mapInstanceRef.current.off('click');
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`);
      const results = await response.json();
      if (results.length > 0 && mapInstanceRef.current) {
        mapInstanceRef.current.setView([parseFloat(results[0].lat), parseFloat(results[0].lon)], 14);
      } else {
        toast.error('Location not found');
      }
    } catch { toast.error('Search failed'); }
  };

  const shopsWithLocation = shops.filter(s => s.latitude && s.longitude);
  const shopsWithoutLocation = shops.filter(s => !s.latitude || !s.longitude);

  return (
    <AdminLayout>
      <div className="p-3 sm:p-5 lg:p-6 h-[calc(100vh-44px)] flex flex-col" data-testid="admin-map-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200">
              <MapPin className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Shops Map</h1>
              <p className="text-slate-500 text-xs">{shopsWithLocation.length} shops on map · {shopsWithoutLocation.length} without location</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search location..."
                className="pl-9 h-9 rounded-xl"
                data-testid="admin-map-search"
              />
            </div>
            <Button onClick={handleSearch} size="sm" variant="outline" className="rounded-xl h-9">
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Map Provider Toggle */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-full p-0.5 mb-3 w-fit">
          {Object.entries(MAP_PROVIDERS).map(([key, prov]) => (
            <button key={key} onClick={() => setMapProvider(key)}
              className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${mapProvider === key ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {prov.name}
            </button>
          ))}
        </div>

        {(routing || routeInfo) && (
          <div className="flex items-center justify-between gap-2 mb-3 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm" data-testid="admin-map-route-info">
            {routing ? (
              <span className="flex items-center gap-2 text-indigo-700"><Loader2 className="h-4 w-4 animate-spin" /> Building route from your location…</span>
            ) : routeInfo?.error ? (
              <span className="text-amber-700">{routeInfo.error}</span>
            ) : (
              <span className="text-indigo-800"><Navigation className="h-4 w-4 inline mr-1 text-indigo-600" /><strong>Route to {routeInfo.label}</strong> — {routeInfo.distanceKm} km · ~{routeInfo.durationMin} min</span>
            )}
            {routeInfo && !routeInfo.error && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${routeInfo.dest.lat},${routeInfo.dest.lng}&travelmode=driving`, '_blank')} className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-full px-3 py-1"><Navigation className="h-3.5 w-3.5" /> Start</button>
                <button onClick={() => { const m = mapInstanceRef.current; if (m && routeLayerRef.current) { m.removeLayer(routeLayerRef.current); routeLayerRef.current = null; } setRouteInfo(null); }} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Clear</button>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 flex gap-4 min-h-0">
          {/* Map */}
          <div className="flex-1 rounded-xl overflow-hidden border border-slate-200 shadow-sm relative">
            {loading ? (
              <div className="flex items-center justify-center h-full bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
              </div>
            ) : (
              <div ref={mapRef} style={{ height: '100%', width: '100%' }} data-testid="admin-map" />
            )}
          </div>

          {/* Side Panel */}
          <div className="hidden lg:flex w-80 flex-col gap-3 overflow-y-auto">
            {/* Selected shop panel */}
            {selectedShop && (
              <Card className="border border-slate-200 shadow-sm" data-testid="selected-shop-panel">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
                        <Store className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-slate-900">{selectedShop.name}</p>
                        <p className="text-[10px] text-slate-400">{selectedShop.state || ''}</p>
                      </div>
                    </div>
                    <button onClick={() => { setSelectedShop(null); handleCancelEdit(); }} className="text-slate-400 hover:text-slate-600">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {selectedShop.latitude && selectedShop.longitude && (
                    <button onClick={() => drawRouteOnMap(selectedShop)} className="w-full mb-3 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg py-2 transition-colors" data-testid="admin-shop-directions-btn">
                      <Navigation className="h-3.5 w-3.5" /> Directions on map
                    </button>
                  )}

                  <div className="space-y-2 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>Latitude:</span>
                      <span className="font-mono">{editMode ? newLat?.toFixed(6) : selectedShop.latitude?.toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Longitude:</span>
                      <span className="font-mono">{editMode ? newLng?.toFixed(6) : selectedShop.longitude?.toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Tier:</span>
                      <Badge variant="outline" className="text-[10px]">{selectedShop.tier || 'starter'}</Badge>
                    </div>
                    {selectedShop.is_verified && (
                      <div className="flex items-center gap-1 text-emerald-600">
                        <CheckCircle className="h-3 w-3" /> Verified Seller
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100">
                    {!editMode ? (
                      <div className="space-y-2">
                        <Button onClick={handleEditLocation} size="sm" className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-xs" data-testid="edit-shop-location-btn">
                          <MapPin className="h-3.5 w-3.5 mr-1.5" /> Change Location
                        </Button>
                        <Button onClick={handleUseCurrentLocation} variant="outline" size="sm" className="w-full rounded-xl text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50" data-testid="use-current-location-btn">
                          <Navigation className="h-3.5 w-3.5 mr-1.5" /> Use Current Location
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[10px] text-amber-600 font-medium">Drag the red marker, click on the map, or use your current location</p>
                        <Button onClick={handleUseCurrentLocation} variant="outline" size="sm" className="w-full rounded-xl text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50" data-testid="use-current-location-edit-btn">
                          <Navigation className="h-3.5 w-3.5 mr-1.5" /> Use My Current Location
                        </Button>
                        <div className="flex gap-2">
                          <Button onClick={handleSaveLocation} disabled={saving} size="sm" className="flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-xs" data-testid="save-shop-location-btn">
                            {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                            Save
                          </Button>
                          <Button onClick={handleCancelEdit} variant="outline" size="sm" className="flex-1 rounded-xl text-xs">
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Shops without location */}
            {shopsWithoutLocation.length > 0 && (
              <Card className="border border-amber-200 bg-amber-50/50">
                <CardContent className="p-3">
                  <p className="text-xs font-semibold text-amber-800 mb-2">Shops without location ({shopsWithoutLocation.length})</p>
                  <p className="text-[10px] text-amber-600 mb-2">Click a shop to set its location on the map</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {shopsWithoutLocation.map(s => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setSelectedShop(s);
                          setNewLat(33.8938);
                          setNewLng(35.5018);
                          setEditMode(false);
                          // Auto-enter edit mode for shops without location
                          setTimeout(() => {
                            handleEditLocation();
                          }, 100);
                        }}
                        className={`w-full flex items-center gap-2 text-xs text-left text-amber-700 rounded-lg p-2 border transition-colors cursor-pointer ${
                          selectedShop?.id === s.id ? 'bg-amber-100 border-amber-300' : 'bg-white/60 border-amber-100 hover:bg-amber-100'
                        }`}
                        data-testid={`admin-map-noloc-shop-${s.id}`}
                      >
                        <Store className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate flex-1">{s.name}</span>
                        <MapPin className="h-3 w-3 text-amber-500 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* All shops list */}
            <Card className="border border-slate-200 flex-1 min-h-0">
              <CardContent className="p-3">
                <p className="text-xs font-semibold text-slate-700 mb-2">All Shops ({shops.length})</p>
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {shops.filter(s => s.latitude && s.longitude).map(s => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedShop(s);
                        setNewLat(s.latitude);
                        setNewLng(s.longitude);
                        setEditMode(false);
                        if (mapInstanceRef.current) mapInstanceRef.current.setView([s.latitude, s.longitude], 14);
                      }}
                      className={`w-full flex items-center gap-2 text-xs text-left rounded-lg p-2 transition-colors ${
                        selectedShop?.id === s.id ? 'bg-violet-50 border border-violet-200 text-violet-700' : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                      }`}
                      data-testid={`admin-map-shop-${s.id}`}
                    >
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.is_verified ? 'bg-emerald-500' : 'bg-violet-400'}`} />
                      <span className="truncate flex-1 font-medium">{s.name}</span>
                      <span className="text-[9px] text-slate-400">{s.tier}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
