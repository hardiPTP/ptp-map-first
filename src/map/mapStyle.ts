// Mode B (no Map ID) JSON styles. Reference:
// https://developers.google.com/maps/documentation/javascript/style-reference
// Colours are PTP tokens only (surface/canvas, surface/well, surface/line, surface/paper, ink/100).
// PRD "Build instructions (design)" 6: warm muted base close to canvas, POI icons hidden, quiet roads.
export const WARM_MUTED_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#fbf8f4' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#17140f' }, { lightness: 45 }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#fbf8f4' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }, { color: '#f1ece4' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e7e3dc' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.stroke', stylers: [{ color: '#e7e3dc' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#e7e3dc' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#17140f' }, { lightness: 55 }] },
]
