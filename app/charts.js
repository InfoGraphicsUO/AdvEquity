// initFactSheet();
const config = { displayModeBar: false };

const layout = {
  margin: { l: 20, r: 5, t: 5, b: 20 },
  paper_bgcolor: getComputedStyle(document.documentElement).getPropertyValue('--lightgrey').trim(),
  plot_bgcolor: getComputedStyle(document.documentElement).getPropertyValue('--lightgrey').trim(),
  xaxis: {
    tickvals: [2011, 2014, 2017, 2020, 2022],
    tickfont: { size: 8 },
    showgrid: false,
    showline: false,
    ticks: '',
    fixedrange: true
  },
  yaxis: {
    tickfont: { size: 8 },
    showgrid: false,
    showline: false,
    ticks: '',
    fixedrange: true
  },
  showlegend: false
};

const colorBlack = getComputedStyle(document.documentElement).getPropertyValue('--almostBlack').trim();
const colorYellow = getComputedStyle(document.documentElement).getPropertyValue('--yellow').trim();

function createLongitudinalChart(containerId, values, stateAvg) {
  Plotly.newPlot(containerId, [
    {
      x: [2011, 2014, 2017, 2020, 2022],
      y: values,
      mode: 'lines+markers',
      line: { color: colorBlack },
      marker: { color: colorBlack, size: 4 },
      type: 'scatter'
    },
    {
      x: [2011, 2022],
      y: [stateAvg, stateAvg],
      mode: 'lines',
      line: { color: colorYellow, width: 2, dash: 'dot' },
      type: 'scatter'
    }
  ], layout, config);
}

// // Students
// createLongitudinalChart('chart1', [45, 47, 50, 52, 55], 50);  // % non-white students
// createLongitudinalChart('chart2', [60, 61, 63, 65, 68], 63);  // % economically disadvantaged
// createLongitudinalChart('chart3', [20, 23, 26, 30, 34], 27);  // % HS students taking AP

// // Teachers & Resources
// createLongitudinalChart('chart4', [18, 17.5, 17, 16.5, 16], 17); // student-teacher ratio
// createLongitudinalChart('chart5', [1, 2, 2, 3, 4], 2.5);         // modal AP courses per school



// hard coded
// function initFactSheet() {
//   const factSheetContainer = document.getElementById('factSheetContainer');
//   if (!factSheetContainer) return;

//   factSheetContainer.innerHTML = `<h2>Factsheet about <span id="currentState">Oregon</span></h2>`
//   factSheetContainer.innerHTML +=`<div id = "StateOverviewCharts"></div><br>`


function initFactSheet(stateData, fips, fieldName) {
  showGraphs(); // hid the US level details, show the state details
  console.log("building fact sheet")
  const factSheetContainer = document.getElementById('factSheetContainer');
  if (!factSheetContainer) return;

  const fipsKey = String(fips).padStart(2, '0');
  const stateEntry = stateData[fipsKey];

  if (!stateEntry) {
    factSheetContainer.innerHTML = `<p>No data found for FIPS ${fips}</p>`;
    return;
  }

  // State abbreviation and values
  const state_abbrev = stateEntry[0]?.state_abbrev ?? 'Unknown';
  const val2011Raw = stateEntry[0]?.[fieldName];
  const lastEntry = stateEntry[stateEntry.length - 1]; // last year = 2021
  const val2021Raw = lastEntry?.[fieldName];

  // AP classes offered in 2021
  const apNum2021 = lastEntry?.ENR_AP ?? '—';

  const val2011 = typeof val2011Raw === 'number' ? val2011Raw.toFixed(2) : '—';
  const val2021 = typeof val2021Raw === 'number' ? val2021Raw.toFixed(2) : '—';

  // Arrow indicator
  let arrowIcon = '';
  let arrowClass = '';
  if (typeof val2011Raw === 'number' && typeof val2021Raw === 'number') {
    if (val2021Raw > val2011Raw) {
      arrowIcon = '🡹';
      arrowClass = 'arrow-up';
    } else if (val2021Raw < val2011Raw) {
      arrowIcon = '🡻';
      arrowClass = 'arrow-down';
    }
  }

  // Build factsheet HTML (state)
  factSheetContainer.classList.remove("full-width"); // no full width top row
  factSheetContainer.innerHTML = `
  <div class="opportunity-row">
    <div class="opportunity-column">
    <h2><b>Factsheet about <span id="currentState">${state_abbrev}</span></b></h2>
    ${typeof apNum2021 === 'number' ? apNum2021.toLocaleString() : apNum2021} AP Classes Offered in Schools (2021)<br>

    <b>Opportunity Estimates</b>
    <div class="opportunity-row">
      <div class="arrow ${arrowClass}">${arrowIcon}</div>
      <div class="opportunity-text">
        2011–12: ${val2011}<br>
        2021–22: ${val2021}
      </div>
    </div>

    </div> <!-- end "opportunity-column" -->
    <div class="opportunity-column district-column">
    <div class="table-header-wrapper">
      <h2 class="floatText">Districts in ${state_abbrev}</h2>
      <table id="district-table" class="table table-striped">
        <thead>
          <tr>
            <th>District</th>
            <th>Enrollment</th>
            <th>Teachers</th>
            <th>Opp Est 2011</th>
            <th>Opp Est 2021</th>
          </tr>
        </thead>
        <tbody id="district-table-body"></tbody>
        <tfoot>
          <tr>
            <th>District</th>
            <th>Enrollment</th>
            <th>Teachers</th>
            <th>Opp Est 2011</th>
            <th>Opp Est 2021</th>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
  </div>
  `;

  // Load and filter district data
  const loadAndBuild = (data) => {
    districtDataCache = districtDataCache || data; // cache first load
    console.log(data[0].LEA_STATE)
    const filteredDistrictData = data.filter(d =>
      d.LEA_STATE == state_abbrev
    );
    console.log('Filtered districts for', state_abbrev, filteredDistrictData.length, 'of', districtDataCache.length);
    //buildDistrictTable(filtered, fieldName); // pass fieldName to fill Opp Est
    buildDistrictTable(filteredDistrictData, 'ENR_AP_GAP_BL') // actually fills the table, given the data are loaded
    fillDistrictMap(map, filteredDistrictData, state_abbrev, fips, 'ENR_AP_GAP_BL'); // default map coloring
  };

  if (districtDataCache) {
    loadAndBuild(districtDataCache);
  } else {
    fetch('../assets/data/json/ap_equity_districts.json')
      .then(res => res.json())
      .then(loadAndBuild)
      .catch(err => console.error('Error loading district data:', err));
  }
}






// function initStateOverview() {
//   const StateOverviewCharts = document.getElementById('StateOverviewCharts');
//   if (!StateOverviewCharts) return;

//   // no data for state race makeup overview yet.
//   // const data = [{
//   //   labels: ['Two-or-more', 'Asian', 'Black', 'Hispanic', 'White'],
//   //   values: [6.1, 4.5, 1.9, 13.9, 71.7],
//   //   type: 'pie',
//   //   hole: 0.4, // Creates donut
//   //   marker: {
//   //     colors: ['#b3cde3','#fbb4ae','#ccebc5','#decbe4','#fed9a6']
//   //   },    
//   //   textinfo: 'label+percent',
//   //   hoverinfo: 'label+value+percent'
//   // }];

//   const layout = {
//     title: 'Racial Composition',
//     yaxis: { title: 'Percentage', range: [0, 60] },
//     width: 275,
//     height: 275,
//     showlegend: false
//   };

//   Plotly.newPlot('StateOverviewCharts', data, layout);
// }
