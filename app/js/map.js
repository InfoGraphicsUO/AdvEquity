// data caches 
let geojsonCache = null;
let stateDataCache = null; // all state data
let districtDataCache = null; // all district data

// current selections
let currentDistrictValueMap = {};
// let firstSymbolId = null;
let currentMapPaint;
// let currentMapRace = 'black'; // race data in map ('black' |  'hispanic')
let currentRaceField  = 'ENR_AP_GAP_BL'; // fields with the data disparity data('ENR_AP_GAP_BL' |  'ENR_AP_GAP_HS')
let currentRaceCode = 'BL' // ('BL' |  'HI')


// current site state
let mapView; // extent of the map ('full' | 'state' | 'district')
let showAllStates // --- determine if showing all states ---
let currentAgg = 'state'; // how the data is currently aggregated in display (state | district), laods at state
let noGeometry = true;

// last site state
let lastDistrictStateFP = null;
let lastDistrictStateAbbrev = null;

// color variables (should match with css)
// Pull CSS variables used by the canvas chart utilities
const _root = document.documentElement;
const noDataColor = getComputedStyle(_root).getPropertyValue('--no-data-color').trim();
const noDisparityColor = getComputedStyle(_root).getPropertyValue('--no-disparity-color').trim();
const hispanicClass1Color = getComputedStyle(_root).getPropertyValue('--hispanic-class-1-color').trim();
const hispanicClass2Color = getComputedStyle(_root).getPropertyValue('--hispanic-class-2-color').trim();
const hispanicClass3Color = getComputedStyle(_root).getPropertyValue('--hispanic-class-3-color').trim();
const hispanicClass4Color = getComputedStyle(_root).getPropertyValue('--hispanic-class-4-color').trim();
const hispanicClass5Color = getComputedStyle(_root).getPropertyValue('--hispanic-class-5-color').trim();
const blackClass1Color = getComputedStyle(_root).getPropertyValue('--black-class-1-color').trim();
const blackClass2Color = getComputedStyle(_root).getPropertyValue('--black-class-2-color').trim();
const blackClass3Color = getComputedStyle(_root).getPropertyValue('--black-class-3-color').trim();
const blackClass4Color = getComputedStyle(_root).getPropertyValue('--black-class-4-color').trim();
const blackClass5Color = getComputedStyle(_root).getPropertyValue('--black-class-5-color').trim();
const whiteClass4Color = getComputedStyle(_root).getPropertyValue('--white-class-4-color').trim();
const asianClass4Color = getComputedStyle(_root).getPropertyValue('--asian-class-4-color').trim();
const nativeAmericanClass4Color = getComputedStyle(_root).getPropertyValue('--native-american-class-4-color').trim();

const blackColors = {
  noData: noDataColor,
  noDisparity: noDisparityColor,
  class1: blackClass1Color,
  class2: blackClass2Color,
  class3: blackClass3Color,
  class4: blackClass4Color,
  class5: blackClass5Color
};

const hispanicColors = {
  noData: noDataColor,
  noDisparity: noDisparityColor,
  class1: hispanicClass1Color,
  class2: hispanicClass2Color,
  class3: hispanicClass3Color,
  class4: hispanicClass4Color,
  class5: hispanicClass5Color
};

const compColors = { WH: whiteClass4Color, HI: hispanicClass4Color, BL: blackClass4Color, AS: asianClass4Color, OTH: nativeAmericanClass4Color };

const states = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  PR: "Puerto Rico",
  DC: "D.C."
};

// zoom view breaks
let zoomLevel;
const districtMinZoom = 5.5;
const stateMinZoom = 4.0; //oregon optimized
// const stateMinZoom = 4.46; //texas optimized
// const stateMinZoom = 3.37; //alaska optimized

let triggeredByMapClick = false;
let triggeredByBackToState = false;


console.log("MAP JS loaded");

document.addEventListener('DOMContentLoaded', () => {

  const fullExtentButton = document.querySelector('#full_extent');

  // map-level "Back to state" button 

  // backToStateMapBtn.innerHTML  = '<i class="fa-solid fa-arrow-rotate-left"></i>';
  // backToStateMapBtn.setAttribute('title', 'Back to state');

  // // insert BEFORE the fullExtentButton if present
  // if (fullExtentButton && fullExtentButton.parentNode) {
  //   fullExtentButton.parentNode.insertBefore(backToStateMapBtn, fullExtentButton);
  // } else {
  //   // fallback: append to body
  //   document.body.appendChild(backToStateMapBtn);
  // }

  // click handler - zoom back to the last district's state (stored when factsheet opens)

 $('#legend-note').click(() => {
  console.log("legend-note CLICKED");
  openInfoModal();
  });

 $('#backToStateMapBtn').click(ZoomToState);

  // canonical view setter: 'full' | 'state' | 'district'
  // setMapView available globally so code outside this scope
  let isSettingMapView = false;
  setMapView = function(view) {
    if (isSettingMapView) return;
    if (mapView === view) {
      if (typeof updateControlStates === 'function') updateControlStates();
      return;
    }

    isSettingMapView = true;
    try {
      mapView = view; // canonical
      // backwards compatibility for older code/tests
      isFullUSView = (view === 'full');
      if (typeof updateControlStates === 'function') updateControlStates();
    } finally {
      isSettingMapView = false;
    }
  };

  function updateControlStates() {
    try {
      if (!backToStateMapBtn.disabled) {
        console.log("backToStateMapBtn")
        console.log("lastDistrictStateFP", lastDistrictStateFP)
        console.log("lastDistrictStateAbbrev", lastDistrictStateAbbrev)

        const hasValidStateInfo = !!(lastDistrictStateFP || lastDistrictStateAbbrev);
        if (mapView === 'district' && hasValidStateInfo) {
          console.log("enable backToStateMapBtn")
          backToStateMapBtn.disabled = false;
          backToStateMapBtn.classList.remove('control-disabled');
          $('#backToStateMapLabel').html("View " + states[currentStateAbbrev]);
        } else {
          console.log("disable backToStateMapBtn")
          backToStateMapBtn.disabled = true;
          backToStateMapBtn.classList.add('control-disabled');
        }
      }
      // if (fullExtentButton) {
      //   if (mapView === 'full') {
      //     fullExtentButton.disabled = true;
      //     fullExtentButton.classList.add('control-disabled');
      //   } else {
      //     fullExtentButton.disabled = false;
      //     fullExtentButton.classList.remove('control-disabled');
      //   }
      // }
    } catch (e) {
      console.warn('updateControlStates error', e);
    }
  }
  // set initial canonical view and update controls
  setMapView('full');
  const raceSelectionButton = document.querySelectorAll('.race-selectBtn');
  const aggSelectionButton = document.querySelectorAll('.agg-selectBtn');
  const mapLoadingOverlay = document.getElementById('mapLoadingOverlay');

  function setMapToggleLoadingState(isLoading) {
    [...raceSelectionButton, ...aggSelectionButton].forEach(btn => {
      btn.disabled = isLoading;
    });
  }

  function showMapToggleLoading() {
    if (mapLoadingOverlay) mapLoadingOverlay.style.display = 'flex';
    setMapToggleLoadingState(true);
  }

  function hideMapToggleLoading() {
    if (mapLoadingOverlay) mapLoadingOverlay.style.display = 'none';
    setMapToggleLoadingState(false);
  }
  // flag to determine whether user interaction has happened (don't sort on initial load)
  let userHasInteracted = false;
  // track aggregation selection separately from canonical map view
  // currentAgg = 'state'; // 'state' or 'district'
  // track currently selected race field
  currentRaceField = 'ENR_AP_GAP_BL'; // default to Black students
  // currentMapRace = 'black'

  // update map based on race selection from gap chart picker
  window.updateMapForRace = function(raceCode) {
    showMapToggleLoading();

    const fieldName = raceCode === 'BL' ? 'ENR_AP_GAP_BL' : 'ENR_AP_GAP_HI';
    currentRaceField = fieldName;

    // // $('#currentRaceDesc')
    // //   .html(raceCode === 'BL' ? 'Black' : 'Hispanic')
    // //   .attr('style', raceCode === 'BL'
    // //     ? 'color:#2c7a2c !important;'
    // //     : 'color:#f9c400 !important;'  
    // //   );

    //   $('#currentRaceDesc').css('color', 'blue')

    const raceButtons = document.querySelectorAll('.race-selectBtn');
    raceButtons.forEach(btn => {
      btn.classList.remove('active');
      if ((raceCode === 'BL' && btn.id === 'race-selectBlk') || 
          (raceCode === 'HI' && btn.id === 'race-selectHis')) {
        btn.classList.add('active');
      }
    });

    const aggButtons = document.querySelectorAll('.agg-selectBtn');
    console.log(aggButtons)
    aggButtons.forEach(btn => {
      //if active, background color should be driven by race selection
      if (raceCode === 'BL') {
        btn.classList.remove('agg-selectHis');
        btn.classList.add('agg-selectBlk');
      } else if (raceCode === 'HI') {
        btn.classList.remove('agg-selectBlk');
        btn.classList.add('agg-selectHis');
      } 
    });

    // Update map based on current view
    if (mapView === 'full') {
      map.setLayoutProperty('state-fills', 'visibility', 'visible');
      map.setLayoutProperty('district-fills', 'visibility', 'none');
      map.setLayoutProperty('district-lines', 'visibility', 'none')
      map.setLayoutProperty('district-lines-hover', 'visibility', 'none')
      fillStateMap(map, geojsonCache, stateDataCache, fieldName);
      
      map.once('idle', () => {
        hideMapToggleLoading();
      });
    } else if (mapView === 'state' || mapView === 'district') {
      map.setLayoutProperty('state-fills', 'visibility', 'none');
      map.setLayoutProperty('district-fills', 'visibility', 'visible');
      map.setLayoutProperty('district-lines', 'visibility', 'visible');
      map.setLayoutProperty('district-lines-hover', 'visibility', 'visible');
      
      getDistrictData('all').then(districtData => {
        const stateAbbrev = window.currentStateAbbrev;
        const stateFIPS = window.currentStateFIPS;
        
        if (stateAbbrev && stateFIPS) {
          const filteredDistrictData = districtData.filter(d => 
            d.LEA_STATE === stateAbbrev || String(d.STATEFP).padStart(2, '0') === String(stateFIPS).padStart(2, '0')
          );
          fillDistrictMap(map, filteredDistrictData, stateAbbrev, stateFIPS, fieldName);
          buildDistrictTable(filteredDistrictData, fieldName);
        } else {
          fillDistrictMap(map, districtData, 'all', 'all', fieldName);
        }

        map.once('idle', () => {
          hideMapToggleLoading();
        });
      }).catch(err => {
        console.error('Error updating map for race:', err);
        hideMapToggleLoading();
      });
    }
  };

  function activateStateView(){
    console.log("activateStateView")
    showMapToggleLoading();
    //note and display state level view
    currentAgg = 'state';
    // $(quantLabel).text("state")
    $('#agg-selectState').addClass('active')
    $('#agg-selectDist').removeClass('active')

    // switch map view to state (not full US)
    if (typeof setMapView === 'function') setMapView('state');
    console.log("clickedState")
    // hide district layers
    map.setLayoutProperty('state-fills', 'visibility', 'visible');
    map.setLayoutProperty('district-fills', 'visibility', 'none');
    map.setLayoutProperty('district-lines', 'visibility', 'none')
    map.setLayoutProperty('district-lines-hover', 'visibility', 'none')
    if (map.getLayer('selected-district')) map.setLayoutProperty('selected-district', 'visibility', 'none');

    // redraw state map with currently selected race field
    if (geojsonCache && stateDataCache && currentRaceField) {
      fillStateMap(map, geojsonCache, stateDataCache, currentRaceField);
    }

    // update control states if function exists
    if (typeof updateControlStates === 'function') updateControlStates();

    map.once('idle', () => {
      hideMapToggleLoading();
    });
  }

  function activateDistrictView() {
    console.log('activateDistrictView')
    showMapToggleLoading();
    //note and display state level view
    currentAgg = 'district';
    // $(quantLabel).text("district")
    $('#agg-selectState').removeClass('active');
    $('#agg-selectDist').addClass('active');
    if (typeof setMapView === 'function') setMapView('district');
    if (typeof updateControlStates === 'function') updateControlStates();

    // zoom in if needed due to data cap
    if (map.getZoom() < 3.0) map.setZoom(3.0)

    // $(quantLabel).text("district")
    map.setLayoutProperty('state-fills', 'visibility', 'none');

    map.setLayoutProperty('district-fills', 'visibility', 'visible');
    map.setLayoutProperty('district-lines', 'visibility', 'visible');
    map.setLayoutProperty('district-lines-hover', 'visibility', 'visible');
    map.setLayoutProperty('selected-district', 'visibility', 'visible');

    // Load district data and then apply the paint
    getDistrictData('all').then(districtData => {
      fillDistrictMap(
        map,
        districtData,
        'all',
        'all',
        currentRaceField 
      );

      map.once('idle', () => {
        hideMapToggleLoading();
      });
    }).catch(err => {
      console.error('Error updating map for aggregation:', err);
      hideMapToggleLoading();
    });
  }


  // data
  aggSelectionButton.forEach(btn => {
    btn.addEventListener('click', function() {
      showMapToggleLoading();
      // Remove active class from all buttons
      aggSelectionButton.forEach(b => b.classList.remove('active'));

      // Add active class to clicked button
      this.classList.add('active');


      // display State level data
      if (this.id === 'agg-selectState'){
        activateStateView()
      } else if (this.id === 'agg-selectDist'){
        activateDistrictView()
      }

    })
  });

  raceSelectionButton.forEach(btn => {
    btn.addEventListener('click', function() {
      showMapToggleLoading();
      
      // Remove active class from all buttons
      raceSelectionButton.forEach(b => b.classList.remove('active'));

      // Add active class to clicked button
      this.classList.add('active');


      // Determine field based on button ID
      let fieldName;
      if (this.id === 'race-selectBlk') {
        fieldName = 'ENR_AP_GAP_BL';
        $('#currentRaceDesc')
          .text('Black')                // safer than .html for plain text
          .css('color', blackClass4Color);     // bright gold - may need to adjust

        //assign classes for agg button color
        aggSelectionButton.forEach(aggBtn => {
          aggBtn.classList.remove('agg-selectHis');
          aggBtn.classList.add('agg-selectBlk');
        });
        //style buttons in factsheet legend
        $('#gapRaceHis').removeClass('active');
        $('#gapRaceBlk').addClass('active');
        if (window.drawGapChartForRace) { // if factsheet open, update gap chart
          window.drawGapChartForRace('BL');
        }
      } else if (this.id === 'race-selectHis') {
        fieldName = 'ENR_AP_GAP_HI';
        $('#currentRaceDesc')
          .text('Hispanic')
          .css('color', hispanicClass4Color);     // medium blue
        
        //assign classes for agg button color
        aggSelectionButton.forEach(aggBtn => {
          aggBtn.classList.remove('agg-selectBlk');
          aggBtn.classList.add('agg-selectHis');
        });
        //style buttons in factsheet legend
        $('#gapRaceBlk').removeClass('active');
        $('#gapRaceHis').addClass('active');

        if (window.drawGapChartForRace) { // if factsheet open, update gap chart
          window.drawGapChartForRace('HI');
        }
      }

      // global var for current race
      currentRaceField = fieldName;

      // update map based on current view
      // mapView can be: 'full', 'state', 'district'
      if (mapView === 'full') {
        map.setLayoutProperty('state-fills', 'visibility', 'visible');
        map.setLayoutProperty('district-fills', 'visibility', 'none');
        map.setLayoutProperty('district-lines', 'visibility', 'none')
        map.setLayoutProperty('district-lines-hover', 'visibility', 'none')
        fillStateMap(map, geojsonCache, stateDataCache, fieldName);
        // Clear stored state info when in full view
        window.currentStateFIPS = null;
        window.currentStateAbbrev = null;
        
        map.once('idle', () => {
          hideMapToggleLoading();
        });
      } else if (mapView === 'state' || mapView === 'district') {
        //zoomed into a state showing districts OR clicked on a district
        map.setLayoutProperty('state-fills', 'visibility', 'none');
        map.setLayoutProperty('district-fills', 'visibility', 'visible');
        map.setLayoutProperty('district-lines', 'visibility', 'visible');
        map.setLayoutProperty('district-lines-hover', 'visibility', 'visible');
        map.setLayoutProperty('selected-district', 'visibility', 'visible');
        
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
            hideMapToggleLoading();
          });
        }).catch(err => {
          console.error('Error updating map for race:', err);
          hideMapToggleLoading();
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
            // order by 2021 column (index 3) descending (Data tables count from 0)
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
    searchBox.accessToken = mapboxgl.accessToken
    searchBox.mapboxgl = mapboxgl;
    searchBox.options = {
        types: 'city,district,region,place,locality',
        proximity: map.getCenter(), // bias to current map center 
        country: 'US', // limit to United States
    };
    searchBox.componentOptions = { allowReverse: true, flipCoordinates: true };
    console.log('loaded search box')
    document.getElementById('search_box_holder').appendChild(searchBox);
    searchBox.bindMap(map);    
    searchBox.placeholder = 'Zoom to a location...';
    searchBox.marker = {
      color: almostBlack,
      draggable: true
    };

$('#full_extentBtn').click(function(){
    districtPopup.remove()
    // document.getElementById('mapLegend').style.display = 'none'; // hide legend
    map.fitBounds([[ -126, 24], [-66, 50]]); // albers
    //map.jumpTo({ center: [-99.2, 40.0], zoom: 3 })
    
    // Hide district layers
    if (map.getLayer("district-lines")){
      map.setLayoutProperty('district-lines', 'visibility', 'none');
      map.setLayoutProperty('district-lines-hover', 'visibility', 'none');
      map.setLayoutProperty('district-fills', 'visibility', 'none');
    }
    // Show state layer
    if (map.getLayer('state-fills')) {
      map.setLayoutProperty('state-fills', 'visibility', 'visible');
    }
    
    hideDistrictFactSheetContainer();
    
    // clear stored state info
    window.currentStateFIPS = null;
    window.currentStateAbbrev = null;
    
    // redraw state map with current race field
    if (geojsonCache && stateDataCache && currentRaceField) {
      fillStateMap(map, geojsonCache, stateDataCache, currentRaceField);
    }
    
    // mark full US view active and update controls
    if (typeof setMapView === 'function') setMapView('full');
    currentAgg = 'state';
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

  queryBarWidth = document.getElementById('mapWidgetsQuery').getBoundingClientRect().width;
  // console.log('select box height',baseMenuHeight)
  
  // initQueryWidth()
  $('#resizeQueryButton').on('click', function() {
    resizeQueryBar('qbExpanded')
  })

  let previousZoom = map.getZoom();
  map.on('zoomend', function () {
    zoomLevel = map.getZoom()
    let zoomDirection
    console.log('zoom level: ', zoomLevel.toFixed(3));

    // determine zoom direction (in or out)
    if (zoomLevel > previousZoom) {
        console.log("Direction: Zooming IN");
        zoomDirection = "IN"
    } else if (zoomLevel < previousZoom) {
        console.log("Direction: Zooming OUT");
        zoomDirection = "OUT"
    } else {
        console.log("Direction: No change (likely panned)");
        zoomDirection = "PAN"
    }

    // 3. Update the tracker for the next event
    previousZoom = zoomLevel;

    //district filter tells whether the user toggled the view or if it was toggled by a click on a state
    var districtFilter = map.getFilter('district-fills')
    if (districtFilter) districtFilter = true;
    console.log('districtFilter', districtFilter)

    // resizeQueryBar('qbCollapsed');
    
    console.log('zoomend mapView: ', mapView)
    // if (map.getZoom() > 8) { //if we are zoomed in enough then it is likely because the search bar was used
    //   if (mapView == 'full' ){
    //     console.log('full -> district view')
    //     // activateStateView()
    //     activateDistrictView()
    //   } else if (mapView == 'state') {
    //     console.log('state -> district view')
    //     // activateStateView()
    //     activateDistrictView()
    //   } else {
    //     console.log('district view -> district view')
    //     //reactivate all districts. required due to click path variation
    //     // activateStateView()
    //     activateDistrictView()
    //   }
    // };


    // ZOOM BASED VIEW TOGGLE
    // TODO: fix bug - toggling to district view via zoom or button doesn't allow district to open with click.  It needs the state to be openfirst before opening the district

    if (!triggeredByMapClick && !triggeredByBackToState) { 
      console.log('ZOOM BASED VIEW CHANGE')
      console.log("currentAgg: ",currentAgg)
      if (zoomLevel > districtMinZoom) {
        console.log('ZOOM BASED DISTRICT VIEW');
        activateDistrictView()
        // $('#agg-selectDist').click()
      } else if (zoomLevel >= stateMinZoom && currentAgg != 'state' && zoomDirection == 'IN') {
        // zoom in by mouse, switch to district view
        console.log('ZOOM BASED STATE VIEW');
        activateDistrictView()
        // $('#agg-selectDist').click()




        //simulate a click on the center of the map - issue with this is that it gets stuck there when trying to zoom in or out
        // // project map center to screen coords, query for a state feature there
        // const centerPoint = map.project(map.getCenter());
        // const features = map.queryRenderedFeatures(centerPoint, { layers: ['state-fills'] });

        // if (features.length && typeof window.onStateClick === 'function') {
        //   window.onStateClick(features[0]);
        // }
      } else if (zoomLevel < stateMinZoom && zoomDirection == "OUT" && !districtFilter){ //don't switch back if user selected district view
        console.log('ZOOM BASED FULL VIEW');
        $('#agg-selectState').click()
      } else if (zoomLevel < stateMinZoom){
        console.log('NO ZOOM BASED AGG CHANGE ');
      }
    } else { //don't do zoom-based view if map or "return to state" clicked, reset globals
      triggeredByMapClick = false;
      triggeredByBackToState = false;
    }


    //updateControlStates() 


    // if (currentAgg=='district' && lastDistrictStateFP != null ){
    //   console.log("enableing back to state")
    //   $('#backToStateMapBtn').removeClass('control-disabled')
    // }

    // set bias on search box
    const center = map.getCenter();
    searchBox.options = {
      ...searchBox.options,
      proximity: [center.lng, center.lat]
    };
    console.log("set bias")


  });
});

mapboxgl.accessToken =  MAPBOXTOKEN

const map = new mapboxgl.Map({
  container: 'map',
  // style: 'mapbox://styles/mapbox/dark-v11',
  // style: 'mapbox://styles/infographics/cmh5hw4m800l001sr4kx07py4', // dark
  style: 'mapbox://styles/infographics/cmk1ok3vi005701svffff2c16', // light
  maxZoom : 10, 
  minZoom : 0, 
  // zoom: 3,
  bounds: [[ -126, 24], [-66, 50]], // inital bounding box (southwest corner, northeast corner)
  // maxBounds: [[ -140, 25],[-50, 65]], // bounding box (southwest corner, northeast corner)
  fitBoundsOptions: {
    padding: 30 // padding to keep the bounds away from the edge of the map
  },
  // projection: 'albers',
  projection: 'globe',
  // projection: 'mercator',
  // center: [-99.2, 40.0],
  // parallels: [27.5, 44.55]
  customAttribution: '<a href="https://infographics.uoregon.edu/" target="_blank" rel="noopener noreferrer">InfoGraphics Lab</a>',
  logoPosition: 'bottom-right'
});

// Add zoom buttons - position defined in mapStyle.css .mapboxgl-ctrl-top-left
map.addControl(new mapboxgl.NavigationControl({
    showCompass: false 
}), 'bottom-left');

let hoveredPolygonId = null; // highlight state
let previousHighlightedRowId = null; // for highlighting state in table
let hoveredDistrictPolygonID = null; // highlight district
let selectedPolygonId = null; // for click selection

var districtPopup = new mapboxgl.Popup({
  closeButton: false,
  closeOnClick: false
});



map.on('load', () => {
  console.log("MAP LOAD FIRED");

  zoomLevel = map.getZoom()

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
        // // Find the index of the first symbol layer in the map style.
        // let firstSymbolId;
        // for (const layer of layers) {
        //     if (layer.type === 'symbol') {
        //         firstSymbolId = layer.id;
        //         break;
        //     }
        // }


  // SOURCES
  // States - Mapbox hosted state layer
  // map.addSource('states', {
  //   type: 'geojson',
  // data: 'https://docs.mapbox.com/mapbox-gl-js/assets/us_states.geojson',

  //   promoteId: 'STATE_ID'  // use STATE_ID as the unique ID
  // });

  // States -  JSON in repo
  map.addSource('states', {
    type: 'geojson',
    data: '/assets/data/geojson/STATE_SCHOOLDIST_Dissolve_Simpl100m.geojson',
    promoteId: 'STATE_ID'  // use STATE_ID as the unique ID
  });

  // States - IGL hosted tileset - dissolved school districts
  // map.addSource('states', {
  //   type: 'vector',
  //   data: 'mapbox://infographics.c0awjtve',
  //   promoteId: 'GEOID'  // use GEOID as the unique ID
  // });

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
  map.addLayer({
      id: 'district-fills',
      type: 'fill', 
      source: 'SCHOOLDIST_TL24', 
      'source-layer': 'SCHOOLDIST_TL24_Simpl100m-2kf22l', 
      paint: {
          'fill-color': 'transparent',
      },
      filter:  ["==", ["get", "GEOID"], -99] // initially, show no districts
  }, 'road-simple');

  map.addLayer({
      id: 'district-lines',
      type: 'line',
      source: 'SCHOOLDIST_TL24',
      'source-layer': 'SCHOOLDIST_TL24_Simpl100m-2kf22l',
      paint: {
        'line-color': offwhite,
        'line-opacity': 0.9,
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          0, 0,
          5, 0.75,
          8, 1,
          22, 1
        ]
      },
      layout: {
        'line-join': 'round', // Rounds corners at junctions
        'line-cap': 'round'   // Rounds endpoints
      },
      filter:  ["==", ["get", "GEOID"], -99] // initially, show no districts
  }, 'settlement-major-label');

  map.addLayer({
      id: 'district-lines-hover',
      type: 'line',
      source: 'SCHOOLDIST_TL24',
      'source-layer': 'SCHOOLDIST_TL24_Simpl100m-2kf22l',
      paint: {
        'line-color': '#000',
        'line-opacity': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          1,
          0
        ],
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          0, 0,
          5, 2.5,
          8, 2.5,
          22, 2.5
        ]
      },
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      filter:  ["==", ["get", "GEOID"], -99] // initially, show no districts
  }, 'settlement-major-label');



  map.addLayer({
      id: 'selected-district',
      type: 'line', 
      source: 'SCHOOLDIST_TL24', 
      'source-layer': 'SCHOOLDIST_TL24_Simpl100m-2kf22l', 
      paint: {
          'line-color': 'black',
          'line-width': 3
      },
      layout:{
        'line-join': 'round', // Rounds corners at junctions
        'line-cap': 'round'   // Rounds endpoints
      },
      filter:  ["==", ["get", "GEOID"], -99] // initially, show no districts
  }, 'settlement-major-label');



  map.addLayer({
  id: 'state-fills',
  type: 'fill',
  source: 'states',
  // 'source-layer': 'STATE_SCHOOLDIST_Dissolve_Sim-bvhhsy', // for IGL tileset
  paint: {
      'fill-color': 'red',
      'fill-opacity': 0.8
    }
  }, 'road-simple');

getStateData().then(({ geojson, stateData }) => {
  geojsonCache = geojson;
  stateDataCache = stateData;

  buildStateTable(stateDataCache, 'ENR_AP_GAP_BL'); // build table with default field
  fillStateMap(map, geojsonCache, stateDataCache, 'ENR_AP_GAP_BL'); // default map coloring
});

// county labels

  // 1. Add empty label source
  map.addSource('county-labels', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] }
  });

  // 2. Add label layer
map.addLayer({
  id: 'county-label-layer',
  type: 'symbol',
  source: 'county-labels',
  layout: {
    'text-field': ['get', 'NAME'],
    'text-size': 8,            
    'text-transform': 'uppercase',
    'text-letter-spacing': 0.3,
    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold']
  },
  paint: {
    'text-opacity':0.8,
    'text-color': '#aaa'     
  }
});

  // for adding county labels
let needsLabelUpdate = false;

map.on('moveend', () => {
  if (map.getZoom() >= 5) {
    needsLabelUpdate = true;
  }
});

// to label counties
// map.on('idle', () => {
//   if (needsLabelUpdate) {
//     console.log("Updating labels after moveend + idle");
//     needsLabelUpdate = false;
//     buildCountyPolylabels();
//   }
// });



// interactive borders
  map.addLayer({
    id: 'state-borders',
    type: 'line',
    source: 'states',
    // 'source-layer': 'STATE_SCHOOLDIST_Dissolve_Sim-bvhhsy', // for IGL tileset
    paint: {
      'line-color': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        colorYellow,   // when hover = true
        verydarkgrey       // default
      ],
      'line-width': [
      'case',
        ['boolean', ['feature-state', 'hover'], false],
          2.5, // thicker highlighted border
          1   // thinner default border 
      ],
      'line-offset': [
      'case',
        ['boolean', ['feature-state', 'hover'], false],
          2.5, // shift only highlighted border inward
          0   // default border no shift
        ]
    }
  }, 'settlement-major-label');

  // move state labels above district outlines
  const style = map.getStyle();
  const stateLabelLayerIds = style.layers
    .filter(layer => layer.type === 'symbol' && /state/i.test(layer.id) && /label/i.test(layer.id))
    .map(layer => layer.id);

  stateLabelLayerIds.forEach(layerId => {
    if (map.getLayer(layerId)) map.moveLayer(layerId);
  });

  map.on('mousemove', 'state-fills', (e) => {
    //hide the tool tip when in district/state level view
      if (mapView && mapView !== 'full') {
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
        description = `
        <div>
          <div class="popup-title">${props.NAME}</div>

          <div class="popup-row">
            <span class="popup-value">
              ${getStateOpportunityEstimates(fips, currentRaceField || 'ENR_AP_GAP_BL')}
            </span>
          </div>
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
    // console.log(fips)

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
  // CLICK FUNCTIONALITY — click state name to zoom
  $('#us-table tbody').on('click', 'td:first-child', function () {
    const table = $('#us-table').DataTable();

    // Get the row this cell belongs to
    const rowData = table.row($(this).closest('tr')).data();
    if (!rowData) return;

    const fips = rowData[4]; // hidden FIPS column
    console.log("Zooming to FIPS:", fips);

    // Call your existing zoom function
    if(lastDistrictStateFP != fips){
      lastDistrictStateFP = fips 
      lastDistrictStateAbbrev = 'XX' // TO DO, SET!
      ZoomToState();
    }
  });




  function onStateClick(e){
    console.trace('onStateClick()')
    currentAgg = "state" // clicking a state should keep the map in state mode
    triggeredByMapClick = true;
    //     // don't fire on the districts as well
    //  e.originalEvent.cancelBubble = true;   // stop bubbling
    //  e.originalEvent.stopPropagation?.();   // extra safety

    // setting global, local, and shared values //
    const clickedFeature = e;//
    // console.log('clickedFeature: ', clickedFeature)
    // store currently viewed state info globally for race switching
    window.currentStateFIPS = clickedFeature.id;
    // get state abbreviation from the clicked feature or from stateDataCache
    const fipsKey = String(clickedFeature.id).padStart(2, '0'); // pads with 0, if not two digits
    // console.log("fipsKey", fipsKey)
    let stateEntry = stateDataCache[fipsKey]; // data for this state
    window.currentStateAbbrev = stateEntry?.[0]?.state_abbrev ?? stateEntry?.[0]?.LEA_STATE ?? null;


    // clear last selected state from map
    if (selectedPolygonId !== null) {
      map.setFeatureState(
        { source: 'states', id: selectedPolygonId },
        { selected: false }
      );
    }
    // set new selection from new FIPS
    selectedPolygonId = currentStateFIPS
    // console.log("clicked feature id", selectedPolygonId)
    map.setFeatureState(
      { source: 'states', id: selectedPolygonId },
      { selected: true }
    );

    //clear selected district from map
    map.setFilter('selected-district',  ["==", ["get", "GEOID"], 99] );


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

    // fill fact sheet
    const fieldName = currentRaceField || 'ENR_AP_GAP_BL';
    console.log("stateEntry", stateEntry) // expect all data for this state
    // console.log("clickedFeature.id", clickedFeature.id)
    // console.log("fieldName", fieldName) 
    initFactSheet(stateEntry, clickedFeature.id, fieldName);
    // update canonical map view to 'state' and refresh controls
    if (typeof setMapView === 'function') setMapView('state');
  } // end onStateClick
  window.onStateClick = onStateClick;

    // --- click to zoom and outline ---
  // map.off('click', 'district-fills')

  function onDistrictClick(e){
    triggeredByMapClick = true;
    const feat = e; // now just passing a single feature
    const fid = feat.id;
    console.log(e)

    map.setFilter('selected-district',  ["==", ["get", "GEOID"], fid] );


    // console.log(showAllStates)
    // if (!showAllStates) {
      const bounds = new mapboxgl.LngLatBounds();
      function extendBounds(coords) {
        if (typeof coords[0][0] === 'number') coords.forEach(c => bounds.extend(c));
        else coords.forEach(extendBounds);
      }
      extendBounds(feat.geometry.coordinates);
      map.fitBounds(bounds, { padding: 30 });
      showDistrictFactsheet(feat, currentDistrictData, window.currentStateAbbrev || "");
      hideNoGeometryNotice();
    // }
  }



  map.off('click')
  map.on('click', e => {
    triggeredByMapClick = true;

    const features = map.queryRenderedFeatures(e.point, {
      layers: ['district-fills', 'state-fills']
    });

    if (!features.length) return;

    // Identify which feature is which
    let districtFeature = null;
    let stateFeature = null;

    for (const f of features) {
      if (f.layer.id === 'district-fills') districtFeature = f;
      if (f.layer.id === 'state-fills') stateFeature = f;
    }

    // If neither is present, nothing to do
    if (!districtFeature && !stateFeature) return;

    // --- AGGREGATION LOGIC ---
    if (currentAgg === 'district') {
      // If the clicked district is inside the current state of there is no current state feature
      if (districtFeature && (stateFeature ==null || stateFeature.id == currentStateFIPS )) {
        // Clicked inside current state → select neighbor district
        onDistrictClick(districtFeature);
        return;
      }

      // Otherwise, clicked a different state → open that state
      if (stateFeature) onStateClick(stateFeature);
      return;
    }

    // If aggregation is state-level
    if (currentAgg === 'state') {
      if (stateFeature) onStateClick(stateFeature);
    }
  });
});



const popup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false
});

// Fetch data
function getStateData(){

  const geojsonUrl = '../assets/data/geojson/STATE_SCHOOLDIST_Dissolve_Simpl100m.geojson';
  const stateDataUrl = '../assets/data/json/ap_equity_states.json';

  return Promise.all([
    fetch(geojsonUrl).then(res => res.json()),
    fetch(stateDataUrl).then(res => res.json())
  ])
  .then(([geojson, stateData]) => {
    console.log('Fetched GeoJSON:', geojson);
    // console.log('Fetched State JSON:', stateData);
    return { geojson, stateData };
  })
  .catch(error => {
    console.error('Error loading data:', error);
  });
}


function getDistrictData(state) {
  // to do: don't get if the state did not change?
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

function parseDistrictStateBreaks(csvRows) {
  const out = {};

  csvRows.forEach(d => {
    const year = Number(String(d.YEAR).trim());
    if (year !== 2021) return;

    const state = String(d.LEA_STATE).trim();
    const gap = String(d.gap_var).trim();

    if (!out[state]) out[state] = {};
    out[state][gap] = {
      b1: Number(d.b1),
      b2: Number(d.b2),
      b3: Number(d.b3),
      b4: Number(d.b4),
      min: Number(d.min),
      max: Number(d.max)
    };
  });

  return out;
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
    // initial order- sort by 2021 Enrollment Disparity descending
    order: [[4, 'desc']],
    columnDefs: [
      { targets: 4, visible: false }, // hide FIPS
      { targets: [1, 2, 3], type: 'na-last' } // apply custom sort
    ]
  });

  // Populate rows
  for (let state in stateData) {
    const stateArray = stateData[state];

  const yr2011 = stateArray.find(d => Number(String(d.YEAR).trim()) === 2011);
  const yr2021 = stateArray.find(d => Number(String(d.YEAR).trim()) === 2021);

    const ap = yr2021?.SCH_APCOURSES_MODE ?? 'N/A';
    const val2011Raw = yr2011?.[fieldName];
    const val2021Raw = yr2021?.[fieldName];
    const stateAbbrev = yr2011?.state_abbrev ?? yr2021?.state_abbrev ?? '';
    const fips = yr2011?.FIPS ?? yr2021?.FIPS ?? '';

    // Format display values
    const val2011 = typeof val2011Raw === 'number' ? `${val2011Raw.toFixed(2)}x` : '—';
    const val2021 = typeof val2021Raw === 'number' ? `${val2021Raw.toFixed(2)}x` : '—';
    const apDisplay = typeof ap === 'number' ? ap.toLocaleString() : '—';

    table.row.add([states[stateAbbrev], apDisplay, val2011, val2021, fips]);
  }

  table.order([[3, 'desc']]).draw() // 0 indexed
}

// // Global sort state (ASC/DESC per column)
// let districtSortState = {};

// // Helper: extract numeric sort value for a given record + column index
// function extractSortValue(record, col, fieldName) {
//   switch (col) {
//     case 1: return record.ENR ?? null;
//     case 2: return record.SCH_FTETEACH_TOT ?? null;
//     case 3: return record[fieldName] && record.YEAR === 2011 ? record[fieldName] : null;
//     case 4: return record[fieldName] && record.YEAR === 2021 ? record[fieldName] : null;
//     default: return null;
//   }
// }

// // Manual sorting of districtData
// function sortDistrictData(districtData, col, direction, fieldName) {
//   districtData.sort((a, b) => {
//     const va = extractSortValue(a, col, fieldName);
//     const vb = extractSortValue(b, col, fieldName);

//     // nulls last
//     if (va == null && vb == null) return 0;
//     if (va == null) return 1;
//     if (vb == null) return -1;

//     return direction === 'asc' ? va - vb : vb - va;
//   });
// }

function buildDistrictTable(districtData, fieldName) {
  console.log("Building District Table")
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
    order: [[4, 'desc']],
    columnDefs: [
      { targets: 5, visible: false }, // hide LEAID/internal
      // { targets: [2, 3, 4, 5], type: 'na-last' } // numeric columns
    ],
    createdRow: function (row, data) {
      const fmt = (n, d=1) =>
        typeof n === 'number'
          ? n.toLocaleString(undefined, {
              minimumFractionDigits: d,
              maximumFractionDigits: d
            })
          : '—';

      $('td:eq(1)', row).text(fmt(data[1], 0)); // students
      $('td:eq(2)', row).text(fmt(data[2], 1)); // teachers
      const opp2011 = fmt(data[3], 2);
      const opp2021 = fmt(data[4], 2);
      $('td:eq(3)', row).text(opp2011 === '—' ? '—' : `${opp2011}x`); // 2011 opp
      $('td:eq(4)', row).text(opp2021 === '—' ? '—' : `${opp2021}x`); // 2021 opp
    }
  });


  // Group by LEAID
  const grouped = {};
//  for (const d of districtDataCache){ // all data?
  // console.log('districtData', districtData)
  for (const d of districtData) {  // just 2021?
    const id = d.LEAID ?? Math.random();
    if (!grouped[id]) grouped[id] = [];
    grouped[id].push(d);
  }

  // console.log('grouped', grouped)

  for (const id in grouped) {
    const records = grouped[id];

    // Filter by year
    const yr2011 = records.find(r => r.YEAR === 2011);
    //console.log('yr2011', yr2011)
    const yr2021 = records.find(r => r.YEAR === 2021); 
    //console.log('yr2011', yr2021)

    const districtName = yr2021?.LEA_NAME ?? yr2011?.LEA_NAME ?? 'Unknown';
    const stateAbbrev = yr2021?.LEA_STATE ?? yr2011?.LEA_STATE ?? '—';
    const numStudents = yr2021?.ENR ?? yr2011?.ENR ?? '—';
    const numTeachers = yr2021?.SCH_FTETEACH_TOT ?? yr2011?.SCH_FTETEACH_TOT ?? '—';

    // Pull the Opportunity Estimate from chosen field, filtered by year
    const val2011Raw = yr2011?.[fieldName];
    const val2021Raw = yr2021?.[fieldName];

    const students = sortableCell(numStudents, 0);
    const teachers = sortableCell(numTeachers, 1);
    const opp2011 = sortableCell(val2011Raw, 2);
    const opp2021 = sortableCell(val2021Raw, 2);


    table.row.add([
      districtName,
      students.order,
      teachers.order,
      opp2011.order,
      opp2021.order,
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
        noGeometry = true;
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

function sortableCell(value, decimals = 1) {
  if (typeof value !== 'number' || isNaN(value)) {
    return {
      display: '—',
      order: null
    };
  }

  const rounded = Number(value.toFixed(decimals));

  return {
    display: rounded.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }),
    order: rounded
  };
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


// async function loadStateBreaks() {
//   const text = await fetch(stateDataUrl).then(r => r.text());
//   const [header, ...rows] = text.trim().split('\n');

//   const keys = header
//     .split(',')
//     .map(k => k.replace(/"/g, '').trim()); 

//   return rows.map(row => {
//     const values = row.split(',').map(v => v.replace(/"/g, '').trim());
//     return Object.fromEntries(
//       keys.map((k, i) => [k, values[i]])
//     );
//   });
// }



// to store paints
const paints = {
  State_National_Breaks: {
    black: null,
    hispanic: null
  },
  District_National_Breaks: {
    black: null,
    hispanic: null
  },
  District_State_Breaks: {
    black: null,
    hispanic: null
  }
};

// to store break value
const breaksByAggregation = {
  State_National_Breaks: null,
  District_National_Breaks: null,
  District_State_Breaks: null
};

const isGitHubPages = window.location.hostname.includes('github.io');
const BASE = isGitHubPages ? '/AdvEquity' : '';

// paths work on github
const BREAKS_URLS = {
  State_National_Breaks:
    `${BASE}/assets/data/AP%20Data/class%20breaks/ap_equity_state_national_breaks.csv`,
  District_National_Breaks:
    `${BASE}/assets/data/AP%20Data/class%20breaks/ap_equity_district_national_breaks.csv`,
  District_State_Breaks:
    `${BASE}/assets/data/AP%20Data/class%20breaks/ap_equity_district_within_state_breaks.csv`
};


let breaks2021;
let blackPaint, hispanicPaint;
let paintsReady = false;

async function loadBreaksCsv(url) {
  const text = await fetch(url).then(r => r.text());
  const [header, ...rows] = text.trim().split('\n');

  const keys = header
    .split(',')
    .map(k => k.replace(/"/g, '').trim());

  return rows.map(row => {
    const values = row.split(',').map(v => v.replace(/"/g, '').trim());
    return Object.fromEntries(
      keys.map((k, i) => [k, values[i]])
    );
  });
}

function parseBreaks2021(csvRows) {
  return csvRows
    .filter(d => Number(String(d.YEAR).trim()) === 2021)
    .reduce((acc, d) => {
      acc[d.gap_var] = {
        b1: Number(d.b1),
        b2: Number(d.b2),
        b3: Number(d.b3),
        b4: Number(d.b4),
        min: Number(d.min),
        max: Number(d.max)
      };
      return acc;
    }, {});
}

function parseDistrictStateBreaks(csvRows) {
  const out = {};

  for (const d of csvRows) {
    const year = Number(d.YEAR);
    if (year !== 2021) continue;

    const state = d.LEA_STATE.trim();
    const gap = d.gap_var.trim();

    if (!out[state]) out[state] = {};

    out[state][gap] = {
      b1: Number(d.b1),
      b2: Number(d.b2),
      b3: Number(d.b3),
      b4: Number(d.b4),
      min: Number(d.min),
      max: Number(d.max)
    };
  }

  return out;
}


async function loadPaintsForAggregation(aggregationLevel) {
  const url = BREAKS_URLS[aggregationLevel];
  const csvData = await loadBreaksCsv(url);

  if (aggregationLevel === 'District_State_Breaks') {
    // SPECIAL HANDLING FOR STATE‑SPECIFIC BREAKS
    breaksByAggregation.District_State_Breaks = parseDistrictStateBreaks(csvData);
    console.log("Loaded state‑specific district breaks");
    return;   // IMPORTANT: STOP HERE — DO NOT BUILD PAINTS
  }

  const breaks2021 = parseBreaks2021(csvData);

  if (!breaks2021.ENR_AP_GAP_BL || !breaks2021.ENR_AP_GAP_HI) {
    throw new Error(`Missing 2021 BL or HI breaks for ${aggregationLevel}`);
  }

  // 🔍 LOG BREAKS SAFELY HERE
console.log("BL breaks raw:", breaks2021.ENR_AP_GAP_BL); console.log("Type:", typeof breaks2021.ENR_AP_GAP_BL); 
console.log("Is array:", Array.isArray(breaks2021.ENR_AP_GAP_BL));

 // Decide which paint builder to use
const isState = aggregationLevel === 'State_National_Breaks';

// Store breaks
breaksByAggregation[aggregationLevel] = breaks2021;

// Build black paint
paints[aggregationLevel].black = isState
  ? buildGapPaintState(
      'ENR_AP_GAP_BL',
      breaks2021.ENR_AP_GAP_BL,
      {
        noData: noDataColor,
        noDisparity: noDisparityColor,
        class1: blackClass1Color,
        class2: blackClass2Color,
        class3: blackClass3Color,
        class4: blackClass4Color,
        class5: blackClass5Color
      }
    )
  : buildGapPaintDistrict(
      breaks2021.ENR_AP_GAP_BL,
      {
        noData: noDataColor,
        noDisparity: noDisparityColor,
        class1: blackClass1Color,
        class2: blackClass2Color,
        class3: blackClass3Color,
        class4: blackClass4Color,
        class5: blackClass5Color
      }
    );

// Build hispanic paint
paints[aggregationLevel].hispanic = isState
  ? buildGapPaintState(
      'ENR_AP_GAP_HI',
      breaks2021.ENR_AP_GAP_HI,
      {
        noData: noDataColor,
        noDisparity: noDisparityColor,
        class1: hispanicClass1Color,
        class2: hispanicClass2Color,
        class3: hispanicClass3Color,
        class4: hispanicClass4Color,
        class5: hispanicClass5Color
      }
    )
  : buildGapPaintDistrict(
      breaks2021.ENR_AP_GAP_HI,
      {
        noData: noDataColor,
        noDisparity: noDisparityColor,
        class1: hispanicClass1Color,
        class2: hispanicClass2Color,
        class3: hispanicClass3Color,
        class4: hispanicClass4Color,
        class5: hispanicClass5Color
      }
    );


  console.log(`${aggregationLevel} paints ready`);
}


async function loadClassBreaksForAggregation(aggregationLevel) {
  const url = BREAKS_URLS[aggregationLevel];

  if (!url) {
    throw new Error(`Unknown aggregation level: ${aggregationLevel}`);
  }

  const csvData = await loadBreaksCsv(url);

  if (!csvData || !csvData.length) {
    throw new Error(`No break data loaded for ${aggregationLevel}`);
  }

  const breaks2021 = parseBreaks2021(csvData);

  if (!breaks2021.ENR_AP_GAP_BL || !breaks2021.ENR_AP_GAP_HI) {
    throw new Error(`Missing 2021 BL or HI breaks for ${aggregationLevel}`);
  }

  return {
    breaks2021,

    blackPaint: buildGapPaint(
      'ENR_AP_GAP_BL',
      breaks2021.ENR_AP_GAP_BL,
      {
        noData: noDataColor,
        noDisparity: noDisparityColor,
        class1: blackClass1Color,
        class2: blackClass2Color,
        class3: blackClass3Color,
        class4: blackClass4Color,
        class5: blackClass5Color
      }
    ),

    hispanicPaint: buildGapPaint(
      'ENR_AP_GAP_HI',
      breaks2021.ENR_AP_GAP_HI,
      {
        noData: noDataColor,
        noDisparity: noDisparityColor,
        class1: hispanicClass1Color,
        class2: hispanicClass2Color,
        class3: hispanicClass3Color,
        class4: hispanicClass4Color,
        class5: hispanicClass5Color
      }
    )
  };
}

Promise.all([
  loadPaintsForAggregation('State_National_Breaks'),
  loadPaintsForAggregation('District_National_Breaks'),
  loadPaintsForAggregation('District_State_Breaks')
])
.then(() => {
  console.log('All paints ready');
})
.catch(err => console.error('Error loading paints', err));

function fillStateMap(map, geojson, stateData, fieldName) {
  const paintSet  = paints.State_National_Breaks;
  const breaksSet = breaksByAggregation.State_National_Breaks;

  if (!paintSet || !paintSet.black || !paintSet.hispanic) {
    console.warn('Paints not ready yet (State_National_Breaks)');
    return;
  }

  if (!breaksSet) {
    console.warn('Breaks not ready yet (State_National_Breaks)');
    return;
  }

  console.log('fillStateMap:', fieldName);

  const targetYear = 2021; // assumes map is always 2021 data

  // --------------------------------------------------
  // update legend values
  // select the current breaks object based on the field
  const legend = $('#mapLegend');
  legend.removeClass('legend-single-district legend-no-district');

  const breaks =
    fieldName === 'ENR_AP_GAP_BL'
      ? breaksSet.ENR_AP_GAP_BL
      : breaksSet.ENR_AP_GAP_HI;

  if (!breaks) {
    console.warn('Missing state breaks for field:', fieldName);
    return;
  }
  
  $('#legendMin').text(formatLegendVal(breaks.min)+'x');
  $('#legendb1').text(formatLegendVal(breaks.b1)+'x');
  $('#legendb2').text(formatLegendVal(breaks.b2)+'x');
  $('#legendb3').text(formatLegendVal(breaks.b3)+'x');
  $('#legendb4').text(formatLegendVal(breaks.b4)+'x');
  $('#legendb5').text(formatLegendVal(breaks.b5)+'x');
  $('#legendHigh').text(formatLegendVal(breaks.max)+'x');

  // --------------------------------------------------
  // Make a copy of geojson so we don't mutate the original
  const geojsonCopy = JSON.parse(JSON.stringify(geojson));

  // Merge selected field's 2021 values into copy
  geojsonCopy.features.forEach(f => {
    const stateId = f.properties.STATE_ID;
    // console.log(f)
    // console.log(stateId)

    // Normalize YEAR before comparing
    const row = stateData[stateId]?.find(d =>
      Number(String(d.YEAR).trim()) === targetYear
    );

    // if (stateId === 56) {
    //   console.log("WY merge check:", {
    //     stateId,
    //     row,
    //     mergedValue: row?.[fieldName],
    //     geojsonBefore: f.properties[fieldName]
    //   });
    // }

    // if (stateId === 1) {
    //   console.log("AL merge check:", {
    //     stateId,
    //     row,
    //     mergedValue: row?.[fieldName],
    //     geojsonBefore: f.properties[fieldName]
    //   });
    // }

    if (row && typeof row[fieldName] === 'number') {
      // console.log("merged")
      f.properties[fieldName] = row[fieldName];
      // console.log(f.properties[fieldName]);
    }
  });


  // console.log("WY final property:", geojsonCopy.features.find(f => f.properties.STATE_ID == 56).properties[fieldName]);

  // Push updated geojson into map source
  if (map.getSource('states')) {
    map.getSource('states').setData(geojsonCopy);
  }

  // --------------------------------------------------
  // Update map coloring
  if (map.getLayer('state-fills')) {
    if (fieldName === 'ENR_AP_GAP_BL') { // black
      console.log('Using BLACK state paint');
      legend.removeClass('legend-his').addClass('legend-blk');
      map.setPaintProperty('state-fills', 'fill-color', paintSet.black);

    } else { // hispanic
      console.log('Using HISPANIC state paint');
      legend.removeClass('legend-blk').addClass('legend-his');
      map.setPaintProperty('state-fills', 'fill-color', paintSet.hispanic);
    }

    hideDistrictFactSheetContainer();

  } else {
    console.warn("Layer 'state-fills' does not exist yet");
  }
}

// Shared helper: builds the STEP expression using a getter expression
function buildGapStep(getter, breaks, colors) {
  const { b1, b2, b3, b4, max,min } = breaks;

  if(min == b1){
    if(min > 1){ //"ONE PAINT CLASS, has disparity"
      console.log("ONE PAINT CLASS, has disparity")
      return colors.class1 // class1 is only color

    } else if(min < 1){ "ONE PAINT CLASS, NO disparity"
      console.log("ONE PAINT CLASS, NO disparity")
      return colors.noDisparity // noDisparity is only color
 

    }
  } else if(min < 1){
    return [
      "step",
      getter,
      colors.noData,          // < min
      min,  colors.noDisparity, // min ≤ value < 1
      1.0,  colors.class1,      // 1 ≤ value < b1
      b1,   colors.class2,      // b1 ≤ value < b2
      b2,   colors.class3,      // b2 ≤ value < b3
      b3,   colors.class4,      // b3 ≤ value < b4
      b4,   colors.class5       // ≥ b4 (and < next stop, if any)
    ];
  } else {
    // break values must be in order. So, if not values < 1, don't have a no-disparity bin
    return [
      "step",
      getter,
      colors.noData,          // < min
      min,  colors.class1,      // min ≤ value < b1
      b1,   colors.class2,      // b1 ≤ value < b2
      b2,   colors.class3,      // b2 ≤ value < b3
      b3,   colors.class4,      // b3 ≤ value < b4
      b4,   colors.class5       // ≥ b4 (and < next stop, if any)
    ];

  }



}



function buildGapPaintState(fieldName, breaks, colors) {
  const getter = ["get", fieldName];

  return [
    "case",

    ["any",
      ["!", ["has", fieldName]],
      ["==", getter, null]
    ],
    colors.noData,

    buildGapStep(getter, breaks, colors)
  ];
}

function buildGapPaintDistrict(breaksObj, colors) {
  const getter = ["coalesce", ["feature-state", "value"], -9999];
  return buildGapStep(getter, breaksObj, colors);
}


// not used (?)
// function getStateValues(stateData, state, fieldName) {
//   const val2011Raw = stateData[state][0]?.[fieldName];
//   const val2021Raw = stateData[state][1]?.[fieldName];
//   return { val2011Raw, val2021Raw };
// }

// Converts ["get", fieldName] → ["feature-state", "value"]
function convertPaintToFeatureState(expr, fieldName) {
  if (!Array.isArray(expr)) return expr;

  // Replace ["get", fieldName] with ["feature-state", "value"]
  if (expr[0] === "get" && expr[1] === fieldName) {
    return ["feature-state", "value"];
  }

  // Recursively process nested expressions
  return expr.map(item => convertPaintToFeatureState(item, fieldName));
}

// gets a color from the mapbox formatted paint step expression
function getColorFromPaintSet(val, paintArray) {
  if (val == null || isNaN(val)) return "#ccc";
  //console.log(paintArray)

  let color = paintArray[2];
  // iterate through the step expression
  for (let i = 3; i < paintArray.length; i += 2) {
    const breakpoint = paintArray[i];
    const nextColor = paintArray[i + 1];
    if (val < breakpoint) {return color; }
    color = nextColor;
  }
  return color;
}


function fillDistrictMap(map, districtData, state_abbrev, statefips, fieldName, targetYear = 2021) {
  console.log('fillDistrictMap:', fieldName);
  currentDistrictData = districtData;

  const filtered = districtData.filter(d => Number(String(d.YEAR).trim()) === targetYear);
  const districtCount = filtered.length;

  // --- get district paints and breaks ---
  const natPaintSet  = paints.District_National_Breaks;
  const statePaintSet  = paints.District_State_Breaks;

  const natBreaksSet = breaksByAggregation.District_National_Breaks;
  const stateBreaksAll = breaksByAggregation.District_State_Breaks;

  console.log(stateBreaksAll)

  if (!natPaintSet || !natPaintSet.black || !natPaintSet.hispanic) {
    console.warn('Paints not ready yet (District_National_Breaks)');
    return;
  }

  if (!natBreaksSet) {
    console.warn('Breaks not ready yet (District_National_Breaks)');
    return;
  }

  if (!stateBreaksAll) {
    console.warn('Breaks not ready yet (District_State_Breaks)');
    return;
  }


  // ensureBreaksLoaded() // loading

  // --- clear state fill ---
  map.setPaintProperty('state-fills', 'fill-color', 'transparent');

  // --- determine if showing all states ---
  showAllStates = !statefips || statefips === 'all' || statefips === 'any';
  console.log(showAllStates);




  //  SELECT BREAKS (NATIONAL vs STATE‑SPECIFIC) 
  let breaks;
  let paintSet;
  let basePaint;

  if (!showAllStates) {
    // We are zoomed into a single state → use state‑specific breaks
    console.log("Using STATE‑SPECIFIC district breaks for", state_abbrev);
    console.log(breaksByAggregation.District_State_Breaks); // all break data
    console.log("fieldName", fieldName);

    breaks = breaksByAggregation.District_State_Breaks[state_abbrev]?.[fieldName];
    console.log(breaks);

    if (breaks) {
      if(breaks.b1==breaks.b2){
          console.log("only one class")
      }

      paintSet = buildGapPaintDistrict(
        breaks,
        fieldName === 'ENR_AP_GAP_BL' ? blackColors : hispanicColors
      );
      console.log("paintSet", paintSet);

      // state-specific paintSet is already the full step expression
      basePaint = paintSet;
      window.currentDistrictBreaks = breaks; // store globally
      window.currentDistrictPaintSet = basePaint; // store globally

    } else {
      // fallback to national if missing
      console.log("fallback using national breaks");
      breaks = fieldName === 'ENR_AP_GAP_BL'
        ? natBreaksSet.ENR_AP_GAP_BL
        : natBreaksSet.ENR_AP_GAP_HI;

      paintSet = natPaintSet;

      basePaint = fieldName === 'ENR_AP_GAP_BL'
        ? paintSet.black
        : paintSet.hispanic;

      console.warn("Missing state‑specific breaks, using NATIONAL instead");
    }

  } else {
    // National view
    breaks = fieldName === 'ENR_AP_GAP_BL'
      ? natBreaksSet.ENR_AP_GAP_BL
      : natBreaksSet.ENR_AP_GAP_HI;

    paintSet = natPaintSet;

    basePaint = fieldName === 'ENR_AP_GAP_BL'
      ? paintSet.black
      : paintSet.hispanic;

    console.log("Using NATIONAL district breaks");
  }
  //  END BREAK SELECTION 


  // --- build paint expression ---
  currentMapPaint = convertPaintToFeatureState(basePaint, fieldName);

  if (!breaks) {
    if (districtCount < 1) {
      updateDistrictLegendDisplay(fieldName, {
        min: 0,
        b1: 0,
        b2: 0,
        b3: 0,
        b4: 0,
        b5: 0,
        max: 0
      }, districtCount);
    }
    console.warn('District breaks missing for', fieldName);
    return;
  } else {
    console.log("breaks", breaks)
  }

  // --- update legend ---
  updateDistrictLegendDisplay(fieldName, breaks, districtCount);

  // $(quantLabel).text("district")

  const legend = $('#mapLegend');
  legend.toggleClass('legend-blk', fieldName === 'ENR_AP_GAP_BL')
        .toggleClass('legend-his', fieldName !== 'ENR_AP_GAP_BL');

  // --- filter to target year and build LEAID -> value map ---
  const valueMap = {};
  for (const d of filtered) {
    const raw = d[fieldName];
    if (raw !== null && raw !== undefined && !isNaN(Number(raw))) {
      const leaId = String(d.LEAID).padStart(7,'0');
      valueMap[leaId] = Number(raw);
    }
  }
  currentDistrictValueMap = valueMap;
  console.log(`ValueMap built: ${Object.keys(valueMap).length} districts`);


  map.moveLayer('district-fills', 'state-fills'); // ensure layer is above state-fill
  // show all district-fills for "showAllStates", show only this states districts-fills for a single state
  map.setFilter('district-fills', showAllStates ? null : ['==', ['get', 'STATEFP'], statefips]);
  map.setLayoutProperty('district-fills', 'visibility', 'visible');



  // filter district lines to the selected state or show for the whole country
  if (showAllStates) {
    // remove filter entirely
    map.setFilter('district-lines', ['all']); // 
    map.setFilter('district-lines-hover', ['all']);
  } else {
    map.setFilter('district-lines', ['==', ['get', 'STATEFP'], statefips]);
    map.setFilter('district-lines-hover', ['==', ['get', 'STATEFP'], statefips]);
  }
  map.setLayoutProperty('district-lines', 'visibility', 'visible');
  map.setLayoutProperty('district-lines-hover', 'visibility', 'visible');
  map.setLayoutProperty('selected-district', 'visibility', 'visible');


  // --- set feature-states safely ---
  function applyFeatureStates() {
    try {
      const features = map.querySourceFeatures('SCHOOLDIST_TL24', { sourceLayer: 'SCHOOLDIST_TL24_Simpl100m-2kf22l' });
      for (const f of features) {
        const geoId = String(f.id).padStart(7,'0');
        const val = currentDistrictValueMap[geoId];
        map.setFeatureState(
          { source: 'SCHOOLDIST_TL24', sourceLayer: 'SCHOOLDIST_TL24_Simpl100m-2kf22l', id: f.id },
          { value: val !== undefined ? val : null }
        );
      }
    } catch (err) {
      console.warn('Error setting district feature states:', err);
    }
  }

  function updateDistrictFeatureStates() {
    const features = map.querySourceFeatures('SCHOOLDIST_TL24', {
      sourceLayer: 'SCHOOLDIST_TL24_Simpl100m-2kf22l'
    });

    if (features.length === 0) return;

    applyFeatureStates();
    map.setPaintProperty('district-fills', 'fill-color', currentMapPaint);
    map.setLayoutProperty('district-lines', 'visibility', 'visible');
    console.log("updated district feature paint")
  }

  // map.off('idle', updateDistrictFeatureStates);
  // map.on('idle', updateDistrictFeatureStates);
  map.once('idle', updateDistrictFeatureStates);

  // --- tooltip & hover ---
  //create popup
districtPopup.setHTML(`
  <div>
    <div class="popup-title">
      <span id="popup_districtName"></span> (2021)
    </div>

    <div class="popup-row">
      <span class="popup-label">Enrollment Disparity:</span>
      <span class="popup-value">
        <span id="popup_districtOppEst"></span>
        <span id="popup_districtOppEstBullet"></span>
      </span>
    </div>

    <div class="popup-row">
      <span class="popup-label">Students:</span>
      <span class="popup-value" id="popup_districtStudents"></span>
    </div>

    <div class="popup-row">
      <span class="popup-label">Teachers (FTE):</span>
      <span class="popup-value" id="popup_districtTeachers"></span>
    </div>
  </div>
`);




// Build popup HTML once
districtPopup.setHTML(`
  <div>
    <div class="popup-title">
      <span id="popup_districtName"></span> (2021)
    </div>

    <div class="popup-row">
      <span class="popup-label">Enrollment Disparity:</span>
      <span class="popup-value">
        <span id="popup_districtOppEst"></span>
        <span id="popup_districtOppEstBullet"></span>
      </span>
    </div>

    <div class="popup-row">
      <span class="popup-label">Students:</span>
      <span class="popup-value" id="popup_districtStudents"></span>
    </div>

    <div class="popup-row">
      <span class="popup-label">Teachers (FTE):</span>
      <span class="popup-value" id="popup_districtTeachers"></span>
    </div>
  </div>
`);


// state shared across events
let hoveredDistrictPolygonID = null;
let lastPopupDistrictId = null;

// fast lookup from districtData array
const districtLookup = {};

districtData.forEach(d => {
  const geoId = String(d.LEAID).padStart(7, '0');

  if (!districtLookup[geoId]) {
    districtLookup[geoId] = [];
  }

  districtLookup[geoId].push(d);
});



map.on('mouseenter', 'district-fills', e => {
  map.getCanvas().style.cursor = 'pointer';
  districtPopup.setLngLat(e.lngLat).addTo(map);
});

map.on('mousemove', 'district-fills', e => {
    if (!e.features?.length) return;

    const feat = e.features[0];
    const fid = String(feat.id);
    const geoId = fid.padStart(7, '0');

    // If same district, just move popup
    if (lastPopupDistrictId === fid) {
      districtPopup.setLngLat(e.lngLat);
      return;
    }

    // Reset previous hover
    if (hoveredDistrictPolygonID && hoveredDistrictPolygonID !== fid) {
      map.setFeatureState(
        { source: 'SCHOOLDIST_TL24', sourceLayer: 'SCHOOLDIST_TL24_Simpl100m-2kf22l', id: hoveredDistrictPolygonID },
        { hover: false }
      );
    }

    // Set new hover
    hoveredDistrictPolygonID = fid;
    map.setFeatureState(
      { source: 'SCHOOLDIST_TL24', sourceLayer: 'SCHOOLDIST_TL24_Simpl100m-2kf22l', id: fid },
      { hover: true }
    );

    // Lookup data
    const hoveredDistrictData = districtLookup[geoId];

    // Update popup content
    $("#popup_districtName").text(feat.properties.NAME || feat.properties.LEA_NAME || 'District');

    const oppEstValue = getDistrictValueByYear(hoveredDistrictData, currentRaceField, 2021);
    const oppEstText = oppEstValue === 'No data' ? 'No data' : `${oppEstValue}x`;
    $("#popup_districtOppEst").text(oppEstText);

    const bulletColor = getColorFromPaintSet(oppEstValue, currentMapPaint);
    $("#popup_districtOppEstBullet").css("background-color", bulletColor).show();

    $("#popup_districtStudents").text(getDistrictValueByYear(hoveredDistrictData, "ENR", 2021));
    $("#popup_districtTeachers").text(getDistrictValueByYear(hoveredDistrictData, "SCH_FTETEACH_TOT", 2021));

    lastPopupDistrictId = fid;
    districtPopup.setLngLat(e.lngLat);
  });



  map.on('mouseleave', 'district-fills', () => {
    map.getCanvas().style.cursor = '';
    try { districtPopup.remove(); } catch {}

    if (hoveredDistrictPolygonID) {
      map.setFeatureState(
        { source: 'SCHOOLDIST_TL24', sourceLayer: 'SCHOOLDIST_TL24_Simpl100m-2kf22l', id: hoveredDistrictPolygonID },
        { hover: false }
      );
      hoveredDistrictPolygonID = null;
      lastPopupDistrictId = null
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

function showDistrictFactsheet(clickedFeature, districtData, state_abbrev) {
  console.log(districtData) // currently, this was just filtered to 2021 for the map
  


  // ensure canonical view reflects district view (this will update controls)
  if (typeof setMapView === 'function') setMapView('district');
  const geoId = String(clickedFeature.properties.GEOID);
  console.log(geoId)
  map.setFilter('selected-district',  ["==", ["get", "GEOID"], geoId] );

  // records uses the global cache, not the data passed that is only 2021, could remove that all together to steamline
  // const records = districtData.filter(d => String(d.LEAID).replace(/^0+/, '') === geoId.replace(/^0+/, '')); //JSON LEADID with leading 0 removed
  console.log(districtDataCache)
  let records
  if(districtDataCache === null){
    records = districtData.filter(d => String(d.LEAID).replace(/^0+/, '') === geoId.replace(/^0+/, '')); //JSON LEADID with leading 0 removed
  } else {
    records = districtDataCache.filter(d => String(d.LEAID).replace(/^0+/, '') === geoId.replace(/^0+/, '')); //JSON LEADID with leading 0 removed
  }
  
  
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
          hideDistrictFactSheetContainer();
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
    lastDistrictStateFP = latest.STATEFP || latest.LEA_STATEFP || clickedFeature.properties?.STATEFP || null;
    lastDistrictStateAbbrev = latest.LEA_STATE || clickedFeature.properties?.STATE_ABBR || null;
  } catch (e) {
    lastDistrictStateFP = null;
    lastDistrictStateAbbrev = null;
  }

  // Unified colors for both charts
  // const colors = { WH: "#a6cee3", HI: "#d95f02", BL: "#1b9e77", AS: "#7570b3", OTH: "#555" };
  const colors = { WH: "#a0a0a0", HI: "#e6da9b", BL: "#718168", AS: "#a1b9a0", OTH: "#ccc" };
      
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
    const label = `${toTitleCase(d.name)}${d.state ? ', ' + d.state : ''}${noGeo}`;
    return `<option value="${d.lea}"${isSelected}>${label}</option>`;
  }).join('');

  // --- Build factsheet HTML (District) ---

  // factSheetContainer.classList.add("full-width"); // full width top row
  factSheetContainer.innerHTML = `
  <div id="factsheetTitle" class="opportunity-row full-width">
    <h2 id="factsheetTitle">
      <select id="districtPicker" class="district-dropdown inline">
        ${optionsHtml}
      </select>
    </h2>
  </div>
  <div id="noGeometryNotice" class="no-geometry-notice" style="display:none;">
          <i class="fa fa-exclamation-circle" aria-hidden="true"></i>
          <strong>Note:</strong> This district cannot be found on our map. Available data is shown below.
  </div>
  <div class="opportunity-row full-width">
    <div class="opportunity-column" id='factsheet-left'>
      <div class="opportunity-row">
        <h3>District Summary</h3>
        <div class="opportunity-row district-summary">

          <div class="summary-line">
            <span class="summary-label">Schools:</span>
            <span class="summary-value">${formatLegendVal(latest.SCHOOLS)}</span>
            <span class="spacer"></span></span>
            <span class="summary-label">Average AP Courses (per school):</span>
            <span class="summary-value">${formatLegendVal(latest.SCH_APCOURSES_MODE)}</span>
          </div>

          <div class="summary-line">
            <span class="summary-label">Enrollment:</span>
            <span class="summary-label">${formatLegendVal(latest.ENR_HS_TOT)} (High School)
            <span class="spacer"></span></span>
            <span class="summary-label">${formatLegendVal(latest.ENR_AP)} (AP)</span>
          </div>

          <div class="summary-line">
            <span class="summary-label">Teachers (FTE):</span>
            <span class="summary-value">${formatLegendVal(latest.SCH_FTETEACH_TOT)}</span>
            <span class="spacer"></span>
            
            <span class="summary-label">Student-Teacher Ratio:</span>
            <span class="summary-value">${formatLegendVal(latest.STU_TEACH_RAT)}</span>
           
          </div>
        </div>


      <div class="opportunity-row chart-container">
        <h3>District Composition</h3>
        <canvas id="compDonut" width="300" height="100" style="display:none;"></canvas>
        <canvas id="compBar" width="300" height="60"></canvas> </div>
      </div>
    </div> <!-- LEFT COLUMN -->

    <div class="opportunity-column" id="factsheet-right">
  <h3>Historic Data</h3>

  <section class="chart-section">
    <p class="chart-subheader">AP Participation (Gap)</p>
    <canvas id="gapChart" width="400" height="160"></canvas>
    <div id="gapLegend" class="chart-legend"></div>
  </section>

  <section class="chart-section">
    <p class="chart-subheader">Percentage of Non‑White Students</p>
    <canvas id="nonwhiteChart" width="400" height="160"></canvas>
    <div id="nonwhiteLegend" class="chart-legend"></div>
  </section>

  <section class="chart-section">
    <p class="chart-subheader">Student–Teacher Ratio</p>
    <canvas id="stChart" width="400" height="160"></canvas>
    <div id="stLegend" class="chart-legend"></div>
  </section>

  <section class="chart-section">
    <p class="chart-subheader">Number of AP Courses Offered (mode)</p>
    <canvas id="apCoursesChart" width="400" height="160"></canvas>
    <div id="apCoursesLegend" class="chart-legend"></div>
  </section>

    <section class="chart-section">
    <p class="chart-subheader">High School Students Taking ≥1 AP Course</p>
    <canvas id="apChart" width="400" height="160"></canvas>
    <div id="apLegend" class="chart-legend"></div>
  </section>
</div> <!-- end right column -->

  </div> <!-- end  full-width" -->
  `  ;

  // Show or hide the no-geometry notice based on the latest record's GIS flag
  try {
    const noGeoDiv = document.getElementById('noGeometryNotice');
    if (noGeoDiv) {
      if (latest.GIS === 0 || String(latest.GIS) === '0' || latest.gis === 0 || String(latest.gis) === '0') {
        noGeoDiv.style.display = 'block';
        noGeometry = true;
      } else {
        noGeoDiv.style.display = 'none';
        noGeometry = false;
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

  drawCompDonutChart("compDonut", compData, compColors);
  drawCompositionBar("compBar", compData, compColors);


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
            showDistrictFactsheet(fakeFeature, districtData); // THIS IS AN INFINITE LOOP?
          } catch (err) {
            console.warn('Could not open factsheet for no-geometry district:', err);
            //  TO DO: zoom to state rec.LEA_STATE
            console.log('should zoom to', rec.LEA_STATE)
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
          console.log(foundFeature.id)
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
  // determine state abbreviation for this district (used to look up state series)
  const stateAbbrev = latest.LEA_STATE || clickedFeature.properties?.STATE_ABBR || lastDistrictStateAbbrev || null;
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

        // store data for both races with district/state/national for each
        const gapChartData = {
          BL: {
            District: series.BL,
            State: stateSeriesBL,
            National: natSeriesBL
          },
          HI: {
            District: series.HI,
            State: stateSeriesHI,
            National: natSeriesHI
          }
        };


        currentRaceCode = $('#race-selectBlk').hasClass('active') ?  'BL' : 'HI';
        // console.log('currentRaceCode: ', currentRaceCode)

        // draw gap chart for selected race
        // const drawGapChartForRace = (race) => {
        window.drawGapChartForRace = function (race) { //global scope to allow call from race-select handler
          currentRaceCode = race;
          
        // Build colors per race selection (District uses race color)
        const sparklineColors = {
            District: (compColors && compColors[currentRaceCode]) || '#000',
            State: '#555',
            National: '#888'
        };

          const raceData = gapChartData[currentRaceCode];
          if (raceData) {
            drawMiniChart('gapChart', years, raceData, sparklineColors, 'AP participation gap (x)');
            drawSimpleLegend('gapLegend', { District: 'District', State: 'State', National: 'National' }, sparklineColors, raceData);
          }
        };

        // race picker for ap gap
        const gapLegend = document.getElementById('gapLegend');
        if (gapLegend) {
          // Remove existing picker wrapper if present
          const existingWrapper = document.getElementById('gapRacePickerWrapper');
          if (existingWrapper) existingWrapper.remove();

          const pickerWrapper = document.createElement('div');
          pickerWrapper.id = 'gapRacePickerWrapper';
          pickerWrapper.style.display = 'flex';
          pickerWrapper.style.flexDirection = 'column';
          pickerWrapper.style.marginBottom = '8px';

          // Label
          const pickerLabel = document.createElement('div');
          pickerLabel.style.fontSize = '12px';
          pickerLabel.style.marginBottom = '6px';
          pickerWrapper.appendChild(pickerLabel);

          // buttons
          const racePicker = document.createElement('div');
          racePicker.id = 'gapRacePicker';
          racePicker.style.display = 'flex';
          racePicker.style.gap = '8px';

          const races = [
            { code: 'BL', label: 'Black' },
            { code: 'HI', label: 'Hispanic' }
          ];

          races.forEach(({ code, label }) => {
            const btn = document.createElement('button');
            btn.className = 'gap-race-btn';
            btn.dataset.race = code;
            btn.textContent = label;
            //moved most stylingto charts.css

            if (code === 'BL') {
              btn.id = 'gapRaceBlk';

            } else {
              btn.id = 'gapRaceHis';

            }

            //active race select button determines active gap button
            if( $('#race-selectBlk').hasClass('active')  && code === 'BL') {
              btn.classList.add('active') 
            } else if( $('#race-selectHis').hasClass('active')  && code === 'HI') {
              btn.classList.add('active')
            }


            btn.addEventListener('click', () => {
              racePicker.querySelectorAll('.gap-race-btn').forEach(b => 
                b.classList.remove('active'));
              btn.classList.add('active');

              // draw chart when button is clicked
              drawGapChartForRace(code);

              // map show selected race
              if (window.updateMapForRace) {
                window.updateMapForRace(code);
              }
            });

            racePicker.appendChild(btn);
          });

          pickerWrapper.appendChild(racePicker);
          gapLegend.parentNode.insertBefore(pickerWrapper, gapLegend);
        }

        // draw chart when factsheet loads for district
        drawGapChartForRace(currentRaceCode);

        // Draw sparklines (District + State + National) using helper
        try {
          prepareAndDrawSparkline({ canvasId: 'nonwhiteChart', legendId: 'nonwhiteLegend', title: 'Non-white (%)', field: 'PCT_ENR_NON_WH', records, years, natLookup, stateAbbrev });
          prepareAndDrawSparkline({ canvasId: 'apChart', legendId: 'apLegend', title: 'AP participation (%)', field: 'PCT_ENR_AP', records, years, natLookup, stateAbbrev });
          prepareAndDrawSparkline({ canvasId: 'stChart', legendId: 'stLegend', title: 'Student–teacher ratio', field: 'STU_TEACH_RAT', records, years, natLookup, stateAbbrev });
          prepareAndDrawSparkline({ canvasId: 'apCoursesChart', legendId: 'apCoursesLegend', title: 'Modal AP courses', field: 'SCH_APCOURSES_MODE', records, years, natLookup, stateAbbrev });
        } catch (e) { console.warn('Could not draw detail sparklines', e); }
      });

      showDistrictFactSheetContainer();
}


// get most recent year of data
function getDistrictValueByYear(hoveredDistrictData, field, preferredYear = 2021) {
  if (!hoveredDistrictData || hoveredDistrictData.length === 0) return "No data";

  // try preferred year first
  let thisYearData = hoveredDistrictData.find(r => r.YEAR === preferredYear);

  // fallback to latest available year
  if (!thisYearData) {
    thisYearData = hoveredDistrictData.reduce((a, b) =>
      a.YEAR > b.YEAR ? a : b
    );
  }

  const val = thisYearData[field];
  const year = thisYearData.YEAR;

  // original formatting logic
  if (val == null || isNaN(val)) return "No data";

  let formatted;
  if (typeof val === "number") {
    formatted = Number.isInteger(val)
      ? val.toLocaleString()
      : Number(val.toFixed(2)).toLocaleString();
  } else {
    formatted = val;
  }

  // include year if it's not the preferred year
  return year !== preferredYear
    ? `${formatted} (${year})`
    : formatted;
}


// return 2 decimals, or int, or a —
function formatLegendVal(v) {
    if (typeof v !== 'number' || !isFinite(v)) {
        return '—';
    }

    const options = Number.isInteger(v)
        ? { minimumFractionDigits: 0, maximumFractionDigits: 0 }
        : { minimumFractionDigits: 1, maximumFractionDigits: 1 };

    return new Intl.NumberFormat(undefined, options).format(v);
}

function formatLegendValTwoDecimals(v) {
    if (typeof v !== 'number' || !isFinite(v)) {
        return '—';
    }

    return new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(v);
}

function updateDistrictLegendDisplay(fieldName, breaks, districtCount) {
  const legend = $('#mapLegend');
  const isBlack = fieldName === 'ENR_AP_GAP_BL';
  const allBreakLabels = $('#legendMin, #legend1, #legendb1, #legendb2, #legendb3, #legendb4, #legendb5, #legendHigh');

  legend.toggleClass('legend-blk', isBlack)
        .toggleClass('legend-his', !isBlack)
        .toggleClass('legend-single-district', districtCount === 1)
        .toggleClass('legend-no-district', districtCount < 1);

  if (districtCount < 1) {
    allBreakLabels.html('&nbsp;');
    return;
  }

  if (districtCount === 1) {
    allBreakLabels.html('&nbsp;');
    $('#legendMin').text(`0.00x`);
    $('#legendHigh').text(`${formatLegendValTwoDecimals(breaks.max)}x`);
    return;
  }

  $('#legendMin').text(`${formatLegendVal(breaks.min)}x`);
  $('#legendb1').text(`${formatLegendVal(breaks.b1)}x`);
  $('#legendb2').text(`${formatLegendVal(breaks.b2)}x`);
  $('#legendb3').text(`${formatLegendVal(breaks.b3)}x`);
  $('#legendb4').text(`${formatLegendVal(breaks.b4)}x`);
  $('#legendb5').text(`${formatLegendVal(breaks.b5)}x`);
  $('#legendHigh').text(`${formatLegendVal(breaks.max)}x`);
}




//responsive search box

//init globals
const queryBar = document.getElementById('mapWidgetsQuery')
let queryBarWidth;

//init width function
// function initQueryWidth(){
//   //get resize button width
//   const resizeButton = document.getElementById('resizeQueryButton');
//   resizeButton.style.display = '';
//   // const buttonWidth = resizeButton.getBoundingClientRect().width;
//   resizeButton.style.display = 'none';
  
//   //set style properties i.e. 
//   queryBar.style.setProperty('--expanded-width', `${queryBarWidth}px`);
//   // queryBar.style.setProperty('--collapsed-width', `${buttonWidth}px`);

//   // Start in expanded state
//   queryBar.classList.add('qbExpanded');
//   queryBar.classList.remove('qbCollapsed');
// }

//expand/collapse function
function resizeQueryBar(targetClass) {
  //targetClass: qbCollapsed = shrink searchbar, show only expand button
  //             qbExpanded = show full search bar
  console.log(`resizeQueryBar(${targetClass})`)
  const resizeButton = document.getElementById('resizeQueryButton'); //only visible when collapsed
  const mapButtons = document.getElementsByClassName('mapControlBtn')
  const searchBox = document.getElementById('search_box_holder')
    
  // // remove both classes
  // queryBar.classList.remove('qbExpanded', 'qbCollapsed');
  // // Add the target class
  // queryBar.classList.add(targetClass);

  // if (targetClass === 'qbExpanded') {
  //   console.log('expanding query bar')
  //   resizeButton.style.display = 'none';
  //   // mapButtons.style.display = '';
  //   searchBox.style.display = '';
  // } else if (targetClass === 'qbCollapsed') {
  //   console.log('shrinking query bar')
  //   resizeButton.style.display = '';
  //   // mapButtons.style.display = 'none';
  //   searchBox.style.display = 'none';
  //   //set display=none for  searchBox and mapBttons
  // }

  // if (mapButtons && mapButtons.length) {
  //       Array.from(mapButtons).forEach(mapButtons => {
  //           mapButtons.style.display = (targetClass === 'qbExpanded') ? '' : 'none';
  //       });
  //   }
}

function showDistrictFactSheetContainer(){
  try { document.querySelector('#infoContainer').style.display = 'none' } catch(e) {}
  try { 
      document.querySelector('#factSheetContainer').style.display = 'flex'
   } catch(e) {}
}

function hideDistrictFactSheetContainer(){
  try { document.querySelector('#infoContainer').style.display = 'block' } catch(e) {}
  try { 
    document.querySelector('#factSheetContainer').style.display = 'none' } catch(e) {}
}

function buildCountyPolylabels() {
  console.log("buildCountyPolylabels() called");

  const polys = map.queryRenderedFeatures({
    layers: ['County-Polygons_ne-10m-admin-2-counties']
  });

  console.log("polys found:", polys.length);

  // Group polygons by county ID (use NAME if no GEOID)
  const counties = {};

  polys.forEach(f => {
    if (!f.geometry || !f.geometry.coordinates) return;

    const id = f.properties.GEOID || f.properties.NAME;
    if (!id) return;

    // Normalize geometry into an array of polygons
    let polygons = [];

    if (f.geometry.type === 'Polygon') {
      polygons = [f.geometry.coordinates];
    }

    if (f.geometry.type === 'MultiPolygon') {
      polygons = f.geometry.coordinates;
    }

    // Compute area for each polygon
    polygons.forEach(coords => {
      const area = turf.area({ type: 'Polygon', coordinates: coords });

      if (!counties[id] || area > counties[id].area) {
        counties[id] = {
          id,
          props: f.properties,
          coords,
          area
        };
      }
    });
  });

  // Build label features
  const labelFeatures = Object.values(counties).map(c => {
    let center;

    try {
      center = polylabel(c.coords, 1.0);
    } catch (e) {
      console.warn("polylabel failed, using centroid", c.id);
      center = turf.centroid({
        type: 'Polygon',
        coordinates: c.coords
      }).geometry.coordinates;
    }

    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: center },
      properties: c.props
    };
  });

  console.log("labelFeatures:", labelFeatures.length);

  map.getSource('county-labels').setData({
    type: 'FeatureCollection',
    features: labelFeatures
  });

  console.log("Labels updated");
}


  function ZoomToState(){
    triggeredByBackToState = true;
    // Only active when in district view
    // if (mapView !== 'district') {
    //   return;
    // }

    const stateFP = lastDistrictStateFP || null;
    const stateAbbrev = lastDistrictStateAbbrev || null;
    
    // If no valid state info exists, do nothing (prevents error on initial load)
    if (!stateFP && !stateAbbrev) {
      console.warn('Back to state: No state info available');
      return;
    }

    // remove outline from selected district
    map.setFilter('selected-district',  ["==", ["get", "GEOID"], -99] );

    // locate state in the state geojsonCache
    let stateFeature = null;
    if (typeof geojsonCache === 'object' && Array.isArray(geojsonCache.features)) {
      console.log("locating", stateFP)
      stateFeature = geojsonCache.features.find(f => {
        const p = f.properties || {};
        return String(p.STATEFP) === String(stateFP) || String(p.STATE_ID) === String(stateFP) || String((p.STATE_ABBR || p.STATE)) === String(stateAbbrev);
      });
    }

    console.log(stateFeature)
    window.onStateClick(stateFeature)



    // function fitFeatureBoundsAndShowFacts(f, fips) {
    //   if (!f) return false;
    //   const coords = f.geometry && f.geometry.coordinates;
    //   const bounds = new mapboxgl.LngLatBounds();

    //   function extendBounds(coordinates) {
    //     if (typeof coordinates[0][0] === 'number') {
    //       coordinates.forEach(coord => bounds.extend(coord));
    //     } else {
    //       coordinates.forEach(extendBounds);
    //     }
    //   }
    //   const props = f.properties || {};
    //   let fipsToUse = fips;
    //   console.log(fipsToUse)
    //   // REMOVING BLOCK AS WE TRUST THE FIPS, PUT BACK IF THE FIPS CAUSES ERRORS
    //   // if (!fipsToUse || fipsToUse === null) {
    //   //   if (props.STATEFP !== undefined && props.STATEFP !== null && String(props.STATEFP).trim() !== '') fipsToUse = props.STATEFP;
    //   //   else if (props.STATE_ID !== undefined && props.STATE_ID !== null && String(props.STATE_ID).trim() !== '') fipsToUse = props.STATE_ID;
    //   //   else if (props.STATE_ABBR || props.STATE) {
    //   //     const abbr = String(props.STATE_ABBR || props.STATE).toUpperCase();
    //   //     try {
    //   //       if (typeof stateDataCache === 'object') {
    //   //         const stateKey = Object.keys(stateDataCache).find(k => {
    //   //           const arr = stateDataCache[k] || [];
    //   //           return arr.some(d => String(d.state_abbrev || '').toUpperCase() === abbr);
    //   //         });
    //   //         if (stateKey) fipsToUse = stateKey;
    //   //       }
    //   //     } catch (e) { /* non-fatal */ }
    //   //   }
    //   // }

    //   // If feature has geometry, fit bounds; otherwise skip zoom but still show factsheet
    //   try {
    //     if (coords) {
    //       extendBounds(coords);
    //       console.log("zooming to the state")
    //       map.fitBounds(bounds, { padding: 30 });
    //     }
    //   } catch (e) {
    //     console.warn('Could not compute bounds for state feature', e);
    //   }

    //   // switch to state view UI
    //   if (typeof setMapView === 'function') setMapView('state');
    //   hideDistrictFactSheetContainer();
    //   // show the state factsheet (fips may need padding to match keys)
    //   try {
    //     /*should be filerted to the state only at this point */
    //     initFactSheet(stateDataCache[fipsToUse], fipsToUse, currentRaceField || 'ENR_AP_GAP_BL');
    //   } catch (e) { console.warn('initFactSheet failed', e); }
    //   // scroll state info into view
    //   const info = document.getElementById('infoContainer');
    //   if (info) info.scrollIntoView({ behavior: 'smooth', block: 'end' });
    //   return true;
    // }

    // if (stateFeature && fitFeatureBoundsAndShowFacts(stateFeature, stateFP)) return;

    // final fallback to full US extent and show nothing specific
    map.fitBounds([[ -126, 24], [-66, 50]]);
    if (typeof setMapView === 'function') setMapView('full');
    hideDistrictFactSheetContainer();
    const info3 = document.getElementById('infoContainer');
    if (info3) info3.scrollIntoView({ behavior: 'smooth', block: 'end' });
 
    // // fallback to querySourceFeatures
    // try {
    //   const matches = map.querySourceFeatures('states', {
    //     filter: ['==', ['to-string', ['get', 'STATEFP']], String(stateFP || '')]
    //   });
    //   if (matches && matches.length) {
    //     const f = matches[0];
    //     if (fitFeatureBoundsAndShowFacts(f, stateFP)) return;
    //   }
    // } catch (e) {
    //   console.warn('querySourceFeatures fallback failed', e);
    // }
    // // this should fix issue with non geometry districts still being able to use Back to state button
    // try {
    //   if ((!stateFeature || !stateFP) && stateAbbrev && typeof stateDataCache === 'object') {
    //     const upperAbbrev = String(stateAbbrev).toUpperCase();
    //     const stateKey = Object.keys(stateDataCache).find(k => {
    //       const arr = stateDataCache[k] || [];
    //       return arr.some(d => String(d.state_abbrev || '').toUpperCase() === upperAbbrev);
    //     });
    //     if (stateKey) {
    //       // try to find feature in geojsonCache using known keys/properties
    //       if (typeof geojsonCache === 'object' && Array.isArray(geojsonCache.features)) {
    //         stateFeature = geojsonCache.features.find(f => {
    //           const p = f.properties || {};
    //           return String(p.STATEFP) === String(stateKey) || String(p.STATE_ID) === String(stateKey) || String((p.STATE_ABBR || p.STATE || '')).toUpperCase() === upperAbbrev;
    //         });
    //       }

    //       if (stateFeature && fitFeatureBoundsAndShowFacts(stateFeature, stateKey)) return;

    //       // try querySourceFeatures using the discovered stateKey
    //       try {
    //         const matches2 = map.querySourceFeatures('states', {
    //           filter: ['==', ['to-string', ['get', 'STATEFP']], String(stateKey || '')]
    //         });
    //         if (matches2 && matches2.length) {
    //           const f2 = matches2[0];
    //           if (fitFeatureBoundsAndShowFacts(f2, stateKey)) return;
    //         }
    //       } catch (e) {
    //         // non-fatal
    //       }
    //     }
    //   }
    // } catch (e) { console.warn('stateAbbrev fallback failed', e); }

    // // final fallback to full US extent and show nothing specific
    // map.fitBounds([[ -126, 24], [-66, 50]]);
    // if (typeof setMapView === 'function') setMapView('full');
    // hideDistrictFactSheetContainer();
    // const info3 = document.getElementById('infoContainer');
    // if (info3) info3.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };
