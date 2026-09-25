import React, { useState, useEffect } from 'react';
import { Fuel, RefreshCw, MapPin, AlertTriangle, Gauge, BarChart3 } from 'lucide-react';
import { getFuelData, getAllLots, FuelData, Lot } from '../services/api';
import FuelMapComponent from './FuelMapComponent';

const FuelAnalysis: React.FC = () => {
  const [fuelData, setFuelData] = useState<FuelData[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  useEffect(() => {
    loadFuelData();
    
    // Atualizar a cada 60 segundos
    const interval = setInterval(loadFuelData, 60000);
    
    return () => clearInterval(interval);
  }, []);

  const loadFuelData = async () => {
    try {
      const [fuelDataResponse, lotsData] = await Promise.all([
        getFuelData(),
        getAllLots()
      ]);
      setFuelData(fuelDataResponse);
      setLots(lotsData);
      setLastUpdate(new Date().toLocaleTimeString('pt-BR'));
    } catch (error) {
      console.error('Erro ao carregar dados de abastecimento:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (autonomia: number): string => {
    if (autonomia < 20) return 'text-red-600 bg-red-100';
    if (autonomia < 40) return 'text-orange-600 bg-orange-100';
    return 'text-green-600 bg-green-100';
  };

  const getStatusIcon = (autonomia: number) => {
    if (autonomia < 20) return <AlertTriangle className="w-4 h-4" />;
    if (autonomia < 40) return <Fuel className="w-4 h-4" />;
    return <Gauge className="w-4 h-4" />;
  };

  const getStatusText = (autonomia: number): string => {
    if (autonomia < 20) return 'Crítico';
    if (autonomia < 40) return 'Atenção';
    return 'Normal';
  };

  // Estatísticas
  const totalVehicles = fuelData.length;
  const criticalVehicles = fuelData.filter(v => v.autonomia_percent < 20).length;
  const warningVehicles = fuelData.filter(v => v.autonomia_percent >= 20 && v.autonomia_percent < 40).length;
  const normalVehicles = fuelData.filter(v => v.autonomia_percent >= 40).length;
  const averageAutonomy = fuelData.length > 0 
    ? (fuelData.reduce((sum, v) => sum + v.autonomia_percent, 0) / fuelData.length).toFixed(1)
    : '0.0';

  const handleVehicleClick = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        <span className="ml-3 text-gray-600">Carregando análise de abastecimento...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Fuel className="w-7 h-7 text-green-600 mr-3" />
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Análise de Abastecimento</h2>
            <p className="text-gray-600">Monitoramento de autonomia da frota em tempo real</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-right text-sm">
            <div className="text-gray-600">
              <div className="flex items-center">
                <RefreshCw className="w-4 h-4 mr-1" />
                Última atualização: {lastUpdate}
              </div>
              <div className="text-blue-600 font-medium">
                Aba AUTONOMIA - Google Sheets
              </div>
            </div>
          </div>
          <button
            onClick={loadFuelData}
            disabled={isLoading}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Estatísticas Compactas */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <Fuel className="w-6 h-6 text-blue-600 mr-2" />
            <div>
              <p className="text-xs font-medium text-gray-600">Total</p>
              <p className="text-xl font-bold text-gray-900">{totalVehicles}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <Gauge className="w-6 h-6 text-green-600 mr-2" />
            <div>
              <p className="text-xs font-medium text-gray-600">Normal</p>
              <p className="text-xl font-bold text-green-600">{normalVehicles}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <Fuel className="w-6 h-6 text-orange-600 mr-2" />
            <div>
              <p className="text-xs font-medium text-gray-600">Atenção</p>
              <p className="text-xl font-bold text-orange-600">{warningVehicles}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
          <div className="flex items-center">
            <AlertTriangle className="w-6 h-6 text-red-600 mr-2" />
            <div>
              <p className="text-xs font-medium text-gray-600">Crítico</p>
              <p className="text-xl font-bold text-red-600">{criticalVehicles}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <BarChart3 className="w-6 h-6 text-purple-600 mr-2" />
            <div>
              <p className="text-xs font-medium text-gray-600">Média</p>
              <p className="text-xl font-bold text-purple-600">{averageAutonomy}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <MapPin className="w-6 h-6 text-indigo-600 mr-2" />
            <div>
              <p className="text-xs font-medium text-gray-600">Lotes</p>
              <p className="text-xl font-bold text-indigo-600">{lots.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Layout Principal - Mapa Grande + Lista Compacta */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Lista de Veículos - Compacta */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-md font-semibold text-gray-800">Autonomia ({fuelData.length})</h3>
              {criticalVehicles > 0 && (
                <span className="bg-red-500 text-white px-2 py-1 rounded text-xs font-bold">
                  🚨 {criticalVehicles}
                </span>
              )}
            </div>
            
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {fuelData
                .sort((a, b) => a.autonomia_percent - b.autonomia_percent) // Ordenar por autonomia (críticos primeiro)
                .map((vehicle) => (
                <div
                  key={vehicle.id}
                  onClick={() => handleVehicleClick(vehicle.id)}
                  className="p-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-gray-800 text-sm">{vehicle.name}</h4>
                    <span className={`px-2 py-1 rounded text-xs font-medium flex items-center ${getStatusColor(vehicle.autonomia_percent)}`}>
                      {getStatusIcon(vehicle.autonomia_percent)}
                      <span className="ml-1">{vehicle.autonomia_percent.toFixed(1)}%</span>
                    </span>
                  </div>
                  
                  <div className="mb-2 text-xs text-gray-600">
                    <div><strong>Placa:</strong> {vehicle.placa}</div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <div>
                      <div className="font-medium">Litros</div>
                      <div className="font-semibold">{vehicle.litros_restantes}L</div>
                    </div>
                    <div>
                      <div className="font-medium">KM Rest.</div>
                      <div className="font-semibold">{vehicle.km_restantes}km</div>
                    </div>
                  </div>
                  
                  {/* Barra de autonomia */}
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all ${
                          vehicle.autonomia_percent < 20 ? 'bg-red-500' :
                          vehicle.autonomia_percent < 40 ? 'bg-orange-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${Math.max(vehicle.autonomia_percent, 5)}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  {/* Status */}
                  <div className="mt-1 text-center">
                    <span className={`text-xs font-bold ${
                      vehicle.autonomia_percent < 20 ? 'text-red-600' :
                      vehicle.autonomia_percent < 40 ? 'text-orange-600' :
                      'text-green-600'
                    }`}>
                      {getStatusText(vehicle.autonomia_percent)}
                    </span>
                  </div>
                  
                  <div className="mt-1 text-xs text-gray-500 text-center">
                    {new Date(vehicle.last_updated).toLocaleTimeString('pt-BR')}
                  </div>
                </div>
              ))}
              
              {fuelData.length === 0 && (
                <div className="text-center text-gray-500 py-4">
                  <Fuel className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                  <p>Nenhum dado encontrado</p>
                  <p className="text-xs">Verifique a aba AUTONOMIA</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mapa de Abastecimento - Destaque Principal */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="p-4 bg-gray-50 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">Mapa de Autonomia da Frota</h3>
                <div className="flex items-center space-x-3 text-xs">
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 bg-green-500 rounded"></div>
                    <span className="text-gray-600">Normal ≥40% ({normalVehicles})</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 bg-orange-500 rounded"></div>
                    <span className="text-gray-600">Atenção 20-40% ({warningVehicles})</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 bg-red-500 rounded"></div>
                    <span className="text-gray-600">Crítico &lt;20% ({criticalVehicles})</span>
                  </div>
                </div>
              </div>
              <div className="mt-1 text-xs text-blue-600">
                ⛽ Dados da aba AUTONOMIA - Google Sheets
              </div>
            </div>
            
            <div className="h-[600px]">
              <FuelMapComponent 
                fuelData={fuelData} 
                lots={lots}
                selectedVehicleId={selectedVehicleId}
                onVehicleSelected={() => setSelectedVehicleId(null)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FuelAnalysis;