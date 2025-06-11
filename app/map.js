document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.querySelector('.search_query input');
  const searchButton = document.querySelector('.search_query button');
  const fullExtentButton = document.querySelector('#full_extent');

  searchButton.addEventListener('click', () => {
    const userInput = searchInput.value;
    console.log('User input:', userInput);
  });

  fullExtentButton.addEventListener('click', () => {
    map.fitBounds([[ -126, 24], [-66, 50]]); // albers
    //map.jumpTo({ center: [-99.2, 40.0], zoom: 3 })
    // remove district layer if it exists
    if (map.getLayer("district-lines")){
      map.removeLayer('district-lines');
      map.removeLayer('district-fills');
    }
    hideGraphs();

  });
});

mapboxgl.accessToken = 'pk.eyJ1IjoiaXphay1ib2FyZG1hbiIsImEiOiJjbWJmZzVhbTEwMDNjMnFtdHRyd2gzamc0In0.U_YDP6GrLeN_rwCCJ509Lw'; ///TODO THIS NEEDS TO BE HIDDEN ADD TO CREDS FILE AND GITIGNORE

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/dark-v11',
  maxZoom : 10, 
  minZoom : 2, 
  // zoom: 3,
  bounds: [[ -126, 24], [-66, 50]], // bounding box (southwest corner, northeast corner)
  // maxBounds: [[ -135, 25],[-40, 53]], // bounding box (southwest corner, northeast corner)
  fitBoundsOptions: {
    padding: 15 // padding to keep the bounds away from the edge of the map
  },
  // projection: 'albers',
  // center: [-99.2, 40.0],
  // parallels: [27.5, 44.55]
});

let hoveredPolygonId = null;
let hoveredDistrictPolygonID = null;

map.on('load', () => {

  // hide basemap layers/labels that we don't want
  const hiddenLayers = [
  'country-label',
  'continent-label',
  'waterway-label',
  'water-line-label',
  'water-point-label'
];

  hiddenLayers.forEach(layerId => {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', 'none');
    }
  });

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
        'line-width': 1
      }
    });

    map.addSource('oregon_districts', {
      type: 'geojson',
      data: '/assets/data/geojson/oregon_districts.geojson',
      promoteId: 'GEOID',  // use GEOID as the unique ID
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
    // console.log(JSON.stringify(coords, null, 1));
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

        // if Oregon
    if(clickedFeature.id == 41){
      // add district lines
      map.addLayer({
        id: 'district-lines',
        type: 'line',
        source: 'oregon_districts',
        paint: {
          'line-color': '#627BC1',
          'line-width': 0.75
        }
      }, 'state-fills'); // Layer position 

      map.addLayer({
        id: 'district-fills',
        type: 'fill',
        source: 'oregon_districts',
        layout: {},
        paint: {
          'fill-color': '#627BC1',
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            1,
            0
          ]
        }
      });


      map.on('mousemove', 'district-fills', (e) => {
        const feature = e.features[0];
        const id = feature.id;

        if (!id) return;

        if (hoveredDistrictPolygonID !== null) {
          map.setFeatureState(
            { source: 'oregon_districts', id: hoveredDistrictPolygonID },
            { hover: false }
          );
        }

        hoveredDistrictPolygonID = id;

        map.setFeatureState(
          { source: 'oregon_districts', id: hoveredDistrictPolygonID },
          { hover: true }
        );
      });

      map.on('mouseleave', 'district-fills', () => {
        if (hoveredDistrictPolygonID !== null) {
          map.setFeatureState(
            { source: 'oregon_districts', id: hoveredDistrictPolygonID },
            { hover: false }
          );
        }
        hoveredDistrictPolygonID = null;
      });


            // show graphs
            showGraphs();

            // set graph container info about the current state
            // add code as needed



          }
        });
      });

function showGraphs(){
  document.querySelector('#infoContainer').style.display = 'none'
  document.querySelector('#graphContainer').style.display = 'flex'
}

function hideGraphs(){
  document.querySelector('#infoContainer').style.display = 'block'
  document.querySelector('#graphContainer').style.display = 'none'
}