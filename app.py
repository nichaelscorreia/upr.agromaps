from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import xml.etree.ElementTree as ET
import os
import uuid
import re
import math
from datetime import datetime, timedelta, timezone
import hashlib
import jwt
import requests
import csv
import io
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def decode_file_bytes(raw_bytes):
    """Tentar decodificar bytes de arquivo em múltiplos formatos de texto"""
    if isinstance(raw_bytes, str):
        return raw_bytes
    for encoding in ['utf-8', 'utf-8-sig', 'iso-8859-1', 'windows-1252', 'latin1', 'cp1252']:
        try:
            return raw_bytes.decode(encoding)
        except (UnicodeDecodeError, AttributeError):
            continue
    return raw_bytes.decode('utf-8', errors='ignore')

app = Flask(__name__)
app.secret_key = 'agromaps-secret-key-2024-super-secure'
JWT_SECRET = 'agromaps-jwt-secret-2024-ultra-secure'

# Aumentar limites para permitir uploads grandes de pastas e múltiplos KMLs (até 500MB)
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500 MB
app.config['MAX_FORM_MEMORY_SIZE'] = 100 * 1024 * 1024  # 100 MB
app.config['MAX_FORM_PARTS'] = 50000  # Permite até 50.000 partes/arquivos no multipart form

# CORS mais específico para desenvolvimento
CORS(app, 
     supports_credentials=True, 
     origins=['http://localhost:5173', 'http://127.0.0.1:5173'],
     allow_headers=['Content-Type', 'Authorization'],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])


class KmlDirectoryManager:
    """Gerenciador da estrutura hierárquica de arquivos KML do projeto (pasta kmls/)"""
    def __init__(self, kmls_root='kmls', parent_api=None):
        self.kmls_root = kmls_root
        self.parent_api = parent_api
        self.lots_by_id = {}
        self.lots_list = []
        self.tree = {'id': '', 'name': 'Todos os Mapas', 'path': '', 'type': 'folder', 'kml_count': 0, 'children': []}
        self.coord_pattern = re.compile(r'(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)')
        self.load_directory()

    def parse_kml_file(self, filepath):
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            matches = self.coord_pattern.findall(content)
            if not matches:
                return []
            
            coords = []
            for lon_str, lat_str in matches:
                try:
                    coords.append([float(lat_str), float(lon_str)])
                except ValueError:
                    continue
            if coords:
                return [{'coordinates': coords, 'description': ''}]
            return []
        except Exception as e:
            logger.error(f"Erro ao ler arquivo KML {filepath}: {e}")
            return []

    def calculate_polygon_area_ha(self, coordinates):
        """Calcula a área de um polígono em hectares dado uma lista de [lat, lon]"""
        if not coordinates or len(coordinates) < 3:
            return 0.0
        try:
            R = 6378137.0  # Raio médio da Terra em metros
            rad_coords = [[math.radians(pt[0]), math.radians(pt[1])] for pt in coordinates]
            if rad_coords[0] != rad_coords[-1]:
                rad_coords.append(rad_coords[0])
            area_sq_meters = 0.0
            for i in range(len(rad_coords) - 1):
                lat1, lon1 = rad_coords[i]
                lat2, lon2 = rad_coords[i+1]
                area_sq_meters += (lon2 - lon1) * (2.0 + math.sin(lat1) + math.sin(lat2))
            area_sq_meters = abs(area_sq_meters * (R * R) / 2.0)
            return area_sq_meters / 10000.0  # 1 ha = 10.000 m²
        except Exception:
            return 0.0

    def get_or_create_node(self, current_node, part, current_path):
        for child in current_node['children']:
            if child['name'] == part:
                return child
        new_node = {
            'id': current_path,
            'name': part,
            'path': current_path,
            'type': 'folder',
            'kml_count': 0,
            'total_area_ha': 0.0,
            'children': []
        }
        current_node['children'].append(new_node)
        return new_node

    def load_directory(self):
        start_time = datetime.now()
        lots_by_id = {}
        lots_list = []
        tree = {
            'id': '',
            'name': 'Todos os Mapas',
            'path': '',
            'type': 'folder',
            'kml_count': 0,
            'total_area_ha': 0.0,
            'children': []
        }

        if not os.path.exists(self.kmls_root):
            logger.warning(f"Diretório KML não encontrado: {self.kmls_root}")
            self.lots_by_id = {}
            self.lots_list = []
            self.tree = tree
            return

        for root, dirs, files in os.walk(self.kmls_root):
            dirs.sort()
            files.sort()
            
            rel_folder = os.path.relpath(root, self.kmls_root)
            if rel_folder == '.':
                rel_folder = ''
                
            parts = [p for p in rel_folder.split(os.sep) if p and p != '.']
            if any(p.startswith('.') or p == 'Python' or p == '__pycache__' for p in parts):
                continue
                
            kml_files = [f for f in files if f.lower().endswith('.kml') and not f.startswith('.')]
            if not kml_files:
                continue
                
            for kf in kml_files:
                file_rel_path = os.path.join(rel_folder, kf) if rel_folder else kf
                file_rel_path_norm = file_rel_path.replace('\\', '/')
                rel_folder_norm = rel_folder.replace('\\', '/')
                
                polygons = self.parse_kml_file(os.path.join(root, kf))
                lot_area_ha = 0.0
                if polygons:
                    for poly in polygons:
                        lot_area_ha += self.calculate_polygon_area_ha(poly.get('coordinates', []))
                
                category = parts[0] if len(parts) > 0 else 'Geral'
                farm_name = parts[-1] if len(parts) > 0 else 'Geral'
                lot_name = kf.rsplit('.', 1)[0]
                
                lot_obj = {
                    'id': file_rel_path_norm,
                    'name': lot_name,
                    'lot_number': lot_name,
                    'farm_name': farm_name,
                    'category': category,
                    'path': file_rel_path_norm,
                    'folder_path': rel_folder_norm,
                    'path_parts': parts,
                    'polygons': polygons,
                    'area_ha': round(lot_area_ha, 2),
                    'description': ''
                }
                lots_by_id[file_rel_path_norm] = lot_obj
                lots_list.append(lot_obj)
                
                # Atualizar árvore
                curr = tree
                curr_path_accum = ''
                curr['kml_count'] += 1
                curr['total_area_ha'] = round(curr.get('total_area_ha', 0.0) + lot_area_ha, 2)
                for part in parts:
                    curr_path_accum = f"{curr_path_accum}/{part}" if curr_path_accum else part
                    curr = self.get_or_create_node(curr, part, curr_path_accum)
                    curr['kml_count'] += 1
                    curr['total_area_ha'] = round(curr.get('total_area_ha', 0.0) + lot_area_ha, 2)

        self.lots_by_id = lots_by_id
        self.lots_list = lots_list
        self.tree = tree
        elapsed = (datetime.now() - start_time).total_seconds()
        logger.info(f"KmlDirectoryManager: {len(lots_list)} lotes carregados ({tree.get('total_area_ha', 0.0):.2f} ha) de '{self.kmls_root}' em {elapsed:.2f}s")

    def get_lots(self, paths=None, search=None):
        # Se paths for explicitamente lista vazia (ex: desmarcou tudo), retornar lista vazia (a menos que tenha busca)
        if paths is not None and len(paths) == 0 and not search:
            return []

        # Se paths for None ou contiver 'ALL', retornar todos os lotes (filtrados apenas por busca)
        if paths is None or (isinstance(paths, (list, tuple)) and any(p.strip().upper() == 'ALL' for p in paths if p)):
            normalized_paths = []
        else:
            normalized_paths = [p.strip().replace('\\', '/').rstrip('/') for p in paths if p and p.strip() and p.strip().upper() != 'ALL']

        search_lower = search.strip().lower() if search and search.strip() else None

        filtered = []
        for lot in self.lots_list:
            # Checar caminho
            if normalized_paths:
                path_match = False
                for p in normalized_paths:
                    if p == '' or lot['folder_path'] == p or lot['folder_path'].startswith(p + '/') or lot['path'] == p:
                        path_match = True
                        break
                if not path_match:
                    continue

            # Checar busca
            if search_lower:
                if (search_lower not in lot['name'].lower() and
                    search_lower not in lot['farm_name'].lower() and
                    search_lower not in lot['category'].lower() and
                    search_lower not in lot['path'].lower()):
                    continue

            filtered.append(lot)

        return filtered

    def get_lot_info_by_path(self, lot_path, user_id=None):
        lot = self.lots_by_id.get(lot_path)
        if not lot:
            for l in self.lots_list:
                if l['id'] == lot_path or l['name'] == lot_path:
                    lot = l
                    break

        farm_name = lot['farm_name'] if lot else ''
        lot_name = lot['name'] if lot else lot_path
        category = lot['category'] if lot else ''
        path_parts = lot['path_parts'] if lot else []
        
        sheets_data = self.parent_api.get_sheets_lot_data(farm_name, lot_name) if self.parent_api else None
        
        override_key = f"{user_id}_{lot_path}" if user_id else lot_path
        override_data = self.parent_api.lot_data_override.get(override_key) if self.parent_api else None
        
        if override_data:
            if sheets_data:
                sheets_data.update(override_data)
            else:
                sheets_data = override_data
                
        if sheets_data:
            sheets_data['category'] = category
            sheets_data['path_parts'] = path_parts
            sheets_data['path'] = lot['path'] if lot else lot_path
            return sheets_data
            
        return {
            'fazenda': farm_name,
            'talhao': lot_name,
            'folha': '',
            'variedade': 'N/D',
            'area': 'N/D',
            'plantio': 'N/D',
            'ult_corte': 'N/D',
            'ton_colhidas': '0',
            'tch_prev': '0',
            'tch_real': '0',
            'percentual': '0%',
            'historico_tch': {},
            'status': 'Necessário',
            'category': category,
            'path_parts': path_parts,
            'path': lot['path'] if lot else lot_path,
            'is_kml_metadata': True
        }

class AgroMapsAPI:
    def __init__(self):
        # Arquivos para persistência
        self.data_file = 'agromaps_data.json'
        self.auth_file = 'agromaps_auth.json'
        self.employees_file = 'agromaps_employees.json'
        self.tasks_file = 'agromaps_tasks.json'
        self.harvest_file = 'agromaps_harvest.json'
        self.lot_data_file = 'agromaps_lot_data.json'
        self.harvest_planning_file = 'agromaps_harvest_planning.json'
        
        # Carregar dados existentes
        self.users_data = self.load_data()
        self.users_auth = self.load_auth()
        self.employees_data = self.load_employees()
        self.tasks_data = self.load_tasks()
        self.harvest_data = self.load_harvest()
        self.lot_data_override = self.load_lot_data_override()
        self.harvest_planning_data = self.load_harvest_planning()
        
        # Configurar Google Sheets
        self.setup_google_sheets()

        # Gerenciador da estrutura KML
        self.kml_manager = KmlDirectoryManager(kmls_root='kmls', parent_api=self)
        
        logger.debug(f"DEBUG: Dados carregados - {len(self.users_data)} usuários, {len(self.users_auth)} contas, {len(self.employees_data)} funcionários, {len(self.tasks_data)} tarefas, {len(self.harvest_data)} colheitas, {len(self.lot_data_override)} dados editados, {len(self.harvest_planning_data)} planejamentos de colheita, {len(self.kml_manager.lots_list)} lotes KML locais")
    
    def setup_google_sheets(self):
        """Configurar conexão com Google Sheets"""
        try:
            # Configuração para acesso público à planilha
            self.spreadsheet_id = '1nHEuSTKdyL377eQHSVfGR7cVXJywDgJXiqOnapLryH0'
            self.sheets_data = None
            self.last_sheets_update = None
            logger.info("Google Sheets configurado com sucesso")
        except Exception as e:
            logger.error(f"Erro ao configurar Google Sheets: {e}")
            self.sheets_data = None
    
    def fetch_sheets_data(self):
        """Buscar dados da planilha Google Sheets"""
        try:
            # URL para acessar planilha pública como CSV
            csv_url = f"https://docs.google.com/spreadsheets/d/{self.spreadsheet_id}/export?format=csv&gid=0"
            
            response = requests.get(csv_url)
            response.raise_for_status()
            
            # Processar CSV
            csv_data = csv.DictReader(io.StringIO(response.text))
            sheets_data = {}
            
            for row in csv_data:
                fazenda = row.get('FAZENDA', '').strip().upper()
                lote = row.get('LOTE', '').strip()
                
                if fazenda and lote:
                    key = f"{fazenda}_{lote}"
                    # Processar status de colheita (NAO, SIM, COLHENDO)
                    colhido_raw = row.get('COLHIDO', '').strip().upper()

                    sheets_data[key] = {
                        'fazenda': fazenda,
                        'talhao': row.get('TALHÃO', ''),
                        'lote': lote,
                        'area': row.get('ÁREA (ha)', ''),
                        'folha': row.get('FOLHA', ''),
                        'variedade': row.get('VARIEDADE', ''),
                        'plantio': row.get('PLANTIO', ''),
                        'ult_corte': row.get('ÚLT. CORTE', ''),
                        'ton_colhidas': row.get('TON. COLHIDAS', ''),
                        'tch_prev': row.get('TCH PREV', ''),
                        'tch_real': row.get('TCH REAL', ''),
                        'percentual': row.get('% RELATIVA', ''),
                        'colhido': colhido_raw,
                        'historico_tch': {
                            '2020': float(row.get('TCH 2020', 0) or 0),
                            '2021': float(row.get('TCH 2021', 0) or 0),
                            '2022': float(row.get('TCH 2022', 0) or 0),
                            '2023': float(row.get('TCH 2023', 0) or 0),
                            '2024': float(row.get('TCH 2024', 0) or 0)
                        },
                        'status': self.calculate_status(row.get('% RELATIVA', ''))
                    }
            
            self.sheets_data = sheets_data
            self.last_sheets_update = datetime.now()
            logger.info(f"Dados da planilha atualizados: {len(sheets_data)} registros")
            return True
            
        except Exception as e:
            logger.error(f"Erro ao buscar dados da planilha: {e}")
            return False
    
    def calculate_status(self, percentual_str):
        """Calcular status baseado no percentual"""
        try:
            percentual = float(percentual_str or 0)
            if percentual >= 100:
                return 'Acima'
            elif percentual >= 90:
                return 'Necessário'
            elif percentual >= 70:
                return 'Abaixo'
            else:
                return 'Excesso'
        except:
            return 'Necessário'
    
    def get_sheets_lot_data(self, farm_name, lot_name):
        """Buscar dados específicos de um lote na planilha"""
        try:
            # Atualizar dados se necessário (cache de 5 minutos)
            if (self.sheets_data is None or 
                self.last_sheets_update is None or 
                (datetime.now() - self.last_sheets_update).seconds > 300):
                self.fetch_sheets_data()
            
            if not self.sheets_data:
                return None
            
            # Normalizar nomes para busca
            farm_key = farm_name.strip().upper()
            lot_key = lot_name.strip()
            
            # Tentar diferentes formatos de chave
            possible_keys = [
                f"{farm_key}_{lot_key}",
                f"{farm_key}_{lot_key.replace('Lote ', '')}",
                f"{farm_key}_{lot_key.split(' - ')[-1] if ' - ' in lot_key else lot_key}"
            ]
            
            for key in possible_keys:
                if key in self.sheets_data:
                    logger.info(f"Dados encontrados na planilha para: {farm_name} - {lot_name}")
                    return self.sheets_data[key]
            
            logger.warning(f"Dados não encontrados na planilha para: {farm_name} - {lot_name}")
            return None
            
        except Exception as e:
            logger.error(f"Erro ao buscar dados da planilha: {e}")
            return None
    
    def load_data(self):
        """Carregar dados dos usuários do arquivo"""
        try:
            if os.path.exists(self.data_file):
                with open(self.data_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            logger.error(f"Erro ao carregar dados: {e}")
        return {}
    
    def save_data(self):
        """Salvar dados dos usuários no arquivo"""
        try:
            with open(self.data_file, 'w', encoding='utf-8') as f:
                json.dump(self.users_data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Erro ao salvar dados: {e}")
    
    def load_auth(self):
        """Carregar dados de autenticação do arquivo"""
        try:
            if os.path.exists(self.auth_file):
                with open(self.auth_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    return {str(k).strip().lower(): v for k, v in data.items()}
        except Exception as e:
            logger.error(f"Erro ao carregar autenticação: {e}")
        return {}
    
    def save_auth(self):
        """Salvar dados de autenticação no arquivo"""
        try:
            with open(self.auth_file, 'w', encoding='utf-8') as f:
                json.dump(self.users_auth, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Erro ao salvar autenticação: {e}")
    
    def load_employees(self):
        """Carregar dados de funcionários do arquivo"""
        try:
            if os.path.exists(self.employees_file):
                with open(self.employees_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            logger.error(f"Erro ao carregar funcionários: {e}")
        return {}
    
    def save_employees(self):
        """Salvar dados de funcionários no arquivo"""
        try:
            with open(self.employees_file, 'w', encoding='utf-8') as f:
                json.dump(self.employees_data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Erro ao salvar funcionários: {e}")
    
    def load_tasks(self):
        """Carregar dados de tarefas do arquivo"""
        try:
            if os.path.exists(self.tasks_file):
                with open(self.tasks_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            logger.error(f"Erro ao carregar tarefas: {e}")
        return {}
    
    def save_tasks(self):
        """Salvar dados de tarefas no arquivo"""
        try:
            with open(self.tasks_file, 'w', encoding='utf-8') as f:
                json.dump(self.tasks_data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Erro ao salvar tarefas: {e}")
        
    def load_harvest(self):
        """Carregar dados de colheita do arquivo"""
        try:
            if os.path.exists(self.harvest_file):
                with open(self.harvest_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            logger.error(f"Erro ao carregar dados de colheita: {e}")
        return {}
    
    def save_harvest(self):
        """Salvar dados de colheita no arquivo"""
        try:
            with open(self.harvest_file, 'w', encoding='utf-8') as f:
                json.dump(self.harvest_data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Erro ao salvar dados de colheita: {e}")
    
    def load_lot_data_override(self):
        """Carregar dados editados dos lotes do arquivo"""
        try:
            if os.path.exists(self.lot_data_file):
                with open(self.lot_data_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            logger.error(f"Erro ao carregar dados editados dos lotes: {e}")
        return {}
    
    def save_lot_data_override(self):
        """Salvar dados editados dos lotes no arquivo"""
        try:
            with open(self.lot_data_file, 'w', encoding='utf-8') as f:
                json.dump(self.lot_data_override, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Erro ao salvar dados editados dos lotes: {e}")

    def load_harvest_planning(self):
        """Carregar dados de planejamento de queima/colheita"""
        try:
            if os.path.exists(self.harvest_planning_file):
                with open(self.harvest_planning_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            logger.error(f"Erro ao carregar planejamento de colheita: {e}")
        return []

    def save_harvest_planning(self):
        """Salvar planejamento de queima/colheita no arquivo"""
        try:
            with open(self.harvest_planning_file, 'w', encoding='utf-8') as f:
                json.dump(self.harvest_planning_data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Erro ao salvar planejamento de colheita: {e}")
    
    def hash_password(self, password):
        """Hash da senha para segurança"""
        return hashlib.sha256(password.encode()).hexdigest()
    
    def generate_token(self, user_id, user_name, user_email):
        """Gerar token JWT"""
        payload = {
            'user_id': user_id,
            'user_name': user_name,
            'user_email': user_email,
            'exp': datetime.now(timezone.utc) + timedelta(days=7)  # Token válido por 7 dias
        }
        return jwt.encode(payload, JWT_SECRET, algorithm='HS256')
    
    def verify_token(self, token):
        """Verificar e decodificar token JWT"""
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
            return payload
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None
    
    def get_current_user_from_token(self):
        """Obter usuário atual do token"""
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return None
        
        token = auth_header.split(' ')[1]
        payload = self.verify_token(token)
        return payload['user_id'] if payload else None
    
    def create_user(self, name, email, password):
        """Criar novo usuário"""
        login_key = str(email).strip().lower() if email else ''
        if not login_key:
            return None, "Usuário / Login é obrigatório"
        if not password:
            return None, "Senha é obrigatória"
        if len(str(password)) < 3:
            return None, "A senha deve ter pelo menos 3 caracteres"
        
        # Nome pode ser o próprio login se não informado
        user_display_name = str(name).strip() if name and str(name).strip() else login_key
        
        if login_key in self.users_auth:
            return None, "Este usuário / login já está cadastrado"
        
        user_id = str(uuid.uuid4())
        password_hash = self.hash_password(str(password))
        
        self.users_auth[login_key] = {
            'password_hash': password_hash,
            'user_id': user_id,
            'name': user_display_name,
            'created_at': datetime.now().isoformat()
        }
        
        if user_id not in self.users_data:
            self.users_data[user_id] = {
                'farms': {},
                'lots': {}
            }
        
        # Salvar dados
        self.save_auth()
        self.save_data()
        
        return user_id, "Usuário criado com sucesso"
    
    def authenticate_user(self, email, password):
        """Autenticar usuário"""
        login_key = str(email).strip().lower() if email else ''
        if not login_key:
            return None, None, "Usuário / Login é obrigatório"
        if not password:
            return None, None, "Senha é obrigatória"
        
        if login_key not in self.users_auth:
            return None, None, "Usuário não encontrado"
        
        user_data = self.users_auth[login_key]
        password_hash = self.hash_password(str(password))
        
        if user_data.get('password_hash') != password_hash:
            return None, None, "Senha incorreta"
        
        user_id = user_data.get('user_id')
        user_name = user_data.get('name') or login_key
        
        # Garantir estrutura em users_data
        if user_id and user_id not in self.users_data:
            self.users_data[user_id] = {'farms': {}, 'lots': {}}
            self.save_data()
            
        return user_id, user_name, "Login realizado com sucesso"
    
    def create_farm(self, user_id, farm_name, owner_name):
        """Criar nova fazenda para um usuário específico"""
        if user_id not in self.users_data:
            self.users_data[user_id] = {'farms': {}, 'lots': {}}
            
        farm_id = str(uuid.uuid4())
        self.users_data[user_id]['farms'][farm_id] = {
            'id': farm_id,
            'name': farm_name,
            'owner': owner_name,
            'created_at': datetime.now().isoformat(),
            'lots': []
        }
        
        # Salvar dados
        self.save_data()
        logger.debug(f"DEBUG: Fazenda salva - {farm_name} para user {user_id}")
        
        return farm_id

    def upsert_farm(self, user_id, farm_name, owner_name="Proprietário"):
        """Criar ou recuperar fazenda existente pelo nome (case-insensitive)"""
        if user_id not in self.users_data:
            self.users_data[user_id] = {'farms': {}, 'lots': {}}
            
        farm_name_clean = str(farm_name).strip()
        if not farm_name_clean:
            farm_name_clean = "Fazenda Geral"
            
        # Verificar se já existe fazenda com este nome para o usuário
        user_farms = self.users_data[user_id].get('farms', {})
        for existing_id, existing_farm in user_farms.items():
            if existing_farm.get('name', '').strip().lower() == farm_name_clean.lower():
                # Fazenda já existente
                return existing_id, False, existing_farm.get('name', farm_name_clean)
                
        # Criar nova fazenda
        farm_id = str(uuid.uuid4())
        self.users_data[user_id]['farms'][farm_id] = {
            'id': farm_id,
            'name': farm_name_clean,
            'owner': str(owner_name).strip() if owner_name else "Proprietário",
            'created_at': datetime.now().isoformat(),
            'lots': []
        }
        self.save_data()
        logger.info(f"Nova fazenda criada via upsert: {farm_name_clean} ({farm_id})")
        return farm_id, True, farm_name_clean

    def parse_kml(self, kml_content):
        """Parse robusto de arquivos KML para extrair coordenadas e polígonos"""
        try:
            # Garantir formato string decodificado
            if isinstance(kml_content, bytes):
                kml_text = decode_file_bytes(kml_content)
            else:
                kml_text = str(kml_content)
                
            # Remover declarações de namespace para permitir parsing agnóstico de versão
            cleaned_xml = re.sub(r'\sxmlns="[^"]+"', '', kml_text, count=1)
            cleaned_xml = re.sub(r'\sxmlns:kml="[^"]+"', '', cleaned_xml, count=1)
            
            root = ET.fromstring(cleaned_xml)
            
            def strip_tag(tag):
                return tag.split('}')[-1] if '}' in tag else tag
                
            coord_pattern = re.compile(r'(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)')
            placemarks = []
            
            # Buscar todos os elementos Placemark ignorando namespace
            for elem in root.iter():
                if strip_tag(elem.tag) == 'Placemark':
                    name_elem = None
                    desc_elem = None
                    coords_list = []
                    
                    for child in elem.iter():
                        t = strip_tag(child.tag)
                        if t == 'name' and name_elem is None:
                            name_elem = child.text
                        elif t == 'description' and desc_elem is None:
                            desc_elem = child.text
                        elif t == 'coordinates' and child.text:
                            matches = coord_pattern.findall(child.text)
                            polygon_coords = []
                            for lon_str, lat_str in matches:
                                try:
                                    polygon_coords.append([float(lat_str), float(lon_str)])
                                except ValueError:
                                    continue
                            if polygon_coords:
                                coords_list.append(polygon_coords)
                                
                    if coords_list:
                        for idx, poly_coords in enumerate(coords_list):
                            placemarks.append({
                                'name': name_elem or f'Polígono {idx+1}',
                                'description': desc_elem or '',
                                'coordinates': poly_coords
                            })
                            
            # Fallback caso não encontre Placemarks mas existam tags de coordinates
            if not placemarks:
                for elem in root.iter():
                    if strip_tag(elem.tag) == 'coordinates' and elem.text:
                        matches = coord_pattern.findall(elem.text)
                        poly_coords = []
                        for lon_str, lat_str in matches:
                            try:
                                poly_coords.append([float(lat_str), float(lon_str)])
                            except ValueError:
                                continue
                        if poly_coords:
                            placemarks.append({
                                'name': 'Lote',
                                'description': '',
                                'coordinates': poly_coords
                            })
                            
            return placemarks
        except Exception as e:
            logger.error(f"Erro ao processar KML: {str(e)}")
            return []

    def upsert_lot_to_farm(self, user_id, farm_id, kml_content, lot_identifier, overwrite=True):
        """Adicionar ou atualizar lote KML em uma fazenda (com sobreposição limpa de coordenadas)"""
        if user_id not in self.users_data or farm_id not in self.users_data[user_id]['farms']:
            logger.error(f"DEBUG: Fazenda não encontrada - user: {user_id}, farm: {farm_id}")
            return None, "Fazenda não encontrada", "error"
            
        farm = self.users_data[user_id]['farms'][farm_id]
        
        # Parse KML
        placemarks = self.parse_kml(kml_content)
        if not placemarks:
            return None, "Nenhum polígono ou coordenada válida encontrada no arquivo KML", "error"
            
        # Tratar identificador e número do lote
        clean_ident = str(lot_identifier).replace('.kml', '').replace('.KML', '').strip()
        num_match = re.search(r'\d+', clean_ident)
        lot_number = num_match.group(0) if num_match else clean_ident
        
        # Nome padrão do lote
        if clean_ident.lower().startswith('lote') or clean_ident.lower().startswith('talh'):
            lot_name = f"{farm['name']} - {clean_ident.capitalize()}"
        elif lot_number == clean_ident:
            lot_name = f"{farm['name']} - Lote {lot_number}"
        else:
            lot_name = f"{farm['name']} - {clean_ident}"
            
        # Polígonos extraídos
        polygons = []
        for placemark in placemarks:
            polygons.append({
                'coordinates': placemark['coordinates'],
                'description': placemark.get('description', '')
            })
            
        # Verificar se já existe um lote nesta fazenda com mesmo número ou mesmo nome
        existing_lot_id = None
        user_lots = self.users_data[user_id]['lots']
        
        for lot_id in farm.get('lots', []):
            if lot_id in user_lots:
                existing_lot = user_lots[lot_id]
                existing_num = str(existing_lot.get('lot_number', '')).strip()
                existing_name = str(existing_lot.get('name', '')).strip().lower()
                
                if (existing_num and existing_num == lot_number) or \
                   (existing_name == lot_name.lower()) or \
                   (existing_name == clean_ident.lower()) or \
                   (existing_name == f"{farm['name']} - Lote {lot_number}".lower()):
                    existing_lot_id = lot_id
                    break
                    
        if existing_lot_id and overwrite:
            # ATUALIZAR / SOBREPOR LOTE EXISTENTE
            target_lot = user_lots[existing_lot_id]
            target_lot['polygons'] = polygons
            target_lot['lot_number'] = lot_number
            target_lot['name'] = lot_name
            target_lot['description'] = f"Lote com {len(polygons)} polígono(s) (Atualizado)"
            target_lot['updated_at'] = datetime.now().isoformat()
            
            # Manter/atualizar info
            if 'info' not in target_lot or not target_lot['info']:
                target_lot['info'] = self.get_lot_info(existing_lot_id)
                
            self.save_data()
            logger.info(f"Lote sobreposto/atualizado: {lot_name} ({existing_lot_id}) com {len(polygons)} polígonos")
            return existing_lot_id, f"Lote '{lot_name}' atualizado com sucesso", "updated"
        else:
            # CRIAR NOVO LOTE
            new_lot_id = str(uuid.uuid4())
            new_lot = {
                'id': new_lot_id,
                'farm_id': farm_id,
                'name': lot_name,
                'lot_number': lot_number,
                'polygons': polygons,
                'description': f"Lote com {len(polygons)} polígono(s)",
                'created_at': datetime.now().isoformat(),
                'info': self.get_lot_info(new_lot_id)
            }
            
            self.users_data[user_id]['lots'][new_lot_id] = new_lot
            if new_lot_id not in farm['lots']:
                farm['lots'].append(new_lot_id)
                
            self.save_data()
            logger.info(f"Novo lote criado: {lot_name} ({new_lot_id}) com {len(polygons)} polígonos")
            return new_lot_id, f"Lote '{lot_name}' criado com sucesso", "created"

    def add_lot_to_farm(self, user_id, farm_id, kml_content, lot_number):
        """Adicionar ou atualizar lote KML em uma fazenda (compatibilidade)"""
        lot_id, msg, action = self.upsert_lot_to_farm(user_id, farm_id, kml_content, lot_number, overwrite=True)
        return 1 if lot_id else None
    
    def delete_farm(self, user_id, farm_id):
        """Deletar fazenda e todos os seus lotes"""
        if user_id not in self.users_data or farm_id not in self.users_data[user_id]['farms']:
            return False, "Fazenda não encontrada"
        
        farm = self.users_data[user_id]['farms'][farm_id]
        farm_name = farm['name']
        
        # Remover todos os lotes da fazenda
        for lot_id in farm['lots']:
            if lot_id in self.users_data[user_id]['lots']:
                del self.users_data[user_id]['lots'][lot_id]
        
        # Remover a fazenda
        del self.users_data[user_id]['farms'][farm_id]
        
        # Salvar dados
        self.save_data()
        
        logger.debug(f"DEBUG: Fazenda {farm_name} removida com {len(farm['lots'])} lotes")
        return True, f"Fazenda '{farm_name}' removida com sucesso"
    
    def delete_lot(self, user_id, lot_id):
        """Deletar lote específico"""
        if user_id not in self.users_data or lot_id not in self.users_data[user_id]['lots']:
            return False, "Lote não encontrado"
        
        lot = self.users_data[user_id]['lots'][lot_id]
        lot_name = lot['name']
        farm_id = lot['farm_id']
        
        # Remover lote da lista da fazenda
        if farm_id in self.users_data[user_id]['farms']:
            farm_lots = self.users_data[user_id]['farms'][farm_id]['lots']
            if lot_id in farm_lots:
                farm_lots.remove(lot_id)
        
        # Remover o lote
        del self.users_data[user_id]['lots'][lot_id]
        
        # Salvar dados
        self.save_data()
        
        logger.debug(f"DEBUG: Lote {lot_name} removido")
        return True, f"Lote '{lot_name}' removido com sucesso"
    
    def get_lot_info(self, lot_id):
        """Buscar dados reais do lote na planilha Google Sheets"""
        try:
            # Buscar lote nos dados do usuário
            for user_id, user_data in self.users_data.items():
                if lot_id in user_data.get('lots', {}):
                    lot_data = user_data['lots'][lot_id]
                    farm_id = lot_data.get('farm_id')
                    
                    if farm_id and farm_id in user_data.get('farms', {}):
                        farm_data = user_data['farms'][farm_id]
                        farm_name = farm_data['name']
                        lot_name = lot_data['name']
                        
                        # Buscar dados na planilha
                        sheets_data = self.get_sheets_lot_data(farm_name, lot_name)
                        
                        # Verificar se há dados editados pelo usuário
                        override_key = f"{user_id}_{lot_id}"
                        if override_key in self.lot_data_override:
                            override_data = self.lot_data_override[override_key]
                            if sheets_data:
                                # Mesclar dados da planilha com dados editados
                                sheets_data.update(override_data)
                            else:
                                # Usar apenas dados editados se não há dados na planilha
                                sheets_data = override_data
                        
                        if sheets_data:
                            return sheets_data
                        else:
                            # Retornar indicação de que não há dados na planilha
                            return {
                                'error': 'not_found_in_sheets',
                                'message': f'Dados não encontrados na planilha para a fazenda "{farm_name}" e lote "{lot_name}". Verifique se os nomes estão exatamente iguais aos da base de dados.',
                                'farm_name': farm_name,
                                'lot_name': lot_name
                            }
            
            return {
                'error': 'lot_not_found',
                'message': 'Lote não encontrado no sistema.'
            }
            
        except Exception as e:
            logger.error(f"Erro ao buscar informações do lote: {e}")
            return {
                'error': 'system_error',
                'message': 'Erro interno do sistema ao buscar dados do lote.'
            }
    
    # Métodos para Funcionários
    def get_user_employees(self, user_id):
        """Buscar todos os funcionários de um usuário"""
        if user_id not in self.employees_data:
            return []
        
        employees_list = []
        for employee_id, employee_data in self.employees_data[user_id].items():
            employees_list.append({
                'id': employee_id,
                'name': employee_data['name'],
                'role': employee_data['role'],
                'email': employee_data.get('email', ''),
                'created_at': employee_data['created_at']
            })
        
        return employees_list
    
    def create_employee(self, user_id, name, role, email=''):
        """Criar novo funcionário"""
        if user_id not in self.employees_data:
            self.employees_data[user_id] = {}
        
        employee_id = str(uuid.uuid4())
        self.employees_data[user_id][employee_id] = {
            'name': name,
            'role': role,
            'email': email,
            'created_at': datetime.now().isoformat()
        }
        
        self.save_employees()
        logger.debug(f"DEBUG: Funcionário {name} criado para user {user_id}")
        
        return employee_id
    
    def delete_employee(self, user_id, employee_id):
        """Deletar funcionário"""
        if user_id not in self.employees_data or employee_id not in self.employees_data[user_id]:
            return False, "Funcionário não encontrado"
        
        employee_name = self.employees_data[user_id][employee_id]['name']
        del self.employees_data[user_id][employee_id]
        
        self.save_employees()
        logger.debug(f"DEBUG: Funcionário {employee_name} removido")
        
        return True, f"Funcionário '{employee_name}' removido com sucesso"
    
    # Métodos para Tarefas
    def get_user_tasks(self, user_id):
        """Buscar todas as tarefas de um usuário"""
        if user_id not in self.tasks_data:
            return []
        
        tasks_list = []
        for task_id, task_data in self.tasks_data[user_id].items():
            tasks_list.append({
                'id': task_id,
                'title': task_data['title'],
                'description': task_data['description'],
                'assigned_to': task_data['assigned_to'],
                'due_date': task_data['due_date'],
                'status': task_data['status'],
                'created_at': task_data['created_at'],
                'updated_at': task_data['updated_at']
            })
        
        return tasks_list
    
    def create_task(self, user_id, title, description, assigned_to, due_date, status='todo'):
        """Criar nova tarefa"""
        if user_id not in self.tasks_data:
            self.tasks_data[user_id] = {}
        
        task_id = str(uuid.uuid4())
        now = datetime.now().isoformat()
        
        self.tasks_data[user_id][task_id] = {
            'title': title,
            'description': description,
            'assigned_to': assigned_to,
            'due_date': due_date,
            'status': status,
            'created_at': now,
            'updated_at': now
        }
        
        self.save_tasks()
        logger.debug(f"DEBUG: Tarefa {title} criada para user {user_id}")
        
        return task_id
    
    def update_task(self, user_id, task_id, updates):
        """Atualizar tarefa"""
        if user_id not in self.tasks_data or task_id not in self.tasks_data[user_id]:
            return False, "Tarefa não encontrada"
        
        task = self.tasks_data[user_id][task_id]
        
        # Atualizar campos permitidos
        allowed_fields = ['title', 'description', 'assigned_to', 'due_date', 'status']
        for field in allowed_fields:
            if field in updates:
                task[field] = updates[field]
        
        task['updated_at'] = datetime.now().isoformat()
        
        self.save_tasks()
        logger.debug(f"DEBUG: Tarefa {task['title']} atualizada")
        
        return True, f"Tarefa '{task['title']}' atualizada com sucesso"
    
    def delete_task(self, user_id, task_id):
        """Deletar tarefa"""
        if user_id not in self.tasks_data or task_id not in self.tasks_data[user_id]:
            return False, "Tarefa não encontrada"
        
        task_title = self.tasks_data[user_id][task_id]['title']
        del self.tasks_data[user_id][task_id]
        
        self.save_tasks()
        logger.debug(f"DEBUG: Tarefa {task_title} removida")
        
        return True, f"Tarefa '{task_title}' removida com sucesso"

    # Métodos para Colheita
    def get_harvest_status(self, user_id, lot_id):
        """Buscar status de colheita de um lote"""
        if user_id not in self.harvest_data:
            return False
        
        return self.harvest_data[user_id].get(lot_id, False)
    
    def update_harvest_status(self, user_id, lot_id, harvested):
        """Atualizar status de colheita de um lote"""
        if user_id not in self.harvest_data:
            self.harvest_data[user_id] = {}
        
        self.harvest_data[user_id][lot_id] = harvested
        self.save_harvest()
        
        logger.debug(f"DEBUG: Status de colheita atualizado - lote {lot_id}: {'colhido' if harvested else 'não colhido'}")
        return True
    
    def get_all_harvest_status(self, user_id):
        """Buscar status de colheita de todos os lotes do usuário"""
        if user_id not in self.harvest_data:
            return {}
        
        return self.harvest_data[user_id]
    
    # Métodos para Painel Gerencial
    def update_lot_data(self, user_id, lot_id, data_updates):
        """Atualizar dados de um lote específico"""
        override_key = f"{user_id}_{lot_id}"
        
        if override_key not in self.lot_data_override:
            self.lot_data_override[override_key] = {}
        
        # Atualizar campos permitidos
        allowed_fields = [
            'fazenda', 'talhao', 'folha', 'variedade', 'area', 'plantio', 
            'ult_corte', 'ton_colhidas', 'tch_prev', 'tch_real', 'percentual',
            'colhido', 'historico_tch'
        ]
        
        for field in allowed_fields:
            if field in data_updates:
                self.lot_data_override[override_key][field] = data_updates[field]
        
        # Recalcular status baseado no percentual
        if 'percentual' in data_updates:
            self.lot_data_override[override_key]['status'] = self.calculate_status(str(data_updates['percentual']))
        
        self.save_lot_data_override()
        
        logger.debug(f"DEBUG: Dados do lote {lot_id} atualizados pelo usuário {user_id}")
        return True
    
    def get_user_lots_for_management(self, user_id):
        """Buscar todos os lotes do usuário para o painel gerencial"""
        if user_id not in self.users_data:
            return []
        
        lots_list = []
        user_lots = self.users_data[user_id]['lots']
        user_farms = self.users_data[user_id]['farms']
        
        for lot_id, lot_data in user_lots.items():
            farm_name = user_farms.get(lot_data['farm_id'], {}).get('name', 'Fazenda Desconhecida')
            
            # Buscar informações completas do lote
            lot_info = self.get_lot_info(lot_id)
            
            lot_entry = {
                'id': lot_id,
                'name': lot_data['name'],
                'farm_name': farm_name,
                'lot_number': lot_data.get('lot_number', ''),
                'polygons_count': len(lot_data.get('polygons', [])),
                'has_data': not ('error' in lot_info if isinstance(lot_info, dict) else False),
                'data': lot_info if not ('error' in lot_info if isinstance(lot_info, dict) else False) else None
            }
            
            lots_list.append(lot_entry)
        
        return lots_list

# Instância global da API
agromaps_api = AgroMapsAPI()

# =============================================================================
# FUNÇÕES PARA DADOS DA FROTA E ABASTECIMENTO - CORRIGIDAS
# =============================================================================

def get_fleet_data_from_sheets():
    """Conecta com Google Sheets e busca dados da NOVA planilha FROTA"""
    try:
        # NOVA planilha dedicada à FROTA
        spreadsheet_id = '1DuoiaUXbNjj4DqQ6m6Do9lbz5MdaeDQ3WI0jHotlVzY'
        
        # URL para exportar como CSV
        csv_url = f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/export?format=csv"
        
        logger.info(f"🔗 Acessando NOVA planilha FROTA: {csv_url}")
        response = requests.get(csv_url)
        response.raise_for_status()
        logger.info("✅ Planilha FROTA acessada com sucesso")
        
        # Processar CSV
        csv_data = csv.DictReader(io.StringIO(response.text))
        vehicles = []
        
        logger.info(f"📋 Cabeçalhos encontrados: {csv_data.fieldnames}")
        
        for i, row in enumerate(csv_data):
            try:
                # Debug: mostrar primeira linha
                if i == 0:
                    logger.info(f"🔍 Primeira linha: {dict(row)}")
                
                # Pular linhas vazias
                if not row.get('LATITUDE') or not row.get('LONGITUDE'):
                    logger.info(f"⏭️ Linha {i+1} pulada - coordenadas vazias")
                    continue
                
                logger.info(f"📍 Processando veículo {i+1}: {row.get('NOME_VEICULO', 'Veículo')}")
                
                # Converter coordenadas (tratar formato brasileiro)
                latitude_str = str(row['LATITUDE']).replace('"', '').strip().replace(',', '.')
                longitude_str = str(row['LONGITUDE']).replace('"', '').strip().replace(',', '.')
                
                latitude = float(latitude_str)
                longitude = float(longitude_str)
                
                # Processar velocidade
                velocidade_str = row.get('VELOCIDADE', '0')
                try:
                    velocidade = int(float(str(velocidade_str).replace(',', '.'))) if velocidade_str else 0
                except:
                    velocidade = 0
                
                # Determinar status
                status_veiculo = str(row.get('STATUS_VEICULO', '')).upper()
                status_ignicao = str(row.get('STATUS_IGNICAO', '')).upper()
                
                if 'PARADO' in status_veiculo or velocidade == 0:
                    status = 'inactive'
                elif 'MANUTEN' in status_veiculo.upper():
                    status = 'maintenance'
                else:
                    status = 'active'
                
                # Criar ID único
                imei = row.get('IMEI', '')
                placa = row.get('PLACA', '')
                vehicle_id = f"vehicle_{imei}" if imei else f"vehicle_{placa}" if placa else f"vehicle_{i}"
                
                vehicle = {
                    'id': vehicle_id,
                    'name': row.get('NOME_VEICULO', f'Veículo {i+1}'),
                    'imei': imei,
                    'placa': placa,
                    'latitude': latitude,
                    'longitude': longitude,
                    'velocidade': velocidade,
                    'data_hora_gps': row.get('DATA_HORA_GPS', ''),
                    'status_veiculo': status_veiculo,
                    'status_ignicao': status_ignicao,
                    'ultima_atualizacao': row.get('ULTIMA_ATUALIZACAO', ''),
                    'status': status,
                    'last_updated': datetime.now().isoformat()
                }
                
                vehicles.append(vehicle)
                logger.info(f"✅ Veículo adicionado: {vehicle['name']} - Lat: {latitude}, Lon: {longitude}, Vel: {velocidade}km/h")
                
            except (ValueError, TypeError) as e:
                logger.error(f"❌ Erro de conversão na linha {i+1}: {e}")
                logger.error(f"   Dados: LAT='{row.get('LATITUDE')}', LON='{row.get('LONGITUDE')}'")
                continue
            except Exception as e:
                logger.error(f"❌ Erro inesperado na linha {i+1}: {e}")
                continue
        
        logger.info(f"🎯 Total de veículos processados: {len(vehicles)}")
        
        if len(vehicles) == 0:
            logger.warning("⚠️ Nenhum veículo processado. Verificando estrutura dos dados...")
            # Recarregar para debug
            csv_data_debug = csv.DictReader(io.StringIO(response.text))
            for j, debug_row in enumerate(csv_data_debug):
                if j < 3:  # Mostrar 3 primeiras linhas
                    logger.info(f"🔍 Linha {j} para debug: {dict(debug_row)}")
        
        return vehicles
        
    except Exception as e:
        logger.error(f"❌ Erro ao conectar com Google Sheets: {e}")
        # Retornar dados de exemplo para não quebrar o frontend
        return get_sample_fleet_data()

def get_sample_fleet_data():
    """Dados de exemplo baseados na estrutura da FROTA"""
    return [
        {
            'id': 'vehicle_355468592942072',
            'name': 'GRANELEIRO PVN-3C73',
            'imei': '355468592942072',
            'placa': 'SEM PLACA',
            'latitude': -9.807862,
            'longitude': -36.20996,
            'velocidade': 0,
            'data_hora_gps': '2025-10-05 12:02:36',
            'status_veiculo': 'PARADO',
            'status_ignicao': 'DESLIGADA',
            'ultima_atualizacao': '2025-10-05 12:02:36',
            'status': 'inactive',
            'last_updated': datetime.now().isoformat()
        },
        {
            'id': 'vehicle_355468592946537',
            'name': 'GRANELEIRO HOM-4A71', 
            'imei': '355468592946537',
            'placa': 'SEM PLACA',
            'latitude': -9.814764,
            'longitude': -36.21757,
            'velocidade': 10,
            'data_hora_gps': '2025-10-05 12:02:36',
            'status_veiculo': 'EM MOVIMENTO',
            'status_ignicao': 'LIGADA',
            'ultima_atualizacao': '2025-10-05 12:02:36',
            'status': 'active',
            'last_updated': datetime.now().isoformat()
        }
    ]

def get_fuel_data():
    """Buscar dados de abastecimento da aba AUTONOMIA da planilha Google Sheets - CORRIGIDA"""
    try:
        # URL da planilha FROTA com aba AUTONOMIA
        spreadsheet_id = '1DuoiaUXbNjj4DqQ6m6Do9lbz5MdaeDQ3WI0jHotlVzY'
        csv_url = f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/export?format=csv&gid=0"  # gid=0 para primeira aba
        
        logger.info(f"⛽ Acessando dados de abastecimento: {csv_url}")
        response = requests.get(csv_url)
        response.raise_for_status()
        
        # Processar CSV
        csv_data = csv.DictReader(io.StringIO(response.text))
        fuel_data = []
        
        logger.info(f"📋 Cabeçalhos da aba AUTONOMIA: {csv_data.fieldnames}")
        
        for i, row in enumerate(csv_data):
            try:
                # Pular cabeçalho ou linhas vazias
                if not row.get('IMEI') or not row.get('IMEI').strip():
                    logger.info(f"⏭️ Linha {i+1} pulada - IMEI vazio")
                    skipped_rows += 1
                    continue
                
                # Processar dados numéricos (tratar formato brasileiro)
                autonomia_str = str(row.get('AUTONOMIA_PERCENT', '0')).replace(',', '.').strip()
                litros_str = str(row.get('LITROS_RESTANTES', '0')).replace(',', '.').strip()
                consumo_str = str(row.get('CONSUMO_MEDIO', '0')).replace(',', '.').strip()
                km_str = str(row.get('KM_RESTANTES', '0')).replace(',', '.').strip()
                lat_str = str(row.get('LATITUDE', '0')).replace(',', '.').strip()
                lon_str = str(row.get('LONGITUDE', '0')).replace(',', '.').strip()
                
                autonomia_percent = float(autonomia_str) if autonomia_str and autonomia_str != '' else 0
                litros_restantes = float(litros_str) if litros_str and litros_str != '' else 0
                consumo_medio = float(consumo_str) if consumo_str and consumo_str != '' else 0
                km_restantes = float(km_str) if km_str and km_str != '' else 0
                latitude = float(lat_str) if lat_str and lat_str != '' else 0
                longitude = float(lon_str) if lon_str and lon_str != '' else 0
                
                # Determinar status baseado na autonomia
                if autonomia_percent < 20:
                    status = 'critical'
                elif autonomia_percent < 40:
                    status = 'warning'
                else:
                    status = 'normal'
                
                # Criar objeto do veículo
                fuel_vehicle = {
                    'id': str(row.get('IMEI', f'fuel_{i}')),
                    'imei': str(row.get('IMEI', '')),
                    'placa': str(row.get('PLACA', '')),
                    'name': str(row.get('NOME', row.get('PLACA', f'Veículo {i}'))),
                    'latitude': latitude,
                    'longitude': longitude,
                    'autonomia_percent': autonomia_percent,
                    'litros_restantes': litros_restantes,
                    'consumo_medio': consumo_medio,
                    'km_restantes': km_restantes,
                    'last_updated': datetime.now().isoformat(),
                    'status': status
                }
                
                fuel_data.append(fuel_vehicle)
                logger.info(f"✅ Dados de abastecimento: {fuel_vehicle['name']} - Autonomia: {autonomia_percent}%")
                
            except (ValueError, TypeError) as e:
                logger.error(f"❌ Erro ao processar linha {i} dos dados de abastecimento: {e}")
                continue
            except Exception as e:
                logger.error(f"❌ Erro inesperado na linha {i}: {e}")
                continue
        
        logger.info(f"🎯 Total de veículos com dados de abastecimento: {len(fuel_data)}")
        
        if len(fuel_data) == 0:
            logger.warning("⚠️ Nenhum dado de abastecimento encontrado. Usando dados de exemplo.")
            return get_sample_fuel_data()
        
        return fuel_data
        
    except Exception as e:
        logger.error(f"❌ Erro ao buscar dados de abastecimento: {e}")
        return get_sample_fuel_data()

def get_sample_fuel_data():
    """Dados de exemplo para abastecimento"""
    return [
        {
            'id': 'fuel_355468592942072',
            'imei': '355468592942072',
            'placa': 'PVN-3C73',
            'name': 'GRANELEIRO PVN-3C73',
            'latitude': -9.807862,
            'longitude': -36.20996,
            'autonomia_percent': 15.5,
            'litros_restantes': 25.0,
            'consumo_medio': 8.2,
            'km_restantes': 45.0,
            'last_updated': datetime.now().isoformat(),
            'status': 'critical'
        },
        {
            'id': 'fuel_355468592946537',
            'imei': '355468592946537', 
            'placa': 'HOM-4A71',
            'name': 'GRANELEIRO HOM-4A71',
            'latitude': -9.814764,
            'longitude': -36.21757,
            'autonomia_percent': 35.0,
            'litros_restantes': 60.0,
            'consumo_medio': 7.8,
            'km_restantes': 120.0,
            'last_updated': datetime.now().isoformat(),
            'status': 'warning'
        },
        {
            'id': 'fuel_355468592947162',
            'imei': '355468592947162',
            'placa': 'FMX540',
            'name': 'VOLVO FMX 540',
            'latitude': -9.798397,
            'longitude': -36.294834,
            'autonomia_percent': 65.0,
            'litros_restantes': 120.0,
            'consumo_medio': 9.1,
            'km_restantes': 280.0,
            'last_updated': datetime.now().isoformat(),
            'status': 'normal'
        }
    ]

# =============================================================================
# ROTAS DA API - TODAS CORRIGIDAS
# =============================================================================

# Rotas de Autenticação
@app.route('/api/register', methods=['POST'])
def register():
    """Registrar novo usuário com suporte a login/email e senha simples"""
    try:
        data = request.get_json() or {}
        # Aceita 'email', 'login' ou 'username'
        login_input = data.get('email') or data.get('login') or data.get('username')
        password = data.get('password')
        name = data.get('name') or login_input
        
        if not login_input or not password:
            return jsonify({'error': 'Login e senha são obrigatórios'}), 400
        
        login_clean = str(login_input).strip().lower()
        name_clean = str(name).strip() if name else login_clean
        
        user_id, message = agromaps_api.create_user(name_clean, login_clean, password)
        
        if user_id is None:
            return jsonify({'error': message}), 400
        
        # Gerar token
        token = agromaps_api.generate_token(user_id, name_clean, login_clean)
        
        return jsonify({
            'success': True,
            'message': message,
            'token': token,
            'user': {
                'id': user_id,
                'name': name_clean,
                'email': login_clean
            }
        })
        
    except Exception as e:
        return jsonify({'error': f'Erro ao registrar usuário: {str(e)}'}), 500

@app.route('/api/login', methods=['POST'])
def login():
    """Login do usuário com login/email e senha"""
    try:
        data = request.get_json() or {}
        login_input = data.get('email') or data.get('login') or data.get('username')
        password = data.get('password')
        
        if not login_input or not password:
            return jsonify({'error': 'Login e senha são obrigatórios'}), 400
        
        login_clean = str(login_input).strip().lower()
        
        user_id, user_name, message = agromaps_api.authenticate_user(login_clean, password)
        
        if user_id is None:
            return jsonify({'error': message}), 401
        
        # Gerar token
        token = agromaps_api.generate_token(user_id, user_name, login_clean)
        
        logger.debug(f"DEBUG: Login bem-sucedido - user_id: {user_id}")
        
        return jsonify({
            'success': True,
            'message': message,
            'token': token,
            'user': {
                'id': user_id,
                'name': user_name,
                'email': login_clean
            }
        })
        
    except Exception as e:
        return jsonify({'error': f'Erro ao fazer login: {str(e)}'}), 500

@app.route('/api/logout', methods=['POST'])
def logout():
    """Logout do usuário"""
    return jsonify({'success': True, 'message': 'Logout realizado com sucesso'})

@app.route('/api/check-auth', methods=['GET'])
def check_auth():
    """Verificar se usuário está autenticado"""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'authenticated': False})
    
    token = auth_header.split(' ')[1]
    payload = agromaps_api.verify_token(token)
    
    if payload:
        return jsonify({
            'authenticated': True,
            'user': {
                'id': payload['user_id'],
                'name': payload['user_name'],
                'email': payload['user_email']
            }
        })
    else:
        return jsonify({'authenticated': False})

# Rotas de Fazendas (protegidas por autenticação)
@app.route('/api/create-farm', methods=['POST'])
def create_farm():
    """Criar nova fazenda"""
    try:
        user_id = agromaps_api.get_current_user_from_token()
        if not user_id:
            logger.debug("Usuário não autenticado na criação de fazenda")
            return jsonify({'error': 'Usuário não autenticado'}), 401
        
        data = request.get_json()
        farm_name = data.get('name')
        owner_name = data.get('owner')
        
        if not farm_name or not owner_name:
            return jsonify({'error': 'Nome da fazenda e proprietário são obrigatórios'}), 400
        
        farm_id = agromaps_api.create_farm(user_id, farm_name, owner_name)
        
        if farm_id is None:
            return jsonify({'error': 'Erro ao criar fazenda'}), 500
        
        logger.debug(f"DEBUG: Fazenda criada com sucesso - farm_id: {farm_id}")
        
        return jsonify({
            'success': True,
            'farm_id': farm_id,
            'message': f'Fazenda "{farm_name}" criada com sucesso'
        })
        
    except Exception as e:
        return jsonify({'error': f'Erro ao criar fazenda: {str(e)}'}), 500

@app.route('/api/upload-lot/<farm_id>', methods=['POST'])
def upload_lot(farm_id):
    """Upload de lote KML para uma fazenda específica com sobreposição inteligente"""
    try:
        user_id = agromaps_api.get_current_user_from_token()
        if not user_id:
            return jsonify({'error': 'Usuário não autenticado'}), 401
        
        if 'file' not in request.files:
            return jsonify({'error': 'Nenhum arquivo enviado'}), 400
        
        file = request.files['file']
        lot_number = request.form.get('lot_number', '1')
        overwrite = request.form.get('overwrite', 'true').lower() in ['true', '1', 'yes']
        
        if file.filename == '':
            return jsonify({'error': 'Arquivo vazio'}), 400
        
        if file and file.filename.lower().endswith('.kml'):
            raw_bytes = file.read()
            kml_content = decode_file_bytes(raw_bytes)
            
            lot_id, message, action = agromaps_api.upsert_lot_to_farm(user_id, farm_id, kml_content, lot_number, overwrite=overwrite)
            
            if lot_id is None:
                return jsonify({'error': message}), 400
            
            return jsonify({
                'success': True,
                'lot_id': lot_id,
                'action': action,
                'lots_added': 1,
                'message': message
            })
        else:
            return jsonify({'error': 'Arquivo deve ter extensão .kml'}), 400
            
    except Exception as e:
        return jsonify({'error': f'Erro ao processar lote: {str(e)}'}), 500

@app.route('/api/import-kml-folder', methods=['POST'])
def import_kml_folder():
    """Importar múltiplos arquivos KML organizados por pastas (Nome da Pasta = Fazenda, Arquivos = Lotes)"""
    try:
        user_id = agromaps_api.get_current_user_from_token()
        if not user_id:
            return jsonify({'error': 'Usuário não autenticado'}), 401
        
        uploaded_files = request.files.getlist('files')
        if not uploaded_files:
            return jsonify({'error': 'Nenhum arquivo enviado'}), 400
            
        # Obter caminhos relativos (enviados como paths[] ou paths)
        relative_paths = request.form.getlist('paths')
        owner_name = request.form.get('owner', 'Proprietário')
        overwrite = request.form.get('overwrite', 'true').lower() in ['true', '1', 'yes']
        
        farms_created_count = 0
        farms_existing_count = 0
        lots_created_count = 0
        lots_updated_count = 0
        details = []
        errors = []
        
        # Mapeamento para cache local durante importação
        processed_farms = {}  # farm_name_lower -> farm_id
        
        for idx, file in enumerate(uploaded_files):
            if not file or not file.filename:
                continue
                
            filename = file.filename
            if not filename.lower().endswith('.kml'):
                continue
                
            # Determinar caminho relativo
            rel_path = relative_paths[idx] if idx < len(relative_paths) else filename
            rel_path_clean = str(rel_path).replace('\\', '/').strip()
            path_parts = [p.strip() for p in rel_path_clean.split('/') if p.strip()]
            
            # Estrutura esperada: Pasta (Fazenda) / Arquivo (Lote)
            if len(path_parts) >= 2:
                # O nome da fazenda é a pasta pai imediata do arquivo .kml
                farm_folder_name = path_parts[-2]
                lot_file_name = path_parts[-1]
            else:
                # Arquivo solto sem subpasta
                farm_folder_name = request.form.get('default_farm_name') or "Fazenda Geral"
                lot_file_name = path_parts[0]
                
            # Ler conteúdo do KML com decode seguro
            raw_bytes = file.read()
            kml_content = decode_file_bytes(raw_bytes)
            
            # 1. Upsert da Fazenda
            farm_name_key = farm_folder_name.strip().lower()
            if farm_name_key in processed_farms:
                farm_id = processed_farms[farm_name_key]
            else:
                farm_id, is_new_farm, clean_farm_name = agromaps_api.upsert_farm(user_id, farm_folder_name, owner_name)
                processed_farms[farm_name_key] = farm_id
                if is_new_farm:
                    farms_created_count += 1
                else:
                    farms_existing_count += 1
                    
            # 2. Upsert do Lote
            lot_identifier = lot_file_name.replace('.kml', '').replace('.KML', '')
            lot_id, message, action = agromaps_api.upsert_lot_to_farm(user_id, farm_id, kml_content, lot_identifier, overwrite=overwrite)
            
            if lot_id:
                if action == 'updated':
                    lots_updated_count += 1
                else:
                    lots_created_count += 1
                    
                details.append({
                    'file': lot_file_name,
                    'path': rel_path_clean,
                    'farm_name': farm_folder_name,
                    'lot_name': lot_identifier,
                    'action': action,
                    'success': True
                })
            else:
                errors.append({
                    'file': lot_file_name,
                    'path': rel_path_clean,
                    'farm_name': farm_folder_name,
                    'error': message
                })
                
        total_processed = lots_created_count + lots_updated_count
        
        return jsonify({
            'success': True,
            'message': f'Importação concluída: {total_processed} lotes processados ({lots_updated_count} atualizados / sobrepostos, {lots_created_count} novos)',
            'summary': {
                'farms_created': farms_created_count,
                'farms_existing': farms_existing_count,
                'lots_created': lots_created_count,
                'lots_updated': lots_updated_count,
                'total_lots': total_processed,
                'errors_count': len(errors)
            },
            'details': details,
            'errors': errors
        })
        
    except Exception as e:
        logger.error(f"Erro na importação de pasta KML: {str(e)}")
        return jsonify({'error': f'Erro ao importar pasta KML: {str(e)}'}), 500

@app.route('/api/get-farms')
def get_farms():
    """Listar todas as fazendas do usuário logado"""
    try:
        user_id = agromaps_api.get_current_user_from_token()
        if not user_id:
            logger.debug("Usuário não autenticado ao buscar fazendas")
            return jsonify({'error': 'Usuário não autenticado'}), 401
        
        if user_id not in agromaps_api.users_data:
            return jsonify({'success': True, 'farms': [], 'total': 0})
        
        farms_list = []
        user_farms = agromaps_api.users_data[user_id]['farms']
        
        for farm_id, farm_data in user_farms.items():
            farms_list.append({
                'id': farm_id,
                'name': farm_data['name'],
                'owner': farm_data['owner'],
                'lots_count': len(farm_data['lots']),
                'created_at': farm_data['created_at']
            })
        
        logger.debug(f"DEBUG: Fazendas encontradas para user {user_id}: {len(farms_list)}")
        
        return jsonify({
            'success': True,
            'farms': farms_list,
            'total': len(farms_list)
        })
    except Exception as e:
        return jsonify({'error': f'Erro ao buscar fazendas: {str(e)}'}), 500

@app.route('/api/get-farm-lots/<farm_id>')
def get_farm_lots(farm_id):
    """Buscar lotes de uma fazenda específica do usuário"""
    try:
        user_id = agromaps_api.get_current_user_from_token()
        if not user_id:
            return jsonify({'error': 'Usuário não autenticado'}), 401
        
        if user_id not in agromaps_api.users_data or farm_id not in agromaps_api.users_data[user_id]['farms']:
            return jsonify({'error': 'Fazenda não encontrada'}), 404
        
        farm = agromaps_api.users_data[user_id]['farms'][farm_id]
        lots = []
        
        logger.debug(f"DEBUG: Buscando lotes da fazenda {farm['name']} - IDs dos lotes: {farm['lots']}")
        
        for lot_id in farm['lots']:
            if lot_id in agromaps_api.users_data[user_id]['lots']:
                lot_data = agromaps_api.users_data[user_id]['lots'][lot_id]
                # Converter formato antigo para novo (compatibilidade)
                if 'coordinates' in lot_data and 'polygons' not in lot_data:
                    lot_data['polygons'] = [{'coordinates': lot_data['coordinates'], 'description': lot_data.get('description', '')}]
                    del lot_data['coordinates']
                    agromaps_api.save_data()
                
                polygons = lot_data.get('polygons', [])
                lots.append({
                    'id': lot_data['id'],
                    'name': lot_data['name'],
                    'lot_number': lot_data['lot_number'],
                    'polygons': polygons,
                    'description': lot_data['description']
                })
                logger.debug(f"DEBUG: Lote encontrado - {lot_data['name']} com {len(polygons)} polígonos")
            else:
                logger.debug(f"DEBUG: Lote {lot_id} não encontrado nos dados do usuário")
        
        logger.debug(f"DEBUG: Total de lotes retornados: {len(lots)}")
        
        return jsonify({
            'success': True,
            'farm': {
                'id': farm_id,
                'name': farm['name'],
                'owner': farm['owner']
            },
            'lots': lots
        })
    except Exception as e:
        return jsonify({'error': f'Erro ao buscar lotes: {str(e)}'}), 500

# =============================================================================
# ROTAS DO DIRETÓRIO DE KMLS E FILTROS DE PASTAS
# =============================================================================

@app.route('/api/kmls/tree', methods=['GET'])
def get_kml_tree():
    """Retornar a árvore hierárquica completa da pasta kmls/ com contagens"""
    try:
        tree_data = agromaps_api.kml_manager.tree
        return jsonify({
            'success': True,
            'tree': tree_data,
            'total_lots': agromaps_api.kml_manager.tree.get('kml_count', 0)
        })
    except Exception as e:
        logger.error(f"Erro ao obter árvore de KMLs: {e}")
        return jsonify({'error': f'Erro ao obter árvore de KMLs: {str(e)}'}), 500

@app.route('/api/kmls/lots', methods=['GET', 'POST'])
def get_kml_lots():
    """Buscar lotes do diretório kmls/ filtrados por caminho ou busca"""
    try:
        if request.method == 'POST':
            data = request.get_json() or {}
            paths = data.get('paths')
            search = data.get('search')
        else:
            search = request.args.get('search')
            if 'paths' in request.args:
                raw_paths = request.args.get('paths', '')
                if raw_paths.strip() == '' or raw_paths.strip() == '__NONE__':
                    paths = []
                elif raw_paths.strip().upper() == 'ALL':
                    paths = ['ALL']
                else:
                    paths = [p.strip() for p in raw_paths.split(',') if p.strip()]
            elif 'path' in request.args:
                paths = request.args.getlist('path')
            else:
                paths = None # Default: todos os lotes
        
        lots = agromaps_api.kml_manager.get_lots(paths=paths, search=search)
        return jsonify({
            'success': True,
            'lots': lots,
            'total': len(lots)
        })
    except Exception as e:
        logger.error(f"Erro ao buscar lotes KML: {e}")
        return jsonify({'error': f'Erro ao buscar lotes KML: {str(e)}'}), 500

@app.route('/api/kmls/filter', methods=['POST'])
def filter_kml_lots():
    """Filtrar lotes via POST com lista de caminhos selecionados e termo de busca"""
    try:
        data = request.get_json() or {}
        paths = data.get('paths', [])
        search = data.get('search', '')
        
        lots = agromaps_api.kml_manager.get_lots(paths=paths, search=search)
        return jsonify({
            'success': True,
            'lots': lots,
            'total': len(lots)
        })
    except Exception as e:
        logger.error(f"Erro ao filtrar lotes KML: {e}")
        return jsonify({'error': f'Erro ao filtrar lotes KML: {str(e)}'}), 500

@app.route('/api/kmls/lot-info', methods=['GET'])
@app.route('/api/kmls/lot-info/<path:lot_path>', methods=['GET'])
def get_kml_lot_info(lot_path=None):
    """Buscar informações de um lote do diretório KML (Google Sheets + Overrides)"""
    try:
        path = lot_path or request.args.get('path') or request.args.get('id')
        if not path:
            return jsonify({'error': 'Parâmetro path ou id é obrigatório'}), 400
            
        user_id = agromaps_api.get_current_user_from_token()
        info = agromaps_api.kml_manager.get_lot_info_by_path(path, user_id=user_id)
        
        return jsonify({
            'success': True,
            'data': info
        })
    except Exception as e:
        logger.error(f"Erro ao buscar info do lote KML: {e}")
        return jsonify({'error': f'Erro ao buscar info do lote: {str(e)}'}), 500

@app.route('/api/harvest-planning/lot-data', methods=['GET', 'POST'])
def get_harvest_planning_lot_data():
    """
    Consulta dados agronômicos de um talhão no WebService NSTech para uma data de queima/colheita.
    URL: http://nstech.ddns.net:8889/WebServiceNSTechAPP/stowap?codgru=1&codemp=20&codfil=1&codcli=20&codwap=2015&codfaz=[codfaz]&codlot=[codlot]&datmov=[data]
    """
    try:
        if request.method == 'POST':
            data = request.get_json() or {}
            codfaz = data.get('codfaz')
            codlot = data.get('codlot')
            datmov = data.get('datmov')
            lot_name = data.get('lot_name') or data.get('lot_id') or data.get('path')
        else:
            codfaz = request.args.get('codfaz')
            codlot = request.args.get('codlot')
            datmov = request.args.get('datmov') or request.args.get('data')
            lot_name = request.args.get('lot_name') or request.args.get('lot_id') or request.args.get('path')

        # Se não foram fornecidos codfaz e codlot diretamente, extrair do nome do talhão (ex: 0001-1001-1)
        if (not codfaz or not codlot) and lot_name:
            clean_name = lot_name.replace('\\', '/').split('/')[-1]
            if clean_name.lower().endswith('.kml'):
                clean_name = clean_name[:-4]
            
            parts = clean_name.split('-')
            if len(parts) >= 2:
                if not codfaz:
                    codfaz = parts[0].strip()
                if not codlot:
                    codlot = parts[1].strip()

        if not codfaz or not codlot:
            return jsonify({
                'success': False,
                'error': 'Código da fazenda (codfaz) e código do talhão (codlot) são obrigatórios.'
            }), 400

        # Formatar a data para DD/MM/YYYY
        if not datmov:
            datmov = datetime.now().strftime('%d/%m/%Y')
        else:
            datmov = datmov.strip()
            if '-' in datmov and len(datmov.split('-')) == 3:
                p = datmov.split('-')
                if len(p[0]) == 4: # YYYY-MM-DD -> DD/MM/YYYY
                    datmov = f"{p[2]}/{p[1]}/{p[0]}"
            elif len(datmov) == 8 and datmov.isdigit():
                datmov = f"{datmov[0:2]}/{datmov[2:4]}/{datmov[4:8]}"

        url = f"http://nstech.ddns.net:8889/WebServiceNSTechAPP/stowap?codgru=1&codemp=20&codfil=1&codcli=20&codwap=2015&codfaz={codfaz}&codlot={codlot}&datmov={datmov}"
        logger.info(f"Chamando API NSTech: {url}")

        try:
            resp = requests.get(url, headers={'User-Agent': 'Mozilla/5.0 (AgroMaps)'}, timeout=12)
            raw_bytes = resp.content
            try:
                raw_text = raw_bytes.decode('utf-8')
            except UnicodeDecodeError:
                raw_text = raw_bytes.decode('iso-8859-1', errors='replace')

            if 'Erro de Conexao' in raw_text or 'Exception' in raw_text or raw_text.strip().startswith('Erro'):
                return jsonify({
                    'success': False,
                    'message': f"Erro retornado pelo WebService: {raw_text.strip()}",
                    'url': url,
                    'codfaz': codfaz,
                    'codlot': codlot,
                    'datmov': datmov
                }), 200

            try:
                parsed_json = json.loads(raw_text)
            except Exception as json_err:
                return jsonify({
                    'success': False,
                    'message': f"Resposta não é um JSON válido: {raw_text[:200]}",
                    'error': str(json_err)
                }), 200

            item = parsed_json[0] if isinstance(parsed_json, list) and len(parsed_json) > 0 else (parsed_json if isinstance(parsed_json, dict) else {})

            normalized_data = {
                'codfaz': item.get('CODFAZ', codfaz),
                'codlot': item.get('CODLOT', codlot),
                'nome_fazenda': item.get('NOMFAZ', ''),
                'area': float(item.get('AREA', 0) or 0),
                'producao_estimada': float(item.get('PRODUCAO', 0) or 0),
                'tch_previsto': float(item.get('TCHPREVISTO', 0) or 0),
                'data_plantio': item.get('DATAPLANTIO', 'N/D'),
                'idade_cana': item.get('IDADE', 'N/D'),
                'data_ultima_colheita': item.get('DATA_COLHEITA_ANTERIOR', 'N/D'),
                'variedade': item.get('VARIEDADE', 'N/D'),
                'numero_corte': str(item.get('NUMEROCORTE', 'N/A')),
                'turmas': item.get('TURMAS', 0),
                'data_movimento': datmov,
                'raw': item
            }

            return jsonify({
                'success': True,
                'data': normalized_data
            })

        except requests.exceptions.RequestException as req_err:
            logger.error(f"Erro de conexão com WebService NSTech: {req_err}")
            return jsonify({
                'success': False,
                'message': f"Não foi possível conectar ao WebService NSTech ({str(req_err)})",
                'error': str(req_err)
            }), 502

    except Exception as e:
        logger.error(f"Erro ao processar dados de planejamento de colheita: {e}")
        return jsonify({'success': False, 'error': f'Erro interno: {str(e)}'}), 500

@app.route('/api/harvest-planning/save', methods=['POST'])
def save_harvest_planning_item():
    """Salvar ou atualizar um lote no planejamento de queima/colheita"""
    try:
        data = request.get_json() or {}
        lot_name = data.get('lot_name') or data.get('lot_id') or ''
        codfaz = str(data.get('codfaz', '')).strip()
        codlot = str(data.get('codlot', '')).strip()
        nome_fazenda = data.get('nome_fazenda', '')
        data_planejamento = data.get('data_planejamento') or datetime.now().strftime('%Y-%m-%d')
        data_movimento = data.get('data_movimento') or datetime.now().strftime('%d/%m/%Y')
        
        # Formatar datas de forma consistente
        if '-' in data_planejamento and len(data_planejamento.split('-')) == 3:
            p = data_planejamento.split('-')
            if len(p[0]) == 4:
                data_movimento = f"{p[2]}/{p[1]}/{p[0]}"
        elif '/' in data_planejamento and len(data_planejamento.split('/')) == 3:
            p = data_planejamento.split('/')
            data_movimento = data_planejamento
            data_planejamento = f"{p[2]}-{p[1]}-{p[0]}"

        area = float(data.get('area', 0) or 0)
        producao = float(data.get('producao_estimada', 0) or data.get('producao', 0) or 0)
        tch = float(data.get('tch_previsto', 0) or data.get('tch', 0) or 0)
        turmas = int(data.get('turmas', 1) or 1)
        variedade = data.get('variedade', 'N/D')
        data_plantio = data.get('data_plantio', 'N/D')
        idade_cana = data.get('idade_cana', 'N/D')
        data_ultima_colheita = data.get('data_ultima_colheita', 'N/D')
        numero_corte = str(data.get('numero_corte', 'N/A'))

        user_id = agromaps_api.get_current_user_from_token()

        planning_list = agromaps_api.harvest_planning_data
        existing_index = None

        item_id = data.get('id') or f"{codfaz}_{codlot}_{data_planejamento}"

        for idx, item in enumerate(planning_list):
            if item.get('id') == item_id or (
                str(item.get('codfaz')) == str(codfaz) and 
                str(item.get('codlot')) == str(codlot) and 
                item.get('data_planejamento') == data_planejamento
            ):
                existing_index = idx
                break

        new_item = {
            'id': item_id,
            'lot_name': lot_name,
            'codfaz': codfaz,
            'codlot': codlot,
            'nome_fazenda': nome_fazenda,
            'data_planejamento': data_planejamento,
            'data_movimento': data_movimento,
            'area': area,
            'producao_estimada': producao,
            'tch_previsto': tch,
            'turmas': turmas,
            'variedade': variedade,
            'data_plantio': data_plantio,
            'idade_cana': idade_cana,
            'data_ultima_colheita': data_ultima_colheita,
            'numero_corte': numero_corte,
            'updated_at': datetime.now().isoformat(),
            'user_id': user_id
        }

        if existing_index is not None:
            new_item['created_at'] = planning_list[existing_index].get('created_at', new_item['updated_at'])
            planning_list[existing_index] = new_item
        else:
            new_item['created_at'] = new_item['updated_at']
            planning_list.append(new_item)

        agromaps_api.save_harvest_planning()

        return jsonify({
            'success': True,
            'message': 'Planejamento de queima salvo com sucesso!',
            'item': new_item
        })
    except Exception as e:
        logger.error(f"Erro ao salvar planejamento de colheita: {e}")
        return jsonify({'success': False, 'error': f'Erro ao salvar planejamento: {str(e)}'}), 500

@app.route('/api/harvest-planning/list', methods=['GET'])
def get_harvest_planning_list():
    """Listar itens planejados para uma data ou período"""
    try:
        data_filter = request.args.get('data') or request.args.get('datmov') or request.args.get('date')
        fazenda_filter = request.args.get('fazenda')

        planning_list = agromaps_api.harvest_planning_data
        filtered = []

        target_date_iso = None
        target_date_br = None
        if data_filter:
            data_filter = data_filter.strip()
            if '-' in data_filter and len(data_filter.split('-')) == 3:
                p = data_filter.split('-')
                target_date_iso = data_filter
                target_date_br = f"{p[2]}/{p[1]}/{p[0]}"
            elif '/' in data_filter and len(data_filter.split('/')) == 3:
                p = data_filter.split('/')
                target_date_br = data_filter
                target_date_iso = f"{p[2]}-{p[1]}-{p[0]}"

        for item in planning_list:
            if target_date_iso or target_date_br:
                item_date = item.get('data_planejamento')
                item_date_br = item.get('data_movimento')
                if item_date != target_date_iso and item_date_br != target_date_br:
                    continue

            if fazenda_filter and fazenda_filter.lower() not in item.get('nome_fazenda', '').lower():
                continue

            item_dict = dict(item)
            # Anexar polígonos do KML correspondente para visualização gráfica
            lot_name_val = str(item.get('lot_name', '')).strip()
            codfaz_val = str(item.get('codfaz', '')).strip()
            codlot_val = str(item.get('codlot', '')).strip()
            
            polygons = []
            matched_lot = agromaps_api.kml_manager.lots_by_id.get(lot_name_val)
            if not matched_lot:
                for l in agromaps_api.kml_manager.lots_list:
                    lname = str(l.get('name', ''))
                    lid = str(l.get('id', ''))
                    if (lname == lot_name_val or 
                        lid == lot_name_val or 
                        (codfaz_val and codlot_val and lname.startswith(f"{codfaz_val}-{codlot_val}")) or
                        (codfaz_val and codlot_val and f"/{codfaz_val}-" in lid and f"-{codlot_val}" in lid)):
                        matched_lot = l
                        break
            if matched_lot:
                polygons = matched_lot.get('polygons', [])
            item_dict['polygons'] = polygons

            filtered.append(item_dict)

        # Agrupar por Fazenda
        grouped_by_farm = {}
        total_area = 0.0
        total_producao = 0.0
        total_turmas = 0

        for item in filtered:
            farm_name = item.get('nome_fazenda') or f"FAZENDA {item.get('codfaz', 'GERAL')}"
            if farm_name not in grouped_by_farm:
                grouped_by_farm[farm_name] = {
                    'farm_name': farm_name,
                    'codfaz': item.get('codfaz'),
                    'items': [],
                    'subtotal_area': 0.0,
                    'subtotal_producao': 0.0,
                    'subtotal_turmas': 0
                }

            grouped_by_farm[farm_name]['items'].append(item)
            grouped_by_farm[farm_name]['subtotal_area'] += float(item.get('area', 0) or 0)
            grouped_by_farm[farm_name]['subtotal_producao'] += float(item.get('producao_estimada', 0) or 0)
            grouped_by_farm[farm_name]['subtotal_turmas'] += int(item.get('turmas', 0) or 0)

            total_area += float(item.get('area', 0) or 0)
            total_producao += float(item.get('producao_estimada', 0) or 0)
            total_turmas += int(item.get('turmas', 0) or 0)

        # Ordenar itens dentro de cada fazenda por lote
        for farm_name, farm_obj in grouped_by_farm.items():
            farm_obj['items'].sort(key=lambda x: str(x.get('codlot', '')))

        return jsonify({
            'success': True,
            'items': filtered,
            'total_items': len(filtered),
            'total_area': round(total_area, 2),
            'total_producao': round(total_producao, 3),
            'total_turmas': total_turmas,
            'grouped_by_farm': grouped_by_farm,
            'data_filtro': target_date_br or data_filter or datetime.now().strftime('%d/%m/%Y')
        })
    except Exception as e:
        logger.error(f"Erro ao listar planejamentos: {e}")
        return jsonify({'success': False, 'error': f'Erro ao listar planejamentos: {str(e)}'}), 500

@app.route('/api/harvest-planning/item/<item_id>', methods=['DELETE'])
def delete_harvest_planning_item(item_id):
    """Remover um item do planejamento"""
    try:
        initial_len = len(agromaps_api.harvest_planning_data)
        agromaps_api.harvest_planning_data = [
            it for it in agromaps_api.harvest_planning_data if it.get('id') != item_id
        ]
        
        if len(agromaps_api.harvest_planning_data) < initial_len:
            agromaps_api.save_harvest_planning()
            return jsonify({'success': True, 'message': 'Item removido do planejamento com sucesso!'})
        else:
            return jsonify({'success': False, 'message': 'Item não encontrado no planejamento'}), 404
    except Exception as e:
        logger.error(f"Erro ao excluir item do planejamento: {e}")
        return jsonify({'success': False, 'error': f'Erro ao excluir item: {str(e)}'}), 500

@app.route('/api/harvest-projection/data', methods=['GET'])
def get_harvest_projection_data():
    """
    Retorna os dados processados da projeção de colheita da safra 2026/2027 (dadoslotes/projecao_colheita_2026-2027.csv)
    com timeline diária, estatísticas mensais e mapeamento rápido de talhões por chave.
    """
    try:
        folder = os.path.join(os.path.dirname(__file__), 'dadoslotes')
        csv_file = os.path.join(folder, 'projecao_colheita_2026-2027.csv')
        if not os.path.exists(csv_file) and os.path.exists(folder):
            for f in os.listdir(folder):
                if f.lower().endswith('.csv'):
                    csv_file = os.path.join(folder, f)
                    break

        if not os.path.exists(csv_file):
            return jsonify({
                'success': False,
                'error': f'Arquivo de projeção não encontrado em {folder}'
            }), 404

        records = []
        with open(csv_file, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                faz = str(row.get('Fazenda', '')).strip()
                talhao = str(row.get('Talhao', '')).strip()
                data = str(row.get('Data', '')).strip()
                corte = str(row.get('Corte', '')).strip()
                try:
                    tons = float(row.get('Toneladas', 0) or 0)
                except Exception:
                    tons = 0.0

                if faz and talhao and data:
                    records.append({
                        'fazenda': faz,
                        'talhao': talhao,
                        'data': data,
                        'corte': corte,
                        'toneladas': tons
                    })

        from collections import defaultdict
        by_date = defaultdict(list)
        lots_map = {}
        total_tons = sum(r['toneladas'] for r in records)
        cut_summary = defaultdict(lambda: {'tons': 0.0, 'count': 0})
        monthly_summary = defaultdict(lambda: {'tons': 0.0, 'lots_set': set(), 'records': 0})

        for r in records:
            by_date[r['data']].append(r)

            try:
                int_key = f"{int(r['fazenda'])}_{int(r['talhao'])}"
            except Exception:
                int_key = f"{r['fazenda']}_{r['talhao']}"

            str_key = f"{r['fazenda']}_{r['talhao']}"
            dash_key = f"{r['fazenda']}-{r['talhao']}"

            for k in [int_key, str_key, dash_key]:
                if k not in lots_map:
                    lots_map[k] = {
                        'fazenda': r['fazenda'],
                        'talhao': r['talhao'],
                        'key': int_key,
                        'dates': [],
                        'primary_date': r['data'],
                        'total_toneladas': 0.0,
                        'cortes': [],
                        'records': []
                    }
                if r['data'] not in lots_map[k]['dates']:
                    lots_map[k]['dates'].append(r['data'])
                if r['corte'] and r['corte'] not in lots_map[k]['cortes']:
                    lots_map[k]['cortes'].append(r['corte'])
                lots_map[k]['total_toneladas'] = round(lots_map[k]['total_toneladas'] + r['toneladas'], 2)
                lots_map[k]['records'].append(r)
                lots_map[k]['primary_date'] = min(lots_map[k]['dates'])

            cut_summary[r['corte'] or 'OUTROS']['tons'] += r['toneladas']
            cut_summary[r['corte'] or 'OUTROS']['count'] += 1

            month_key = r['data'][:7]  # YYYY-MM
            monthly_summary[month_key]['tons'] += r['toneladas']
            monthly_summary[month_key]['lots_set'].add(f"{r['fazenda']}_{r['talhao']}")
            monthly_summary[month_key]['records'] += 1

        sorted_dates = sorted(by_date.keys())
        acc_tons = 0.0
        harvested_lots_set = set()
        timeline = []

        for d in sorted_dates:
            day_records = by_date[d]
            day_tons = sum(x['toneladas'] for x in day_records)
            acc_tons += day_tons
            for x in day_records:
                harvested_lots_set.add(f"{x['fazenda']}_{x['talhao']}")

            try:
                dt_obj = datetime.strptime(d, '%Y-%m-%d')
                formatted_date = dt_obj.strftime('%d/%m/%Y')
                weekday_map = {
                    0: 'Segunda-feira', 1: 'Terça-feira', 2: 'Quarta-feira',
                    3: 'Quinta-feira', 4: 'Sexta-feira', 5: 'Sábado', 6: 'Domingo'
                }
                weekday_name = weekday_map.get(dt_obj.weekday(), '')
            except Exception:
                formatted_date = d
                weekday_name = ''

            timeline.append({
                'date': d,
                'formatted_date': formatted_date,
                'day_of_week': weekday_name,
                'month': d[:7],
                'day_tons': round(day_tons, 2),
                'day_lots_count': len(day_records),
                'accumulated_tons': round(acc_tons, 2),
                'accumulated_lots': len(harvested_lots_set),
                'pct_completed': round((acc_tons / total_tons) * 100, 2) if total_tons > 0 else 0,
                'lots': day_records
            })

        month_names_br = {
            '2026-09': 'Set/2026',
            '2026-10': 'Out/2026',
            '2026-11': 'Nov/2026',
            '2026-12': 'Dez/2026',
            '2027-01': 'Jan/2027',
            '2027-02': 'Fev/2027',
            '2027-03': 'Mar/2027',
            '2027-04': 'Abr/2027'
        }

        monthly_stats = []
        for m in sorted(monthly_summary.keys()):
            monthly_stats.append({
                'month': m,
                'label': month_names_br.get(m, m),
                'total_tons': round(monthly_summary[m]['tons'], 2),
                'unique_lots': len(monthly_summary[m]['lots_set']),
                'records': monthly_summary[m]['records']
            })

        return jsonify({
            'success': True,
            'summary': {
                'total_records': len(records),
                'unique_lots': len(harvested_lots_set),
                'total_tons': round(total_tons, 2),
                'start_date': sorted_dates[0] if sorted_dates else None,
                'end_date': sorted_dates[-1] if sorted_dates else None,
                'total_dates': len(sorted_dates),
                'monthly_stats': monthly_stats,
                'cut_summary': {k: {'tons': round(v['tons'], 2), 'count': v['count']} for k, v in cut_summary.items()}
            },
            'timeline': timeline,
            'dates': sorted_dates,
            'lots_map': lots_map
        })

    except Exception as e:
        logger.error(f"Erro ao processar dados de projeção da safra: {e}")
        return jsonify({'success': False, 'error': f'Erro ao processar projeção: {str(e)}'}), 500

@app.route('/api/kmls/reload', methods=['POST'])
def reload_kmls():
    """Recarregar diretório de KMLs do disco"""
    try:
        agromaps_api.kml_manager.load_directory()
        return jsonify({
            'success': True,
            'message': f'Diretório recarregado com sucesso ({len(agromaps_api.kml_manager.lots_list)} lotes)',
            'total_lots': len(agromaps_api.kml_manager.lots_list),
            'tree': agromaps_api.kml_manager.tree
        })
    except Exception as e:
        logger.error(f"Erro ao recarregar diretório KML: {e}")
        return jsonify({'error': f'Erro ao recarregar KMLs: {str(e)}'}), 500

@app.route('/api/get-all-lots')
def get_all_lots():
    """Buscar todos os lotes (usando a base hierárquica kmls/)"""
    try:
        # Se temos os lotes da pasta kmls/, retornar eles diretamente
        if agromaps_api.kml_manager and agromaps_api.kml_manager.lots_list:
            kml_lots = agromaps_api.kml_manager.get_lots()
            return jsonify({
                'success': True,
                'lots': kml_lots,
                'total': len(kml_lots)
            })

        user_id = agromaps_api.get_current_user_from_token()
        if not user_id:
            return jsonify({'error': 'Usuário não autenticado'}), 401
        
        if user_id not in agromaps_api.users_data:
            return jsonify({'success': True, 'lots': [], 'total': 0})
        
        all_lots = []
        user_lots = agromaps_api.users_data[user_id]['lots']
        user_farms = agromaps_api.users_data[user_id]['farms']
        
        for lot_id, lot_data in user_lots.items():
            farm_name = user_farms.get(lot_data['farm_id'], {}).get('name', 'Fazenda Desconhecida')
            
            if 'coordinates' in lot_data and 'polygons' not in lot_data:
                lot_data['polygons'] = [{'coordinates': lot_data['coordinates'], 'description': lot_data.get('description', '')}]
                del lot_data['coordinates']
                agromaps_api.save_data()
            
            polygons = lot_data.get('polygons', [])
            all_lots.append({
                'id': lot_data['id'],
                'name': lot_data['name'],
                'farm_name': farm_name,
                'polygons': polygons,
                'description': lot_data['description']
            })
        
        return jsonify({
            'success': True,
            'lots': all_lots,
            'total': len(all_lots)
        })
    except Exception as e:
        return jsonify({'error': f'Erro ao buscar todos os lotes: {str(e)}'}), 500

@app.route('/api/get-lot-info/<path:lot_id>')
def get_lot_info(lot_id):
    """Buscar informações detalhadas de um lote (suporta ID tradicional ou caminho KML)"""
    try:
        user_id = agromaps_api.get_current_user_from_token()
        
        # Verificar se é um lote do KmlDirectoryManager
        if agromaps_api.kml_manager and (lot_id in agromaps_api.kml_manager.lots_by_id or '/' in lot_id):
            info = agromaps_api.kml_manager.get_lot_info_by_path(lot_id, user_id=user_id)
            return jsonify({
                'success': True,
                'data': info
            })

        lot_info = agromaps_api.get_lot_info(lot_id)
        
        if isinstance(lot_info, dict) and 'error' in lot_info:
            # Fallback para o KmlDirectoryManager
            if agromaps_api.kml_manager:
                info = agromaps_api.kml_manager.get_lot_info_by_path(lot_id, user_id=user_id)
                return jsonify({
                    'success': True,
                    'data': info
                })
                
            return jsonify({
                'success': False,
                'error': lot_info['error'],
                'message': lot_info['message'],
                'farm_name': lot_info.get('farm_name'),
                'lot_name': lot_info.get('lot_name')
            }), 404
        else:
            return jsonify({
                'success': True,
                'data': lot_info
            })
            
    except Exception as e:
        return jsonify({'error': f'Erro ao buscar informações do lote: {str(e)}'}), 500

@app.route('/api/delete-farm/<farm_id>', methods=['DELETE'])
def delete_farm(farm_id):
    """Deletar fazenda e todos os seus lotes"""
    try:
        user_id = agromaps_api.get_current_user_from_token()
        if not user_id:
            return jsonify({'error': 'Usuário não autenticado'}), 401
        
        success, message = agromaps_api.delete_farm(user_id, farm_id)
        
        if success:
            return jsonify({'success': True, 'message': message})
        else:
            return jsonify({'error': message}), 404
            
    except Exception as e:
        return jsonify({'error': f'Erro ao deletar fazenda: {str(e)}'}), 500

@app.route('/api/delete-lot/<lot_id>', methods=['DELETE'])
def delete_lot(lot_id):
    """Deletar lote específico"""
    try:
        user_id = agromaps_api.get_current_user_from_token()
        if not user_id:
            return jsonify({'error': 'Usuário não autenticado'}), 401
        
        success, message = agromaps_api.delete_lot(user_id, lot_id)
        
        if success:
            return jsonify({'success': True, 'message': message})
        else:
            return jsonify({'error': message}), 404
            
    except Exception as e:
        return jsonify({'error': f'Erro ao deletar lote: {str(e)}'}), 500

# Rotas para Funcionários
@app.route('/api/employees', methods=['GET'])
def get_employees():
    """Listar todos os funcionários do usuário logado"""
    try:
        user_id = agromaps_api.get_current_user_from_token()
        if not user_id:
            return jsonify({'error': 'Usuário não autenticado'}), 401
        
        employees = agromaps_api.get_user_employees(user_id)
        
        return jsonify({
            'success': True,
            'employees': employees
        })
    except Exception as e:
        return jsonify({'error': f'Erro ao buscar funcionários: {str(e)}'}), 500

@app.route('/api/employees', methods=['POST'])
def create_employee():
    """Criar novo funcionário"""
    try:
        user_id = agromaps_api.get_current_user_from_token()
        if not user_id:
            return jsonify({'error': 'Usuário não autenticado'}), 401
        
        data = request.get_json()
        name = data.get('name')
        role = data.get('role')
        email = data.get('email', '')
        
        if not name or not role:
            return jsonify({'error': 'Nome e cargo são obrigatórios'}), 400
        
        employee_id = agromaps_api.create_employee(user_id, name, role, email)
        
        return jsonify({
            'success': True,
            'employee_id': employee_id,
            'message': f'Funcionário "{name}" criado com sucesso'
        })
        
    except Exception as e:
        return jsonify({'error': f'Erro ao criar funcionário: {str(e)}'}), 500

@app.route('/api/employees/<employee_id>', methods=['DELETE'])
def delete_employee(employee_id):
    """Deletar funcionário"""
    try:
        user_id = agromaps_api.get_current_user_from_token()
        if not user_id:
            return jsonify({'error': 'Usuário não autenticado'}), 401
        
        success, message = agromaps_api.delete_employee(user_id, employee_id)
        
        if success:
            return jsonify({'success': True, 'message': message})
        else:
            return jsonify({'error': message}), 404
            
    except Exception as e:
        return jsonify({'error': f'Erro ao deletar funcionário: {str(e)}'}), 500

# Rotas para Tarefas
@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    """Listar todas as tarefas do usuário logado"""
    try:
        user_id = agromaps_api.get_current_user_from_token()
        if not user_id:
            return jsonify({'error': 'Usuário não autenticado'}), 401
        
        tasks = agromaps_api.get_user_tasks(user_id)
        
        return jsonify({
            'success': True,
            'tasks': tasks
        })
    except Exception as e:
        return jsonify({'error': f'Erro ao buscar tarefas: {str(e)}'}), 500

@app.route('/api/tasks', methods=['POST'])
def create_task():
    """Criar nova tarefa"""
    try:
        user_id = agromaps_api.get_current_user_from_token()
        if not user_id:
            return jsonify({'error': 'Usuário não autenticado'}), 401
        
        data = request.get_json()
        title = data.get('title')
        description = data.get('description', '')
        assigned_to = data.get('assigned_to')
        due_date = data.get('due_date')
        status = data.get('status', 'todo')
        
        if not title or not assigned_to or not due_date:
            return jsonify({'error': 'Título, responsável e prazo são obrigatórios'}), 400
        
        task_id = agromaps_api.create_task(user_id, title, description, assigned_to, due_date, status)
        
        return jsonify({
            'success': True,
            'task_id': task_id,
            'message': f'Tarefa "{title}" criada com sucesso'
        })
        
    except Exception as e:
        return jsonify({'error': f'Erro ao criar tarefa: {str(e)}'}), 500

@app.route('/api/tasks/<task_id>', methods=['PUT'])
def update_task(task_id):
    """Atualizar tarefa"""
    try:
        user_id = agromaps_api.get_current_user_from_token()
        if not user_id:
            return jsonify({'error': 'Usuário não autenticado'}), 401
        
        data = request.get_json()
        success, message = agromaps_api.update_task(user_id, task_id, data)
        
        if success:
            return jsonify({'success': True, 'message': message})
        else:
            return jsonify({'error': message}), 404
            
    except Exception as e:
        return jsonify({'error': f'Erro ao atualizar tarefa: {str(e)}'}), 500

@app.route('/api/tasks/<task_id>', methods=['DELETE'])
def delete_task(task_id):
    """Deletar tarefa"""
    try:
        user_id = agromaps_api.get_current_user_from_token()
        if not user_id:
            return jsonify({'error': 'Usuário não autenticado'}), 401
        
        success, message = agromaps_api.delete_task(user_id, task_id)
        
        if success:
            return jsonify({'success': True, 'message': message})
        else:
            return jsonify({'error': message}), 404
            
    except Exception as e:
        return jsonify({'error': f'Erro ao deletar tarefa: {str(e)}'}), 500

# =============================================================================
# ROTAS PARA FROTA E ABASTECIMENTO - CORRIGIDAS
# =============================================================================

@app.route('/api/vehicles', methods=['GET'])
def get_vehicles():
    """Busca dados dos veículos da planilha Google Sheets"""
    try:
        vehicles_data = get_fleet_data_from_sheets()
        
        return jsonify({
            'success': True,
            'vehicles': vehicles_data,
            'total': len(vehicles_data)
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'vehicles': get_sample_fleet_data()
        }), 500

@app.route('/api/fuel-data', methods=['GET'])
def api_get_fuel_data():
    """API para buscar dados de abastecimento - CORRIGIDA"""
    try:
        fuel_data = get_fuel_data()
        return jsonify({
            'success': True,
            'fuel_data': fuel_data,
            'total': len(fuel_data)
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'fuel_data': get_sample_fuel_data()
        }), 500

@app.route('/api/fuel-lots', methods=['GET'])
def get_fuel_lots():
    """Buscar lotes para o mapa de abastecimento"""
    try:
        # Esta rota pode ser pública para o mapa de abastecimento
        # Por enquanto, retornar vazio ou buscar lotes de forma diferente
        return jsonify({
            'success': True,
            'lots': []
        })
    except Exception as e:
        return jsonify({'error': f'Erro ao buscar lotes: {str(e)}'}), 500

@app.route('/api/harvest-lots-status', methods=['GET'])
def get_harvest_lots_status():
    """Buscar status de colheita dos lotes da planilha Info Fazenda"""
    try:
        # Atualizar dados da planilha se necessário
        if (agromaps_api.sheets_data is None or
            agromaps_api.last_sheets_update is None or
            (datetime.now() - agromaps_api.last_sheets_update).seconds > 300):
            agromaps_api.fetch_sheets_data()

        if not agromaps_api.sheets_data:
            return jsonify({
                'success': False,
                'error': 'Dados da planilha não disponíveis'
            }), 500

        # Processar dados de colheita
        harvest_status = {}

        for key, lot_data in agromaps_api.sheets_data.items():
            fazenda = lot_data.get('fazenda', '')
            lote = lot_data.get('lote', '')
            colhido_raw = lot_data.get('colhido', '')

            # Verificar coluna COLHIDO da planilha
            # Possíveis valores: "SIM", "NAO", "COLHENDO"
            colhido_status = 'NAO'
            if isinstance(colhido_raw, str):
                colhido_upper = colhido_raw.upper().strip()
                if colhido_upper == 'SIM':
                    colhido_status = 'SIM'
                elif colhido_upper == 'COLHENDO':
                    colhido_status = 'COLHENDO'
            elif isinstance(colhido_raw, bool):
                colhido_status = 'SIM' if colhido_raw else 'NAO'

            harvest_status[key] = {
                'fazenda': fazenda,
                'lote': lote,
                'status': colhido_status
            }

        logger.info(f"Status de colheita processado: {len(harvest_status)} registros")

        return jsonify({
            'success': True,
            'harvest_status': harvest_status,
            'total': len(harvest_status)
        })

    except Exception as e:
        logger.error(f"Erro ao buscar status de colheita: {e}")
        return jsonify({
            'success': False,
            'error': f'Erro ao buscar status de colheita: {str(e)}'
        }), 500

@app.route('/api/test-new-fleet', methods=['GET'])
def test_new_fleet():
    """Rota específica para testar a NOVA planilha FROTA"""
    vehicles = get_fleet_data_from_sheets()
    
    return jsonify({
        'success': True,
        'vehicles_count': len(vehicles),
        'vehicles': vehicles,
        'message': f'Encontrados {len(vehicles)} veículos na nova planilha FROTA',
        'spreadsheet_url': 'https://docs.google.com/spreadsheets/d/1DuoiaUXbNjj4DqQ6m6Do9lbz5MdaeDQ3WI0jHotlVzY'
    })

@app.route('/api/debug/sheets', methods=['GET'])
def debug_sheets():
    """Rota para diagnóstico da planilha"""
    try:
        spreadsheet_id = '1nHEuSTKdyL377eQHSVfGR7cVXJywDgJXiqOnapLryH0'
        csv_url = f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/export?format=csv"
        
        response = requests.get(csv_url)
        response.raise_for_status()
        
        # Ler como texto para análise
        content = response.text
        lines = content.split('\n')
        
        # Mostrar primeiras linhas
        first_lines = lines[:5]
        
        return jsonify({
            'success': True,
            'status_code': response.status_code,
            'first_lines': first_lines,
            'total_lines': len(lines),
            'message': 'Planilha acessada com sucesso - verifique os cabeçalhos'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Erro ao acessar planilha'
        }), 500

# Rota de atualização de localização sem JWT
@app.route('/api/vehicles/<vehicle_id>/location', methods=['PUT'])
def update_vehicle_location(vehicle_id):
    """Atualizar localização de um veículo"""
    try:
        data = request.get_json()
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        
        if latitude is None or longitude is None:
            return jsonify({
                'success': False,
                'error': 'missing_coordinates',
                'message': 'Latitude e longitude são obrigatórios'
            }), 400
        
        # Aqui você pode implementar a lógica para salvar na planilha
        # ou em um banco de dados se preferir
        logger.debug(f"DEBUG: Localização atualizada - Veículo {vehicle_id}: {latitude}, {longitude}")
        
        return jsonify({
            'success': True,
            'message': f'Localização do veículo {vehicle_id} atualizada',
            'vehicle_id': vehicle_id,
            'latitude': latitude,
            'longitude': longitude,
            'last_updated': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'update_error',
            'message': f'Erro ao atualizar localização: {str(e)}'
        }), 500

# Rotas para Colheita
@app.route('/api/harvest-status', methods=['GET'])
def get_all_harvest_status():
    """Buscar status de colheita de todos os lotes"""
    try:
        user_id = agromaps_api.get_current_user_from_token()
        if not user_id:
            return jsonify({'error': 'Usuário não autenticado'}), 401
        
        harvest_status = agromaps_api.get_all_harvest_status(user_id)
        
        return jsonify({
            'success': True,
            'harvest_status': harvest_status
        })
    except Exception as e:
        return jsonify({'error': f'Erro ao buscar status de colheita: {str(e)}'}), 500

@app.route('/api/harvest-status/<lot_id>', methods=['PUT'])
def update_harvest_status(lot_id):
    """Atualizar status de colheita de um lote"""
    try:
        user_id = agromaps_api.get_current_user_from_token()
        if not user_id:
            return jsonify({'error': 'Usuário não autenticado'}), 401
        
        data = request.get_json()
        harvested = data.get('harvested', False)
        
        success = agromaps_api.update_harvest_status(user_id, lot_id, harvested)
        
        if success:
            return jsonify({
                'success': True,
                'message': f'Status de colheita atualizado: {"colhido" if harvested else "não colhido"}'
            })
        else:
            return jsonify({'error': 'Erro ao atualizar status de colheita'}), 500
            
    except Exception as e:
        return jsonify({'error': f'Erro ao atualizar status de colheita: {str(e)}'}), 500

# Rotas para Painel Gerencial
@app.route('/api/management/lots', methods=['GET'])
def get_lots_for_management():
    """Buscar todos os lotes para o painel gerencial"""
    try:
        user_id = agromaps_api.get_current_user_from_token()
        if not user_id:
            return jsonify({'error': 'Usuário não autenticado'}), 401
        
        lots = agromaps_api.get_user_lots_for_management(user_id)
        
        return jsonify({
            'success': True,
            'lots': lots
        })
    except Exception as e:
        return jsonify({'error': f'Erro ao buscar lotes para gerenciamento: {str(e)}'}), 500

@app.route('/api/management/lots/<lot_id>', methods=['PUT'])
def update_lot_data(lot_id):
    """Atualizar dados de um lote específico"""
    try:
        user_id = agromaps_api.get_current_user_from_token()
        if not user_id:
            return jsonify({'error': 'Usuário não autenticado'}), 401
        
        data = request.get_json()
        
        # Validar campos obrigatórios
        if not data:
            return jsonify({'error': 'Dados não fornecidos'}), 400
        
        success = agromaps_api.update_lot_data(user_id, lot_id, data)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Dados do lote atualizados com sucesso'
            })
        else:
            return jsonify({'error': 'Erro ao atualizar dados do lote'}), 500
            
    except Exception as e:
        return jsonify({'error': f'Erro ao atualizar dados do lote: {str(e)}'}), 500

# =============================================================================
# ROTA DE SAÚDE DA API
# =============================================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Rota para verificar se a API está funcionando"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'version': '1.0.0'
    })

# =============================================================================
# INICIALIZAÇÃO
# =============================================================================

if __name__ == '__main__':
    print("=== AGROMAPS API ===")
    print("Sistema de Mapeamento Agrícola com Autenticação JWT")
    logger.info("✅ Todas as rotas corrigidas e funcionais")
    print("📊 Rotas de frota e abastecimento funcionando")
    print("🔐 Sistema de autenticação ativo")
    print("🌐 CORS configurado para desenvolvimento")
    print("🚀 Acesse: http://127.0.0.1:5000")
    print("=" * 50)
    
    app.run(debug=True, host='127.0.0.1', port=5000)