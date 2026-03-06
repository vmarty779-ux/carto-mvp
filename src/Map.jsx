import { useEffect, useMemo, useState } from "react";
import { CircleMarker, GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";

/**
 * Parse un CSV (séparateur ; ou ,) et retourne:
 * - header: string[]
 * - rows: Array<Record<string,string>>
 */
function parseCsv(csvText) {
  const lines = csvText.trim().split("\n").filter(Boolean);
  if (lines.length < 2) return { header: [], rows: [] };

  const sep = lines[0].includes(";") ? ";" : ",";
  const header = lines[0]
    .replace(/^\uFEFF/, "")
    .split(sep)
    .map((h) => h.trim());

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map((c) => c.trim());
    const row = {};
    for (let j = 0; j < header.length; j++) row[header[j]] = cols[j] ?? "";
    rows.push(row);
  }

  return { header, rows };
}

/**
 * Construit une Map<geo_id, valeur> à partir d'un CSV multi-indicateurs + multi-années
 * Format attendu: geo_id,annee,indicateurs...
 */
function buildValuesMap({ csvText, year, indicator }) {
  const { header, rows } = parseCsv(csvText);

  const required = ["geo_id", "annee"];
  for (const k of required) {
    if (!header.includes(k)) {
      throw new Error(`CSV invalide: colonne manquante "${k}"`);
    }
  }
  if (!header.includes(indicator)) {
    throw new Error(`CSV invalide: colonne indicateur introuvable "${indicator}"`);
  }

  const map = new globalThis.Map();
  for (const r of rows) {
    if (String(r.annee) !== String(year)) continue;
    const id = r.geo_id;
    const raw = r[indicator];
    const val = raw === "" ? null : Number(raw);
    map.set(id, Number.isFinite(val) ? val : null);
  }
  return map;
}

function getIndicatorLabel(indicator) {
  const dict = {
    csp_plus: "CSP+",
    revenu: "Revenu médian",
    densite: "Densité",
    part_cspp: "Part CSP+",
    part_25_49: "Part 25–49 ans",
    part_15_34: "Part 15–34 ans",
    part_50p: "Part 50 ans et +",
    mm_cspp: "CSP+ (volume)",
    mm_25_49: "25–49 ans (volume)",
    mm_15_34: "15–34 ans (volume)",
    mm_50p: "50 ans et + (volume)",
    mm_femmes: "Femmes (volume)",
    mm_15p: "15 ans et + (volume)",
  };
  return dict[indicator] || indicator;
}

function getScaleLabel(scale) {
  if (scale === "region") return "Région";
  if (scale === "departement") return "Département";
  return "Commune";
}

// Couleurs simples (tu pourras passer en quantiles / 5 classes plus tard)
function getFillColor(indicator, value) {
  if (value == null) return "#cccccc";

  // Part (%) : rouge = élevé
  if (indicator.startsWith("part_") || indicator === "csp_plus") {
    if (value >= 35) return "#d73027";
    if (value >= 25) return "#fee08b";
    return "#1a9850";
  }

  // Densité / revenu : règles simples par seuils
  if (indicator === "revenu") {
    if (value >= 35000) return "#d73027";
    if (value >= 30000) return "#fee08b";
    return "#1a9850";
  }
  if (indicator === "densite") {
    if (value >= 10000) return "#d73027";
    if (value >= 5000) return "#fee08b";
    return "#1a9850";
  }

  // Volumes : rouge = élevé
  if (indicator.startsWith("mm_")) {
    // seuils génériques (à affiner selon tes distributions)
    if (value >= 300000) return "#d73027";
    if (value >= 150000) return "#fee08b";
    return "#1a9850";
  }

  return "#cccccc";
}

function getFeatureId(feature) {
  // Robustesse : selon tes fichiers (geo_id ou code_insee)
  return feature?.properties?.geo_id ?? feature?.properties?.code_insee ?? null;
}

function getFeatureName(feature) {
  return (
    feature?.properties?.nom ??
    feature?.properties?.nom_officiel ??
    feature?.properties?.nom_officiel_en_majuscules ??
    ""
  );
}

function Legend({ title }) {
  return (
    <div style={legendStyles.box}>
      <div style={legendStyles.title}>{title}</div>

      <div style={legendStyles.row}>
        <span style={{ ...legendStyles.swatch, background: "#d73027" }} />
        <span>Élevé</span>
      </div>
      <div style={legendStyles.row}>
        <span style={{ ...legendStyles.swatch, background: "#fee08b" }} />
        <span>Moyen</span>
      </div>
      <div style={legendStyles.row}>
        <span style={{ ...legendStyles.swatch, background: "#1a9850" }} />
        <span>Faible</span>
      </div>
      <div style={legendStyles.row}>
        <span style={{ ...legendStyles.swatch, background: "#cccccc" }} />
        <span>n/a</span>
      </div>
    </div>
  );
}

const legendStyles = {
  box: {
    position: "absolute",
    right: 12,
    bottom: 12,
    zIndex: 1000,
    background: "rgba(255,255,255,0.95)",
    border: "1px solid #e5e5e5",
    borderRadius: 8,
    padding: 10,
    boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
    fontSize: 13,
    lineHeight: 1.2,
    maxWidth: 280,
  },
  title: { fontWeight: 700, marginBottom: 8 },
  row: { display: "flex", alignItems: "center", gap: 8, marginTop: 6 },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 3,
    border: "1px solid rgba(0,0,0,0.2)",
    flex: "0 0 auto",
  },
};

function FitBounds({ geoData }) {
  const map = useMap();

  useEffect(() => {
    if (!geoData) return;
    try {
      const layer = L.geoJSON(geoData);
      const bounds = layer.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20] });
    } catch (e) {
      console.error("fitBounds error:", e);
    }
  }, [geoData, map]);

  return null;
}

function computeCentroidLatLng(feature) {
  try {
    const layer = L.geoJSON(feature);
    const center = layer.getBounds().getCenter();
    return [center.lat, center.lng];
  } catch {
    return null;
  }
}

function computeCircleRadius(value) {
  // règle simple : sqrt pour éviter des cercles énormes
  if (value == null || !Number.isFinite(value)) return 4;
  const v = Math.max(0, value);
  const r = Math.sqrt(v) / 80; // ajuste si besoin
  return Math.max(4, Math.min(28, r));
}

export default function MapView({ scale, indicator, year, renderMode, onExportRows }) {
  const [geoData, setGeoData] = useState(null);
  const [valuesById, setValuesById] = useState(() => new globalThis.Map());
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function load() {
      setErrorMsg("");
      setGeoData(null);

      const geoPath =
        scale === "region"
          ? "/data/regions.geojson"
          : scale === "departement"
          ? "/data/departements.geojson"
          : "/data/communes.geojson";

      const csvPath = `/data/data_${scale}.csv`;

      const geoRes = await fetch(geoPath);
      if (!geoRes.ok) throw new Error(`GeoJSON introuvable: ${geoPath} (${geoRes.status})`);
      const geoJson = await geoRes.json();

      const csvRes = await fetch(csvPath);
      if (!csvRes.ok) throw new Error(`CSV introuvable: ${csvPath} (${csvRes.status})`);
      const csvText = await csvRes.text();

      const map = buildValuesMap({ csvText, year, indicator });

      setGeoData(geoJson);
      setValuesById(map);

      // ✅ Remonter les lignes exportables
      const rows = (geoJson.features || []).map((f) => {
        const id = getFeatureId(f);
        const nom = getFeatureName(f) || getScaleLabel(scale);
        const valeur = id ? map.get(String(id)) ?? map.get(id) : null;
        return { geo_id: id ?? "", nom, valeur: valeur ?? null };
      });

      onExportRows?.(rows);
    }

    load().catch((err) => {
      console.error(err);
      setErrorMsg(String(err.message || err));
      setGeoData(null);
      setValuesById(new globalThis.Map());
      onExportRows?.([]);
    });
  }, [scale, indicator, year, onExportRows]);

  const layer = useMemo(() => {
    if (!geoData) return null;

    if (renderMode === "circles") {
      // Cercles sur centroid
      return (geoData.features || [])
        .map((feature, idx) => {
          const id = getFeatureId(feature);
          const nom = getFeatureName(feature) || getScaleLabel(scale);

          const value = id != null ? valuesById.get(String(id)) ?? valuesById.get(id) : null;
          const center = computeCentroidLatLng(feature);
          if (!center) return null;

          const radius = computeCircleRadius(value);

          return (
            <CircleMarker
              key={`${scale}-c-${id ?? idx}`}
              center={center}
              radius={radius}
              pathOptions={{
                color: "#444",
                weight: 1,
                fillColor: getFillColor(indicator, value),
                fillOpacity: 0.65,
              }}
            >
              {/* tooltip */}
            </CircleMarker>
          );
        })
        .filter(Boolean);
    }

    // Choropleth (polygones)
    return (
      <GeoJSON
        key={`${scale}-${indicator}-${year}`}
        data={geoData}
        style={(feature) => {
          const id = getFeatureId(feature);
          const value = id != null ? valuesById.get(String(id)) ?? valuesById.get(id) : null;

          return {
            fillColor: getFillColor(indicator, value),
            weight: 1,
            color: "#555555",
            fillOpacity: 0.65,
          };
        }}
        onEachFeature={(feature, leafletLayer) => {
          const nom = getFeatureName(feature) || getScaleLabel(scale);
          const id = getFeatureId(feature);
          const value = id != null ? valuesById.get(String(id)) ?? valuesById.get(id) : null;

          const label =
            value == null
              ? `${nom} (${id ?? "?"})<br/>${getIndicatorLabel(indicator)} : n/a`
              : `${nom} (${id ?? "?"})<br/>${getIndicatorLabel(indicator)} : ${value}`;

          leafletLayer.bindTooltip(label, { sticky: true });
        }}
      />
    );
  }, [geoData, valuesById, indicator, scale, year, renderMode]);

  const legendTitle = `${getIndicatorLabel(indicator)} — ${year} — ${getScaleLabel(scale)}`;

  return (
    <div style={{ height: "100%", width: "100%", position: "relative" }}>
      <MapContainer center={[46.6, 2.5]} zoom={6} style={{ height: "100%", width: "100%" }}>
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {geoData && <FitBounds geoData={geoData} />}
        {layer}
      </MapContainer>

      <Legend title={legendTitle} />

      {errorMsg && (
        <div
          style={{
            position: "absolute",
            left: 12,
            bottom: 12,
            zIndex: 1000,
            background: "rgba(255,255,255,0.95)",
            border: "1px solid #f3c2c2",
            color: "#8a1f1f",
            borderRadius: 8,
            padding: 10,
            maxWidth: 520,
            fontSize: 13,
          }}
        >
          <strong>Erreur :</strong> {errorMsg}
        </div>
      )}
    </div>
  );
}