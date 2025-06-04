document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.querySelector('.search_query input');
  const searchButton = document.querySelector('.search_query button');
  const fullExtentButton = document.querySelector('#full_extent');

  searchButton.addEventListener('click', () => {
    const userInput = searchInput.value;
    console.log('User input:', userInput);
  });

  fullExtentButton.addEventListener('click', () => {
    map.flyTo({center:  [-96, 37.5], zoom: 3.6});
  });
});

mapboxgl.accessToken = 'pk.eyJ1IjoiaXphay1ib2FyZG1hbiIsImEiOiJjbWJmZzVhbTEwMDNjMnFtdHRyd2gzamc0In0.U_YDP6GrLeN_rwCCJ509Lw'; ///TODO THIS NEEDS TO BE HIDDEN ADD TO CREDS FILE AND GITIGNORE

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/dark-v11',
  zoom: 3.6,
  maxZoom : 6, 
  minZoom : 2, 
  center: [-96, 37.5],
  parallels: [29.5, 45.5]
});

let hoveredPolygonId = null;

map.on('load', () => {
  
  map.addSource('states', {
    type: 'geojson',
    data: 'https://docs.mapbox.com/mapbox-gl-js/assets/us_states.geojson'
  });

  map.addLayer({
    id: 'state-fills',
    type: 'fill',
    source: 'states',
    layout: {},
    paint: {
      'fill-color': '#627BC1',
      'fill-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        1,
        0
      ]
    },
    //  filter: ['==', 'STATE_ID', "19"]
  });

    map.addLayer({
      id: 'state-borders',
      type: 'line',
      source: 'states',
      layout: {},
      paint: {
        'line-color': '#627BC1',
        'line-width': 2
      }
    });

    map.addSource('oregon_districts', {
    type: 'geojson',
    data: '/assets/data/geojson/oregon_districts.geojson'
  });




map.on('mousemove', 'state-fills', (e) => {
  if (map.getZoom() >= 4) {  // adjust 4 to whatever zoom level you consider "state level"
    // At zoom <= 4, disable hover fills:
    if (hoveredPolygonId !== null) {
      map.setFeatureState(
        { source: 'states', id: hoveredPolygonId },
        { hover: false }
      );
      hoveredPolygonId = null;
    }
    return; // skip hover highlight
  }

  if (e.features.length > 0) {
    if (hoveredPolygonId !== null) {
      map.setFeatureState(
        { source: 'states', id: hoveredPolygonId },
        { hover: false }
      );
    }
    hoveredPolygonId = e.features[0].id;

    map.setFeatureState(
      { source: 'states', id: hoveredPolygonId },
      { hover: true }
    );
  }
});

map.on('mouseleave', 'state-fills', () => {
  if (hoveredPolygonId !== null) {
    map.setFeatureState(
      { source: 'states', id: hoveredPolygonId },
      { hover: false }
    );
  }
  hoveredPolygonId = null;
});



  map.on('click', 'state-fills', function (e) {
    const clickedFeature = e.features[0];

    const coords = clickedFeature.geometry.coordinates;
    console.log(JSON.stringify(coords, null, 1));
    const bounds = new mapboxgl.LngLatBounds();

    function extendBounds(coordinates) {
      if (typeof coordinates[0][0] === 'number') {
        // coordinates is an array of [lng, lat]
        coordinates.forEach(coord => bounds.extend(coord));
      } else {
        // coordinates is nested (MultiPolygon), recurse
        coordinates.forEach(extendBounds);
      }
    }

    extendBounds(coords);

    map.fitBounds(bounds, { padding: 20 });
    map.setFeatureState(
      { source: 'states', id: clickedFeature.id },
      { hover: false }
      );
    map.addLayer({
    id: 'district-lines-or',
    type: 'line',
    source: 'oregon_districts',
    paint: {
      'line-color': '#627BC1',
      'line-width': 2
    }
  }, 'state-fills'); // Layer position good
  });
});