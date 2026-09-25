import L from 'leaflet';

export const USINA_BASE = {
  lat: -9.8140414,
  lng: -36.2177396,
  name: 'Usina Porto Rico'
};

export const DISTANCE_RADII_KM = [1, 5, 10, 15, 20, 25, 30, 35, 40];

/**
 * Cria o ícone estilizado para a Usina Porto Rico (marcador central)
 */
export const createUsinaMarkerIcon = (): L.DivIcon => {
  return L.divIcon({
    className: 'usina-base-marker',
    html: `
      <div style="
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      ">
        <div style="
          position: absolute;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: rgba(245, 158, 11, 0.4);
          animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        "></div>
        <div style="
          width: 28px;
          height: 28px;
          background: linear-gradient(135deg, #f59e0b, #d97706);
          border: 2px solid #ffffff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 12px rgba(245, 158, 11, 0.9), 0 2px 6px rgba(0,0,0,0.5);
          font-size: 14px;
        ">
          🏭
        </div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16]
  });
};

/**
 * Cria o rótulo estilizado de distância na borda do raio
 */
const createRadiusLabelIcon = (km: number): L.DivIcon => {
  return L.divIcon({
    className: 'radius-distance-label',
    html: `
      <div style="
        background: rgba(15, 23, 42, 0.88);
        backdrop-filter: blur(4px);
        color: #fbbf24;
        border: 1px solid rgba(245, 158, 11, 0.8);
        padding: 1px 5px;
        border-radius: 4px;
        font-size: 9.5px;
        font-weight: 800;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        white-space: nowrap;
        box-shadow: 0 2px 6px rgba(0,0,0,0.5);
        transform: translate(-50%, -50%);
        pointer-events: none;
      ">
        ${km} km
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });
};

/**
 * Cria e adiciona a camada de raios concêntricos da Usina Porto Rico
 * (1km, 5km, 10km, 15km, 20km, 25km, 30km, 35km, 40km, 45km, 50km)
 */
export const addFactoryRadiusRings = (map: L.Map): L.LayerGroup => {
  const radiusGroup = L.layerGroup().addTo(map);

  // 1. Marcador da Usina
  const usinaMarker = L.marker([USINA_BASE.lat, USINA_BASE.lng], {
    icon: createUsinaMarkerIcon(),
    title: `${USINA_BASE.name} (Ponto 0 km)`
  });

  usinaMarker.bindTooltip(`
    <div style="font-family: inherit; font-size: 11px; padding: 2px;">
      <strong style="color: #d97706; font-size: 12px; display: block;">🏭 ${USINA_BASE.name}</strong>
      <span style="color: #475569; font-size: 10px;">Ponto Central dos Raios (0 km)</span><br/>
      <span style="color: #64748b; font-size: 9.5px;">Lat: ${USINA_BASE.lat.toFixed(6)}, Lon: ${USINA_BASE.lng.toFixed(6)}</span>
    </div>
  `, {
    sticky: true,
    direction: 'top',
    className: 'leaflet-agro-tooltip'
  });

  radiusGroup.addLayer(usinaMarker);

  // 2. Círculos Concêntricos e Rótulos ao Norte
  const METERS_PER_DEGREE_LAT = 111320; // Aproximação geodésica em metros por grau de latitude

  DISTANCE_RADII_KM.forEach(km => {
    const radiusMeters = km * 1000;

    // Círculo
    const circle = L.circle([USINA_BASE.lat, USINA_BASE.lng], {
      radius: radiusMeters,
      color: '#f59e0b',
      weight: km <= 10 ? 1.4 : 1.1,
      dashArray: '5, 5',
      fill: true,
      fillColor: '#f59e0b',
      fillOpacity: 0.012,
      interactive: false
    });
    radiusGroup.addLayer(circle);

    // Rótulo na borda Norte
    const labelLat = USINA_BASE.lat + (radiusMeters / METERS_PER_DEGREE_LAT);
    const labelMarker = L.marker([labelLat, USINA_BASE.lng], {
      icon: createRadiusLabelIcon(km),
      interactive: false
    });
    radiusGroup.addLayer(labelMarker);
  });

  return radiusGroup;
};
