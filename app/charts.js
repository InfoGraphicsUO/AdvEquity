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

  graphContainer.innerHTML = `
    <h2>Factsheet about <span id="currentState">Oregon</span></h2>

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

    <h3>Students</h3>
    <div class="chart-row">
      <div class="chart-block">
        <div class="chart-caption">Percentage of non-white students</div>
        <div id="chart1" class="chart"></div>
      </div>
      <div class="chart-block">
        <div class="chart-caption">Percentage of economically disadvantaged students</div>
        <div id="chart2" class="chart"></div>
      </div>
      <div class="chart-block">
        <div class="chart-caption">Percentage taking ≥1 AP course</div>
        <div id="chart3" class="chart"></div>
      </div>
    </div>

    <h3>Teachers and Resources</h3>
    <div class="chart-row">
      <div class="chart-block">
        <div class="chart-caption">Student–teacher ratio</div>
        <div id="chart4" class="chart"></div>
      </div>
      <div class="chart-block">
        <div class="chart-caption">Modal number of AP courses per school</div>
        <div id="chart5" class="chart"></div>
      </div>
    </div>
  `;
}
