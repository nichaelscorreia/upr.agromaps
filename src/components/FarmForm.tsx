import React, { useState } from 'react';
import { Building2, User, Plus } from 'lucide-react';

interface FarmFormProps {
  onFarmCreated: (farmId: string, farmName: string, ownerName: string) => void;
  onCancel?: () => void;
  isCreating?: boolean;
}

const FarmForm: React.FC<FarmFormProps> = ({ onFarmCreated, onCancel, isCreating }) => {
  const [farmName, setFarmName] = useState('');
  const [ownerName, setOwnerName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (farmName.trim() && ownerName.trim()) {
      onFarmCreated('temp-id', farmName, ownerName);
      setFarmName('');
      setOwnerName('');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center mb-6">
        <Building2 className="w-6 h-6 text-green-600 mr-3" />
        <h2 className="text-xl font-bold text-gray-800">Criar Nova Fazenda</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nome da Fazenda
          </label>
          <input
            type="text"
            value={farmName}
            onChange={(e) => setFarmName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="Ex: Fazenda Santa Maria"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <User className="w-4 h-4 inline mr-1" />
            Proprietário
          </label>
          <input
            type="text"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="Ex: João Silva"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isCreating || !farmName.trim() || !ownerName.trim()}
          className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isCreating ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          ) : (
            <Plus className="w-4 h-4 mr-2" />
          )}
          {isCreating ? 'Criando...' : 'Criar Fazenda'}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="w-full mt-3 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Cancelar
          </button>
        )}
      </form>
    </div>
  );
};

export default FarmForm;