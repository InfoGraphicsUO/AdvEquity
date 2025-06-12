document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.querySelector('.search_query input');
  const searchButton = document.querySelector('.search_query button');
  const fullExtentButton = document.querySelector('#full_extent');


  // get CSS colors:
  const root = document.documentElement;
  verydarkgrey = getComputedStyle(root).getPropertyValue('--verydarkgrey').trim();
  darkgrey = getComputedStyle(root).getPropertyValue('--darkgrey').trim();
  lightgrey = getComputedStyle(root).getPropertyValue('--lightgrey').trim();
  green = getComputedStyle(root).getPropertyValue('--green').trim();
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

  });

  // Fetch the GeoJSON and build the table
  fetch('https://docs.mapbox.com/mapbox-gl-js/assets/us_states.geojson')
    .then(response => response.json())
    .then(data => {
      buildOpportunityTable(data);
    })
    .catch(error => {
      console.error('Error loading GeoJSON:', error);
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

  map.addSource('oregon_districts', {
      type: 'geojson',
      data: '/assets/data/geojson/oregon_districts.geojson',
      promoteId: 'GEOID',  // use GEOID as the unique ID
  });

  // LAYERS
  map.addLayer({
    id: 'state-fills',
    type: 'fill',
    source: 'states',
    layout: {},
    paint: {
      'fill-color': yellow,
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
        console.log(props)

        // SET STYLE
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

        // JOIN DATA BY ID
        // fake data:
        const isDownward = props.AWATER % 2 === 0;  // make up/down depend on if the awater is even or odd
        const directionArrow = isDownward ? '🡻' : '🡹';
        const directionClass = isDownward ? 'arrow-down' : 'arrow-up';

        // FILL POPUP
        // to do: fill missing values

        districtPopup
          .setLngLat(e.lngLat)
          .setHTML(`
            <div class="popup-content">
              <strong>${props.NAME}</strong><br>
              Grades: ${props.LOGRADE}–${props.HIGRADE}<br>
              Students: xx,xxx<br> 
              Teachers: xxx<br> 
              <b>Opportunity Estimates</b><br>
              <div class="opportunity-row">
                <div class="arrow ${directionClass}">${directionArrow}</div>
                <div class="opportunity-text">
                  2011–12: xx<br>
                  2021–22: xx
                </div>
              </div>
            </div>
            <!-- ADD OTHER INFO TO THE POPUP HERE -->
          `)          
          .addTo(map);

        // Call any other visual update (e.g., graphs)
        showGraphs();
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

function buildOpportunityTable(geojson) {
  const container = document.getElementById('us-opportunity-table');

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

  // Loop through GeoJSON features to create rows
  geojson.features.forEach((feature) => {
    const props = feature.properties;
    const stateName = props.STATE_NAME;
    const fips = props.STATE_ID.padStart(2, '0'); // ensure 2-digit ID

    const row = document.createElement('div');
    row.className = 'row';
    row.id = `row-${fips}`;
    row.innerHTML = `
      <div class="cell state">${stateName}</div>
      <div class="cell ap-classes" id="ap-${fips}">—</div>
      <div class="cell opp-11" id="opp11-${fips}">—</div>
      <div class="cell opp-21" id="opp21-${fips}">—</div>
    `;

    container.appendChild(row);
  });
}

function fillStateDataTable(){

  // TO DO get values for each state and load the table

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