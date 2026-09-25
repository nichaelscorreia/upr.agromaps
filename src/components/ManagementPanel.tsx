import React, { useState, useEffect } from 'react';
import { Settings, Save, Edit, Database, AlertCircle, CheckCircle, X, Filter } from 'lucide-react';
import { getLotsForManagement, updateLotData, getFarms, LotManagementData, LotDataUpdate, LotInfo, Farm } from '../services/api';

const ManagementPanel: React.FC = () => {
  const [lots, setLots] = useState<LotManagementData[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string>('all');
  const [filteredLots, setFilteredLots] = useState<LotManagementData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingLot, setEditingLot] = useState<string | null>(null);
  const [editData, setEditData] = useState<LotDataUpdate>({});
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadLots();
  }, []);

  useEffect(() => {
    // Filtrar lotes baseado na fazenda selecionada
    if (selectedFarmId === 'all') {
      setFilteredLots(lots);
    } else {
      setFilteredLots(lots.filter(lot => lot.farm_name === farms.find(f => f.id === selectedFarmId)?.name));
    }
  }, [lots, selectedFarmId, farms]);
  const loadLots = async () => {
    setIsLoading(true);
    try {
      const [lotsData, farmsData] = await Promise.all([
        getLotsForManagement(),
        getFarms()
      ]);
      setLots(lotsData);
      setFarms(farmsData);
      console.log('Lotes carregados para gerenciamento:', lotsData.length);
    } catch (error) {
      console.error('Erro ao carregar lotes para gerenciamento:', error);
      setMessage({ type: 'error', text: 'Erro ao carregar lotes' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditLot = (lot: LotManagementData) => {
    setEditingLot(lot.id);
    
    if (lot.data) {
      setEditData({
        fazenda: lot.data.fazenda || '',
        talhao: lot.data.talhao || '',
        folha: lot.data.folha || '',
        variedade: lot.data.variedade || '',
        area: lot.data.area || '',
        plantio: lot.data.plantio || '',
        ult_corte: lot.data.ult_corte || '',
        ton_colhidas: lot.data.ton_colhidas || '',
        tch_prev: lot.data.tch_prev || '',
        tch_real: lot.data.tch_real || '',
        percentual: lot.data.percentual || '',
        colhido: lot.data.colhido || false,
        historico_tch: lot.data.historico_tch || {}
      });
    } else {
      // Dados padrão para lotes sem informações
      setEditData({
        fazenda: lot.farm_name,
        talhao: '',
        folha: '',
        variedade: '',
        area: '',
        plantio: '',
        ult_corte: '',
        ton_colhidas: '',
        tch_prev: '',
        tch_real: '',
        percentual: '',
        colhido: false,
        historico_tch: {
          '2020': 0,
          '2021': 0,
          '2022': 0,
          '2023': 0,
          '2024': 0
        }
      });
    }
  };

  const handleSaveLot = async () => {
    if (!editingLot) return;
    
    setIsSaving(true);
    try {
      await updateLotData(editingLot, editData);
      await loadLots(); // Recarregar dados
      setEditingLot(null);
      setEditData({});
      setMessage({ type: 'success', text: 'Dados do lote atualizados com sucesso!' });
      
      // Limpar mensagem após 3 segundos
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Erro ao salvar dados do lote:', error);
      setMessage({ type: 'error', text: 'Erro ao salvar dados do lote' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingLot(null);
    setEditData({});
  };

  const handleInputChange = (field: keyof LotDataUpdate, value: any) => {
    setEditData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleHistoricoChange = (year: string, value: number) => {
    setEditData(prev => ({
      ...prev,
      historico_tch: {
        ...prev.historico_tch,
        [year]: value
      }
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        <span className="ml-3 text-gray-600">Carregando painel gerencial...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Settings className="w-7 h-7 text-green-600 mr-3" />
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Painel Gerencial</h2>
            <p className="text-gray-600">Edite as informações dos lotes diretamente no sistema</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Database className="w-4 h-4" />
          <span>{filteredLots.length} de {lots.length} lote(s)</span>
        </div>
      </div>

      {/* Filtro por Fazenda */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center mb-4">
          <Filter className="w-5 h-5 text-gray-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-800">Filtros</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filtrar por Fazenda
            </label>
            <select
              value={selectedFarmId}
              onChange={(e) => setSelectedFarmId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="all">Todas as Fazendas ({lots.length} lotes)</option>
              {farms.map(farm => {
                const farmLots = lots.filter(lot => lot.farm_name === farm.name);
                return (
                  <option key={farm.id} value={farm.id}>
                    {farm.name} ({farmLots.length} lotes)
                  </option>
                );
              })}
            </select>
          </div>
          
          <div className="flex items-end">
            <div className="text-sm text-gray-600">
              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-600 mr-1" />
                  <span>{filteredLots.filter(lot => lot.has_data).length} com dados</span>
                </div>
                <div className="flex items-center">
                  <AlertCircle className="w-4 h-4 text-orange-600 mr-1" />
                  <span>{filteredLots.filter(lot => !lot.has_data).length} sem dados</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Mensagem de feedback */}
      {message && (
        <div className={`p-4 rounded-md border ${
          message.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center">
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 mr-2" />
            ) : (
              <AlertCircle className="w-5 h-5 mr-2" />
            )}
            {message.text}
          </div>
        </div>
      )}

      {/* Lista de Lotes */}
      <div className="grid grid-cols-1 gap-6">
        {filteredLots.map((lot) => (
          <div key={lot.id} className="bg-white rounded-lg shadow-lg border border-gray-200">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">{lot.name}</h3>
                  <p className="text-sm text-gray-600">{lot.farm_name} • {lot.polygons_count} polígono(s)</p>
                  <div className="flex items-center mt-1">
                    {lot.has_data ? (
                      <div className="flex items-center text-green-600 text-sm">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        <span>Dados disponíveis</span>
                      </div>
                    ) : (
                      <div className="flex items-center text-orange-600 text-sm">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        <span>Sem dados na planilha</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {editingLot === lot.id ? (
                    <>
                      <button
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                        className="px-3 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Cancelar
                      </button>
                      <button
                        onClick={handleSaveLot}
                        disabled={isSaving}
                        className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center"
                      >
                        {isSaving ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
                        ) : (
                          <Save className="w-4 h-4 mr-1" />
                        )}
                        {isSaving ? 'Salvando...' : 'Salvar'}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleEditLot(lot)}
                      className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Editar
                    </button>
                  )}
                </div>
              </div>

              {editingLot === lot.id ? (
                <EditLotForm 
                  editData={editData}
                  onInputChange={handleInputChange}
                  onHistoricoChange={handleHistoricoChange}
                />
              ) : (
                <ViewLotData lot={lot} />
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredLots.length === 0 && selectedFarmId === 'all' && (
        <div className="text-center py-12">
          <Database className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">Nenhum lote encontrado</h3>
          <p className="text-gray-500">Crie fazendas e adicione lotes primeiro</p>
        </div>
      )}
      
      {filteredLots.length === 0 && selectedFarmId !== 'all' && (
        <div className="text-center py-12">
          <Database className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">Nenhum lote nesta fazenda</h3>
          <p className="text-gray-500">Selecione outra fazenda ou adicione lotes à fazenda selecionada</p>
        </div>
      )}
    </div>
  );
};

// Componente para visualizar dados do lote
interface ViewLotDataProps {
  lot: LotManagementData;
}

const ViewLotData: React.FC<ViewLotDataProps> = ({ lot }) => {
  if (!lot.has_data || !lot.data) {
    return (
      <div className="bg-gray-50 p-4 rounded-lg">
        <p className="text-gray-600 text-center">
          Nenhum dado disponível para este lote. Clique em "Editar" para adicionar informações.
        </p>
      </div>
    );
  }

  const data = lot.data;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div className="space-y-3">
        <h4 className="font-medium text-gray-700">Informações Básicas</h4>
        <div className="space-y-2 text-sm">
          <div><span className="font-medium">Fazenda:</span> {data.fazenda}</div>
          <div><span className="font-medium">Talhão:</span> {data.talhao}</div>
          <div><span className="font-medium">Folha:</span> {data.folha}</div>
          <div><span className="font-medium">Variedade:</span> {data.variedade}</div>
          <div><span className="font-medium">Área (ha):</span> {data.area}</div>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="font-medium text-gray-700">Datas e Produção</h4>
        <div className="space-y-2 text-sm">
          <div><span className="font-medium">Plantio:</span> {data.plantio}</div>
          <div><span className="font-medium">Últ. Corte:</span> {data.ult_corte}</div>
          <div><span className="font-medium">Ton. Colhidas:</span> {data.ton_colhidas}</div>
          <div><span className="font-medium">TCH Prev:</span> {data.tch_prev}</div>
          <div><span className="font-medium">TCH Real:</span> {data.tch_real}</div>
          <div><span className="font-medium">Percentual:</span> {data.percentual}%</div>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="font-medium text-gray-700">Histórico TCH</h4>
        <div className="space-y-2 text-sm">
          {Object.entries(data.historico_tch || {}).map(([year, value]) => (
            <div key={year}>
              <span className="font-medium">{year}:</span> {value.toFixed(1)}
            </div>
          ))}
        </div>
        <div className="mt-3">
          <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
            data.status === 'Acima' ? 'bg-green-100 text-green-800' :
            data.status === 'Necessário' ? 'bg-yellow-100 text-yellow-800' :
            data.status === 'Abaixo' ? 'bg-red-100 text-red-800' :
            'bg-orange-100 text-orange-800'
          }`}>
            Status: {data.status}
          </span>
        </div>
      </div>
    </div>
  );
};

// Componente para editar dados do lote
interface EditLotFormProps {
  editData: LotDataUpdate;
  onInputChange: (field: keyof LotDataUpdate, value: any) => void;
  onHistoricoChange: (year: string, value: number) => void;
}

const EditLotForm: React.FC<EditLotFormProps> = ({ editData, onInputChange, onHistoricoChange }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Informações Básicas */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-700">Informações Básicas</h4>
          
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Fazenda</label>
            <input
              type="text"
              value={editData.fazenda || ''}
              onChange={(e) => onInputChange('fazenda', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Talhão</label>
            <input
              type="text"
              value={editData.talhao || ''}
              onChange={(e) => onInputChange('talhao', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Folha</label>
            <input
              type="text"
              value={editData.folha || ''}
              onChange={(e) => onInputChange('folha', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Variedade</label>
            <input
              type="text"
              value={editData.variedade || ''}
              onChange={(e) => onInputChange('variedade', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Área (ha)</label>
            <input
              type="text"
              value={editData.area || ''}
              onChange={(e) => onInputChange('area', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Datas e Produção */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-700">Datas e Produção</h4>
          
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Plantio</label>
            <input
              type="text"
              value={editData.plantio || ''}
              onChange={(e) => onInputChange('plantio', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Último Corte</label>
            <input
              type="text"
              value={editData.ult_corte || ''}
              onChange={(e) => onInputChange('ult_corte', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Toneladas Colhidas</label>
            <input
              type="text"
              value={editData.ton_colhidas || ''}
              onChange={(e) => onInputChange('ton_colhidas', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">TCH Previsto</label>
            <input
              type="text"
              value={editData.tch_prev || ''}
              onChange={(e) => onInputChange('tch_prev', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">TCH Real</label>
            <input
              type="text"
              value={editData.tch_real || ''}
              onChange={(e) => onInputChange('tch_real', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Percentual (%)</label>
            <input
              type="text"
              value={editData.percentual || ''}
              onChange={(e) => onInputChange('percentual', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Histórico e Status */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-700">Histórico TCH</h4>
          
          {['2020', '2021', '2022', '2023', '2024'].map(year => (
            <div key={year}>
              <label className="block text-sm font-medium text-gray-600 mb-1">TCH {year}</label>
              <input
                type="number"
                step="0.1"
                value={editData.historico_tch?.[year] || 0}
                onChange={(e) => onHistoricoChange(year, parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          ))}

          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-600">
              <input
                type="checkbox"
                checked={editData.colhido || false}
                onChange={(e) => onInputChange('colhido', e.target.checked)}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span>Lote colhido</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagementPanel;