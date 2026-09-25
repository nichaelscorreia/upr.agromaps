import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import L from 'leaflet';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Calendar, 
  Flame, 
  Sparkles, 
  TrendingUp, 
  BarChart3, 
  FolderTree, 
  ChevronLeft, 
  ChevronRight, 
  Wheat, 
  MapPin, 
  FastForward, 
  Rewind, 
  SkipBack, 
  SkipForward, 
  Repeat, 
  X, 
  Table as TableIcon, 
  Search, 
  Truck, 
  AlertCircle,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { createDefaultTileLayers, addLayerControl } from '../services/leafletTileLayers';
import { addFactoryRadiusRings } from '../services/leafletRadiusRings';
import { 
  getHarvestProjectionData, 
  HarvestProjectionDataResponse, 
  HarvestProjectionDay, 
  HarvestProjectionLotDetail, 
  Lot, 
  KmlTreeNode, 
  getKmlTree, 
  getKmlLots 
} from '../services/api';
import KmlFolderTreeFilter from './KmlFolderTreeFilter';

const formatNumberBR = (num: number, decimals: number = 0): string => {
  return (num || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

const formatTons = (tons: number): string => {
  return `${formatNumberBR(tons, 2)} Ton`;
};

export const HarvestTimelineAnimation: React.FC = () => {
  // Dados da API de projeção
  const [projectionData, setProjectionData] = useState<HarvestProjectionDataResponse | null>(null);
  const [isLoadingProjection, setIsLoadingProjection] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Estados de Visualização
  const [activeTab, setActiveTab] = useState<'map' | 'analytics'>('map');
  const [isTreeOpen, setIsTreeOpen] = useState<boolean>(true);
  const [showDailyDrawer, setShowDailyDrawer] = useState<boolean>(false);
  const [dailySearchTerm, setDailySearchTerm] = useState<string>('');
  const [analyticsMonthFilter, setAnalyticsMonthFilter] = useState<string>('ALL');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);

  // Estados do Filtro de Pastas KML
  const [treeData, setTreeData] = useState<KmlTreeNode | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<string[]>(['ALL']);
  const [internalLots, setInternalLots] = useState<Lot[]>([]);
  const [isLoadingLots, setIsLoadingLots] = useState<boolean>(false);

  // Estados do Player de Animação Temporal
  const [currentDateIndex, setCurrentDateIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1); // 0.5x, 1x, 2x, 5x, 10x
  const [isLooping, setIsLooping] = useState<boolean>(true);

  // Modal de Detalhes do Talhão
  const [selectedLotModal, setSelectedLotModal] = useState<{
    isOpen: boolean;
    lot?: Lot;
    projectionDetail?: HarvestProjectionLotDetail;
    fazendaNum?: number | string;
    talhaoNum?: number | string;
  }>({
    isOpen: false
  });

  // Referências do Mapa Leaflet
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polygonLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const canvasRendererRef = useRef<L.Canvas | null>(null);
  const polygonMapRef = useRef<Map<string, { polygon: L.Polygon; lot: Lot; key: string }>>(new Map());
  const [isMapLoaded, setIsMapLoaded] = useState<boolean>(false);
  const hasFittedBoundsRef = useRef<boolean>(false);

  // 1. Carregar Dados de Projeção da Safra 2026/2027
  const loadProjection = useCallback(async () => {
    setIsLoadingProjection(true);
    setLoadError(null);
    try {
      const res = await getHarvestProjectionData();
      if (res && res.success) {
        setProjectionData(res);
      } else {
        setLoadError(res?.error || 'Não foi possível carregar a projeção da safra.');
      }
    } catch (err: any) {
      console.error('Erro ao buscar dados de projeção:', err);
      setLoadError(err?.message || 'Erro de conexão ao carregar dados da safra.');
    } finally {
      setIsLoadingProjection(false);
    }
  }, []);

  useEffect(() => {
    loadProjection();
  }, [loadProjection]);

  // 2. Carregar Árvore de Pastas KML
  const loadTree = useCallback(async () => {
    try {
      const data = await getKmlTree();
      if (data && data.success && data.tree) {
        setTreeData(data.tree);
      }
    } catch (err) {
      console.error('Erro ao carregar árvore de KMLs:', err);
    }
  }, []);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  // 3. Carregar Lotes filtrados pelas pastas selecionadas
  const loadFilteredLots = useCallback(async (paths: string[]) => {
    setIsLoadingLots(true);
    try {
      if (!paths || paths.length === 0) {
        setInternalLots([]);
        return;
      }
      const loaded = await getKmlLots(paths);
      setInternalLots(loaded || []);
    } catch (err) {
      console.error('Erro ao carregar lotes KML filtrados:', err);
    } finally {
      setIsLoadingLots(false);
    }
  }, []);

  useEffect(() => {
    loadFilteredLots(selectedPaths);
  }, [selectedPaths, loadFilteredLots]);

  // Extrair datas da projeção
  const dates = useMemo(() => {
    return projectionData?.dates || [];
  }, [projectionData]);

  const timeline = useMemo(() => {
    return projectionData?.timeline || [];
  }, [projectionData]);

  const lotsMap = useMemo(() => {
    return projectionData?.lots_map || {};
  }, [projectionData]);

  // Dia Atual da Simulação
  const currentSimDay: HarvestProjectionDay | null = useMemo(() => {
    if (!timeline || timeline.length === 0) return null;
    if (currentDateIndex < 0) return timeline[0];
    if (currentDateIndex >= timeline.length) return timeline[timeline.length - 1];
    return timeline[currentDateIndex];
  }, [timeline, currentDateIndex]);

  const currentSimDate: string = useMemo(() => {
    return currentSimDay?.date || (dates[currentDateIndex] || '');
  }, [currentSimDay, dates, currentDateIndex]);

  // 4. Timer do Player de Animação
  useEffect(() => {
    if (!isPlaying || dates.length === 0) return;

    const intervalMs = Math.max(40, Math.round(800 / playbackSpeed));

    const timer = setInterval(() => {
      setCurrentDateIndex(prevIndex => {
        if (prevIndex >= dates.length - 1) {
          if (isLooping) {
            return 0;
          } else {
            setIsPlaying(false);
            return prevIndex;
          }
        }
        return prevIndex + 1;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, isLooping, dates.length]);

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

  // Controles de Playback
  const handlePlayPause = () => {
    if (dates.length === 0) return;
    if (currentDateIndex >= dates.length - 1 && !isPlaying) {
      setCurrentDateIndex(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(prev => !prev);
    }
  };

  const handleStepPrev = (days: number = 1) => {
    setIsPlaying(false);
    setCurrentDateIndex(prev => Math.max(0, prev - days));
  };

  const handleStepNext = (days: number = 1) => {
    setIsPlaying(false);
    setCurrentDateIndex(prev => Math.min(Math.max(0, dates.length - 1), prev + days));
  };

  const handleJumpToStart = () => {
    setIsPlaying(false);
    setCurrentDateIndex(0);
  };

  const handleJumpToEnd = () => {
    setIsPlaying(false);
    setCurrentDateIndex(Math.max(0, dates.length - 1));
  };

  const handleJumpToMonth = (monthPrefix: string) => {
    setIsPlaying(false);
    const targetIdx = dates.findIndex(d => d.startsWith(monthPrefix));
    if (targetIdx !== -1) {
      setCurrentDateIndex(targetIdx);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) {
      setCurrentDateIndex(val);
    }
  };

  // Helper para extrair chave normalizada do lote
  const extractLotKey = useCallback((lot: Lot): { key: string; fazenda: number | null; talhao: number | null } => {
    let cleanName = (lot.name || '').replace(/\\/g, '/').split('/').pop() || lot.name || '';
    if (cleanName.toLowerCase().endsWith('.kml')) cleanName = cleanName.slice(0, -4);
    
    const parts = cleanName.split('-');
    if (parts.length >= 2) {
      const faz = parseInt(parts[0], 10);
      const tal = parseInt(parts[1], 10);
      if (!isNaN(faz) && !isNaN(tal)) {
        return { key: `${faz}_${tal}`, fazenda: faz, talhao: tal };
      }
    }

    const pathParts = (lot.path || lot.id || '').replace(/\\/g, '/').split('/');
    for (const part of pathParts) {
      const subParts = part.split('-');
      if (subParts.length >= 2) {
        const faz = parseInt(subParts[0], 10);
        const tal = parseInt(subParts[1], 10);
        if (!isNaN(faz) && !isNaN(tal)) {
          return { key: `${faz}_${tal}`, fazenda: faz, talhao: tal };
        }
      }
    }

    return { key: '', fazenda: null, talhao: null };
  }, []);

  // 5. Inicializar o Mapa Leaflet
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current || activeTab !== 'map') return;

    try {
      const { defaultLayer, baseMaps } = createDefaultTileLayers();

      const map = L.map(mapContainerRef.current, {
        center: [-9.8140414, -36.2177396], // Usina Porto Rico
        zoom: 12,
        zoomControl: false,
        layers: [defaultLayer],
        preferCanvas: true
      });

      const canvasRenderer = L.canvas({ padding: 0.5 });
      canvasRendererRef.current = canvasRenderer;

      L.control.zoom({ position: 'bottomright' }).addTo(map);
      addLayerControl(map, baseMaps);

      // Camada de Raios Concêntricos da Usina Porto Rico (1km a 50km)
      addFactoryRadiusRings(map);

      const polygonGroup = L.layerGroup().addTo(map);
      polygonLayerGroupRef.current = polygonGroup;
      mapInstanceRef.current = map;
      setIsMapLoaded(true);

      const timers = [
        setTimeout(() => map.invalidateSize(), 100),
        setTimeout(() => map.invalidateSize(), 300),
        setTimeout(() => map.invalidateSize(), 800)
      ];

      return () => {
        timers.forEach(clearTimeout);
      };
    } catch (error) {
      console.error('Erro ao inicializar mapa Leaflet:', error);
    }
  }, [activeTab]);

  // Resize observer
  useEffect(() => {
    if (!mapContainerRef.current || !mapInstanceRef.current) return;
    const resizeObserver = new ResizeObserver(() => {
      mapInstanceRef.current?.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Redimensionamento quando altera fullscreen, gaveta de árvore ou aba
  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => mapInstanceRef.current?.invalidateSize(), 100);
      setTimeout(() => mapInstanceRef.current?.invalidateSize(), 300);
      setTimeout(() => mapInstanceRef.current?.invalidateSize(), 600);
    }
  }, [isTreeOpen, activeTab, isFullscreen]);

  // 6. Renderizar / Atualizar Polígonos quando os lotes, data ou mapa mudarem
  useEffect(() => {
    if (!mapInstanceRef.current || !polygonLayerGroupRef.current || !isMapLoaded) return;

    const polygonGroup = polygonLayerGroupRef.current;
    polygonGroup.clearLayers();
    polygonMapRef.current.clear();

    if (!internalLots || internalLots.length === 0) return;

    const canvasRenderer = canvasRendererRef.current || undefined;
    const simDate = currentSimDate;
    const allCoords: L.LatLng[] = [];

    internalLots.forEach(lot => {
      if (!lot.polygons || lot.polygons.length === 0) return;

      const { key, fazenda, talhao } = extractLotKey(lot);
      const projDetail: HarvestProjectionLotDetail | undefined = key ? lotsMap[key] : undefined;

      // Determinar Status Temporal
      let status: 'HARVESTED' | 'CURRENT' | 'PENDING' | 'UNPROJECTED' = 'UNPROJECTED';
      let fillColor = '#64748b';
      let strokeColor = '#475569';
      let fillOpacity = 0.18;
      let strokeWeight = 1;
      let isFlamePulse = false;

      if (projDetail && projDetail.dates && projDetail.dates.length > 0 && simDate) {
        if (projDetail.dates.includes(simDate)) {
          status = 'CURRENT';
          fillColor = '#ef4444'; // Flaming Red
          strokeColor = '#fef08a'; // Yellow outline
          fillOpacity = 0.92;
          strokeWeight = 3.5;
          isFlamePulse = true;
        } else if (projDetail.primary_date < simDate) {
          status = 'HARVESTED';
          fillColor = '#f59e0b'; // Amber Gold
          strokeColor = '#d97706';
          fillOpacity = 0.68;
          strokeWeight = 1.5;
        } else {
          status = 'PENDING';
          fillColor = '#10b981'; // Emerald Green
          strokeColor = '#059669';
          fillOpacity = 0.42;
          strokeWeight = 1.5;
        }
      }

      lot.polygons.forEach(polygonData => {
        if (!polygonData.coordinates || polygonData.coordinates.length === 0) return;

        try {
          const latLngs: [number, number][] = polygonData.coordinates.map(c => [c[0], c[1]]);
          latLngs.forEach(ll => allCoords.push(L.latLng(ll[0], ll[1])));

          const polygon = L.polygon(latLngs, {
            color: strokeColor,
            weight: strokeWeight,
            opacity: 0.95,
            fillColor: fillColor,
            fillOpacity: fillOpacity,
            renderer: canvasRenderer
          });

          if (isFlamePulse) {
            polygon.bringToFront();
          }

          let statusBadge = '';
          if (status === 'CURRENT') {
            statusBadge = `<div style="background:#ef4444; color:#fff; font-weight:800; padding:2px 6px; border-radius:4px; font-size:10px; margin-top:2px; display:inline-block;">🔥 SENDO COLHIDO HOJE</div>`;
          } else if (status === 'HARVESTED') {
            statusBadge = `<div style="background:#f59e0b; color:#fff; font-weight:700; padding:2px 6px; border-radius:4px; font-size:10px; margin-top:2px; display:inline-block;">✅ Colhido em ${projDetail?.primary_date || ''}</div>`;
          } else if (status === 'PENDING') {
            statusBadge = `<div style="background:#10b981; color:#fff; font-weight:700; padding:2px 6px; border-radius:4px; font-size:10px; margin-top:2px; display:inline-block;">⏳ Programado p/ ${projDetail?.primary_date || ''}</div>`;
          } else {
            statusBadge = `<div style="background:#64748b; color:#fff; font-weight:600; padding:2px 6px; border-radius:4px; font-size:10px; margin-top:2px; display:inline-block;">Sem Projeção na Safra</div>`;
          }

          const tooltipHtml = `
            <div style="font-family: inherit; font-size: 11px; line-height: 1.35; padding: 2px;">
              <strong style="color: #0f172a; font-size: 12px; display:block;">${lot.name}</strong>
              ${lot.farm_name ? `<span style="color: #475569; font-size: 10px;">${lot.farm_name}</span><br/>` : ''}
              ${projDetail ? `
                <div style="margin-top: 3px; font-size: 10.5px; color: #1e293b;">
                  <div><strong>Toneladas:</strong> ${formatTons(projDetail.total_toneladas)}</div>
                  <div><strong>Corte:</strong> ${projDetail.cortes.join(', ') || 'N/D'}</div>
                </div>
              ` : ''}
              ${statusBadge}
            </div>
          `;

          polygon.bindTooltip(tooltipHtml, {
            sticky: true,
            direction: 'top',
            opacity: 0.98,
            className: 'leaflet-agro-tooltip'
          });

          polygon.on('mouseover', () => {
            polygon.setStyle({
              weight: 4,
              color: '#ffffff',
              fillOpacity: Math.min(0.95, fillOpacity + 0.3)
            });
            polygon.bringToFront();
          });

          polygon.on('mouseout', () => {
            polygon.setStyle({
              weight: strokeWeight,
              color: strokeColor,
              fillColor: fillColor,
              fillOpacity: fillOpacity
            });
          });

          polygon.on('click', () => {
            setSelectedLotModal({
              isOpen: true,
              lot,
              projectionDetail: projDetail,
              fazendaNum: fazenda || '',
              talhaoNum: talhao || ''
            });
          });

          polygonGroup.addLayer(polygon);
          if (key) {
            polygonMapRef.current.set(key, { polygon, lot, key });
          }
        } catch (e) {
          console.warn('Erro ao desenhar polígono:', e);
        }
      });
    });

    // Ajustar zoom inicial automaticamente aos lotes carregados
    if (!hasFittedBoundsRef.current && allCoords.length > 0 && mapInstanceRef.current) {
      try {
        const bounds = L.latLngBounds(allCoords);
        mapInstanceRef.current.fitBounds(bounds, { padding: [35, 35], maxZoom: 14 });
        hasFittedBoundsRef.current = true;
      } catch (e) {
        console.warn('Erro ao ajustar limites do mapa:', e);
      }
    }
  }, [internalLots, currentSimDate, lotsMap, extractLotKey, isMapLoaded]);

  // Centralizar mapa em um lote específico
  const handleFlyToLot = (fazenda: string | number, talhao: string | number) => {
    const key = `${parseInt(String(fazenda), 10)}_${parseInt(String(talhao), 10)}`;
    const matched = polygonMapRef.current.get(key);
    if (matched && mapInstanceRef.current) {
      try {
        const bounds = matched.polygon.getBounds();
        mapInstanceRef.current.flyToBounds(bounds, { maxZoom: 16, duration: 1.2 });
        matched.polygon.setStyle({
          color: '#ffffff',
          weight: 5,
          fillColor: '#ef4444',
          fillOpacity: 1
        });
      } catch (e) {
        console.warn('Erro ao focar no lote:', e);
      }
    }
  };

  // Talhões colhidos no dia da simulação
  const todayLotsList = useMemo(() => {
    if (!currentSimDay || !currentSimDay.lots) return [];
    if (!dailySearchTerm) return currentSimDay.lots;
    const term = dailySearchTerm.toLowerCase();
    return currentSimDay.lots.filter(l => 
      l.fazenda.toLowerCase().includes(term) || 
      l.talhao.toLowerCase().includes(term) || 
      l.corte.toLowerCase().includes(term)
    );
  }, [currentSimDay, dailySearchTerm]);

  // Estatísticas do Analytics
  const summary = projectionData?.summary;

  return (
    <div className={`transition-all duration-300 select-none ${
      isFullscreen 
        ? 'fixed inset-0 z-[100] w-screen h-screen bg-slate-950 p-2 sm:p-3 overflow-hidden flex flex-col gap-2' 
        : 'h-full w-full flex-1 flex flex-col gap-2 min-h-0 overflow-hidden relative'
    }`}>
      {/* 1. Header Compacto e Moderno */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 bg-white px-3 sm:px-4 py-2 rounded-xl shadow-xs border border-gray-200 shrink-0 z-20">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-600 to-teal-800 rounded-lg flex items-center justify-center text-white shadow-xs shrink-0">
            <Flame className="w-4.5 h-4.5 text-amber-300 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm sm:text-base font-bold text-gray-900 leading-tight">
                Evolução Temporal da Safra 2026/2027
              </h2>
              <span className="inline-flex items-center space-x-1 px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                <span>Simulação Dia a Dia</span>
              </span>
            </div>
            <p className="text-[11px] text-gray-500 hidden sm:block">
              {activeTab === 'map' 
                ? 'Acompanhe a animação cronológica dos talhões colhidos, em colheita hoje e pendentes na safra.' 
                : 'Visão estatística detalhada, distribuição mensal e curva de colheita da safra 26/27.'}
            </p>
          </div>
        </div>

        {/* Controles do Header: Alternar Abas, Gavetas e Maximizar */}
        <div className="flex items-center space-x-2">
          {activeTab === 'map' && (
            <>
              {/* Botão Gaveta de Filtro de Pastas KML */}
              <button
                type="button"
                onClick={() => setIsTreeOpen(prev => !prev)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  isTreeOpen 
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-xs' 
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                title="Abrir/Fechar filtro de pastas de fazendas"
              >
                <FolderTree className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden md:inline">Filtro de Pastas</span>
              </button>

              {/* Botão Gaveta de Talhões de Hoje */}
              <button
                type="button"
                onClick={() => setShowDailyDrawer(prev => !prev)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer relative ${
                  showDailyDrawer 
                    ? 'bg-amber-50 text-amber-900 border-amber-300 shadow-xs' 
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                title="Ver lista de talhões colhidos na data selecionada"
              >
                <Flame className="w-3.5 h-3.5 text-red-500" />
                <span className="hidden md:inline">Talhões do Dia</span>
                {currentSimDay && currentSimDay.day_lots_count > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-red-600 text-white animate-pulse">
                    {currentSimDay.day_lots_count}
                  </span>
                )}
              </button>
            </>
          )}

          {/* Seletor de Abas (Mapa vs Analytics) */}
          <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-xl border border-gray-200">
            <button
              type="button"
              onClick={() => setActiveTab('map')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'map'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Mapa Animado</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'analytics'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Curva de Safra</span>
            </button>
          </div>

          {/* Botão de Maximizar / Tela Cheia (com suporte a ESC) */}
          <button
            type="button"
            onClick={handleToggleFullscreen}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer shadow-xs ${
              isFullscreen
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-400 ring-2 ring-amber-300'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500'
            }`}
            title={isFullscreen ? 'Sair da tela cheia (Pressione ESC)' : 'Maximizar mapa em tela cheia'}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Restaurar</span>
                <span className="text-[10px] bg-slate-950/20 px-1 py-0.2 rounded font-mono">ESC</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Maximizar</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Conteúdo Principal */}
      {activeTab === 'map' ? (
        <div className="flex-1 w-full h-full min-h-0 bg-slate-900 rounded-2xl shadow-xl overflow-hidden border border-gray-200 relative flex">
          
          {/* Gaveta Lateral de Pastas KML */}
          <div 
            className={`h-full border-r border-gray-200 bg-white transition-all duration-300 flex flex-col z-10 shrink-0 ${
              isTreeOpen ? 'w-72 sm:w-80' : 'w-0 overflow-hidden border-none'
            }`}
          >
            {isTreeOpen && (
              <div className="h-full w-full flex flex-col min-h-0">
                <div className="p-3 bg-emerald-950 text-white flex items-center justify-between shrink-0">
                  <div className="flex items-center space-x-2">
                    <FolderTree className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-xs tracking-wide">Filtro de Fazendas</span>
                  </div>
                  <button
                    onClick={() => setIsTreeOpen(false)}
                    className="p-1 hover:bg-white/10 rounded-md text-emerald-300 hover:text-white cursor-pointer"
                    title="Fechar painel"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 min-h-0">
                  <KmlFolderTreeFilter
                    tree={treeData}
                    selectedPaths={selectedPaths}
                    onPathsChange={setSelectedPaths}
                    isLoading={isLoadingLots}
                    totalFilteredLots={internalLots.length}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Botão de Reabrir Árvore KML quando fechada */}
          {!isTreeOpen && (
            <button
              onClick={() => setIsTreeOpen(true)}
              className="absolute top-4 left-4 z-20 bg-emerald-950 text-white p-2.5 rounded-xl shadow-lg hover:bg-emerald-900 border border-emerald-700 transition-all flex items-center space-x-1.5 text-xs font-semibold cursor-pointer"
              title="Abrir Filtro de Pastas"
            >
              <FolderTree className="w-4 h-4 text-emerald-400" />
              <span>Pastas</span>
              <ChevronRight className="w-3.5 h-3.5 text-emerald-400" />
            </button>
          )}

          {/* Container do Mapa Leaflet Full Canvas */}
          <div className="flex-1 w-full h-full min-h-0 relative bg-slate-900">
            <div 
              ref={mapContainerRef} 
              className="w-full h-full min-h-0" 
              style={{ width: '100%', height: '100%', minHeight: '100%' }}
            />

            {/* Overlay de Carregamento da Projeção */}
            {isLoadingProjection && (
              <div className="absolute inset-0 z-30 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white/95 p-5 rounded-2xl shadow-xl flex items-center space-x-3 border border-gray-200">
                  <div className="animate-spin rounded-full h-6 w-6 border-3 border-emerald-600 border-t-transparent" />
                  <span className="text-xs font-bold text-gray-800">Carregando cronograma da safra 2026/2027...</span>
                </div>
              </div>
            )}

            {/* Top HUD Flutuante com Métricas ao Vivo da Simulação (Glassmorphism) */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 max-w-4xl w-[94%] pointer-events-auto">
              <div className="bg-slate-900/85 backdrop-blur-md text-white px-3 sm:px-5 py-2.5 rounded-2xl shadow-2xl border border-slate-700/80 flex flex-wrap items-center justify-between gap-3">
                {/* Data e Dia da Semana */}
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-emerald-500/20 border border-emerald-400/40 rounded-xl flex items-center justify-center text-emerald-400 shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs sm:text-sm font-black text-emerald-300 uppercase tracking-wider font-mono">
                        {currentSimDay?.formatted_date || '08/09/2026'}
                      </span>
                      <span className="text-[10px] px-2 py-0.2 rounded-md bg-slate-800 text-slate-300 font-semibold border border-slate-700">
                        {currentSimDay?.day_of_week || 'Safra 2026/2027'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Dia {currentDateIndex + 1} de {Math.max(1, dates.length)} da safra
                    </p>
                  </div>
                </div>

                {/* Progresso da Safra (% Concluída) */}
                <div className="flex-1 min-w-[160px] max-w-xs hidden sm:block">
                  <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
                    <span className="text-slate-300 flex items-center space-x-1">
                      <TrendingUp className="w-3 h-3 text-amber-400" />
                      <span>Progresso da Safra:</span>
                    </span>
                    <strong className="text-emerald-400 font-mono text-xs">
                      {currentSimDay?.pct_completed?.toFixed(1) || '0.0'}%
                    </strong>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-700">
                    <div 
                      className="bg-gradient-to-r from-amber-500 via-emerald-500 to-green-400 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, currentSimDay?.pct_completed || 0))}%` }}
                    />
                  </div>
                </div>

                {/* Métricas Acumuladas */}
                <div className="flex items-center space-x-3 text-xs">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block uppercase">Toneladas Acumuladas</span>
                    <strong className="text-amber-300 font-mono font-bold text-xs sm:text-sm">
                      {formatNumberBR(currentSimDay?.accumulated_tons || 0)} Ton
                    </strong>
                  </div>
                  <div className="h-7 w-[1px] bg-slate-700 hidden sm:block" />
                  <div className="text-right hidden md:block">
                    <span className="text-[10px] text-slate-400 block uppercase">Talhões Colhidos</span>
                    <strong className="text-emerald-300 font-mono font-bold text-xs sm:text-sm">
                      {currentSimDay?.accumulated_lots || 0} / {summary?.unique_lots || 1520}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Player Flutuante da Linha do Tempo (Rodapé do Mapa) */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 max-w-5xl w-[96%] pointer-events-auto">
              <div className="bg-slate-900/90 backdrop-blur-md text-white p-3 sm:p-4 rounded-2xl shadow-2xl border border-slate-700/80 flex flex-col gap-2.5">
                
                {/* Linha 1: Atalhos Rápidos de Meses da Safra */}
                <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar pb-1 border-b border-slate-800/80">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 mr-1 hidden sm:inline">
                    Meses da Safra:
                  </span>
                  <div className="flex items-center space-x-1">
                    {[
                      { code: '2026-09', label: 'Set/26' },
                      { code: '2026-10', label: 'Out/26' },
                      { code: '2026-11', label: 'Nov/26' },
                      { code: '2026-12', label: 'Dez/26' },
                      { code: '2027-01', label: 'Jan/27' },
                      { code: '2027-02', label: 'Fev/27' },
                      { code: '2027-03', label: 'Mar/27' },
                      { code: '2027-04', label: 'Abr/27' }
                    ].map(m => {
                      const isCurrentMonth = currentSimDate.startsWith(m.code);
                      return (
                        <button
                          key={m.code}
                          type="button"
                          onClick={() => handleJumpToMonth(m.code)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            isCurrentMonth
                              ? 'bg-emerald-500 text-slate-950 shadow-md ring-2 ring-emerald-400/50'
                              : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                          }`}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Ritmo do Dia Atual */}
                  <div className="text-[11px] text-amber-300 font-semibold shrink-0 ml-auto flex items-center space-x-1.5">
                    <span className="hidden md:inline text-slate-400">Ritmo Hoje:</span>
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/30 text-amber-300 font-mono">
                      +{currentSimDay?.day_lots_count || 0} lotes ({formatNumberBR(currentSimDay?.day_tons || 0)} Ton)
                    </span>
                  </div>
                </div>

                {/* Linha 2: Barra Scrubber da Linha do Tempo */}
                <div className="w-full flex items-center space-x-3">
                  <span className="text-[10px] font-mono text-slate-400 shrink-0">
                    08/09/26
                  </span>
                  <div className="flex-1 relative flex items-center">
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0, dates.length - 1)}
                      value={currentDateIndex}
                      onChange={handleSliderChange}
                      className="timeline-slider w-full"
                    />
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0">
                    21/04/27
                  </span>
                </div>

                {/* Linha 3: Legenda Integrada à Esquerda + Controles do Player à Direita */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
                  
                  {/* Legenda Visual dos Talhões & Raios (Posicionada à Esquerda) */}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 bg-slate-950/70 px-3 py-1.5 rounded-xl border border-slate-800 text-[11px] shadow-inner">
                    <div className="flex items-center space-x-1.5" title="Talhões colhidos em datas anteriores">
                      <span className="w-3 h-3 rounded-sm bg-amber-500 border border-amber-300 shrink-0" />
                      <span className="text-slate-300 font-medium">Colhido</span>
                    </div>
                    <div className="flex items-center space-x-1.5" title="Talhões sendo colhidos no dia da simulação">
                      <span className="w-3 h-3 rounded-sm bg-red-500 border border-yellow-300 animate-pulse shrink-0" />
                      <span className="text-amber-300 font-bold">Colhendo HOJE</span>
                    </div>
                    <div className="flex items-center space-x-1.5" title="Talhões programados para colher no futuro">
                      <span className="w-3 h-3 rounded-sm bg-emerald-500 border border-emerald-300 shrink-0" />
                      <span className="text-slate-300 font-medium">A Colher</span>
                    </div>
                    <div className="flex items-center space-x-1.5 hidden lg:flex" title="Talhões sem projeção">
                      <span className="w-3 h-3 rounded-sm bg-slate-500 opacity-40 border border-slate-400 shrink-0" />
                      <span className="text-slate-400 text-[10px]">Sem Proj.</span>
                    </div>
                    <div className="flex items-center space-x-1.5 border-l border-slate-700/80 pl-2 hidden md:flex" title="Raios de 1km a 40km a partir da Usina Porto Rico">
                      <span className="text-xs">🏭</span>
                      <span className="text-amber-400 font-mono text-[10px] font-semibold">Raios 1-40km</span>
                    </div>
                  </div>

                  {/* Controles de Playback (Navegação, Velocidade, Loop) */}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 ml-auto">
                    {/* Botões de Navegação Temporal */}
                    <div className="flex items-center space-x-1 sm:space-x-1.5">
                      <button
                        type="button"
                        onClick={handleJumpToStart}
                        className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                        title="Ir para o início (08/09/2026)"
                      >
                        <SkipBack className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStepPrev(7)}
                        className="px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all text-xs font-semibold cursor-pointer hidden sm:flex items-center space-x-1"
                        title="Voltar 7 dias"
                      >
                        <Rewind className="w-3.5 h-3.5" />
                        <span>-7d</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStepPrev(1)}
                        className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                        title="Voltar 1 dia"
                      >
                        <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>

                      {/* Botão Play / Pause Principal */}
                      <button
                        type="button"
                        onClick={handlePlayPause}
                        className={`px-4 sm:px-5 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center space-x-2 transition-all shadow-lg cursor-pointer ${
                          isPlaying
                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 ring-2 ring-amber-300/60 animate-pulse'
                            : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 ring-2 ring-emerald-300/60'
                        }`}
                      >
                        {isPlaying ? (
                          <>
                            <Pause className="w-4 h-4 fill-current" />
                            <span>Pausar</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 fill-current" />
                            <span>{currentDateIndex >= dates.length - 1 ? 'Reiniciar' : 'Animar Safra'}</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStepNext(1)}
                        className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                        title="Avançar 1 dia"
                      >
                        <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStepNext(7)}
                        className="px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all text-xs font-semibold cursor-pointer hidden sm:flex items-center space-x-1"
                        title="Avançar 7 dias"
                      >
                        <span>+7d</span>
                        <FastForward className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={handleJumpToEnd}
                        className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                        title="Ir para o final (21/04/2027)"
                      >
                        <SkipForward className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                    </div>

                    {/* Velocidade de Reprodução */}
                    <div className="flex items-center space-x-1">
                      <span className="text-[10px] text-slate-400 mr-1 hidden md:inline">Velocidade:</span>
                      {[0.5, 1, 2, 5, 10].map(speed => (
                        <button
                          key={speed}
                          type="button"
                          onClick={() => setPlaybackSpeed(speed)}
                          className={`px-2 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
                            playbackSpeed === speed
                              ? 'bg-emerald-500 text-slate-950 shadow-xs'
                              : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                          }`}
                        >
                          {speed}x
                        </button>
                      ))}

                      {/* Botão de Repetir em Loop */}
                      <button
                        type="button"
                        onClick={() => setIsLooping(prev => !prev)}
                        className={`p-1.5 sm:p-2 rounded-lg ml-1 transition-all cursor-pointer ${
                          isLooping
                            ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/40'
                            : 'bg-slate-800 text-slate-500 hover:text-slate-300'
                        }`}
                        title={isLooping ? 'Repetição em loop ativada' : 'Repetição em loop desativada'}
                      >
                        <Repeat className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                </div>

              </div>
            </div>

            {/* 4. Gaveta Lateral Direita: Talhões Colhidos Hoje */}
            {showDailyDrawer && (
              <div className="absolute top-16 right-4 bottom-24 z-30 w-80 sm:w-96 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
                <div className="p-3.5 bg-gradient-to-r from-red-600 to-amber-600 text-white flex items-center justify-between shrink-0">
                  <div className="flex items-center space-x-2">
                    <Flame className="w-5 h-5 text-yellow-300 animate-pulse" />
                    <div>
                      <h3 className="font-bold text-xs uppercase tracking-wide">
                        Talhões Sendo Colhidos Hoje
                      </h3>
                      <p className="text-[11px] text-red-100 font-mono">
                        {currentSimDay?.formatted_date} ({todayLotsList.length} talhões)
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowDailyDrawer(false)}
                    className="p-1 hover:bg-white/20 rounded-lg text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Campo de Busca nos Talhões de Hoje */}
                <div className="p-2.5 bg-gray-50 border-b border-gray-200 shrink-0">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar por fazenda, talhão ou corte..."
                      value={dailySearchTerm}
                      onChange={e => setDailySearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                </div>

                {/* Lista de Talhões de Hoje */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
                  {todayLotsList.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-xs">
                      Nenhum talhão programado para esta data ou filtro.
                    </div>
                  ) : (
                    todayLotsList.map((lot, idx) => (
                      <div
                        key={`${lot.fazenda}_${lot.talhao}_${idx}`}
                        onClick={() => handleFlyToLot(lot.fazenda, lot.talhao)}
                        className="p-2.5 bg-white hover:bg-red-50/60 rounded-xl border border-gray-200 hover:border-red-300 transition-all cursor-pointer shadow-xs group"
                      >
                        <div className="flex items-center justify-between">
                          <strong className="text-xs font-bold text-gray-900 group-hover:text-red-700">
                            Fazenda {lot.fazenda} &bull; Talhão {lot.talhao}
                          </strong>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            lot.corte === 'MEC' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            Corte {lot.corte}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1 text-[11px] text-gray-600">
                          <span>Volume estimado:</span>
                          <strong className="text-emerald-700 font-mono font-bold">
                            {formatTons(lot.toneladas)}
                          </strong>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Rodapé da Gaveta */}
                <div className="p-2.5 bg-gray-50 border-t border-gray-200 text-xs flex items-center justify-between font-semibold shrink-0">
                  <span className="text-gray-600">Total do Dia:</span>
                  <strong className="text-red-700 font-mono">
                    {formatTons(currentSimDay?.day_tons || 0)}
                  </strong>
                </div>
              </div>
            )}

          </div>

        </div>
      ) : (
        /* 5. Aba do Painel Analítico / Curva de Safra */
        <div className="flex-1 w-full h-full min-h-0 bg-white rounded-2xl shadow-xl overflow-y-auto p-4 sm:p-6 border border-gray-200 space-y-6">
          
          {/* Top Cards de Resumo da Safra */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-md">
              <span className="text-xs font-semibold text-emerald-100 uppercase tracking-wider block">
                Volume Total Projetado
              </span>
              <strong className="text-2xl font-black font-mono mt-1 block">
                {formatNumberBR(summary?.total_tons || 0, 2)} Ton
              </strong>
              <p className="text-xs text-emerald-100 mt-1">
                Safra 2026/2027 completa
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md">
              <span className="text-xs font-semibold text-amber-100 uppercase tracking-wider block">
                Total de Talhões Planejados
              </span>
              <strong className="text-2xl font-black font-mono mt-1 block">
                {summary?.unique_lots || 1520} Talhões
              </strong>
              <p className="text-xs text-amber-100 mt-1">
                {summary?.total_records || 2057} registros de corte
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md">
              <span className="text-xs font-semibold text-blue-100 uppercase tracking-wider block">
                Período da Safra
              </span>
              <strong className="text-lg font-black font-mono mt-1 block">
                08/09/2026 a 21/04/2027
              </strong>
              <p className="text-xs text-blue-100 mt-1">
                {summary?.total_dates || 212} dias de colheita
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-600 to-slate-800 text-white shadow-md">
              <span className="text-xs font-semibold text-purple-100 uppercase tracking-wider block">
                Ritmo Médio Previsto
              </span>
              <strong className="text-2xl font-black font-mono mt-1 block">
                ~{formatNumberBR((summary?.total_tons || 0) / (summary?.total_dates || 212), 0)} Ton/dia
              </strong>
              <p className="text-xs text-purple-100 mt-1">
                ~{Math.round((summary?.unique_lots || 1520) / (summary?.total_dates || 212))} talhões/dia
              </p>
            </div>
          </div>

          {/* =====================================================================
              NOVA SEÇÃO: GRÁFICO DE TONELADAS MÊS A MÊS + CARDS DE TIPO DE CORTE
             ===================================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            {/* 1. Gráfico Interativo de Barras: Toneladas Mês a Mês (Col 7) */}
            <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800 shadow-xs">
                    <BarChart3 className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm sm:text-base leading-tight">
                      Volume Projetado Mês a Mês (Toneladas)
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      Curva de distribuição volumétrica ao longo da safra 2026/2027
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 font-mono">
                    Total: {formatNumberBR(summary?.total_tons || 0, 0)} Ton
                  </span>
                </div>
              </div>

              {/* Área do Gráfico de Barras com Escala Y e Tooltips Interativos */}
              <div className="relative pt-6 pb-2 px-2">
                {/* Linhas de Grade de Fundo */}
                <div className="absolute inset-x-2 top-6 bottom-16 flex flex-col justify-between pointer-events-none opacity-40">
                  <div className="border-b border-dashed border-gray-300 w-full flex items-center justify-end pr-1 text-[9px] text-gray-400 font-mono">250k Ton</div>
                  <div className="border-b border-dashed border-gray-300 w-full flex items-center justify-end pr-1 text-[9px] text-gray-400 font-mono">180k Ton</div>
                  <div className="border-b border-dashed border-gray-300 w-full flex items-center justify-end pr-1 text-[9px] text-gray-400 font-mono">100k Ton</div>
                  <div className="border-b border-dashed border-gray-300 w-full flex items-center justify-end pr-1 text-[9px] text-gray-400 font-mono">0 Ton</div>
                </div>

                {/* Colunas do Gráfico */}
                <div className="grid grid-cols-8 gap-2 sm:gap-3 items-end h-56 z-10 relative">
                  {summary?.monthly_stats?.map(m => {
                    const maxTonsScale = 255000;
                    const heightPct = Math.max(8, Math.min(100, (m.total_tons / maxTonsScale) * 100));
                    const isHovered = hoveredMonth === m.month;
                    const sharePct = (((m.total_tons || 0) / (summary?.total_tons || 1)) * 100).toFixed(1);

                    return (
                      <div
                        key={m.month}
                        onMouseEnter={() => setHoveredMonth(m.month)}
                        onMouseLeave={() => setHoveredMonth(null)}
                        className="flex flex-col items-center h-full justify-end group cursor-pointer relative"
                      >
                        {/* Tooltip Flutuante no Hover */}
                        {isHovered && (
                          <div className="absolute -top-16 z-30 bg-slate-900/95 text-white text-[11px] p-2 rounded-xl shadow-2xl border border-slate-700 pointer-events-none whitespace-nowrap animate-in fade-in zoom-in-95 duration-100">
                            <strong className="text-emerald-400 block font-sans">{m.label} / 2026-27</strong>
                            <span className="font-mono text-white block font-bold">{formatNumberBR(m.total_tons, 2)} Ton</span>
                            <span className="text-[10px] text-slate-300 block">{sharePct}% da safra &bull; {m.unique_lots} talhões</span>
                          </div>
                        )}

                        {/* Rótulo de Toneladas no Topo da Barra */}
                        <span className={`text-[10px] sm:text-[11px] font-mono font-black mb-1.5 transition-all text-center leading-none ${
                          isHovered ? 'text-emerald-700 font-bold scale-110' : 'text-gray-700'
                        }`}>
                          {m.total_tons >= 1000 ? `${(m.total_tons / 1000).toFixed(0)}k` : formatNumberBR(m.total_tons, 0)}
                        </span>

                        {/* Barra Animada com Gradiente */}
                        <div className="w-full bg-gray-100 rounded-t-xl h-full flex items-end overflow-hidden">
                          <div
                            style={{ height: `${heightPct}%` }}
                            className={`w-full rounded-t-xl transition-all duration-500 ease-out relative shadow-sm ${
                              isHovered
                                ? 'bg-gradient-to-t from-emerald-600 via-teal-500 to-emerald-400 ring-2 ring-emerald-400'
                                : 'bg-gradient-to-t from-emerald-700 via-emerald-600 to-teal-500 hover:from-emerald-600 hover:to-teal-400'
                            }`}
                          >
                            {/* Reflexo luminoso no topo */}
                            <div className="absolute top-0 inset-x-0 h-1 bg-white/40 rounded-t-xl" />
                          </div>
                        </div>

                        {/* Rótulo do Mês no Eixo X */}
                        <div className="mt-2 text-center">
                          <strong className={`text-[10.5px] sm:text-xs block leading-tight font-extrabold transition-colors ${
                            isHovered ? 'text-emerald-700' : 'text-gray-800'
                          }`}>
                            {m.label}
                          </strong>
                          <span className="text-[9px] text-gray-500 font-semibold hidden sm:block mt-0.5">
                            {sharePct}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rodapé Informativo do Gráfico */}
              <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between text-xs text-gray-600">
                <span className="flex items-center space-x-1 text-[11px]">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Passe o mouse sobre as barras para detalhes completos de cada mês.</span>
                </span>
                <span className="text-[11px] font-semibold text-emerald-800">
                  Pico de colheita: Outubro &bull; {formatNumberBR(summary?.monthly_stats?.find(m => m.month === '2026-10')?.total_tons || 0, 0)} Ton
                </span>
              </div>
            </div>

            {/* 2. Cards dos Tipos de Corte & Produtividade (Col 5) */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              
              {/* Card Corte Mecanizado (MEC) */}
              <div className="bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/50 p-5 rounded-2xl border border-blue-200/90 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                        <Truck className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">Corte Mecanizado (MEC)</h4>
                        <span className="text-[10.5px] text-gray-500">Colhedoras mecanizadas</span>
                      </div>
                    </div>
                    <span className="text-xs font-black bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full border border-blue-300">
                      {(((summary?.cut_summary?.['MEC']?.tons || 0) / (summary?.total_tons || 1)) * 100).toFixed(1)}%
                    </span>
                  </div>

                  <div className="mt-2">
                    <strong className="text-2xl font-black font-mono text-blue-900 block">
                      {formatNumberBR(summary?.cut_summary?.['MEC']?.tons || 0, 2)} Ton
                    </strong>
                    <p className="text-xs text-blue-700 font-medium mt-0.5">
                      {summary?.cut_summary?.['MEC']?.count || 0} cortes mecanizados programados
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="w-full bg-blue-100 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${(((summary?.cut_summary?.['MEC']?.tons || 0) / (summary?.total_tons || 1)) * 100).toFixed(1)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Card Corte Manual (MAN) */}
              <div className="bg-gradient-to-br from-amber-50/80 via-white to-orange-50/50 p-5 rounded-2xl border border-amber-200/90 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center shadow-xs">
                        <Wheat className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">Corte Manual (MAN)</h4>
                        <span className="text-[10.5px] text-gray-500">Turmas de corte manual</span>
                      </div>
                    </div>
                    <span className="text-xs font-black bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full border border-amber-300">
                      {(((summary?.cut_summary?.['MAN']?.tons || 0) / (summary?.total_tons || 1)) * 100).toFixed(1)}%
                    </span>
                  </div>

                  <div className="mt-2">
                    <strong className="text-2xl font-black font-mono text-amber-900 block">
                      {formatNumberBR(summary?.cut_summary?.['MAN']?.tons || 0, 2)} Ton
                    </strong>
                    <p className="text-xs text-amber-700 font-medium mt-0.5">
                      {summary?.cut_summary?.['MAN']?.count || 0} cortes manuais programados
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="w-full bg-amber-100 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-amber-500 to-orange-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${(((summary?.cut_summary?.['MAN']?.tons || 0) / (summary?.total_tons || 1)) * 100).toFixed(1)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Card Matriz de Proporção Comparativa */}
              <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xs border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                    Matriz de Corte Geral
                  </span>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-xs font-bold text-blue-400">
                      {(((summary?.cut_summary?.['MEC']?.tons || 0) / (summary?.total_tons || 1)) * 100).toFixed(0)}% Mecanizado
                    </span>
                    <span className="text-slate-500">&bull;</span>
                    <span className="text-xs font-bold text-amber-400">
                      {(((summary?.cut_summary?.['MAN']?.tons || 0) / (summary?.total_tons || 1)) * 100).toFixed(0)}% Manual
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Total de Operações</span>
                  <strong className="text-sm font-mono text-emerald-400 font-bold">
                    {formatNumberBR(summary?.total_records || 0, 0)} cortes
                  </strong>
                </div>
              </div>

            </div>

          </div>

          {/* Tabela Resumida da Timeline */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <TableIcon className="w-4 h-4 text-gray-700" />
                <h3 className="font-bold text-gray-900 text-sm">Cronograma Diário de Colheita</h3>
              </div>
              <div className="flex items-center space-x-2">
                <select
                  value={analyticsMonthFilter}
                  onChange={e => setAnalyticsMonthFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="ALL">Todos os Meses</option>
                  <option value="2026-09">Setembro / 2026</option>
                  <option value="2026-10">Outubro / 2026</option>
                  <option value="2026-11">Novembro / 2026</option>
                  <option value="2026-12">Dezembro / 2026</option>
                  <option value="2027-01">Janeiro / 2027</option>
                  <option value="2027-02">Fevereiro / 2027</option>
                  <option value="2027-03">Março / 2027</option>
                  <option value="2027-04">Abril / 2027</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200 uppercase text-[10px] sticky top-0">
                  <tr>
                    <th className="py-2.5 px-4">Data</th>
                    <th className="py-2.5 px-4">Dia da Semana</th>
                    <th className="py-2.5 px-4 text-center">Talhões no Dia</th>
                    <th className="py-2.5 px-4 text-right">Volume no Dia</th>
                    <th className="py-2.5 px-4 text-right">Volume Acumulado</th>
                    <th className="py-2.5 px-4 text-right">% Concluído</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {timeline
                    .filter(d => analyticsMonthFilter === 'ALL' || d.month === analyticsMonthFilter)
                    .map(d => (
                      <tr key={d.date} className="hover:bg-gray-50 transition-colors">
                        <td className="py-2 px-4 font-mono font-bold text-emerald-800">{d.formatted_date}</td>
                        <td className="py-2 px-4 text-gray-600">{d.day_of_week}</td>
                        <td className="py-2 px-4 text-center font-semibold">{d.day_lots_count}</td>
                        <td className="py-2 px-4 text-right font-mono font-bold text-gray-900">{formatTons(d.day_tons)}</td>
                        <td className="py-2 px-4 text-right font-mono text-amber-700 font-semibold">{formatTons(d.accumulated_tons)}</td>
                        <td className="py-2 px-4 text-right font-mono font-bold text-emerald-600">{d.pct_completed.toFixed(1)}%</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* 6. Modal de Detalhes do Talhão Clicado */}
      {selectedLotModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="p-4 bg-gradient-to-r from-emerald-900 to-teal-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <MapPin className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-sm leading-tight">
                    {selectedLotModal.lot?.name || 'Detalhes do Talhão'}
                  </h3>
                  <p className="text-xs text-emerald-200">
                    {selectedLotModal.lot?.farm_name || `Fazenda ${selectedLotModal.fazendaNum}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLotModal({ isOpen: false })}
                className="p-1 hover:bg-white/20 rounded-lg text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {selectedLotModal.projectionDetail ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <span className="text-[10px] uppercase font-bold text-gray-500 block">Data Prevista</span>
                      <strong className="text-sm font-mono text-emerald-800 font-bold block mt-0.5">
                        {selectedLotModal.projectionDetail.primary_date}
                      </strong>
                    </div>

                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <span className="text-[10px] uppercase font-bold text-gray-500 block">Toneladas</span>
                      <strong className="text-sm font-mono text-gray-900 font-bold block mt-0.5">
                        {formatTons(selectedLotModal.projectionDetail.total_toneladas)}
                      </strong>
                    </div>

                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <span className="text-[10px] uppercase font-bold text-gray-500 block">Tipo de Corte</span>
                      <strong className="text-xs font-semibold text-gray-800 block mt-0.5">
                        {selectedLotModal.projectionDetail.cortes.join(', ') || 'N/D'}
                      </strong>
                    </div>

                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <span className="text-[10px] uppercase font-bold text-gray-500 block">Status na Simulação</span>
                      <strong className={`text-xs font-bold block mt-0.5 ${
                        selectedLotModal.projectionDetail.dates.includes(currentSimDate)
                          ? 'text-red-600'
                          : selectedLotModal.projectionDetail.primary_date < currentSimDate
                            ? 'text-amber-600'
                            : 'text-emerald-600'
                      }`}>
                        {selectedLotModal.projectionDetail.dates.includes(currentSimDate)
                          ? '🔥 Sendo Colhido Hoje'
                          : selectedLotModal.projectionDetail.primary_date < currentSimDate
                            ? '✅ Já Colhido'
                            : '⏳ A Colher no Futuro'}
                      </strong>
                    </div>
                  </div>

                  {selectedLotModal.projectionDetail.records.length > 1 && (
                    <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                      <span className="text-xs font-bold text-amber-900 block mb-1">
                        Cortes Múltiplos Programados:
                      </span>
                      <div className="space-y-1">
                        {selectedLotModal.projectionDetail.records.map((r, i) => (
                          <div key={i} className="text-[11px] text-amber-800 flex justify-between">
                            <span>Data: <strong>{r.data}</strong> ({r.corte})</span>
                            <strong className="font-mono">{formatTons(r.toneladas)}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-6 text-gray-500 text-xs">
                  Este talhão não possui registro na projeção da safra 2026/2027.
                </div>
              )}
            </div>

            <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLotModal({ isOpen: false })}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default HarvestTimelineAnimation;
