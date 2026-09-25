import React, { useState, useRef, useCallback } from 'react';
import { 
  FolderUp, 
  Folder, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  RefreshCw, 
  Layers, 
  Building2, 
  UploadCloud, 
  Check, 
  ChevronRight,
  Info
} from 'lucide-react';
import { importKmlFolder, FolderImportResponse, Farm } from '../services/api';

interface FileItem {
  file: File;
  relativePath: string;
  farmName: string;
  lotName: string;
}

interface FarmGroup {
  farmName: string;
  files: FileItem[];
  isExisting: boolean;
}

interface KmlFolderImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  existingFarms?: Farm[];
  currentUserName?: string;
}

const KmlFolderImportModal: React.FC<KmlFolderImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
  existingFarms = [],
  currentUserName = 'Proprietário'
}) => {
  const [selectedFiles, setSelectedFiles] = useState<FileItem[]>([]);
  const [farmGroups, setFarmGroups] = useState<FarmGroup[]>([]);
  const [ownerName, setOwnerName] = useState<string>(currentUserName);
  const [overwrite, setOverwrite] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [importResult, setImportResult] = useState<FolderImportResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Analisar arquivos e agrupar por pasta (Fazenda)
  const processRawFiles = useCallback((rawFiles: { file: File; path: string }[]) => {
    const kmlFiles = rawFiles.filter(item => item.file.name.toLowerCase().endsWith('.kml'));
    
    if (kmlFiles.length === 0) {
      setErrorMessage('Nenhum arquivo .kml encontrado na pasta selecionada.');
      return;
    }

    setErrorMessage('');
    const items: FileItem[] = [];
    const groupsMap = new Map<string, FileItem[]>();

    const existingNamesSet = new Set(
      existingFarms.map(f => f.name.trim().toLowerCase())
    );

    for (const item of kmlFiles) {
      const cleanPath = item.path.replace(/\\/g, '/').replace(/^\/+/, '');
      const parts = cleanPath.split('/').filter(Boolean);

      let farmName = 'Fazenda Geral';
      let lotName = item.file.name.replace(/\.kml$/i, '');

      if (parts.length >= 2) {
        // A pasta imediatamente superior ao arquivo KML representa a Fazenda
        farmName = parts[parts.length - 2];
      }

      const fileItem: FileItem = {
        file: item.file,
        relativePath: cleanPath,
        farmName,
        lotName
      };

      items.push(fileItem);

      if (!groupsMap.has(farmName)) {
        groupsMap.set(farmName, []);
      }
      groupsMap.get(farmName)!.push(fileItem);
    }

    const groups: FarmGroup[] = Array.from(groupsMap.entries()).map(([name, files]) => ({
      farmName: name,
      files,
      isExisting: existingNamesSet.has(name.trim().toLowerCase())
    }));

    setSelectedFiles(items);
    setFarmGroups(groups);
    setImportResult(null);
  }, [existingFarms]);

  // Handler para input com webkitdirectory
  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const fileList = Array.from(e.target.files);
    const rawFiles = fileList.map(file => ({
      file,
      path: (file as any).webkitRelativePath || file.name
    }));

    processRawFiles(rawFiles);
  };

  // Leitura recursiva de entradas de diretório para Drag & Drop
  const scanEntry = async (entry: any, currentPath: string = ''): Promise<{ file: File; path: string }[]> => {
    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file((file: File) => {
          resolve([{ file, path: `${currentPath}${file.name}` }]);
        }, () => resolve([]));
      });
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const entries = await new Promise<any[]>((resolve) => {
        const results: any[] = [];
        const readEntries = () => {
          dirReader.readEntries((batch: any[]) => {
            if (batch.length === 0) {
              resolve(results);
            } else {
              results.push(...batch);
              readEntries();
            }
          }, () => resolve(results));
        };
        readEntries();
      });

      const promises = entries.map(child => scanEntry(child, `${currentPath}${entry.name}/`));
      const nested = await Promise.all(promises);
      return nested.flat();
    }
    return [];
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const items = e.dataTransfer.items;
    if (!items || items.length === 0) return;

    const collected: { file: File; path: string }[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.webkitGetAsEntry) {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          const filesFromEntry = await scanEntry(entry);
          collected.push(...filesFromEntry);
        }
      } else if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          collected.push({ file, path: file.name });
        }
      }
    }

    if (collected.length > 0) {
      processRawFiles(collected);
    }
  };

  const handleStartImport = async () => {
    if (selectedFiles.length === 0) return;

    setIsProcessing(true);
    setUploadProgress(0);
    setErrorMessage('');

    try {
      const files = selectedFiles.map(i => i.file);
      const paths = selectedFiles.map(i => i.relativePath);

      const result = await importKmlFolder(
        files,
        paths,
        ownerName,
        overwrite,
        (percent) => setUploadProgress(percent)
      );

      setImportResult(result);
      if (result.success) {
        onImportComplete();
      }
    } catch (err: any) {
      console.error('Erro na importação de pastas:', err);
      setErrorMessage(
        err.response?.data?.error || 
        err.message || 
        'Erro ao processar importação da pasta KML.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setSelectedFiles([]);
    setFarmGroups([]);
    setImportResult(null);
    setErrorMessage('');
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100">
        
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-emerald-800 to-green-700 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-sm">
              <FolderUp className="w-6 h-6 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Importar Pastas de KML</h2>
              <p className="text-xs text-emerald-100">
                Estrutura: Nome da Pasta (Fazenda) → Arquivos KML (Lotes)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Sucesso / Resumo da Importação */}
          {importResult && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-4 animate-scaleUp">
              <div className="flex items-center space-x-3 text-emerald-800">
                <CheckCircle2 className="w-7 h-7 text-emerald-600 flex-shrink-0" />
                <div>
                  <h3 className="font-bold text-lg">{importResult.message}</h3>
                  <p className="text-xs text-emerald-600">
                    Os lotes e fazendas já foram atualizados e estão prontos no mapa!
                  </p>
                </div>
              </div>

              {/* Métricas do Resumo */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-sm text-center">
                  <div className="text-2xl font-black text-emerald-700">
                    {importResult.summary.total_lots}
                  </div>
                  <div className="text-xs text-gray-500 font-medium">Lotes Processados</div>
                </div>

                <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-sm text-center">
                  <div className="text-2xl font-black text-blue-600">
                    {importResult.summary.lots_updated}
                  </div>
                  <div className="text-xs text-gray-500 font-medium">Lotes Sobrepostos (Atualizados)</div>
                </div>

                <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-sm text-center">
                  <div className="text-2xl font-black text-green-600">
                    {importResult.summary.lots_created}
                  </div>
                  <div className="text-xs text-gray-500 font-medium">Lotes Novos Criados</div>
                </div>

                <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-sm text-center">
                  <div className="text-2xl font-black text-amber-600">
                    {importResult.summary.farms_created + importResult.summary.farms_existing}
                  </div>
                  <div className="text-xs text-gray-500 font-medium">Fazendas Afetadas</div>
                </div>
              </div>

              {/* Detalhes expandidos */}
              {importResult.details.length > 0 && (
                <div className="max-h-48 overflow-y-auto bg-white rounded-lg border border-emerald-100 p-3 text-xs space-y-1.5">
                  <div className="font-semibold text-gray-700 mb-2">Relatório de Itens:</div>
                  {importResult.details.map((det, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                      <span className="text-gray-700 font-medium">
                        📂 {det.farm_name} <ChevronRight className="w-3 h-3 inline text-gray-400" /> {det.lot_name}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        det.action === 'updated' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {det.action === 'updated' ? '🔄 Sobreposto / Atualizado' : '➕ Novo'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Erros se houver */}
              {importResult.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs space-y-1">
                  <div className="font-bold text-red-700 flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-1.5 text-red-600" />
                    Arquivos com inconsistência ({importResult.errors.length}):
                  </div>
                  {importResult.errors.map((err, idx) => (
                    <div key={idx} className="text-red-600">
                      • {err.farm_name} / {err.file}: {err.error}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Área de Seleção de Pasta / Drag & Drop */}
          {!importResult && selectedFiles.length === 0 && (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                isDragOver 
                  ? 'border-emerald-500 bg-emerald-50 scale-[1.01]' 
                  : 'border-gray-300 hover:border-emerald-400 bg-gray-50 hover:bg-emerald-50/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                // @ts-ignore
                webkitdirectory=""
                directory=""
                multiple
                onChange={handleFolderSelect}
                className="hidden"
                id="kml-folder-input"
              />

              <div className="flex flex-col items-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                  <UploadCloud className="w-9 h-9" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">
                    Arraste a Pasta de Fazendas aqui ou Selecione no Computador
                  </h3>
                  <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                    Selecione uma pasta contendo subpastas com os nomes das Fazendas e os arquivos <code className="bg-gray-200 px-1.5 py-0.5 rounded text-gray-700">.kml</code> dentro de cada uma.
                  </p>
                </div>

                <div className="flex items-center space-x-3 pt-2">
                  <label
                    htmlFor="kml-folder-input"
                    className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-2.5 rounded-xl shadow-md transition-all flex items-center space-x-2"
                  >
                    <Folder className="w-4 h-4" />
                    <span>Selecionar Pasta</span>
                  </label>
                </div>

                {/* Dica da Estrutura */}
                <div className="bg-white rounded-xl p-3.5 border border-gray-200 text-left text-xs text-gray-600 max-w-md w-full shadow-sm">
                  <div className="font-semibold text-gray-800 flex items-center mb-1.5">
                    <Info className="w-4 h-4 text-emerald-600 mr-1.5" />
                    Estrutura recomendada:
                  </div>
                  <div className="font-mono text-[11px] bg-gray-50 p-2 rounded border border-gray-100 text-gray-700 leading-relaxed">
                    📁 Fazenda Santa Maria/<br />
                    &nbsp;&nbsp;📄 Lote 1.kml<br />
                    &nbsp;&nbsp;📄 Lote 2.kml<br />
                    📁 Fazenda Primavera/<br />
                    &nbsp;&nbsp;📄 Lote 1.kml
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pré-visualização dos Arquivos Carregados */}
          {selectedFiles.length > 0 && !importResult && (
            <div className="space-y-4 animate-fadeIn">
              
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="text-base font-bold text-gray-800 flex items-center">
                    <Layers className="w-5 h-5 text-emerald-600 mr-2" />
                    {selectedFiles.length} arquivo(s) KML identificado(s) em {farmGroups.length} fazenda(s)
                  </h3>
                  <p className="text-xs text-gray-500">
                    Verifique os lotes detectados antes de confirmar a importação
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isProcessing}
                  className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center"
                >
                  <X className="w-4 h-4 mr-1" /> Trocar pasta
                </button>
              </div>

              {/* Lista de Fazendas Detectadas */}
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {farmGroups.map((group, idx) => (
                  <div 
                    key={idx} 
                    className={`p-3.5 rounded-xl border transition-all ${
                      group.isExisting 
                        ? 'border-blue-200 bg-blue-50/50' 
                        : 'border-emerald-200 bg-emerald-50/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Building2 className={`w-5 h-5 ${group.isExisting ? 'text-blue-600' : 'text-emerald-600'}`} />
                        <span className="font-bold text-gray-800 text-sm">{group.farmName}</span>
                        <span className="text-xs text-gray-500">({group.files.length} lote{group.files.length > 1 ? 's' : ''})</span>
                      </div>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        group.isExisting 
                          ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        {group.isExisting ? '🔄 Fazenda Existente (Sobrepor)' : '➕ Nova Fazenda'}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pl-7">
                      {group.files.map((f, fIdx) => (
                        <span 
                          key={fIdx}
                          className="bg-white border border-gray-200 text-gray-700 px-2 py-0.5 rounded text-[11px] font-medium flex items-center"
                        >
                          <FileText className="w-3 h-3 mr-1 text-gray-400" />
                          {f.lotName}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Opções de Importação */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={overwrite}
                      onChange={(e) => setOverwrite(e.target.checked)}
                      disabled={isProcessing}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 border-gray-300"
                    />
                    <span className="font-medium text-gray-800">
                      Sobrepor / Atualizar lotes se já existirem no sistema
                    </span>
                  </label>
                  <span className="text-xs text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-semibold">
                    Recomendado
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Proprietário das Fazendas
                    </label>
                    <input
                      type="text"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      disabled={isProcessing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Nome do proprietário"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Barra de Progresso durante envio */}
          {isProcessing && (
            <div className="space-y-2 py-2">
              <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                <span className="flex items-center">
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin text-emerald-600" />
                  Processando arquivos KML e geometrias...
                </span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-emerald-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.max(uploadProgress, 10)}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Mensagem de Erro */}
          {errorMessage && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 rounded-r-lg text-sm flex items-start space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
          >
            {importResult ? 'Fechar' : 'Cancelar'}
          </button>

          {!importResult ? (
            <button
              type="button"
              onClick={handleStartImport}
              disabled={selectedFiles.length === 0 || isProcessing}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow-md hover:shadow-emerald-600/30 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>Importando...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Importar {selectedFiles.length > 0 ? `(${selectedFiles.length} KMLs)` : ''}</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow-md transition-all flex items-center space-x-2"
            >
              <Check className="w-4 h-4" />
              <span>Concluído</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default KmlFolderImportModal;
