import React from 'react';
import { ExternalLink, Globe } from 'lucide-react';

const CromaiAtlas: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Globe className="w-7 h-7 text-green-600 mr-3" />
          <div>
            <h2 className="text-2xl font-bold text-gray-800">CROMAI ATLAS</h2>
            <p className="text-gray-600">Plataforma integrada de análise agrícola</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <a
            href="https://atlas.cromai.com/login"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Abrir em Nova Aba
          </a>
        </div>
      </div>

      {/* Informações sobre a integração */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Globe className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
          <div className="text-sm text-blue-800">
            <h4 className="font-semibold mb-2">Sobre o CROMAI ATLAS:</h4>
            <ul className="space-y-1 text-blue-700">
              <li>• <strong>Plataforma Integrada:</strong> Sistema completo de análise e monitoramento agrícola</li>
              <li>• <strong>Dados em Tempo Real:</strong> Informações atualizadas sobre suas culturas</li>
              <li>• <strong>Análises Avançadas:</strong> Relatórios detalhados e insights inteligentes</li>
              <li>• <strong>Integração Completa:</strong> Conectado ao seu sistema AGROMAPS</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Container do iframe */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="p-4 bg-gray-50 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">CROMAI ATLAS - Plataforma</h3>
            <div className="flex items-center text-sm text-gray-600">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
              <span>Conectado</span>
            </div>
          </div>
        </div>
        
        <div className="relative">
          <iframe
            src="https://atlas.cromai.com/login"
            className="w-full h-[800px] border-0"
            title="CROMAI ATLAS"
            allow="fullscreen"
            loading="lazy"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation"
          />
          
          {/* Overlay de carregamento */}
          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center pointer-events-none opacity-0 transition-opacity duration-300" id="iframe-loading">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
              <p className="text-gray-600">Carregando CROMAI ATLAS...</p>
            </div>
          </div>
        </div>
      </div>

      {/* Informações adicionais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
              <span className="text-green-600 font-bold">A</span>
            </div>
            <h4 className="font-semibold text-gray-800">Análises</h4>
          </div>
          <p className="text-sm text-gray-600">
            Relatórios detalhados sobre produtividade, saúde das culturas e recomendações.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
              <span className="text-blue-600 font-bold">M</span>
            </div>
            <h4 className="font-semibold text-gray-800">Monitoramento</h4>
          </div>
          <p className="text-sm text-gray-600">
            Acompanhamento em tempo real das condições climáticas e do desenvolvimento das culturas.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-3">
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
              <span className="text-purple-600 font-bold">I</span>
            </div>
            <h4 className="font-semibold text-gray-800">Insights</h4>
          </div>
          <p className="text-sm text-gray-600">
            Inteligência artificial aplicada para otimização de processos e tomada de decisões.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CromaiAtlas;