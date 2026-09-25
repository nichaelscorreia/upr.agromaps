import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  MapPin, 
  Eye, 
  Globe, 
  TreePine, 
  Users, 
  Tractor, 
  FolderTree, 
  Sparkles,
  ChevronRight,
  Layers,
  Search,
  Maximize2
} from 'lucide-react';
import { KmlTreeNode, getKmlTree } from '../services/api';

interface FarmDashboardProps {
  onSelectFarm: (farmId: string, farmName: string) => void;
  onViewAllFarms: (initialPath?: string) => void;
  onCreateNewFarm: () => void;
}

const FarmDashboard: React.FC<FarmDashboardProps> = ({ onViewAllFarms }) => {
  const [treeData, setTreeData] = useState<KmlTreeNode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadTree();
  }, []);

  const loadTree = async () => {
    try {
      const result = await getKmlTree();
      if (result.success && result.tree) {
        setTreeData(result.tree);
      }
    } catch (error) {
      console.error('Erro ao carregar árvore de KMLs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const categories = treeData?.children || [];
  const totalLots = treeData?.kml_count || 3114;
  const totalAreaHa = treeData?.total_area_ha || 0;

  const getCategoryTheme = (name: string) => {
    const clean = name.toUpperCase();
    if (clean.includes('PROPRIA') || clean.startsWith('1')) {
      return {
        title: '1 - PROPRIAS',
        subtitle: 'Áreas e campos de cultivo próprio',
        gradient: 'from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800',
        badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        areaBadgeBg: 'bg-emerald-50 text-emerald-900 border-emerald-200',
        icon: TreePine,
        accentColor: 'text-emerald-500',
        borderHover: 'hover:border-emerald-500'
      };
    }
    if (clean.includes('ACIONISTA') || clean.startsWith('2')) {
      return {
        title: '2 - ACIONISTAS',
        subtitle: 'Áreas de acionistas e grupos associados',
        gradient: 'from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800',
        badgeBg: 'bg-blue-100 text-blue-800 border-blue-300',
        areaBadgeBg: 'bg-blue-50 text-blue-900 border-blue-200',
        icon: Users,
        accentColor: 'text-blue-500',
        borderHover: 'hover:border-blue-500'
      };
    }
    if (clean.includes('FORNECEDOR') || clean.startsWith('3')) {
      return {
        title: '3 - FORNECEDORES',
        subtitle: 'Fornecedores parceiros e regiões externas',
        gradient: 'from-amber-600 to-orange-700 hover:from-amber-700 hover:to-orange-800',
        badgeBg: 'bg-amber-100 text-amber-800 border-amber-300',
        areaBadgeBg: 'bg-amber-50 text-amber-900 border-amber-200',
        icon: Tractor,
        accentColor: 'text-amber-500',
        borderHover: 'hover:border-amber-500'
      };
    }
    return {
      title: name,
      subtitle: 'Mapeamentos agrícolas',
      gradient: 'from-slate-700 to-gray-800 hover:from-slate-800 hover:to-gray-900',
      badgeBg: 'bg-gray-100 text-gray-800 border-gray-300',
      areaBadgeBg: 'bg-gray-50 text-gray-900 border-gray-200',
      icon: FolderTree,
      accentColor: 'text-gray-500',
      borderHover: 'hover:border-gray-500'
    };
  };

  // Filtrar categorias ou subpastas pela busca rápida
  const filteredCategories = categories.filter(cat => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const matchesCat = cat.name.toLowerCase().includes(term);
    const matchesSub = cat.children?.some(c => c.name.toLowerCase().includes(term) || c.children?.some(sc => sc.name.toLowerCase().includes(term)));
    return matchesCat || matchesSub;
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-3 border-green-600 border-t-transparent mb-4"></div>
        <span className="text-gray-600 font-medium">Carregando estrutura de mapas da pasta kmls/...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Cabeçalho do Painel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <FolderTree className="w-8 h-8 text-green-600" />
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              Estrutura de Pastas KML
            </h2>
          </div>
          <p className="text-sm sm:text-base text-gray-500">
            Navegue pelas categorias e pastas de fazendas integradas diretamente do projeto.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-2 rounded-xl text-sm font-bold flex items-center space-x-2 shadow-2xs">
            <Layers className="w-4 h-4 text-green-600" />
            <span>{totalLots.toLocaleString('pt-BR')} lotes</span>
            <span className="text-green-300">•</span>
            <Maximize2 className="w-3.5 h-3.5 text-green-600" />
            <span>{totalAreaHa.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ha</span>
          </div>
        </div>
      </div>

      {/* Banner Principal - Todos os Mapas */}
      <div 
        onClick={() => onViewAllFarms()}
        className="group relative overflow-hidden bg-gradient-to-r from-emerald-700 via-green-600 to-teal-700 rounded-2xl p-6 sm:p-8 text-white cursor-pointer shadow-xl hover:shadow-2xl hover:scale-[1.01] transition-all duration-300 border border-green-400/30"
      >
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 transform skew-x-12 translate-x-8 pointer-events-none"></div>
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center space-x-5">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-inner border border-white/30 group-hover:rotate-6 transition-transform">
              <Globe className="w-9 h-9 text-yellow-300" />
            </div>
            <div>
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-semibold text-yellow-200 mb-2 border border-white/20">
                <Sparkles className="w-3.5 h-3.5" />
                <span>VISÃO COMPLETA</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Ver Todos os Mapas
              </h3>
              <p className="text-green-100 text-sm sm:text-base mt-1 max-w-xl">
                Exibe todos os {totalLots.toLocaleString('pt-BR')} lotes ({totalAreaHa.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ha) simultaneamente no mapa com navegação em árvore interativa.
              </p>
            </div>
          </div>

          <button className="bg-white text-green-800 font-bold px-6 py-3 rounded-xl hover:bg-green-50 transition-colors shadow-lg flex items-center space-x-2 shrink-0 group-hover:translate-x-1 duration-200 cursor-pointer">
            <Eye className="w-5 h-5" />
            <span>Abrir Mapa Geral</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Barra de Busca de Pastas */}
      <div className="relative max-w-md">
        <Search className="w-5 h-5 absolute left-3.5 top-3 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por categoria ou fazenda..."
          className="w-full pl-11 pr-4 py-2.5 text-sm bg-white rounded-xl border border-gray-200 focus:outline-hidden focus:ring-2 focus:ring-green-500 shadow-sm"
        />
      </div>

      {/* Grid de Categorias Principais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {filteredCategories.map((category) => {
          const theme = getCategoryTheme(category.name);
          const IconComp = theme.icon;
          const subfoldersCount = category.children?.length || 0;
          const catAreaHa = category.total_area_ha || 0;

          return (
            <div
              key={category.path}
              onClick={() => onViewAllFarms(category.path)}
              className={`group bg-white rounded-2xl p-6 shadow-md hover:shadow-xl border border-gray-200 ${theme.borderHover} transition-all duration-300 cursor-pointer flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gray-50 border border-gray-100 group-hover:scale-110 transition-transform`}>
                    <IconComp className={`w-6 h-6 ${theme.accentColor}`} />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${theme.badgeBg}`}>
                      {category.kml_count.toLocaleString('pt-BR')} lotes
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border ${theme.areaBadgeBg}`}>
                      {catAreaHa.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ha
                    </span>
                  </div>
                </div>

                <h3 className="text-xl font-bold text-gray-900 group-hover:text-green-700 transition-colors mb-1">
                  {category.name}
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  {theme.subtitle}
                </p>

                {/* Prévia de subpastas */}
                {category.children && category.children.length > 0 && (
                  <div className="space-y-1.5 pt-3 border-t border-gray-100">
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                      {subfoldersCount} subpasta(s) / grupos:
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-hidden">
                      {category.children.slice(0, 6).map((sub) => (
                        <span 
                          key={sub.path}
                          className="inline-block bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] px-2 py-0.5 rounded-md truncate max-w-[170px]"
                          title={`${sub.name} (${sub.kml_count} lotes - ${sub.total_area_ha ? sub.total_area_ha.toFixed(1) + ' ha' : ''})`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewAllFarms(sub.path);
                          }}
                        >
                          📁 {sub.name} ({sub.kml_count}{sub.total_area_ha ? ` • ${sub.total_area_ha.toFixed(0)}ha` : ''})
                        </span>
                      ))}
                      {subfoldersCount > 6 && (
                        <span className="text-[11px] text-gray-400 py-0.5 px-1 font-medium">
                          +{subfoldersCount - 6} mais...
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-gray-600 group-hover:text-green-700">
                <div className="flex items-center space-x-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Explorar no mapa</span>
                </div>
                <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FarmDashboard;