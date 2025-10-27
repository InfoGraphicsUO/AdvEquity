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
    fillStateMap(map, geojsonCache, stateDataCache, fieldName);

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

    $('#race-selectBlk').click() // trigger returning gto US view with Opportunity Estimate for Black Students
    //StateOverview.style.display = 'none'; // hide state panel

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
    padding: 30 // padding to keep the bounds away from the edge of the map
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


  // hide labels that we don't want
  // List of label layers that use the worldview property
  const labelLayers = [
  'state-label',
  'settlement-label',
  'settlement-subdivision-label',
  'airport-label',
  'road-label-simple',
  'natural-line-label',
  'natural-point-label',
  'poi-label',
  'settlement-minor-label',
  'settlement-major-label',
  ];

  // Filter to show only US 
labelLayers.forEach(layerId => {
    // Check if the layer exists before applying the filter
    if (map.getLayer(layerId)) {
      // Use the 'any' expression to check multiple possible country code properties
      map.setFilter(layerId, [
        'any',
        ['==', ['get', 'iso_3166_1'], 'US'], // For country-level features
        ['==', ['get', 'iso_3166_2'], 'US'], // For state/province-level features (may not apply)
        ['==', ['get', 'country_code'], 'USA'], // Another common property name
      ]);
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
  // map.addLayer({
  //     id: 'district-fills',
  //     type: 'fill', 
  //     source: 'SCHOOLDIST_TL24', 
  //     'source-layer': 'SCHOOLDIST_TL24_Simpl100m-2kf22l', 
  //     paint: {
  //         'fill-color': 'transparent',
  //     }
  // });


  // map.addLayer({
  //     id: 'district-lines',
  //     type: 'line', // or line
  //     source: 'SCHOOLDIST_TL24', 
  //     'source-layer': 'SCHOOLDIST_TL24_Simpl100m-2kf22l', 
  //     paint: {
  //       'line-color': darkGreen,
  //       'line-width': 1
  //     }

  // });

  map.addLayer({
  id: 'state-fills',
  type: 'fill',
  source: 'states',
  paint: {
      'fill-color': [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        'rgba(1, 1, 0, 1)',                   // <-- solid yellow when selected (hovered)
        'rgba(0, 0, 0, 0)'          // transparent otherwise
      ],
      'fill-opacity': 0.8
    }
});

getStateData().then(({ geojson, stateData }) => {
  geojsonCache = geojson;
  stateDataCache = stateData;

  buildStateTable(stateDataCache, 'ENR_AP_GAP_BL'); // build table with default field
  fillStateMap(map, geojsonCache, stateDataCache, 'ENR_AP_GAP_BL'); // default map coloring
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

  // TABLE HOVER FUNCTIONALITY
  // --- When table row is hovered ---

$('#us-table tbody').on('mouseenter', 'tr', function() {
  const table = $('#us-table').DataTable();
  const rowData = table.row(this).data();
  if (!rowData) return;

  const fips = rowData[4]; // the last column
  console.log(fips)

  // Clear previous highlight
  if (hoveredPolygonId !== null) {
    map.setFeatureState({ source: 'states', id: hoveredPolygonId }, { hover: false });
  }

  // Highlight new feature
  hoveredPolygonId = fips;
  map.setFeatureState({ source: 'states', id: hoveredPolygonId }, { hover: true });
});

$('#us-table tbody').on('mouseleave', 'tr', function() {
  const table = $('#us-table').DataTable();
  const rowData = table.row(this).data();
  if (!rowData) return;

  const fips = rowData[4];

  // Remove highlight if it's the same one
  if (hoveredPolygonId === fips) {
    map.setFeatureState({ source: 'states', id: hoveredPolygonId }, { hover: false });
    hoveredPolygonId = null;
  }
});

// END HOVER FUTIONALITY


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

    map.fitBounds(bounds, { padding: 30 });

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


    //   map.on('mousemove', 'district-fills', (e) => {
    //     const feature = e.features[0];
    //     const id = feature.id;
    //     const props = feature.properties;
    //     console.log(props)
    //     if (!id) return;

    //   });

    //     // // Clear previous hover state
    //     // if (hoveredDistrictPolygonID !== null) {
    //     //   map.setFeatureState(
    //     //     { source: 'oregon_districts', id: hoveredDistrictPolygonID },
    //     //     { hover: false }
    //     //   );
    //     // }

    //   //   hoveredDistrictPolygonID = id;

    //   //   // Set new hover state
    //   //   map.setFeatureState(
    //   //     { source: 'oregon_districts', id: hoveredDistrictPolygonID },
    //   //     { hover: true }
    //   //   );

    //   //   console.log('Hovered district ID:', hoveredDistrictPolygonID);

    //   //   // Fetch external district data
    //   //   const DistDataUrl = '../assets/data/json/Oregon/OR_dist_overview_update.json';
    //   //   fetch(DistDataUrl)
    //   //     .then(res => res.json())
    //   //     .then(stateData => {

    //   //       // Find the district data matching the hovered polygon ID
    //   //       const hoveredDistrictData = stateData.Data.find(
    //   //         d => {
    //   //           if (!hoveredDistrictPolygonID) return false;
    //   //           return d.LEAID === hoveredDistrictPolygonID;
    //   //         }
    //   //       );
    //   //       if (!hoveredDistrictData) {
    //   //         console.warn('No matching LEAID found:', hoveredDistrictPolygonID);
    //   //         return;
    //   //       }

    //   //       const isDownward = props.AWATER % 2 === 0;
    //   //       const directionArrow = isDownward ? '🡻' : '🡹';
    //   //       const directionClass = isDownward ? 'arrow-down' : 'arrow-up';

    //   //       districtPopup
    //   //         .setLngLat(e.lngLat)
    //   //         .setHTML(`
    //   //           <div class="popup-content">
    //   //             <strong>${props.NAME}</strong><br>
    //   //             Grades: ${props.LOGRADE}–${props.HIGRADE}<br>
    //   //             Students: ${hoveredDistrictData.num_students}<br> 
    //   //             Teachers: ${hoveredDistrictData.num_teachers}<br> 
    //   //             <b>Opportunity Estimates</b><br>
    //   //             <div class="opportunity-row">
    //   //               <div class="arrow ${directionClass}">${directionArrow}</div>
    //   //               <div class="opportunity-text">
    //   //                 2011–12: xx<br>
    //   //                 2021–22: xx
    //   //               </div>
    //   //             </div>
    //   //           </div>
    //   //         `)
    //   //         .addTo(map);

    //   //       showGraphs(); //only runs when data is available
    //   //     })
    //   //     .catch(error => {
    //   //       console.error('Error loading data:', error);
    //   //     });
    //   // });


    //   // map.on('mouseleave', 'district-fills', () => {
    //   //   // Remove hover highlight
    //   //   if (hoveredDistrictPolygonID !== null) {
    //   //     map.setFeatureState(
    //   //       { source: 'oregon_districts', id: hoveredDistrictPolygonID },
    //   //       { hover: false }
    //   //     );
    //   //     hoveredDistrictPolygonID = null;
    //   //   }



  });
});

const popup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false
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

  // Custom sort: numbers with “N/A” always last
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
      { targets: 5, visible: false }, // hide LEAID/internal
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
    // const yr2021 = records.find(r => r.YEAR === 2021 || r.YEAR === 2020 || r.YEAR === 2021); // pick last available if exact 2021 missing
    const yr2021 = records.find(r => r.YEAR === 2021); // pick last available if exact 2021 missing

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

function fillStateMap(map, geojson, stateData, fieldName) {
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

function fillDistrictMap(map, districtData, state_abbrev, statefips, fieldName, targetYear = 2021) {
  map.setPaintProperty('state-fills', 'fill-color', 'transparent');

  if (!map.getLayer('district-fills')) {
    map.addLayer({
      id: 'district-fills',
      type: 'fill',
      source: 'SCHOOLDIST_TL24',
      'source-layer': 'SCHOOLDIST_TL24_Simpl100m-2kf22l',
      filter: ['==', ['get', 'STATEFP'], statefips],
      paint: {
        'fill-color': 'transparent',
        'fill-opacity': 0.9
      }
    }, 'state-fills');//add below district-fills to keep hover color above

map.on('mousemove', 'district-fills', (e) => {
  map.getCanvas().style.cursor = 'pointer';

  const props = e.features[0].properties;
  const description = `
    <div style="font-family:sans-serif; font-size:13px; line-height:1.4;">
      <strong>${props.NAME}</strong><br>
    </div>
  `;

  popup.setLngLat(e.lngLat).setHTML(description).addTo(map);
});

    

    map.on('mouseleave', 'district-fills', () => {
      map.getCanvas().style.cursor = '';
      popup.remove();
    });


  } else {
    map.setFilter('district-fills', ['==', ['get', 'STATEFP'], statefips]);
  }

  // add district lines
  if (!map.getLayer('district-lines')){ 
    map.addLayer({
      id: 'district-lines',
      type: 'line',
      source: 'SCHOOLDIST_TL24',
      'source-layer': 'SCHOOLDIST_TL24_Simpl100m-2kf22l',
      filter: ['==', ['get', 'STATEFP'], statefips],
      paint: {
        'line-color': 'grey',
        'line-width': 0.5,
        'line-opacity': 0.9
      }
    });
  } else {
    map.setFilter('district-lines', ['==', ['get', 'STATEFP'], statefips]);
  }

  // Filter to the target year
  const filtered = districtData.filter(d => Number(d.YEAR) === targetYear);

  // Build lookup table: LEAID → value
  const valueMap = {};
  let minVal = Infinity;
  let maxVal = -Infinity;

  // filter out nulls
  for (const d of filtered) {
    const raw = d[fieldName];

    // Only handle finite numeric values
    if (raw !== null && raw !== undefined && !isNaN(Number(raw))) {
      const val = Number(raw);
      const leaId = String(d.LEAID);
      valueMap[leaId] = val;
      if (val < minVal) minVal = val;
      if (val > maxVal) maxVal = val;
    }
  }


  if (!isFinite(minVal) || !isFinite(maxVal)) {
    console.warn(`No valid data for ${state_abbrev} / ${fieldName} / ${targetYear}`);
    map.setPaintProperty('district-fills', 'fill-color', 'transparent');
    return;
  }

  if (minVal === maxVal) maxVal = minVal + 0.00001;
  if (minVal > maxVal) [minVal, maxVal] = [maxVal, minVal];

  // Interpolate by feature-state "value"
  const colorRamp = [
    "interpolate",
    ["linear"],
    ["feature-state", "value"],
    minVal, "#5a6251",
    maxVal, "#e5e8e3",
  ];

  map.setPaintProperty('district-fills', 'fill-color', colorRamp);

  // Wait until the source data is ready before assigning feature-states
  map.on('sourcedata', (e) => {
    if (e.sourceId === 'SCHOOLDIST_TL24' && e.isSourceLoaded) {
      const features = map.querySourceFeatures('SCHOOLDIST_TL24', {
        sourceLayer: 'SCHOOLDIST_TL24_Simpl100m-2kf22l'
      });

      for (const f of features) {
        const geoId = String(f.id);
        const val = valueMap[geoId];
        if (val !== undefined) {
          map.setFeatureState(
            {
              source: 'SCHOOLDIST_TL24',
              sourceLayer: 'SCHOOLDIST_TL24_Simpl100m-2kf22l',
              id: geoId
            },
            { value: val }
          );
        }
      }
    }
  });


  // district  interaction
  map.on('click', 'district-fills', function (e) {
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

    map.fitBounds(bounds, { padding: 30 });

    // fill factsheet area:
     showDistrictFactsheet(clickedFeature, districtData);


  });
  

}


// --- District fact sheet ---
function showDistrictFactsheet(clickedFeature, districtData) {
  const geoId = String(clickedFeature.properties.GEOID);
  const records = districtData.filter(d => String(d.LEAID) === geoId);

  const factSheetContainer = document.getElementById("factSheetContainer");

  if (!records.length) {
    factSheetContainer.innerHTML = `
      <h2><b>No data found for District ID ${geoId}</b></h2>
      <div class="opportunity-column">No district data available.</div>
    `;
    return;
  }

  // Sort by YEAR ascending
  records.sort((a, b) => a.YEAR - b.YEAR);
  const latest = records[records.length - 1];
  const leaName = latest.LEA_NAME || "Unknown district";
  const latestYear = latest.YEAR;

  // Unified colors for both charts
  const colors = { WH: "#a6cee3", HI: "#d95f02", BL: "#1b9e77", AS: "#7570b3", OTH: "#555" };

  // --- Dropdown of district names ---
  const districtNames = districtData
    .map(d => d.LEA_NAME)
    .filter((v, i, a) => v && a.indexOf(v) === i)
    .sort();

  const dropdownHtml = `
    <br><br><label for="districtPicker" style="align-self: center;">Jump to District</label>
<select id="districtPicker" style="align-self: center; margin-bottom: 10px; max-width: 300px;">
  ${districtNames.map(name => `<option value="${name}">${toTitleCase(name)}</option>`).join('')}
</select>
  `;

  // --- Build factsheet HTML (District) ---
  factSheetContainer.classList.add("full-width"); // full width top row
  factSheetContainer.innerHTML = `
    <div class="opportunity-row"><h2><b>${toTitleCase(leaName)} Factsheet</b></h2></div>
    <div class="opportunity-row">
    <div class="opportunity-column">
      <p><b>Latest information</b></p>
      <p>
        Teachers (FTE): ${fmtValue(latest.SCH_FTETEACH_TOT, latestYear)}<br>
        Enrollment: ${fmtValue(latest.ENR, latestYear)}<br>
        HS Enrollment: ${fmtValue(latest.ENR_HS_TOT, latestYear)}<br>
        Student-teacher ratio: ${fmtValue(latest.STU_TEACH_RAT, latestYear)}<br>
        AP Enrollment: ${fmtValue(latest.ENR_AP, latestYear)}<br>
        Modal AP courses: ${fmtValue(latest.SCH_APCOURSES, latestYear)}<br>
        Number of schools: ${fmtValue(latest.SCHOOLS, latestYear)}<br>

      </p>
      <p><b>District Composition</b>
      <label class="composition-toggle">
        <input type="checkbox" id="compToggle">
        <small>show Bar</small>
      </label>
      </p>
      <canvas id="compDonut" width="300" height="100"></canvas>
      <canvas id="compBar" width="300" height="100" style="display:none;"></canvas>
    </div>

    <div class="opportunity-column">
      <p><b>Historic/temporal information</b></p>
      <canvas id="gapChart" width="300" height="120"></canvas>
      <div id="gapLegend" style="font-size:0.85em;margin-top:5px;"></div>
      <p style="font-size:0.9em;color:#666">AP Participation Gap by Year</p>
      ${dropdownHtml}
    </div> <!-- end row -->
    </div>  <!-- end column -->
  `  ;

  // --- Prepare comp data ---
  const compData = {
    WH: latest.PCT_ENR_WH,
    HI: latest.PCT_ENR_HI,
    BL: latest.PCT_ENR_BL,
    AS: latest.PCT_ENR_AS,
    OTH: latest.PCT_ENR_OTH
  };

  drawDonutChart("compDonut", compData, colors);
  drawCompositionBar("compBar", compData, colors);

  // Toggle between donut and bar
  document.getElementById("compToggle").addEventListener("change", function() {
    const showBar = this.checked;
    document.getElementById("compDonut").style.display = showBar ? "none" : "block";
    document.getElementById("compBar").style.display = showBar ? "block" : "none";
  });

  // --- Prepare gap chart data ---
  const years = records.map(r => r.YEAR);
  const series = {
    BL: records.map(r => r.ENR_AP_GAP_BL),
    AS: records.map(r => r.ENR_AP_GAP_AS),
    HI: records.map(r => r.ENR_AP_GAP_HI)
  };

  drawMiniChart("gapChart", years, series, { BL: colors.BL, AS: colors.AS, HI: colors.HI });
  drawLegend("gapLegend", series);
}


// get most recent year of data
function fmtValue(val, year, targetYear = 2021) {
  if (val == null || isNaN(val)) return "N/A";

  // Format number: if integer, keep as is; if float, round to 2 decimals
  let formatted;
  if (typeof val === "number") {
    formatted = Number.isInteger(val) ? val.toLocaleString() : val.toFixed(2);
  } else {
    formatted = val;
  }

  return year !== targetYear ? `${formatted} (${year})` : formatted;
}



function drawDonutChart(canvasId, data, colors) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // Sort entries ascending for legend order
  const entries = Object.entries(data).sort((a,b)=>(a[1]||0)-(b[1]||0));
  const total = entries.reduce((sum,[,v])=>sum+(v||0),0);
  const centerX = canvas.width/2;
  const centerY = canvas.height/2;
  const radius = Math.min(centerX, centerY)*0.8;
  let startAngle = -Math.PI/2;

  // Draw donut segments
  for(const [key,value] of entries){
    const sliceAngle = ((value||0)/total)*Math.PI*2;
    ctx.beginPath();
    ctx.fillStyle = colors[key]||"#000";
    ctx.moveTo(centerX,centerY);
    ctx.arc(centerX,centerY,radius,startAngle,startAngle+sliceAngle);
    ctx.closePath();
    ctx.fill();
    startAngle+=sliceAngle;
  }

  // Inner circle
  ctx.beginPath();
  ctx.fillStyle="#fff";
  ctx.arc(centerX,centerY,radius*0.6,0,Math.PI*2);
  ctx.fill();

  // Legend on left (ascending)
  const legendX = 5;
  let legendY = 20;
  ctx.font="12px sans-serif";
  ctx.textAlign="left";
  ctx.textBaseline="middle";

  for(const [key,value] of entries){
    ctx.fillStyle = colors[key]||"#000";
    ctx.fillRect(legendX,legendY-10,12,12);
    ctx.fillStyle="#000";
    ctx.fillText(`${key}: ${value}`,legendX+18,legendY);
    legendY+=16;
  }
}

// --- Draw horizontal composition bar with below legend for small segments ---
function drawCompositionBar(canvasId, data, colors) {
  const canvas = document.getElementById(canvasId);
  if(!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0,0,canvas.width,canvas.height);

  const entries = Object.entries(data);
  const total = entries.reduce((sum,[,v])=>sum+(v||0),0);

  const barHeight=30;
  const startY=20;
  let x=0;
  const legendEntries = [];

  ctx.font="12px sans-serif";
  ctx.textAlign="center";
  ctx.textBaseline="middle";

  // Draw stacked bar with internal labels if wide enough
  for(const [key,value] of entries){
    const width=(value||0)/total*canvas.width;
    ctx.fillStyle = colors[key]||"#000";
    ctx.fillRect(x,startY,width,barHeight);

    if(width>40){
      ctx.fillStyle="#fff";
      ctx.fillText(`${key}: ${value}`,x+width/2,startY+barHeight/2);
    } else {
      legendEntries.push([key,value]);
    }
    x+=width;
  }

  // Draw legend below bar for segments too small for inside label
  ctx.font="12px sans-serif";
  ctx.textAlign="left";
  ctx.textBaseline="middle";
  const legendPadding=5;
  let legendX=0;
  let legendY=startY+barHeight+15;
  const legendHeight=16;

  for(const [key,value] of legendEntries){
    const text=`${key}: ${value}`;
    const textWidth=ctx.measureText(text).width+18+legendPadding; // 18 for color box
    if(legendX+textWidth>canvas.width){
      legendX=0;
      legendY+=legendHeight;
    }
    // Color box
    ctx.fillStyle = colors[key]||"#000";
    ctx.fillRect(legendX,legendY-10,12,12);
    // Text
    ctx.fillStyle="#000";
    ctx.fillText(text,legendX+18,legendY);
    legendX+=textWidth;
  }
}



function drawMiniChart(canvasId, years, series, colors) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const padding = 30;
  const w = canvas.width - padding * 2;
  const h = canvas.height - padding * 1.5;

  // Flatten all values to get min/max
  const allVals = Object.values(series).flat().filter(v => v != null && !isNaN(v));
  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const xStep = w / (years.length - 1);

  // Draw lines and dots
  for (const [key, values] of Object.entries(series)) {
    ctx.beginPath();
    ctx.strokeStyle = colors[key] || "#000";
    ctx.lineWidth = 1.5;

    values.forEach((v, i) => {
      if (v == null || isNaN(v)) return;
      const x = padding + i * xStep;
      const y = padding + h - ((v - min) / (max - min)) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw dots
    values.forEach((v, i) => {
      if (v == null || isNaN(v)) return;
      const x = padding + i * xStep;
      const y = padding + h - ((v - min) / (max - min)) * h;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = colors[key] || "#000";
      ctx.fill();

      // Label 2021 point
      if (years[i] === 2021) {
        ctx.fillStyle = colors[key] || "#000";
        ctx.font = "10px sans-serif";
        ctx.fillText(v.toFixed(2), x + 4, y - 4);
      }
    });
  }

  // Draw x-axis labels (years)
  ctx.fillStyle = "#555";
  ctx.font = "10px sans-serif";
  years.forEach((yr, i) => {
    const x = padding + i * xStep - 8;
    ctx.fillText(yr.toString().slice(2), x, canvas.height - 5);
  });
}


function drawLegend(containerId, series) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const colors = { BL: "#1b9e77", AS: "#7570b3", HI: "#d95f02" };
  container.innerHTML = "";

  Object.keys(series).forEach(key => {
    const span = document.createElement("span");
    span.style.display = "inline-block";
    span.style.marginRight = "10px";
    span.style.color = colors[key];
    span.innerHTML = `<b>${key}</b>`;
    container.appendChild(span);
  });
}

function toTitleCase(str) {
  return str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}

function showGraphs(){
  document.querySelector('#infoContainer').style.display = 'none'
  document.querySelector('#factSheetContainer').style.display = 'flex'
}

function hideGraphs(){
  document.querySelector('#infoContainer').style.display = 'block'
  document.querySelector('#factSheetContainer').style.display = 'none'
}