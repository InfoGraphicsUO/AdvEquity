# Mapping AdvancED Equity Project

## Project Overview

This is a proof-of-concept interactive educational equity dashboard that builds upon ProPublica's "Miseducation" website/dashboard. It incorporates more recent data and longitudinal trends across multiple years. The dashboard focuses on educational equity metrics such as AP (Advanced Placement) course opportunities, racial composition, economic disadvantage, student-teacher ratios, and more.

Key features:
- Interactive map for exploring AP opportunity estimates by district and state.
- Data visualizations for students, teachers, and resources.
- Focus on disparities for Black and Hispanic students compared to White students.

The project uses HTML, CSS, JavaScript (with libraries like Plotly and Mapbox GL JS), and Python (via Jupyter Notebook for data processing). 

**Target Audience:** Educational researchers, policymakers, and equity advocates.


**Dependencies:**
- Mapbox GL JS (requires a Mapbox access token: `MAPBOXTOKEN` in map.js).
- Plotly.js for charts.
- Python libraries (for data processing)
- Fonts: jaf-bernino-sans (assumed to be available via CSS).

**Setup Instructions:**
1. Clone the repository.
2. Place assets (e.g., GeoJSON files like oregon_districts.geojson, JSON data like AllStates.json) in `/assets/data/`.
3. Set your Mapbox access token in `map.js`.
4. Open `map.html` in a browser to view the dashboard.
5. For data processing, run the Jupyter Notebook `convert_ap_csvs.py` in a Python environment.


**Running the Project:**
- The main entry point is `map.html`, which embeds or links to the map and charts.
- Use a local server for development to avoid CORS issues with local files.

## File Structure and Contents

Below is a detailed overview of each file in the project, including key code snippets, purposes, and extracted information.

### index.html
This is the main HTML file for the dashboard landing page.

- **Purpose:** Displays the project title, description, and embeds the interactive map/dashboard as a demo of the map embed into another site.

- **Key Content:**
  ```html
  <h1>Mapping AdvancED Equity</h1>
  <p>Below you will find a proof-of-concept interactive educational equity dashboard that builds upon ProPublica's "Miseducation" website/dashboard while incorporating more recent data and longitudinal trends across multiple years.</p>
  <!-- Embeds map or other components here -->
  ```

### charts.js
JavaScript file for initializing and rendering longitudinal charts using Plotly.
- **Purpose:** Creates trend charts for metrics like % non-white students, % economically disadvantaged, % HS students taking AP, student-teacher ratio, and modal AP courses per school. Uses dummy data for Oregon.


### map.html
HTML structure for the interactive map view.
- **Purpose:** Renders the map interface with legends, search, buttons, and info panels.

### map.js
Core JavaScript file for map functionality using Mapbox GL JS.
- **Purpose:** Handles map initialization, event listeners, data fetching, layer rendering, popups, and interactions.

### config.js
To hold any config keys
- **Purpose:**  Mapbox GL JS access token: `MAPBOXTOKEN`

### modal.js
JavaScript file for Info and Credit Modals
- **Purpose:**  Interaction for opening and closing modals.

### charts.css
CSS for styling charts and graphs.
- **Purpose:** Styles Plotly charts, legends, and containers.


### style.css
Global CSS styles for the demo site wrapper.
- **Purpose:** Defines root variables, body styles, headers, and main container.

### mapStyle.css
CSS specific to the map interface.
- **Purpose:** Styles map widgets, legends, popups, and overlays.

### table.css
CSS for the opportunity tables.
- **Purpose:** Styles the state opportunity table as a flex-based grid.