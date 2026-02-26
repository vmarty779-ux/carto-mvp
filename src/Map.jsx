import { useEffect, useMemo, useState } from 'react'
import { GeoJSON, MapContainer, TileLayer, useMap, CircleMarker, Tooltip } from 'react-leaflet'
import L from 'leaflet'

/**
 * -------------------------
 * CSV
 * -------------------------
 */
function parseCsv(csvText) {
  const lines = csvText.trim().split('\n').filter(Boolean)
  if (lines.length < 2) return { header: [], rows: [] }

  const sep = lines[0].includes(';') ? ';' : ','
  const header = lines[0]
    .replace(/^\uFEFF/, '') // anti-BOM
    .split(sep)
    .map((h) => h.trim())

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map((c) => c.trim())
    const row = {}
    for (let j = 0; j < header.length; j++) row[header[j]] = cols[j] ?? ''
    rows.push(row)
  }

  return { header, rows }
}

function buildValuesMap({ csvText, year, indicator }) {
  const { header, rows } = parseCsv(csvText)

  const required = ['geo_id', 'annee']
  for (const k of required) {
    if (!header.includes(k)) throw new Error(`CSV invalide: colonne manquante "${k}"`)
  }
  if (!header.includes(indicator)) {
    throw new Error(`CSV invalide: colonne indicateur introuvable "${indicator}"`)
  }

  const map = new globalThis.Map()
  for (const r of rows) {
    if (String(r.annee) !== String(year)) continue
    const id = String(r.geo_id)
    const raw = r[indicator]
    const val = raw === '' ? null : Number(raw)
    map.set(id, Number.isFinite(val) ? val : null)
  }
  return map
}

/**
 * -------------------------
 * Geo feature helpers
 * -------------------------
 */
function getFeatureId(feature) {
  return String(
    feature?.properties?.geo_id ??
      feature?.properties?.code_insee ?? // IGN
      feature?.properties?.code ?? // autres sources
      feature?.properties?.insee_com ?? // autre cas
      ''
  )
}

function getFeatureName(feature, fallback) {
  return feature?.properties?.nom_officiel ?? feature?.properties?.nom ?? fallback ?? 'Zone'
}

function getIndicatorLabel(indicator) {
  if (indicator === 'csp_plus') return 'CSP+'
  if (indicator === 'revenu') return 'Revenu médian'
  if (indicator === 'densite') return 'Densité'

  if (indicator === 'mm_15p') return '15 ans et + (volume)'
  if (indicator === 'mm_25_49') return '25–49 ans (volume)'
  if (indicator === 'mm_15_34') return '15–34 ans (volume)'
  if (indicator === 'mm_50p') return '50 ans et + (volume)'
  if (indicator === 'mm_cspp') return 'CSP+ (volume)'
  if (indicator === 'mm_femmes') return 'Femmes (volume)'

  if (indicator === 'part_cspp') return 'Part CSP+'
  if (indicator === 'part_25_49') return 'Part 25–49 ans'
  if (indicator === 'part_15_34') return 'Part 15–34 ans'
  if (indicator === 'part_50p') return 'Part 50 ans et +'

  return indicator
}

function getScaleLabel(scale) {
  if (scale === 'region') return 'Région'
  if (scale === 'departement') return 'Département'
  return 'Commune'
}

function getGeoPath(scale) {
  return scale === 'region'
    ? '/data/regions.geojson'
    : scale === 'departement'
    ? '/data/departements.geojson'
    : '/data/communes.geojson'
}

function getCsvPath(scale) {
  return `/data/data_${scale}.csv`
}

/**
 * -------------------------
 * Choropleth 5 classes (quantiles)
 * -------------------------
 */

// 5 classes => 4 seuils
function computeQuantileBreaks(values, classes = 5) {
  const arr = values
    .filter((v) => v != null && Number.isFinite(v))
    .slice()
    .sort((a, b) => a - b)

  if (arr.length === 0) return null
  if (arr.length < classes) {
    // pas assez de valeurs -> on fait des seuils simples basés sur min/max
    const min = arr[0]
    const max = arr[arr.length - 1]
    if (min === max) return { breaks: [min, min, min, min], min, max, mode: 'flat' }
    const step = (max - min) / classes
    const breaks = [min + step, min + step * 2, min + step * 3, min + step * 4]
    return { breaks, min, max, mode: 'linear' }
  }

  const q = (p) => {
    const idx = (arr.length - 1) * p
    const lo = Math.floor(idx)
    const hi = Math.ceil(idx)
    if (lo === hi) return arr[lo]
    const t = idx - lo
    return arr[lo] * (1 - t) + arr[hi] * t
  }

  const b1 = q(1 / classes)
  const b2 = q(2 / classes)
  const b3 = q(3 / classes)
  const b4 = q(4 / classes)

  return { breaks: [b1, b2, b3, b4], min: arr[0], max: arr[arr.length - 1], mode: 'quantile' }
}

// Palette 5 classes (du faible au fort)
const CHORO_COLORS_5 = ['#1a9850', '#66bd63', '#fee08b', '#f46d43', '#d73027']
// index: 0..4

function getChoroplethColor(value, breaksInfo) {
  if (value == null || !Number.isFinite(value) || !breaksInfo) return '#cccccc'
  const [b1, b2, b3, b4] = breaksInfo.breaks
  if (value <= b1) return CHORO_COLORS_5[0]
  if (value <= b2) return CHORO_COLORS_5[1]
  if (value <= b3) return CHORO_COLORS_5[2]
  if (value <= b4) return CHORO_COLORS_5[3]
  return CHORO_COLORS_5[4]
}

function formatValue(indicator, v) {
  if (v == null || !Number.isFinite(v)) return 'n/a'
  if (indicator.startsWith('part_')) return `${v.toFixed(1)}%`
  if (indicator === 'revenu') return `${Math.round(v).toLocaleString('fr-FR')} €`
  if (indicator === 'densite') return `${Math.round(v).toLocaleString('fr-FR')}`
  // volumes / autres
  return `${Math.round(v).toLocaleString('fr-FR')}`
}

function formatLegendRange(indicator, from, to) {
  if (from == null && to == null) return 'n/a'
  if (from == null) return `≤ ${formatValue(indicator, to)}`
  if (to == null) return `> ${formatValue(indicator, from)}`
  return `${formatValue(indicator, from)} – ${formatValue(indicator, to)}`
}

/**
 * -------------------------
 * Circles centroid + radius normalization
 * -------------------------
 */
function getFeatureCentroidLatLng(feature) {
  try {
    const center = L.geoJSON(feature).getBounds().getCenter()
    return [center.lat, center.lng]
  } catch {
    return null
  }
}

function getMinMaxForIndicator(geoData, valuesById) {
  const features = geoData?.features || []
  let min = Infinity
  let max = -Infinity

  for (const f of features) {
    const id = getFeatureId(f)
    const v = valuesById.get(id)
    if (v == null || !Number.isFinite(v)) continue
    if (v < min) min = v
    if (v > max) max = v
  }

  if (min === Infinity || max === -Infinity) return { min: null, max: null }
  return { min, max }
}

function getCircleRadiusFromMinMax(value, min, max) {
  if (value == null || !Number.isFinite(value) || value <= 0) return 0

  const minR = 6
  const maxR = 28

  if (min == null || max == null || min === max) return (minR + maxR) / 2

  const t = (value - min) / (max - min)
  const curved = Math.sqrt(Math.max(0, Math.min(1, t))) // sqrt = mieux visuellement
  return minR + curved * (maxR - minR)
}

/**
 * -------------------------
 * Legend (dynamic)
 * -------------------------
 */
function Legend({ title, breaksInfo, indicator }) {
  const items = useMemo(() => {
    if (!breaksInfo) {
      return [
        { color: '#cccccc', label: 'n/a' },
      ]
    }

    const [b1, b2, b3, b4] = breaksInfo.breaks
    return [
      { color: CHORO_COLORS_5[4], label: formatLegendRange(indicator, b4, null) },
      { color: CHORO_COLORS_5[3], label: formatLegendRange(indicator, b3, b4) },
      { color: CHORO_COLORS_5[2], label: formatLegendRange(indicator, b2, b3) },
      { color: CHORO_COLORS_5[1], label: formatLegendRange(indicator, b1, b2) },
      { color: CHORO_COLORS_5[0], label: formatLegendRange(indicator, null, b1) },
      { color: '#cccccc', label: 'n/a' },
    ]
  }, [breaksInfo, indicator])

  return (
    <div style={legendStyles.box}>
      <div style={legendStyles.title}>{title}</div>

      {items.map((it, idx) => (
        <div key={idx} style={legendStyles.row}>
          <span style={{ ...legendStyles.swatch, background: it.color }} />
          <span>{it.label}</span>
        </div>
      ))}
    </div>
  )
}

const legendStyles = {
  box: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    zIndex: 1000,
    background: 'rgba(255,255,255,0.95)',
    border: '1px solid #e5e5e5',
    borderRadius: 8,
    padding: 10,
    boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
    fontSize: 13,
    lineHeight: 1.2,
    maxWidth: 300,
  },
  title: { fontWeight: 700, marginBottom: 8 },
  row: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 3,
    border: '1px solid rgba(0,0,0,0.2)',
    flex: '0 0 auto',
  },
}

/**
 * -------------------------
 * FitBounds
 * -------------------------
 */
function FitBounds({ geoData }) {
  const map = useMap()

  useEffect(() => {
    if (!geoData) return
    try {
      const layer = L.geoJSON(geoData)
      const bounds = layer.getBounds()
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20] })
    } catch (e) {
      console.error('fitBounds error:', e)
    }
  }, [geoData, map])

  return null
}

/**
 * -------------------------
 * Component
 * -------------------------
 */
export default function MapView({ scale, indicator, year, renderMode }) {
  const [geoData, setGeoData] = useState(null)
  const [csvText, setCsvText] = useState('')
  const [valuesById, setValuesById] = useState(() => new globalThis.Map())
  const [errorMsg, setErrorMsg] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // 1) Charger GeoJSON + CSV à chaque changement d’échelle
  useEffect(() => {
    async function loadScaleAssets() {
      setErrorMsg('')
      setIsLoading(true)

      const geoPath = getGeoPath(scale)
      const csvPath = getCsvPath(scale)

      try {
        const geoRes = await fetch(geoPath)
        if (!geoRes.ok) throw new Error(`GeoJSON introuvable: ${geoPath} (${geoRes.status})`)
        const geoJson = await geoRes.json()

        const csvRes = await fetch(csvPath)
        if (!csvRes.ok) throw new Error(`CSV introuvable: ${csvPath} (${csvRes.status})`)
        const text = await csvRes.text()

        setGeoData(geoJson)
        setCsvText(text)
      } catch (err) {
        console.error(err)
        setErrorMsg(String(err.message || err))
        setGeoData(null)
        setCsvText('')
        setValuesById(new globalThis.Map())
      } finally {
        setIsLoading(false)
      }
    }

    setGeoData(null)
    setCsvText('')
    setValuesById(new globalThis.Map())
    loadScaleAssets()
  }, [scale])

  // 2) Recalculer les valeurs quand csv/année/indicateur change
  useEffect(() => {
    if (!csvText) return
    try {
      const map = buildValuesMap({ csvText, year, indicator })
      setValuesById(map)
    } catch (err) {
      console.error(err)
      setErrorMsg(String(err.message || err))
      setValuesById(new globalThis.Map())
    }
  }, [csvText, year, indicator])

  // 3) Calcul des seuils 5 classes à partir des valeurs réellement présentes
  const breaksInfo = useMemo(() => {
    if (!geoData) return null
    const vals = []
    for (const f of geoData.features || []) {
      const id = getFeatureId(f)
      const v = valuesById.get(id)
      if (v == null || !Number.isFinite(v)) continue
      vals.push(v)
    }
    return computeQuantileBreaks(vals, 5)
  }, [geoData, valuesById, indicator]) // indicator change => on recalc sur les valeurs de l'indicateur

  const choroplethLayer = useMemo(() => {
    if (!geoData) return null

    return (
      <GeoJSON
        key={`${scale}-choropleth-${indicator}-${year}`}
        data={geoData}
        style={(feature) => {
          const id = getFeatureId(feature)
          const value = valuesById.get(id)
          return {
            fillColor: getChoroplethColor(value, breaksInfo),
            weight: 1,
            color: '#555555',
            fillOpacity: 0.65,
          }
        }}
        onEachFeature={(feature, leafletLayer) => {
          const id = getFeatureId(feature)
          const nom = getFeatureName(feature, getScaleLabel(scale))
          const value = valuesById.get(id)

          const label = `${nom} (${id})\n${getIndicatorLabel(indicator)} : ${formatValue(
            indicator,
            value
          )}`

          leafletLayer.bindTooltip(label, { sticky: true })
        }}
      />
    )
  }, [geoData, valuesById, indicator, scale, year, breaksInfo])

  const circlesLayer = useMemo(() => {
    if (!geoData) return null

    const features = geoData.features || []
    const { min, max } = getMinMaxForIndicator(geoData, valuesById)

    return (
      <>
        {features.map((feature, idx) => {
          const id = getFeatureId(feature)
          const nom = getFeatureName(feature, getScaleLabel(scale))
          const value = valuesById.get(id)

          const latlng = getFeatureCentroidLatLng(feature)
          if (!latlng) return null

          const radius = getCircleRadiusFromMinMax(value, min, max)
          if (radius <= 0) return null

          return (
            <CircleMarker
              key={`${scale}-circle-${indicator}-${year}-${id}-${idx}`}
              center={latlng}
              radius={radius}
              pathOptions={{
                color: '#333333',
                weight: 1,
                fillOpacity: 0.6,
                fillColor: getChoroplethColor(value, breaksInfo),
              }}
            >
              <Tooltip sticky>
                <div>
                  <div>
                    <strong>{nom}</strong> ({id})
                  </div>
                  <div>
                    {getIndicatorLabel(indicator)} : {formatValue(indicator, value)}
                  </div>
                </div>
              </Tooltip>
            </CircleMarker>
          )
        })}
      </>
    )
  }, [geoData, valuesById, indicator, scale, year, breaksInfo])

  const legendTitle = `${getIndicatorLabel(indicator)} — ${year} — ${getScaleLabel(scale)}`

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      <MapContainer center={[46.6, 2.5]} zoom={6} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {geoData && <FitBounds geoData={geoData} />}

        {renderMode === 'choropleth' ? choroplethLayer : circlesLayer}
      </MapContainer>

      <Legend title={legendTitle} breaksInfo={breaksInfo} indicator={indicator} />

      {isLoading && (
        <div
          style={{
            position: 'absolute',
            left: 12,
            top: 12,
            zIndex: 1000,
            background: 'rgba(255,255,255,0.92)',
            border: '1px solid #e5e5e5',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 13,
          }}
        >
          Chargement…
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            position: 'absolute',
            left: 12,
            bottom: 12,
            zIndex: 1000,
            background: 'rgba(255,255,255,0.95)',
            border: '1px solid #f3c2c2',
            color: '#8a1f1f',
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
  )
}