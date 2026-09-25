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

interface HeatmapPoint {
  lat: number;
  lng: number;
  ndvi: number;
  growth_rate: number;
  health_status: 'excellent' | 'good' | 'average' | 'poor';
}

interface LotHeatmapData {
  lotId: string;
  lotName: string;
  farmName: string;
  points: HeatmapPoint[];
  averageNdvi: number;
  averageGrowth: number;
  overallHealth: 'excellent' | 'good' | 'average' | 'poor';
  lastUpdated: string;
  nextUpdate: string;
}

interface SatelliteHeatmapComponentProps {
  lots: Lot[];
  heatmapData: LotHeatmapData[];
  selectedLotData: LotHeatmapData | null;
  onLotClick: (lotId: string) => void;
}

const getPointColor = (ndvi: number): string => {
  if (ndvi > 0.7) return '#16a34a';
  if (ndvi > 0.5) return '#84cc16';
  if (ndvi > 0.35) return '#eab308';
  return '#dc2626';
};

const SatelliteHeatmapComponent: React.FC<SatelliteHeatmapComponentProps> = ({ 
  lots, 
  heatmapData,
  selectedLotData,
  onLotClick
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polygonLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const pointsLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [totalPointsCount, setTotalPointsCount] = useState(0);

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
        preferCanvas: true, // Renderização ultra rápida de milhares de pontos via Canvas
        layers: [defaultLayer]
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);
      addLayerControl(map, baseMaps);

      // Camada de Raios Concêntricos da Usina Porto Rico (1km a 50km)
      addFactoryRadiusRings(map);

      polygonLayerGroupRef.current = L.layerGroup().addTo(map);
      pointsLayerGroupRef.current = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;
      setIsMapLoaded(true);

      setTimeout(() => {
        map.invalidateSize();
      }, 200);

    } catch (error) {
      console.error('Erro ao inicializar mapa de calor Leaflet:', error);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        polygonLayerGroupRef.current = null;
        pointsLayerGroupRef.current = null;
      }
    };
  }, [userLocation]);

  // Atualizar polígonos dos lotes
  useEffect(() => {
    if (!mapInstanceRef.current || !polygonLayerGroupRef.current || !isMapLoaded) return;

    const polygonGroup = polygonLayerGroupRef.current;
    polygonGroup.clearLayers();

    const allCoords: L.LatLng[] = [];

    lots.forEach((lot) => {
      if (lot.polygons && lot.polygons.length > 0) {
        const isSelected = selectedLotData?.lotId === lot.id;
        const defaultStrokeColor = isSelected ? '#22c55e' : '#ffffff';
        const defaultStrokeWeight = isSelected ? 3.5 : 1.5;
        const defaultStrokeOpacity = isSelected ? 1.0 : 0.7;

        lot.polygons.forEach((polygonData) => {
          if (polygonData.coordinates && polygonData.coordinates.length > 0) {
            try {
              const latLngs: [number, number][] = polygonData.coordinates.map(coord => [coord[0], coord[1]]);

              latLngs.forEach(ll => {
                allCoords.push(L.latLng(ll[0], ll[1]));
              });

              const polygon = L.polygon(latLngs, {
                color: defaultStrokeColor,
                weight: defaultStrokeWeight,
                opacity: defaultStrokeOpacity,
                fillColor: 'transparent',
                fillOpacity: 0
              });

              polygon.on('mouseover', () => {
                polygon.setStyle({
                  color: '#facc15',
                  weight: 4,
                  opacity: 1.0,
                  fillColor: '#facc15',
                  fillOpacity: 0.15
                });
                polygon.bringToFront();
              });

              polygon.on('mouseout', () => {
                polygon.setStyle({
                  color: defaultStrokeColor,
                  weight: defaultStrokeWeight,
                  opacity: defaultStrokeOpacity,
                  fillColor: 'transparent',
                  fillOpacity: 0
                });
              });

              polygon.on('click', () => {
                console.log('Clique no lote para análise de calor:', lot.id, lot.name);
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

    if (allCoords.length > 0 && mapInstanceRef.current && !selectedLotData) {
      try {
        const bounds = L.latLngBounds(allCoords);
        mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      } catch (err) {
        console.error('Erro ao ajustar limites do mapa:', err);
      }
    }
  }, [lots, selectedLotData, onLotClick, isMapLoaded]);

  // Renderizar pontos de calor NDVI usando Canvas CircleMarkers de alta performance
  useEffect(() => {
    if (!mapInstanceRef.current || !pointsLayerGroupRef.current || !isMapLoaded) return;

    const pointsGroup = pointsLayerGroupRef.current;
    pointsGroup.clearLayers();

    const dataToRender = selectedLotData ? [selectedLotData] : heatmapData;
    let count = 0;
    const selectedCoords: L.LatLng[] = [];

    dataToRender.forEach((lotData) => {
      lotData.points.forEach((point) => {
        count++;
        const color = getPointColor(point.ndvi);

        if (selectedLotData) {
          selectedCoords.push(L.latLng(point.lat, point.lng));
        }

        const circle = L.circleMarker([point.lat, point.lng], {
          radius: 7,
          fillColor: color,
          fillOpacity: 0.75,
          color: color,
          weight: 0.5,
          opacity: 0.9
        });

        circle.bindTooltip(`NDVI: ${point.ndvi.toFixed(3)} | Saúde: ${point.health_status}`, {
          direction: 'top',
          offset: [0, -5]
        });

        pointsGroup.addLayer(circle);
      });
    });

    setTotalPointsCount(count);

    if (selectedLotData && selectedCoords.length > 0 && mapInstanceRef.current) {
      const bounds = L.latLngBounds(selectedCoords);
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
    }
  }, [heatmapData, selectedLotData, isMapLoaded]);

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
            <p className="text-gray-200">Carregando mapa de calor...</p>
          </div>
        </div>
      )}
      
      {/* Informações do mapa */}
      {isMapLoaded && (
        <div className="absolute bottom-4 left-4 bg-gray-900 bg-opacity-85 backdrop-blur-sm text-white rounded-xl shadow-2xl p-3 text-xs border border-gray-700 z-[1000]">
          <div className="space-y-1">
            <div className="font-bold text-sm text-green-400">
              {selectedLotData ? `${selectedLotData.lotName}` : 'Todos os Lotes'}
            </div>
            <div className="text-gray-300">
              {totalPointsCount.toLocaleString()} pontos de análise
            </div>
            {selectedLotData && (
              <div className="text-blue-300 font-semibold">
                NDVI médio: {selectedLotData.averageNdvi.toFixed(3)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legenda do mapa de calor */}
      {isMapLoaded && (
        <div className="absolute top-4 right-4 bg-gray-900 bg-opacity-85 backdrop-blur-sm text-white rounded-xl shadow-2xl p-4 border border-gray-700 z-[1000]">
          <h4 className="font-bold text-xs mb-3 flex items-center text-gray-200">
            <span className="w-2.5 h-2.5 rounded-full bg-green-400 mr-2"></span>
            Legenda NDVI
          </h4>
          <div className="space-y-2 text-xs">
            <div className="flex items-center">
              <div className="w-3.5 h-3.5 bg-green-600 rounded-sm mr-2 shadow-sm"></div>
              <span>&gt; 0.70 (Excelente)</span>
            </div>
            <div className="flex items-center">
              <div className="w-3.5 h-3.5 bg-lime-500 rounded-sm mr-2 shadow-sm"></div>
              <span>0.50 - 0.70 (Bom)</span>
            </div>
            <div className="flex items-center">
              <div className="w-3.5 h-3.5 bg-yellow-500 rounded-sm mr-2 shadow-sm"></div>
              <span>0.35 - 0.50 (Médio)</span>
            </div>
            <div className="flex items-center">
              <div className="w-3.5 h-3.5 bg-red-600 rounded-sm mr-2 shadow-sm"></div>
              <span>&lt; 0.35 (Crítico)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SatelliteHeatmapComponent;