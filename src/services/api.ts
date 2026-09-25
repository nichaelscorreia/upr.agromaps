import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token JWT automaticamente
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('agromaps_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para lidar com respostas de erro
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    const isAuthEndpoint = url.includes('/login') || url.includes('/register') || url.includes('/check-auth');
    
    if (error.response?.status === 401 && !isAuthEndpoint) {
      // Token expirado ou inválido em endpoints protegidos
      localStorage.removeItem('agromaps_token');
      localStorage.removeItem('agromaps_user');
      if (window.location.pathname !== '/' && window.location.pathname !== '') {
        window.location.reload();
      }
    }
    return Promise.reject(error);
  }
);

// Interfaces de Usuário
export interface User {
  id: string;
  name: string;
  email: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: User;
}

export interface Farm {
  id: string;
  name: string;
  owner: string;
  lots_count: number;
  created_at: string;
}

export interface Lot {
  id: string;
  name: string;
  lot_number?: string;
  polygons: {
    coordinates: [number, number][];
    description: string;
  }[];
  description?: string;
  farm_name?: string;
  category?: string;
  path?: string;
  folder_path?: string;
  path_parts?: string[];
  harvested?: boolean;
}

export interface LotInfo {
  // Dados Tecnológicos
  fazenda: string;
  talhao: string;
  folha?: string;
  variedade?: string;
  area?: string;
  plantio?: string;
  ult_corte?: string;
  
  // TCH Data
  ton_colhidas?: string;
  tch_prev?: string;
  tch_real?: string;
  percentual?: string;
  
  // Histórico
  historico_tch?: {
    [year: string]: number;
  };
  
  // Status
  status?: 'Acima' | 'Necessário' | 'Abaixo' | 'Excesso';

  // Metadados KML
  category?: string;
  path?: string;
  path_parts?: string[];
  is_kml_metadata?: boolean;
}

export interface LotInfoError {
  error: string;
  message: string;
  farm_name?: string;
  lot_name?: string;
}

export interface FarmWithLots {
  id: string;
  name: string;
  owner: string;
}

// Funções de Autenticação
export const register = async (name: string, email: string, password: string): Promise<AuthResponse> => {
  const loginInput = email.trim();
  const displayName = name.trim() || loginInput;
  const response = await api.post('/register', { 
    name: displayName, 
    email: loginInput, 
    login: loginInput,
    password 
  });
  
  if (response.data.success && response.data.token) {
    localStorage.setItem('agromaps_token', response.data.token);
    localStorage.setItem('agromaps_user', JSON.stringify(response.data.user));
  }
  
  return response.data;
};

export const login = async (email: string, password: string): Promise<AuthResponse> => {
  const loginInput = email.trim();
  const response = await api.post('/login', { 
    email: loginInput, 
    login: loginInput,
    password 
  });
  
  if (response.data.success && response.data.token) {
    localStorage.setItem('agromaps_token', response.data.token);
    localStorage.setItem('agromaps_user', JSON.stringify(response.data.user));
  }
  
  return response.data;
};

export const logout = async (): Promise<{ success: boolean, message: string }> => {
  localStorage.removeItem('agromaps_token');
  localStorage.removeItem('agromaps_user');
  
  try {
    const response = await api.post('/logout');
    return response.data;
  } catch (error) {
    return { success: true, message: 'Logout realizado localmente' };
  }
};

export const checkAuth = async (): Promise<{ authenticated: boolean, user?: User }> => {
  const token = localStorage.getItem('agromaps_token');
  const userStr = localStorage.getItem('agromaps_user');
  
  if (!token || !userStr) {
    return { authenticated: false };
  }
  
  try {
    const response = await api.get('/check-auth');
    return response.data;
  } catch (error) {
    // Token inválido, limpar localStorage
    localStorage.removeItem('agromaps_token');
    localStorage.removeItem('agromaps_user');
    return { authenticated: false };
  }
};

// Criar nova fazenda
export const createFarm = async (name: string, owner: string): Promise<{ farm_id: string, message: string }> => {
  const response = await api.post('/create-farm', { name, owner });
  return response.data;
};

// Listar todas as fazendas
export const getFarms = async (): Promise<Farm[]> => {
  const response = await api.get('/get-farms');
  return response.data.farms;
};

// Upload de lote KML para fazenda específica
export const uploadLotToFarm = async (
  farmId: string, 
  file: File, 
  lotNumber: string,
  overwrite: boolean = true
): Promise<{ lot_id?: string; action?: 'created' | 'updated'; lots_added: number; message: string }> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('lot_number', lotNumber);
  formData.append('overwrite', overwrite ? 'true' : 'false');

  try {
    const response = await api.post(`/upload-lot/${farmId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error: any) {
    console.error('Erro no upload do lote:', error);
    throw new Error(error.response?.data?.error || error.response?.data?.message || 'Erro ao processar arquivo KML');
  }
};

// Importar pasta completa de KMLs com envio em lotes para evitar erro 413 (Payload Too Large)
export const importKmlFolder = async (
  files: File[],
  paths: string[],
  owner: string = 'Proprietário',
  overwrite: boolean = true,
  onProgress?: (percentage: number) => void
): Promise<FolderImportResponse> => {
  const CHUNK_SIZE = 15; // Enviar em lotes de 15 arquivos para garantir uploads leves e seguros
  const totalFiles = files.length;
  
  if (totalFiles === 0) {
    return {
      success: true,
      message: 'Nenhum arquivo para importar',
      summary: {
        farms_created: 0,
        farms_existing: 0,
        lots_created: 0,
        lots_updated: 0,
        total_lots: 0,
        errors_count: 0
      },
      details: [],
      errors: []
    };
  }

  const combinedSummary: FolderImportSummary = {
    farms_created: 0,
    farms_existing: 0,
    lots_created: 0,
    lots_updated: 0,
    total_lots: 0,
    errors_count: 0
  };
  const allDetails: FolderImportDetail[] = [];
  const allErrors: { file: string; path: string; farm_name: string; error: string }[] = [];

  const totalChunks = Math.ceil(totalFiles / CHUNK_SIZE);

  for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
    const start = chunkIdx * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, totalFiles);
    const chunkFiles = files.slice(start, end);
    const chunkPaths = paths.slice(start, end);

    const formData = new FormData();
    chunkFiles.forEach((file) => {
      formData.append('files', file);
    });
    chunkPaths.forEach((p) => {
      formData.append('paths', p);
    });
    formData.append('owner', owner);
    formData.append('overwrite', overwrite ? 'true' : 'false');

    try {
      const response = await api.post<FolderImportResponse>('/import-kml-folder', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const chunkData = response.data;
      if (chunkData.summary) {
        combinedSummary.farms_created += chunkData.summary.farms_created || 0;
        combinedSummary.farms_existing += chunkData.summary.farms_existing || 0;
        combinedSummary.lots_created += chunkData.summary.lots_created || 0;
        combinedSummary.lots_updated += chunkData.summary.lots_updated || 0;
        combinedSummary.total_lots += chunkData.summary.total_lots || 0;
        combinedSummary.errors_count += chunkData.summary.errors_count || 0;
      }
      if (chunkData.details) {
        allDetails.push(...chunkData.details);
      }
      if (chunkData.errors) {
        allErrors.push(...chunkData.errors);
      }
    } catch (chunkErr: any) {
      console.error(`Erro no lote ${chunkIdx + 1}/${totalChunks}:`, chunkErr);
      const errMsg = chunkErr.response?.data?.error || chunkErr.message || 'Erro no lote de arquivos';
      chunkFiles.forEach((f, i) => {
        allErrors.push({
          file: f.name,
          path: chunkPaths[i] || f.name,
          farm_name: 'Pasta',
          error: errMsg
        });
      });
      combinedSummary.errors_count += chunkFiles.length;
    }

    if (onProgress) {
      const currentProgress = Math.round(((chunkIdx + 1) / totalChunks) * 100);
      onProgress(currentProgress);
    }
  }

  return {
    success: allErrors.length < totalFiles,
    message: `Importação concluída: ${combinedSummary.total_lots} lotes processados (${combinedSummary.lots_updated} sobrepostos, ${combinedSummary.lots_created} novos)`,
    summary: combinedSummary,
    details: allDetails,
    errors: allErrors
  };
};

// Buscar lotes de uma fazenda específica
export const getFarmLots = async (farmId: string): Promise<{ farm: FarmWithLots, lots: Lot[] }> => {
  try {
    const response = await api.get(`/get-farm-lots/${farmId}`);
    return response.data;
  } catch (error: any) {
    console.error('Erro ao buscar lotes da fazenda:', error);
    
    // Se a fazenda não tem lotes ainda, retornar estrutura vazia
    if (error.response?.status === 404) {
      return {
        farm: { id: farmId, name: 'Fazenda', owner: 'Proprietário' },
        lots: []
      };
    }
    
    throw error;
  }
};

// Buscar todos os lotes (Fazendas Gerais)
export const getAllLots = async (): Promise<Lot[]> => {
  const response = await api.get('/get-all-lots');
  return response.data.lots;
};

// Buscar informações de um lote específico
export const getLotInfo = async (lotId: string): Promise<LotInfo | LotInfoError> => {
  const response = await api.get(`/get-lot-info/${lotId}`);
  
  if (response.data.success) {
    return response.data.data;
  } else {
    return {
      error: response.data.error,
      message: response.data.message,
      farm_name: response.data.farm_name,
      lot_name: response.data.lot_name
    };
  }
};

// Deletar fazenda
export const deleteFarm = async (farmId: string): Promise<{ message: string }> => {
  const response = await api.delete(`/delete-farm/${farmId}`);
  return response.data;
};

// Deletar lote
export const deleteLot = async (lotId: string): Promise<{ message: string }> => {
  const response = await api.delete(`/delete-lot/${lotId}`);
  return response.data;
};

// Interfaces para Trello
export interface Employee {
  id: string;
  name: string;
  role: string;
  email?: string;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assigned_to: string;
  due_date: string;
  status: 'todo' | 'in_progress' | 'validation' | 'done';
  created_at: string;
  updated_at: string;
}

// Funções para Funcionários
export const getEmployees = async (): Promise<Employee[]> => {
  const response = await api.get('/employees');
  return response.data.employees;
};

export const createEmployee = async (name: string, role: string, email?: string): Promise<{ employee_id: string, message: string }> => {
  const response = await api.post('/employees', { name, role, email });
  return response.data;
};

export const deleteEmployee = async (employeeId: string): Promise<{ message: string }> => {
  const response = await api.delete(`/employees/${employeeId}`);
  return response.data;
};

// Funções para Tarefas
export const getTasks = async (): Promise<Task[]> => {
  const response = await api.get('/tasks');
  return response.data.tasks;
};

export const createTask = async (
  title: string, 
  description: string, 
  assignedTo: string, 
  dueDate: string, 
  status: string = 'todo'
): Promise<{ task_id: string, message: string }> => {
  const response = await api.post('/tasks', {
    title,
    description,
    assigned_to: assignedTo,
    due_date: dueDate,
    status
  });
  return response.data;
};

export const updateTask = async (taskId: string, updates: Partial<Task>): Promise<{ message: string }> => {
  const response = await api.put(`/tasks/${taskId}`, updates);
  return response.data;
};

export const deleteTask = async (taskId: string): Promise<{ message: string }> => {
  const response = await api.delete(`/tasks/${taskId}`);
  return response.data;
};

// Interfaces para Colheita
export interface HarvestStatus {
  [lotId: string]: boolean;
}

// Interfaces para Painel Gerencial
export interface LotManagementData {
  id: string;
  name: string;
  farm_name: string;
  lot_number: string;
  polygons_count: number;
  has_data: boolean;
  data?: LotInfo;
}

export interface LotDataUpdate {
  fazenda?: string;
  talhao?: string;
  folha?: string;
  variedade?: string;
  area?: string;
  plantio?: string;
  ult_corte?: string;
  ton_colhidas?: string;
  tch_prev?: string;
  tch_real?: string;
  percentual?: string;
  colhido?: boolean;
  historico_tch?: {
    [year: string]: number;
  };
}

// Funções para Colheita
export const getHarvestStatus = async (): Promise<HarvestStatus> => {
  const response = await api.get('/harvest-status');
  return response.data.harvest_status;
};

export const updateHarvestStatus = async (lotId: string, harvested: boolean): Promise<{ message: string }> => {
  const response = await api.put(`/harvest-status/${lotId}`, { harvested });
  return response.data;
};

// Funções para Painel Gerencial
export const getLotsForManagement = async (): Promise<LotManagementData[]> => {
  const response = await api.get('/management/lots');
  return response.data.lots;
};

export const updateLotData = async (lotId: string, updates: LotDataUpdate): Promise<{ message: string }> => {
  const response = await api.put(`/management/lots/${lotId}`, updates);
  return response.data;
};

// Interfaces para Análise de Frota
export interface Vehicle {
  id: string;
  imei: string;
  placa: string;
  name: string;
  latitude: number;
  longitude: number;
  velocidade: number;
  data_hora_gps: string;
  status_veiculo: string;
  status_ignicao: string;
  last_updated: string;
  status: 'active' | 'inactive' | 'maintenance';
}

// Funções para Análise de Frota
export const getVehicles = async (): Promise<Vehicle[]> => {
  const response = await api.get('/vehicles');
  return response.data.vehicles;
};

// Interfaces para Análise de Abastecimento
export interface FuelData {
  id: string;
  imei: string;
  placa: string;
  name: string;
  latitude: number;
  longitude: number;
  autonomia_percent: number;
  litros_restantes: number;
  consumo_medio: number;
  km_restantes: number;
  last_updated: string;
  status: 'normal' | 'warning' | 'critical';
}

// Funções para Análise de Abastecimento
export const getFuelData = async (): Promise<FuelData[]> => {
  const response = await api.get('/fuel-data');
  return response.data.fuel_data;
};

// Interfaces para Status de Colheita dos Lotes
export interface HarvestLotStatus {
  fazenda: string;
  lote: string;
  status: 'NAO' | 'SIM' | 'COLHENDO';
}

export interface HarvestLotsStatusResponse {
  [key: string]: HarvestLotStatus;
}

// Função para buscar status de colheita dos lotes da planilha
export const getHarvestLotsStatus = async (): Promise<HarvestLotsStatusResponse> => {
  const response = await api.get('/harvest-lots-status');
  return response.data.harvest_status;
};

// =============================================================================
// Interfaces e Funções para Árvore e Filtro de KMLs (pasta kmls/)
// =============================================================================

export interface KmlTreeNode {
  id: string;
  name: string;
  path: string;
  type: 'folder' | 'file';
  kml_count: number;
  total_area_ha?: number;
  children?: KmlTreeNode[];
}

export interface KmlTreeResponse {
  success: boolean;
  tree: KmlTreeNode;
  total_lots: number;
}

export interface KmlLotsResponse {
  success: boolean;
  lots: Lot[];
  total: number;
}

export const getKmlTree = async (): Promise<KmlTreeResponse> => {
  const response = await api.get<KmlTreeResponse>('/kmls/tree');
  return response.data;
};

export const getKmlLots = async (paths?: string[], search?: string): Promise<Lot[]> => {
  const params: any = {};
  if (paths !== undefined) {
    if (paths.length === 0) {
      params.paths = '__NONE__';
    } else if (paths.includes('ALL')) {
      params.paths = 'ALL';
    } else {
      params.paths = paths.join(',');
    }
  }
  if (search && search.trim()) {
    params.search = search.trim();
  }
  const response = await api.get<KmlLotsResponse>('/kmls/lots', { params });
  return response.data.lots || [];
};

export const filterKmlLots = async (paths: string[], search?: string): Promise<Lot[]> => {
  const response = await api.post<KmlLotsResponse>('/kmls/lots', {
    paths: paths.length === 0 ? [] : (paths.includes('ALL') ? ['ALL'] : paths),
    search: search || ''
  });
  return response.data.lots || [];
};

export const getKmlLotInfo = async (lotPath: string): Promise<LotInfo | LotInfoError> => {
  const response = await api.get(`/kmls/lot-info`, {
    params: { path: lotPath }
  });
  if (response.data.success) {
    return response.data.data;
  }
  return response.data;
};

export const reloadKmlDirectory = async (): Promise<{ success: boolean; message: string; total_lots: number; tree: KmlTreeNode }> => {
  const response = await api.post('/kmls/reload');
  return response.data;
};

// =============================================================================
// Interfaces e Funções para Planejamento de Colheita (NSTech WebService)
// =============================================================================

export interface HarvestPlanningLotData {
  codfaz: string | number;
  codlot: string | number;
  nome_fazenda: string;
  area: number;
  producao_estimada: number;
  tch_previsto: number;
  data_plantio: string;
  idade_cana: string;
  data_ultima_colheita: string;
  variedade: string;
  numero_corte?: string;
  turmas?: number;
  data_movimento: string;
  raw?: any;
}

export interface HarvestPlanningItem {
  id: string;
  lot_name: string;
  codfaz: string | number;
  codlot: string | number;
  nome_fazenda: string;
  data_planejamento: string; // YYYY-MM-DD
  data_movimento: string; // DD/MM/YYYY
  area: number;
  producao_estimada: number;
  tch_previsto: number;
  turmas: number;
  variedade?: string;
  data_plantio?: string;
  idade_cana?: string;
  data_ultima_colheita?: string;
  numero_corte?: string;
  created_at?: string;
  updated_at?: string;
  user_id?: string;
  polygons?: Array<{ coordinates: number[][]; description?: string }>;
}

export interface HarvestPlanningGroupedFarm {
  farm_name: string;
  codfaz: string | number;
  items: HarvestPlanningItem[];
  subtotal_area: number;
  subtotal_producao: number;
  subtotal_turmas: number;
}

export interface HarvestPlanningListResponse {
  success: boolean;
  items: HarvestPlanningItem[];
  total_items: number;
  total_area: number;
  total_producao: number;
  total_turmas: number;
  grouped_by_farm: { [farmName: string]: HarvestPlanningGroupedFarm };
  data_filtro: string;
  error?: string;
}

export interface HarvestPlanningResponse {
  success: boolean;
  data?: HarvestPlanningLotData;
  message?: string;
  error?: string;
}

export const getHarvestPlanningLotData = async (
  params: {
    codfaz?: string | number;
    codlot?: string | number;
    datmov?: string;
    lot_name?: string;
    path?: string;
  }
): Promise<HarvestPlanningResponse> => {
  const response = await api.get<HarvestPlanningResponse>('/harvest-planning/lot-data', { params });
  return response.data;
};

export const saveHarvestPlanningItem = async (
  itemData: Partial<HarvestPlanningItem>
): Promise<{ success: boolean; message: string; item?: HarvestPlanningItem; error?: string }> => {
  const response = await api.post('/harvest-planning/save', itemData);
  return response.data;
};

export const getHarvestPlanningList = async (
  params?: {
    data?: string;
    datmov?: string;
    date?: string;
    fazenda?: string;
  }
): Promise<HarvestPlanningListResponse> => {
  const response = await api.get<HarvestPlanningListResponse>('/harvest-planning/list', { params });
  return response.data;
};

export const deleteHarvestPlanningItem = async (
  itemId: string
): Promise<{ success: boolean; message: string; error?: string }> => {
  const response = await api.delete(`/harvest-planning/item/${itemId}`);
  return response.data;
};

// ==========================================
// PROJEÇÃO & EVOLUÇÃO TEMPORAL DA SAFRA 26/27
// ==========================================

export interface HarvestProjectionRecord {
  fazenda: string;
  talhao: string;
  data: string;
  corte: string;
  toneladas: number;
}

export interface HarvestProjectionDay {
  date: string;
  formatted_date: string;
  day_of_week: string;
  month: string;
  day_tons: number;
  day_lots_count: number;
  accumulated_tons: number;
  accumulated_lots: number;
  pct_completed: number;
  lots: HarvestProjectionRecord[];
}

export interface HarvestProjectionLotDetail {
  fazenda: string;
  talhao: string;
  key: string;
  dates: string[];
  primary_date: string;
  total_toneladas: number;
  cortes: string[];
  records: HarvestProjectionRecord[];
}

export interface HarvestProjectionMonthlyStat {
  month: string;
  label: string;
  total_tons: number;
  unique_lots: number;
  records: number;
}

export interface HarvestProjectionDataResponse {
  success: boolean;
  summary: {
    total_records: number;
    unique_lots: number;
    total_tons: number;
    start_date: string;
    end_date: string;
    total_dates: number;
    monthly_stats: HarvestProjectionMonthlyStat[];
    cut_summary: {
      [cutType: string]: {
        tons: number;
        count: number;
      };
    };
  };
  timeline: HarvestProjectionDay[];
  dates: string[];
  lots_map: { [key: string]: HarvestProjectionLotDetail };
  error?: string;
}

export const getHarvestProjectionData = async (): Promise<HarvestProjectionDataResponse> => {
  const response = await api.get<HarvestProjectionDataResponse>('/harvest-projection/data');
  return response.data;
};