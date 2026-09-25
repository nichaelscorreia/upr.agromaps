import React, { useState, useEffect } from 'react';
import { 
  CalendarClock, 
  Flame, 
  Sparkles, 
  Info,
  CalendarDays,
  FileText,
  Map as MapIcon,
  Printer
} from 'lucide-react';
import GoogleMapComponent from './GoogleMapComponent';
import HarvestPlanningModal from './HarvestPlanningModal';
import HarvestPlanningReport from './HarvestPlanningReport';
import { getHarvestPlanningList } from '../services/api';

export const HarvestPlanning: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'map' | 'report'>('map');
  const [plannedTodayCount, setPlannedTodayCount] = useState<number>(0);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  const [selectedLotModal, setSelectedLotModal] = useState<{
    isOpen: boolean;
    lotName: string;
    lotPath?: string;
    farmName?: string;
  }>({
    isOpen: false,
    lotName: '',
    lotPath: '',
    farmName: ''
  });

  const todayStr = new Date().toISOString().split('T')[0];

  // Carregar contagem de itens planejados para hoje
  useEffect(() => {
    getHarvestPlanningList({ data: todayStr })
      .then(res => {
        if (res && res.success) {
          setPlannedTodayCount(res.total_items || 0);
        }
      })
      .catch(err => {
        console.warn('Erro ao verificar contagem de planejamentos:', err);
      });
  }, [todayStr, refreshTrigger]);

  const handleLotClick = (lotIdentifier: string) => {
    // Extrair o nome limpo do talhão
    let cleanName = lotIdentifier.replace('\\', '/').split('/').pop() || lotIdentifier;
    if (cleanName.toLowerCase().endsWith('.kml')) {
      cleanName = cleanName.slice(0, -4);
    }

    // Tentar identificar a fazenda a partir do caminho
    const parts = lotIdentifier.replace('\\', '/').split('/');
    let detectedFarm = '';
    if (parts.length >= 2) {
      detectedFarm = parts[parts.length - 2];
    }

    setSelectedLotModal({
      isOpen: true,
      lotName: cleanName,
      lotPath: lotIdentifier,
      farmName: detectedFarm
    });
  };

  const handleCloseModal = () => {
    setSelectedLotModal(prev => ({ ...prev, isOpen: false }));
  };

  const handleSaved = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="h-full w-full flex-1 flex flex-col gap-2 min-h-0 overflow-hidden">
      {/* Header Compacto com Seletor de Abas (Oculto na Impressão) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-2 rounded-xl shadow-xs border border-gray-200 shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center text-white shadow-xs shrink-0">
            <Flame className="w-4.5 h-4.5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm sm:text-base font-bold text-gray-900 leading-tight">
                Planejamento de Queima & Colheita
              </h2>
              <span className="hidden md:inline-flex items-center space-x-1 px-2 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                <span>WebService NSTech</span>
              </span>
            </div>
            <p className="text-[11px] text-gray-500 hidden sm:block">
              {activeTab === 'map' 
                ? 'Clique em qualquer talhão no mapa para simular e salvar a data de queima/colheita.' 
                : 'Visualize, filtre por data e imprima o relatório oficial de queima.'}
            </p>
          </div>
        </div>

        {/* Alternador de Abas */}
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
            <MapIcon className="w-3.5 h-3.5" />
            <span>Mapa de Talhões</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('report')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer relative ${
              activeTab === 'report'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Relatório de Queima</span>
            {plannedTodayCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] font-extrabold bg-emerald-600 text-white rounded-full">
                {plannedTodayCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Conteúdo Principal de Acordo com a Aba Selecionada */}
      {activeTab === 'map' ? (
        <div className="flex-1 w-full h-full min-h-0 bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
          <GoogleMapComponent 
            onLotClick={handleLotClick}
            enableTreeFilter={true}
            initialSelectedPaths={['1 - PROPRIAS']}
          />
        </div>
      ) : (
        <div className="flex-1 w-full h-full min-h-0 bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
          <HarvestPlanningReport 
            onOpenMap={() => setActiveTab('map')}
            refreshTrigger={refreshTrigger}
          />
        </div>
      )}

      {/* Modal Interativo de Planejamento NSTech */}
      {selectedLotModal.isOpen && (
        <HarvestPlanningModal 
          lotName={selectedLotModal.lotName}
          lotPath={selectedLotModal.lotPath}
          farmName={selectedLotModal.farmName}
          isOpen={selectedLotModal.isOpen}
          onClose={handleCloseModal}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};

export default HarvestPlanning;
