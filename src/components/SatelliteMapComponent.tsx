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

interface AnalysisData {
  lotId: string;
  ndvi: number;
  growth_rate: number;
  health_status: 'excellent' | 'good' | 'average' | 'poor';
  last_updated: string;
  trend: 'increasing' | 'stable' | 'decreasing';
}

interface SatelliteMapComponentProps {
  lots: Lot[];
  analysisData: AnalysisData[];
  onLotClick: (lotId: string) => void;
}

const getColorByNDVI = (ndvi: number): string => {
  if (ndvi > 0.7) return '#22c55e'; // Verde - Excelente
  if (ndvi > 0.5) return '#3b82f6'; // Azul - Bom
  if (ndvi > 0.3) return '#eab308'; // Amarelo - Médio
  return '#ef4444'; // Vermelho - Ruim
};

const getStatusText = (status: AnalysisData['health_status']): string => {
  switch (status) {
    case 'excellent': return 'Excelente';
    case 'good': return 'Bom';
    case 'average': return 'Médio';
    case 'poor': return 'Ruim';
    default: return 'Desconhecido';
  }
};

const getTrendIcon = (trend: AnalysisData['trend']): string => {
  switch (trend) {
    case 'increasing': return '📈';
    case 'stable': return '➡️';
    case 'decreasing': return '📉';
    default: return '❓';
  }
};

const SatelliteMapComponent: React.FC<SatelliteMapComponentProps> = ({ 
  lots, 
  analysisData,
  onLotClick
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polygonLayerGroupRef = useRef<L.LayerGroup | null>(null);
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
      mapInstanceRef.current = map;
      setIsMapLoaded(true);

      setTimeout(() => {
        map.invalidateSize();
      }, 200);

    } catch (error) {
      console.error('Erro ao inicializar mapa satelital Leaflet:', error);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        polygonLayerGroupRef.current = null;
      }
    };
  }, [userLocation]);

  // Atualizar lotes no mapa com cores NDVI
  useEffect(() => {
    if (!mapInstanceRef.current || !polygonLayerGroupRef.current || !isMapLoaded) return;

    const polygonGroup = polygonLayerGroupRef.current;
    polygonGroup.clearLayers();

    const allCoords: L.LatLng[] = [];

    lots.forEach((lot) => {
      if (lot.polygons && lot.polygons.length > 0) {
        const analysis = analysisData.find(data => data.lotId === lot.id);
        const color = analysis ? getColorByNDVI(analysis.ndvi) : '#ffffff';
        const defaultFillOpacity = 0.55;
        const defaultStrokeWeight = 2.5;

        lot.polygons.forEach((polygonData, polygonIndex) => {
          if (polygonData.coordinates && polygonData.coordinates.length > 0) {
            try {
              const latLngs: [number, number][] = polygonData.coordinates.map(coord => [coord[0], coord[1]]);

              latLngs.forEach(ll => {
                allCoords.push(L.latLng(ll[0], ll[1]));
              });

              const polygon = L.polygon(latLngs, {
                color: color,
                weight: defaultStrokeWeight,
                opacity: 0.9,
                fillColor: color,
                fillOpacity: defaultFillOpacity
              });

              // Hover: realce
              polygon.on('mouseover', () => {
                polygon.setStyle({
                  color: '#ffffff',
                  weight: 5,
                  opacity: 1.0,
                  fillOpacity: 0.85
                });
                polygon.bringToFront();
              });

              polygon.on('mouseout', () => {
                polygon.setStyle({
                  color: color,
                  weight: defaultStrokeWeight,
                  opacity: 0.9,
                  fillColor: color,
                  fillOpacity: defaultFillOpacity
                });
              });

              const popupContent = analysis ? `
                <div style="
                  padding: 16px; 
                  min-width: 260px; 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background: #ffffff;
                  border-radius: 12px;
                  color: #1f2937;
                ">
                  <div style="
                    display: flex; 
                    align-items: center; 
                    margin-bottom: 12px;
                    padding-bottom: 8px;
                    border-bottom: 2px solid ${color}20;
                  ">
                    <div style="
                      width: 12px; 
                      height: 12px; 
                      background: ${color}; 
                      border-radius: 50%; 
                      margin-right: 10px;
                      box-shadow: 0 0 8px ${color}80;
                    "></div>
                    <h3 style="margin: 0; color: #111827; font-weight: 800; font-size: 17px;">${lot.name}</h3>
                  </div>
                  
                  ${lot.farm_name ? `<p style="margin: 0 0 10px 0; color: #4b5563; font-size: 13px; font-weight: 600;">🏡 ${lot.farm_name}</p>` : ''}
                  
                  <div style="background: #f9fafb; padding: 10px; border-radius: 8px; margin-bottom: 10px; border: 1px solid #e5e7eb;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                      <span style="font-size: 12px; color: #6b7280; font-weight: 600;">NDVI:</span>
                      <span style="font-weight: 800; font-size: 15px; color: ${color};">${analysis.ndvi.toFixed(3)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                      <span style="font-size: 12px; color: #6b7280; font-weight: 600;">Status:</span>
                      <span style="background: ${color}20; color: ${color}; font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">
                        ${getStatusText(analysis.health_status)}
                      </span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <span style="font-size: 12px; color: #6b7280; font-weight: 600;">Crescimento:</span>
                      <span style="font-weight: 700; font-size: 13px; color: #374151;">
                        ${getTrendIcon(analysis.trend)} ${analysis.growth_rate > 0 ? '+' : ''}${analysis.growth_rate}%
                      </span>
                    </div>
                  </div>
                </div>
              ` : `
                <div style="padding: 14px; min-width: 200px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                  <h3 style="margin: 0 0 8px 0; color: #111827; font-weight: 700; font-size: 15px;">${lot.name}</h3>
                  <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center; font-style: italic;">
                    ⚠️ Dados de análise não disponíveis
                  </p>
                </div>
              `;

              polygon.bindPopup(popupContent, { maxWidth: 320 });

              polygon.on('click', (e) => {
                polygon.openPopup(e.latlng);
                onLotClick(lot.id);
              });

              polygonGroup.addLayer(polygon);
            } catch (err) {
              console.error(`Erro ao adicionar polígono do lote ${lot.name}:`, err);
            }
          }
        });
      }
    });

    if (allCoords.length > 0 && mapInstanceRef.current) {
      try {
        const bounds = L.latLngBounds(allCoords);
        mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      } catch (err) {
        console.error('Erro ao ajustar limites do mapa:', err);
      }
    }
  }, [lots, analysisData, onLotClick, isMapLoaded]);

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
            <p className="text-gray-200">Carregando mapa satelital...</p>
          </div>
        </div>
      )}

      {/* Legenda NDVI */}
      {isMapLoaded && (
        <div className="absolute top-4 right-4 bg-gray-900 bg-opacity-85 backdrop-blur-sm text-white rounded-xl shadow-2xl p-4 border border-gray-700 z-[1000]">
          <h4 className="font-bold text-sm mb-3 flex items-center">
            <span className="w-2.5 h-2.5 rounded-full bg-green-400 mr-2"></span>
            Índice NDVI
          </h4>
          <div className="space-y-2 text-xs">
            <div className="flex items-center">
              <div className="w-3.5 h-3.5 bg-green-500 rounded-sm mr-2 shadow-sm"></div>
              <span>&gt; 0.70 (Excelente)</span>
            </div>
            <div className="flex items-center">
              <div className="w-3.5 h-3.5 bg-blue-500 rounded-sm mr-2 shadow-sm"></div>
              <span>0.50 - 0.70 (Bom)</span>
            </div>
            <div className="flex items-center">
              <div className="w-3.5 h-3.5 bg-yellow-500 rounded-sm mr-2 shadow-sm"></div>
              <span>0.30 - 0.50 (Médio)</span>
            </div>
            <div className="flex items-center">
              <div className="w-3.5 h-3.5 bg-red-500 rounded-sm mr-2 shadow-sm"></div>
              <span>&lt; 0.30 (Ruim)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SatelliteMapComponent;