import { useEffect, useMemo, useState } from 'react'
import MapView from './Map.jsx'

export default function App() {
  const [scale, setScale] = useState('region') // region | departement | commune
  const [renderMode, setRenderMode] = useState('choropleth') // choropleth | circles
  const [indicator, setIndicator] = useState('part_cspp')
  const [year, setYear] = useState(2022)

  // ✅ Listes d'indicateurs filtrées selon le mode
  const INDICATORS_PARTS = useMemo(
    () => [
      { value: 'part_cspp', label: 'Part CSP+' },
      { value: 'part_25_49', label: 'Part 25–49 ans' },
      { value: 'part_15_34', label: 'Part 15–34 ans' },
      { value: 'part_50p', label: 'Part 50 ans et +' },
    ],
    []
  )

  const INDICATORS_VOLUMES = useMemo(
    () => [
      { value: 'mm_cspp', label: 'CSP+ (volume)' },
      { value: 'mm_25_49', label: '25–49 ans (volume)' },
      { value: 'mm_15_34', label: '15–34 ans (volume)' },
      { value: 'mm_50p', label: '50 ans et + (volume)' },
      { value: 'mm_femmes', label: 'Femmes (volume)' },
      { value: 'mm_15p', label: '15 ans et + (volume)' },
    ],
    []
  )

  const availableIndicators =
    renderMode === 'circles' ? INDICATORS_VOLUMES : INDICATORS_PARTS

  // ✅ Si on change de mode, on force un indicateur compatible (si besoin)
  useEffect(() => {
    const allowed = new Set(availableIndicators.map((i) => i.value))
    if (!allowed.has(indicator)) {
      setIndicator(availableIndicators[0]?.value ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderMode]) // on ne dépend volontairement pas de indicator pour éviter boucle

  return (
    <div style={styles.app}>
      {/* HEADER */}
      <header style={styles.header}>
        <div style={styles.logo}>GEOLEAN</div>

        <div style={styles.userCircle} title="Compte">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="white"
            aria-hidden="true"
          >
            <path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z" />
          </svg>
        </div>
      </header>

      {/* CONTENU */}
      <div style={styles.content}>
        <aside style={styles.sidebar}>
          <h3 style={{ margin: 0 }}>Paramètres</h3>

          <label style={styles.label}>
            Échelle
            <select style={styles.select} value={scale} onChange={(e) => setScale(e.target.value)}>
              <option value="region">Région</option>
              <option value="departement">Département</option>
              <option value="commune">Commune</option>
            </select>
          </label>

          <label style={styles.label}>
            Mode d’affichage
            <select
              style={styles.select}
              value={renderMode}
              onChange={(e) => setRenderMode(e.target.value)}
            >
              <option value="choropleth">Choroplèthe</option>
              <option value="circles">Cercles (centroid)</option>
            </select>
          </label>

          <label style={styles.label}>
            Indicateur
            <select
              style={styles.select}
              value={indicator}
              onChange={(e) => setIndicator(e.target.value)}
            >
              {availableIndicators.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.label}>
            Année
            <select
              style={styles.select}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              <option value={2022}>2022</option>
              <option value={2021}>2021</option>
            </select>
          </label>

          <div style={styles.hint}>
            {renderMode === 'choropleth'
              ? 'Choroplèthe : indicateurs en parts (%).'
              : 'Cercles : indicateurs en volumes (effectifs).'}
          </div>
        </aside>

        <main style={styles.mapContainer}>
          <MapView scale={scale} indicator={indicator} year={year} renderMode={renderMode} />
        </main>
      </div>
    </div>
  )
}

const styles = {
  app: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'system-ui, sans-serif',
  },

  header: {
    height: '60px',
    background: '#ffffff',
    borderBottom: '1px solid #e5e5e5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    flexShrink: 0,
  },

  logo: {
    fontFamily: 'Rubik, sans-serif',
    fontSize: '28px',
    fontWeight: 600,
    color: '#0b2c5f',
    letterSpacing: '1px',
  },

  userCircle: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: '#bdbdbd',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },

  content: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    minHeight: 0,
  },

  sidebar: {
    width: '300px',
    padding: '16px',
    borderRight: '1px solid #e5e5e5',
    background: '#fafafa',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    overflowY: 'auto',
  },

  label: {
    display: 'grid',
    gap: '6px',
    fontSize: '14px',
  },

  select: {
    padding: '8px',
    fontSize: '14px',
  },

  hint: {
    marginTop: 6,
    fontSize: 12,
    color: '#666',
    lineHeight: 1.35,
  },

  mapContainer: {
    flex: 1,
    height: '100%',
    minWidth: 0,
  },
}