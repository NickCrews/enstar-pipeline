import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./map.css";

const COLORS = {
  hlb: "#7048e8",
  muni: "#9775fa",
  public: "#4dabf7",
  private: "#ffa94d",
  transmission: "#e8590c",
  main6: "#d9480f",
  proposed: "#2b8a3e",
  sle: "#c2255c",
  street: "#adb5bd",
  stream: "#339af0",
};

// Each view: what to frame and what to highlight. Keys in `hl` match featureKeys() below.
const VIEWS = {
  system: { title: "Today: one feed into the valley", hl: ["transmission", "main6", "regulator", "proposed"], frame: ["main6", "regulator", "proposed"],
    labels: [["main6", "Existing 6-inch main: the only feed"], ["regulator", "Regulator station", "top"], ["proposed", "Proposed second line", "bottom"]] },
  transmission: { title: "The line from Anchorage also feeds Whittier", hl: ["transmission", "main6", "regulator", "break"], frame: ["transmission", "break"],
    labels: [["transmission", "One line: Anchorage → Girdwood → Whittier", "top"], ["regulator", "Girdwood regulator", "right"], ["break", "Broke under the Twentymile River (Aug 2026)", "left"]] },
  main: { title: "The existing 6-inch main along the Alyeska Highway", hl: ["main6", "regulator", "strike"], frame: ["main6"],
    labels: [["main6", "6-inch main up the Alyeska Hwy"], ["strike", "2016 strike", "left"], ["regulator", "Regulator station", "bottom"]] },
  strike: { title: "2016: contractor hits the main near 1127 Alyeska Hwy", hl: ["main6", "strike"], frame: ["strike"], zoom: 16,
    labels: [["strike", "Contractor hit the main here (Aug 2016)"], ["main6", "6-inch main"]] },
  ruane: { title: "Ruane Road: regulator station and 2021 washout", hl: ["main6", "regulator", "street:Ruane Rd"], frame: ["street:Ruane Rd", "regulator"], pad: 0.6,
    labels: [["street:Ruane Rd", "Ruane Rd (washed out Oct 2021)", "bottom"], ["regulator", "Regulator station", "top"]] },
  sle: { title: "The state section-line easement (100 ft wide)", hl: ["sle", "proposed"], frame: ["sle"],
    labels: [["sle", "Section-line easement, 100 ft wide (since 1972)", "top"]] },
  route: { title: "Enstar's route: Ruane Rd to Virgin Creek Rd", hl: ["proposed", "sle", "tie"], frame: ["proposed"],
    labels: [["bore", "Drilled under Glacier Creek", "top"], ["trench", "Trenched, 20-ft clearing", "top"], ["tie:west", "Tie-in to 6-inch main", "bottom"], ["tie:east", "Tie-in to 2-inch main", "bottom"]] },
  glacier: { title: "Drilled under Glacier Creek (~1,500 ft)", hl: ["bore", "stream:Glacier Creek", "tie"], frame: ["bore"], pad: 0.4,
    labels: [["bore", "~1,500 ft bore, 10+ ft under the streambed", "top"], ["stream:Glacier Creek", "Glacier Creek"], ["tie:west", "End of Ruane Rd", "bottom"]] },
  trench: { title: "Trenched and cleared (~3,350 ft × 20 ft)", hl: ["trench", "hlb_easement", "sle"], frame: ["trench", "hlb_easement"],
    labels: [["trench", "Trenched, 20-ft cleared strip", "top"], ["tie:east", "End of Virgin Creek Rd", "bottom"]] },
  hlb: { title: "Res. 2026-11: the line's east end, angled across HLB Parcel 6-062", hl: ["hlb_6_062", "hlb_easement", "tce", "replaced", "trench", "tie:east"], frame: ["hlb_easement", "replaced", "tce"], pad: 0.6,
    labels: [["hlb_easement", "Res. 2026-11 easement (HLB Parcel 6-062)", "bottom"], ["replaced", "2023 alignment it replaces", "top"], ["tie:east", "Virgin Creek Rd", "right"]] },
  neighbors: { title: "The east end: Virgin Creek Rd and Timberline Dr", hl: ["private", "tie", "trench", "hlb_easement", "tce", "street:Virgin Creek Rd", "street:Timberline Dr"], frame: ["neighbors"],
    labels: [["street:Virgin Creek Rd", "Virgin Creek Rd", "bottom"], ["street:Timberline Dr", "Timberline Dr", "right"], ["tie:east", "Tie-in", "left"]] },
  traffic: { title: "Construction access: Ruane Rd (west) and Virgin Creek Rd (east)", hl: ["street:Ruane Rd", "street:Virgin Creek Rd", "street:Timberline Dr", "proposed"], frame: ["proposed", "street:Virgin Creek Rd"],
    labels: [["street:Ruane Rd", "West access: Ruane Rd", "bottom"], ["street:Virgin Creek Rd", "East access: Virgin Creek Rd", "bottom"]] },
  owners: { title: "Who owns the land", hl: ["hlb", "muni", "public", "private", "proposed"], frame: ["proposed"], pad: 0.5,
    labels: [["hlb_6_062", "Heritage Land Bank"], ["street:Timberline Dr", "Private homes", "right"], ["proposed", "Proposed line", "top"]] },
};

function featureKeys(f) {
  const p = f.properties;
  const keys = [p.layer];
  if (p.layer === "parcel") {
    keys.push(p.class);
    if (p.hlb_6_062) keys.push("hlb_6_062");
  }
  if (p.kind) keys.push(p.kind);
  if (p.layer === "proposed") keys.push("proposed");
  if (p.layer === "street") keys.push(`street:${p.name}`);
  if (p.layer === "stream") keys.push(`stream:${p.name}`);
  if (p.kind === "tie") keys.push(/Virgin Creek/.test(p.name) ? "tie:east" : "tie:west");
  return keys;
}

function baseStyle(f, on) {
  const p = f.properties;
  switch (p.layer) {
    case "parcel": {
      const c = COLORS[p.class];
      if (p.hlb_6_062) return { color: COLORS.hlb, weight: on ? 3 : 1.5, fillColor: c, fillOpacity: on ? 0.35 : 0.12, opacity: 1 };
      return { color: "#fff", weight: 0.6, opacity: on ? 0.9 : 0.4, fillColor: c, fillOpacity: on ? 0.35 : 0.1 };
    }
    case "street":
      return { color: on ? "#212529" : COLORS.street, weight: on ? 4 : 1.5, opacity: on ? 0.9 : 0.6 };
    case "stream":
      return { color: COLORS.stream, weight: on ? 4 : 2, opacity: on ? 1 : 0.6 };
    case "sle":
      return { color: COLORS.sle, weight: 1, dashArray: "4 4", fillColor: COLORS.sle, fillOpacity: on ? 0.3 : 0.08, opacity: on ? 1 : 0.4 };
    case "infra":
      if (p.kind === "transmission") return { color: COLORS.transmission, weight: on ? 5 : 3, dashArray: "8 6", opacity: on ? 1 : 0.4 };
      if (p.kind === "main6") return { color: COLORS.main6, weight: on ? 6 : 3, opacity: on ? 1 : 0.45 };
      return {};
    case "proposed":
      if (p.kind === "bore") return { color: COLORS.proposed, weight: on ? 6 : 3, dashArray: "3 7", opacity: on ? 1 : 0.5 };
      if (p.kind === "trench" || p.kind === "hlb_easement") return { color: COLORS.proposed, weight: on ? 6 : 3, opacity: on ? 1 : 0.5 };
      if (p.kind === "tce") return { color: COLORS.proposed, weight: 1, fillColor: COLORS.proposed, fillOpacity: on ? 0.5 : 0.2, opacity: on ? 1 : 0.5 };
      return {};
    case "replaced":
      return { color: on ? "#f1f3f5" : "#868e96", weight: on ? 4 : 2, dashArray: "4 6", opacity: on ? 1 : 0.5 };
  }
  return {};
}

function pointLayer(f, latlng) {
  const k = f.properties.kind;
  const opts = {
    regulator: { radius: 8, color: "#fff", weight: 2, fillColor: COLORS.main6, fillOpacity: 1 },
    strike: { radius: 9, color: "#fff", weight: 2, fillColor: "#e03131", fillOpacity: 1 },
    break: { radius: 9, color: "#fff", weight: 2, fillColor: "#e03131", fillOpacity: 1 },
    tie: { radius: 6, color: "#fff", weight: 2, fillColor: COLORS.proposed, fillOpacity: 1 },
  }[k] || { radius: 5 };
  return L.circleMarker(latlng, opts);
}

function popupHtml(p) {
  if (p.layer === "parcel") {
    const rows = [
      ["Owner", p.owner],
      ["Address", p.address],
      ["Legal", p.legal],
      ["Land use", p.land_use],
      ["Area", `${p.acres} acres`],
      ["Parcel", p.url ? `<a href="${p.url}" target="_blank" rel="noopener">${p.parcel_id}</a>` : p.parcel_id],
    ].filter(([, v]) => v);
    const head = p.hlb_6_062 ? "<b>HLB Parcel 6-062</b> (Res. 2026-11)<br>" : "";
    return head + rows.map(([k, v]) => `<b>${k}:</b> ${v}`).join("<br>");
  }
  return p.name ? `<b>${p.name}</b>` : "";
}

async function init() {
  const el = document.getElementById("map");
  if (!el) return;
  const legend = document.querySelector(".map-legend");
  if (legend && window.matchMedia("(max-width: 899px)").matches) legend.open = false;
  const map = L.map(el, { zoomControl: true, scrollWheelZoom: false, attributionControl: true });
  const imagery = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 19,
    attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
  });
  const streets = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors",
  });
  imagery.addTo(map);
  L.control.layers({ Satellite: imagery, Streets: streets }, null, { position: "topright" }).addTo(map);

  const data = await fetch("/data/map.geojson").then((r) => r.json());
  const byKey = new Map();
  const layers = [];
  const order = ["parcel", "sle", "street", "stream", "infra", "proposed"];
  const sorted = [...data.features].sort((a, b) => order.indexOf(a.properties.layer) - order.indexOf(b.properties.layer));
  const HOVER = { color: "#ffd43b", weight: 3, opacity: 1, fillOpacity: 0.45 };
  const SELECTED = { color: "#fff200", weight: 4, opacity: 1, fillOpacity: 0.55 };
  let selected = null;
  for (const f of sorted) {
    const lyr = L.geoJSON(f, { style: (ft) => baseStyle(ft, false), pointToLayer: pointLayer });
    const entry = { f, lyr, keys: featureKeys(f), on: false };
    lyr.eachLayer((l) => {
      const html = popupHtml(f.properties);
      if (html) l.bindPopup(html, { maxWidth: 280 });
      if (f.properties.layer === "parcel") {
        const tip = f.properties.hlb_6_062 ? `HLB Parcel 6-062 · ${f.properties.owner}` : f.properties.owner;
        if (tip) l.bindTooltip(tip, { sticky: true, className: "parcel-tip" });
        l.on("mouseover", () => { if (l !== selected) l.setStyle(HOVER); });
        l.on("mouseout", () => { if (l !== selected) l.setStyle(baseStyle(f, entry.on)); });
        l.on("popupopen", () => {
          const prev = selected;
          selected = l;
          if (prev && prev !== l) prev.fire("restyle");
          l.setStyle(SELECTED);
          l.closeTooltip();
        });
        l.on("popupclose", () => {
          if (selected === l) selected = null;
          l.setStyle(baseStyle(f, entry.on));
        });
        l.on("restyle", () => l.setStyle(baseStyle(f, entry.on)));
        l.on("tooltipopen", () => { if (l === selected) l.closeTooltip(); });
      } else if (f.properties.name) {
        l.bindTooltip(f.properties.name, { sticky: true });
      }
    });
    lyr.addTo(map);
    layers.push(entry);
    for (const k of entry.keys) {
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(entry);
    }
  }
  // A frame around the east end of the route, for the neighbors view
  const tieEast = layers.find((e) => e.f.properties.kind === "tie" && /Virgin Creek/.test(e.f.properties.name));
  if (tieEast) {
    const ll = tieEast.lyr.getLayers()[0].getLatLng();
    byKey.set("neighbors", [{ lyr: { getBounds: () => ll.toBounds(360) } }]);
  }

  const caption = document.getElementById("map-caption");
  let current = null;

  // Where to pin a label for a key: a point, the middle of the longest line, or a polygon's center.
  function anchor(key) {
    let best = null;
    let bestLen = -1;
    let pointFallback = null;
    for (const e of byKey.get(key) || []) {
      if (!e.f) continue;
      const g = e.f.geometry;
      if (g.type === "Point") {
        pointFallback ??= L.latLng(g.coordinates[1], g.coordinates[0]);
        continue;
      }
      const lines = g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : null;
      if (lines) {
        for (const c of lines) {
          if (c.length > bestLen) {
            bestLen = c.length;
            const m = c[Math.floor(c.length / 2)];
            best = L.latLng(m[1], m[0]);
          }
        }
      } else {
        const b = e.lyr.getBounds();
        const size = b.getNorthEast().distanceTo(b.getSouthWest());
        if (size > bestLen) {
          bestLen = size;
          best = b.getCenter();
        }
      }
    }
    return best ?? pointFallback;
  }

  const labelGroup = L.layerGroup().addTo(map);
  function setLabels(list) {
    labelGroup.clearLayers();
    for (const [key, text, dir] of list || []) {
      const ll = anchor(key);
      if (!ll) continue;
      L.tooltip({ permanent: true, direction: dir || (key.startsWith("hlb") ? "center" : "right"), className: "map-label", offset: [0, 0], interactive: false })
        .setLatLng(ll)
        .setContent(text)
        .addTo(labelGroup);
    }
  }

  function emphasize(hlKeys) {
    const hl = new Set(hlKeys);
    for (const e of layers) {
      const on = e.keys.some((k) => hl.has(k));
      e.on = on;
      e.lyr.eachLayer((l) => {
        if (l === selected) return;
        if (l.setStyle && e.f.geometry.type !== "Point") l.setStyle(baseStyle(e.f, on));
        if (e.f.geometry.type === "Point") l.setStyle({ fillOpacity: on ? 1 : 0.3, opacity: on ? 1 : 0.3 });
      });
      if (on) e.lyr.bringToFront();
    }
  }

  function show(name) {
    const v = VIEWS[name] || VIEWS.system;
    if (name === current) return;
    current = name;
    emphasize(v.hl);
    setLabels(v.labels);
    let bounds = null;
    for (const k of v.frame) {
      for (const e of byKey.get(k) || []) {
        const b = e.lyr.getBounds ? e.lyr.getBounds() : L.latLngBounds([e.lyr.getLatLng()]);
        bounds = bounds ? bounds.extend(b) : L.latLngBounds(b.getSouthWest(), b.getNorthEast());
      }
    }
    if (bounds) {
      if (v.zoom) map.flyTo(bounds.getCenter(), v.zoom, { duration: 0.8 });
      else map.flyToBounds(bounds.pad(v.pad ?? 0.15), { duration: 0.8, maxZoom: 17 });
    }
    if (caption) caption.textContent = v.title;
  }

  // Scrollytelling: the [data-map] element under the trigger line picks the view.
  const steps = [...document.querySelectorAll("[data-map]")];
  let activeEl = null;
  function onScroll() {
    const mobile = window.matchMedia("(max-width: 899px)").matches;
    const trigger = mobile ? el.getBoundingClientRect().bottom + 60 : window.innerHeight * 0.4;
    let pick = null;
    for (const s of steps) {
      const r = s.getBoundingClientRect();
      if (r.height === 0) continue;
      if (r.top <= trigger) pick = s;
      else break;
    }
    if (pick !== activeEl) {
      activeEl?.classList.remove("map-active");
      pick?.classList.add("map-active");
      activeEl = pick;
    }
    show(pick ? pick.dataset.map : "system");
  }
  let ticking = false;
  window.addEventListener("scroll", () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        onScroll();
      });
    }
  }, { passive: true });
  document.querySelectorAll("details").forEach((d) => d.addEventListener("toggle", onScroll));
  // Terms in the text marked <span class="term" data-hl="key" data-label="...">: hover or tap to spotlight on the map.
  for (const t of document.querySelectorAll(".term[data-hl]")) {
    const keys = t.dataset.hl.split(" ");
    const enter = () => {
      emphasize(keys);
      setLabels(keys.map((k) => [k, t.dataset.label || t.textContent]));
    };
    const leave = () => {
      const v = VIEWS[current] || VIEWS.system;
      emphasize(v.hl);
      setLabels(v.labels);
    };
    t.addEventListener("mouseenter", enter);
    t.addEventListener("mouseleave", leave);
    t.addEventListener("focus", enter);
    t.addEventListener("blur", leave);
    t.tabIndex = 0;
  }

  map.fitBounds(L.latLngBounds([60.938, -149.18], [60.972, -149.10]));
  onScroll();
  setTimeout(() => map.invalidateSize(), 200);
}

init();
