import React, { useState, useEffect, useCallback } from 'react';
import { Satellite, RefreshCw, TrendingUp, Sparkles, Activity } from 'lucide-react';
import { getAllLots, Lot } from '../services/api';
import GoogleMapComponent from './GoogleMapComponent';

const SatelliteAnalysis: React.FC = () => {
  const [lots, setLots] = useState<Lot[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const lotsData = await getAllLots();
      setLots(lotsData);
    } catch (error) {
      console.error('Erro ao carregar dados para análise satelital:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="h-full w-full flex-1 flex flex-col gap-2 min-h-0 overflow-hidden">
      {/* Header e Indicadores Satelitais Compactos */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-2 rounded-xl shadow-xs border border-gray-200 shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-purple-700 shrink-0">
            <Satellite className="w-4.5 h-4.5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-gray-900 leading-tight">Análise Satelital & NDVI</h2>
            <p className="text-[11px] text-gray-500 hidden sm:block">Monitoramento multiespectral e biomassa via satélite.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-3 bg-purple-50/80 px-2.5 py-1 rounded-lg border border-purple-200 text-xs">
            <div className="flex items-center space-x-1">
              <Sparkles className="w-3 h-3 text-purple-600" />
              <span className="text-purple-700">Lotes:</span>
              <strong className="text-purple-900">{lots.length.toLocaleString('pt-BR')}</strong>
            </div>
            <div className="flex items-center space-x-1">
              <Activity className="w-3 h-3 text-emerald-600" />
              <span className="text-emerald-700">NDVI:</span>
              <strong className="text-emerald-800">0.74 (Ótimo)</strong>
            </div>
            <div className="flex items-center space-x-1">
              <TrendingUp className="w-3 h-3 text-blue-600" />
              <span className="text-blue-700">Crescimento:</span>
              <strong className="text-blue-800">+4.2%</strong>
            </div>
          </div>

          <button
            onClick={loadData}
            disabled={isLoading}
            className="bg-purple-600 text-white px-2.5 py-1 rounded-lg hover:bg-purple-700 transition-colors flex items-center text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Mapa Full Width & Full Height */}
      <div className="flex-1 w-full h-full min-h-0 bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
        <GoogleMapComponent 
          lots={lots}
          enableTreeFilter={true}
          initialSelectedPaths={['1 - PROPRIAS']}
        />
      </div>
    </div>
  );
};

export default SatelliteAnalysis;