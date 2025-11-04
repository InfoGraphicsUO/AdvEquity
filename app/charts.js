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

function getStateOpportunityEstimates(state,fieldName) {
  // Normalize input to string
  const stateStr = String(state).trim();

  // Helper: check if string is all digits (FIPS)
  const isNumeric = /^\d+$/.test(stateStr);

  // Get the state entry depending on the type
  let stateEntry;
  if (isNumeric) {
    const fipsKey = stateStr.padStart(2, '0');
    stateEntry = stateDataCache[fipsKey];
  } else {
    stateEntry = Object.values(stateDataCache).find(
      arr => arr[0]?.state_abbrev === stateStr.toUpperCase()
    );
  }

  if (!stateEntry) return `<div>State data not found for "${stateStr}"</div>`;
  console.log(stateEntry)

  // Extract values
  const state_abbrev = stateEntry[0]?.state_abbrev ?? 'Unknown';
  const val2011Raw = stateEntry[0]?.[fieldName];
  const lastEntry = stateEntry[stateEntry.length - 1]; // last year = 2021
  const val2021Raw = lastEntry?.[fieldName];
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

  // Return formatted HTML
  const opphtml = `
    <br><b>Opportunity Estimates</b>
    <div class="opportunity-row opportunity-estimates">
      <div class="arrow ${arrowClass}">${arrowIcon}</div>
      <div class="opportunity-text">
        2011–12: ${val2011}<br>
        2021–22: ${val2021}
      </div>
    </div>
    <small>placeholder for description of the change</small>
  `;

  return opphtml;
}



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
  const modal_school_APCOURSES = stateEntry[stateEntry.length - 1]?.SCH_APCOURSES ?? 'Unknown';
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

  oppestHTML = getStateOpportunityEstimates(fips,fieldName)

  // Build factsheet HTML (state)
  factSheetContainer.classList.remove("full-width"); // no full width top row
  factSheetContainer.innerHTML = `
  <div class="opportunity-row">
    <div class="opportunity-column">
    <h2><b>Factsheet about <span id="currentState">${state_abbrev}</span></b></h2>
    # Districts: <span id="numDistricts">—</span><br>
    Modal # of AP classes offered in schools:<br><small>(avg of 2021 school-level modes)</small>${modal_school_APCOURSES}


    ${oppestHTML}
      <!-- State composition bar: placed below the opportunity column -->
      <div style="margin-top:8px;">
        <b>State Composition</b>
        <canvas id="stateCompBar" width="360" height="90"></canvas>
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
  // draw state composition bar (uses latest year values from stateEntry
  try {
    const stateLatest = stateEntry[stateEntry.length - 1];
    if (stateLatest) {
      const compData = {
        WH: stateLatest.PCT_ENR_WH,
        HI: stateLatest.PCT_ENR_HI,
        BL: stateLatest.PCT_ENR_BL,
        AS: stateLatest.PCT_ENR_AS,
        OTH: stateLatest.PCT_ENR_OTH
      };
      const compColors = { WH: "#a6cee3", HI: "#d95f02", BL: "#1b9e77", AS: "#7570b3", OTH: "#555" };
      // drawCompositionBar is defined in map.js and loaded before this script in map.html
      try { drawCompositionBar('stateCompBar', compData, compColors); } catch (e) { console.warn('drawCompositionBar unavailable', e); }
    }
  } catch (e) {
    console.warn('Could not build state composition data', e);
  }

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
    // populate # districts in the factsheet by counting unique LEAID (might be changed later)
    try {
      const nd = document.getElementById('numDistricts');
      if (nd) {
        const unique = new Set(filteredDistrictData.map(d => String(d.LEAID || d.LEA_NAME || '')).filter(v => v));
        nd.textContent = unique.size.toLocaleString();
      }
    } catch(e) { console.warn('Could not set numDistricts', e); }
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
// Pull CSS variables used by the canvas chart utilities
const _root = document.documentElement;
const verydarkgrey = getComputedStyle(_root).getPropertyValue('--verydarkgrey').trim();
const darkgrey = getComputedStyle(_root).getPropertyValue('--darkgrey').trim();
const lightgrey = getComputedStyle(_root).getPropertyValue('--lightgrey').trim();
const green = getComputedStyle(_root).getPropertyValue('--green').trim();
const darkGreen = getComputedStyle(_root).getPropertyValue('--darkGreen').trim();
const yellow = getComputedStyle(_root).getPropertyValue('--yellow').trim();
const almostBlack = getComputedStyle(_root).getPropertyValue('--almostBlack').trim();
const offwhite = getComputedStyle(_root).getPropertyValue('--offwhite').trim();

function showGraphs(){
  try { document.querySelector('#infoContainer').style.display = 'none' } catch(e) {}
  try { document.querySelector('#factSheetContainer').style.display = 'flex' } catch(e) {}
}

function hideGraphs(){
  try { document.querySelector('#infoContainer').style.display = 'block' } catch(e) {}
  try { document.querySelector('#factSheetContainer').style.display = 'none' } catch(e) {}
}

function drawCompDonutChart(canvasId, data, colors) {
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
    ctx.fillText(`${key}: ${formatPercentage(value)}`,legendX+18,legendY);
    legendY+=16;
  }
}

function drawCompositionBar(canvasId, data, colors) {
  const canvas = document.getElementById(canvasId);
  if(!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // sort entries by value descending 
  const entries = Object.entries(data).sort((a,b) => (b[1] || 0) - (a[1] || 0));
  const total = entries.reduce((sum,[,v])=>sum+(v||0),0);

  if (!total || total <= 0) return; // nothing to draw

  const barHeight = 30;
  const startY = 20;
  let x = 0;
  const legendEntries = [];

  const baseFont = "12px sans-serif";
  const boldFont = "bold 12px sans-serif";
  ctx.font = baseFont;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Draw stacked bar with internal labels if wide enough
  for (const [key, value] of entries) {
    const width = (value || 0) / total * canvas.width;
    ctx.fillStyle = colors[key] || "#000";
    ctx.fillRect(x, startY, width, barHeight);

    if (width > 40) {
      ctx.fillStyle = "#fff";
      ctx.font = boldFont;
      ctx.fillText(`${key}: ${formatPercentage(value)}`, x + width / 2, startY + barHeight / 2);
      ctx.font = baseFont;
    } else {
      legendEntries.push([key, formatPercentage(value)]);
    }
    x += width;
  }

  // Draw legend below bar for segments too small for inside label
  ctx.font = baseFont;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
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
    ctx.fillStyle = colors[key]||"#000";
    ctx.fillRect(legendX,legendY-10,12,12);
    ctx.fillStyle="#000";
    ctx.fillText(text,legendX+18,legendY);
    legendX+=textWidth;
  }
}


function drawMiniChart(canvasId, years, series, colors, yLabel = '') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const padLeft = 42;
  const padRight = 42;
  const padTop = 12;
  const padBottom = 26;

  const w = canvas.width - padLeft - padRight;
  const h = canvas.height - padTop - padBottom;

  const allVals = Object.values(series).flat().filter(v => v != null && !isNaN(v));
  if (!allVals.length) return;
  let min = Math.min(...allVals);
  let max = Math.max(...allVals);
  if (min === max) {
    min = min - 1;
    max = max + 1;
  }

  const xStep = w / (Math.max(1, years.length - 1));

  // Draw background grid lines
  ctx.save();
  const gridColor = (typeof lightgrey !== 'undefined' && lightgrey) ? lightgrey : '#ddd';
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 1.0;

  years.forEach((yr, i) => {
    const x = padLeft + i * xStep;
    ctx.beginPath();
    ctx.moveTo(x, padTop);
    ctx.lineTo(x, padTop + h);
    ctx.stroke();
  });

  const hSteps = 4;
  for (let j = 0; j <= hSteps; j++) {
    const y = padTop + (j / hSteps) * h;
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(padLeft + w, y);
    ctx.stroke();
  }

  ctx.restore();

  ctx.strokeStyle = (typeof darkgrey !== 'undefined' ? darkgrey : '#777');
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padLeft, padTop);
  ctx.lineTo(padLeft, padTop + h);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(padLeft, padTop + h);
  ctx.lineTo(padLeft + w, padTop + h);
  ctx.stroke();

  ctx.fillStyle = '#555';
  ctx.font = '10px sans-serif';
  const ticks = 4;
  for (let t = 0; t <= ticks; t++) {
    const v = min + (t / ticks) * (max - min);
    const y = padTop + h - ((v - min) / (max - min)) * h;
    const label = Number(v).toFixed(2);
    ctx.textAlign = 'right';
    ctx.fillText(label, padLeft - 6, y + 3);
  }

  ctx.fillStyle = '#555';
  ctx.font = '10px sans-serif';
  years.forEach((yr, i) => {
    const x = padLeft + i * xStep;
    ctx.textAlign = 'center';
    ctx.fillText(yr.toString(), x, padTop + h + 16);
  });

  for (const [key, values] of Object.entries(series)) {
    ctx.beginPath();
    ctx.strokeStyle = colors[key] || '#000';
    ctx.lineWidth = key === 'District' ? 2.4 : 1.2;

    values.forEach((v, i) => {
      if (v == null || isNaN(v)) return;
      const x = padLeft + i * xStep;
      const y = padTop + h - ((v - min) / (max - min)) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    const dotR = key === 'District' ? 3.5 : 2.5;
    values.forEach((v, i) => {
      if (v == null || isNaN(v)) return;
      const x = padLeft + i * xStep;
      const y = padTop + h - ((v - min) / (max - min)) * h;
      ctx.beginPath();
      ctx.arc(x, y, dotR, 0, Math.PI * 2);
      ctx.fillStyle = colors[key] || '#000';
      ctx.fill();

      if (years[i] === 2021) {
        ctx.fillStyle = colors[key] || '#000';
        ctx.font = key === 'District' ? '10px sans-serif' : '9px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(Number(v).toFixed(2), x + 6, y - 6);
      }
    });
  }
}

function shadeColor(hex, percent) {
  try {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0,2),16);
    const g = parseInt(h.substring(2,4),16);
    const b = parseInt(h.substring(4,6),16);
    const nr = Math.round(r + (255 - r) * percent);
    const ng = Math.round(g + (255 - g) * percent);
    const nb = Math.round(b + (255 - b) * percent);
    return '#' + [nr,ng,nb].map(v => v.toString(16).padStart(2,'0')).join('');
  } catch (e) {
    return hex;
  }
}

function drawLegend(containerId, series, colorMap = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const baseColors = { BL: "#1b9e77", AS: "#7570b3", HI: "#d95f02" };
  const colors = Object.assign({}, baseColors, colorMap || {});
  container.innerHTML = "";

  const nameMap = { BL: 'Black', AS: 'Asian', HI: 'Hispanic' };

  Object.keys(series).forEach(key => {
    const span = document.createElement("span");
    span.style.display = "inline-block";
    span.style.marginRight = "14px";
    span.style.fontSize = '13px';
    span.style.verticalAlign = 'middle';

    let label = key;
    if (key.endsWith('_state')) {
      const base = key.replace(/_state$/, '');
      label = `${nameMap[base] || base}`;
    } else if (key.endsWith('_nat')) {
      const base = key.replace(/_nat$/, '');
      label = `${nameMap[base] || base}`;
    } else {
      label = nameMap[key] || key;
    }

    const color = colors[key] || baseColors[key.replace(/_(state|nat)$/, '')] || '#000';

    const box = document.createElement('span');
    box.style.display = 'inline-block';
    box.style.width = '12px';
    box.style.height = '12px';
    box.style.background = color;
    box.style.marginRight = '6px';
    box.style.verticalAlign = 'middle';

    span.appendChild(box);
    const txt = document.createElement('span');
    txt.textContent = label;
    txt.style.marginRight = '8px';
    span.appendChild(txt);

    container.appendChild(span);
  });
}

function buildStateSeriesForYears(years, field, stateAbbrev) {
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
}

function buildNatSeriesForYears(years, field, natLookup) {
  if (!natLookup) return Array(years.length).fill(null);
  return years.map(y => (natLookup[Number(y)] ? natLookup[Number(y)][field] ?? null : null));
}

function prepareAndDrawSparkline(opts) {
  try {
    const { canvasId, legendId, title, field, records, years, natLookup, stateAbbrev } = opts;
    const districtArr = records.map(r => {
      const v = r[field];
      return (v === null || v === undefined || isNaN(Number(v))) ? null : Number(v);
    });

    const seriesObj = { District: districtArr };

    const stateArr = buildStateSeriesForYears(years, field, stateAbbrev);
    if (stateArr.some(v => v !== null)) seriesObj.State = stateArr;

    const natArr = buildNatSeriesForYears(years, field, natLookup);
    if (natArr.some(v => v !== null)) seriesObj.National = natArr;

    const colors = { District: '#000', State: '#555', National: '#888' };

    if (Object.values(seriesObj).flat().some(v => v !== null)) {
      drawMiniChart(canvasId, years, seriesObj, colors, title);
      if (legendId) drawSimpleLegend(legendId, { District: 'District', State: 'State', National: 'National' }, colors, seriesObj);
    } else {
      const c = document.getElementById(canvasId);
      if (c && c.getContext) {
        const ctx = c.getContext('2d');
        ctx.clearRect(0,0,c.width,c.height);
        ctx.font = '12px sans-serif';
        ctx.fillStyle = '#666';
        ctx.fillText('No data available', 10, c.height/2);
      }
      if (legendId) {
        const cont = document.getElementById(legendId);
        if (cont) cont.innerHTML = '';
      }
    }
  } catch (e) {
    console.warn('prepareAndDrawSparkline failed for', opts && opts.field, e);
  }
}

function drawSimpleLegend(containerId, labelMap, colors = {}, series = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  Object.keys(labelMap).forEach(key => {
    if (!series[key]) return;
    const span = document.createElement('span');
    span.style.display = 'inline-block';
    span.style.marginRight = '12px';
    span.style.fontSize = '13px';
    span.style.verticalAlign = 'middle';

    const box = document.createElement('span');
    box.style.display = 'inline-block';
    box.style.width = '12px';
    box.style.height = '12px';
    box.style.background = colors[key] || '#000';
    box.style.marginRight = '6px';
    box.style.verticalAlign = 'middle';

    span.appendChild(box);
    const txt = document.createElement('span');
    txt.textContent = labelMap[key];
    txt.style.marginRight = '8px';
    span.appendChild(txt);

    container.appendChild(span);
  });
}

function toTitleCase(str) {
  return str.replace(/\w\S*/g, txt => {
    return txt.length <= 2 ? txt : txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase();
  });
}

function formatPercentage(num) {
  if (num * 100 < 1) {
    return "< 1%";
  }
  return (num * 100).toFixed(1) + "%";
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
