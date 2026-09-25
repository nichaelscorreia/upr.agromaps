import React, { useState, useEffect } from 'react';
import { Truck, RefreshCw, MapPin, Clock, Wrench, Activity } from 'lucide-react';
import { getVehicles, getAllLots, Vehicle, Lot } from '../services/api';
import FleetMapComponent from './FleetMapComponent';

const FleetAnalysis: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [showFuelWasteModal, setShowFuelWasteModal] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  useEffect(() => {
    loadVehicles();
    
    // Atualizar a cada 60 segundos
    const interval = setInterval(loadVehicles, 60000);
    
    return () => clearInterval(interval);
  }, []);

  const loadVehicles = async () => {
    try {
      const [vehiclesData, lotsData] = await Promise.all([
        getVehicles(),
        getAllLots()
      ]);
      setVehicles(vehiclesData);
      setLots(lotsData);
      setLastUpdate(new Date().toLocaleTimeString('pt-BR'));
    } catch (error) {
      console.error('Erro ao carregar veículos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusText = (status: Vehicle['status']): string => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'inactive': return 'Inativo';
      case 'maintenance': return 'Manutenção';
      default: return 'Desconhecido';
    }
  };

  const getStatusColor = (status: Vehicle['status']): string => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'inactive': return 'text-gray-600 bg-gray-100';
      case 'maintenance': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: Vehicle['status']) => {
    switch (status) {
      case 'active': return <Activity className="w-4 h-4" />;
      case 'inactive': return <Clock className="w-4 h-4" />;
      case 'maintenance': return <Wrench className="w-4 h-4" />;
      default: return <MapPin className="w-4 h-4" />;
    }
  };

  const activeVehicles = vehicles.filter(v => v.status === 'active').length;
  const inactiveVehicles = vehicles.filter(v => v.status === 'inactive').length;
  
  // Métricas de análise de condutores
  const vehiclesMoving = vehicles.filter(v => v.velocidade > 0).length;
  const vehiclesStopped = vehicles.filter(v => v.velocidade === 0).length;
  const vehiclesEngineOn = vehicles.filter(v => v.status_ignicao === 'LIGADA').length;
  const vehiclesEngineOff = vehicles.filter(v => v.status_ignicao === 'DESLIGADA').length;
  
  // Análise crítica: veículos parados com motor ligado (desperdício de combustível)
  const vehiclesWithFuelWaste = vehicles.filter(v => 
    v.velocidade === 0 && v.status_ignicao === 'LIGADA'
  );
  const vehiclesStoppedEngineOn = vehiclesWithFuelWaste.length;

  const handleVehicleClick = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
    setShowFuelWasteModal(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        <span className="ml-3 text-gray-600">Carregando análise de frota...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Truck className="w-7 h-7 text-green-600 mr-3" />
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Análise de Frota</h2>
            <p className="text-gray-600">Dados em tempo real da planilha Google Sheets</p>
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
                Dados direto da planilha Google Sheets
              </div>
            </div>
          </div>
          <button
            onClick={loadVehicles}
            disabled={isLoading}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Estatísticas da Frota */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Truck className="w-8 h-8 text-blue-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Total de Veículos</p>
              <p className="text-2xl font-bold text-gray-900">{vehicles.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Activity className="w-8 h-8 text-green-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Ativos</p>
              <p className="text-2xl font-bold text-green-600">{activeVehicles}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Clock className="w-8 h-8 text-gray-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Inativos</p>
              <p className="text-2xl font-bold text-gray-600">{inactiveVehicles}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
              <span className="text-green-600 font-bold text-lg">🚗</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Em Movimento</p>
              <p className="text-2xl font-bold text-green-600">{vehiclesMoving}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-3">
              <span className="text-red-600 font-bold text-lg">⏸️</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Parados</p>
              <p className="text-2xl font-bold text-red-600">{vehiclesStopped}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
              <span className="text-blue-600 font-bold text-lg">🔑</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Motor Ligado</p>
              <p className="text-2xl font-bold text-blue-600">{vehiclesEngineOn}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mr-3">
              <span className="text-gray-600 font-bold text-lg">🔒</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Motor Desligado</p>
              <p className="text-2xl font-bold text-gray-600">{vehiclesEngineOff}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center mr-3">
              <span className="text-orange-600 font-bold text-lg">⛽</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Desperdício</p>
              <p className="text-2xl font-bold text-orange-600">{vehiclesStoppedEngineOn}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Layout Principal - Mapa Grande + Lista Compacta */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Lista de Veículos - Compacta */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-md font-semibold text-gray-800">Veículos ({vehicles.length})</h3>
              {vehiclesStoppedEngineOn > 0 && (
                <button
                  onClick={() => setShowFuelWasteModal(true)}
                  className="bg-orange-500 text-white px-2 py-1 rounded text-xs hover:bg-orange-600 transition-colors"
                >
                  ⛽ {vehiclesStoppedEngineOn}
                </button>
              )}
            </div>
            
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {vehicles.map((vehicle) => (
                <div
                  key={vehicle.id}
                  className="p-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-gray-800 text-sm">{vehicle.name}</h4>
                    <span className={`px-1 py-0.5 rounded text-xs font-medium flex items-center ${getStatusColor(vehicle.status)}`}>
                      {getStatusIcon(vehicle.status)}
                    </span>
                  </div>
                  
                  <div className="mb-1 text-xs text-gray-600">
                    <div><strong>Placa:</strong> {vehicle.placa}</div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <div>
                      <div className="font-medium">Velocidade</div>
                      <div className={vehicle.velocidade > 0 ? 'text-green-600 font-semibold' : 'text-red-600'}>{vehicle.velocidade} km/h</div>
                    </div>
                    <div>
                      <div className="font-medium">Ignição</div>
                      <div className={`font-semibold ${vehicle.status_ignicao === 'LIGADA' ? 'text-blue-600' : 'text-gray-600'}`}>
                        {vehicle.status_ignicao === 'LIGADA' ? '🔑' : '🔒'}
                      </div>
                    </div>
                  </div>
                  
                  {/* Alertas compactos */}
                  {vehicle.velocidade === 0 && vehicle.status_ignicao === 'LIGADA' && (
                    <div className="mt-1 p-1 bg-orange-50 border border-orange-200 rounded text-xs">
                      <div className="flex items-center text-orange-700">
                        <span className="mr-1">⚠️</span>
                        <span className="font-medium">Desperdício</span>
                      </div>
                    </div>
                  )}
                  
                  {vehicle.velocidade > 0 && vehicle.status_ignicao === 'DESLIGADA' && (
                    <div className="mt-1 p-1 bg-red-50 border border-red-200 rounded text-xs">
                      <div className="flex items-center text-red-700">
                        <span className="mr-1">🚨</span>
                        <span className="font-medium">Anômalo</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-1 text-xs text-gray-500">
                    {new Date(vehicle.last_updated).toLocaleTimeString('pt-BR')}
                  </div>
                </div>
              ))}
              
              {vehicles.length === 0 && (
                <div className="text-center text-gray-500 py-4">
                  <Truck className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                  <p>Nenhum veículo encontrado</p>
                  <p className="text-xs">Verifique a conexão</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mapa da Frota - Destaque Principal */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="p-4 bg-gray-50 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">Localização da Frota</h3>
                <div className="flex items-center space-x-3 text-xs">
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 bg-green-500 rounded"></div>
                    <span className="text-gray-600">Ativo ({activeVehicles})</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 bg-gray-500 rounded"></div>
                    <span className="text-gray-600">Inativo ({inactiveVehicles})</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 bg-orange-500 rounded"></div>
                    <span className="text-gray-600">Desperdício ({vehiclesStoppedEngineOn})</span>
                  </div>
                </div>
              </div>
              <div className="mt-1 text-xs text-blue-600">
                📊 Dados em tempo real da planilha Google Sheets
              </div>
            </div>
            
            <div className="h-[600px]">
              <FleetMapComponent 
                vehicles={vehicles} 
                lots={lots}
                selectedVehicleId={selectedVehicleId}
                onVehicleSelected={() => setSelectedVehicleId(null)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Lista de Veículos com Desperdício */}
      {showFuelWasteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-orange-700 flex items-center">
                <span className="mr-2">⛽</span>
                Veículos com Desperdício de Combustível
              </h3>
              <button 
                onClick={() => setShowFuelWasteModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="text-2xl">×</span>
              </button>
            </div>

            <div className="mb-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
              <p className="text-sm text-orange-700">
                <strong>⚠️ Situação:</strong> Veículos parados com motor ligado desperdiçam combustível.
                Clique em um veículo para localizá-lo no mapa.
              </p>
            </div>

            {vehiclesWithFuelWaste.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-6xl mb-4">🎉</div>
                <h4 className="text-lg font-semibold text-green-700 mb-2">Parabéns!</h4>
                <p className="text-gray-600">Nenhum veículo está desperdiçando combustível no momento.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {vehiclesWithFuelWaste.map((vehicle) => (
                  <div
                    key={vehicle.id}
                    onClick={() => handleVehicleClick(vehicle.id)}
                    className="p-4 border border-orange-200 rounded-lg hover:bg-orange-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <span className="text-orange-500 mr-2">🚗</span>
                          <h4 className="font-semibold text-gray-800">{vehicle.name}</h4>
                          <span className="ml-2 px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                            PARADO + LIGADO
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Placa:</span> {vehicle.placa}
                          </div>
                          <div>
                            <span className="font-medium">IMEI:</span> {vehicle.imei}
                          </div>
                          <div>
                            <span className="font-medium">Velocidade:</span> {vehicle.velocidade} km/h
                          </div>
                          <div>
                            <span className="font-medium">Ignição:</span> 
                            <span className="text-orange-600 font-semibold ml-1">🔑 {vehicle.status_ignicao}</span>
                          </div>
                        </div>
                        
                        <div className="mt-2 text-xs text-gray-500">
                          GPS: {vehicle.data_hora_gps}
                        </div>
                      </div>
                      
                      <div className="ml-4 text-center">
                        <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-2">
                          <span className="text-orange-600">📍</span>
                        </div>
                        <div className="text-xs text-orange-600 font-medium">
                          Localizar
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Total de veículos com problema: <strong className="text-orange-600">{vehiclesWithFuelWaste.length}</strong></span>
                <span>Atualizado: {lastUpdate}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FleetAnalysis;