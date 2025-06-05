const config = { displayModeBar: false };

    const layoutBase = {
      margin: { l: 10, r: 10, b: 10, t: 10 },
      paper_bgcolor: '#f4f4f4',
      plot_bgcolor: '#f4f4f4',
      xaxis: { visible: false },
      yaxis: { visible: false }
    };

    // Scatter Plot: black points with 1 yellow accent
    Plotly.newPlot('scatter', [
      {
        x: [1, 2],
        y: [2, 6],
        mode: 'markers',
        type: 'scatter',
        marker: { color: 'black', size: 10 }
      },
      {
        x: [3],
        y: [3],
        mode: 'markers',
        type: 'scatter',
        marker: { color: 'yellow', size: 10 }
      }
    ], layoutBase, config);

    // Bar Chart: black bars, 1 yellow bar
    Plotly.newPlot('bar', [{
      x: ['A', 'B', 'C'],
      y: [5, 2, 3],
      type: 'bar',
      marker: {
        color: ['black', 'yellow', 'black']
      }
    }], {
      ...layoutBase,
      bargap: 0.2,
      xaxis: { visible: false, range: [-0.5, 2.5] },
      yaxis: { visible: false, range: [0, 6] }
    }, config);

    // Line Chart: all black
    Plotly.newPlot('line', [{
      x: [0, 1, 2],
      y: [1, 3, 2],
      type: 'scatter',
      mode: 'lines',
      line: { color: 'black', width: 2 }
    }], layoutBase, config);

    // Pie Chart: gray, yellow, black
    Plotly.newPlot('pie', [{
      values: [10, 20, 30],
      labels: ['Gray', 'Yellow', 'Black'],
      type: 'pie',
      marker: {
        colors: ['gray', 'yellow', 'black']
      },
      textinfo: 'none'
    }], {
      margin: { l: 0, r: 0, b: 0, t: 0 },
      paper_bgcolor: '#f4f4f4'
    }, config);