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
  system: { title: "Today: one feed into the valley", hl: ["transmission", "main6", "regulator", "proposed"], frame: ["main6", "regulator", "proposed"] },
  transmission: { title: "The line from Anchorage also feeds Whittier", hl: ["transmission", "main6", "regulator"], frame: ["transmission"] },
  main: { title: "The existing 6-inch main along the Alyeska Highway", hl: ["main6", "regulator", "strike"], frame: ["main6"] },
  strike: { title: "2016: contractor hits the main near 1127 Alyeska Hwy", hl: ["main6", "strike"], frame: ["strike"], zoom: 16 },
  ruane: { title: "Ruane Road: regulator station and 2021 washout", hl: ["main6", "regulator", "street:Ruane Rd"], frame: ["street:Ruane Rd", "regulator"], pad: 0.6 },
  sle: { title: "The state section-line easement (100 ft wide)", hl: ["sle", "proposed"], frame: ["sle"] },
  route: { title: "The 2023 route: Ruane Rd to Virgin Creek Rd", hl: ["proposed", "sle", "tie"], frame: ["proposed"] },
  glacier: { title: "Drilled under Glacier Creek (~1,500 ft)", hl: ["bore", "stream", "tie"], frame: ["bore"], pad: 0.4 },
  trench: { title: "Trenched and cleared (~3,350 ft × 20 ft)", hl: ["trench", "sle"], frame: ["trench"] },
  hlb: { title: "HLB Parcel 6-062 (Tract 20-A): the Res. 2026-11 easement", hl: ["hlb_6_062", "proposed", "sle", "tie"], frame: ["hlb_6_062"] },
  neighbors: { title: "The east end: Virgin Creek Rd and Timberline Dr", hl: ["private", "tie", "trench", "street:Virgin Creek Rd", "street:Timberline Dr"], frame: ["neighbors"] },
  traffic: { title: "Construction access: Ruane Rd (west) and Virgin Creek Rd (east)", hl: ["street:Ruane Rd", "street:Virgin Creek Rd", "street:Timberline Dr", "proposed"], frame: ["proposed", "street:Virgin Creek Rd"] },
  owners: { title: "Who owns the land", hl: ["hlb", "muni", "public", "private", "proposed"], frame: ["proposed"], pad: 0.5 },
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
      if (p.kind === "trench") return { color: COLORS.proposed, weight: on ? 6 : 3, opacity: on ? 1 : 0.5 };
      return {};
  }
  return {};
}

function pointLayer(f, latlng) {
  const k = f.properties.kind;
  const opts = {
    regulator: { radius: 8, color: "#fff", weight: 2, fillColor: COLORS.main6, fillOpacity: 1 },
    strike: { radius: 9, color: "#fff", weight: 2, fillColor: "#e03131", fillOpacity: 1 },
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
  for (const f of sorted) {
    const lyr = L.geoJSON(f, { style: (ft) => baseStyle(ft, false), pointToLayer: pointLayer });
    lyr.eachLayer((l) => {
      const html = popupHtml(f.properties);
      if (html) l.bindPopup(html, { maxWidth: 280 });
      if (f.properties.layer !== "parcel" && f.properties.name) l.bindTooltip(f.properties.name, { sticky: true });
    });
    lyr.addTo(map);
    const entry = { f, lyr, keys: featureKeys(f) };
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

  function show(name) {
    const v = VIEWS[name] || VIEWS.system;
    if (name === current) return;
    current = name;
    const hl = new Set(v.hl);
    for (const e of layers) {
      const on = e.keys.some((k) => hl.has(k));
      e.lyr.eachLayer((l) => {
        if (l.setStyle && e.f.geometry.type !== "Point") l.setStyle(baseStyle(e.f, on));
        if (e.f.geometry.type === "Point") l.setStyle({ fillOpacity: on ? 1 : 0.3, opacity: on ? 1 : 0.3 });
      });
      if (on) e.lyr.bringToFront();
    }
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
  map.fitBounds(L.latLngBounds([60.938, -149.18], [60.972, -149.10]));
  onScroll();
  setTimeout(() => map.invalidateSize(), 200);
}

init();
