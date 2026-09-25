import L from 'leaflet';

export interface TileLayerConfig {
  name: string;
  layer: L.TileLayer;
}

export const createDefaultTileLayers = (): {
  defaultLayer: L.TileLayer;
  baseMaps: { [name: string]: L.TileLayer };
} => {
  // 1. Satélite Híbrido (Satélite com estradas e demarcações) - Máxima nitidez
  const googleHybrid = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: 'Imagens &copy; Google / Maxar'
  });

  // 2. Esri World Imagery (Satélite ArcGIS Alta Definição)
  const esriSatellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP'
  });

  // 3. OpenStreetMap (Mapa Padrão de Ruas / Estradas)
  const openStreetMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });

  // 4. CARTO Dark Matter (Modo Escuro)
  const CARTO_API_KEY = 'cb1_32rf_1_79a343fbf018d4e3ee25746c';
  const darkMatter = L.tileLayer(
    `https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=${CARTO_API_KEY}`,
    {
      subdomains: 'abcd',
      maxZoom: 20,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }
  );

  const baseMaps = {
    '🛰️ Satélite Híbrido': googleHybrid,
    '🌍 Satélite Esri (ArcGIS)': esriSatellite,
    '🗺️ Mapa de Ruas (OSM)': openStreetMap,
    '🌙 Modo Escuro': darkMatter
  };

  return {
    defaultLayer: googleHybrid,
    baseMaps
  };
};

export const addLayerControl = (map: L.Map, baseMaps: { [name: string]: L.TileLayer }): L.Control.Layers => {
  return L.control.layers(baseMaps, undefined, {
    position: 'topright',
    collapsed: true
  }).addTo(map);
};
