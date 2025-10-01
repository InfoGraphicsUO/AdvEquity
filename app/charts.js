initGraph();
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

// Students
createLongitudinalChart('chart1', [45, 47, 50, 52, 55], 50);  // % non-white students
createLongitudinalChart('chart2', [60, 61, 63, 65, 68], 63);  // % economically disadvantaged
createLongitudinalChart('chart3', [20, 23, 26, 30, 34], 27);  // % HS students taking AP

// Teachers & Resources
createLongitudinalChart('chart4', [18, 17.5, 17, 16.5, 16], 17); // student-teacher ratio
createLongitudinalChart('chart5', [1, 2, 2, 3, 4], 2.5);         // modal AP courses per school


function initGraph() {
  const graphContainer = document.getElementById('graphContainer');
  if (!graphContainer) return;

  graphContainer.innerHTML = `<h2>Factsheet about <span id="currentState">Oregon</span></h2>`
  graphContainer.innerHTML +=`<div id = "StateOverviewCharts"></div><br>`

graphContainer.innerHTML +=`
    <div class="legend-row">
      <div class="legend-item">
        <span class="legend-color region-line"></span>
        <span>Measure over time</span>
      </div>
      <div class="legend-item">
        <span class="legend-color state-line"></span>
        <span>State average</span>
      </div>
    </div>
<div class="chart-row">
  <!-- Chart 1 -->
  <div class="chart-block">
    <div class="chart-caption">% of non-white students</div>
    <div id="chart1" class="chart"></div>
  </div>
  <!-- Chart 2 -->
  <div class="chart-block">
    <div class="chart-caption">% economically disadvantaged</div>
    <div id="chart2" class="chart"></div>
  </div>
  <!-- Chart 3 -->
  <div class="chart-block">
    <div class="chart-caption">% taking ≥1 AP course</div>
    <div id="chart3" class="chart"></div>
  </div>
  <!-- Chart 4 -->
  <div class="chart-block">
    <div class="chart-caption">Student–teacher ratio</div>
    <div id="chart4" class="chart"></div>
  </div>
  <!-- Chart 5 -->
  <div class="chart-block">
    <div class="chart-caption">Modal AP courses per school</div>
    <div id="chart5" class="chart"></div>
  </div>
</div>

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
