import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { createDefaultTileLayers, addLayerControl } from '../services/leafletTileLayers';
import { addFactoryRadiusRings } from '../services/leafletRadiusRings';
import { getHarvestLotsStatus, HarvestLotsStatusResponse } from '../services/api';

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

interface Vehicle {
  id: string;
  imei: string;
  placa: string;
  name: string;
  latitude: number;
  longitude: number;
  velocidade: number;
  data_hora_gps: string;
  status_veiculo: string;
  status_ignicao: string;
  last_updated: string;
  status: 'active' | 'inactive' | 'maintenance';
}

interface FleetMapComponentProps {
  vehicles: Vehicle[];
  lots: Lot[];
  selectedVehicleId?: string | null;
  onVehicleSelected?: () => void;
}

const createVehicleIcon = (vehicle: Vehicle): L.DivIcon => {
  let color = '#22c55e';
  switch (vehicle.status) {
    case 'active': color = '#22c55e'; break;
    case 'inactive': color = '#6b7280'; break;
    case 'maintenance': color = '#f97316'; break;
    default: color = '#6b7280';
  }

  // Cor especial para alertas críticos
  if (vehicle.velocidade === 0 && vehicle.status_ignicao === 'LIGADA') {
    color = '#f59e0b'; // Laranja para desperdício
  }
  if (vehicle.velocidade > 0 && vehicle.status_ignicao === 'DESLIGADA') {
    color = '#ef4444'; // Vermelho para anomalia
  }

  return L.divIcon({
    className: 'custom-vehicle-marker',
    html: `
      <div style="
        width: 34px;
        height: 34px;
        background: ${color};
        border: 2.5px solid #ffffff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        cursor: pointer;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
          <path d="M4 15.5C4 16.3284 4.67157 17 5.5 17H6.5C6.5 18.3807 7.61929 19.5 9 19.5C10.3807 19.5 11.5 18.3807 11.5 17H12.5C12.5 18.3807 13.6193 19.5 15 19.5C16.3807 19.5 17.5 18.3807 17.5 17H18.5C19.3284 17 20 16.3284 20 15.5V13H22L20 8H17V6.5C17 5.67157 16.3284 5 15.5 5H8.5C7.67157 5 7 5.67157 7 6.5V13H4V15.5ZM9 7H15V11H9V7ZM9 17.5C8.72386 17.5 8.5 17.2761 8.5 17C8.5 16.7239 8.72386 16.5 9 16.5C9.27614 16.5 9.5 16.7239 9.5 17C9.5 17.2761 9.27614 17.5 9 17.5ZM15 17.5C14.7239 17.5 14.5 17.2761 14.5 17C14.5 16.7239 14.7239 16.5 15 16.5C15.2761 16.5 15.5 16.7239 15.5 17C15.5 17.2761 15.2761 17.5 15 17.5Z"/>
        </svg>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18]
  });
};

const FleetMapComponent: React.FC<FleetMapComponentProps> = ({ 
  vehicles, 
  lots,
  selectedVehicleId, 
  onVehicleSelected 
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const vehicleLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const polygonLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const highlightLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [harvestStatus, setHarvestStatus] = useState<HarvestLotsStatusResponse>({});

  // Buscar status de colheita dos lotes
  useEffect(() => {
    const fetchHarvestStatus = async () => {
      try {
        const status = await getHarvestLotsStatus();
        setHarvestStatus(status);
      } catch (error) {
        console.error('Erro ao buscar status de colheita:', error);
      }
    };

    fetchHarvestStatus();
    const interval = setInterval(fetchHarvestStatus, 300000);
    return () => clearInterval(interval);
  }, []);

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
      vehicleLayerGroupRef.current = L.layerGroup().addTo(map);
      highlightLayerGroupRef.current = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;
      setIsMapLoaded(true);

      setTimeout(() => {
        map.invalidateSize();
      }, 200);

    } catch (error) {
      console.error('Erro ao inicializar mapa de frota Leaflet:', error);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        polygonLayerGroupRef.current = null;
        vehicleLayerGroupRef.current = null;
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
              let fillColor = '#e5e7eb';
              let strokeColor = '#9ca3af';
              let statusText = 'Não Colhido';

              const farmName = lot.farm_name?.trim().toUpperCase() || '';
              const lotName = lot.name?.trim() || '';
              const lotNumber = lot.lot_number?.trim() || '';
              const lotNumberMatch = lotName.match(/Lote\s+(\d+)/i);
              const extractedLotNumber = lotNumberMatch ? lotNumberMatch[1] : lotNumber;

              const searchKeys = [
                `${farmName}_${lotName}`,
                `${farmName}_Lote ${extractedLotNumber}`,
                `${farmName}_${extractedLotNumber}`,
                `${farmName}_${lotNumber}`,
              ];

              for (const key of searchKeys) {
                if (harvestStatus[key]) {
                  const status = harvestStatus[key].status;
                  if (status === 'SIM') {
                    fillColor = '#22c55e';
                    strokeColor = '#16a34a';
                    statusText = 'Colhido';
                  } else if (status === 'COLHENDO') {
                    fillColor = '#f97316';
                    strokeColor = '#ea580c';
                    statusText = 'Colhendo';
                  } else {
                    fillColor = '#e5e7eb';
                    strokeColor = '#9ca3af';
                    statusText = 'Não Colhido';
                  }
                  break;
                }
              }

              const defaultFillOpacity = 0.3;
              const defaultStrokeWeight = 2;
              const latLngs: [number, number][] = polygonData.coordinates.map(coord => [coord[0], coord[1]]);

              const polygon = L.polygon(latLngs, {
                color: strokeColor,
                weight: defaultStrokeWeight,
                opacity: 0.85,
                fillColor: fillColor,
                fillOpacity: defaultFillOpacity
              });

              // Hover: realce
              polygon.on('mouseover', () => {
                polygon.setStyle({
                  color: '#ffffff',
                  weight: 4,
                  opacity: 1.0,
                  fillOpacity: 0.65
                });
                polygon.bringToFront();
              });

              polygon.on('mouseout', () => {
                polygon.setStyle({
                  color: strokeColor,
                  weight: defaultStrokeWeight,
                  opacity: 0.85,
                  fillColor: fillColor,
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
                    margin-bottom: 10px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid #e5e7eb;
                  ">
                    <div style="
                      width: 10px; 
                      height: 10px; 
                      background: ${fillColor}; 
                      border-radius: 50%; 
                      margin-right: 8px;
                    "></div>
                    <h4 style="
                      margin: 0; 
                      color: ${strokeColor}; 
                      font-weight: 700; 
                      font-size: 15px;
                    ">${lot.name}</h4>
                  </div>

                  ${lot.farm_name ? `
                    <div style="
                      background: ${fillColor}20;
                      padding: 6px 10px;
                      border-radius: 6px;
                      margin-bottom: 8px;
                    ">
                      <p style="
                        margin: 0; 
                        color: ${strokeColor}; 
                        font-size: 13px; 
                        font-weight: 600;
                      ">🏡 ${lot.farm_name}</p>
                    </div>
                  ` : ''}

                  <div style="
                    background: ${fillColor}25;
                    padding: 8px 10px;
                    border-radius: 6px;
                    margin-bottom: 6px;
                    border-left: 3px solid ${strokeColor};
                  ">
                    <p style="
                      margin: 0; 
                      color: ${strokeColor}; 
                      font-size: 13px; 
                      font-weight: 700;
                    ">📊 Status: ${statusText}</p>
                  </div>
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
  }, [lots, isMapLoaded, harvestStatus]);

  // Atualizar marcadores de veículos
  useEffect(() => {
    if (!mapInstanceRef.current || !vehicleLayerGroupRef.current || !isMapLoaded) return;

    const vehicleGroup = vehicleLayerGroupRef.current;
    vehicleGroup.clearLayers();

    const boundsCoords: [number, number][] = [];

    vehicles.forEach((vehicle) => {
      try {
        if (!vehicle.latitude || !vehicle.longitude) return;

        boundsCoords.push([vehicle.latitude, vehicle.longitude]);

        const marker = L.marker([vehicle.latitude, vehicle.longitude], {
          icon: createVehicleIcon(vehicle),
          title: vehicle.name
        });

        const popupContent = `
          <div style="
            padding: 16px; 
            min-width: 220px; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #ffffff;
            color: #1f2937;
          ">
            <div style="
              display: flex; 
              align-items: center; 
              margin-bottom: 12px;
              padding-bottom: 8px;
              border-bottom: 1px solid #e5e7eb;
            ">
              <div style="
                width: 10px; 
                height: 10px; 
                background: #22c55e; 
                border-radius: 50%; 
                margin-right: 8px;
              "></div>
              <h3 style="
                margin: 0; 
                color: #111827; 
                font-weight: 700; 
                font-size: 16px;
              ">${vehicle.name}</h3>
            </div>
            
            <div style="
              background: #f3f4f6;
              padding: 8px 12px;
              border-radius: 8px;
              margin-bottom: 10px;
            ">
              <p style="margin: 0 0 4px 0; color: #374151; font-size: 13px; font-weight: 600;">🚗 Placa: ${vehicle.placa}</p>
              <p style="margin: 0; color: #6b7280; font-size: 12px;">📱 IMEI: ${vehicle.imei}</p>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
              <div style="background: #f9fafb; padding: 6px; border-radius: 6px; text-align: center;">
                <span style="font-size: 10px; color: #6b7280; text-transform: uppercase;">Velocidade</span>
                <div style="font-size: 14px; font-weight: 700; color: #111827;">${vehicle.velocidade} km/h</div>
              </div>
              <div style="background: #f9fafb; padding: 6px; border-radius: 6px; text-align: center;">
                <span style="font-size: 10px; color: #6b7280; text-transform: uppercase;">Ignição</span>
                <div style="font-size: 14px; font-weight: 700; color: ${vehicle.status_ignicao === 'LIGADA' ? '#16a34a' : '#9ca3af'};">
                  ${vehicle.status_ignicao}
                </div>
              </div>
            </div>
          </div>
        `;

        marker.bindPopup(popupContent, { maxWidth: 300 });
        vehicleGroup.addLayer(marker);
      } catch (err) {
        console.error('Erro ao adicionar marcador de veículo:', err);
      }
    });

    if (boundsCoords.length > 0 && mapInstanceRef.current && !selectedVehicleId) {
      const bounds = L.latLngBounds(boundsCoords);
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [vehicles, isMapLoaded, selectedVehicleId]);

  // Efeito de destaque para veículo selecionado
  useEffect(() => {
    if (!selectedVehicleId || !mapInstanceRef.current || !highlightLayerGroupRef.current || !isMapLoaded) return;

    const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);
    if (!selectedVehicle) return;

    const highlightGroup = highlightLayerGroupRef.current;
    highlightGroup.clearLayers();

    // Centralizar no veículo
    mapInstanceRef.current.setView([selectedVehicle.latitude, selectedVehicle.longitude], 16, { animate: true });

    // Marcador com animação de pulso
    const pulseIcon = L.divIcon({
      className: 'custom-vehicle-marker',
      html: `
        <div style="
          width: 54px;
          height: 54px;
          background: #f59e0b;
          border: 4px solid #ffffff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 20px rgba(245, 158, 11, 0.8);
          animation: pulse 1.5s infinite;
        ">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
            <path d="M4 15.5C4 16.3284 4.67157 17 5.5 17H6.5C6.5 18.3807 7.61929 19.5 9 19.5C10.3807 19.5 11.5 18.3807 11.5 17H12.5C12.5 18.3807 13.6193 19.5 15 19.5C16.3807 19.5 17.5 18.3807 17.5 17H18.5C19.3284 17 20 16.3284 20 15.5V13H22L20 8H17V6.5C17 5.67157 16.3284 5 15.5 5H8.5C7.67157 5 7 5.67157 7 6.5V13H4V15.5ZM9 7H15V11H9V7ZM9 17.5C8.72386 17.5 8.5 17.2761 8.5 17C8.5 16.7239 8.72386 16.5 9 16.5C9.27614 16.5 9.5 16.7239 9.5 17C9.5 17.2761 9.27614 17.5 9 17.5ZM15 17.5C14.7239 17.5 14.5 17.2761 14.5 17C14.5 16.7239 14.7239 16.5 15 16.5C15.2761 16.5 15.5 16.7239 15.5 17C15.5 17.2761 15.2761 17.5 15 17.5Z"/>
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
      <div style="padding: 16px; min-width: 240px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="display: flex; align-items: center; margin-bottom: 10px;">
          <span style="font-size: 20px; margin-right: 8px;">⚠️</span>
          <h3 style="margin: 0; color: #d97706; font-weight: 700; font-size: 16px;">${selectedVehicle.name}</h3>
        </div>
        <div style="background: #fef3c7; padding: 10px; border-radius: 8px; border-left: 3px solid #f59e0b; margin-bottom: 10px;">
          <p style="margin: 0; color: #92400e; font-size: 13px; font-weight: 600;">Desperdício de Combustível</p>
          <p style="margin: 4px 0 0 0; color: #b45309; font-size: 12px;">Veículo parado com motor ligado</p>
        </div>
        <div style="font-size: 12px; color: #6b7280;">
          <div><strong>Placa:</strong> ${selectedVehicle.placa}</div>
          <div><strong>Velocidade:</strong> ${selectedVehicle.velocidade} km/h</div>
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
  }, [selectedVehicleId, vehicles, isMapLoaded, onVehicleSelected]);

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
            <p className="text-gray-200">Carregando mapa de frota...</p>
          </div>
        </div>
      )}
      
      {vehicles.length === 0 && isMapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-80 z-10 pointer-events-none">
          <div className="text-center text-gray-300">
            <div className="text-lg font-medium mb-1">Nenhum veículo encontrado</div>
            <div className="text-sm text-gray-400">Verifique os dados de telemetria</div>
          </div>
        </div>
      )}
      
      {vehicles.length > 0 && isMapLoaded && (
        <div className="absolute bottom-4 left-4 bg-gray-900 bg-opacity-85 border border-green-500 text-green-400 px-3.5 py-2 rounded-lg text-xs font-semibold shadow-xl z-[1000] flex items-center backdrop-blur-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-green-400 mr-2 animate-pulse"></span>
          🚜 {vehicles.length} veículo(s) • 📍 {lots.length} lote(s)
        </div>
      )}
    </div>
  );
};

export default FleetMapComponent;