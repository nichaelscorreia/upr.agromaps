import React, { useState, useMemo, useCallback } from 'react';
import { 
  Folder, 
  FolderOpen, 
  ChevronRight, 
  ChevronDown, 
  Search, 
  Layers, 
  CheckSquare, 
  Square, 
  MinusSquare,
  RotateCw, 
  X, 
  Sparkles,
  TreePine,
  Users,
  Tractor,
  Eye,
  Check
} from 'lucide-react';
import { KmlTreeNode } from '../services/api';

export interface KmlFolderTreeFilterProps {
  tree: KmlTreeNode | null;
  selectedPaths: string[];
  onPathsChange: (paths: string[]) => void;
  isLoading?: boolean;
  onReload?: () => void;
  totalFilteredLots?: number;
}

// Obter cores e ícones baseados na categoria principal
export const getCategoryMeta = (name: string) => {
  const clean = name.toUpperCase();
  if (clean.includes('PROPRIA') || clean.startsWith('1')) {
    return {
      color: 'text-emerald-800 bg-emerald-50/80 border-emerald-200 hover:bg-emerald-100',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      icon: TreePine,
      iconColor: 'text-emerald-600',
      dotColor: 'bg-emerald-500'
    };
  }
  if (clean.includes('ACIONISTA') || clean.startsWith('2')) {
    return {
      color: 'text-blue-800 bg-blue-50/80 border-blue-200 hover:bg-blue-100',
      badge: 'bg-blue-100 text-blue-800 border-blue-300',
      icon: Users,
      iconColor: 'text-blue-600',
      dotColor: 'bg-blue-500'
    };
  }
  if (clean.includes('FORNECEDOR') || clean.startsWith('3')) {
    return {
      color: 'text-amber-900 bg-amber-50/80 border-amber-200 hover:bg-amber-100',
      badge: 'bg-amber-100 text-amber-800 border-amber-300',
      icon: Tractor,
      iconColor: 'text-amber-600',
      dotColor: 'bg-amber-500'
    };
  }
  return {
    color: 'text-slate-700 bg-slate-50/80 border-slate-200 hover:bg-slate-100',
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: Folder,
    iconColor: 'text-slate-500',
    dotColor: 'bg-slate-400'
  };
};

// Checa se um nó está 100% selecionado
export const isNodeFullySelected = (nodePath: string, selectedPaths: string[]): boolean => {
  if (selectedPaths.includes('ALL')) return true;
  if (selectedPaths.includes(nodePath)) return true;
  return selectedPaths.some(p => p !== '' && p !== 'ALL' && nodePath.startsWith(p + '/'));
};

// Checa se um nó está parcialmente selecionado (indeterminate)
export const isNodePartiallySelected = (node: KmlTreeNode, selectedPaths: string[]): boolean => {
  if (isNodeFullySelected(node.path, selectedPaths)) return false;
  if (!node.children || node.children.length === 0) return false;

  const checkAnyDescendant = (n: KmlTreeNode): boolean => {
    if (selectedPaths.includes(n.path)) return true;
    if (n.children && n.children.length > 0) {
      return n.children.some(c => checkAnyDescendant(c));
    }
    return false;
  };

  return node.children.some(c => isNodeFullySelected(c.path, selectedPaths) || checkAnyDescendant(c));
};

// Calcula a nova lista de caminhos após alternar um nó
export const calculateNewSelectedPaths = (
  targetNode: KmlTreeNode,
  selectedPaths: string[],
  treeRoot: KmlTreeNode | null
): string[] => {
  const isCurrentlySelected = isNodeFullySelected(targetNode.path, selectedPaths);

  // 1. O usuário deseja SELECIONAR (MARCAR) este nó
  if (!isCurrentlySelected) {
    if (selectedPaths.includes('ALL')) return ['ALL'];

    // Remover descendentes pré-existentes deste nó (pois selecionar o nó pai já inclui todos)
    const cleaned = selectedPaths.filter(p => !p.startsWith(targetNode.path + '/') && p !== targetNode.path);
    const next = [...cleaned, targetNode.path];

    // Se todas as categorias raiz estiverem selecionadas, simplificar para 'ALL'
    if (treeRoot && treeRoot.children && treeRoot.children.length > 0) {
      const allRootsSelected = treeRoot.children.every(rootCat => isNodeFullySelected(rootCat.path, next));
      if (allRootsSelected) {
        return ['ALL'];
      }
    }

    return next;
  }

  // 2. O usuário deseja DESMARCAR este nó
  // Caso A: 'ALL' está ativo
  if (selectedPaths.includes('ALL')) {
    if (!treeRoot || !treeRoot.children) return [];
    const next: string[] = [];

    const expandTreeExcluding = (currNode: KmlTreeNode) => {
      if (currNode.path === targetNode.path) {
        return; // Excluir este nó e seus filhos
      }
      if (targetNode.path.startsWith(currNode.path + '/')) {
        // Alvo está dentro desta pasta, descer para os filhos
        currNode.children?.forEach(expandTreeExcluding);
      } else {
        // Ramo não contém o alvo, manter inteiro
        next.push(currNode.path);
      }
    };

    treeRoot.children.forEach(expandTreeExcluding);
    return next;
  }

  // Caso B: Nó está diretamente na lista de selecionados
  if (selectedPaths.includes(targetNode.path)) {
    return selectedPaths.filter(p => p !== targetNode.path && !p.startsWith(targetNode.path + '/'));
  }

  // Caso C: Um ancestral do nó está selecionado (ex: '1 - PROPRIAS' estava marcado e o usuário desmarcou 'CAMPO I')
  if (treeRoot) {
    const next: string[] = [];
    const matchingAncestors = selectedPaths.filter(p => targetNode.path.startsWith(p + '/'));
    const nonAncestors = selectedPaths.filter(p => !targetNode.path.startsWith(p + '/') && p !== targetNode.path);
    next.push(...nonAncestors);

    matchingAncestors.forEach(ancestorPath => {
      const findNodeByPath = (node: KmlTreeNode, path: string): KmlTreeNode | null => {
        if (node.path === path) return node;
        if (node.children) {
          for (const c of node.children) {
            const found = findNodeByPath(c, path);
            if (found) return found;
          }
        }
        return null;
      };

      const ancestorNode = findNodeByPath(treeRoot, ancestorPath);
      if (ancestorNode && ancestorNode.children) {
        const expandExcluding = (curr: KmlTreeNode) => {
          if (curr.path === targetNode.path) {
            return;
          }
          if (targetNode.path.startsWith(curr.path + '/')) {
            curr.children?.forEach(expandExcluding);
          } else {
            next.push(curr.path);
          }
        };
        ancestorNode.children.forEach(expandExcluding);
      }
    });

    return next;
  }

  return selectedPaths.filter(p => p !== targetNode.path);
};

interface TreeNodeItemProps {
  node: KmlTreeNode;
  depth: number;
  selectedPaths: string[];
  onToggleNode: (node: KmlTreeNode) => void;
  searchQuery: string;
  expandedNodes: Set<string>;
  toggleExpandNode: (path: string) => void;
}

const TreeNodeItem: React.FC<TreeNodeItemProps> = ({
  node,
  depth,
  selectedPaths,
  onToggleNode,
  searchQuery,
  expandedNodes,
  toggleExpandNode
}) => {
  const isChecked = isNodeFullySelected(node.path, selectedPaths);
  const isPartiallyChecked = !isChecked && isNodePartiallySelected(node, selectedPaths);

  const isExpanded = expandedNodes.has(node.path) || searchQuery.trim().length > 0;
  const hasChildren = node.children && node.children.length > 0;

  const isTopCategory = depth === 0;
  const meta = getCategoryMeta(node.name);
  const IconComponent = meta.icon;

  // Filtro de busca
  const matchesSearch = useMemo(() => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const selfMatches = node.name.toLowerCase().includes(q) || node.path.toLowerCase().includes(q);
    if (selfMatches) return true;
    
    const checkChildren = (children?: KmlTreeNode[]): boolean => {
      if (!children) return false;
      return children.some(c => c.name.toLowerCase().includes(q) || c.path.toLowerCase().includes(q) || checkChildren(c.children));
    };
    return checkChildren(node.children);
  }, [node, searchQuery]);

  if (!matchesSearch) return null;

  return (
    <div className="select-none">
      <div 
        className={`group flex items-center justify-between py-1 px-2 rounded-lg transition-all duration-150 cursor-pointer text-xs sm:text-sm mb-0.5 border ${
          isChecked 
            ? 'bg-emerald-600 text-white font-semibold border-emerald-700 shadow-xs' 
            : isPartiallyChecked
            ? 'bg-emerald-50 text-emerald-950 border-emerald-300 font-medium'
            : isTopCategory
            ? `${meta.color} font-medium shadow-2xs`
            : 'text-gray-700 border-transparent hover:bg-gray-100 hover:text-gray-900'
        }`}
        style={{ paddingLeft: `${Math.max(6, depth * 16 + 6)}px` }}
        onClick={(e) => {
          e.stopPropagation();
          onToggleNode(node);
        }}
      >
        <div className="flex items-center min-w-0 space-x-1.5 flex-1 mr-2">
          {/* Botão de Expandir/Recolher */}
          {hasChildren ? (
            <button
              type="button"
              className={`p-0.5 rounded hover:bg-black/10 transition-transform cursor-pointer ${isChecked ? 'text-white' : 'text-gray-500'}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleExpandNode(node.path);
              }}
              title={isExpanded ? 'Recolher pasta' : 'Expandir pasta'}
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              )}
            </button>
          ) : (
            <span className="w-3.5 shrink-0" />
          )}

          {/* Checkbox de Seleção */}
          <button
            type="button"
            className="p-0.5 hover:scale-110 transition-transform focus:outline-hidden cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onToggleNode(node);
            }}
            title={isChecked ? 'Desmarcar pasta' : 'Marcar pasta para exibir no mapa'}
          >
            {isChecked ? (
              <CheckSquare className={`w-4 h-4 ${isChecked ? 'text-white' : 'text-emerald-600'}`} />
            ) : isPartiallyChecked ? (
              <div className="w-4 h-4 border-2 border-emerald-600 bg-emerald-100 rounded-xs flex items-center justify-center">
                <div className="w-2 h-2 bg-emerald-700 rounded-2xs" />
              </div>
            ) : (
              <Square className={`w-4 h-4 ${isChecked ? 'text-white/60' : 'text-gray-400 group-hover:text-gray-600'}`} />
            )}
          </button>

          {/* Ícone da pasta */}
          {isTopCategory ? (
            <IconComponent className={`w-4 h-4 shrink-0 ${isChecked ? 'text-white' : meta.iconColor}`} />
          ) : isExpanded ? (
            <FolderOpen className={`w-4 h-4 shrink-0 ${isChecked ? 'text-white' : 'text-amber-500'}`} />
          ) : (
            <Folder className={`w-4 h-4 shrink-0 ${isChecked ? 'text-white' : 'text-amber-500'}`} />
          )}

          {/* Nome da Pasta */}
          <span className="truncate text-xs font-medium" title={node.name}>
            {node.name}
          </span>
        </div>

        {/* Contador de KMLs / Lotes */}
        <span 
          className={`shrink-0 text-[11px] px-1.5 py-0.5 rounded-full font-mono font-bold border ${
            isChecked 
              ? 'bg-white/25 text-white border-white/30' 
              : isTopCategory
              ? meta.badge
              : 'bg-gray-100 text-gray-600 border-gray-200'
          }`}
        >
          {node.kml_count.toLocaleString('pt-BR')}
        </span>
      </div>

      {/* Filhos recursivos */}
      {hasChildren && isExpanded && (
        <div className="relative">
          <div 
            className="absolute top-0 bottom-0 border-l border-gray-200 pointer-events-none" 
            style={{ left: `${depth * 16 + 14}px` }} 
          />
          {node.children!.map((child) => (
            <TreeNodeItem
              key={child.id || child.path}
              node={child}
              depth={depth + 1}
              selectedPaths={selectedPaths}
              onToggleNode={onToggleNode}
              searchQuery={searchQuery}
              expandedNodes={expandedNodes}
              toggleExpandNode={toggleExpandNode}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const KmlFolderTreeFilter: React.FC<KmlFolderTreeFilterProps> = ({
  tree,
  selectedPaths,
  onPathsChange,
  isLoading = false,
  onReload,
  totalFilteredLots = 0
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['1 - PROPRIAS', '2 - ACIONISTAS', '3 - FORNECEDORES']));

  const isAllSelected = selectedPaths.includes('ALL');
  const totalLots = tree?.kml_count || 3114;

  const toggleExpandNode = (path: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (!tree) return;
    const all = new Set<string>();
    const collect = (node: KmlTreeNode) => {
      all.add(node.path);
      node.children?.forEach(collect);
    };
    tree.children?.forEach(collect);
    setExpandedNodes(all);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  const handleToggleNode = useCallback((node: KmlTreeNode) => {
    const nextPaths = calculateNewSelectedPaths(node, selectedPaths, tree);
    onPathsChange(nextPaths);
  }, [selectedPaths, tree, onPathsChange]);

  const handleSelectAll = () => {
    onPathsChange(['ALL']);
  };

  const handleClearSelection = () => {
    onPathsChange([]);
  };

  return (
    <div className="flex flex-col h-full bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
      {/* Cabeçalho do Filtro */}
      <div className="p-3 bg-gradient-to-r from-emerald-900 via-emerald-800 to-green-900 text-white shadow-sm shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-emerald-300" />
            <h3 className="font-bold text-xs tracking-wider uppercase">Filtro de Pastas KML</h3>
          </div>
          {onReload && (
            <button
              onClick={onReload}
              disabled={isLoading}
              className="p-1 text-emerald-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title="Recarregar KMLs do disco"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-white' : ''}`} />
            </button>
          )}
        </div>

        {/* Barra de Busca Rápida */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar fazenda, campo, lote..."
            className="w-full pl-8 pr-8 py-1.5 text-xs bg-white text-gray-900 rounded-lg placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-400 border border-transparent shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Botões de Ação Rápida */}
      <div className="p-2 bg-gray-50 border-b border-gray-200 flex flex-col gap-1.5 shrink-0">
        <div className="grid grid-cols-2 gap-1.5">
          {/* Botão "Todos os Mapas" */}
          <button
            onClick={handleSelectAll}
            className={`flex items-center justify-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer ${
              isAllSelected
                ? 'bg-emerald-700 text-white ring-2 ring-emerald-500 shadow-md'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${isAllSelected ? 'text-yellow-300' : 'text-emerald-600'}`} />
            <span>Todos os Mapas</span>
          </button>

          {/* Botão "Desmarcar Tudo" */}
          <button
            onClick={handleClearSelection}
            className="flex items-center justify-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white text-red-700 hover:bg-red-50 hover:text-red-800 border border-red-200 transition-all shadow-xs cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Desmarcar Tudo</span>
          </button>
        </div>

        {/* Ações de Expandir/Recolher */}
        <div className="flex items-center justify-between text-[11px] text-gray-500 px-1 pt-0.5">
          <div className="flex items-center space-x-2">
            <button 
              onClick={expandAll} 
              className="hover:text-emerald-700 underline font-medium cursor-pointer"
            >
              Expandir tudo
            </button>
            <span>•</span>
            <button 
              onClick={collapseAll} 
              className="hover:text-emerald-700 underline font-medium cursor-pointer"
            >
              Recolher tudo
            </button>
          </div>

          <span className="text-[10px] text-gray-400">
            {totalLots.toLocaleString('pt-BR')} total
          </span>
        </div>
      </div>

      {/* Lista da Árvore com Scroll */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {isLoading && !tree ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-500">
            <RotateCw className="w-5 h-5 animate-spin text-emerald-600 mb-2" />
            <span className="text-xs">Carregando pastas KML...</span>
          </div>
        ) : tree && tree.children && tree.children.length > 0 ? (
          tree.children.map((childNode) => (
            <TreeNodeItem
              key={childNode.id || childNode.path}
              node={childNode}
              depth={0}
              selectedPaths={selectedPaths}
              onToggleNode={handleToggleNode}
              searchQuery={searchQuery}
              expandedNodes={expandedNodes}
              toggleExpandNode={toggleExpandNode}
            />
          ))
        ) : (
          <div className="text-center py-8 text-gray-400 text-xs">
            Nenhuma pasta KML encontrada.
          </div>
        )}
      </div>

      {/* Rodapé informativo de status */}
      <div className="p-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-600 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-1.5 truncate mr-2">
          <Eye className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="truncate text-[11px]">
            Exibindo: <strong className="text-gray-900 font-bold">{(totalFilteredLots || 0).toLocaleString('pt-BR')}</strong> lote(s)
          </span>
        </div>
        {selectedPaths.length > 0 && !isAllSelected && (
          <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full text-[10px] shrink-0 border border-emerald-200">
            {selectedPaths.length} filtro(s)
          </span>
        )}
      </div>
    </div>
  );
};

export default KmlFolderTreeFilter;
