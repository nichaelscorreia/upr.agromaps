import React, { useState } from 'react';
import { User, Lock, UserPlus, LogIn, AlertCircle } from 'lucide-react';
import { login, register } from '../services/api';

interface LoginFormProps {
  onLogin: (user: { id: string; name: string; email: string }) => void;
  isLoading?: boolean;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin, isLoading: externalLoading }) => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [formData, setFormData] = useState({
    login: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(''); // Limpar erro ao digitar
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const loginTrimmed = formData.login.trim();
    const passwordTrimmed = formData.password;

    if (!loginTrimmed) {
      setError('Por favor, informe seu usuário ou email.');
      return;
    }

    if (!passwordTrimmed) {
      setError('Por favor, informe sua senha.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isLoginMode) {
        const result = await login(loginTrimmed, passwordTrimmed);
        if (result.success && result.user) {
          onLogin(result.user);
        } else {
          setError(result.message || 'Usuário ou senha incorretos.');
        }
      } else {
        const result = await register(loginTrimmed, loginTrimmed, passwordTrimmed);
        if (result.success && result.user) {
          onLogin(result.user);
        } else {
          setError(result.message || 'Erro ao criar conta.');
        }
      }
    } catch (err: any) {
      console.error('Erro na autenticação:', err);
      const serverMsg = err.response?.data?.error || err.response?.data?.message;
      if (serverMsg) {
        setError(serverMsg);
      } else if (err.message === 'Network Error' || !err.response) {
        setError('Não foi possível conectar ao servidor. Verifique se o backend está rodando.');
      } else {
        setError('Ocorreu um erro ao processar sua solicitação.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
    setError('');
    setFormData({ login: '', password: '' });
  };

  const isLoading = externalLoading || isSubmitting;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-emerald-800 to-green-950 flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-500/20 backdrop-blur-sm border border-emerald-400/30 rounded-2xl shadow-xl mb-4">
            <User className="w-10 h-10 text-emerald-300" />
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-wider">AGROMAPS</h1>
          <p className="text-emerald-200 text-sm mt-1">Sistema Integrado de Mapeamento Agrícola</p>
        </div>

        {/* Form Card */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-white/20">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              {isLoginMode ? 'Acessar o Sistema' : 'Criar Novo Usuário'}
            </h2>
            <p className="text-gray-600 text-sm mt-1">
              {isLoginMode 
                ? 'Entre com seu login e senha para gerenciar suas fazendas' 
                : 'Cadastro simplificado com apenas login e senha'
              }
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Login / Usuário
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  name="login"
                  value={formData.login}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-gray-800 placeholder-gray-400 bg-gray-50 focus:bg-white"
                  placeholder="Ex: seu_usuario ou seu@email.com"
                  autoComplete="username"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-gray-800 placeholder-gray-400 bg-gray-50 focus:bg-white"
                  placeholder="Digite sua senha"
                  autoComplete={isLoginMode ? "current-password" : "new-password"}
                  required
                  minLength={3}
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 rounded-r-lg text-sm flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 px-4 rounded-xl shadow-lg hover:shadow-emerald-600/30 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-semibold text-base"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                  <span>Processando...</span>
                </>
              ) : isLoginMode ? (
                <>
                  <LogIn className="w-5 h-5 mr-2" />
                  <span>Entrar</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5 mr-2" />
                  <span>Criar Conta</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <button
              type="button"
              onClick={toggleMode}
              className="text-emerald-700 hover:text-emerald-800 font-medium text-sm transition-colors"
            >
              {isLoginMode 
                ? 'Não tem cadastro? Clique aqui para criar usuário' 
                : 'Já tem cadastro? Clique aqui para entrar'
              }
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-6 text-center text-xs text-emerald-300/80">
          <p>AgroMaps - Plataforma de Gestão e Monitoramento de Lotes Agrícolas</p>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;