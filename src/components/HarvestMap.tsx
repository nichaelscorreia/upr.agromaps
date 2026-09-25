import React, { useState, useEffect } from 'react';
import { Wheat, MapPin, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { getAllLots, getHarvestStatus, updateHarvestStatus, Lot, HarvestStatus } from '../services/api';
import GoogleMapComponent from './GoogleMapComponent';

const HarvestMap: React.FC = () => {
  const [lots, setLots] = useState<Lot[]>([]);
  const [harvestStatus, setHarvestStatus] = useState<HarvestStatus>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [lotsData, harvestData] = await Promise.all([
        getAllLots(),
        getHarvestStatus()
      ]);
      
      setLots(lotsData);
      setHarvestStatus(harvestData);
    } catch (error) {
      console.error('Erro ao carregar dados de colheita:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleHarvest = async (lotId: string) => {
    try {
      const currentStatus = harvestStatus[lotId] || false;
      const newStatus = !currentStatus;
      await updateHarvestStatus(lotId, newStatus);
      
      setHarvestStatus(prev => ({
        ...prev,
        [lotId]: newStatus
      }));
    } catch (error) {
      console.error('Erro ao atualizar status de colheita:', error);
    }
  };

  const getHarvestedCount = () => {
    return lots.filter(lot => harvestStatus[lot.id] || harvestStatus[lot.path || '']).length;
  };

  const getPendingCount = () => {
    return Math.max(0, lots.length - getHarvestedCount());
  };

  const getHarvestPercentage = () => {
    if (lots.length === 0) return 0;
    return Math.round((getHarvestedCount() / lots.length) * 100);
  };

  // Criar lotes com informação de colheita para o mapa
  const lotsWithHarvestInfo = lots.map(lot => ({
    ...lot,
    harvested: harvestStatus[lot.id] || harvestStatus[lot.path || ''] || false
  }));

  return (
    <div className="h-full w-full flex-1 flex flex-col gap-2 min-h-0 overflow-hidden">
      {/* Header e Estatísticas Rápidas Compactas */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-2 rounded-xl shadow-xs border border-gray-200 shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center text-green-700 shrink-0">
            <Wheat className="w-4.5 h-4.5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-gray-900 leading-tight">Controle de Colheita</h2>
            <p className="text-[11px] text-gray-500 hidden sm:block">Acompanhe e altere o status de colheita dos lotes na árvore de pastas.</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-3 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-200 text-xs">
            <div className="flex items-center space-x-1">
              <MapPin className="w-3 h-3 text-gray-500" />
              <span className="text-gray-600">Total:</span>
              <strong className="text-gray-900">{lots.length.toLocaleString('pt-BR')}</strong>
            </div>
            <div className="flex items-center space-x-1">
              <CheckCircle className="w-3 h-3 text-green-600" />
              <span className="text-green-700">Colhidos:</span>
              <strong className="text-green-700">{getHarvestedCount().toLocaleString('pt-BR')}</strong>
            </div>
            <div className="flex items-center space-x-1">
              <XCircle className="w-3 h-3 text-amber-600" />
              <span className="text-amber-700">Pendentes:</span>
              <strong className="text-amber-700">{getPendingCount().toLocaleString('pt-BR')}</strong>
            </div>
            <span className="text-[11px] font-bold text-green-800 bg-green-200 px-2 py-0.2 rounded-full font-mono">
              {getHarvestPercentage()}%
            </span>
          </div>

          <button
            onClick={loadData}
            disabled={isLoading}
            className="bg-emerald-600 text-white px-2.5 py-1 rounded-lg hover:bg-emerald-700 transition-colors flex items-center text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer shrink-0"
          >
            <RotateCcw className={`w-3 h-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Mapa Full Width & Full Height */}
      <div className="flex-1 w-full h-full min-h-0 bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
        <GoogleMapComponent 
          lots={lotsWithHarvestInfo}
          onLotClick={handleToggleHarvest}
          harvestMode={true}
          harvestStatus={harvestStatus}
          enableTreeFilter={true}
          initialSelectedPaths={['1 - PROPRIAS']}
        />
      </div>
    </div>
  );
};

export default HarvestMap;