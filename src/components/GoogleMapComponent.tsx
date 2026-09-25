import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import L from 'leaflet';
import { createDefaultTileLayers, addLayerControl } from '../services/leafletTileLayers';
import { addFactoryRadiusRings } from '../services/leafletRadiusRings';
import { 
  Lot, 
  LotInfo, 
  KmlTreeNode, 
  getKmlTree, 
  getKmlLots, 
  reloadKmlDirectory 
} from '../services/api';
import KmlFolderTreeFilter from './KmlFolderTreeFilter';
import { 
  FolderTree, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  MapPin, 
  Maximize2,
  Minimize2,
  Crosshair
} from 'lucide-react';

interface GoogleMapComponentProps {
  lots?: Lot[];
  onLotClick?: (lotId: string) => void;
  selectedLotInfo?: LotInfo;
  harvestMode?: boolean;
  harvestStatus?: { [key: string]: boolean };
  satelliteMode?: boolean;
  initialSelectedPaths?: string[];
  enableTreeFilter?: boolean;
}

const createUserLocationIcon = (): L.DivIcon => {
  return L.divIcon({
    className: 'user-location-marker',
    html: `
      <div style="
        width: 20px;
        height: 20px;
        background: #10b981;
        border: 3px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 0 10px rgba(16, 185, 129, 0.8), 0 0 20px rgba(16, 185, 129, 0.4);
        position: relative;
      ">
        <div style="
          position: absolute;
          inset: -6px;
          border-radius: 50%;
          background: rgba(16, 185, 129, 0.35);
          animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
        "></div>
      </div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
};

const getCategoryColor = (category?: string, index: number = 0) => {
  const cat = (category || '').toUpperCase();
  if (cat.includes('PROPRIA') || cat.startsWith('1')) {
    const greens = ['#10b981', '#059669', '#34d399', '#15803d', '#16a34a'];
    return greens[index % greens.length];
  }
  if (cat.includes('ACIONISTA') || cat.startsWith('2')) {
    const blues = ['#3b82f6', '#2563eb', '#60a5fa', '#1d4ed8', '#0284c7'];
    return blues[index % blues.length];
  }
  if (cat.includes('FORNECEDOR') || cat.startsWith('3')) {
    const ambers = ['#f59e0b', '#d97706', '#fbbf24', '#b45309', '#ea580c'];
    return ambers[index % ambers.length];
  }
  const general = ['#38bdf8', '#818cf8', '#a78bfa', '#f472b6', '#34d399'];
  return general[index % general.length];
};

const GoogleMapComponent: React.FC<GoogleMapComponentProps> = ({ 
  lots: externalLots, 
  onLotClick, 
  selectedLotInfo,
  harvestMode = false,
  harvestStatus,
  satelliteMode = false,
  initialSelectedPaths = [],
  enableTreeFilter = true
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polygonLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const canvasRendererRef = useRef<L.Canvas | null>(null);
  
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [showLotPanel, setShowLotPanel] = useState(true);

  // Estados do Filtro de Pastas KML
  const [isTreeOpen, setIsTreeOpen] = useState(true);
  const [treeData, setTreeData] = useState<KmlTreeNode | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<string[]>(
    initialSelectedPaths && initialSelectedPaths.length > 0 ? initialSelectedPaths : ['ALL']
  );
  const [internalLots, setInternalLots] = useState<Lot[]>([]);
  const [isLoadingLots, setIsLoadingLots] = useState(false);

  const [isFullscreen, setIsFullscreen] = useState(false);

  // Listener da tecla ESC para sair da Tela Cheia
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        if (isFullscreen) {
          setIsFullscreen(false);
          try {
            if (document.fullscreenElement && document.exitFullscreen) {
              document.exitFullscreen().catch(() => {});
            }
          } catch (err) {}
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Alternar Tela Cheia
  const handleToggleFullscreen = () => {
    setIsFullscreen(prev => {
      const next = !prev;
      if (next) {
        try {
          if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => {});
          }
        } catch (e) {}
      } else {
        try {
          if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          }
        } catch (e) {}
      }
      return next;
    });
  };

  // Sincronizar initialSelectedPaths quando mudar de tela
  useEffect(() => {
    if (initialSelectedPaths && initialSelectedPaths.length > 0) {
      setSelectedPaths(initialSelectedPaths);
    }
  }, [initialSelectedPaths]);

  // Carregar Árvore KML
  const loadTree = useCallback(async () => {
    if (!enableTreeFilter) return;
    try {
      const data = await getKmlTree();
      if (data.success && data.tree) {
        setTreeData(data.tree);
      }
    } catch (err) {
      console.error('Erro ao carregar árvore de KMLs:', err);
    }
  }, [enableTreeFilter]);

  // Carregar Lotes filtrados pelas pastas selecionadas
  const loadFilteredLots = useCallback(async (paths: string[]) => {
    if (!enableTreeFilter) return;
    setIsLoadingLots(true);
    try {
      // Se paths for explicitamente vazio [], não busca nada (0 lotes)
      if (paths.length === 0) {
        setInternalLots([]);
        return;
      }
      const loaded = await getKmlLots(paths);
      setInternalLots(loaded);
    } catch (err) {
      console.error('Erro ao carregar lotes KML filtrados:', err);
    } finally {
      setIsLoadingLots(false);
    }
  }, [enableTreeFilter]);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  useEffect(() => {
    if (enableTreeFilter) {
      loadFilteredLots(selectedPaths);
    }
  }, [selectedPaths, enableTreeFilter, loadFilteredLots]);

  // Determinar quais lotes exibir
  const currentLots = useMemo(() => {
    if (!enableTreeFilter && externalLots) {
      return externalLots;
    }
    // Se o filtro de árvore está ativo:
    if (selectedPaths.length === 0) {
      return [];
    }
    return internalLots;
  }, [externalLots, internalLots, enableTreeFilter, selectedPaths]);

  useEffect(() => {
    if (selectedLotInfo) {
      setShowLotPanel(true);
    }
  }, [selectedLotInfo]);

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
          setUserLocation({ lat: -9.80, lng: -36.15 });
        }
      );
    } else {
      setUserLocation({ lat: -9.80, lng: -36.15 });
    }
  }, []);

  // Inicializar o mapa Leaflet com Renderizador Canvas de Alta Performance
  useEffect(() => {
    if (!mapContainerRef.current || !userLocation || mapInstanceRef.current) return;

    try {
      const { defaultLayer, baseMaps } = createDefaultTileLayers();

      const map = L.map(mapContainerRef.current, {
        center: [userLocation.lat, userLocation.lng],
        zoom: 11,
        zoomControl: false,
        layers: [defaultLayer],
        preferCanvas: true // Renderizador Canvas extremamente rápido para 3000+ polígonos
      });

      // Canvas Renderer com padding para renderização suave
      const canvasRenderer = L.canvas({ padding: 0.5 });
      canvasRendererRef.current = canvasRenderer;

      L.control.zoom({ position: 'bottomright' }).addTo(map);
      addLayerControl(map, baseMaps);

      // Camada de Raios Concêntricos da Usina Porto Rico (1km a 50km)
      addFactoryRadiusRings(map);

      L.marker([userLocation.lat, userLocation.lng], {
        icon: createUserLocationIcon(),
        title: 'Sua localização'
      }).addTo(map);

      const polygonGroup = L.layerGroup().addTo(map);
      polygonLayerGroupRef.current = polygonGroup;
      mapInstanceRef.current = map;

      setIsMapLoaded(true);

      // Redimensionamentos preventivos
      const timers = [
        setTimeout(() => map.invalidateSize(), 100),
        setTimeout(() => map.invalidateSize(), 300),
        setTimeout(() => map.invalidateSize(), 700)
      ];

      return () => {
        timers.forEach(clearTimeout);
      };

    } catch (error) {
      console.error('Erro ao inicializar mapa Leaflet:', error);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        polygonLayerGroupRef.current = null;
        canvasRendererRef.current = null;
      }
    };
  }, [userLocation]);

  // Observer para redimensionar o mapa quando o container ou gaveta mudar
  useEffect(() => {
    if (!mapContainerRef.current || !mapInstanceRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      mapInstanceRef.current?.invalidateSize();
    });

    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => mapInstanceRef.current?.invalidateSize(), 100);
      setTimeout(() => mapInstanceRef.current?.invalidateSize(), 300);
      setTimeout(() => mapInstanceRef.current?.invalidateSize(), 600);
    }
  }, [isTreeOpen, isFullscreen]);

  // Atualizar lotes e polígonos no mapa
  useEffect(() => {
    if (!mapInstanceRef.current || !polygonLayerGroupRef.current || !isMapLoaded) return;

    const polygonGroup = polygonLayerGroupRef.current;
    polygonGroup.clearLayers();

    if (currentLots.length === 0) {
      return;
    }

    const allCoords: L.LatLng[] = [];
    const canvasRenderer = canvasRendererRef.current || undefined;

    currentLots.forEach((lot, index) => {
      if (lot.polygons && lot.polygons.length > 0) {
        let color: string;
        if (harvestMode) {
          const isHarvested = harvestStatus 
            ? (harvestStatus[lot.id] || harvestStatus[lot.path || ''] || lot.harvested || false)
            : (lot.harvested || false);
          color = isHarvested ? '#16a34a' : '#f8fafc';
        } else {
          color = getCategoryColor(lot.category, index);
        }

        lot.polygons.forEach((polygonData) => {
          if (polygonData.coordinates && polygonData.coordinates.length > 0) {
            try {
              const defaultFillOpacity = harvestMode ? (color === '#f8fafc' ? 0.25 : 0.65) : 0.35;
              const defaultStrokeOpacity = 0.95;
              const defaultStrokeWeight = 2;

              const latLngs: [number, number][] = polygonData.coordinates.map(coord => [coord[0], coord[1]]);

              latLngs.forEach(ll => {
                allCoords.push(L.latLng(ll[0], ll[1]));
              });

              const polygon = L.polygon(latLngs, {
                color: color,
                weight: defaultStrokeWeight,
                opacity: defaultStrokeOpacity,
                fillColor: color,
                fillOpacity: defaultFillOpacity,
                renderer: canvasRenderer
              });

              // Ao passar o mouse: realçar
              polygon.on('mouseover', () => {
                polygon.setStyle({
                  color: '#facc15',
                  weight: 4,
                  opacity: 1.0,
                  fillOpacity: Math.min(0.85, defaultFillOpacity + 0.35)
                });
                polygon.bringToFront();
              });

              // Ao retirar o mouse: restaurar estilo padrão
              polygon.on('mouseout', () => {
                polygon.setStyle({
                  color: color,
                  weight: defaultStrokeWeight,
                  opacity: defaultStrokeOpacity,
                  fillColor: color,
                  fillOpacity: defaultFillOpacity
                });
              });

              // Tooltip simples no hover (SEM popup duplicado!)
              const tooltipLabel = `${lot.name}${lot.farm_name ? ` (${lot.farm_name})` : ''}`;
              polygon.bindTooltip(tooltipLabel, {
                sticky: true,
                direction: 'top',
                opacity: 0.95
              });

              // Ao clicar: abrir SOMENTE o painel com os detalhes do lote
              polygon.on('click', () => {
                if (onLotClick) {
                  onLotClick(lot.path || lot.id);
                }
              });

              polygonGroup.addLayer(polygon);
            } catch (err) {
              console.error(`Erro ao renderizar polígono do lote ${lot.name}:`, err);
            }
          }
        });
      }
    });

    // Ajustar zoom automaticamente para enquadrar os lotes selecionados
    if (allCoords.length > 0 && mapInstanceRef.current) {
      try {
        const bounds = L.latLngBounds(allCoords);
        mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      } catch (err) {
        console.error('Erro ao ajustar limites do mapa:', err);
      }
    }
  }, [currentLots, onLotClick, isMapLoaded, harvestMode, harvestStatus, satelliteMode]);

  // Handlers de seleção da árvore
  const handlePathsChange = (newPaths: string[]) => {
    setSelectedPaths(newPaths);
  };

  const handleReload = async () => {
    try {
      setIsLoadingLots(true);
      await reloadKmlDirectory();
      await loadTree();
      await loadFilteredLots(selectedPaths);
    } catch (err) {
      console.error('Erro ao recarregar diretório KML:', err);
    } finally {
      setIsLoadingLots(false);
    }
  };

  const handleFitAll = () => {
    if (!mapInstanceRef.current || currentLots.length === 0) return;
    const allCoords: L.LatLng[] = [];
    currentLots.forEach(lot => {
      lot.polygons?.forEach(poly => {
        poly.coordinates?.forEach(c => allCoords.push(L.latLng(c[0], c[1])));
      });
    });
    if (allCoords.length > 0) {
      mapInstanceRef.current.fitBounds(L.latLngBounds(allCoords), { padding: [40, 40], maxZoom: 16 });
    }
  };

  return (
    <div className={`relative transition-all duration-300 ${
      isFullscreen 
        ? 'fixed inset-0 z-[100] w-screen h-screen bg-slate-950 p-2 sm:p-3 overflow-hidden flex' 
        : 'w-full h-full flex overflow-hidden bg-gray-900 rounded-2xl shadow-2xl border border-gray-200'
    }`}>
      {/* Barra Lateral / Gaveta do Filtro de Pastas KML */}
      {enableTreeFilter && (
        <div 
          className={`absolute sm:relative top-0 bottom-0 left-0 z-[1001] transition-all duration-300 ease-in-out flex shrink-0 ${
            isTreeOpen ? 'w-80 sm:w-88 md:w-96 translate-x-0' : 'w-0 -translate-x-full sm:translate-x-0 sm:w-0 overflow-hidden'
          }`}
        >
          {isTreeOpen && (
            <div className="w-full h-full p-2">
              <KmlFolderTreeFilter
                tree={treeData}
                selectedPaths={selectedPaths}
                onPathsChange={handlePathsChange}
                isLoading={isLoadingLots}
                onReload={handleReload}
                totalFilteredLots={currentLots.length}
              />
            </div>
          )}
        </div>
      )}

      {/* Botão Flutuante para Abrir/Fechar a Árvore de Pastas */}
      {enableTreeFilter && (
        <button
          onClick={() => setIsTreeOpen(!isTreeOpen)}
          className={`absolute top-4 ${isTreeOpen ? 'left-[330px] sm:left-[360px] md:left-[395px]' : 'left-4'} z-[1000] bg-white/95 backdrop-blur-md text-gray-800 hover:text-emerald-700 px-3 py-2 rounded-xl shadow-xl border border-gray-200 transition-all duration-300 flex items-center space-x-2 text-xs sm:text-sm font-semibold hover:shadow-emerald-900/10 cursor-pointer`}
          title={isTreeOpen ? 'Ocultar painel de pastas' : 'Exibir painel de pastas'}
        >
          <FolderTree className="w-4 h-4 text-emerald-600" />
          <span className="hidden sm:inline">{isTreeOpen ? 'Ocultar Pastas' : 'Explorar Pastas KML'}</span>
          {isTreeOpen ? (
            <ChevronLeft className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      )}

      {/* Botão Flutuante de Maximizar / Restaurar Mapa (com ESC) */}
      <button
        type="button"
        onClick={handleToggleFullscreen}
        className={`absolute top-4 right-4 z-[1000] px-3 py-2 rounded-xl shadow-xl border transition-all duration-300 flex items-center space-x-1.5 text-xs sm:text-sm font-bold cursor-pointer ${
          isFullscreen
            ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-400 ring-2 ring-amber-300'
            : 'bg-white/95 backdrop-blur-md text-gray-800 hover:text-emerald-700 border-gray-200 hover:shadow-emerald-900/10'
        }`}
        title={isFullscreen ? 'Sair da tela cheia (Pressione ESC)' : 'Maximizar mapa em tela cheia'}
      >
        {isFullscreen ? (
          <>
            <Minimize2 className="w-4 h-4" />
            <span className="hidden sm:inline">Restaurar</span>
            <span className="text-[10px] bg-slate-950/20 px-1.5 py-0.2 rounded font-mono">ESC</span>
          </>
        ) : (
          <>
            <Maximize2 className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">Maximizar</span>
          </>
        )}
      </button>

      {/* Container do Mapa Leaflet */}
      <div className="flex-1 relative w-full h-full min-h-0 overflow-hidden">
        <div 
          ref={mapContainerRef} 
          className="w-full h-full min-h-0" 
          style={{ height: '100%', width: '100%' }}
        />
        
        {/* Loading Overlay */}
        {(!isMapLoaded || isLoadingLots) && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/60 backdrop-blur-xs z-[1002]">
            <div className="bg-white/95 p-5 rounded-2xl shadow-2xl flex items-center space-x-3 text-gray-800 border border-gray-100">
              <div className="animate-spin rounded-full h-6 w-6 border-3 border-emerald-600 border-t-transparent"></div>
              <p className="text-sm font-medium">Carregando polígonos KML...</p>
            </div>
          </div>
        )}
        
        {/* Painel Lateral com Dados do Lote Clicado (ÚNICA JANELA) */}
        {selectedLotInfo && showLotPanel && (
          <LotInfoPanel 
            selectedLotInfo={selectedLotInfo} 
            onClose={() => setShowLotPanel(false)}
          />
        )}

        {/* Botão de Enquadramento Geral */}
        {currentLots.length > 0 && isMapLoaded && (
          <button
            onClick={handleFitAll}
            className="absolute bottom-4 right-14 z-[1000] bg-white/95 hover:bg-white text-gray-700 hover:text-emerald-700 p-2 rounded-xl shadow-lg border border-gray-200 transition-all cursor-pointer"
            title="Enquadrar todos os lotes visíveis"
          >
            <Crosshair className="w-5 h-5 text-emerald-700" />
          </button>
        )}

        {/* Badges Informativos no rodapé do mapa */}
        {currentLots.length === 0 && isMapLoaded && (
          <div className="absolute bottom-4 left-4 bg-gray-900/90 border border-amber-500/80 text-amber-200 px-3 py-2 rounded-xl text-xs font-medium shadow-md z-[1000] backdrop-blur-md max-w-sm">
            Nenhum lote selecionado. Marque uma pasta ou fazenda no menu de filtros para visualizar no mapa.
          </div>
        )}
        
        {currentLots.length > 0 && isMapLoaded && !harvestMode && (
          <div className="absolute bottom-4 left-4 bg-gray-900/85 border border-emerald-500/80 text-emerald-400 px-3 py-1.5 rounded-xl text-xs font-medium shadow-lg z-[1000] flex items-center backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse"></span>
            {currentLots.length.toLocaleString('pt-BR')} lote(s) exibido(s) no mapa
          </div>
        )}
        
        {harvestMode && isMapLoaded && (
          <div className="absolute bottom-4 left-4 bg-gray-900/85 border border-emerald-500/80 text-emerald-400 px-3 py-1.5 rounded-xl text-xs font-medium shadow-lg z-[1000] flex items-center backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2"></span>
            Modo Colheita: {currentLots.filter(lot => lot.harvested).length} de {currentLots.length} colhidos
          </div>
        )}
      </div>
    </div>
  );
};

// Componente para o painel de informações do lote
interface LotInfoPanelProps {
  selectedLotInfo: LotInfo | { error: string; message: string; farm_name?: string; lot_name?: string };
  onClose?: () => void;
}

const LotInfoPanel: React.FC<LotInfoPanelProps> = ({ selectedLotInfo, onClose }) => {
  if ('error' in selectedLotInfo) {
    return (
      <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-5 max-w-sm sm:max-w-md border border-red-200 z-[1000] animate-fade-in">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center text-red-600">
              ⚠️
            </div>
            <h3 className="text-base font-bold text-red-800">Sem dados na planilha</h3>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        
        <div className="space-y-3 text-xs sm:text-sm">
          <div className="bg-red-50 p-3.5 rounded-xl border border-red-200">
            <p className="text-red-800 font-medium mb-2 leading-relaxed">
              {selectedLotInfo.message}
            </p>
            
            {selectedLotInfo.farm_name && selectedLotInfo.lot_name && (
              <div className="text-red-700 text-xs space-y-1">
                <p><strong>Fazenda:</strong> {selectedLotInfo.farm_name}</p>
                <p><strong>Lote:</strong> {selectedLotInfo.lot_name}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const lotInfo = selectedLotInfo as LotInfo;
  
  return (
    <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-5 max-w-sm sm:max-w-md border border-gray-200/80 z-[1000] animate-fade-in max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
        <div>
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest block">
            {lotInfo.category || 'AGROMAPS'}
          </span>
          <h3 className="text-base font-bold text-gray-900">{lotInfo.talhao || 'Detalhes do Lote'}</h3>
        </div>
        <div className="flex items-center space-x-2">
          {lotInfo.status && (
            <div className={`px-2.5 py-1 rounded-full text-xs font-bold ${
              lotInfo.status === 'Acima' ? 'bg-emerald-100 text-emerald-800' :
              lotInfo.status === 'Necessário' ? 'bg-yellow-100 text-yellow-800' :
              lotInfo.status === 'Abaixo' ? 'bg-red-100 text-red-800' :
              'bg-orange-100 text-orange-800'
            }`}>
              {lotInfo.status}
            </div>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Caminho / Hierarquia de Pastas */}
      {lotInfo.path_parts && lotInfo.path_parts.length > 0 && (
        <div className="mb-3 bg-gray-50 border border-gray-200/70 p-2.5 rounded-xl text-xs text-gray-600 flex items-start space-x-1.5">
          <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="leading-snug">
            <span className="font-semibold text-gray-900">Hierarquia: </span>
            {lotInfo.path_parts.join(' ❯ ')}
          </div>
        </div>
      )}
      
      <div className="space-y-3 text-xs sm:text-sm">
        {/* Informações básicas */}
        <div className="grid grid-cols-2 gap-3 bg-gray-50/70 p-3 rounded-xl border border-gray-100">
          <div>
            <span className="font-medium text-gray-500 text-[11px] block">Fazenda / Pasta</span>
            <div className="text-gray-900 font-semibold truncate" title={lotInfo.fazenda}>{lotInfo.fazenda}</div>
          </div>
          <div>
            <span className="font-medium text-gray-500 text-[11px] block">Talhão / Arquivo</span>
            <div className="text-gray-900 font-semibold truncate" title={lotInfo.talhao}>{lotInfo.talhao}</div>
          </div>
          <div>
            <span className="font-medium text-gray-500 text-[11px] block">Variedade</span>
            <div className="text-gray-900 font-medium">{lotInfo.variedade || 'N/D'}</div>
          </div>
          <div>
            <span className="font-medium text-gray-500 text-[11px] block">Área</span>
            <div className="text-gray-900 font-bold text-emerald-700">{lotInfo.area && lotInfo.area !== 'N/D' ? `${lotInfo.area} ha` : 'N/D'}</div>
          </div>
        </div>
        
        {/* Plantio e Último Corte se disponíveis */}
        {((lotInfo.plantio && lotInfo.plantio !== 'N/D') || (lotInfo.ult_corte && lotInfo.ult_corte !== 'N/D')) && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="font-medium text-gray-500 text-[11px] block">Plantio</span>
              <div className="text-gray-900 font-medium">{lotInfo.plantio || 'N/D'}</div>
            </div>
            <div>
              <span className="font-medium text-gray-500 text-[11px] block">Últ. Corte</span>
              <div className="text-gray-900 font-medium">{lotInfo.ult_corte || 'N/D'}</div>
            </div>
          </div>
        )}
        
        {/* TCH Data se cadastrado na planilha */}
        {lotInfo.tch_real && lotInfo.tch_real !== '0' && (
          <div className="bg-emerald-50/90 p-3.5 rounded-xl border border-emerald-200">
            <h4 className="font-bold text-emerald-900 mb-2 text-xs uppercase tracking-wider">TCH (Toneladas/Hectare)</h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-emerald-700">Ton. Colhidas:</span>
                <div className="font-bold text-gray-900 text-sm">{lotInfo.ton_colhidas}</div>
              </div>
              <div>
                <span className="text-emerald-700">TCH Prev:</span>
                <div className="font-bold text-gray-900 text-sm">{lotInfo.tch_prev}</div>
              </div>
              <div>
                <span className="text-emerald-700">TCH Real:</span>
                <div className="font-bold text-emerald-700 text-sm">{lotInfo.tch_real}</div>
              </div>
              <div>
                <span className="text-emerald-700">% Atingido:</span>
                <div className="font-bold text-emerald-700 text-sm">{lotInfo.percentual}</div>
              </div>
            </div>
          </div>
        )}
        
        {/* Histórico simplificado */}
        {lotInfo.historico_tch && Object.keys(lotInfo.historico_tch).length > 0 && (
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
            <h4 className="font-semibold text-gray-700 mb-2 text-xs uppercase tracking-wider">Histórico TCH</h4>
            <div className="flex justify-between text-xs">
              {Object.entries(lotInfo.historico_tch).map(([year, value]) => (
                <div key={year} className="text-center">
                  <div className="text-gray-500 text-[10px]">{year}</div>
                  <div className="font-bold text-gray-800">{Number(value).toFixed(1)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GoogleMapComponent;