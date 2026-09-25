import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  Calendar, 
  Flame, 
  Wheat, 
  TrendingUp, 
  Sprout, 
  Clock, 
  History, 
  Maximize2, 
  RotateCw, 
  CheckCircle2, 
  AlertTriangle,
  Building2,
  CalendarDays,
  Sparkles,
  Info,
  Users,
  Save,
  Loader2
} from 'lucide-react';
import { 
  HarvestPlanningLotData, 
  getHarvestPlanningLotData,
  saveHarvestPlanningItem
} from '../services/api';

interface HarvestPlanningModalProps {
  lotName: string;
  lotPath?: string;
  farmName?: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const HarvestPlanningModal: React.FC<HarvestPlanningModalProps> = ({
  lotName,
  lotPath,
  farmName,
  isOpen,
  onClose,
  onSaved
}) => {
  // Data de queima / colheita padrão: hoje em YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [lotData, setLotData] = useState<HarvestPlanningLotData | null>(null);
  const [turmas, setTurmas] = useState<number>(2);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Extrair codfaz e codlot do nome do lote
  const { codfaz, codlot } = React.useMemo(() => {
    let clean = (lotName || '').replace('\\', '/').split('/').pop() || '';
    if (clean.toLowerCase().endsWith('.kml')) clean = clean.slice(0, -4);
    const parts = clean.split('-');
    return {
      codfaz: parts[0] ? parts[0].trim() : '',
      codlot: parts[1] ? parts[1].trim() : ''
    };
  }, [lotName]);

  // Consultar dados do talhão na API NSTech
  const fetchLotPlanningData = useCallback(async (dateToQuery: string) => {
    if (!lotName && (!codfaz || !codlot)) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await getHarvestPlanningLotData({
        codfaz,
        codlot,
        datmov: dateToQuery,
        lot_name: lotName,
        path: lotPath
      });

      if (res.success && res.data) {
        setLotData(res.data);
        if (res.data.turmas && Number(res.data.turmas) > 0) {
          setTurmas(Number(res.data.turmas));
        }
      } else {
        setErrorMessage(res.message || res.error || 'Nenhum dado retornado para este talhão na data informada.');
      }
    } catch (err: any) {
      console.error('Erro ao consultar planejamento de colheita:', err);
      setErrorMessage(err?.response?.data?.message || err?.message || 'Erro ao conectar com a API NSTech.');
    } finally {
      setIsLoading(false);
    }
  }, [codfaz, codlot, lotName, lotPath]);

  useEffect(() => {
    if (isOpen) {
      setSelectedDate(todayStr);
      setSavedSuccess(false);
      fetchLotPlanningData(todayStr);
    }
  }, [isOpen, todayStr, fetchLotPlanningData]);

  if (!isOpen) return null;

  // Ajustes rápidos de data (+ dias)
  const handleAddDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const newDateStr = d.toISOString().split('T')[0];
    setSelectedDate(newDateStr);
    fetchLotPlanningData(newDateStr);
  };

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    fetchLotPlanningData(newDate);
  };

  const handleSavePlanning = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const detectedFarmName = lotData?.nome_fazenda || farmName || `FAZENDA ${codfaz}`;
      const payload = {
        lot_name: lotName,
        codfaz: codfaz,
        codlot: codlot,
        nome_fazenda: detectedFarmName,
        data_planejamento: selectedDate,
        area: lotData?.area || 0,
        producao_estimada: lotData?.producao_estimada || 0,
        tch_previsto: lotData?.tch_previsto || 0,
        turmas: turmas,
        variedade: lotData?.variedade || 'N/D',
        data_plantio: lotData?.data_plantio || 'N/D',
        idade_cana: lotData?.idade_cana || 'N/D',
        data_ultima_colheita: lotData?.data_ultima_colheita || 'N/D',
        numero_corte: lotData?.numero_corte || 'N/A'
      };

      const res = await saveHarvestPlanningItem(payload);
      if (res.success) {
        setSavedSuccess(true);
        if (onSaved) {
          onSaved();
        }
        setTimeout(() => {
          setSavedSuccess(false);
        }, 3500);
      } else {
        setErrorMessage(res.error || res.message || 'Erro ao salvar planejamento.');
      }
    } catch (err: any) {
      console.error('Erro ao salvar planejamento:', err);
      setErrorMessage(err?.response?.data?.error || err?.message || 'Falha ao comunicar com o servidor.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Cabeçalho do Modal */}
        <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-green-900 text-white p-5 sm:p-6 shrink-0 relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-2 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-1">
            <Flame className="w-4 h-4 text-orange-400 animate-pulse" />
            <span>Planejamento de Queima & Colheita</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>Talhão: {lotName}</span>
            </h2>

            {(farmName || lotData?.nome_fazenda) && (
              <div className="flex items-center space-x-1.5 text-xs bg-white/15 px-3 py-1 rounded-full text-emerald-100 font-medium">
                <Building2 className="w-3.5 h-3.5 text-emerald-300" />
                <span>{lotData?.nome_fazenda || farmName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Corpo do Modal */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          
          {/* Seletor de Data de Queima/Colheita e Turmas */}
          <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-4 sm:p-5 shadow-inner space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs sm:text-sm font-bold text-emerald-950 flex items-center space-x-2">
                <CalendarDays className="w-4 h-4 text-emerald-700" />
                <span>Data Prevista para Queima / Colheita:</span>
              </label>

              {/* Botão de Atualizar / Recarregar */}
              <button
                onClick={() => fetchLotPlanningData(selectedDate)}
                disabled={isLoading}
                className="flex items-center space-x-1 text-xs font-semibold text-emerald-800 hover:text-emerald-950 underline cursor-pointer self-start sm:self-auto"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Recarregar API</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full bg-white border border-emerald-300 text-gray-900 font-bold text-sm rounded-xl px-3.5 py-2.5 shadow-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Atalhos Rápidos */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleAddDays(0)}
                  className="px-2.5 py-2 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-2xs"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => handleAddDays(7)}
                  className="px-2.5 py-2 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-2xs"
                >
                  +7d
                </button>
                <button
                  type="button"
                  onClick={() => handleAddDays(15)}
                  className="px-2.5 py-2 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-2xs"
                >
                  +15d
                </button>
                <button
                  type="button"
                  onClick={() => handleAddDays(30)}
                  className="px-2.5 py-2 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-2xs"
                >
                  +30d
                </button>
              </div>
            </div>

            {/* Campo de Turmas */}
            <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between">
              <label className="text-xs font-bold text-emerald-900 flex items-center space-x-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-700" />
                <span>Quantidade de Turmas Alocadas:</span>
              </label>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setTurmas(Math.max(1, turmas - 1))}
                  className="w-7 h-7 rounded-lg bg-white border border-emerald-300 text-emerald-900 font-bold hover:bg-emerald-100 flex items-center justify-center transition-colors cursor-pointer text-sm shadow-2xs"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={turmas}
                  onChange={(e) => setTurmas(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-14 text-center bg-white border border-emerald-300 text-gray-900 font-black text-sm rounded-lg py-1 shadow-2xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setTurmas(turmas + 1)}
                  className="w-7 h-7 rounded-lg bg-white border border-emerald-300 text-emerald-900 font-bold hover:bg-emerald-100 flex items-center justify-center transition-colors cursor-pointer text-sm shadow-2xs"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Estado de Carregamento */}
          {isLoading && (
            <div className="py-10 flex flex-col items-center justify-center space-y-3">
              <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-semibold text-gray-700">
                Consultando dados no WebService NSTech...
              </p>
              <p className="text-xs text-gray-400">
                Fazenda {codfaz} • Talhão {codlot} • Data {selectedDate.split('-').reverse().join('/')}
              </p>
            </div>
          )}

          {/* Mensagem de Erro / Alerta */}
          {!isLoading && errorMessage && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start space-x-3 text-amber-800">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm">
                <p className="font-bold mb-0.5">Aviso da Consulta:</p>
                <p>{errorMessage}</p>
                <p className="text-[11px] text-amber-700 mt-2">
                  Verifique se o código da fazenda ({codfaz}) e do talhão ({codlot}) constam na base NSTech para a data selecionada.
                </p>
              </div>
            </div>
          )}

          {/* Grid de Indicadores Agronômicos da NSTech */}
          {!isLoading && lotData && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Dados Técnicos do Talhão (NSTech)</span>
                </span>
                <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  Data Base: {lotData.data_movimento}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Área */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 p-3.5 rounded-2xl border border-emerald-100 shadow-2xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-emerald-800">Área</span>
                    <Maximize2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-lg sm:text-xl font-black text-gray-900">
                    {lotData.area ? `${lotData.area.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}` : '0,0'}
                    <span className="text-xs font-medium text-gray-500 ml-1">ha</span>
                  </div>
                </div>

                {/* Produção Estimada */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50/50 p-3.5 rounded-2xl border border-green-100 shadow-2xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-green-800">Produção Estimada</span>
                    <Wheat className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="text-lg sm:text-xl font-black text-green-700">
                    {lotData.producao_estimada ? `${lotData.producao_estimada.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 3 })}` : '0'}
                    <span className="text-xs font-medium text-gray-500 ml-1">Ton</span>
                  </div>
                </div>

                {/* TCH Previsto */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50/50 p-3.5 rounded-2xl border border-blue-100 shadow-2xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-blue-800">TCH Previsto</span>
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-lg sm:text-xl font-black text-blue-700">
                    {lotData.tch_previsto ? `${lotData.tch_previsto.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}` : '0'}
                    <span className="text-xs font-medium text-gray-500 ml-1">T/ha</span>
                  </div>
                </div>

                {/* Variedade */}
                <div className="bg-gradient-to-br from-purple-50 to-pink-50/50 p-3.5 rounded-2xl border border-purple-100 shadow-2xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-purple-800">Variedade</span>
                    <Sprout className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="text-base sm:text-lg font-black text-purple-900 truncate" title={lotData.variedade}>
                    {lotData.variedade || 'N/D'}
                  </div>
                </div>
              </div>

              {/* Informações Cronológicas e Estágio */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-200/80">
                <div className="space-y-1">
                  <div className="flex items-center space-x-1.5 text-xs text-gray-500 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Data de Plantio:</span>
                  </div>
                  <div className="text-sm font-bold text-gray-900">
                    {lotData.data_plantio || 'N/D'}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center space-x-1.5 text-xs text-gray-500 font-medium">
                    <History className="w-3.5 h-3.5 text-blue-600" />
                    <span>Última Colheita:</span>
                  </div>
                  <div className="text-sm font-bold text-gray-900">
                    {lotData.data_ultima_colheita || 'N/D'}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center space-x-1.5 text-xs text-gray-500 font-medium">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Idade / Estágio:</span>
                  </div>
                  <div className="text-sm font-bold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-md inline-block">
                    {lotData.idade_cana || 'N/D'} {lotData.numero_corte && lotData.numero_corte !== 'N/A' ? `(${lotData.numero_corte}º corte)` : ''}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Feedback de salvamento com sucesso */}
          {savedSuccess && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-3.5 rounded-xl flex items-center space-x-2.5 text-xs font-bold animate-fade-in shadow-xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p>Planejamento de queima gravado com sucesso para {selectedDate.split('-').reverse().join('/')}!</p>
                <p className="text-[11px] font-normal text-emerald-700 mt-0.5">
                  Você já pode visualizar e imprimir este talhão na aba <strong>Relatório de Queima</strong>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé de Ações */}
        <div className="bg-gray-50 px-5 py-4 border-t border-gray-200 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-gray-500 flex items-center space-x-1">
            <Info className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span className="hidden sm:inline">Dados obtidos em tempo real do WebService NSTech.</span>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-colors cursor-pointer"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={handleSavePlanning}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Salvar Planejamento</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default HarvestPlanningModal;
