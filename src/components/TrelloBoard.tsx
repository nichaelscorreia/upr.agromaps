import React, { useState, useEffect, useCallback } from 'react';
import { Plus, User, Calendar, Edit, Trash2, Users, UserPlus, X, Check, Filter } from 'lucide-react';
import { getTasks, createTask, updateTask, deleteTask, getEmployees, createEmployee, deleteEmployee, Task, Employee } from '../services/api';

const TrelloBoard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const columns = [
    { id: 'todo', title: 'Pronto Para Iniciar', color: 'bg-blue-50 border-blue-200' },
    { id: 'in_progress', title: 'Em Execução', color: 'bg-yellow-50 border-yellow-200' },
    { id: 'validation', title: 'Em Validação', color: 'bg-purple-50 border-purple-200' },
    { id: 'done', title: 'Finalizado', color: 'bg-green-50 border-green-200' }
  ];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Filtrar tarefas baseado no funcionário selecionado
    if (selectedEmployeeId === 'all') {
      setFilteredTasks(tasks);
    } else {
      setFilteredTasks(tasks.filter(task => task.assigned_to === selectedEmployeeId));
    }
  }, [tasks, selectedEmployeeId]);

  const loadData = async () => {
    try {
      const [tasksData, employeesData] = await Promise.all([
        getTasks(),
        getEmployees()
      ]);
      setTasks(tasksData);
      setEmployees(employeesData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isTaskOverdue = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    return due < today;
  };

  const getEmployeeName = (employeeId: string) => {
    const employee = employees.find(emp => emp.id === employeeId);
    return employee ? employee.name : 'Funcionário não encontrado';
  };

  const handleCreateTask = async (taskData: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => {
    setIsSubmitting(true);
    try {
      await createTask(taskData.title, taskData.description, taskData.assigned_to, taskData.due_date, taskData.status);
      await loadData();
      setShowTaskModal(false);
    } catch (error) {
      console.error('Erro ao criar tarefa:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      await updateTask(taskId, updates);
      await loadData();
      setEditingTask(null);
    } catch (error) {
      console.error('Erro ao atualizar tarefa:', error);
    }
  };

  const handleDeleteTask = async (taskId: string, taskTitle: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir a tarefa "${taskTitle}"?`)) {
      return;
    }
    
    try {
      await deleteTask(taskId);
      await loadData();
    } catch (error) {
      console.error('Erro ao deletar tarefa:', error);
    }
  };

  const handleCreateEmployee = async (employeeData: { name: string; role: string; email?: string }) => {
    setIsSubmitting(true);
    try {
      await createEmployee(employeeData.name, employeeData.role, employeeData.email);
      await loadData();
      setShowEmployeeModal(false);
    } catch (error) {
      console.error('Erro ao criar funcionário:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEmployee = async (employeeId: string, employeeName: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o funcionário "${employeeName}"?`)) {
      return;
    }
    
    try {
      await deleteEmployee(employeeId);
      await loadData();
    } catch (error) {
      console.error('Erro ao deletar funcionário:', error);
    }
  };

  const moveTask = async (taskId: string, newStatus: string) => {
    await handleUpdateTask(taskId, { status: newStatus as Task['status'] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        <span className="ml-3 text-gray-600">Carregando tarefas...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Gestão de Tarefas</h2>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowEmployeeModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center"
          >
            <Users className="w-4 h-4 mr-2" />
            Funcionários ({employees.length})
          </button>
          <button
            onClick={() => setShowTaskModal(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Tarefa
          </button>
        </div>
      </div>

      {/* Filtro por Funcionário */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <Filter className="w-5 h-5 text-gray-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-800">Filtros</h3>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filtrar por Funcionário
              </label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="all">Todos os Funcionários ({tasks.length} tarefas)</option>
                {employees.map(employee => {
                  const employeeTasks = tasks.filter(task => task.assigned_to === employee.id);
                  return (
                    <option key={employee.id} value={employee.id}>
                      {employee.name} ({employeeTasks.length} tarefas)
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
          
          <div className="text-sm text-gray-600">
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-100 rounded mr-2"></div>
                <span>{filteredTasks.filter(task => task.status === 'todo').length} Pronto</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-yellow-100 rounded mr-2"></div>
                <span>{filteredTasks.filter(task => task.status === 'in_progress').length} Execução</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-purple-100 rounded mr-2"></div>
                <span>{filteredTasks.filter(task => task.status === 'validation').length} Validação</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-100 rounded mr-2"></div>
                <span>{filteredTasks.filter(task => task.status === 'done').length} Finalizado</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {columns.map((column) => (
          <div key={column.id} className={`rounded-lg border-2 ${column.color} p-4`}>
            <h3 className="font-semibold text-gray-800 mb-4 text-center">{column.title}</h3>
            <div className="space-y-3">
              {filteredTasks
                .filter(task => task.status === column.id)
                .map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    employeeName={getEmployeeName(task.assigned_to)}
                    isOverdue={isTaskOverdue(task.due_date)}
                    onEdit={() => setEditingTask(task)}
                    onDelete={() => handleDeleteTask(task.id, task.title)}
                    onMove={moveTask}
                    columns={columns}
                  />
                ))}
              {filteredTasks.filter(task => task.status === column.id).length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  <div className="text-sm">Nenhuma tarefa</div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Task Modal */}
      {showTaskModal && (
        <TaskModal
          employees={employees}
          onSubmit={handleCreateTask}
          onClose={() => setShowTaskModal(false)}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <TaskModal
          employees={employees}
          task={editingTask}
          onSubmit={(taskData) => handleUpdateTask(editingTask.id, taskData)}
          onClose={() => setEditingTask(null)}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Employee Modal */}
      {showEmployeeModal && (
        <EmployeeModal
          employees={employees}
          onCreateEmployee={handleCreateEmployee}
          onDeleteEmployee={handleDeleteEmployee}
          onClose={() => setShowEmployeeModal(false)}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
};

// Task Card Component
interface TaskCardProps {
  task: Task;
  employeeName: string;
  isOverdue: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (taskId: string, newStatus: string) => void;
  columns: { id: string; title: string; color: string }[];
}

const TaskCard: React.FC<TaskCardProps> = ({ task, employeeName, isOverdue, onEdit, onDelete, onMove, columns }) => {
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  return (
    <div className={`bg-white rounded-lg p-4 shadow-sm border ${isOverdue ? 'border-orange-300 bg-orange-50' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-gray-800 text-sm">{task.title}</h4>
        <div className="flex items-center space-x-1">
          <button
            onClick={onEdit}
            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
            title="Editar"
          >
            <Edit className="w-3 h-3" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
            title="Excluir"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
      
      {task.description && (
        <p className="text-xs text-gray-600 mb-3">{task.description}</p>
      )}
      
      <div className="space-y-2">
        <div className="flex items-center text-xs text-gray-500">
          <User className="w-3 h-3 mr-1" />
          <span>{employeeName}</span>
        </div>
        
        <div className={`flex items-center text-xs ${isOverdue ? 'text-orange-600 font-medium' : 'text-gray-500'}`}>
          <Calendar className="w-3 h-3 mr-1" />
          <span>{new Date(task.due_date).toLocaleDateString('pt-BR')}</span>
          {isOverdue && <span className="ml-1">(Atrasado)</span>}
        </div>
      </div>

      {/* Move Task Menu */}
      <div className="mt-3 relative">
        <button
          onClick={() => setShowMoveMenu(!showMoveMenu)}
          className="w-full text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-1 px-2 rounded transition-colors"
        >
          Mover para...
        </button>
        
        {showMoveMenu && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10">
            {columns
              .filter(col => col.id !== task.status)
              .map(col => (
                <button
                  key={col.id}
                  onClick={() => {
                    onMove(task.id, col.id);
                    setShowMoveMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {col.title}
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Task Modal Component
interface TaskModalProps {
  employees: Employee[];
  task?: Task;
  onSubmit: (taskData: any) => void;
  onClose: () => void;
  isSubmitting: boolean;
}

const TaskModal: React.FC<TaskModalProps> = ({ employees, task, onSubmit, onClose, isSubmitting }) => {
  const [formData, setFormData] = useState({
    title: task?.title || '',
    description: task?.description || '',
    assigned_to: task?.assigned_to || '',
    due_date: task?.due_date || '',
    status: task?.status || 'todo'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.title && formData.assigned_to && formData.due_date) {
      onSubmit(formData);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">
            {task ? 'Editar Tarefa' : 'Nova Tarefa'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Ex: Irrigar lote 5"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              rows={3}
              placeholder="Detalhes da tarefa..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
            <select
              value={formData.assigned_to}
              onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            >
              <option value="">Selecione um funcionário</option>
              {employees.map(employee => (
                <option key={employee.id} value={employee.id}>
                  {employee.name} - {employee.role}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prazo</label>
            <input
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="todo">Pronto Para Iniciar</option>
              <option value="in_progress">Em Execução</option>
              <option value="validation">Em Validação</option>
              <option value="done">Finalizado</option>
            </select>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              {isSubmitting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              {isSubmitting ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Employee Modal Component
interface EmployeeModalProps {
  employees: Employee[];
  onCreateEmployee: (employeeData: { name: string; role: string; email?: string }) => void;
  onDeleteEmployee: (employeeId: string, employeeName: string) => void;
  onClose: () => void;
  isSubmitting: boolean;
}

const EmployeeModal: React.FC<EmployeeModalProps> = ({ employees, onCreateEmployee, onDeleteEmployee, onClose, isSubmitting }) => {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    email: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.role) {
      onCreateEmployee(formData);
      setFormData({ name: '', role: '', email: '' });
      setShowForm(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Gerenciar Funcionários</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add Employee Button */}
        <div className="mb-4">
          <button
            onClick={() => setShowForm(!showForm)}
            className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors flex items-center justify-center"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Adicionar Funcionário
          </button>
        </div>

        {/* Add Employee Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Nome do funcionário"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                <input
                  type="text"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Ex: Operador de Irrigação"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email (opcional)</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Employees List */}
        <div className="space-y-2">
          <h4 className="font-medium text-gray-700">Funcionários ({employees.length})</h4>
          {employees.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <Users className="w-12 h-12 mx-auto text-gray-300 mb-2" />
              <p>Nenhum funcionário cadastrado</p>
            </div>
          ) : (
            employees.map(employee => (
              <div key={employee.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium text-gray-800">{employee.name}</div>
                  <div className="text-sm text-gray-600">{employee.role}</div>
                  {employee.email && (
                    <div className="text-xs text-gray-500">{employee.email}</div>
                  )}
                </div>
                <button
                  onClick={() => onDeleteEmployee(employee.id, employee.name)}
                  className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                  title="Excluir funcionário"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TrelloBoard;