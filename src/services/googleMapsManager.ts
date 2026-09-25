// Gerenciador centralizado do Google Maps para evitar conflitos entre componentes
import { Loader } from '@googlemaps/js-api-loader';

interface MapInstance {
  id: string;
  map: google.maps.Map;
  type: 'general' | 'fleet' | 'harvest' | 'satellite' | 'heatmap';
  isActive: boolean;
}

class GoogleMapsManager {
  private static instance: GoogleMapsManager;
  private loader: Loader | null = null;
  private isLoaded = false;
  private isLoading = false;
  private loadPromise: Promise<void> | null = null;
  private mapInstances: Map<string, MapInstance> = new Map();
  private activeMapId: string | null = null;

  private constructor() {
    this.loader = new Loader({
      apiKey: 'AIzaSyBqBL9w9tbch-Oq1SgZsYO0f08WYgBwLx4',
      version: 'weekly',
      libraries: ['marker', 'visualization']
    });
  }

  public static getInstance(): GoogleMapsManager {
    if (!GoogleMapsManager.instance) {
      GoogleMapsManager.instance = new GoogleMapsManager();
    }
    return GoogleMapsManager.instance;
  }

  public async loadGoogleMaps(): Promise<void> {
    if (this.isLoaded) {
      return Promise.resolve();
    }

    if (this.isLoading && this.loadPromise) {
      return this.loadPromise;
    }

    this.isLoading = true;
    this.loadPromise = this.performLoad();
    
    try {
      await this.loadPromise;
      this.isLoaded = true;
    } catch (error) {
      console.error('Erro ao carregar Google Maps:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  private async performLoad(): Promise<void> {
    if (!this.loader) {
      throw new Error('Loader não inicializado');
    }

    // Carregar todas as bibliotecas necessárias de uma vez
    await Promise.all([
      this.loader.importLibrary('maps'),
      this.loader.importLibrary('marker'),
      this.loader.importLibrary('visualization')
    ]);

    console.log('Google Maps carregado com sucesso pelo gerenciador centralizado');
  }

  public async createMap(
    element: HTMLElement,
    options: google.maps.MapOptions,
    mapId: string,
    mapType: MapInstance['type']
  ): Promise<google.maps.Map> {
    // Garantir que o Google Maps está carregado
    await this.loadGoogleMaps();

    // Limpar mapa anterior se existir
    this.destroyMap(mapId);

    // Aguardar um pouco para garantir que o DOM está estável
    await new Promise(resolve => setTimeout(resolve, 100));

    const { Map } = await this.loader!.importLibrary('maps') as google.maps.MapsLibrary;
    
    const map = new Map(element, {
      ...options,
      mapId: `${mapType}-${mapId}`
    });

    // Registrar a instância
    this.mapInstances.set(mapId, {
      id: mapId,
      map,
      type: mapType,
      isActive: true
    });

    // Definir como mapa ativo
    this.setActiveMap(mapId);

    console.log(`Mapa ${mapType} criado com ID: ${mapId}`);
    return map;
  }

  public destroyMap(mapId: string): void {
    const mapInstance = this.mapInstances.get(mapId);
    if (mapInstance) {
      try {
        // Limpar todos os listeners
        google.maps.event.clearInstanceListeners(mapInstance.map);
        mapInstance.isActive = false;
        
        // Remover da lista
        this.mapInstances.delete(mapId);
        
        // Se era o mapa ativo, limpar referência
        if (this.activeMapId === mapId) {
          this.activeMapId = null;
        }
        
        console.log(`Mapa ${mapInstance.type} destruído: ${mapId}`);
      } catch (error) {
        console.warn(`Erro ao destruir mapa ${mapId}:`, error);
      }
    }
  }

  public setActiveMap(mapId: string): void {
    // Desativar todos os outros mapas
    this.mapInstances.forEach((instance, id) => {
      instance.isActive = (id === mapId);
    });
    
    this.activeMapId = mapId;
    console.log(`Mapa ativo definido: ${mapId}`);
  }

  public getActiveMap(): MapInstance | null {
    if (this.activeMapId) {
      return this.mapInstances.get(this.activeMapId) || null;
    }
    return null;
  }

  public getMap(mapId: string): google.maps.Map | null {
    const instance = this.mapInstances.get(mapId);
    return instance ? instance.map : null;
  }

  public async getMarkerLibrary(): Promise<google.maps.MarkerLibrary> {
    await this.loadGoogleMaps();
    return this.loader!.importLibrary('marker') as Promise<google.maps.MarkerLibrary>;
  }

  public async getVisualizationLibrary(): Promise<google.maps.VisualizationLibrary> {
    await this.loadGoogleMaps();
    return this.loader!.importLibrary('visualization') as Promise<google.maps.VisualizationLibrary>;
  }

  public isGoogleMapsLoaded(): boolean {
    return this.isLoaded;
  }

  public getActiveMapCount(): number {
    return Array.from(this.mapInstances.values()).filter(instance => instance.isActive).length;
  }

  public destroyAllMaps(): void {
    const mapIds = Array.from(this.mapInstances.keys());
    mapIds.forEach(mapId => this.destroyMap(mapId));
    console.log('Todos os mapas foram destruídos');
  }
}

export default GoogleMapsManager;