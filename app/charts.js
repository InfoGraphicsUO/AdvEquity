const config = { displayModeBar: false };

const layout = {
  margin: { l: 20, r: 5, t: 5, b: 20 },
  paper_bgcolor: getComputedStyle(document.documentElement).getPropertyValue('--lightgrey').trim(),
  plot_bgcolor: getComputedStyle(document.documentElement).getPropertyValue('--lightgrey').trim(),
  xaxis: {
    tickvals: [2011, 2021],
    tickfont: { size: 8 },
    showgrid: false,
    showline: false,
    ticks: '',
    fixedrange: true
  },
  yaxis: {
    tickvals: [0, 100],
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
          x: [2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021],
          y: values,
          mode: 'lines+markers',
          line: { color: colorBlack },
          marker: { color: colorBlack, size: 4 },
          type: 'scatter'
        },
        {
          x: [2011, 2021],
          y: [stateAvg, stateAvg],
          mode: 'lines',
          line: { color: colorYellow, width: 2, dash: 'dot' },
          type: 'scatter'
        }
      ], layout, config);
    }

    // Sample region-specific data + state average
    createLongitudinalChart('chart1', [45, 50, 55, 52, 60, 58, 62, 61, 65, 67, 70], 60);
    createLongitudinalChart('chart2', [30, 32, 35, 36, 40, 41, 43, 45, 46, 48, 50], 42);
    createLongitudinalChart('chart3', [70, 72, 68, 71, 74, 76, 77, 78, 80, 82, 84], 75);
    createLongitudinalChart('chart4', [55, 53, 56, 54, 58, 59, 60, 61, 62, 63, 65], 57);