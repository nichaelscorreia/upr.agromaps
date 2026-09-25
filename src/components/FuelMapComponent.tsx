import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { createDefaultTileLayers, addLayerControl } from '../services/leafletTileLayers';
import { addFactoryRadiusRings } from '../services/leafletRadiusRings';

interface Lot {
  id: string;
  name: string;
  lot_number?: string;
  polygons: {
    coordinates: [number, number][];
    description: string;
  }[];
  description: string;
  farm_name?: string;
}

interface FuelData {
  id: string;
  imei: string;
  placa: string;
  name: string;
  latitude: number;
  longitude: number;
  autonomia_percent: number;
  litros_restantes: number;
  consumo_medio: number;
  km_restantes: number;
  last_updated: string;
  status: 'normal' | 'warning' | 'critical';
}

interface FuelMapComponentProps {
  fuelData: FuelData[];
  lots: Lot[];
  selectedVehicleId?: string | null;
  onVehicleSelected?: () => void;
}

const createFuelIcon = (vehicle: FuelData): L.DivIcon => {
  let color = '#22c55e';
  if (vehicle.autonomia_percent < 20) {
    color = '#ef4444'; // Crítico
  } else if (vehicle.autonomia_percent < 40) {
    color = '#f97316'; // Atenção
  }

  return L.divIcon({
    className: 'custom-vehicle-marker',
    html: `
      <div style="
        width: 36px;
        height: 36px;
        background: ${color};
        border: 2.5px solid #ffffff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        cursor: pointer;
        position: relative;
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
          <path d="M19.77 7.23l.01-.01-3.72-3.72L15 4.56l2.11 2.11c-.94.36-1.61 1.26-1.61 2.33 0 1.38 1.12 2.5 2.5 2.5.36 0 .69-.08 1-.21v7.21c0 .55-.45 1-1 1s-1-.45-1-1V14c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2v-3h1c.55 0 1 .45 1 1v2.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V9c0-.69-.28-1.32-.73-1.77zM12 10H4V5h8v5z"/>
        </svg>
        <div style="
          position: absolute;
          bottom: -7px;
          left: 50%;
          transform: translateX(-50%);
          background: ${color};
          color: white;
          font-size: 10px;
          font-weight: 800;
          padding: 1px 4px;
          border-radius: 6px;
          border: 1px solid #ffffff;
          white-space: nowrap;
          box-shadow: 0 1px 4px rgba(0,0,0,0.4);
        ">
          ${vehicle.autonomia_percent.toFixed(0)}%
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20]
  });
};

const FuelMapComponent: React.FC<FuelMapComponentProps> = ({ 
  fuelData, 
  lots,
  selectedVehicleId, 
  onVehicleSelected 
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const fuelLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const polygonLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const highlightLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // Obter localização do usuário
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Erro ao obter localização:', error);
          setUserLocation({ lat: -14.2350, lng: -51.9253 });
        }
      );
    } else {
      setUserLocation({ lat: -14.2350, lng: -51.9253 });
    }
  }, []);

  // Inicializar mapa Leaflet
  useEffect(() => {
    if (!mapContainerRef.current || !userLocation || mapInstanceRef.current) return;

    try {
      const { defaultLayer, baseMaps } = createDefaultTileLayers();

      const map = L.map(mapContainerRef.current, {
        center: [userLocation.lat, userLocation.lng],
        zoom: 12,
        zoomControl: false,
        layers: [defaultLayer]
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);
      addLayerControl(map, baseMaps);

      // Camada de Raios Concêntricos da Usina Porto Rico (1km a 50km)
      addFactoryRadiusRings(map);

      polygonLayerGroupRef.current = L.layerGroup().addTo(map);
      fuelLayerGroupRef.current = L.layerGroup().addTo(map);
      highlightLayerGroupRef.current = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;
      setIsMapLoaded(true);

      setTimeout(() => {
        map.invalidateSize();
      }, 200);

    } catch (error) {
      console.error('Erro ao inicializar mapa de abastecimento Leaflet:', error);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        polygonLayerGroupRef.current = null;
        fuelLayerGroupRef.current = null;
        highlightLayerGroupRef.current = null;
      }
    };
  }, [userLocation]);

  // Atualizar lotes no mapa
  useEffect(() => {
    if (!mapInstanceRef.current || !polygonLayerGroupRef.current || !isMapLoaded) return;

    const polygonGroup = polygonLayerGroupRef.current;
    polygonGroup.clearLayers();

    lots.forEach((lot) => {
      if (lot.polygons && lot.polygons.length > 0) {
        lot.polygons.forEach((polygonData) => {
          if (polygonData.coordinates && polygonData.coordinates.length > 0) {
            try {
              const defaultStrokeColor = '#94a3b8';
              const defaultFillColor = '#cbd5e1';
              const defaultStrokeOpacity = 0.8;
              const defaultStrokeWeight = 2;
              const defaultFillOpacity = 0.18;

              const latLngs: [number, number][] = polygonData.coordinates.map(coord => [coord[0], coord[1]]);

              const polygon = L.polygon(latLngs, {
                color: defaultStrokeColor,
                weight: defaultStrokeWeight,
                opacity: defaultStrokeOpacity,
                fillColor: defaultFillColor,
                fillOpacity: defaultFillOpacity
              });

              // Hover: realce
              polygon.on('mouseover', () => {
                polygon.setStyle({
                  color: '#facc15',
                  weight: 4,
                  opacity: 1.0,
                  fillOpacity: 0.45
                });
                polygon.bringToFront();
              });

              polygon.on('mouseout', () => {
                polygon.setStyle({
                  color: defaultStrokeColor,
                  weight: defaultStrokeWeight,
                  opacity: defaultStrokeOpacity,
                  fillColor: defaultFillColor,
                  fillOpacity: defaultFillOpacity
                });
              });

              const popupContent = `
                <div style="
                  padding: 14px 16px; 
                  min-width: 200px; 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background: #ffffff;
                  color: #1f2937;
                ">
                  <div style="
                    display: flex; 
                    align-items: center; 
                    margin-bottom: 8px;
                    padding-bottom: 6px;
                    border-bottom: 1px solid #e5e7eb;
                  ">
                    <div style="
                      width: 8px; 
                      height: 8px; 
                      background: #22c55e; 
                      border-radius: 50%; 
                      margin-right: 8px;
                    "></div>
                    <h4 style="margin: 0; color: #15803d; font-weight: 700; font-size: 15px;">${lot.name}</h4>
                  </div>
                  ${lot.farm_name ? `
                    <div style="background: rgba(34, 197, 94, 0.08); padding: 6px 10px; border-radius: 6px; margin-bottom: 6px;">
                      <p style="margin: 0; color: #16a34a; font-size: 13px; font-weight: 600;">🏡 ${lot.farm_name}</p>
                    </div>
                  ` : ''}
                  <p style="margin: 0; color: #6b7280; font-size: 11px;">📍 Lote da Fazenda</p>
                </div>
              `;

              polygon.bindPopup(popupContent, { maxWidth: 300 });
              polygonGroup.addLayer(polygon);
            } catch (err) {
              console.error(`Erro ao adicionar polígono do lote ${lot.name}:`, err);
            }
          }
        });
      }
    });
  }, [lots, isMapLoaded]);

  // Atualizar marcadores de abastecimento
  useEffect(() => {
    if (!mapInstanceRef.current || !fuelLayerGroupRef.current || !isMapLoaded) return;

    const fuelGroup = fuelLayerGroupRef.current;
    fuelGroup.clearLayers();

    const boundsCoords: [number, number][] = [];

    fuelData.forEach((vehicle) => {
      try {
        if (!vehicle.latitude || !vehicle.longitude) return;

        boundsCoords.push([vehicle.latitude, vehicle.longitude]);

        const marker = L.marker([vehicle.latitude, vehicle.longitude], {
          icon: createFuelIcon(vehicle),
          title: vehicle.name
        });

        let statusColor = '#22c55e';
        let statusText = 'NORMAL';
        if (vehicle.autonomia_percent < 20) {
          statusColor = '#ef4444';
          statusText = 'CRÍTICO';
        } else if (vehicle.autonomia_percent < 40) {
          statusColor = '#f97316';
          statusText = 'ATENÇÃO';
        }

        const popupContent = `
          <div style="
            padding: 16px; 
            min-width: 240px; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #ffffff;
            color: #1f2937;
          ">
            <div style="
              display: flex; 
              align-items: center; 
              justify-content: space-between;
              margin-bottom: 12px;
              padding-bottom: 8px;
              border-bottom: 1px solid #e5e7eb;
            ">
              <h3 style="margin: 0; color: #111827; font-weight: 700; font-size: 16px;">${vehicle.name}</h3>
              <span style="
                background: ${statusColor}20; 
                color: ${statusColor}; 
                font-size: 11px; 
                font-weight: 700; 
                padding: 2px 6px; 
                border-radius: 4px;
              ">${statusText}</span>
            </div>
            
            <div style="background: #f3f4f6; padding: 8px 10px; border-radius: 8px; margin-bottom: 10px; font-size: 12px;">
              <div><strong>Placa:</strong> ${vehicle.placa}</div>
              <div><strong>Litros Restantes:</strong> ${vehicle.litros_restantes.toFixed(0)} L</div>
              <div><strong>Consumo Médio:</strong> ${vehicle.consumo_medio.toFixed(1)} L/h</div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
              <div style="background: #f8fafc; padding: 6px; border-radius: 6px; text-align: center; border: 1px solid #e2e8f0;">
                <span style="font-size: 10px; color: #64748b; text-transform: uppercase;">Autonomia</span>
                <div style="font-size: 15px; font-weight: 800; color: ${statusColor};">${vehicle.autonomia_percent.toFixed(0)}%</div>
              </div>
              <div style="background: #f8fafc; padding: 6px; border-radius: 6px; text-align: center; border: 1px solid #e2e8f0;">
                <span style="font-size: 10px; color: #64748b; text-transform: uppercase;">KM Restante</span>
                <div style="font-size: 15px; font-weight: 800; color: #0f172a;">${vehicle.km_restantes.toFixed(0)} km</div>
              </div>
            </div>
          </div>
        `;

        marker.bindPopup(popupContent, { maxWidth: 320 });
        fuelGroup.addLayer(marker);
      } catch (err) {
        console.error('Erro ao adicionar marcador de combustível:', err);
      }
    });

    if (boundsCoords.length > 0 && mapInstanceRef.current && !selectedVehicleId) {
      const bounds = L.latLngBounds(boundsCoords);
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [fuelData, isMapLoaded, selectedVehicleId]);

  // Destaque para veículo selecionado
  useEffect(() => {
    if (!selectedVehicleId || !mapInstanceRef.current || !highlightLayerGroupRef.current || !isMapLoaded) return;

    const selectedVehicle = fuelData.find(v => v.id === selectedVehicleId);
    if (!selectedVehicle) return;

    const highlightGroup = highlightLayerGroupRef.current;
    highlightGroup.clearLayers();

    mapInstanceRef.current.setView([selectedVehicle.latitude, selectedVehicle.longitude], 16, { animate: true });

    const pulseIcon = L.divIcon({
      className: 'custom-vehicle-marker',
      html: `
        <div style="
          width: 54px;
          height: 54px;
          background: #ef4444;
          border: 4px solid #ffffff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 20px rgba(239, 68, 68, 0.8);
          animation: pulse 1.5s infinite;
        ">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
            <path d="M19.77 7.23l.01-.01-3.72-3.72L15 4.56l2.11 2.11c-.94.36-1.61 1.26-1.61 2.33 0 1.38 1.12 2.5 2.5 2.5.36 0 .69-.08 1-.21v7.21c0 .55-.45 1-1 1s-1-.45-1-1V14c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2v-3h1c.55 0 1 .45 1 1v2.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V9c0-.69-.28-1.32-.73-1.77zM12 10H4V5h8v5z"/>
          </svg>
        </div>
      `,
      iconSize: [54, 54],
      iconAnchor: [27, 27]
    });

    const highlightMarker = L.marker([selectedVehicle.latitude, selectedVehicle.longitude], {
      icon: pulseIcon
    }).addTo(highlightGroup);

    const alertPopup = `
      <div style="padding: 16px; min-width: 220px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="display: flex; align-items: center; margin-bottom: 10px;">
          <span style="font-size: 20px; margin-right: 8px;">⛽</span>
          <h3 style="margin: 0; color: #dc2626; font-weight: 700; font-size: 16px;">${selectedVehicle.name}</h3>
        </div>
        <div style="background: #fee2e2; padding: 10px; border-radius: 8px; border-left: 3px solid #ef4444; margin-bottom: 8px;">
          <p style="margin: 0; color: #991b1b; font-size: 13px; font-weight: 600;">Nível Crítico de Combustível</p>
          <p style="margin: 4px 0 0 0; color: #b91c1c; font-size: 12px;">Autonomia: ${selectedVehicle.autonomia_percent.toFixed(0)}% (${selectedVehicle.litros_restantes.toFixed(0)} Litros)</p>
        </div>
      </div>
    `;

    highlightMarker.bindPopup(alertPopup).openPopup();

    const timeout = setTimeout(() => {
      highlightGroup.clearLayers();
      if (onVehicleSelected) onVehicleSelected();
    }, 10000);

    return () => {
      clearTimeout(timeout);
      highlightGroup.clearLayers();
    };
  }, [selectedVehicleId, fuelData, isMapLoaded, onVehicleSelected]);

  return (
    <div className="relative w-full h-full">
      <div 
        ref={mapContainerRef} 
        className="w-full h-full rounded-lg overflow-hidden" 
      />
      
      {!isMapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 rounded-lg z-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-2"></div>
            <p className="text-gray-200">Carregando mapa de abastecimento...</p>
          </div>
        </div>
      )}
      
      {fuelData.length === 0 && isMapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-80 z-10 pointer-events-none">
          <div className="text-center text-gray-300">
            <div className="text-lg font-medium mb-1">Nenhum dado de abastecimento</div>
            <div className="text-sm text-gray-400">Verifique a integração de telemetria</div>
          </div>
        </div>
      )}
      
      {fuelData.length > 0 && isMapLoaded && (
        <div className="absolute bottom-4 left-4 bg-gray-900 bg-opacity-85 border border-green-500 text-green-400 px-3.5 py-2 rounded-lg text-xs font-semibold shadow-xl z-[1000] flex items-center backdrop-blur-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-green-400 mr-2 animate-pulse"></span>
          ⛽ {fuelData.length} veículo(s) • 📍 {lots.length} lote(s)
        </div>
      )}
    </div>
  );
};

export default FuelMapComponent;