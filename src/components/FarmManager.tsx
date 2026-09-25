import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Upload, MapPin, Loader, Trash2, FileText, CheckCircle } from 'lucide-react';
import { uploadLotToFarm, getFarmLots, getLotInfo, deleteLot, Lot, LotInfo, FarmWithLots } from '../services/api';
import GoogleMapComponent from './GoogleMapComponent';
import FileUpload from './FileUpload';

interface FarmManagerProps {
  farmId: string;
  farmName: string;
  onBack: () => void;
}

const FarmManager: React.FC<FarmManagerProps> = ({ farmId, farmName, onBack }) => {
  const [farm, setFarm] = useState<FarmWithLots | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [selectedLotInfo, setSelectedLotInfo] = useState<LotInfo | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [nextLotNumber, setNextLotNumber] = useState(1);
  const [deletingLotId, setDeletingLotId] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<'single' | 'multiple'>('single');
  const [uploadResults, setUploadResults] = useState<{file: string, success: boolean, message: string}[]>([]);

  useEffect(() => {
    loadFarmLots();
  }, [farmId]);

  const loadFarmLots = async () => {
    setIsLoading(true);
    try {
      const farmData = await getFarmLots(farmId);
      console.log('Dados da fazenda carregados:', farmData);
      console.log('Lotes da fazenda:', farmData.lots);
      setFarm(farmData.farm);
      setLots(farmData.lots);
      
      // Calcular próximo número do lote
      const maxLotNumber = farmData.lots.reduce((max, lot) => {
        const lotNum = parseInt(lot.lot_number) || 0;
        return Math.max(max, lotNum);
      }, 0);
      setNextLotNumber(maxLotNumber + 1);
    } catch (error) {
      console.error('Erro ao carregar lotes da fazenda:', error);
      // Mesmo com erro, definir dados básicos para evitar tela branca
      setFarm({ id: farmId, name: farmName, owner: 'Proprietário' });
      setLots([]);
      setNextLotNumber(1);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    setUploadMessage('');
    
    try {
      const result = await uploadLotToFarm(farmId, file, nextLotNumber.toString());
      setUploadMessage(result.message);
      
      // Recarregar lotes
      await loadFarmLots();
      
      // Limpar mensagem após 3 segundos
      setTimeout(() => setUploadMessage(''), 3000);
    } catch (error) {
      console.error('Erro ao fazer upload do lote:', error);
      setUploadMessage(error instanceof Error ? error.message : 'Erro ao processar arquivo KML');
    } finally {
      setIsUploading(false);
    }
  }, [farmId, nextLotNumber]);

  const handleMultipleFileUpload = useCallback(async (files: File[]) => {
    setIsUploading(true);
    setUploadMessage('');
    setUploadResults([]);
    
    const results: {file: string, success: boolean, message: string}[] = [];
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Extrair número do lote do nome do arquivo
        const fileName = file.name.replace('.kml', '');
        const lotNumber = fileName.match(/\d+/)?.[0] || (nextLotNumber + i).toString();
        
        try {
          const result = await uploadLotToFarm(farmId, file, lotNumber);
          results.push({
            file: file.name,
            success: true,
            message: `Lote ${lotNumber} criado com sucesso`
          });
          console.log(`Upload bem-sucedido: ${file.name} -> Lote ${lotNumber}`);
        } catch (error) {
          console.error(`Erro no upload de ${file.name}:`, error);
          results.push({
            file: file.name,
            success: false,
            message: error instanceof Error ? error.message : `Erro ao processar ${file.name}`
          });
        }
      }
      
      setUploadResults(results);
      
      const successCount = results.filter(r => r.success).length;
      const totalCount = results.length;
      
      setUploadMessage(`Upload concluído: ${successCount}/${totalCount} arquivos processados com sucesso`);
      
      // Recarregar lotes
      await loadFarmLots();
      
      // Limpar mensagem após 5 segundos
      setTimeout(() => {
        setUploadMessage('');
        setUploadResults([]);
      }, 5000);
      
    } catch (error) {
      console.error('Erro no upload múltiplo:', error);
      setUploadMessage('Erro geral no upload múltiplo');
    } finally {
      setIsUploading(false);
    }
  }, [farmId, nextLotNumber]);
  const handleLotClick = useCallback(async (lotId: string) => {
    setIsLoading(true);
    try {
      const lotInfo = await getLotInfo(lotId);
      
      // Verificar se é um erro ou dados válidos
      if ('error' in lotInfo) {
        // É um erro, mas ainda assim mostrar no painel
        setSelectedLotInfo(lotInfo as any);
      } else {
        // Dados válidos
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

  const handleDeleteLot = async (lotId: string, lotName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Evitar que o clique selecione o lote
    
    if (!window.confirm(`Tem certeza que deseja excluir o lote "${lotName}"?`)) {
      return;
    }
    
    setDeletingLotId(lotId);
    try {
      await deleteLot(lotId);
      await loadFarmLots(); // Recarregar lotes
      
      // Limpar seleção se o lote deletado estava selecionado
      if (selectedLotInfo) {
        setSelectedLotInfo(null);
      }
    } catch (error) {
      console.error('Erro ao deletar lote:', error);
      alert('Erro ao deletar lote. Tente novamente.');
    } finally {
      setDeletingLotId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center">
            <button
              onClick={onBack}
              className="mr-4 p-2 rounded-md hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{farmName}</h1>
              {farm && (
                <p className="text-sm text-gray-600">Proprietário: {farm.owner}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Loading State */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando dados da fazenda...</p>
          </div>
        </div>
      )}

      {/* Main Content - Only show when not loading */}
      {!isLoading && (
      <div className="flex-1 flex">
        {/* Sidebar */}
        <aside className="w-80 bg-white shadow-lg p-6 overflow-y-auto max-h-screen">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <Upload className="w-5 h-5 mr-2 text-green-600" />
                Upload Lote KML
              </h2>
              
              {/* Seletor de modo de upload */}
              <div className="mb-4 p-3 bg-gray-50 rounded-md">
                <div className="flex items-center space-x-4 mb-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="uploadMode"
                      value="single"
                      checked={uploadMode === 'single'}
                      onChange={(e) => setUploadMode(e.target.value as 'single')}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium">Upload Individual</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="uploadMode"
                      value="multiple"
                      checked={uploadMode === 'multiple'}
                      onChange={(e) => setUploadMode(e.target.value as 'multiple')}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium">Upload Múltiplo</span>
                  </label>
                </div>
                
                {uploadMode === 'single' ? (
                  <p className="text-xs text-gray-600">
                    <strong>Próximo lote:</strong> {farmName} - Lote {nextLotNumber}
                  </p>
                ) : (
                  <div className="text-xs text-blue-700 space-y-1">
                    <p><strong>📁 Upload Múltiplo:</strong></p>
                    <p>• Selecione vários arquivos KML de uma vez</p>
                    <p>• O número do lote será extraído do nome do arquivo</p>
                    <p>• Ex: "lote_05.kml" → Lote 5</p>
                    <p>• Se não houver número, será usado sequencial</p>
                  </div>
                )}
              </div>
              <FileUpload 
                onFileUpload={uploadMode === 'single' ? handleFileUpload : undefined}
                onMultipleFileUpload={uploadMode === 'multiple' ? handleMultipleFileUpload : undefined}
                isUploading={isUploading}
                multiple={uploadMode === 'multiple'}
              />
              
              {uploadMessage && (
                <div className={`mt-3 p-3 rounded-md text-sm ${
                  uploadMessage.includes('Erro') 
                    ? 'bg-red-50 text-red-700 border border-red-200' 
                    : 'bg-green-50 text-green-700 border border-green-200'
                }`}>
                  {uploadMessage}
                </div>
              )}
              
              {/* Resultados do upload múltiplo */}
              {uploadResults.length > 0 && (
                <div className="mt-3 p-3 bg-gray-50 rounded-md border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                    <FileText className="w-4 h-4 mr-1" />
                    Resultados do Upload:
                  </h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {uploadResults.map((result, index) => (
                      <div key={index} className="flex items-center text-xs">
                        {result.success ? (
                          <CheckCircle className="w-3 h-3 text-green-600 mr-2" />
                        ) : (
                          <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                        )}
                        <span className={result.success ? 'text-green-700' : 'text-red-700'}>
                          {result.file}: {result.message}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Lista de Lotes */}
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <MapPin className="w-5 h-5 mr-2 text-green-600" />
                Lotes ({lots.length})
              </h2>
              
              <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                {lots.map((lot) => (
                  <div
                    key={lot.id}
                    className="relative group p-3 rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-colors"
                  >
                    <button
                      onClick={() => handleLotClick(lot.id)}
                      className="w-full text-left"
                    >
                      <div className="font-medium text-gray-800">{lot.name}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        {lot.polygons.length} polígono(s)
                        {lot.description && ` • ${lot.description}`}
                      </div>
                    </button>
                    
                    <button
                      onClick={(e) => handleDeleteLot(lot.id, lot.name, e)}
                      disabled={deletingLotId === lot.id}
                      className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                      title="Excluir lote"
                    >
                      {deletingLotId === lot.id ? (
                        <div className="animate-spin w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full"></div>
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))}
                
                {lots.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    <MapPin className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p>Nenhum lote adicionado</p>
                    <p className="text-sm">Faça upload de um arquivo KML</p>
                  </div>
                )}
              </div>
            </div>

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader className="w-5 h-5 animate-spin text-green-600 mr-2" />
                <span className="text-gray-600">Carregando informações...</span>
              </div>
            )}
          </div>
        </aside>

        {/* Map Area */}
        <main className="flex-1 p-6">
          <div className="h-full bg-white rounded-lg shadow-lg overflow-hidden">
            <GoogleMapComponent 
              lots={lots}
              onLotClick={handleLotClick}
              selectedLotInfo={selectedLotInfo as any}
            />
          </div>
        </main>
      </div>
      )}
    </div>
  );
};

export default FarmManager;