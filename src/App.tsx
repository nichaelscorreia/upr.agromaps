import { useState, useCallback, useEffect } from 'react';
import { 
  Map, 
  LogOut, 
  User, 
  LayoutDashboard, 
  Wheat, 
  Satellite, 
  Truck, 
  Fuel, 
  Layers, 
  SlidersHorizontal, 
  CheckSquare,
  CalendarClock,
  PlayCircle
} from 'lucide-react';
import LoginForm from './components/LoginForm';
import FarmForm from './components/FarmForm';
import FarmDashboard from './components/FarmDashboard';
import FarmManager from './components/FarmManager';
import GoogleMapComponent from './components/GoogleMapComponent';
import TrelloBoard from './components/TrelloBoard';
import HarvestMap from './components/HarvestMap';
import HarvestPlanning from './components/HarvestPlanning';
import HarvestTimelineAnimation from './components/HarvestTimelineAnimation';
import ManagementPanel from './components/ManagementPanel';
import SatelliteAnalysis from './components/SatelliteAnalysis';
import FleetAnalysis from './components/FleetAnalysis';
import FuelAnalysis from './components/FuelAnalysis';
import { createFarm, getLotInfo, logout, checkAuth, LotInfo } from './services/api';

type AppView = 'login' | 'form' | 'dashboard' | 'farm-manager' | 'all-farms' | 'harvest' | 'harvest-planning' | 'harvest-timeline' | 'management' | 'satellite-analysis' | 'fleet-analysis' | 'fuel-analysis' | 'trello';

interface UserData {
  id: string;
  name: string;
  email: string;
}

function App() {
  const [currentView, setCurrentView] = useState<AppView>('login');
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [selectedFarmId, setSelectedFarmId] = useState<string>('');
  const [selectedFarmName, setSelectedFarmName] = useState<string>('');
  const [selectedLotInfo, setSelectedLotInfo] = useState<LotInfo | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [initialFilterPaths, setInitialFilterPaths] = useState<string[]>([]);

  // Verificar autenticação ao carregar a página
  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        const authResult = await checkAuth();
        if (authResult.authenticated && authResult.user) {
          setCurrentUser(authResult.user);
          setCurrentView('dashboard');
        }
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuthentication();
  }, []);

  const handleLogin = useCallback((user: UserData) => {
    setCurrentUser(user);
    setCurrentView('dashboard');
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      setCurrentUser(null);
      setCurrentView('login');
      setSelectedFarmId('');
      setSelectedFarmName('');
      setSelectedLotInfo(null);
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  }, []);

  const handleCreateNewFarm = useCallback(() => {
    setCurrentView('form');
  }, []);

  const handleFarmCreated = useCallback(async (_tempId: string, farmName: string, ownerName: string) => {
    setIsCreating(true);
    try {
      await createFarm(farmName, ownerName);
      setCurrentView('dashboard');
    } catch (error) {
      console.error('Erro ao criar fazenda:', error);
    } finally {
      setIsCreating(false);
    }
  }, []);

  const handleSelectFarm = useCallback((farmId: string, farmName: string) => {
    setSelectedFarmId(farmId);
    setSelectedFarmName(farmName);
    setSelectedLotInfo(null);
    setCurrentView('farm-manager');
  }, []);

  const handleViewAllFarms = useCallback((initialPath?: string) => {
    if (initialPath) {
      setInitialFilterPaths([initialPath]);
    } else {
      setInitialFilterPaths(['ALL']);
    }
    setSelectedLotInfo(null);
    setCurrentView('all-farms');
  }, []);

  const handleLotClick = useCallback(async (lotId: string) => {
    setIsLoading(true);
    try {
      const lotInfo = await getLotInfo(lotId);
      if ('error' in lotInfo) {
        setSelectedLotInfo(lotInfo as any);
      } else {
        setSelectedLotInfo(lotInfo);
      }
    } catch (error) {
      console.error('Erro ao buscar informações do lote:', error);
      setSelectedLotInfo({
        error: 'system_error',
        message: 'Erro de conexão ao buscar dados do lote. Tente novamente.'
      } as any);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleBackToDashboard = useCallback(() => {
    setCurrentView('dashboard');
    setSelectedFarmId('');
    setSelectedFarmName('');
    setSelectedLotInfo(null);
  }, []);

  const handleGoToDashboard = useCallback(() => {
    setCurrentView('dashboard');
  }, []);

  // Loading inicial
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-3 border-green-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Carregando AGROMAPS...</p>
        </div>
      </div>
    );
  }

  // Tela de Login
  if (currentView === 'login' || !currentUser) {
    return <LoginForm onLogin={handleLogin} isLoading={isLoading} />;
  }

  const isMapView = ['all-farms', 'harvest', 'harvest-planning', 'harvest-timeline', 'satellite-analysis', 'fleet-analysis', 'fuel-analysis'].includes(currentView);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, action: handleGoToDashboard },
    { id: 'all-farms', label: 'Fazendas', icon: Map, action: () => handleViewAllFarms() },
    { id: 'harvest', label: 'Colheita', icon: Wheat, action: () => setCurrentView('harvest') },
    { id: 'harvest-planning', label: 'Planejamento', icon: CalendarClock, action: () => setCurrentView('harvest-planning') },
    { id: 'harvest-timeline', label: 'Evolução Safra', icon: PlayCircle, action: () => setCurrentView('harvest-timeline') },
    { id: 'satellite-analysis', label: 'Satelital', icon: Satellite, action: () => setCurrentView('satellite-analysis') },
    { id: 'fleet-analysis', label: 'Frota', icon: Truck, action: () => setCurrentView('fleet-analysis') },
    { id: 'fuel-analysis', label: 'Abastecimento', icon: Fuel, action: () => setCurrentView('fuel-analysis') },
    { id: 'management', label: 'Gerencial', icon: SlidersHorizontal, action: () => setCurrentView('management') },
    { id: 'trello', label: 'Tarefas', icon: CheckSquare, action: () => setCurrentView('trello') },
  ];

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-gray-100">
      {/* Header Global Elegante, Fixo e Compacto */}
      <header className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-green-950 text-white shadow-md shrink-0 z-50 border-b border-emerald-800/60">
        <div className="w-full px-3 sm:px-6 py-2 flex items-center justify-between gap-2 sm:gap-4">
          {/* Logomarca e Título */}
          <div 
            className="flex items-center space-x-2.5 shrink-0 cursor-pointer group" 
            onClick={handleGoToDashboard}
            title="Ir para o Dashboard"
          >
            <div className="bg-white p-1 rounded-xl shadow-xs border border-white/80 flex items-center justify-center group-hover:scale-105 transition-transform">
              <img src="/logo.png" alt="Logo NSTECH" className="h-6 sm:h-7.5 w-auto object-contain" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white group-hover:text-green-300 transition-colors">
                  AGROMAPS
                </h1>
                <span className="hidden xl:inline-block bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[9px] font-bold px-1.5 py-0.2 rounded-md uppercase">
                  v2.0
                </span>
              </div>
            </div>
          </div>

          {/* Menu de Navegação Horizontal */}
          {currentView !== 'form' && (
            <nav className="flex items-center space-x-1 overflow-x-auto no-scrollbar py-0.5 px-1 max-w-[65vw] 2xl:max-w-none">
              {navItems.map((item) => {
                const IconComponent = item.icon;
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={item.action}
                    className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer ${
                      isActive 
                        ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400/40' 
                        : 'text-emerald-100/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <IconComponent className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-emerald-300'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          )}

          {/* Usuário e Logout */}
          <div className="flex items-center space-x-2 shrink-0">
            <div className="hidden lg:flex items-center space-x-1.5 bg-emerald-900/60 border border-emerald-700/50 px-2.5 py-1 rounded-xl text-xs text-emerald-200">
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-semibold text-white truncate max-w-[100px]">{currentUser.name}</span>
            </div>
            
            <button
              onClick={handleLogout}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-red-600/20 hover:bg-red-600 text-red-200 hover:text-white border border-red-500/30 transition-all text-xs font-semibold cursor-pointer shrink-0"
              title="Sair da conta"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content com Layout Full Height e Full Width */}
      <main className={`flex-1 w-full min-h-0 ${
        isMapView 
          ? 'h-[calc(100vh-56px)] flex flex-col p-2 sm:p-2.5 overflow-hidden' 
          : 'overflow-y-auto container mx-auto px-4 sm:px-6 py-6'
      }`}>
        {currentView === 'form' && (
          <div className="max-w-md mx-auto my-auto w-full">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-1">Nova Fazenda</h2>
              <p className="text-sm text-gray-500">Adicione uma nova fazenda ao seu sistema</p>
            </div>
            <FarmForm 
              onFarmCreated={handleFarmCreated}
              onCancel={handleBackToDashboard}
              isCreating={isCreating}
            />
          </div>
        )}

        {currentView === 'dashboard' && (
          <FarmDashboard 
            onSelectFarm={handleSelectFarm}
            onViewAllFarms={handleViewAllFarms}
            onCreateNewFarm={handleCreateNewFarm}
          />
        )}

        {currentView === 'all-farms' && (
          <div className="w-full h-full flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 w-full h-full min-h-0 bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
              <GoogleMapComponent 
                onLotClick={handleLotClick}
                selectedLotInfo={selectedLotInfo as any}
                initialSelectedPaths={initialFilterPaths}
                enableTreeFilter={true}
              />
            </div>
          </div>
        )}

        {currentView === 'harvest' && (
          <div className="w-full h-full flex-1 flex flex-col min-h-0 overflow-hidden">
            <HarvestMap />
          </div>
        )}

        {currentView === 'harvest-planning' && (
          <div className="w-full h-full flex-1 flex flex-col min-h-0 overflow-hidden">
            <HarvestPlanning />
          </div>
        )}

        {currentView === 'harvest-timeline' && (
          <div className="w-full h-full flex-1 flex flex-col min-h-0 overflow-hidden">
            <HarvestTimelineAnimation />
          </div>
        )}

        {currentView === 'satellite-analysis' && (
          <div className="w-full h-full flex-1 flex flex-col min-h-0 overflow-hidden">
            <SatelliteAnalysis />
          </div>
        )}

        {currentView === 'fleet-analysis' && (
          <div className="w-full h-full flex-1 flex flex-col min-h-0 overflow-y-auto">
            <FleetAnalysis />
          </div>
        )}

        {currentView === 'fuel-analysis' && (
          <div className="w-full h-full flex-1 flex flex-col min-h-0 overflow-y-auto">
            <FuelAnalysis />
          </div>
        )}

        {currentView === 'management' && (
          <ManagementPanel />
        )}

        {currentView === 'trello' && (
          <TrelloBoard />
        )}
      </main>

      {/* Farm Manager - Full Screen Modal */}
      {currentView === 'farm-manager' && (
        <div className="fixed inset-0 bg-gray-50 z-50">
          <FarmManager 
            farmId={selectedFarmId}
            farmName={selectedFarmName}
            onBack={handleBackToDashboard}
          />
        </div>
      )}
    </div>
  );
}

export default App;