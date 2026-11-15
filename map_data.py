"""Build public/data/map.geojson: parcels, roads, creeks and gas infrastructure for the site's map.

Sources:
  - Parcels: github.com/NickCrews/anchorage-property (daily copy of MOA property records)
  - Streets and streams: Municipality of Anchorage ArcGIS services (Streets_Hosted, WMS_Streams_Hosted)
  - Gas lines: drawn here from the 2023 Enstar application and DNR decision (see comments); approximate

Usage: python3 map_data.py   (needs duckdb and shapely; downloads ~36 MB)
"""

import json
import subprocess
import urllib.parse
from pathlib import Path

import duckdb
import shapely.wkb
from shapely.geometry import box, mapping

ROOT = Path(__file__).parent
CACHE = ROOT / ".cache"
OUT = ROOT / "public" / "data" / "map.geojson"

PARCELS_DB = "https://pub-003dd855abeb48a1927aa93a77fc5471.r2.dev/anchorage-current.duckdb"
ARCGIS = "https://services2.arcgis.com/Ce3DhLRthdwbHlfF/arcgis/rest/services"

# Area shown on the map (lon/lat)
PARCEL_BBOX = (-149.168, 60.940, -149.120, 60.958)
CONTEXT_BBOX = (-149.20, 60.930, -149.10, 60.975)

HLB_6_062 = "07520101000"  # T10N R2E SEC 20 TR 20A, HLB Parcel 6-062
SECTION_LINE_TRACTS = ["07513102000", "07520102000", "07520101000"]  # tracts 19B, 20B, 20A


def fetch(url: str, path: Path) -> Path:
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["curl", "-fsSL", "-o", str(path), url], check=True)
    return path


def arcgis_lines(service: str, out_fields: str) -> list[dict]:
    xmin, ymin, xmax, ymax = CONTEXT_BBOX
    params = {
        "where": "1=1",
        "geometry": json.dumps({"xmin": xmin, "ymin": ymin, "xmax": xmax, "ymax": ymax, "spatialReference": {"wkid": 4326}}),
        "geometryType": "esriGeometryEnvelope",
        "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": out_fields,
        "outSR": "4326",
        "f": "geojson",
    }
    url = f"{ARCGIS}/{service}/FeatureServer/0/query?" + urllib.parse.urlencode(params)
    path = fetch(url, CACHE / f"{service}.geojson")
    return json.loads(path.read_text())["features"]


def owner_class(owner: str) -> str:
    o = (owner or "").upper()
    if "HERITAGE LAND BANK" in o:
        return "hlb"
    if o.startswith("MUNICIPALITY OF ANCHORAGE"):
        return "muni"
    if o.startswith("STATE OF ALASKA") or "MENTAL HEALTH TRUST" in o or "UNITED STATES" in o or "FOREST SERVICE" in o:
        return "public"
    return "private"


def parcels() -> tuple[list[dict], float, dict]:
    db = duckdb.connect(str(fetch(PARCELS_DB, CACHE / "anchorage-current.duckdb")), read_only=True)
    xmin, ymin, xmax, ymax = PARCEL_BBOX
    rows = db.execute(
        """
        SELECT parcel_id, parcel_id_url, owner_name, parcel_address, legal_description, land_use,
               area_m2, geom_wkb
        FROM parcels_current
        WHERE centroid_lon BETWEEN ? - 0.01 AND ? + 0.01 AND centroid_lat BETWEEN ? - 0.005 AND ? + 0.005
        """,
        [xmin, xmax, ymin, ymax],
    ).fetchall()
    view = box(*PARCEL_BBOX)
    feats, geoms = [], {}
    for pid, url, owner, addr, legal, use, m2, g in rows:
        geom = shapely.wkb.loads(bytes(g))
        if not geom.intersects(view):
            continue
        geoms[pid] = geom
        feats.append({
            "type": "Feature",
            "geometry": mapping(geom),
            "properties": {
                "layer": "parcel",
                "class": owner_class(owner),
                "parcel_id": pid,
                "url": url,
                "owner": owner,
                "address": None if (addr or "").endswith("UNKNOWN ST") else addr,
                "legal": legal,
                "land_use": use,
                "acres": round((m2 or 0) / 4046.86, 2),
                "hlb_6_062": pid == HLB_6_062,
            },
        })
    # The section line is the north edge of tracts 19B, 20B and 20A (DNR decision: "N 50 feet of lots 19B, 20A, 20B").
    north_edges = [geoms[p].bounds[3] for p in SECTION_LINE_TRACTS]
    section_lat = sum(north_edges) / len(north_edges)
    return feats, section_lat, geoms


def line(coords, **props) -> dict:
    return {"type": "Feature", "geometry": {"type": "LineString", "coordinates": coords}, "properties": props}


def point(lon, lat, **props) -> dict:
    return {"type": "Feature", "geometry": {"type": "Point", "coordinates": [lon, lat]}, "properties": props}


def main() -> None:
    feats, sl, _ = parcels()

    streets = arcgis_lines("Streets_Hosted", "Street_Label")
    streams = arcgis_lines("WMS_Streams_Hosted", "STREAMNAME,ANADROMOUS")

    def street_coords(label, keep=lambda c: True):
        out = []
        for f in streets:
            if f["properties"].get("Street_Label", f["properties"].get("name")) == label:
                g = f["geometry"]
                parts = [g["coordinates"]] if g["type"] == "LineString" else g["coordinates"]
                out += [p for p in parts if keep(p)]
        return out

    for f in streets:
        f["properties"] = {"layer": "street", "name": f["properties"]["Street_Label"]}
    named_streams = []
    for f in streams:
        name = (f["properties"].get("STREAMNAME") or "").strip()
        if name and name != "UNNAMED":
            f["properties"] = {"layer": "stream", "name": name.title(), "anadromous": f["properties"].get("ANADROMOUS")}
            named_streams.append(f)

    # Ruane Rd runs from the Alyeska Hwy (west end) east to its end at the wastewater plant.
    ruane = street_coords("Ruane Rd")
    ruane_west = (-149.16458, 60.9507)
    ruane_east = (-149.15875, 60.94953)

    infra = []
    # Transmission line from Anchorage, approximately along the Seward Hwy, continuing on to Whittier.
    for part in street_coords("Seward Hwy"):
        infra.append(line(part, layer="infra", kind="transmission",
                          name="Transmission line from Anchorage to Girdwood and Whittier (approximate route along Seward Hwy)"))
    # The transmission line reaches the regulator on Ruane Rd; drawn here up the Alyeska Hwy from the Seward Hwy (approximate).
    for part in street_coords("Alyeska Hwy", keep=lambda c: max(p[1] for p in c) <= ruane_west[1] + 0.0003):
        infra.append(line(part, layer="infra", kind="transmission",
                          name="Transmission line to the Ruane Rd regulator (approximate route)"))
    # Existing 6-inch distribution main: from the regulator on Ruane Rd, NNE along the Alyeska Hwy.
    for part in ruane:
        infra.append(line(part, layer="infra", kind="main6", name="Existing 6-inch main on Ruane Rd (approximate)"))
    for part in street_coords("Alyeska Hwy", keep=lambda c: min(p[1] for p in c) >= ruane_west[1] - 0.0003):
        infra.append(line(part, layer="infra", kind="main6",
                          name="Existing 6-inch main, the single feed to the valley, along Alyeska Hwy (approximate)"))
    infra.append(point(-149.1607, 60.9499, layer="infra", kind="regulator",
                       name="Enstar regulator station on Ruane Rd (exact location approximate)"))

    # 2016 contractor strike near 1127 Alyeska Hwy
    db = duckdb.connect(str(CACHE / "anchorage-current.duckdb"), read_only=True)
    # No parcel carries 1127 as its address, so mark the highway beside the nearest one, 1133 Alyeska Hwy.
    near = db.execute("SELECT geom_wkb FROM parcels_current WHERE parcel_address = '1133 ALYESKA HWY' LIMIT 1").fetchone()
    if near:
        from shapely.geometry import LineString
        from shapely.ops import nearest_points
        parcel = shapely.wkb.loads(bytes(near[0]))
        hwy = [LineString(c) for c in street_coords("Alyeska Hwy")]
        closest = min(hwy, key=parcel.distance)
        spot = nearest_points(closest, parcel.centroid)[0]
        infra.append(point(spot.x, spot.y, layer="infra", kind="strike",
                           name="August 2016: contractor hit the 6-inch main near 1127 Alyeska Hwy (approximate spot)"))

    # Section-line easement: 50 ft each side of the section line (DNR decision), from Ruane Rd east.
    half = 15.24 / 111_320  # 50 ft in degrees of latitude
    west_lon, east_lon = ruane_east[0], -149.12328
    sle = {"type": "Feature", "geometry": {"type": "Polygon", "coordinates": [[
        [west_lon, sl - half], [east_lon, sl - half], [east_lon, sl + half], [west_lon, sl + half], [west_lon, sl - half]]]},
        "properties": {"layer": "sle", "name": "State section-line easement, 100 ft wide (50 ft each side)"}}

    # 2023 proposed line: 4,850 ft from the end of Ruane Rd east along the section line to Virgin Creek Rd.
    # First ~1,500 ft drilled under Glacier Creek and its wetlands, then 3,350 ft trenched in a 20-ft cleared strip.
    m_per_deg_lon = 111_320 * 0.48572  # cos(60.95°)
    bore_end = ruane_east[0] + 457 / m_per_deg_lon
    vcr_end = (-149.13089, 60.94882)
    proposed = [
        line([list(ruane_east), [bore_end, sl]], layer="proposed", kind="bore",
             name="2023 plan: ~1,500 ft drilled under Glacier Creek and wetlands (approximate)"),
        line([[bore_end, sl], [vcr_end[0], sl], list(vcr_end)], layer="proposed", kind="trench",
             name="2023 plan: ~3,350 ft trenched in a 20-ft cleared strip (approximate)"),
        point(*ruane_east, layer="proposed", kind="tie", name="Tie-in to the 6-inch main at the end of Ruane Rd"),
        point(*vcr_end, layer="proposed", kind="tie", name="Tie-in to a 2-inch main at the end of Virgin Creek Rd"),
    ]

    fc = {"type": "FeatureCollection",
          "features": feats + streets + named_streams + [sle] + infra + proposed}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(fc, separators=(",", ":")))
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB, {len(feats)} parcels)")


if __name__ == "__main__":
    main()
