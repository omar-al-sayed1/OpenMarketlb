import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MapPin, Store, ExternalLink, Loader2, Map as MapIcon, Navigation, X, Filter, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '../lib/api';
import { toast } from 'sonner';
import EndOfPagePromos from '../components/EndOfPagePromos';
import MapLocationSearch from '../components/MapLocationSearch';

const MAP_PROVIDERS = {
  openstreetmap: {
    name: 'Street Map',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors'
  },
  google_roadmap: {
    name: 'Google Maps',
    url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps',
    subdomains: ['0', '1', '2', '3']
  },
  google_satellite: {
    name: 'Satellite',
    url: 'https://mt{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps',
    subdomains: ['0', '1', '2', '3']
  }
};

const ShopsMapPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const singleShopId = searchParams.get('shop');
  const [shops, setShops] = useState([]);
  const [filteredShops, setFilteredShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [nearMeActive, setNearMeActive] = useState(false);
  const [nearMeRadius, setNearMeRadius] = useState(10);
  const [mapProvider, setMapProvider] = useState('openstreetmap');
  const [stateFilter, setStateFilter] = useState('all');
  const [availableStates, setAvailableStates] = useState([]);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markersRef = useRef([]);
  const userMarkerRef = useRef(null);
  const radiusCircleRef = useRef(null);
  const routeLayerRef = useRef(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routing, setRouting] = useState(false);

  // Draw driving directions ON the map from the user's location to a shop (OSRM).
  const drawRouteOnMap = (shop) => {
    const doRoute = async (from) => {
      setRouting(true); setRouteInfo(null);
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${shop.longitude},${shop.latitude}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        const route = data.routes && data.routes[0];
        const L = window.L; const map = mapInstanceRef.current;
        if (!route || !L || !map) { setRouteInfo({ error: 'Could not build a route' }); return; }
        if (routeLayerRef.current) { map.removeLayer(routeLayerRef.current); routeLayerRef.current = null; }
        const coords = route.geometry.coordinates.map(([x, y]) => [y, x]);
        const line = L.polyline(coords, { color: '#caff8a', weight: 5, opacity: 0.85 });
        const startIcon = L.divIcon({ className: 'route-start', html: `<div style="background:#2563eb;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35);"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] });
        const group = L.featureGroup([line, L.marker([from.lat, from.lng], { icon: startIcon })]);
        group.addTo(map); routeLayerRef.current = group;
        map.fitBounds(line.getBounds().pad(0.15));
        if (mapRef.current) mapRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setRouteInfo({ label: shop.name, dest: { lat: shop.latitude, lng: shop.longitude }, distanceKm: (route.distance / 1000).toFixed(1), durationMin: Math.round(route.duration / 60) });
      } catch { setRouteInfo({ error: 'Could not build a route' }); }
      finally { setRouting(false); }
    };
    if (userLocation) { doRoute(userLocation); return; }
    if (!navigator.geolocation) { setRouteInfo({ error: 'Location not supported' }); return; }
    setRouting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }; setUserLocation(loc); doRoute(loc); },
      () => { setRouteInfo({ error: 'Allow location access to get directions' }); setRouting(false); },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  useEffect(() => {
    fetchShops();
  }, []);

  useEffect(() => {
    if (!loading) {
      initMap();
    }
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [loading]);

  // Extract unique states when shops load
  useEffect(() => {
    if (shops.length > 0) {
      const states = [...new Set(shops.map(s => s.state).filter(Boolean))].sort();
      setAvailableStates(states);
    }
  }, [shops]);

  // Apply filters
  useEffect(() => {
    let result = [...shops];

    // Single-shop mode (from a shop's "Location" button) — show ONLY that shop.
    if (singleShopId) {
      result = result.filter((s) => s.id === singleShopId);
    } else {
      // State filter
      if (stateFilter && stateFilter !== 'all') {
        result = result.filter(s => s.state === stateFilter);
      }

      // Near Me filter
      if (nearMeActive && userLocation) {
        result = result.filter(shop => {
          const dist = getDistance(userLocation.lat, userLocation.lng, shop.latitude, shop.longitude);
          return dist <= nearMeRadius;
        });
      }
    }

    setFilteredShops(result);
    updateMapMarkers(result);

    // In single-shop mode: center on the shop and open its popup.
    if (singleShopId && mapInstanceRef.current && markersRef.current.length === 1) {
      const pos = markersRef.current[0].getLatLng();
      mapInstanceRef.current.setView([pos.lat, pos.lng], 14);
      setTimeout(() => { try { markersRef.current[0].openPopup(); } catch (e) {} }, 300);
      return;
    }

    // Radius circle
    if (nearMeActive && userLocation && mapInstanceRef.current) {
      const L = window.L;
      if (radiusCircleRef.current) {
        mapInstanceRef.current.removeLayer(radiusCircleRef.current);
      }
      // Resolve the live primary color (Leaflet paths use SVG attrs, so CSS var() won't work directly).
      const brand = (() => { try { const v = getComputedStyle(document.documentElement).getPropertyValue('--v-500').trim(); return v ? `rgb(${v})` : '#5df6fc'; } catch (_) { return '#5df6fc'; } })();
      radiusCircleRef.current = L.circle([userLocation.lat, userLocation.lng], {
        radius: nearMeRadius * 1000,
        color: brand,
        fillColor: brand,
        fillOpacity: 0.08,
        weight: 2,
        dashArray: '8, 6'
      }).addTo(mapInstanceRef.current);
      mapInstanceRef.current.fitBounds(radiusCircleRef.current.getBounds().pad(0.1));
    } else if (mapInstanceRef.current) {
      if (radiusCircleRef.current) {
        mapInstanceRef.current.removeLayer(radiusCircleRef.current);
        radiusCircleRef.current = null;
      }
      // Fit to filtered markers
      if (markersRef.current.length > 1) {
        const L = window.L;
        const group = L.featureGroup(markersRef.current);
        mapInstanceRef.current.fitBounds(group.getBounds().pad(0.1));
      } else if (markersRef.current.length === 1) {
        const pos = markersRef.current[0].getLatLng();
        mapInstanceRef.current.setView([pos.lat, pos.lng], 13);
      }
    }
  }, [nearMeActive, userLocation, nearMeRadius, shops, stateFilter, singleShopId]);

  // Switch map provider / tile layer
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const L = window.L;
    const provider = MAP_PROVIDERS[mapProvider];
    
    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }
    
    const options = { attribution: provider.attribution, maxZoom: 19 };
    if (provider.subdomains) options.subdomains = provider.subdomains;
    
    tileLayerRef.current = L.tileLayer(provider.url, options).addTo(mapInstanceRef.current);
  }, [mapProvider]);

  const getDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const fetchShops = async () => {
    try {
      const { data } = await api.shops.getMap();
      setShops(data);
      setFilteredShops(data);
    } catch (e) {
      console.error('Failed to fetch shop map data');
    } finally {
      setLoading(false);
    }
  };

  const handleNearMe = () => {
    if (nearMeActive) {
      setNearMeActive(false);
      if (userMarkerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(userMarkerRef.current);
        userMarkerRef.current = null;
      }
      return;
    }
    
    setGeoLoading(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          setNearMeActive(true);
          setGeoLoading(false);
          
          if (mapInstanceRef.current) {
            const L = window.L;
            if (userMarkerRef.current) {
              mapInstanceRef.current.removeLayer(userMarkerRef.current);
            }
            const userIcon = L.divIcon({
              className: 'user-location-marker',
              html: `<div style="width: 20px; height: 20px; background: #3b82f6; border-radius: 50%; border: 4px solid white; box-shadow: 0 2px 8px rgba(59,130,246,0.5);"></div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            });
            userMarkerRef.current = L.marker([latitude, longitude], { icon: userIcon }).addTo(mapInstanceRef.current);
            userMarkerRef.current.bindPopup('<strong>Your Location</strong>');
          }
          toast.success('Location found! Showing nearby shops.');
        },
        () => {
          setGeoLoading(false);
          toast.error('Unable to get your location. Please allow location access.');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setGeoLoading(false);
      toast.error('Geolocation is not supported by your browser.');
    }
  };

  const searchMarkerRef = useRef(null);

  const handleLocationSearch = ({ lat, lng, label }) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const L = window.L;
    map.setView([lat, lng], 14);
    if (searchMarkerRef.current) {
      map.removeLayer(searchMarkerRef.current);
    }
    const searchIcon = L.divIcon({
      className: 'search-location-marker',
      html: `<div style="width: 18px; height: 18px; background: #f59e0b; border-radius: 50%; border: 4px solid white; box-shadow: 0 2px 8px rgba(245,158,11,0.6);"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    searchMarkerRef.current = L.marker([lat, lng], { icon: searchIcon }).addTo(map);
    searchMarkerRef.current.bindPopup(`<strong>📍 ${(label || 'Searched location').split(',').slice(0, 2).join(', ')}</strong>`).openPopup();
  };

  const updateMapMarkers = (shopsToShow) => {
    if (!mapInstanceRef.current) return;
    const L = window.L;
    const map = mapInstanceRef.current;
    
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];
    
    const shopIcon = L.divIcon({
      className: 'custom-shop-marker',
      html: `<div style="background: linear-gradient(135deg, rgb(var(--v-500)), rgb(var(--s-600))); width: 36px; height: 36px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgb(var(--v-500) / 0.4); border: 3px solid white;">
        <svg style="transform: rotate(45deg); width: 16px; height: 16px; color: white;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
      </div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -36]
    });
    
    shopsToShow.forEach((shop) => {
      const distance = userLocation ? getDistance(userLocation.lat, userLocation.lng, shop.latitude, shop.longitude).toFixed(1) : null;
      const marker = L.marker([shop.latitude, shop.longitude], { icon: shopIcon }).addTo(map);
      
      const directionsUrl = userLocation 
        ? `https://www.google.com/maps/dir/${userLocation.lat},${userLocation.lng}/${shop.latitude},${shop.longitude}`
        : `https://www.google.com/maps/dir/?api=1&destination=${shop.latitude},${shop.longitude}&travelmode=driving`;
      
      const popupContent = `
        <div style="min-width: 220px; padding: 4px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            ${shop.logo ? `<img src="${shop.logo}" style="width: 36px; height: 36px; border-radius: 8px; object-fit: cover;" />` : `<div style="width: 36px; height: 36px; border-radius: 8px; background: linear-gradient(135deg, rgb(var(--v-500)), rgb(var(--s-600))); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px;">${shop.name?.charAt(0) || 'S'}</div>`}
            <div>
              <strong style="font-size: 14px; color: #1e293b;">${shop.name}</strong>
              ${shop.state ? `<p style="font-size: 11px; color: #64748b; margin: 0;">${shop.state}</p>` : ''}
            </div>
          </div>
          ${shop.description ? `<p style="font-size: 12px; color: #475569; margin: 0 0 8px 0;">${shop.description}</p>` : ''}
          ${shop.location_address ? `<p style="font-size: 11px; color: #64748b; margin: 0 0 4px 0;">📍 ${shop.location_address}</p>` : ''}
          ${distance ? `<p style="font-size: 11px; color: #3bf4fb; font-weight: 600; margin: 0 0 8px 0;">📏 ${distance} km away</p>` : ''}
          <div style="display: flex; gap: 8px; margin-top: 10px;">
            <a href="/shop/${shop.id}" style="display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: #3bf4fb; text-decoration: none; font-weight: 600; padding: 5px 10px; border-radius: 6px; background: #eefdff; border: 1px solid #d9feff;">Visit Shop</a>
            <button onclick="(function(){navigator.geolocation.getCurrentPosition(function(p){window.open('https://www.google.com/maps/dir/'+p.coords.latitude+','+p.coords.longitude+'/${shop.latitude},${shop.longitude}','_blank')},function(){window.open('${directionsUrl}','_blank')},{enableHighAccuracy:true,timeout:5000})})()" style="display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: white; text-decoration: none; font-weight: 600; padding: 5px 10px; border-radius: 6px; background: linear-gradient(135deg, #10b981, #059669); border: none; cursor: pointer;" data-testid="get-directions-btn">🧭 Directions</button>
          </div>
        </div>
      `;
      
      marker.bindPopup(popupContent);
      markersRef.current.push(marker);
    });
  };

  const initMap = () => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const L = window.L;
    if (!L) return;

    const map = L.map(mapRef.current).setView([33.85, 35.85], 9);
    mapInstanceRef.current = map;

    const provider = MAP_PROVIDERS[mapProvider];
    const options = { attribution: provider.attribution, maxZoom: 19 };
    if (provider.subdomains && provider.subdomains.length > 0) options.subdomains = provider.subdomains;
    
    tileLayerRef.current = L.tileLayer(provider.url, options).addTo(map);
    
    // Fallback: if Google tiles fail (network blocked), switch to OSM
    if (mapProvider !== 'openstreetmap') {
      let loadedCount = 0;
      let errorCount = 0;
      const switchToOSM = () => {
        if (mapInstanceRef.current && tileLayerRef.current) {
          mapInstanceRef.current.removeLayer(tileLayerRef.current);
          const osmOptions = { attribution: MAP_PROVIDERS.openstreetmap.attribution, maxZoom: 19 };
          tileLayerRef.current = L.tileLayer(MAP_PROVIDERS.openstreetmap.url, osmOptions).addTo(mapInstanceRef.current);
        }
      };
      tileLayerRef.current.on('tileload', () => { loadedCount++; });
      tileLayerRef.current.on('tileerror', () => { errorCount++; if (errorCount >= 2) switchToOSM(); });
      // Timeout fallback: if no tiles loaded after 4s, switch
      setTimeout(() => { if (loadedCount === 0) switchToOSM(); }, 4000);
    }

    updateMapMarkers(shops);

    if (markersRef.current.length > 1) {
      const group = L.featureGroup(markersRef.current);
      map.fitBounds(group.getBounds().pad(0.1));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
          <p className="text-sm text-slate-500">Loading shops map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8" data-testid="shops-map-page">
      {/* Header */}
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold flex items-center gap-3" data-testid="shops-map-title">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                <MapIcon className="h-5 w-5 text-white" />
              </div>
              <span className="bg-gradient-to-r from-violet-700 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                Shops Map
              </span>
            </h1>
            <p className="text-slate-500 text-sm mt-1 ml-[52px]">
              {singleShopId && filteredShops.length === 1
                ? `Showing location of ${filteredShops[0].name}`
                : 'Find shops near you across Lebanon'}
            </p>
            {singleShopId && (
              <button
                onClick={() => setSearchParams({})}
                className="ml-[52px] mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-100 text-violet-700 text-xs font-semibold hover:bg-violet-200 transition-colors"
                data-testid="show-all-shops-btn"
              >
                <Store className="h-3.5 w-3.5" /> Show all shops
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Near Me Button */}
            <Button
              onClick={handleNearMe}
              disabled={geoLoading}
              className={`rounded-full text-sm font-medium px-4 ${
                nearMeActive
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
              }`}
              variant={nearMeActive ? 'default' : 'outline'}
              data-testid="near-me-btn"
            >
              {geoLoading ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Navigation className="h-4 w-4 mr-1.5" />
              )}
              {nearMeActive ? 'Near Me' : 'Near Me'}
              {nearMeActive && (
                <X className="h-3.5 w-3.5 ml-1.5" onClick={(e) => { e.stopPropagation(); setNearMeActive(false); }} />
              )}
            </Button>
            
            <Link 
              to="/shops" 
              className="text-sm text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1 px-3 py-2 rounded-full border border-violet-200 hover:bg-violet-50 transition-colors"
              data-testid="view-all-shops-link"
            >
              <Store className="h-4 w-4" />
              List
            </Link>
          </div>
        </div>
        
        {/* Location Search Bar */}
        <div className="mt-3 ml-0 sm:ml-[52px] max-w-xl">
          <MapLocationSearch
            onSelect={handleLocationSearch}
            accent="violet"
            placeholder="Search a location, city or area in Lebanon..."
            data-testid="shops-map-location-search"
          />
        </div>

        {/* Filters Row */}
        <div className="mt-3 ml-0 sm:ml-[52px] flex items-center gap-3 flex-wrap">
          {/* State Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="h-8 text-xs rounded-lg border-slate-200 w-40" data-testid="state-filter">
                <SelectValue placeholder="All States" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {availableStates.map(state => (
                  <SelectItem key={state} value={state}>{state}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Map Provider Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-full p-0.5" data-testid="map-provider-toggle">
            {Object.entries(MAP_PROVIDERS).map(([key, prov]) => (
              <button
                key={key}
                onClick={() => setMapProvider(key)}
                className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${
                  mapProvider === key
                    ? 'bg-white text-violet-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                data-testid={`provider-${key}`}
              >
                {prov.name}
              </button>
            ))}
          </div>

          {/* Radius Selector - shown when Near Me is active */}
          {nearMeActive && (
            <div className="flex items-center gap-2" data-testid="radius-selector">
              <span className="text-xs text-slate-500">Radius:</span>
              {[5, 10, 25, 50, 100].map(r => (
                <button
                  key={r}
                  onClick={() => setNearMeRadius(r)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                    nearMeRadius === r
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                  data-testid={`radius-${r}`}
                >
                  {r}km
                </button>
              ))}
            </div>
          )}

          <span className="text-xs text-slate-500 font-medium ml-auto">
            {filteredShops.length} shop{filteredShops.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Map */}
      <div className="max-w-[1920px] mx-auto px-0 sm:px-4 lg:px-6">
        {(routing || routeInfo) && (
          <div className="flex items-center justify-between gap-2 mx-4 sm:mx-0 mb-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm" data-testid="map-route-info">
            {routing ? (
              <span className="flex items-center gap-2 text-indigo-700"><Loader2 className="h-4 w-4 animate-spin" /> Building route from your location…</span>
            ) : routeInfo?.error ? (
              <span className="text-amber-700">{routeInfo.error}</span>
            ) : (
              <span className="text-indigo-800"><Navigation className="h-4 w-4 inline mr-1 text-indigo-600" /><strong>Route to {routeInfo.label}</strong> — {routeInfo.distanceKm} km · ~{routeInfo.durationMin} min</span>
            )}
            {routeInfo && !routeInfo.error && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${routeInfo.dest.lat},${routeInfo.dest.lng}&travelmode=driving`, '_blank')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-full px-3 py-1"
                  data-testid="map-route-start-btn"
                >
                  <Navigation className="h-3.5 w-3.5" /> Start
                </button>
                <button onClick={() => { const m = mapInstanceRef.current; if (m && routeLayerRef.current) { m.removeLayer(routeLayerRef.current); routeLayerRef.current = null; } setRouteInfo(null); }} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Clear</button>
              </div>
            )}
          </div>
        )}
        <div className="sm:rounded-2xl overflow-hidden border-y sm:border border-slate-200 shadow-lg" style={{ height: '600px' }}>
          <div ref={mapRef} style={{ height: '100%', width: '100%' }} data-testid="public-shops-map" />
        </div>
      </div>

      {/* Shop List Below Map */}
      {filteredShops.length > 0 && (
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          <h2 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-violet-500" />
            {filteredShops.length} Shop{filteredShops.length !== 1 ? 's' : ''} {nearMeActive ? 'Nearby' : stateFilter !== 'all' ? `in ${stateFilter}` : 'on Map'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredShops.map((shop) => {
              const distance = userLocation ? getDistance(userLocation.lat, userLocation.lng, shop.latitude, shop.longitude).toFixed(1) : null;
              const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${shop.latitude},${shop.longitude}&travelmode=driving`;
              return (
                <div
                  key={shop.id}
                  className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 hover:border-violet-200 hover:shadow-md transition-all group"
                  data-testid={`map-shop-card-${shop.id}`}
                >
                  <Link to={`/shop/${shop.id}`} className="flex-shrink-0">
                    {shop.logo ? (
                      <img src={shop.logo} alt={shop.name} className="w-11 h-11 rounded-lg object-cover" />
                    ) : (
                      <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                        {shop.name?.charAt(0)}
                      </div>
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/shop/${shop.id}`}>
                      <p className="font-semibold text-sm text-slate-800 truncate group-hover:text-violet-700 transition-colors">{shop.name}</p>
                    </Link>
                    {shop.location_address && (
                      <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        {shop.location_address}
                      </p>
                    )}
                    {shop.state && !shop.location_address && (
                      <p className="text-xs text-slate-500">{shop.state}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {distance && (
                      <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">{distance} km</span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); drawRouteOnMap(shop); }}
                      className="flex items-center gap-1 text-[10px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-full transition-colors"
                      data-testid={`route-on-map-btn-${shop.id}`}
                    >
                      <Compass className="h-3 w-3" />
                      On map
                    </button>
                    <a
                      href={directionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-full transition-colors"
                      data-testid={`directions-btn-${shop.id}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Compass className="h-3 w-3" />
                      Google Maps
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {filteredShops.length === 0 && !loading && (
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 mt-8 text-center">
          <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-100">
            <MapPin className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">
              {nearMeActive ? 'No shops found within your selected radius' : stateFilter !== 'all' ? `No shops found in ${stateFilter}` : 'No shops have set their location yet'}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {nearMeActive ? 'Try increasing the radius to find more shops.' : 'Try a different filter or check back later.'}
            </p>
            {nearMeActive && (
              <Button
                onClick={() => setNearMeRadius(prev => Math.min(prev + 50, 200))}
                variant="outline"
                className="mt-4 rounded-full"
              >
                Expand Radius
              </Button>
            )}
            {stateFilter !== 'all' && (
              <Button
                onClick={() => setStateFilter('all')}
                variant="outline"
                className="mt-4 rounded-full"
              >
                Clear Filter
              </Button>
            )}
          </div>
        </div>
      )}
      {/* Sponsored add-ons + Recommended (with interleaved sponsored carousels) */}
      <div className="pb-8" data-testid="map-end-promos">
        <EndOfPagePromos />
      </div>
    </div>
  );
};

export default ShopsMapPage;
