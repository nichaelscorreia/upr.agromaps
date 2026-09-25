import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText } from 'lucide-react';

interface FileUploadProps {
  onFileUpload?: (file: File) => void;
  onMultipleFileUpload?: (files: File[]) => void;
  isUploading?: boolean;
  multiple?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ 
  onFileUpload, 
  onMultipleFileUpload, 
  isUploading,
  multiple = false 
}) => {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      if (multiple && onMultipleFileUpload) {
        onMultipleFileUpload(acceptedFiles);
      } else if (onFileUpload) {
        onFileUpload(acceptedFiles[0]);
      }
    }
  }, [onFileUpload, onMultipleFileUpload, multiple]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.google-earth.kml+xml': ['.kml'],
      'application/xml': ['.kml']
    },
    multiple: multiple
  });

  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
        ${isDragActive 
          ? 'border-green-500 bg-green-50' 
          : 'border-gray-300 hover:border-green-400 hover:bg-green-50'
        }
        ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <input {...getInputProps()} disabled={isUploading} />
      
      <div className="flex flex-col items-center space-y-3">
        {isUploading ? (
          <div className="animate-spin">
            <Upload className="w-8 h-8 text-green-500" />
          </div>
        ) : (
          <FileText className="w-8 h-8 text-gray-400" />
        )}
        
        <div>
          {isUploading ? (
            <p className="text-green-600 font-medium">
              {multiple ? 'Processando arquivos KML...' : 'Processando arquivo KML...'}
            </p>
          ) : isDragActive ? (
            <p className="text-green-600 font-medium">
              {multiple ? 'Solte os arquivos KML aqui...' : 'Solte o arquivo KML aqui...'}
            </p>
          ) : (
            <div>
              <p className="text-gray-600 font-medium">
                {multiple 
                  ? 'Arraste vários arquivos KML ou clique para selecionar' 
                  : 'Arraste um arquivo KML ou clique para selecionar'
                }
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {multiple 
                  ? 'Selecione múltiplos arquivos .kml (um por lote)' 
                  : 'Apenas arquivos .kml são aceitos'
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileUpload;