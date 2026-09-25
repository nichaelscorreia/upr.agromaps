import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Printer, 
  CalendarDays, 
  RotateCw, 
  Trash2, 
  AlertCircle, 
  Flame, 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  Plus, 
  Compass, 
  Map as MapIcon,
  Layers,
  Sprout,
  Users,
  Target,
  Factory
} from 'lucide-react';
import { 
  HarvestPlanningListResponse, 
  HarvestPlanningItem,
  getHarvestPlanningList, 
  deleteHarvestPlanningItem 
} from '../services/api';

interface HarvestPlanningReportProps {
  onOpenMap?: () => void;
  refreshTrigger?: number;
}

// Coordenada base fornecida pelo usuário: Usina Porto Rico
const USINA_BASE = {
  lat: -9.8140414,
  lon: -36.2177396,
  name: 'Usina Porto Rico'
};

// Raios de distância em km: 1km, 5km, 10km, 15km, e de 5 em 5 até 40km
const DISTANCE_RADII_KM = [1, 5, 10, 15, 20, 25, 30, 35, 40];

// Cálculo de distância geodésica em km (Fórmula de Haversine)
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371.0; // Raio médio da Terra em km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Componente para desenhar o polígono KML de um talhão individual em SVG
const LotPolygonCard: React.FC<{ item: HarvestPlanningItem }> = ({ item }) => {
  const coordinates = useMemo(() => {
    if (item.polygons && item.polygons.length > 0 && item.polygons[0].coordinates) {
      return item.polygons[0].coordinates;
    }
    return [];
  }, [item.polygons]);

  const { svgData, distanceKm } = useMemo(() => {
    if (!coordinates || coordinates.length < 3) {
      return { svgData: null, distanceKm: null };
    }

    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;
    let sumLat = 0, sumLon = 0;

    coordinates.forEach(([lat, lon]) => {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      sumLat += lat;
      sumLon += lon;
    });

    const centerLat = (minLat + maxLat) / 2;
    const aspectCorrection = Math.cos((centerLat * Math.PI) / 180);
    const dLon = (maxLon - minLon) * aspectCorrection;
    const dLat = maxLat - minLat;

    const width = 280;
    const height = 150;
    const pad = 22;

    const maxDelta = Math.max(dLon, dLat, 0.0001);
    const scale = Math.min((width - pad * 2) / (dLon || maxDelta), (height - pad * 2) / (dLat || maxDelta));

    const cx = (minLon + maxLon) / 2;
    const cy = (minLat + maxLat) / 2;

    const pointsStr = coordinates
      .map(([lat, lon]) => {
        const x = width / 2 + ((lon - cx) * aspectCorrection) * scale;
        const y = height / 2 - (lat - cy) * scale;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    const avgLat = sumLat / coordinates.length;
    const avgLon = sumLon / coordinates.length;
    const dist = calculateDistanceKm(USINA_BASE.lat, USINA_BASE.lon, avgLat, avgLon);

    return { 
      svgData: { width, height, pointsStr }, 
      distanceKm: dist 
    };
  }, [coordinates]);

  return (
    <div className="border-2 border-black rounded-lg p-2.5 bg-white flex flex-col justify-between break-inside-avoid shadow-2xs">
      {/* Topo do Card */}
      <div className="flex items-center justify-between pb-1 mb-1 border-b border-gray-200">
        <div>
          <span className="text-[10px] uppercase font-bold text-gray-500 block leading-tight">
            {item.nome_fazenda || `Fazenda ${item.codfaz}`}
          </span>
          <span className="text-sm font-black text-black">
            Lote: {item.codlot || item.lot_name}
          </span>
        </div>
        <div className="text-right flex flex-col items-end">
          <span className="text-xs font-black text-emerald-800 bg-emerald-50 border border-emerald-300 px-1.5 py-0.5 rounded">
            {item.area ? item.area.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '0,0'} ha
          </span>
          {distanceKm !== null && (
            <span className="text-[10px] font-bold text-slate-600 mt-0.5">
              {distanceKm.toFixed(1)} km da Usina
            </span>
          )}
        </div>
      </div>

      {/* Desenho do Polígono */}
      <div className="relative w-full h-[130px] bg-slate-50/80 border border-gray-200 rounded flex items-center justify-center overflow-hidden my-1">
        {/* Rosa dos Ventos / Norte */}
        <div className="absolute top-1 right-1.5 flex items-center space-x-0.5 bg-white/90 px-1 py-0.5 rounded border border-gray-200 text-[9px] font-black text-gray-700">
          <Compass className="w-3 h-3 text-red-600" />
          <span>N</span>
        </div>

        {svgData ? (
          <svg 
            viewBox={`0 0 ${svgData.width} ${svgData.height}`} 
            className="w-full h-full p-1"
          >
            <polygon
              points={svgData.pointsStr}
              fill="rgba(16, 185, 129, 0.22)"
              stroke="#065f46"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <div className="text-center text-gray-400 text-xs flex flex-col items-center">
            <MapIcon className="w-5 h-5 text-gray-300 mb-1" />
            <span>KML não mapeado</span>
          </div>
        )}
      </div>

      {/* Rodapé do Card com Dados Técnicos */}
      <div className="flex items-center justify-between text-[11px] font-semibold text-gray-800 pt-1 border-t border-gray-200">
        <div className="flex items-center space-x-1 truncate max-w-[150px]" title={item.variedade}>
          <Sprout className="w-3 h-3 text-green-600 shrink-0" />
          <span className="truncate">{item.variedade || 'Variedade N/D'}</span>
        </div>
        <div className="flex items-center space-x-1 shrink-0 font-bold">
          <Users className="w-3 h-3 text-blue-600 shrink-0" />
          <span>{item.turmas || 1} turma(s)</span>
        </div>
      </div>
    </div>
  );
};

// Componente para mapa consolidado geral de todos os lotes do dia com Raios Concéntricos da Usina
const CombinedOverviewMap: React.FC<{ items: HarvestPlanningItem[] }> = ({ items }) => {
  const itemsWithCoords = useMemo(() => {
    return items.filter(it => it.polygons && it.polygons.length > 0 && it.polygons[0].coordinates?.length >= 3);
  }, [items]);

  const mapData = useMemo(() => {
    if (itemsWithCoords.length === 0) return null;

    // Zoom focado estritamente na região média dos talhões planejados
    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;

    itemsWithCoords.forEach(it => {
      it.polygons![0].coordinates.forEach(([lat, lon]) => {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
      });
    });

    const centerLat = (minLat + maxLat) / 2;
    const aspectCorrection = Math.cos((centerLat * Math.PI) / 180);
    const dLon = (maxLon - minLon) * aspectCorrection;
    const dLat = maxLat - minLat;

    const width = 760;
    const height = 240;
    const pad = 30;

    const maxDelta = Math.max(dLon, dLat, 0.0001);
    const scale = Math.min((width - pad * 2) / (dLon || maxDelta), (height - pad * 2) / (dLat || maxDelta));

    const cx = (minLon + maxLon) / 2;
    const cy = (minLat + maxLat) / 2;

    // Projeção da Usina Porto Rico no sistema de coordenadas
    const usinaX = width / 2 + ((USINA_BASE.lon - cx) * aspectCorrection) * scale;
    const usinaY = height / 2 - (USINA_BASE.lat - cy) * scale;

    // Ângulo radial da Usina em direção ao centro dos lotes
    const angleToCenter = Math.atan2(height / 2 - usinaY, width / 2 - usinaX);

    // Calcular raios concêntricos em pixels a partir da Usina
    const radiusCircles = DISTANCE_RADII_KM.map((rKm, i) => {
      const rDeg = rKm / 111.139; // 1 grau ≈ 111.139 km
      const rPx = rDeg * scale;
      
      // Posicionar o rótulo de distância ao longo do arco visível
      const labelAngle = angleToCenter + (i % 2 === 0 ? 0.15 : -0.15);
      const labelX = usinaX + rPx * Math.cos(labelAngle);
      const labelY = usinaY + rPx * Math.sin(labelAngle);

      const isLabelVisible = labelX >= 20 && labelX <= width - 20 && labelY >= 14 && labelY <= height - 14;

      return {
        rKm,
        rPx,
        labelX,
        labelY,
        isLabelVisible,
        isMajor: rKm % 10 === 0 || rKm === 50
      };
    });

    // Polígonos dos talhões em desenho limpo
    const renderedPolygons = itemsWithCoords.map((it, idx) => {
      const coords = it.polygons![0].coordinates;
      let centerItemX = 0, centerItemY = 0;

      const pointsStr = coords.map(([lat, lon]) => {
        const x = width / 2 + ((lon - cx) * aspectCorrection) * scale;
        const y = height / 2 - (lat - cy) * scale;
        centerItemX += x;
        centerItemY += y;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');

      centerItemX /= coords.length;
      centerItemY /= coords.length;

      return {
        id: it.id,
        lotCode: it.codlot || it.lot_name,
        farmName: it.nome_fazenda || `Faz ${it.codfaz}`,
        pointsStr,
        labelX: centerItemX,
        labelY: centerItemY,
        colorIndex: idx % 4
      };
    });

    return { 
      width, 
      height, 
      usinaX, 
      usinaY, 
      radiusCircles, 
      renderedPolygons 
    };
  }, [itemsWithCoords]);

  if (!mapData) return null;

  const colorPalette = [
    { fill: 'rgba(16, 185, 129, 0.35)', stroke: '#047857' },
    { fill: 'rgba(59, 130, 246, 0.35)', stroke: '#1d4ed8' },
    { fill: 'rgba(245, 158, 11, 0.35)', stroke: '#b45309' },
    { fill: 'rgba(168, 85, 247, 0.35)', stroke: '#7e22ce' }
  ];

  return (
    <div className="border-2 border-black rounded-lg p-3 bg-white mb-6 break-inside-avoid">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 mb-2 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-emerald-700" />
          <span className="text-xs font-black uppercase tracking-wide text-black">
            Visão Geral Consolidada dos Talhões Programados
          </span>
        </div>
        <div className="flex items-center space-x-2 text-[11px] font-bold text-gray-700">
          <div className="flex items-center space-x-1">
            <span className="inline-block w-2.5 h-0.5 bg-slate-500 border-t border-dashed border-slate-500"></span>
            <span>Raios da Usina (1km a 50km)</span>
          </div>
          <span className="text-gray-300">|</span>
          <div className="flex items-center space-x-1 text-gray-600">
            <Compass className="w-3.5 h-3.5 text-red-600" />
            <span>Norte Geográfico</span>
          </div>
        </div>
      </div>

      <div className="relative w-full h-[230px] bg-slate-50 border border-gray-200 rounded overflow-hidden flex items-center justify-center">
        <svg viewBox={`0 0 ${mapData.width} ${mapData.height}`} className="w-full h-full p-2">
          
          {/* 1. Raios Concéntricos de Distância a partir da Usina */}
          <g className="distance-radii">
            {mapData.radiusCircles.map(rc => (
              <g key={`radius-${rc.rKm}`}>
                {/* Arco / Círculo de Raio */}
                <circle
                  cx={mapData.usinaX}
                  cy={mapData.usinaY}
                  r={rc.rPx}
                  fill="none"
                  stroke={rc.isMajor ? '#475569' : '#94a3b8'}
                  strokeWidth={rc.isMajor ? 1.2 : 0.75}
                  strokeDasharray={rc.isMajor ? '6,4' : '3,3'}
                  opacity={0.55}
                />
                
                {/* Rótulo de Distância (ex: 5km, 10km, 15km...) */}
                {rc.isLabelVisible && (
                  <g>
                    <rect
                      x={rc.labelX - 16}
                      y={rc.labelY - 7}
                      width="32"
                      height="14"
                      rx="3"
                      fill="#ffffff"
                      fillOpacity="0.95"
                      stroke={rc.isMajor ? '#334155' : '#94a3b8'}
                      strokeWidth="0.8"
                    />
                    <text
                      x={rc.labelX}
                      y={rc.labelY + 3.5}
                      textAnchor="middle"
                      fontSize="8"
                      fontWeight={rc.isMajor ? '900' : '700'}
                      fill={rc.isMajor ? '#0f172a' : '#475569'}
                      fontFamily="sans-serif"
                    >
                      {rc.rKm} km
                    </text>
                  </g>
                )}
              </g>
            ))}
          </g>

          {/* 2. Polígonos dos Talhões Planejados (Layout Limpo com Alta Definição) */}
          <g className="planned-lots">
            {mapData.renderedPolygons.map(p => {
              const colors = colorPalette[p.colorIndex];
              return (
                <g key={p.id}>
                  {/* Polígono do Talhão */}
                  <polygon
                    points={p.pointsStr}
                    fill={colors.fill}
                    stroke={colors.stroke}
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                  />

                  {/* Rótulo compacto e legível com código do lote */}
                  <rect
                    x={p.labelX - 18}
                    y={p.labelY - 9}
                    width="36"
                    height="16"
                    rx="3"
                    fill="white"
                    fillOpacity="0.92"
                    stroke={colors.stroke}
                    strokeWidth="1"
                  />
                  <text
                    x={p.labelX}
                    y={p.labelY + 3}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="900"
                    fill="#000000"
                  >
                    {p.lotCode}
                  </text>
                </g>
              );
            })}
          </g>

        </svg>
      </div>
    </div>
  );
};

export const HarvestPlanningReport: React.FC<HarvestPlanningReportProps> = ({
  onOpenMap,
  refreshTrigger
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [reportData, setReportData] = useState<HarvestPlanningListResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchReport = useCallback(async (dateToQuery: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await getHarvestPlanningList({ data: dateToQuery });
      if (res.success) {
        setReportData(res);
      } else {
        setErrorMessage(res.error || 'Erro ao carregar dados do relatório.');
      }
    } catch (err: any) {
      console.error('Erro ao buscar lista de planejamento de colheita:', err);
      setErrorMessage(err?.response?.data?.error || err?.message || 'Erro ao conectar com o servidor.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport(selectedDate);
  }, [selectedDate, refreshTrigger, fetchReport]);

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
  };

  const handleShiftDay = (deltaDays: number) => {
    const current = new Date(selectedDate + 'T12:00:00');
    current.setDate(current.getDate() + deltaDays);
    const newDateStr = current.toISOString().split('T')[0];
    setSelectedDate(newDateStr);
  };

  const handleSetToday = () => {
    setSelectedDate(todayStr);
  };

  const handleDeleteItem = async (itemId: string, lotName: string) => {
    if (!window.confirm(`Deseja realmente remover o lote "${lotName}" do planejamento deste dia?`)) {
      return;
    }
    setDeletingId(itemId);
    try {
      const res = await deleteHarvestPlanningItem(itemId);
      if (res.success) {
        fetchReport(selectedDate);
      } else {
        alert(res.error || 'Erro ao excluir item.');
      }
    } catch (err: any) {
      console.error('Erro ao excluir lote:', err);
      alert('Falha ao excluir o lote do planejamento.');
    } finally {
      setDeletingId(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Formatação de data amigável DD/MM/AAAA
  const formattedDateBR = useMemo(() => {
    if (!selectedDate) return '';
    const parts = selectedDate.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return selectedDate;
  }, [selectedDate]);

  // Formatação numérica brasileira rigorosa
  const formatNumber = (val: number, decimals: number = 1) => {
    if (val === undefined || val === null || isNaN(val)) return '0,0';
    return val.toLocaleString('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  const groupedFarms = reportData?.grouped_by_farm ? Object.values(reportData.grouped_by_farm) : [];
  const allItems = reportData?.items || [];
  const hasItems = groupedFarms.length > 0 && reportData && reportData.total_items > 0;

  return (
    <div className="h-full flex flex-col min-h-0 bg-gray-100 overflow-y-auto">
      
      {/* Barra de Ações e Filtros (Oculta na Impressão) */}
      <div className="no-print bg-white border-b border-gray-200 px-4 py-3 shrink-0 shadow-xs">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Seletor de Data e Atalhos */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-1.5 bg-emerald-50 border border-emerald-300 rounded-xl px-3 py-1.5 shadow-2xs">
              <CalendarDays className="w-4 h-4 text-emerald-700 shrink-0" />
              <span className="text-xs font-bold text-emerald-950">Data do Planejamento:</span>
              <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="bg-white border border-emerald-300 text-gray-900 font-bold text-xs rounded-lg px-2 py-1 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => handleShiftDay(-1)}
                title="Dia Anterior"
                className="p-1.5 rounded-lg bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleSetToday}
                className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-white border border-gray-300 hover:bg-emerald-50 hover:text-emerald-800 text-gray-700 transition-colors cursor-pointer"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => handleShiftDay(1)}
                title="Próximo Dia"
                className="p-1.5 rounded-lg bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => fetchReport(selectedDate)}
              disabled={isLoading}
              title="Recarregar dados"
              className="p-1.5 rounded-lg bg-white border border-gray-300 hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer"
            >
              <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>

          {/* Botões de Ação Direita */}
          <div className="flex items-center space-x-2">
            {onOpenMap && (
              <button
                type="button"
                onClick={onOpenMap}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 text-amber-700" />
                <span>Adicionar Talhão no Mapa</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              disabled={!hasItems}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Relatório (PDF)</span>
            </button>
          </div>

        </div>
      </div>

      {/* Container Exclusivo de Impressão */}
      <div className="flex-1 p-3 sm:p-6 flex justify-center items-start">
        
        {/* Folha de Relatório Imprimível */}
        <div 
          id="printable-burn-report"
          className="w-full max-w-4xl bg-white shadow-xl rounded-xl p-6 sm:p-10 border border-gray-300 print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none print:w-full print:rounded-none"
        >
          
          {/* =====================================================================
              PÁGINA 1: RELATÓRIO OFICIAL DE PLANEJAMENTO DE QUEIMA (TABELA)
             ===================================================================== */}
          <div className="min-h-[90vh] flex flex-col justify-between">
            <div>
              {/* Cabeçalho Oficial Usina Porto Rico & Selos */}
              <div className="border-b-2 border-black pb-2 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <img 
                      src="/burn_report_header.png" 
                      alt="Usina Porto Rico - Grupo Olival Tenório" 
                      className="w-full max-h-16 sm:max-h-20 object-contain object-left"
                    />
                  </div>
                </div>
              </div>

              {/* Título Centralizado em Caixa Alta */}
              <div className="text-center my-6">
                <h1 className="text-xl sm:text-2xl font-black text-black tracking-wide uppercase font-sans">
                  PLANEJAMENTO DE QUEIMA EM {formattedDateBR}
                </h1>
              </div>

              {/* Carregando dados */}
              {isLoading && (
                <div className="py-16 text-center text-gray-500 no-print flex flex-col items-center justify-center space-y-3">
                  <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                  <p className="text-sm font-semibold">Carregando planejamento de queima para {formattedDateBR}...</p>
                </div>
              )}

              {/* Mensagem de Erro */}
              {!isLoading && errorMessage && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm flex items-center space-x-2 my-4 no-print">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Estado Vazio */}
              {!isLoading && !errorMessage && !hasItems && (
                <div className="py-16 text-center text-gray-500 my-4 bg-gray-50/70 rounded-2xl border border-dashed border-gray-300 p-8">
                  <Flame className="w-12 h-12 text-orange-400 mx-auto mb-3 opacity-60" />
                  <p className="text-base font-bold text-gray-700">Nenhum talhão planejado para {formattedDateBR}</p>
                  <p className="text-xs text-gray-500 max-w-md mx-auto mt-1 mb-4">
                    Para incluir talhões nesta data, acesse a aba "Mapa de Talhões", selecione os talhões desejados e clique em "Salvar Planejamento".
                  </p>
                  {onOpenMap && (
                    <button
                      type="button"
                      onClick={onOpenMap}
                      className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer no-print"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Ir para o Mapa de Talhões</span>
                    </button>
                  )}
                </div>
              )}

              {/* Tabelas Agrupadas por Fazenda */}
              {!isLoading && hasItems && (
                <div className="space-y-6">
                  {groupedFarms.map((farm) => (
                    <div key={farm.farm_name} className="break-inside-avoid">
                      
                      {/* Nome da Fazenda */}
                      <div className="font-black text-black text-base sm:text-lg mb-2 tracking-tight">
                        FAZENDA: {farm.farm_name.toUpperCase()}
                      </div>

                      {/* Tabela com Larguras Fixas e Alinhamento Rigoroso */}
                      <table className="w-full table-fixed border-collapse text-black text-sm sm:text-base">
                        <thead>
                          <tr className="border-t-2 border-b-2 border-black font-black">
                            <th className="w-[35%] py-1.5 px-2 text-left font-black text-black">LOTE</th>
                            <th className="w-[20%] py-1.5 px-4 text-right font-black text-black">Área</th>
                            <th className="w-[25%] py-1.5 px-4 text-right font-black text-black">Produção</th>
                            <th className="w-[15%] py-1.5 px-2 text-right font-black text-black">Turmas</th>
                            <th className="w-[5%] py-1.5 px-1 text-center font-normal text-gray-400 text-xs no-print print:hidden"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {farm.items.map((item) => (
                            <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50/80 transition-colors">
                              <td className="w-[35%] py-2 px-2 text-left font-medium text-black">
                                {item.codlot || item.lot_name}
                              </td>
                              <td className="w-[20%] py-2 px-4 text-right font-medium text-black font-mono tabular-nums">
                                {formatNumber(item.area, 1)}
                              </td>
                              <td className="w-[25%] py-2 px-4 text-right font-medium text-black font-mono tabular-nums">
                                {formatNumber(item.producao_estimada, 3)}
                              </td>
                              <td className="w-[15%] py-2 px-2 text-right font-medium text-black font-mono tabular-nums">
                                {item.turmas || 2}
                              </td>
                              <td className="w-[5%] py-2 px-1 text-center no-print print:hidden">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteItem(item.id, item.lot_name || String(item.codlot))}
                                  disabled={deletingId === item.id}
                                  title="Remover do Planejamento"
                                  className="text-gray-400 hover:text-red-600 p-1 rounded-md transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}

                          {/* Linha de Subtotal da Fazenda com Alinhamento Exato */}
                          <tr className="border-t border-black font-black text-black">
                            <td className="w-[35%] py-2 px-2 text-left font-black">SUB-TOTAL</td>
                            <td className="w-[20%] py-2 px-4 text-right font-black font-mono tabular-nums">{formatNumber(farm.subtotal_area, 1)}</td>
                            <td className="w-[25%] py-2 px-4 text-right font-black font-mono tabular-nums">{formatNumber(farm.subtotal_producao, 3)}</td>
                            <td className="w-[15%] py-2 px-2 text-right font-black font-mono tabular-nums">{farm.subtotal_turmas}</td>
                            <td className="w-[5%] py-2 px-1 text-center no-print print:hidden"></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ))}

                  {/* Bloco de TOTAL GERAL com Bordas Espessas */}
                  <div className="pt-4 break-inside-avoid">
                    <table className="w-full table-fixed border-collapse text-black text-sm sm:text-base font-black">
                      <tbody>
                        <tr className="border-t-2 border-b-2 border-black font-black">
                          <td className="w-[35%] py-2 px-2 text-left font-black tracking-wide">TOTAL GERAL</td>
                          <td className="w-[20%] py-2 px-4 text-right font-black font-mono tabular-nums">{formatNumber(reportData?.total_area || 0, 1)}</td>
                          <td className="w-[25%] py-2 px-4 text-right font-black font-mono tabular-nums">{formatNumber(reportData?.total_producao || 0, 3)}</td>
                          <td className="w-[15%] py-2 px-2 text-right font-black font-mono tabular-nums">{reportData?.total_turmas || 0}</td>
                          <td className="w-[5%] py-2 px-1 text-center no-print print:hidden"></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* =====================================================================
              PÁGINA 2: CROQUIS E DESENHOS DOS KMLS COM RAIOS DA USINA
             ===================================================================== */}
          {!isLoading && hasItems && (
            <div className="print-page-break mt-12 pt-8 border-t-2 border-dashed border-gray-300 print:border-none print:mt-0 print:pt-0">
              
              {/* Cabeçalho da Página 2 */}
              <div className="border-b-2 border-black pb-2 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <img 
                      src="/burn_report_header.png" 
                      alt="Usina Porto Rico - Grupo Olival Tenório" 
                      className="w-full max-h-14 sm:max-h-16 object-contain object-left"
                    />
                  </div>
                </div>
              </div>

              {/* Título da Página 2 */}
              <div className="text-center my-4">
                <h2 className="text-lg sm:text-xl font-black text-black tracking-wide uppercase font-sans">
                  MAPA & CROQUIS DOS TALHÕES PLANEJADOS EM {formattedDateBR}
                </h2>
                <p className="text-xs text-gray-600 font-semibold mt-0.5">
                  Visualização geográfica com raios concêntricos de 1km a 40km a partir da Usina Porto Rico (-9.8140414, -36.2177396)
                </p>
              </div>

              {/* Mapa Geral Consolidado com Raios Concéntricos */}
              <CombinedOverviewMap items={allItems} />

              {/* Grid dos Croquis Individuais dos Talhões */}
              <div className="mt-4">
                <div className="text-xs font-black uppercase text-black mb-3 tracking-wide flex items-center space-x-1.5">
                  <MapIcon className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Croquis Individuais por Talhão ({allItems.length} talhões)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                  {allItems.map(item => (
                    <LotPolygonCard key={item.id} item={item} />
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default HarvestPlanningReport;
