document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.querySelector('.search_query input');
  const searchButton = document.querySelector('.search_query button');
  const fullExtentButton = document.querySelector('#full_extent');
  const RaceSelectorHis = document.querySelector('.race-selectHis button');
  const RaceSelectorBlk = document.querySelector('.race-selectBlk button');


  // get CSS colors:
  const root = document.documentElement;
  verydarkgrey = getComputedStyle(root).getPropertyValue('--verydarkgrey').trim();
  darkgrey = getComputedStyle(root).getPropertyValue('--darkgrey').trim();
  lightgrey = getComputedStyle(root).getPropertyValue('--lightgrey').trim();
  green = getComputedStyle(root).getPropertyValue('--green').trim();
  darkGreen = getComputedStyle(root).getPropertyValue('--darkGreen').trim();
  yellow = getComputedStyle(root).getPropertyValue('--yellow').trim();
  almostBlack = getComputedStyle(root).getPropertyValue('--almostBlack').trim();
  offwhite = getComputedStyle(root).getPropertyValue('--offwhite').trim();

  searchButton.addEventListener('click', () => {
    const userInput = searchInput.value;
    console.log('User input:', userInput);
  });

  fullExtentButton.addEventListener('click', () => {
    districtPopup.remove()
    document.getElementById('mapLegend').style.display = 'none'; // hide legend
    map.fitBounds([[ -126, 24], [-66, 50]]); // albers
    //map.jumpTo({ center: [-99.2, 40.0], zoom: 3 })
    // remove district layer if it exists
    if (map.getLayer("district-lines")){
      map.removeLayer('district-lines');
      map.removeLayer('district-fills');
    }
    hideGraphs();
    StateOverview.style.display = 'none'; // hide state panel

  });



  // Fetch the GeoJSON and build the table
  fillStateDataTable()
  
  /*
  fetch('https://docs.mapbox.com/mapbox-gl-js/assets/us_states.geojson')
    .then(response => response.json())
    .then(data => {
      buildOpportunityTable(data);
    })
    .catch(error => {
      console.error('Error loading GeoJSON:', error);
    });
    */
   // State Overview close button and other interactions
    const closeBtnState = document.getElementById('closeStateOverview');
    const StateOverview = document.getElementById('StateOverviewContainer');

    if (closeBtnState && StateOverview) {
      closeBtnState.addEventListener('click', () => {
        StateOverview.style.display = 'none';
      });
    }
});

mapboxgl.accessToken = 'pk.eyJ1IjoiaW5mb2dyYXBoaWNzIiwiYSI6ImNqaTR0eHhnODBjeTUzdmx0N3U2dWU5NW8ifQ.fVbTCmIrqILIzv5QGtVJ2Q'; ///TODO THIS NEEDS TO BE HIDDEN ADD TO CREDS FILE AND GITIGNORE

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

let hoveredPolygonId = null; // highlight state
let previousHighlightedRowId = null; // for highlighting state in table
let hoveredDistrictPolygonID = null; // highlight district

var districtPopup = new mapboxgl.Popup({
  closeButton: false,
  closeOnClick: false
});

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



  // SOURCES
  map.addSource('states', {
    type: 'geojson',
    data: 'https://docs.mapbox.com/mapbox-gl-js/assets/us_states.geojson'
  });

  // oregon districts only - JSON in repo
  map.addSource('oregon_districts', {
      type: 'geojson',
      data: '/assets/data/geojson/oregon_districts.geojson',
      promoteId: 'GEOID',  // use GEOID as the unique ID
  });

  // all districts - mapbox hosted tileset
  map.addSource('SCHOOLDIST_TL24', {
      type: 'vector',
      url: 'mapbox://infographics.4fmvcuuh',
      promoteId: 'GEOID',  // use GEOID as the unique ID
  });




  // LAYERS
  map.addLayer({
      id: 'SCHOOLDIST_TL24_-fills',
      type: 'fill', 
      source: 'SCHOOLDIST_TL24', 
      'source-layer': 'SCHOOLDIST_TL24_Simpl100m-2kf22l', 
      paint: {
          'fill-color': 'transparent',
      }
  });


  map.addLayer({
      id: 'SCHOOLDIST_TL24-lines',
      type: 'line', // or line
      source: 'SCHOOLDIST_TL24', 
      'source-layer': 'SCHOOLDIST_TL24_Simpl100m-2kf22l', 
      layout: {},
      paint: {
        'line-color': darkGreen,
        'line-width': 1
      }
  });


  map.addLayer({
    id: 'state-fills',
    type: 'fill',
    source: 'states',
    layout: {},
    paint: {
  'fill-color': [
    'case',
    ['==', ['get', 'STATE_ID'], '41'],
    yellow, // Oregon hovers yellow 
    '#cccccc'  // All others always gray
  ],
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
        'line-color': green,
        'line-width': 1
      }
    });

  map.on('mousemove', 'state-fills', (e) => {
    if (map.getZoom() >= 4) {
      if (hoveredPolygonId !== null) {
        map.setFeatureState({ source: 'states', id: hoveredPolygonId }, { hover: false });
        hoveredPolygonId = null;
      }

      if (previousHighlightedRowId) {
        const prevRow = document.getElementById(previousHighlightedRowId);
        if (prevRow) prevRow.classList.remove('highlighted');
        previousHighlightedRowId = null;
      }

      return;
    }

    if (e.features.length > 0) {
      if (hoveredPolygonId !== null) {
        map.setFeatureState({ source: 'states', id: hoveredPolygonId }, { hover: false });

        if (previousHighlightedRowId) {
          const prevRow = document.getElementById(previousHighlightedRowId);
          if (prevRow) prevRow.classList.remove('highlighted');
        }
      }

      hoveredPolygonId = e.features[0].id;
      console.log('Hovered state ID:', hoveredPolygonId);
      map.setFeatureState({ source: 'states', id: hoveredPolygonId }, { hover: true });

      // Here hoveredPolygonId is the state FIPS code (like "41")
      const rowId = 'row-' + String(hoveredPolygonId).padStart(2, '0');

      const row = document.getElementById(rowId);
      if (row) {
        row.classList.add('highlighted');
        previousHighlightedRowId = rowId;
      }
    }
  });

  map.on('mouseleave', 'state-fills', () => {
    if (hoveredPolygonId !== null) {
      map.setFeatureState({ source: 'states', id: hoveredPolygonId }, { hover: false });
      hoveredPolygonId = null;
    }

    if (previousHighlightedRowId) {
      const prevRow = document.getElementById(previousHighlightedRowId);
      if (prevRow) prevRow.classList.remove('highlighted');
      previousHighlightedRowId = null;
    }
  });

  map.on('click', 'state-fills', function (e) {
    const clickedFeature = e.features[0];
    document.getElementById('mapLegend').style.display = 'block'; // display legend

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

    // if Oregon ( for POC)
    if(clickedFeature.id == 41){
      map.addLayer({
        id: 'district-fills',
        type: 'fill',
        source: 'oregon_districts',
        promoteId: 'GEOID',
        layout: {},
        paint: {
         'fill-color': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
           yellow, // yellow for hover
          [
            'match',
            ['feature-state', 'urban_score'],
            'NA', verydarkgrey,      // verydarkgrey for NA
            '1', '#145214',       // green shades
            '2', '#2c7a2c',
            '3', '#4caf50',
            '4', '#80e27e',
            '5', '#b9ffb9',
            verydarkgrey            
          ]
        ],
          'fill-opacity': 1
        }
      
      
      });
      
      const StateOverview = document.getElementById('StateOverviewContainer');
      if (StateOverview) {
        StateOverview.style.display = 'block'; 
        initStateOverview();// Make it visible

      }

      

      // add district lines
      map.addLayer({
        id: 'district-lines',
        type: 'line',
        source: 'oregon_districts',
        paint: {
          'line-color': verydarkgrey,
          'line-width': 0.5,
          'line-opacity': 0.9
        }
      });



      map.on('mousemove', 'district-fills', (e) => {
        const feature = e.features[0];
        const id = feature.id;
        const props = feature.properties;
        if (!id) return;

        // Clear previous hover state
        if (hoveredDistrictPolygonID !== null) {
          map.setFeatureState(
            { source: 'oregon_districts', id: hoveredDistrictPolygonID },
            { hover: false }
          );
        }

        hoveredDistrictPolygonID = id;

        // Set new hover state
        map.setFeatureState(
          { source: 'oregon_districts', id: hoveredDistrictPolygonID },
          { hover: true }
        );

        console.log('Hovered district ID:', hoveredDistrictPolygonID);

        // Fetch external district data
        const DistDataUrl = '../assets/data/json/Oregon/OR_dist_overview_update.json';
        fetch(DistDataUrl)
          .then(res => res.json())
          .then(stateData => {

            // Find the district data matching the hovered polygon ID
            const hoveredDistrictData = stateData.Data.find(
              d => {
                if (!hoveredDistrictPolygonID) return false;
                return d.LEAID === hoveredDistrictPolygonID;
              }
            );
            if (!hoveredDistrictData) {
              console.warn('No matching LEAID found:', hoveredDistrictPolygonID);
              return;
            }

            const isDownward = props.AWATER % 2 === 0;
            const directionArrow = isDownward ? '🡻' : '🡹';
            const directionClass = isDownward ? 'arrow-down' : 'arrow-up';

            districtPopup
              .setLngLat(e.lngLat)
              .setHTML(`
                <div class="popup-content">
                  <strong>${props.NAME}</strong><br>
                  Grades: ${props.LOGRADE}–${props.HIGRADE}<br>
                  Students: ${hoveredDistrictData.num_students}<br> 
                  Teachers: ${hoveredDistrictData.num_teachers}<br> 
                  <b>Opportunity Estimates</b><br>
                  <div class="opportunity-row">
                    <div class="arrow ${directionClass}">${directionArrow}</div>
                    <div class="opportunity-text">
                      2011–12: xx<br>
                      2021–22: xx
                    </div>
                  </div>
                </div>
              `)
              .addTo(map);

            showGraphs(); //only runs when data is available
          })
          .catch(error => {
            console.error('Error loading data:', error);
          });
      });


      map.on('mouseleave', 'district-fills', () => {
        // Remove hover highlight
        if (hoveredDistrictPolygonID !== null) {
          map.setFeatureState(
            { source: 'oregon_districts', id: hoveredDistrictPolygonID },
            { hover: false }
          );
          hoveredDistrictPolygonID = null;
        }

        // Close the district popup
        if (districtPopup) {
          districtPopup.remove();
        }

        // Optional: reset the cursor
        map.getCanvas().style.cursor = '';
      });


            // show graphs
            showGraphs();
            fillDistricts(map) // dummy data

            // set graph container info about the current state
            // add code as needed



          }
  });
});

function buildOpportunityTable(geojson, stateData) {
  const container = document.getElementById('us-opportunity-table');
  container.innerHTML = '';
  // Create header row
  const headerRow = document.createElement('div');
  headerRow.className = 'row header-row';
  headerRow.innerHTML = `
    <div class="cell state">State</div>
    <div class="cell ap-classes">Modal # of AP Classes (Student-Weighted)</div>
    <div class="cell opp-11">Opportunity Estimate 2011–12</div>
    <div class="cell opp-21">Opportunity Estimate 2021–22</div>
  `;
  container.appendChild(headerRow);

const sortedFeatures = geojson.features.slice().sort((a, b) => {

  if (a.id === 41) return -1; // a is Oregon → comes first
  if (b.id === 41) return 1;  // b is Oregon → comes first
  return Number(a.id) - Number(b.id)
});

  // Loop through GeoJSON features to create rows
  sortedFeatures.forEach((feature) => {
    const props = feature.properties;
    const stateName = props.STATE_NAME;
    const fips = props.STATE_ID.padStart(2, '0'); // ensure 2-digit ID

    // Default fallback if not Oregon
    let ap = '—';
    let opp11 = '—';
    let opp21 = '—';

    // Match only Oregon
    if (props.STATE_NAME === 'Oregon') {
      ap = stateData.weighted_mean_ap?.toFixed(2) ?? '—';
      opp11 = (stateData.opp_est_1 * 100).toFixed(1) + '%' ?? '—';
      opp21 = (stateData.opp_est_2 * 100).toFixed(1) + '%' ?? '—';
    }

    const row = document.createElement('div');
    row.className = 'row';
    row.id = `row-${fips}`;
    row.innerHTML = `
      <div class="cell state">${stateName}</div>
      <div class="cell ap-classes" id="ap-${fips}">${ap}</div>
      <div class="cell opp-11" id="opp11-${fips}">${opp11}</div>
      <div class="cell opp-21" id="opp21-${fips}">${opp21}</div>
    `;

    container.appendChild(row);
  });
}
function fillStateDataTable() {
  const geojsonUrl = 'https://docs.mapbox.com/mapbox-gl-js/assets/us_states.geojson';
  const stateDataUrl = '../assets/data/json/Oregon/OR_overview.json';

  Promise.all([
    fetch(geojsonUrl).then(res => res.json()),
    fetch(stateDataUrl).then(res => res.json())
  ])
  .then(([geojson, stateData]) => {
    console.log('Fetched GeoJSON:', geojson);
    console.log('Fetched State JSON:', stateData);

    buildOpportunityTable(geojson, stateData);
  })
  .catch(error => {
    console.error('Error loading data:', error);
  });
}

function fillDistricts(map, districtSourceId = 'oregon_districts', districtLayerId = 'district-fills') {
  fetch('/assets/data/geojson/oregon_districts.geojson')
    .then(response => response.json())
    .then(data => {
      data.features.forEach(feature => {
        const id = feature.properties.GEOID;
        if (!id) return;

        const name = feature.properties.NAME;
        let urbanScore = 'NA';

        const urbanLike = ['Portland', 'Salem', 'Eugene', 'Beaverton', 'Hillsboro'];
        if (urbanLike.some(city => name.includes(city))) {
          urbanScore = String(Math.floor(Math.random() * 5) + 1); // 1-5 as string
        } else {
          urbanScore = Math.random() > 0.5 ? String(Math.floor(Math.random() * 5) + 1) : 'NA';
        }

        map.setFeatureState(
          { source: districtSourceId, id: id },
          { urban_score: urbanScore }
        );
      });

      // update paint after all states are set
      map.setPaintProperty('district-fills', 'fill-color', [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        '#ffff00', // example hover color (yellow)
        [
          'match',
          ['feature-state', 'urban_score'],
          'NA', darkgrey,
          '1', '#145214',
          '2', '#2c7a2c',
          '3', '#4caf50',
          '4', '#80e27e',
          '5', '#b9ffb9',
          verydarkgrey // fallback
        ]
      ])
    .catch(error => console.error('Error fetching districts GeoJSON:', error));
  });
}





function showGraphs(){
  document.querySelector('#infoContainer').style.display = 'none'
  document.querySelector('#graphContainer').style.display = 'flex'
}

function hideGraphs(){
  document.querySelector('#infoContainer').style.display = 'block'
  document.querySelector('#graphContainer').style.display = 'none'
}