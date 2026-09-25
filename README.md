# AGROMAPS - Sistema de Mapeamento Agrícola

Sistema completo para visualização e gerenciamento de fazendas através de mapas interativos com integração Google Sheets.

## Funcionalidades

- **Google Maps integrado** com visualização satélite
- **Upload de arquivos KML** para delimitação de lotes
- **Integração Google Sheets** para dados dos lotes, frota e abastecimento
- **Análise de Frota** com rastreamento de veículos em tempo real
- **Análise de Abastecimento** com autonomia e consumo
- **Painel Gerencial** com edição de dados dos lotes
- **Sistema de Tarefas** (Kanban) para gerenciamento de atividades
- **Análise Satelital** com mapas de calor (NDVI)
- **Login/Autenticação** via JWT
- **Design responsivo** para desktop e mobile

## Configuração

### Backend (Flask)

1. Instalar dependências:
```bash
pip install -r requirements.txt
```

2. Executar backend:
```bash
python app.py
```

O servidor iniciará em `http://127.0.0.1:5000`

### Frontend (React)

1. Instalar dependências:
```bash
npm install
```

2. Executar frontend:
```bash
npm run dev
```

O servidor iniciará em `http://localhost:5173`

## Estrutura

```
/src/components/    - Componentes React
/src/services/      - APIs e serviços (api.ts, googleMapsManager.ts)
app.py              - Backend Flask
requirements.txt    - Dependências Python
agromaps_*.json     - Dados persistentes (auth, employees, tasks, harvest)
```

## APIs

### Autenticação
- `POST /api/register` - Registrar novo usuário
- `POST /api/login` - Login do usuário
- `POST /api/logout` - Logout
- `GET /api/check-auth` - Verificar autenticação

### Fazendas
- `POST /api/create-farm` - Criar nova fazenda
- `GET /api/get-farms` - Listar fazendas do usuário
- `GET /api/get-farm-lots/<farm_id>` - Listar lotes de uma fazenda
- `GET /api/get-all-lots` - Buscar todos os lotes (mapa geral)
- `GET /api/get-lot-info/<lot_id>` - Informações detalhadas de um lote
- `POST /api/upload-lot/<farm_id>` - Upload de KML para criar lote
- `DELETE /api/delete-farm/<farm_id>` - Deletar fazenda
- `DELETE /api/delete-lot/<lot_id>` - Deletar lote

### Funcionários
- `GET /api/employees` - Listar funcionários
- `POST /api/employees` - Criar funcionário
- `DELETE /api/employees/<employee_id>` - Deletar funcionário

### Tarefas
- `GET /api/tasks` - Listar tarefas
- `POST /api/tasks` - Criar tarefa
- `PUT /api/tasks/<task_id>` - Atualizar tarefa
- `DELETE /api/tasks/<task_id>` - Deletar tarefa

### Frota e Abastecimento
- `GET /api/vehicles` - Dados da frota (Google Sheets)
- `GET /api/fuel-data` - Dados de abastecimento
- `PUT /api/vehicles/<vehicle_id>/location` - Atualizar localização

### Colheita
- `GET /api/harvest-status` - Status de colheita dos lotes
- `PUT /api/harvest-status/<lot_id>` - Atualizar status de colheita

### Painel Gerencial
- `GET /api/management/lots` - Listar lotes para gerenciamento
- `PUT /api/management/lots/<lot_id>` - Atualizar dados de lote

### Utilitários
- `GET /api/health` - Health check da API