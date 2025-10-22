"""convert ap csvs to json

- states -> dict keyed by 2-digit fips ("01")
- others -> array of rows
- numeric-like strings -> numbers when possible
- 'NA' or empty -> null
- add fips and state_abbrev for state rows when possible

usage: python data_util/convert_ap_csvs.py
output: assets/data/json/<csvname>.json

created by Owen
"""
from pathlib import Path
import csv
import json
import sys

# state abbre -> fips (int)
STATE_TO_FIPS = {
    'AL': 1,'AK': 2,'AZ': 4,'AR': 5,'CA': 6,'CO': 8,'CT': 9,'DE': 10,'DC': 11,'FL': 12,
    'GA': 13,'HI': 15,'ID': 16,'IL': 17,'IN': 18,'IA': 19,'KS': 20,'KY': 21,'LA': 22,'ME': 23,
    'MD': 24,'MA': 25,'MI': 26,'MN': 27,'MS': 28,'MO': 29,'MT': 30,'NE': 31,'NV': 32,'NH': 33,
    'NJ': 34,'NM': 35,'NY': 36,'NC': 37,'ND': 38,'OH': 39,'OK': 40,'OR': 41,'PA': 42,'RI': 44,
    'SC': 45,'SD': 46,'TN': 47,'TX': 48,'UT': 49,'VT': 50,'VA': 51,'WA': 53,'WV': 54,'WI': 55,'WY': 56
}

# add puerto rico
STATE_TO_FIPS.update({'PR': 72})

ROOT = Path(__file__).resolve().parents[1]
CSV_DIR = ROOT / 'assets' / 'data' / 'AP Data'
OUT_DIR = ROOT / 'assets' / 'data' / 'json'
OUT_DIR.mkdir(parents=True, exist_ok=True)

# increase csv field size limit (handle very large fields)
try:
    csv.field_size_limit(sys.maxsize)
except Exception:
    # On some platforms maxsize may be too large; fallback to a large constant
    try:
        csv.field_size_limit(10 * 1024 * 1024)
    except Exception:
        pass


def parse_value(v):
    if v is None:
        return None
    v = v.strip()
    # empty or NA -> null
    if v == '' or v.upper() == 'NA':
        return None
    # inf -> null
    if v.upper() in ('INF', 'INFINITY'):
        return None
    # try number
    try:
        if '.' in v or 'e' in v.lower():
            return float(v)
        return int(v)
    except Exception:
        # keep string
        return v


def convert_csv(path: Path):
    name = path.name
    print(f"Converting {name}")

    with path.open('r', encoding='utf-8', errors='replace', newline='') as fh:
        reader = csv.DictReader(fh)
        rows = list(reader)

    # states file? group by fips; otherwise output array
    is_states = 'states' in name.lower()

    if is_states:
        out_obj = {}
        for row in rows:
            # prefer explicit fips column if present
            fips_num = None
            fips_candidates = ['FIPS', 'fips', 'STATE_FIPS', 'STATEID']
            for c in fips_candidates:
                val = row.get(c)
                if val is not None and str(val).strip() != '':
                    try:
                        fips_num = int(float(str(val).strip()))
                        break
                    except Exception:
                        fips_num = None

            # fallback: use state abbre
            state_abbrev = (row.get('LEA_STATE') or row.get('STATE') or row.get('state') or '').strip()
            if fips_num is None and state_abbrev:
                fips_num = STATE_TO_FIPS.get(state_abbrev.upper())

            if fips_num is None:
                print(f"Warning: unknown state abbre or missing FIPS in {name}; skipping row")
                continue

            fips_key = str(fips_num).zfill(2)

            # convert row values -> cleaned dict
            cleaned = {}
            for k, v in row.items():
                if k is None:
                    continue
                cleaned[k.strip()] = parse_value(v)

            # normalize year to int when possible
            if 'YEAR' in cleaned and cleaned['YEAR'] is not None:
                try:
                    cleaned['YEAR'] = int(cleaned['YEAR'])
                except Exception:
                    pass

            # ensure fips and abbre present
            cleaned['FIPS'] = fips_num
            cleaned['state_abbrev'] = state_abbrev.upper() if state_abbrev else cleaned.get('state_abbrev') or ''

            out_obj.setdefault(fips_key, []).append(cleaned)

        # sort each state's records by year
        for k, arr in out_obj.items():
            try:
                arr.sort(key=lambda r: r.get('YEAR', 0))
            except Exception:
                pass

        out_path = OUT_DIR / (path.stem + '.json')
        with out_path.open('w', encoding='utf-8') as of:
            json.dump(out_obj, of, indent=4, ensure_ascii=False)
        print(f"Wrote states JSON: {out_path}")

    else:
        # generic array output
        out_arr = []
        for row in rows:
            cleaned = {}
            for k, v in row.items():
                if k is None:
                    continue
                cleaned[k.strip()] = parse_value(v)
            out_arr.append(cleaned)
        out_path = OUT_DIR / (path.stem + '.json')
        with out_path.open('w', encoding='utf-8') as of:
            json.dump(out_arr, of, indent=4, ensure_ascii=False)
        print(f"Wrote array JSON: {out_path}")


if __name__ == '__main__':
    if not CSV_DIR.exists():
        print(f"CSV directory not found: {CSV_DIR}")
        sys.exit(1)

    csv_files = sorted(CSV_DIR.glob('*.csv'))
    if not csv_files:
        print("No CSV files found in", CSV_DIR)
        sys.exit(0)

    for p in csv_files:
        try:
            convert_csv(p)
        except Exception as e:
            print(f"Error converting {p.name}: {e}")
