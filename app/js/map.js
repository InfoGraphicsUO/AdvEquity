// define caches in outer scope
let geojsonCache = null;
let stateDataCache = null;
let districtDataCache = null;
let currentDistrictValueMap = {};
let firstSymbolId = null;


document.addEventListener('DOMContentLoaded', () => {
  // const searchInput = document.querySelector('.search_query input');
  // const searchButton = document.querySelector('.search_query button');
  const fullExtentButton = document.querySelector('#full_extent');

  // map-level "Back to state" button 
  const backToStateMapBtn = document.createElement('button');
  backToStateMapBtn.id = 'backToStateMapBtn';
  backToStateMapBtn.textContent = 'Back to state';
  // insert after the fullExtentButton if present
  if (fullExtentButton && fullExtentButton.parentNode) {
    fullExtentButton.parentNode.insertBefore(backToStateMapBtn, fullExtentButton.nextSibling);
  } else {
    // fallback: append to body
    document.body.appendChild(backToStateMapBtn);
  }

  // click handler- zoom back to the last district's state (stored when factsheet opens)
  backToStateMapBtn.addEventListener('click', () => {
    // Only active when in district view
    if (window.mapView !== 'district') {
      return;
    }

    const stateFP = window.lastDistrictStateFP || null;
    const stateAbbrev = window.lastDistrictStateAbbrev || null;
    
    // If no valid state info exists, do nothing (prevents error on initial load)
    if (!stateFP && !stateAbbrev) {
      console.warn('Back to state: No state info available');
      return;
    }

    // try geojsonCache first
    let stateFeature = null;
    if (typeof geojsonCache === 'object' && Array.isArray(geojsonCache.features)) {
      stateFeature = geojsonCache.features.find(f => {
        const p = f.properties || {};
        return String(p.STATEFP) === String(stateFP) || String(p.STATE_ID) === String(stateFP) || String((p.STATE_ABBR || p.STATE)) === String(stateAbbrev);
      });
    }

    function fitFeatureBoundsAndShowFacts(f, fips) {
      if (!f) return false;
      const coords = f.geometry && f.geometry.coordinates;
      const bounds = new mapboxgl.LngLatBounds();

      function extendBounds(coordinates) {
        if (typeof coordinates[0][0] === 'number') {
          coordinates.forEach(coord => bounds.extend(coord));
        } else {
          coordinates.forEach(extendBounds);
        }
      }
      const props = f.properties || {};
      let fipsToUse = fips;
      if (!fipsToUse || fipsToUse === null) {
        if (props.STATEFP !== undefined && props.STATEFP !== null && String(props.STATEFP).trim() !== '') fipsToUse = props.STATEFP;
        else if (props.STATE_ID !== undefined && props.STATE_ID !== null && String(props.STATE_ID).trim() !== '') fipsToUse = props.STATE_ID;
        else if (props.STATE_ABBR || props.STATE) {
          const abbr = String(props.STATE_ABBR || props.STATE).toUpperCase();
          try {
            if (typeof stateDataCache === 'object') {
              const stateKey = Object.keys(stateDataCache).find(k => {
                const arr = stateDataCache[k] || [];
                return arr.some(d => String(d.state_abbrev || '').toUpperCase() === abbr);
              });
              if (stateKey) fipsToUse = stateKey;
            }
          } catch (e) { /* non-fatal */ }
        }
      }

      // If feature has geometry, fit bounds; otherwise skip zoom but still show factsheet
      try {
        if (coords) {
          extendBounds(coords);
          map.fitBounds(bounds, { padding: 30 });
        }
      } catch (e) {
        console.warn('Could not compute bounds for state feature', e);
      }

      // switch to state view UI
      if (typeof setMapView === 'function') setMapView('state');
      hideGraphs();
      // show the state factsheet (fips may need padding to match keys)
      try {
        initFactSheet(stateDataCache, fipsToUse, window.currentRaceField || 'ENR_AP_GAP_BL');
      } catch (e) { console.warn('initFactSheet failed', e); }
      // scroll state info into view
      const info = document.getElementById('infoContainer');
      if (info) info.scrollIntoView({ behavior: 'smooth', block: 'end' });
      return true;
    }

    if (stateFeature && fitFeatureBoundsAndShowFacts(stateFeature, stateFP)) return;

    // fallback to querySourceFeatures
    try {
      const matches = map.querySourceFeatures('states', {
        filter: ['==', ['to-string', ['get', 'STATEFP']], String(stateFP || '')]
      });
      if (matches && matches.length) {
        const f = matches[0];
        if (fitFeatureBoundsAndShowFacts(f, stateFP)) return;
      }
    } catch (e) {
      console.warn('querySourceFeatures fallback failed', e);
    }
// this should fix issue with non geometry districts still being able to use Back to state button
    try {
      if ((!stateFeature || !stateFP) && stateAbbrev && typeof stateDataCache === 'object') {
        const upperAbbrev = String(stateAbbrev).toUpperCase();
        const stateKey = Object.keys(stateDataCache).find(k => {
          const arr = stateDataCache[k] || [];
          return arr.some(d => String(d.state_abbrev || '').toUpperCase() === upperAbbrev);
        });
        if (stateKey) {
          // try to find feature in geojsonCache using known keys/properties
          if (typeof geojsonCache === 'object' && Array.isArray(geojsonCache.features)) {
            stateFeature = geojsonCache.features.find(f => {
              const p = f.properties || {};
              return String(p.STATEFP) === String(stateKey) || String(p.STATE_ID) === String(stateKey) || String((p.STATE_ABBR || p.STATE || '')).toUpperCase() === upperAbbrev;
            });
          }

          if (stateFeature && fitFeatureBoundsAndShowFacts(stateFeature, stateKey)) return;

          // try querySourceFeatures using the discovered stateKey
          try {
            const matches2 = map.querySourceFeatures('states', {
              filter: ['==', ['to-string', ['get', 'STATEFP']], String(stateKey || '')]
            });
            if (matches2 && matches2.length) {
              const f2 = matches2[0];
              if (fitFeatureBoundsAndShowFacts(f2, stateKey)) return;
            }
          } catch (e) {
            // non-fatal
          }
        }
      }
    } catch (e) { console.warn('stateAbbrev fallback failed', e); }

    // final fallback to full US extent and show nothing specific
    map.fitBounds([[ -126, 24], [-66, 50]]);
    if (typeof setMapView === 'function') setMapView('full');
    hideGraphs();
    const info3 = document.getElementById('infoContainer');
    if (info3) info3.scrollIntoView({ behavior: 'smooth', block: 'end' });
  });
  // canonical view setter: 'full' | 'state' | 'district'
  // make setMapView available globally so code outside this closure (map handlers)
  // can call it (some map handlers are defined after this DOMContentLoaded block)
  window.setMapView = function(view) {
    window.mapView = view; // canonical
    // backwards compatibility for older code/tests
    window.isFullUSView = (view === 'full');
    window.currentAggView = (view === 'district') ? 'district' : 'state';
    if (typeof updateControlStates === 'function') updateControlStates();
  };

  // update control enabled/disabled visuals based on current view
  function updateControlStates() {
    try {
      if (backToStateMapBtn) {
        const hasValidStateInfo = !!(window.lastDistrictStateFP || window.lastDistrictStateAbbrev);
        
        if (window.mapView === 'district' && hasValidStateInfo) {
          backToStateMapBtn.disabled = false;
          backToStateMapBtn.classList.remove('control-disabled');
        } else {
          backToStateMapBtn.disabled = true;
          backToStateMapBtn.classList.add('control-disabled');
        }
      }
      if (fullExtentButton) {
        if (window.mapView === 'full') {
          fullExtentButton.disabled = true;
          fullExtentButton.classList.add('control-disabled');
        } else {
          fullExtentButton.disabled = false;
          fullExtentButton.classList.remove('control-disabled');
        }
      }
    } catch (e) {
      console.warn('updateControlStates error', e);
    }
  }
  // set initial canonical view and update controls
  setMapView('full');
  const raceSelectionButton = document.querySelectorAll('.race-selectBtn');
  const aggSelectionButton = document.querySelectorAll('.agg-selectBtn');
  // flag to determine whether user interaction has happened (don't sort on initial load)
  let userHasInteracted = false;
  // track aggregation selection separately from canonical map view
  window.aggLevel = 'state'; // 'state' or 'district'
  // track currently selected race field
  window.currentRaceField = 'ENR_AP_GAP_BL'; // default to Black students



  // data
  aggSelectionButton.forEach(btn => {
    btn.addEventListener('click', function() {
    // Remove active class from all buttons
    aggSelectionButton.forEach(b => b.classList.remove('active'));

    // Add active class to clicked button
    this.classList.add('active');


    // display State level data
  if (this.id === 'agg-selectState'){
    window.aggLevel = 'state';
        // switch map view to state (not full US)
        if (typeof setMapView === 'function') setMapView('state');
        console.log("clickedState")
        // hide district layers
        map.setLayoutProperty('state-fills', 'visibility', 'visible');
        if (map.getLayer('district-fills')) map.setLayoutProperty('district-fills', 'visibility', 'none');
        if (map.getLayer('district-lines')) map.setLayoutProperty('district-lines', 'visibility', 'none');
        // redraw state map with currently selected race field
        if (geojsonCache && stateDataCache && window.currentRaceField) {
          fillStateMap(map, geojsonCache, stateDataCache, window.currentRaceField);
        }
        // update control states if function exists
        if (typeof updateControlStates === 'function') updateControlStates();
      } else if (this.id === 'agg-selectDist'){
        window.aggLevel = 'district';
        // switch map view to district-level (enables Back)
        if (typeof setMapView === 'function') setMapView('district');
       // display district level data 
        console.log("clickedDistrict")
        if (typeof updateControlStates === 'function') updateControlStates();
        // hide state layer
        map.setLayoutProperty('state-fills', 'visibility', 'none');

        //draw district data with currently selected race field:
        if (!map.getLayer('district-fills')) {
          map.addLayer({
            id: 'district-fills',
            type: 'fill',
            source: 'SCHOOLDIST_TL24',
            'source-layer': 'SCHOOLDIST_TL24_Simpl100m-2kf22l',
            paint: {
              'fill-color': 'transparent',
              'fill-opacity': 0.9
            }
          }, 'state-borders');//add below district-fills to keep hover color above
        } else {
          map.setLayoutProperty('district-fills', 'visibility', 'visible');
          map.setLayoutProperty('district-lines', 'visibility', 'visible');
        }

        getDistrictData('all').then(districtData => {
          fillDistrictMap(map, districtData, 'all', 'all', window.currentRaceField || 'ENR_AP_GAP_BL');
          if (typeof updateControlStates === 'function') updateControlStates();
        });
      }
    })
  });

  raceSelectionButton.forEach(btn => {
  btn.addEventListener('click', function() {
    const loadingOverlay = document.getElementById('mapLoadingOverlay');
    if (loadingOverlay) loadingOverlay.style.display = 'flex';
    
    // Remove active class from all buttons
    raceSelectionButton.forEach(b => b.classList.remove('active'));

    // Add active class to clicked button
    this.classList.add('active');

    // Determine field based on button ID
    let fieldName;
    if (this.id === 'race-selectBlk') {
      fieldName = 'ENR_AP_GAP_BL';
       $('#currentRaceDesc').html('Black');
    } else if (this.id === 'race-selectHis') {
      fieldName = 'ENR_AP_GAP_HI';
      $('#currentRaceDesc').html('Hispanic');
    }

    // hlobal var for current race
    window.currentRaceField = fieldName;

    // update map based on current view
    // mapView can be: 'full', 'state', 'district'
    if (window.mapView === 'full') {
      map.setLayoutProperty('state-fills', 'visibility', 'visible');
      if (map.getLayer('district-fills')) map.setLayoutProperty('district-fills', 'visibility', 'none');
      if (map.getLayer('district-lines')) map.setLayoutProperty('district-lines', 'visibility', 'none');
      fillStateMap(map, geojsonCache, stateDataCache, fieldName);
      // Clear stored state info when in full view
      window.currentStateFIPS = null;
      window.currentStateAbbrev = null;
      
      map.once('idle', () => {
        if (loadingOverlay) loadingOverlay.style.display = 'none';
      });
    } else if (window.mapView === 'state' || window.mapView === 'district') {
      //zoomed into a state showing districts OR clicked on a district
      map.setLayoutProperty('state-fills', 'visibility', 'none');
      if (map.getLayer('district-fills')) map.setLayoutProperty('district-fills', 'visibility', 'visible');
      if (map.getLayer('district-lines')) map.setLayoutProperty('district-lines', 'visibility', 'visible');
      
      // get district data and filter for the currently viewed state
      getDistrictData('all').then(districtData => {
        // Filter districts by the currently viewed state
        const stateAbbrev = window.currentStateAbbrev;
        const stateFIPS = window.currentStateFIPS;
        
        if (stateAbbrev && stateFIPS) {
          // Filter district data for the specific state
          const filteredDistrictData = districtData.filter(d => 
            d.LEA_STATE === stateAbbrev || String(d.STATEFP).padStart(2, '0') === String(stateFIPS).padStart(2, '0')
          );
          console.log('Race switch - filtered districts for', stateAbbrev, ':', filteredDistrictData.length);
          
          // Update district map and table with filtered data
          fillDistrictMap(map, filteredDistrictData, stateAbbrev, stateFIPS, fieldName);
          buildDistrictTable(filteredDistrictData, fieldName);
        } else {
          //show all districts (for when district aggregation button was used)
          fillDistrictMap(map, districtData, 'all', 'all', fieldName);
        }
        
        map.once('idle', () => {
          if (loadingOverlay) loadingOverlay.style.display = 'none';
        });
      });
    }

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
          // order by 2021 column (index 4) descending
          table.order([[4, 'desc']]).draw();
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
    
    // Hide district layers
    if (map.getLayer("district-lines")){
      map.setLayoutProperty('district-lines', 'visibility', 'none');
      map.setLayoutProperty('district-fills', 'visibility', 'none');
    }
    // Show state layer
    if (map.getLayer('state-fills')) {
      map.setLayoutProperty('state-fills', 'visibility', 'visible');
    }
    
    hideGraphs();
    
    // clear stored state info
    window.currentStateFIPS = null;
    window.currentStateAbbrev = null;
    
    // redraw state map with current race field
    if (geojsonCache && stateDataCache && window.currentRaceField) {
      fillStateMap(map, geojsonCache, stateDataCache, window.currentRaceField);
    }
    
    // mark full US view active and update controls
    if (typeof setMapView === 'function') setMapView('full');
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
  // style: 'mapbox://styles/mapbox/dark-v11',
  style: 'mapbox://styles/infographics/cmh5hw4m800l001sr4kx07py4',
  maxZoom : 10, 
  minZoom : 0, 
  // zoom: 3,
  bounds: [[ -126, 24], [-66, 50]], // bounding box (southwest corner, northeast corner)
  maxBounds: [[ -140, 25],[-50, 65]], // bounding box (southwest corner, northeast corner)
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

  // // hide basemap layers/labels that we don't want
  // const hiddenLayers = [
  //   'country-label',
  //   'continent-label',
  //   'waterway-label',
  //   'water-line-label',
  //   'water-point-label'
  // ];

  // hiddenLayers.forEach(layerId => {
  //   if (map.getLayer(layerId)) {
  //     map.setLayoutProperty(layerId, 'visibility', 'none');
  //   }
  // });


  // // hide labels that we don't want
  // // List of label layers that use the worldview property
  // const labelLayers = [
  // 'state-label',
  // 'settlement-label',
  // 'settlement-subdivision-label',
  // 'airport-label',
  // 'road-label-simple',
  // 'natural-line-label',
  // 'natural-point-label',
  // 'poi-label',
  // 'settlement-minor-label',
  // 'settlement-major-label',
  // ];

  // Filter to show only US 
// labelLayers.forEach(layerId => {
//     // Check if the layer exists before applying the filter
//     if (map.getLayer(layerId)) {
//       // Use the 'any' expression to check multiple possible country code properties
//       map.setFilter(layerId, [
//         'any',
//         ['==', ['get', 'iso_3166_1'], 'US'], // For country-level features
//         ['==', ['get', 'iso_3166_2'], 'US'], // For state/province-level features (may not apply)
//         ['==', ['get', 'country_code'], 'USA'], // Another common property name
//       ]);
//     }
//   });

 const layers = map.getStyle().layers;
        // Find the index of the first symbol layer in the map style.
        let firstSymbolId;
        for (const layer of layers) {
            if (layer.type === 'symbol') {
                firstSymbolId = layer.id;
                break;
            }
        }


  // SOURCES
  map.addSource('states', {
    type: 'geojson',
    data: 'https://docs.mapbox.com/mapbox-gl-js/assets/us_states.geojson',
    promoteId: 'STATE_ID'  // use STATE_ID as the unique ID
  });

  // // oregon districts only - JSON in repo
  // map.addSource('oregon_districts', {
  //     type: 'geojson',
  //     data: '/assets/data/geojson/oregon_districts.geojson',
  //     promoteId: 'GEOID'  // use GEOID as the unique ID
  // });

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
  }, firstSymbolId);

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
        almostBlack       // default
      ],
      'line-width': 1,
      'line-offset': [
      'case',
      ['boolean', ['feature-state', 'hover'], false],
        2, // shift only highlighted border inward
        0   // default border no shift
      ]
    }
  }, firstSymbolId);


  map.on('mousemove', 'state-fills', (e) => {
    //hide the tool tip when in district/state level view
      if (window.mapView && window.mapView !== 'full') {
        // reset cursor and remove popup if present
        map.getCanvas().style.cursor = '';
        try {
          if (typeof popup !== 'undefined' && popup && typeof popup.remove === 'function') popup.remove();
        } catch (err) { /* ignore */ }
        return;
      }

      if (!e.features.length) return;

      const fips = e.features[0].id;  // FIPS is the feature id

      // tooltip  
      map.getCanvas().style.cursor = 'pointer';
      const props = e.features[0].properties;
      var description;

      if (hoveredPolygonId === fips){
        // move the tooltip with existing data
        try { if (typeof popup !== 'undefined' && popup && typeof popup.setLngLat === 'function') popup.setLngLat(e.lngLat); } catch (err) { }
        return; // already highlighted
      } else {
        // get new data
        description = 
        `
          <div style="font-family:sans-serif; font-size:13px; line-height:1.4;">
            <strong>${props.STATE_NAME}</strong>
            ${getStateOpportunityEstimates(fips, window.currentRaceField || 'ENR_AP_GAP_BL')}

          </div>
        `;
        try { if (typeof popup !== 'undefined' && popup && typeof popup.setLngLat === 'function') popup.setLngLat(e.lngLat).setHTML(description).addTo(map); } catch (err) { }
      }

      // clear previous highlight
      if (hoveredPolygonId !== null) {
        map.setFeatureState({ source: 'states', id: hoveredPolygonId }, { hover: false });
      }
      // update hoveredPolygonId with new val
      hoveredPolygonId = fips;

      // set new highlight
      map.setFeatureState({ source: 'states', id: hoveredPolygonId }, { hover: true });

      // Highlight the table by hoveredPolygonId, state FIPS code (like "41")
      highlightTableByFIPS(fips);
  });


  map.on('mouseleave', 'state-fills', () => {
    if (hoveredPolygonId !== null) {
      map.setFeatureState({ source: 'states', id: hoveredPolygonId }, { hover: false });
      hoveredPolygonId = null;
    }

    // remove state tooltip when leaving
    try {
      if (typeof popup !== 'undefined' && popup && typeof popup.remove === 'function') popup.remove();
    } catch (err) { }

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

    // store currently viewed state info globally for race switching
    window.currentStateFIPS = clickedFeature.id;
    // get state abbreviation from the clicked feature or from stateDataCache
    const fipsKey = String(clickedFeature.id).padStart(2, '0');
    const stateEntry = stateDataCache[fipsKey];
    window.currentStateAbbrev = stateEntry?.[0]?.state_abbrev ?? stateEntry?.[0]?.LEA_STATE ?? null;

    // fill fact sheet
    const fieldName = window.currentRaceField || 'ENR_AP_GAP_BL';
  initFactSheet(stateDataCache, clickedFeature.id, fieldName);
  // update canonical map view to 'state' and refresh controls
  if (typeof setMapView === 'function') setMapView('state');


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
    // initial order- sort by 2021 opp est descending
    order: [[4, 'desc']],
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

    const ap = yr2021?.SCH_APCOURSES ?? 'N/A';
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

  table.order([[4, 'desc']]).draw() 
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

  table.order([[4, 'desc']]).draw() 
  // click handler for district rows
  try {
    // remove previous handler to avoid duplicates
    $('#district-table tbody').off('click', 'tr');
    $('#district-table tbody').on('click', 'tr', function (e) {
      const tableRef = $('#district-table').DataTable();
      const row = tableRef.row(this);
      const rowData = row.data();
      if (!rowData) return;

      // ensure click was on the first cell (district name)
      const td = e.target.closest ? e.target.closest('td') : null;
      if (td && typeof td.cellIndex !== 'undefined' && td.cellIndex !== 0) {
        return; // only act on clicks of the name cell
      }

      console.log('District table clicked (name):', rowData[0]);

      // LEAID/internal id is stored in column index 5
      const selectedId = String(rowData[5] || '').replace(/^0+/, '');
      if (!selectedId) return;

      // find matching record in the districtData provided to this function
      const rec = (Array.isArray(districtData) ? districtData : []).find(d => String(d.LEAID || d.GEOID || '').replace(/^0+/, '') === selectedId);

      // If record exists but has no geometry, show the factsheet without zooming
      if (rec && (rec.GIS === 0 || String(rec.GIS) === '0' || rec.gis === 0 || String(rec.gis) === '0')) {
        const fakeFeature = { properties: { GEOID: String(rec.LEAID || rec.GEOID || '') }, geometry: null };
        try { showDistrictFactsheet(fakeFeature, districtData); } catch (e) { console.warn('showDistrictFactsheet failed for no-geometry district', e); }
        return;
      }

      // Attempt to find the map feature and zoom to it
      let foundFeature = null;
      try {
        const features = map.querySourceFeatures('SCHOOLDIST_TL24', { sourceLayer: 'SCHOOLDIST_TL24_Simpl100m-2kf22l' }) || [];
        foundFeature = features.find(f => {
          if (!f) return false;
          const fid = String(f.id || '').replace(/^0+/, '');
          if (fid && fid === selectedId) return true;
          const p = f.properties || {};
          const propLea = String(p.LEAID || p.GEOID || '').replace(/^0+/, '');
          if (propLea && propLea === selectedId) return true;
          return false;
        });
      } catch (err) {
        console.warn('Could not query district features to find selected district (table click)', err);
      }

      if (!foundFeature) {
        console.warn('Could not find map feature for district (table click):', selectedId);
        // fallback: show factsheet from record if available
        if (rec) {
          try { showDistrictFactsheet({ properties: { GEOID: String(rec.LEAID || rec.GEOID || '') }, geometry: null }, districtData); } catch (e) { console.warn(e); }
        }
        return;
      }

      // Zoom to feature bounds if geometry exists
      try {
        const coords = foundFeature.geometry && foundFeature.geometry.coordinates;
        if (coords) {
          const bounds = new mapboxgl.LngLatBounds();
          function extendBounds(coordinates) {
            if (typeof coordinates[0][0] === 'number') {
              coordinates.forEach(coord => bounds.extend(coord));
            } else {
              coordinates.forEach(extendBounds);
            }
          }
          extendBounds(coords);
          map.fitBounds(bounds, { padding: 30 });
        }
      } catch (err) {
        console.warn('Could not compute bounds for selected district (table click):', err);
      }

      // Open factsheet for the found feature
      try {
        showDistrictFactsheet(foundFeature, districtData);
        hideNoGeometryNotice();
      } catch (e) { console.warn('Could not open factsheet for selected district (table click):', e); }
    });
  } catch (e) { console.warn('Failed to attach district table click handler', e); }
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

function updateLegendTicks(minVal, cappedMax, maxVal, steps = 2) {
  const ticksContainer = document.querySelector('.legend .legend-ticks');
  if (!ticksContainer) return;

  ticksContainer.innerHTML = ''; // clear previous ticks

  for (let i = 0; i <= steps; i++) {
    let value = minVal + (i / steps) * (cappedMax - minVal);
    const tick = document.createElement('span');

    if (cappedMax !== null && value > cappedMax && i === steps) {
      tick.textContent = `> ${cappedMax.toFixed(1)}`;
    } else {
      tick.textContent = value.toFixed(1); // cap to 2 digits
    }

    ticksContainer.appendChild(tick);
  }
}

function fillStateMap(map, geojson, stateData, fieldName) {
  const valueMap = {};
  let minVal = Infinity;
  let maxVal = -Infinity;
  const targetYear = 2021; // assumes map is always 2021 data

  // Extract values & track min/max
  for (let state in stateData) {
    const row = stateData[state].find(d => d.YEAR === targetYear);
    const valRaw = row?.[fieldName];
    if (typeof valRaw === 'number') {
      valueMap[state] = valRaw;
      if (valRaw < minVal) minVal = valRaw;
      if (valRaw > maxVal) maxVal = valRaw;
    }
  }

  // Cap max for color ramp at 5, anything above that gets the max color
  const cappedMax = Math.min(maxVal, 5);
  updateLegendTicks(minVal, cappedMax, steps = 2)

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

  // Determine if we're showing all states
  const showAllStates = !statefips || statefips === 'all' || statefips === 'any';

  // Add or update fill layer
  if (!map.getLayer('district-fills')) {
    map.addLayer({
      id: 'district-fills',
      type: 'fill',
      source: 'SCHOOLDIST_TL24',
      'source-layer': 'SCHOOLDIST_TL24_Simpl100m-2kf22l',
      filter: showAllStates ? true : ['==', ['get', 'STATEFP'], statefips],
      paint: {
        'fill-color': 'transparent',
        'fill-opacity': 0.9
      }
    }, 'state-fills'); // place below state-fills
  } else {
    map.setFilter(
      'district-fills',
      showAllStates ? true : ['==', ['get', 'STATEFP'], statefips]
    );
    map.setLayoutProperty('district-fills', 'visibility', 'visible');
    map.setLayoutProperty('district-lines', 'visibility', 'visible');
  }

  // Add or update district outlines
  if (!map.getLayer('district-lines')) {
    map.addLayer({
      id: 'district-lines',
      type: 'line',
      source: 'SCHOOLDIST_TL24',
      'source-layer': 'SCHOOLDIST_TL24_Simpl100m-2kf22l',
      filter: showAllStates ? true : ['==', ['get', 'STATEFP'], statefips],
      paint: {
        // use feature-state 'hover' to change line color/width on hover
        'line-color': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          (typeof yellow !== 'undefined' ? yellow : '#ffcc00'),
          '#333'
        ],
        'line-width': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          2.0,
          0.5
        ],
        'line-opacity': 0.9
      }
    }, 'state-borders');
  } else {
    map.setFilter(
      'district-lines',
      showAllStates ? true : ['==', ['get', 'STATEFP'], statefips]
    );
  }

  // Filter to the target year
  const filtered = districtData.filter(d => Number(d.YEAR) === targetYear);

  // Build LEAID → value lookup
  const valueMap = {};
  let minVal = Infinity;
  let maxVal = -Infinity;
  console.log(`Building valueMap for field: ${fieldName}, filtered data count: ${filtered.length}`);

for (const d of filtered) {
  const raw = d[fieldName];
  if (raw !== null && raw !== undefined && !isNaN(Number(raw))) {
    const val = Number(raw);

    // Convert LEAID to string and pad to 7 digits (standard for NCES / FIPS IDs)
    const leaId = String(d.LEAID).padStart(7, '0'); 

    valueMap[leaId] = val;
    if (val < minVal) minVal = val;
    if (val > maxVal) maxVal = val;
  }
}

  // Store valueMap globally for later updates
  currentDistrictValueMap = valueMap;
  
  console.log(`ValueMap built: ${Object.keys(valueMap).length} districts, min: ${minVal}, max: ${maxVal}`);

  if (!isFinite(minVal) || !isFinite(maxVal)) {
    console.warn(`No valid data for ${state_abbrev} / ${fieldName} / ${targetYear}`);
    map.setPaintProperty('district-fills', 'fill-color', 'transparent');
    return;
  }

  if (minVal === maxVal) maxVal = minVal + 0.00001;
  if (minVal > maxVal) [minVal, maxVal] = [maxVal, minVal];

  // Cap max for color ramp at 5, anything above that gets the max color
  const cappedMax = Math.min(maxVal, 3);
  updateLegendTicks(minVal, cappedMax, maxVal, steps = 2)

  const colorRamp = [
    "interpolate",
    ["linear"],
    ["feature-state", "value"],
    minVal, "#4a4f41",         // darkest
    minVal + (cappedMax - minVal) * 0.25, "#7a816e",
    minVal + (cappedMax - minVal) * 0.5,  "#a8ae9c",
    minVal + (cappedMax - minVal) * 0.75, "#ccd1c4",
    cappedMax, "#e8ebe5"          // lightest
  ];

  map.setPaintProperty('district-fills', 'fill-color', colorRamp);
  map.setPaintProperty('district-fills', 'fill-outline-color', [
    'case',
    ['boolean', ['feature-state', 'hover'], false],
    (typeof almostBlack !== 'undefined' ? almostBlack : '#111'),
    '#333'
  ]);

  // immediately set feature states for all districts
  // and Query all features in the district layer
  try {
    const features = map.querySourceFeatures('SCHOOLDIST_TL24', {
      sourceLayer: 'SCHOOLDIST_TL24_Simpl100m-2kf22l'
    });
    
    console.log(`Setting feature states for ${features.length} district features with field: ${fieldName}`);
    
    for (const f of features) {
      const geoId = String(f.id);
      const val = valueMap[geoId];
      
      // set the value (or clear it if no data 
      map.setFeatureState(
        {
          source: 'SCHOOLDIST_TL24',
          sourceLayer: 'SCHOOLDIST_TL24_Simpl100m-2kf22l',
          id: geoId
        },
        { value: val !== undefined ? val : null }
      );
    }
  } catch (err) {
    console.warn('Error setting district feature states:', err);
  }

  // Also assign feature states after data loads (for when tiles load later)
  // remove any existing sourcedata listeners 
  map.off('sourcedata', updateDistrictFeatureStates);
  
  function updateDistrictFeatureStates(e) {
    if (e.sourceId === 'SCHOOLDIST_TL24' && e.isSourceLoaded) {
      const features = map.querySourceFeatures('SCHOOLDIST_TL24', {
        sourceLayer: 'SCHOOLDIST_TL24_Simpl100m-2kf22l'
      });
      for (const f of features) {
        const geoId = String(f.id);
        const val = currentDistrictValueMap[geoId]; // Use global valueMap
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
  }
  
  map.on('sourcedata', updateDistrictFeatureStates);

  // Tooltip for hover
  // load tooltip on mouseenter
  map.on('mouseenter', 'district-fills', (e) => {       
    // only show district tooltip when viewing a state or when district aggregation is active
    if (!(window.mapView === 'state' || window.mapView === 'district' || window.aggLevel === 'district')) {
      try { districtPopup.remove(); } catch (err) { }
      map.getCanvas().style.cursor = '';
      return;
    }

    hoveredDistrictPolygonID = ''
      // Add the popup the first time the feature is entered
      districtPopup.setLngLat(e.lngLat).setHTML("").addTo(map);
  });

  map.on('mousemove', 'district-fills', (e) => {
    // only show district tooltip when viewing a state or when district aggregation is active
    if (!(window.mapView === 'state' || window.mapView === 'district' || window.aggLevel === 'district')) {
      try { districtPopup.remove(); } catch (err) { }
      map.getCanvas().style.cursor = '';
      return;
    }

    if (!e.features || !e.features.length) return;

    map.getCanvas().style.cursor = 'pointer';
    const feat = e.features[0];
    const props = feat.properties || {};
    console.log(hoveredDistrictPolygonID)
    // console.log(props)

    // for tooltip
    let directionClass = '';
    let description = feat.id;
    let geoId = '';

    // manage hover feature state so districts can be visually highlighted if desired
    try {
      const fid = String(feat.id);
      // console.log(fid)
      if (hoveredDistrictPolygonID !== fid) {
        // new feature
        console.log("NEW FEATURE")
        console.log(hoveredDistrictPolygonID)
        // clear last outline
        map.setFeatureState({ source: 'SCHOOLDIST_TL24', sourceLayer: 'SCHOOLDIST_TL24_Simpl100m-2kf22l', id: hoveredDistrictPolygonID }, { hover: false });

        // set other new values
        hoveredDistrictPolygonID = fid
        // Find matching district record from provided districtData (if available)
        let hoveredDistrictData = null;
        try {
          geoId = String(feat.id || props.GEOID || props.LEAID || '').replace(/^0+/, '');
          console.log(geoId)
          //console.log(districtData) // all data

          if (Array.isArray(districtData)) {
          hoveredDistrictData = districtData
            .filter(d =>
              String(d.LEAID || d.GEOID || '').replace(/^0+/, '') === geoId
            )
            // just get value from most recent year
            .reduce((latest, d) =>
              d.YEAR > (latest?.YEAR ?? -Infinity) ? d : latest
            , null);
        }
        } catch (err) { hoveredDistrictData = null; }
        console.log(hoveredDistrictData)

        console.log(geoId)

        const students = hoveredDistrictData ? (hoveredDistrictData.ENR ?? hoveredDistrictData.num_students ?? '—') : '—';
        const teachers = hoveredDistrictData ? (hoveredDistrictData.SCH_FTETEACH_TOT ?? hoveredDistrictData.num_teachers ?? '—') : '—';

        const grades = (props.LOGRADE || props.LGRADE || props.L_GRADE || '') && (props.HIGRADE || props.HGRADE || props.H_GRADE || '') ? `${props.LOGRADE || props.LGRADE || props.L_GRADE}–${props.HIGRADE || props.HGRADE || props.H_GRADE}` : '';

        directionClass = '';
        description = `
          <div style="font-family:sans-serif; font-size:13px; line-height:1.4;">
            <strong>${props.NAME || props.LEA_NAME || 'District'} (2021)</strong>
            ${grades ? `<div>Grades: ${grades}</div>` : ''}
            <div>Students: ${fmtValue(students, 2021)}</div>
            <div>Teachers (FTE):${fmtValue(teachers, 2021)}</div>
          </div>
        `;

        console.log(description)
        districtPopup.setHTML(description);

      }
      else {
        // same feature
        // just change lat/long
      map.setFeatureState({ source: 'SCHOOLDIST_TL24', sourceLayer: 'SCHOOLDIST_TL24_Simpl100m-2kf22l', id: hoveredDistrictPolygonID }, { hover: true });
      }
    } catch (err) { /* non-fatal */ }

    
    // set the popup
    try {
      districtPopup.setLngLat(e.lngLat);
    } catch (err) { console.warn('Could not show district popup', err); }
  });

  map.on('mouseleave', 'district-fills', () => {
    map.getCanvas().style.cursor = '';
    try { districtPopup.remove(); } catch (err) { }
    // clear district hover state
    try {
      if (hoveredDistrictPolygonID !== null) {
        map.setFeatureState({ source: 'SCHOOLDIST_TL24', sourceLayer: 'SCHOOLDIST_TL24_Simpl100m-2kf22l', id: hoveredDistrictPolygonID }, { hover: false });
        hoveredDistrictPolygonID = null;
      }
    } catch (err) { }
  });

  // Click → zoom and factsheet
  map.on('click', 'district-fills', function (e) {
    const clickedFeature = e.features[0];
    console.log(clickedFeature);

    // Only zoom if showing a single state
    if (!showAllStates) {
      const coords = clickedFeature.geometry.coordinates;
      const bounds = new mapboxgl.LngLatBounds();

      function extendBounds(coordinates) {
        if (typeof coordinates[0][0] === 'number') {
          coordinates.forEach(coord => bounds.extend(coord));
        } else {
          coordinates.forEach(extendBounds);
        }
      }

      extendBounds(coords);
      map.fitBounds(bounds, { padding: 30 });
    }

    // Show factsheet only if zoomed in
    if (!showAllStates) {
      showDistrictFactsheet(clickedFeature, districtData);
      hideNoGeometryNotice();
      // document.getElementById('mapLegend').style.display = 'block';
    }
  });
}



// --- District fact sheet ---
function hideNoGeometryNotice() {
  try {
    const el = document.getElementById('noGeometryNotice');
    if (el) el.style.display = 'none';
  } catch (e) { /* non-fatal */ }
}

function showDistrictFactsheet(clickedFeature, districtData) {
  // ensure canonical view reflects district view (this will update controls)
  if (typeof setMapView === 'function') setMapView('district');
  const geoId = String(clickedFeature.properties.GEOID);
  const records = districtData.filter(d => String(d.LEAID).replace(/^0+/, '') === geoId.replace(/^0+/, '')); //JSON LEADID with leading 0 removed
  const factSheetContainer = document.getElementById("factSheetContainer");

  if (!records.length) {
    factSheetContainer.innerHTML = `
      <h2><b>Error: No data found for District ID ${geoId}</b></h2>
      <div class="opportunity-column">No district data available.</div>
      <button id="returnToFullView" style="margin-top: 20px; padding: 10px 20px; font-size: 14px;">Return to full US view</button>
    `;
    // click handler to return button
    setTimeout(() => {
      const returnBtn = document.getElementById('returnToFullView');
      if (returnBtn) {
        returnBtn.addEventListener('click', () => {
          map.fitBounds([[ -126, 24], [-66, 50]]);
          if (typeof setMapView === 'function') setMapView('full');
          hideGraphs();
          const info = document.getElementById('infoContainer');
          if (info) info.scrollIntoView({ behavior: 'smooth', block: 'end' });
        });
      }
    }, 0);
    return;
  }

  // Sort by YEAR ascending
  records.sort((a, b) => a.YEAR - b.YEAR);
  const latest = records[records.length - 1];
  const leaName = latest.LEA_NAME || "Unknown district";
  const latestYear = latest.YEAR;

  // store state identifiers for map-level "Back to state" button
  try {
    window.lastDistrictStateFP = latest.STATEFP || latest.LEA_STATEFP || clickedFeature.properties?.STATEFP || null;
    window.lastDistrictStateAbbrev = latest.LEA_STATE || clickedFeature.properties?.STATE_ABBR || null;
  } catch (e) {
    window.lastDistrictStateFP = null;
    window.lastDistrictStateAbbrev = null;
  }

  // Unified colors for both charts
  const colors = { WH: "#a6cee3", HI: "#d95f02", BL: "#1b9e77", AS: "#7570b3", OTH: "#555" };

  // --- Dropdown of districts (unique by LEAID) ---
  // Build a map keyed by normalized LEAID (remove leading zeros) so each option is unique
  const uniqLea = {};
  for (const d of districtData) {
    const leaRaw = d.LEAID || d.GEOID || '';
    const lea = String(leaRaw).replace(/^0+/, '');
    if (!lea) continue;
    if (!uniqLea[lea]) {
      uniqLea[lea] = {
        lea,
        name: d.LEA_NAME || d.NAME || 'Unknown',
        state: d.LEA_STATE || d.STATE || '',
        // preserve GIS flag (1 = has geometry, 0 = no geometry)
        gis: (d.GIS !== undefined) ? d.GIS : (d.gis !== undefined ? d.gis : 1)
      };
    }
  }

  const districtList = Object.values(uniqLea).sort((a,b) => (a.name || '').localeCompare(b.name || ''));
  const normLatestLea = String(latest.LEAID || '').replace(/^0+/, '');
  const optionsHtml = districtList.map(d => {
    const isSelected = String(d.lea) === String(normLatestLea) ? ' selected' : '';
    // Display name and append a (No Geometry) tag for districts without geometry
    const noGeo = (d.gis === 0 || String(d.gis) === '0') ? ' (No Geometry)' : '';
    const label = `${toTitleCase(d.name)}${d.state ? ' (' + d.state + ')' : ''}${noGeo}`;
    return `<option value="${d.lea}"${isSelected}>${label}</option>`;
  }).join('');

  // --- Build factsheet HTML (District) ---
  factSheetContainer.classList.add("full-width"); // full width top row
  factSheetContainer.innerHTML = `
    <div class="opportunity-row"><h2>
        <span class="factsheet-label">Factsheet for </span>
        <select id="districtPicker" class="district-dropdown">
          ${optionsHtml}
        </select>

      </h2></div>
    <div id="noGeometryNotice" class="no-geometry-notice" style="display:none;">
      <i class="fa fa-exclamation-circle" aria-hidden="true"></i>
      <strong>Note:</strong> This district cannot be found on our map. Available data is shown below.
    </div>
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
        <input type="checkbox" id="compToggle" checked>
        <small>show as bar</small>
      </label>
      </p>
      <canvas id="compDonut" width="300" height="100"style="display:none;"></canvas>
      <canvas id="compBar" width="300" height="100"></canvas>
    </div>

    <div class="opportunity-column">
      <p><b>Historic/temporal information</b></p>
      <p style="font-size:0.9em;color: black">AP Participation Gap by Year</p>
      <canvas id="gapChart" width="400" height="160"></canvas>
      <div id="gapLegend" style="font-size:0.85em;"></div>
  <!-- New sparkline: Students - Percentage of non-white students -->
  <p style="font-size:0.9em;color: black">Students - Percentage of non-white students (by year)</p>
  <canvas id="nonwhiteChart" width="400" height="160"></canvas>
  <div id="nonwhiteLegend" style="font-size:0.85em;"></div>
  <!-- New sparkline: HS students taking ≥1 AP (PCT_ENR_AP) -->
  <p style="font-size:0.9em;color: black">HS students taking at least 1 AP course (by year)</p>
  <canvas id="apChart" width="400" height="160"></canvas>
  <div id="apLegend" style="font-size:0.85em;"></div>
  <!-- New sparkline: Student-teacher ratio (STU_TEACH_RAT) -->
  <p style="font-size:0.9em;color: black">Student–teacher ratio (by year)</p>
  <canvas id="stChart" width="400" height="160"></canvas>
  <div id="stLegend" style="font-size:0.85em;"></div>
  <!-- New sparkline: Modal AP courses offered in district (SCH_APCOURSES) -->
  <p style="font-size:0.9em;color: black">Modal number of AP courses offered (by year)</p>
  <canvas id="apCoursesChart" width="400" height="160"></canvas>
  <div id="apCoursesLegend" style="font-size:0.85em;"></div>
      
    </div> <!-- end row -->
    </div>  <!-- end column -->
  `  ;

  // Show or hide the no-geometry notice based on the latest record's GIS flag
  try {
    const noGeoDiv = document.getElementById('noGeometryNotice');
    if (noGeoDiv) {
      if (latest.GIS === 0 || String(latest.GIS) === '0' || latest.gis === 0 || String(latest.gis) === '0') {
        noGeoDiv.style.display = 'block';
      } else {
        noGeoDiv.style.display = 'none';
      }
    }
  } catch (e) { /* non-fatal */ }

  // --- Prepare comp data ---
  const compData = {
    WH: latest.PCT_ENR_WH,
    HI: latest.PCT_ENR_HI,
    BL: latest.PCT_ENR_BL,
    AS: latest.PCT_ENR_AS,
    OTH: latest.PCT_ENR_OTH
  };

  drawCompDonutChart("compDonut", compData, colors);
  drawCompositionBar("compBar", compData, colors);

  // Toggle between donut and bar
  document.getElementById("compToggle").addEventListener("change", function() {
    const showBar = this.checked;
    document.getElementById("compDonut").style.display = showBar ? "none" : "block";
    document.getElementById("compBar").style.display = showBar ? "block" : "none";
  });

//jump to district
  try {
    const picker = document.getElementById('districtPicker');
    if (picker) {
      picker.addEventListener('change', function () {
        const selectedLea = String(this.value || '').replace(/^0+/, '');
        if (!selectedLea) return;

        // Find a record in the district data matching the selected LEAID (unique)
        const rec = districtData.find(d => String(d.LEAID || d.GEOID || '').replace(/^0+/, '') === selectedLea);
        if (!rec) {
          console.warn('Selected district LEAID not found in data:', selectedLea);
          return;
        }

        const targetId = String(rec.LEAID || rec.GEOID || '').replace(/^0+/, '');

        // If this district has no geometry, show the factsheet and a notice rather
        // than attempting to find a map feature / zoom to it.
        if (rec.GIS === 0 || String(rec.GIS) === '0' || rec.gis === 0 || String(rec.gis) === '0') {
          const fakeFeature = { properties: { GEOID: String(rec.LEAID || rec.GEOID || '').replace(/^0+/, ''), STATE_ABBR: rec.LEA_STATE || '', STATEFP: rec.STATEFP || '' }, geometry: null };
          try {
            showDistrictFactsheet(fakeFeature, districtData);
          } catch (err) {
            console.warn('Could not open factsheet for no-geometry district:', err);
          }
          return;
        }

        // query map source features for the districts layer and attempt to match
        let foundFeature = null;
        try {
          const features = map.querySourceFeatures('SCHOOLDIST_TL24', {
            sourceLayer: 'SCHOOLDIST_TL24_Simpl100m-2kf22l'
          }) || [];

          // match by feature id (some features have id == LEAID), by LEAID/GEOID property,
          // or by NAME property (we use first match we find)
          foundFeature = features.find(f => {
            if (!f) return false;
            const p = f.properties || {};
            // various forms to compare (padded/unpadded)
            const fid = String(f.id || '').replace(/^0+/, '');
            const fidPadded = String(f.id || '').padStart(7, '0');
            const propLea = String(p.LEAID || p.GEOID || '').replace(/^0+/, '');
            const propLeaPadded = String(p.LEAID || p.GEOID || '').padStart(7, '0');
            const targetPadded = String(targetId).padStart(7, '0');

            if (fid && targetId && fid === targetId) return true;
            if (fidPadded && targetPadded && fidPadded === targetPadded) return true;
            if (propLea && targetId && propLea === targetId) return true;
            if (propLeaPadded && targetPadded && propLeaPadded === targetPadded) return true;

            // fallback: match by name using the selected record's name (rec)
            const recName = String(rec.LEA_NAME || rec.NAME || '').trim();
            if (recName) {
              if ((p.NAME && String(p.NAME).trim() === recName) || (p.LEA_NAME && String(p.LEA_NAME).trim() === recName)) return true;
            }
            return false;
          });
        } catch (err) {
          console.warn('Could not query district features to find selected district', err);
        }

        if (!foundFeature) {
          console.warn('Could not find map feature for district (falling back to factsheet):', rec.LEA_NAME || rec.NAME || selectedLea);
          try {
            // show factsheet using the record (no geometry zoom)
            const fakeFeature = { properties: { GEOID: String(rec.LEAID || rec.GEOID || '').replace(/^0+/, ''), STATE_ABBR: rec.LEA_STATE || '', STATEFP: rec.STATEFP || '' }, geometry: null };
            showDistrictFactsheet(fakeFeature, districtData);
            // ensure the no-geometry notice is hidden because rec.GIS indicates geometry exists
            hideNoGeometryNotice();
          } catch (err) {
            console.warn('Could not open fallback factsheet for district:', err);
          }
          return;
        }

        // zoom to the found feature's bounds 
        try {
          const coords = foundFeature.geometry && foundFeature.geometry.coordinates;
          if (coords) {
            const bounds = new mapboxgl.LngLatBounds();
            function extendBounds(coordinates) {
              if (typeof coordinates[0][0] === 'number') {
                coordinates.forEach(coord => bounds.extend(coord));
              } else {
                coordinates.forEach(extendBounds);
              }
            }
            extendBounds(coords);
            map.fitBounds(bounds, { padding: 30 });
          }
        } catch (err) {
          console.warn('Could not compute bounds for selected district:', err);
        }

        // open the factsheet for that district
        try {
          showDistrictFactsheet(foundFeature, districtData);
          hideNoGeometryNotice();
        } catch (err) {
          console.warn('Could not open factsheet for selected district:', err);
        }
      });
    }
  } catch (e) {
    console.warn('Failed to wire districtPicker change handler', e);
  }

  // --- Prepare gap chart data ---
  const years = records.map(r => r.YEAR);
  const series = {
    BL: records.map(r => r.ENR_AP_GAP_BL),
    HI: records.map(r => r.ENR_AP_GAP_HI)
  };

  // state level and national level series for BL and HI (if available)
  try {
    // determine state abbreviation for this district (used to look up state series)
    const stateAbbrev = latest.LEA_STATE || clickedFeature.properties?.STATE_ABBR || window.lastDistrictStateAbbrev || null;
    // find state entry in stateDataCache by matching abbreviation
    let stateSeriesBL = Array(years.length).fill(null);
    let stateSeriesHI = Array(years.length).fill(null);

    if (typeof stateDataCache === 'object' && stateAbbrev) {
      const stateKey = Object.keys(stateDataCache).find(k => {
        const arr = stateDataCache[k] || [];
        return arr.some(d => d.state_abbrev === stateAbbrev);
      });

      if (stateKey) {
        const sRecords = stateDataCache[stateKey].slice().sort((a,b)=>a.YEAR-b.YEAR);
        // build year-indexed lookup
        const sLookup = {};
        for (const s of sRecords) sLookup[Number(s.YEAR)] = s;
        years.forEach((y, i) => {
          const row = sLookup[Number(y)];
          if (row) {
            stateSeriesBL[i] = row.ENR_AP_GAP_BL ?? null;
            stateSeriesHI[i] = row.ENR_AP_GAP_HI ?? null;
          }
        });
      }
    }

    // fetch national series (promise) and draw chart after
    const natUrl = '../assets/data/json/ap_equity_national.json';
    fetch(natUrl)
      .then(res => res.json())
      .then(natData => {
        const natLookup = {};
        if (Array.isArray(natData)) {
          for (const n of natData) natLookup[Number(n.YEAR)] = n;
        }

        const natSeriesBL = years.map(y => (natLookup[Number(y)] ? natLookup[Number(y)].ENR_AP_GAP_BL ?? null : null));
        const natSeriesHI = years.map(y => (natLookup[Number(y)] ? natLookup[Number(y)].ENR_AP_GAP_HI ?? null : null));

        // extend series object with state & national lines (label suffixes: _state, _nat)
        const extendedSeries = Object.assign({}, series, {
          'BL_state': stateSeriesBL,
          'BL_nat': natSeriesBL,
          'HI_state': stateSeriesHI,
          'HI_nat': natSeriesHI
        });

        // color map: use the same (district) colors for state and national as requested
        const colorMap = {
          BL: colors.BL,
          'BL_state': colors.BL,
          'BL_nat': colors.BL,
          HI: colors.HI,
          'HI_state': colors.HI,
          'HI_nat': colors.HI
        };

        // simple bubble picker to toggle which aggregation is shown (district/state/national)
        const gapLegend = document.getElementById('gapLegend');
        if (gapLegend) {
          // remove existing picker wrapper if present (remove whole wrapper that contains the label)
          const existingWrapper = document.getElementById('gapPickerWrapper');
          if (existingWrapper) existingWrapper.remove();
          else {
            // fallback: remove inner picker if wrapper wasn't used previously
            const existing = document.getElementById('gapPicker');
            if (existing) existing.remove();
          }

          const picker = document.createElement('div');
          picker.id = 'gapPicker';
          picker.style.display = 'flex';
          picker.style.gap = '8px';
          picker.style.marginBottom = '6px';

          // label above picker
          const pickerLabel = document.createElement('div');
          pickerLabel.textContent = 'Level:';
          pickerLabel.style.fontSize = '12px';
          pickerLabel.style.marginBottom = '6px';

          const pickerWrapper = document.createElement('div');
          pickerWrapper.id = 'gapPickerWrapper';
          pickerWrapper.style.display = 'flex';
          pickerWrapper.style.flexDirection = 'column';
          pickerWrapper.appendChild(pickerLabel);

          const views = ['district','state','national'];
          views.forEach(v => {
            const btn = document.createElement('button');
            btn.className = 'gap-btn';
            btn.dataset.view = v;
            btn.title = v;
            // show full word on the button
            btn.textContent = v.charAt(0).toUpperCase() + v.slice(1);
            btn.style.padding = '4px 8px';
            btn.style.borderRadius = '16px';
            btn.style.border = '1px solid rgba(0,0,0,0.15)';
            btn.style.background = v === 'district' ? '#111' : '#fff';
            btn.style.color = v === 'district' ? '#fff' : '#111';
            btn.style.cursor = 'pointer';
            btn.addEventListener('click', () => {
              // update active styling
              Array.from(picker.children).forEach(c => {
                c.style.background = '#fff';
                c.style.color = '#111';
              });
              btn.style.background = '#111';
              btn.style.color = '#fff';

              // draw appropriate series
              if (v === 'district') {
                const s = { BL: extendedSeries.BL, HI: extendedSeries.HI };
                const cm = { BL: colorMap.BL, HI: colorMap.HI };
                drawMiniChart('gapChart', years, s, cm, 'AP participation gap');
                drawLegend('gapLegend', s, cm);
              } else if (v === 'state') {
                const s = { 'BL_state': extendedSeries.BL_state, 'HI_state': extendedSeries.HI_state };
                const cm = { 'BL_state': colorMap['BL_state'], 'HI_state': colorMap['HI_state'] };
                drawMiniChart('gapChart', years, s, cm, 'AP participation gap');
                drawLegend('gapLegend', s, cm);
              } else if (v === 'national') {
                const s = { 'BL_nat': extendedSeries.BL_nat, 'HI_nat': extendedSeries.HI_nat };
                const cm = { 'BL_nat': colorMap['BL_nat'], 'HI_nat': colorMap['HI_nat'] };
                drawMiniChart('gapChart', years, s, cm, 'AP participation gap');
                drawLegend('gapLegend', s, cm);
              }
            });
            picker.appendChild(btn);
          });

          pickerWrapper.appendChild(picker);
          gapLegend.parentNode.insertBefore(pickerWrapper, gapLegend);
        }

  // draw default (district)
  const defaultSeries = { BL: extendedSeries.BL, HI: extendedSeries.HI };
  const defaultColors = { BL: colorMap.BL, HI: colorMap.HI };
  drawMiniChart('gapChart', years, defaultSeries, defaultColors, 'AP participation gap');
  drawLegend('gapLegend', defaultSeries, defaultColors);
        // helper to build state series for a given field (shared by all sparklines)
        const buildStateSeries = (field) => {
          const arr = Array(years.length).fill(null);
          if (typeof stateDataCache === 'object' && stateAbbrev) {
            const stateKey = Object.keys(stateDataCache).find(k => {
              const a = stateDataCache[k] || [];
              return a.some(d => d.state_abbrev === stateAbbrev);
            });
            if (stateKey) {
              const sRecords = stateDataCache[stateKey].slice().sort((a,b)=>a.YEAR-b.YEAR);
              const sLookup = {};
              for (const s of sRecords) sLookup[Number(s.YEAR)] = s;
              years.forEach((y,i)=>{
                const row = sLookup[Number(y)];
                if (row) arr[i] = row[field] ?? null;
              });
            }
          }
          return arr;
        };

        // Draw sparklines (District + State + National) using helper
        try {
          prepareAndDrawSparkline({ canvasId: 'nonwhiteChart', legendId: 'nonwhiteLegend', title: 'Percent non-white', field: 'PCT_ENR_NON_WH', records, years, natLookup, stateAbbrev });
          prepareAndDrawSparkline({ canvasId: 'apChart', legendId: 'apLegend', title: 'AP participation (%)', field: 'PCT_ENR_AP', records, years, natLookup, stateAbbrev });
          prepareAndDrawSparkline({ canvasId: 'stChart', legendId: 'stLegend', title: 'Student–teacher ratio', field: 'STU_TEACH_RAT', records, years, natLookup, stateAbbrev });
          prepareAndDrawSparkline({ canvasId: 'apCoursesChart', legendId: 'apCoursesLegend', title: 'Modal AP courses', field: 'SCH_APCOURSES', records, years, natLookup, stateAbbrev });
        } catch (e) { console.warn('Could not draw detail sparklines', e); }
      })
      .catch(err => {
        console.warn('Failed to load national data for gap chart:', err);
        // fallback: draw only district series and remove picker
        const fallbackSeries = { BL: series.BL, HI: series.HI };
        const fallbackColors = { BL: colors.BL, HI: colors.HI };
        // remove picker wrapper if exists
        const existingWrapper = document.getElementById('gapPickerWrapper');
        if (existingWrapper) existingWrapper.remove();
        else {
          const existing = document.getElementById('gapPicker');
          if (existing) existing.remove();
        }
  drawMiniChart('gapChart', years, fallbackSeries, fallbackColors, 'AP participation gap');
        drawLegend('gapLegend', fallbackSeries, fallbackColors);

        // In fallback (no national data) draw District + State sparklines via helper
        try {
          prepareAndDrawSparkline({ canvasId: 'nonwhiteChart', legendId: 'nonwhiteLegend', title: 'Percent non-white', field: 'PCT_ENR_NON_WH', records, years, natLookup: null, stateAbbrev });
          prepareAndDrawSparkline({ canvasId: 'apChart', legendId: 'apLegend', title: 'AP participation (%)', field: 'PCT_ENR_AP', records, years, natLookup: null, stateAbbrev });
          prepareAndDrawSparkline({ canvasId: 'stChart', legendId: 'stLegend', title: 'Student–teacher ratio', field: 'STU_TEACH_RAT', records, years, natLookup: null, stateAbbrev });
          prepareAndDrawSparkline({ canvasId: 'apCoursesChart', legendId: 'apCoursesLegend', title: 'Modal AP courses', field: 'SCH_APCOURSES', records, years, natLookup: null, stateAbbrev });
        } catch (e) { console.warn('Could not draw fallback sparklines', e); }
      });

    // exit here to avoid drawing twice (we draw in the fetch callback)
    return;
  } catch (e) {
    console.warn('Error preparing state/national series:', e);
  }

  // default fallback if something goes wrong
  drawMiniChart("gapChart", years, series, { BL: colors.BL, HI: colors.HI }, 'AP participation gap');
  drawLegend("gapLegend", series, { BL: colors.BL, HI: colors.HI });
  // draw nonwhite & AP sparklines in default fallback
  try {
    const nonwhiteVals = records.map(r => {
      const v = r.PCT_ENR_NON_WH;
      return (v === null || v === undefined || isNaN(Number(v))) ? null : Number(v);
    });
    if (nonwhiteVals.some(v => v !== null)) {
  drawMiniChart('nonwhiteChart', years, { 'Non-white %': nonwhiteVals }, { 'Non-white %': '#333' }, 'Percent non-white');
    }
  } catch (e) { console.warn('Could not draw nonwhite sparkline (default fallback)', e); }

  try {
    const apVals = records.map(r => {
      const v = r.PCT_ENR_AP;
      return (v === null || v === undefined || isNaN(Number(v))) ? null : Number(v);
    });
    if (apVals.some(v => v !== null)) {
  drawMiniChart('apChart', years, { 'AP %': apVals }, { 'AP %': '#444' }, 'AP participation (%)');
    }
  } catch (e) { console.warn('Could not draw AP participation sparkline (default fallback)', e); }
  try {
    const stVals = records.map(r => {
      const v = r.STU_TEACH_RAT;
      return (v === null || v === undefined || isNaN(Number(v))) ? null : Number(v);
    });
    if (stVals.some(v => v !== null)) {
  drawMiniChart('stChart', years, { 'Stu-Teach': stVals }, { 'Stu-Teach': '#2a9d8f' }, 'Student–teacher ratio');
    }
  } catch (e) { console.warn('Could not draw student-teacher ratio sparkline (default fallback)', e); }
  try {
    const apCoursesVals = records.map(r => {
      const v = r.SCH_APCOURSES;
      return (v === null || v === undefined || isNaN(Number(v))) ? null : Number(v);
    });
    if (apCoursesVals.some(v => v !== null)) {
  drawMiniChart('apCoursesChart', years, { 'AP Courses': apCoursesVals }, { 'AP Courses': '#e76f51' }, 'Modal AP courses');
    }
  } catch (e) { console.warn('Could not draw AP courses sparkline (default fallback)', e); }
}


// get most recent year of data
function fmtValue(val, year, targetYear = 2021) {
  if (val == null || isNaN(val)) return "N/A";

  // Format number: if integer, keep as is; if float, round to 2 decimals
  let formatted;
  if (typeof val === "number") {
    formatted = Number.isInteger(val) ? val.toLocaleString() : Number(val.toFixed(2)).toLocaleString();
  } else {
    formatted = val;
  }

  return year !== targetYear ? `${formatted} (${year})` : formatted;
}
