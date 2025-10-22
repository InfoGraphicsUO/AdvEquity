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

// factSheetContainer.innerHTML +=`
//   XX Classes Offered in Schools <Br>
//   Opportunity estimate for 2011-12: 80.4%<br>
//   Opportunity estimate for 2021-22: 72.5% 
//   `;
// }

function initFactSheet(stateData, fips, fieldName) {
  const factSheetContainer = document.getElementById('factSheetContainer');
  if (!factSheetContainer) return;
  console.log(stateData)

  // set FIPS to match keys like "01"
  const fipsKey = String(fips).padStart(2, '0');


  // find the state entry by FIPS
  const stateEntry = stateData[fipsKey];
  //console.log(stateEntry);
  //console.log(stateData)

  if (!stateEntry) {
    factSheetContainer.innerHTML = `<p>No data found for FIPS ${fips}</p>`;
    return;
  }

  // const stateName = stateEntry[0]?.state_name ?? 'Unknown';
  const state_abbrev = stateDataCache[fips][0].state_abbrev ?? 'Unknown';
  const val2011Raw = stateEntry[0]?.[fieldName];
  const val2021Raw = stateEntry[1]?.[fieldName];
  const apNum2021 = stateEntry[1]?.AP_num; // 2021 AP_num value

  const val2011 = typeof val2011Raw === 'number'
    ? (val2011Raw * 100).toFixed(1) + '%'
    : 'N/A';
  const val2021 = typeof val2021Raw === 'number'
    ? (val2021Raw * 100).toFixed(1) + '%'
    : 'N/A';

  factSheetContainer.innerHTML = `
    <h2>Factsheet about <span id="currentState">${state_abbrev}</span></h2>
    <div id="StateOverviewCharts"></div><br>

    <b>Opportunity Estimates</b><br>
    <div class="opportunity-row">
      <div class="arrow ${val2011Raw > val2021Raw ? 'arrow-down' : 'arrow-up'}">
        ${val2011Raw > val2021Raw ? '🡻' : '🡹'}
      </div>
      <div class="opportunity-text">
        2011–12: ${val2011}<br>
        2021–22: ${val2021}
      </div>
    </div>
    <br>

    ${apNum2021} AP Classes Offered in Schools (2021) <br>
  `;
}




function initStateOverview() {
  const StateOverviewCharts = document.getElementById('StateOverviewCharts');
  if (!StateOverviewCharts) return;


  const data = [{
    labels: ['Two-or-more', 'Asian', 'Black', 'Hispanic', 'White'],
    values: [6.1, 4.5, 1.9, 13.9, 71.7],
    type: 'pie',
    hole: 0.4, // Creates donut
    marker: {
      colors: ['#b3cde3','#fbb4ae','#ccebc5','#decbe4','#fed9a6']
    },    
    textinfo: 'label+percent',
    hoverinfo: 'label+value+percent'
  }];

  const layout = {
    title: 'Racial Composition',
    yaxis: { title: 'Percentage', range: [0, 60] },
    width: 275,
    height: 275,
    showlegend: false
  };

  Plotly.newPlot('StateOverviewCharts', data, layout);
}
