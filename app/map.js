// define caches in outer scope
let geojsonCache = null;
let stateDataCache = null;
let districtDataCache = null;


document.addEventListener('DOMContentLoaded', () => {
  // const searchInput = document.querySelector('.search_query input');
  // const searchButton = document.querySelector('.search_query button');
  const fullExtentButton = document.querySelector('#full_extent');
  const raceSelectionButton = document.querySelectorAll('.race-selectBtn');
  // flag to determine whether user interaction has happened (don't sort on initial load)
  let userHasInteracted = false;


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

  // data

  raceSelectionButton.forEach(btn => {
  btn.addEventListener('click', function() {
    // Remove active class from all buttons
    raceSelectionButton.forEach(b => b.classList.remove('active'));

    // Add active class to clicked button
    this.classList.add('active');

    // Determine field based on button ID
    let fieldName;
    if (this.id === 'race-selectBlk') {
      fieldName = 'ENR_AP_GAP_BL';
    } else if (this.id === 'race-selectHis') {
      fieldName = 'ENR_AP_GAP_HI';
    }

    // Fill map
    fillMap(map, geojsonCache, stateDataCache, fieldName);

    // mark that the user has interacted to allow sorting
    userHasInteracted = true;

    // rebuild the state table so the table values reflect the newly selected race field
    // and then sort highest -> lowest on the 2021 column (index 3)
    if (stateDataCache) {
      buildStateTable(stateDataCache, fieldName);

      try {
        // only sort after an explicit user interaction
        if (userHasInteracted) {
          const table = $('#us-table').DataTable();
          // order by 2021 column (index 3) descending
          table.order([[3, 'desc']]).draw();
          console.log(`Table sorted by ${fieldName} (highest to lowest)`);
        }
      } catch (err) {
        console.warn('Unable to sort table after race selection:', err);
      }
    }
  });
});


  // searchButton.addEventListener('click', () => {
  //   const userInput = searchInput.value;
  //   console.log('User input:', userInput);
  // });

  const searchBox = new MapboxSearchBox();
  searchBox.placeholder = 'Zoom to a location...';
    searchBox.accessToken = mapboxgl.accessToken
    searchBox.options = {
        types: 'city,district,region,place,locality',
        proximity: map.getCenter(),  
        //bbox:[-135, 30, -90, 52] // Southwest coordinates, Northeast coordinates. Same as inset bounds
    };
    searchBox.marker = false; // no blue pin at result
    searchBox.mapboxgl = mapboxgl;
    searchBox.componentOptions = { allowReverse: true, flipCoordinates: true };
    console.log('loaded search box')
    //map.addControl(searchBox, 'top-right');
    document.getElementById('search_box_holder').appendChild(searchBox);
    searchBox.bindMap(map);




  fullExtentButton.addEventListener('click', () => {
    districtPopup.remove()
    // document.getElementById('mapLegend').style.display = 'none'; // hide legend
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




   // State Overview close button and other interactions
    const closeBtnState = document.getElementById('closeStateOverview');
    const StateOverview = document.getElementById('StateOverviewContainer');

    if (closeBtnState && StateOverview) {
      closeBtnState.addEventListener('click', () => {
        StateOverview.style.display = 'none';
      });
    }
});

mapboxgl.accessToken =  MAPBOXTOKEN

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/dark-v11',
  maxZoom : 10, 
  minZoom : 2, 
  // zoom: 3,
  bounds: [[ -126, 24], [-66, 50]], // bounding box (southwest corner, northeast corner)
  maxBounds: [[ -135, 25],[-40, 53]], // bounding box (southwest corner, northeast corner)
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
let selectedPolygonId = null; // for click selection

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
    data: 'https://docs.mapbox.com/mapbox-gl-js/assets/us_states.geojson',
    promoteId: 'STATE_ID'  // use STATE_ID as the unique ID
  });

  // oregon districts only - JSON in repo
  map.addSource('oregon_districts', {
      type: 'geojson',
      data: '/assets/data/geojson/oregon_districts.geojson',
      promoteId: 'GEOID'  // use GEOID as the unique ID
  });

  // all districts - mapbox hosted tileset
  map.addSource('SCHOOLDIST_TL24', {
      type: 'vector',
      url: 'mapbox://infographics.4fmvcuuh',
      promoteId: 'GEOID'  // use GEOID as the unique ID
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
  paint: {
      'fill-color': [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        'rgba(1, 1, 0, 1)',                   // <-- solid yellow when selected
        'rgba(0, 0, 0, 0)'          // transparent otherwise
      ],
      'fill-opacity': 0.8
    }
});

getStateData().then(({ geojson, stateData }) => {
  geojsonCache = geojson;
  stateDataCache = stateData;

  buildStateTable(stateDataCache, 'ENR_AP_GAP_BL'); // build table with default field
  fillMap(map, geojsonCache, stateDataCache, 'ENR_AP_GAP_BL'); // default map coloring
});


  map.addLayer({
    id: 'state-borders',
    type: 'line',
    source: 'states',
    layout: {},
    paint: {
      'line-color': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        yellow,   // when hover = true
        green       // default
      ],
      'line-width': 2,
      'line-offset': [
      'case',
      ['boolean', ['feature-state', 'hover'], false],
        2, // shift only highlighted border inward
        0   // default border no shift
      ]
    }
  });


  map.on('mousemove', 'state-fills', (e) => {
      if (!e.features.length) return;

      const fips = e.features[0].id;  // FIPS is the feature id

      if (hoveredPolygonId === fips) return; // already highlighted

      // clear previous highlight
      if (hoveredPolygonId !== null) {
        map.setFeatureState({ source: 'states', id: hoveredPolygonId }, { hover: false });
      }
      // update hoveredPolygonId with new val
      hoveredPolygonId = fips;

      // set new highlight
      map.setFeatureState({ source: 'states', id: hoveredPolygonId }, { hover: true });

      // Highlight the table by hoveredPolygonId, state FIPS code (like "41")
      highlightTableByFIPS(fips) 
  });


  map.on('mouseleave', 'state-fills', () => {
    if (hoveredPolygonId !== null) {
      map.setFeatureState({ source: 'states', id: hoveredPolygonId }, { hover: false });
      hoveredPolygonId = null;
    }

    clearTableHighlights();
  });

  map.on('click', 'state-fills', function (e) {
    const clickedFeature = e.features[0];
    console.log(clickedFeature)
    // document.getElementById('mapLegend').style.display = 'block'; // display legend

      // zoom to state
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

      // clear old selection
  if (selectedPolygonId !== null) {
    map.setFeatureState(
        { source: 'states', id: selectedPolygonId },
        { selected: false }
      );
    }

    // set new selection
    selectedPolygonId = clickedFeature.id;
    map.setFeatureState(
      { source: 'states', id: selectedPolygonId },
      { selected: true }
    );

    // fill fact sheet
    const fieldName = 'ENR_AP_GAP_BL';
    initFactSheet(stateDataCache, clickedFeature.id, fieldName);


    // if Oregon ( for POC)
    if(clickedFeature.id > 0){
      // map.addLayer({
      //   id: 'district-fills',
      //   type: 'fill',
      //   source: 'oregon_districts',
      //   promoteId: 'GEOID',
      //   layout: {},
      //   paint: {
      //    'fill-color': [
      //     'case',
      //     ['boolean', ['feature-state', 'hover'], false],
      //      yellow, // yellow for hover
      //     [
      //       'match',
      //       ['feature-state', 'urban_score'],
      //       'NA', verydarkgrey,      // verydarkgrey for NA
      //       '1', '#145214',       // green shades
      //       '2', '#2c7a2c',
      //       '3', '#4caf50',
      //       '4', '#80e27e',
      //       '5', '#b9ffb9',
      //       verydarkgrey            
      //     ]
      //   ],
      //     'fill-opacity': 1
      //   }
      
      
      // });
      
      const StateOverview = document.getElementById('StateOverviewContainer');
      if (StateOverview) {
        StateOverview.style.display = 'block'; 
        // initStateOverview();// Make it visible

      }

      

      // // add district lines
      // map.addLayer({
      //   id: 'district-lines',
      //   type: 'line',
      //   source: 'oregon_districts',
      //   paint: {
      //     'line-color': verydarkgrey,
      //     'line-width': 0.5,
      //     'line-opacity': 0.9
      //   }
      // });



      // map.on('mousemove', 'district-fills', (e) => {
      //   const feature = e.features[0];
      //   const id = feature.id;
      //   const props = feature.properties;
      //   if (!id) return;

      //   // Clear previous hover state
      //   if (hoveredDistrictPolygonID !== null) {
      //     map.setFeatureState(
      //       { source: 'oregon_districts', id: hoveredDistrictPolygonID },
      //       { hover: false }
      //     );
      //   }

      //   hoveredDistrictPolygonID = id;

      //   // Set new hover state
      //   map.setFeatureState(
      //     { source: 'oregon_districts', id: hoveredDistrictPolygonID },
      //     { hover: true }
      //   );

      //   console.log('Hovered district ID:', hoveredDistrictPolygonID);

      //   // Fetch external district data
      //   const DistDataUrl = '../assets/data/json/Oregon/OR_dist_overview_update.json';
      //   fetch(DistDataUrl)
      //     .then(res => res.json())
      //     .then(stateData => {

      //       // Find the district data matching the hovered polygon ID
      //       const hoveredDistrictData = stateData.Data.find(
      //         d => {
      //           if (!hoveredDistrictPolygonID) return false;
      //           return d.LEAID === hoveredDistrictPolygonID;
      //         }
      //       );
      //       if (!hoveredDistrictData) {
      //         console.warn('No matching LEAID found:', hoveredDistrictPolygonID);
      //         return;
      //       }

      //       const isDownward = props.AWATER % 2 === 0;
      //       const directionArrow = isDownward ? '🡻' : '🡹';
      //       const directionClass = isDownward ? 'arrow-down' : 'arrow-up';

      //       districtPopup
      //         .setLngLat(e.lngLat)
      //         .setHTML(`
      //           <div class="popup-content">
      //             <strong>${props.NAME}</strong><br>
      //             Grades: ${props.LOGRADE}–${props.HIGRADE}<br>
      //             Students: ${hoveredDistrictData.num_students}<br> 
      //             Teachers: ${hoveredDistrictData.num_teachers}<br> 
      //             <b>Opportunity Estimates</b><br>
      //             <div class="opportunity-row">
      //               <div class="arrow ${directionClass}">${directionArrow}</div>
      //               <div class="opportunity-text">
      //                 2011–12: xx<br>
      //                 2021–22: xx
      //               </div>
      //             </div>
      //           </div>
      //         `)
      //         .addTo(map);

      //       showGraphs(); //only runs when data is available
      //     })
      //     .catch(error => {
      //       console.error('Error loading data:', error);
      //     });
      // });


      // map.on('mouseleave', 'district-fills', () => {
      //   // Remove hover highlight
      //   if (hoveredDistrictPolygonID !== null) {
      //     map.setFeatureState(
      //       { source: 'oregon_districts', id: hoveredDistrictPolygonID },
      //       { hover: false }
      //     );
      //     hoveredDistrictPolygonID = null;
      //   }

      //   // Close the district popup
      //   if (districtPopup) {
      //     districtPopup.remove();
      //   }

      //   // Optional: reset the cursor
      //   map.getCanvas().style.cursor = '';
      // });


            // show graphs
            showGraphs();
            //fillDistricts(map) // dummy data

            // set graph container info about the current state
            // add code as needed



          }
  });
});

// Fetch data
function getStateData() {
  const geojsonUrl = 'https://docs.mapbox.com/mapbox-gl-js/assets/us_states.geojson';
  const stateDataUrl = '../assets/data/json/ap_equity_states.json';

  return Promise.all([
    fetch(geojsonUrl).then(res => res.json()),
    fetch(stateDataUrl).then(res => res.json())
  ])
  .then(([geojson, stateData]) => {
    console.log('Fetched GeoJSON:', geojson);
    console.log('Fetched State JSON:', stateData);
    return { geojson, stateData };
  })
  .catch(error => {
    console.error('Error loading data:', error);
  });
}


function getDistrictData(state) {
  console.log(`getting data for ${state}`);
  const districtDataUrl = '../assets/data/json/ap_equity_districts.json';

  return fetch(districtDataUrl)
    .then(res => res.json())
    .then(districtData => {
      console.log('Fetched District JSON:', districtData);
      // new data is an array, not an object
      return districtData;
    })
    .catch(error => {
      console.error('Error loading district data:', error);
    });
}

// Build the state table (2011 + 2021 only)
function buildStateTable(stateData, fieldName) {
  // Destroy existing DataTable if present
  if ($.fn.dataTable && $.fn.dataTable.isDataTable('#us-table')) {
    try {
      $('#us-table').DataTable().clear().destroy();
      document.querySelector('#us-table tbody').innerHTML = '';
    } catch (e) {
      console.warn('Error destroying existing DataTable:', e);
    }
  }

  // 🧩 Custom sort: numbers with “N/A” always last
  jQuery.extend(jQuery.fn.dataTable.ext.type.order, {
    'na-last-asc': function (a, b) {
      const valA = (a === 'N/A' || a === null || a === '—') ? Infinity : parseFloat(a);
      const valB = (b === 'N/A' || b === null || b === '—') ? Infinity : parseFloat(b);
      return valA - valB;
    },
    'na-last-desc': function (a, b) {
      const valA = (a === 'N/A' || a === null || a === '—') ? -Infinity : parseFloat(a);
      const valB = (b === 'N/A' || b === null || b === '—') ? -Infinity : parseFloat(b);
      return valB - valA;
    }
  });

  // Initialize DataTable
  const table = new DataTable('#us-table', {
    paging: false,
    scrollCollapse: true,
    scrollY: '200px',
    columnDefs: [
      { targets: 4, visible: false }, // hide FIPS
      { targets: [1, 2, 3], type: 'na-last' } // apply custom sort
    ]
  });

  // Populate rows
  for (let state in stateData) {
    const stateArray = stateData[state];

    const yr2011 = stateArray.find(d => d.YEAR === 2011);
    const yr2021 = stateArray.find(d => d.YEAR === 2021);

    const ap = yr2021?.ENR_AP ?? 'N/A';
    const val2011Raw = yr2011?.[fieldName];
    const val2021Raw = yr2021?.[fieldName];
    const stateAbbrev = yr2011?.state_abbrev ?? yr2021?.state_abbrev ?? '';
    const fips = yr2011?.FIPS ?? yr2021?.FIPS ?? '';

    // Format display values
    const val2011 = typeof val2011Raw === 'number' ? val2011Raw.toFixed(2) : '—';
    const val2021 = typeof val2021Raw === 'number' ? val2021Raw.toFixed(2) : '—';
    const apDisplay = typeof ap === 'number' ? ap.toLocaleString() : '—';

    table.row.add([stateAbbrev, apDisplay, val2011, val2021, fips]);
  }

  table.draw();
}

function buildDistrictTable(districtData, fieldName) {
  // Custom sort for N/A
  jQuery.extend(jQuery.fn.dataTable.ext.type.order, {
    'na-last-asc': (a, b) => {
      const valA = (a === 'N/A' || a === null || a === '—') ? Infinity : parseFloat(a);
      const valB = (b === 'N/A' || b === null || b === '—') ? Infinity : parseFloat(b);
      return valA - valB;
    },
    'na-last-desc': (a, b) => {
      const valA = (a === 'N/A' || a === null || a === '—') ? -Infinity : parseFloat(a);
      const valB = (b === 'N/A' || b === null || b === '—') ? -Infinity : parseFloat(b);
      return valB - valA;
    }
  });

  // Destroy existing table if exists
  if ($.fn.dataTable && $.fn.dataTable.isDataTable('#district-table')) {
    try {
      $('#district-table').DataTable().clear().destroy();
      document.querySelector('#district-table tbody').innerHTML = '';
    } catch (e) { console.warn(e); }
  }

  const table = new DataTable('#district-table', {
    paging: false,
    scrollCollapse: true,
    scrollY: '300px',
    columnDefs: [
      { targets: 6, visible: false }, // hide LEAID/internal
      { targets: [2, 3, 4, 5], type: 'na-last' } // numeric columns
    ]
  });

  // Group by LEAID
  const grouped = {};
  for (const d of districtData) {
    const id = d.LEAID ?? Math.random();
    if (!grouped[id]) grouped[id] = [];
    grouped[id].push(d);
  }

  for (const id in grouped) {
    const records = grouped[id];

    // Filter by year
    const yr2011 = records.find(r => r.YEAR === 2011);
    const yr2021 = records.find(r => r.YEAR === 2021 || r.YEAR === 2020 || r.YEAR === 2021); // pick last available if exact 2021 missing

    const districtName = yr2021?.LEA_NAME ?? yr2011?.LEA_NAME ?? 'Unknown';
    const stateAbbrev = yr2021?.LEA_STATE ?? yr2011?.LEA_STATE ?? '—';
    const numStudents = yr2021?.ENR ?? yr2011?.ENR ?? '—';
    const numTeachers = yr2021?.SCH_FTETEACH_TOT ?? yr2011?.SCH_FTETEACH_TOT ?? '—';

    // Pull the Opportunity Estimate from your chosen field, filtered by year
    const val2011Raw = yr2011?.[fieldName];
    const val2021Raw = yr2021?.[fieldName];

    const val2011 = typeof val2011Raw === 'number' ? val2011Raw.toFixed(2) : '—';
    const val2021 = typeof val2021Raw === 'number' ? val2021Raw.toFixed(2) : '—';
    const studentsDisplay = typeof numStudents === 'number' ? numStudents.toLocaleString() : '—';
    const teachersDisplay = typeof numTeachers === 'number' ? numTeachers.toLocaleString() : '—';

    table.row.add([
      stateAbbrev,
      districtName,
      studentsDisplay,
      teachersDisplay,
      val2011,
      val2021,
      id
    ]);
  }

  table.draw();
}



function highlightTableByFIPS(fipsCode) {
  const table = $('#us-table').DataTable();

  // clear old selection
  table.$('tr.selected').removeClass('selected');

  // loop rows and find match in hidden FIPS column
  table.rows().every(function() {
    const rowData = this.data();
    if (String(rowData[4]) === String(fipsCode)) { // column index 4 = FIPS
      $(this.node()).addClass('selected');
      
      // to do: scroll into view
      //this.scrollTo();
    }
  });
}

function clearTableHighlights() {
  const table = $('#us-table').DataTable();
  table.$('tr.selected').removeClass('selected');
}

function fillMap(map, geojson, stateData, fieldName) {
  const valueMap = {};
  let minVal = Infinity;
  let maxVal = -Infinity;

  // Extract values & track min/max
  for (let state in stateData) {
    const val2021Raw = stateData[state][1]?.[fieldName];
    if (typeof val2021Raw === 'number') {
      valueMap[state] = val2021Raw;
      if (val2021Raw < minVal) minVal = val2021Raw;
      if (val2021Raw > maxVal) maxVal = val2021Raw;
    }
  }

  // Make a copy of geojson so we don't mutate the original
  const geojsonCopy = JSON.parse(JSON.stringify(geojson));

  // Merge selected field's 2021 values into copy
  geojsonCopy.features.forEach(f => {
    const stateId = f.properties.STATE_ID;
    if (valueMap[stateId] !== undefined) {
      f.properties[fieldName] = valueMap[stateId];
    }
  });

  // Push updated geojson into map source
  if (map.getSource('states')) {
    map.getSource('states').setData(geojsonCopy);
  }

  // Update map coloring
  if (map.getLayer('state-fills')) {
    map.setPaintProperty('state-fills', 'fill-color', [
      "interpolate",
      ["linear"],
      ["get", fieldName],
      minVal, "#5a6251",
      maxVal, "#e5e8e3"
    ]);
  } else {
    console.warn("Layer 'state-fills' does not exist yet");
  }
}

function getStateValues(stateData, state, fieldName) {
  const val2011Raw = stateData[state][0]?.[fieldName];
  const val2021Raw = stateData[state][1]?.[fieldName];
  return { val2011Raw, val2021Raw };
}


// example function to color districts. Uses fake data.
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
    // .catch(error => console.error('Error fetching districts GeoJSON:', error));
  });
}





function showGraphs(){
  document.querySelector('#infoContainer').style.display = 'none'
  document.querySelector('#factSheetContainer').style.display = 'flex'
}

function hideGraphs(){
  document.querySelector('#infoContainer').style.display = 'block'
  document.querySelector('#factSheetContainer').style.display = 'none'
}