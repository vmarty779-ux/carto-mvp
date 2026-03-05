import { useEffect, useMemo, useRef, useState } from "react";
import MapView from "./Map.jsx";

export default function App() {
  const [scale, setScale] = useState("region");
  const [renderMode, setRenderMode] = useState("choropleth");
  const [indicator, setIndicator] = useState("part_cspp");
  const [year, setYear] = useState(2022);

  // Geoly UI
  const [isGeolyHover, setIsGeolyHover] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0); // 0..3
  const [spotRect, setSpotRect] = useState(null);

  // Refs (IMPORTANT: on met les refs sur des wrappers div, pas sur <label>)
  const scaleRef = useRef(null);
  const modeRef = useRef(null);
  const indicatorRef = useRef(null);
  const yearRef = useRef(null);

  const INDICATORS_PARTS = useMemo(
    () => [
      { value: "part_cspp", label: "Part CSP+" },
      { value: "part_25_49", label: "Part 25–49 ans" },
      { value: "part_15_34", label: "Part 15–34 ans" },
      { value: "part_50p", label: "Part 50 ans et +" },
    ],
    []
  );

  const INDICATORS_VOLUMES = useMemo(
    () => [
      { value: "mm_cspp", label: "CSP+ (volume)" },
      { value: "mm_25_49", label: "25–49 ans (volume)" },
      { value: "mm_15_34", label: "15–34 ans (volume)" },
      { value: "mm_50p", label: "50 ans et + (volume)" },
      { value: "mm_femmes", label: "Femmes (volume)" },
      { value: "mm_15p", label: "15 ans et + (volume)" },
    ],
    []
  );

  const availableIndicators =
    renderMode === "circles" ? INDICATORS_VOLUMES : INDICATORS_PARTS;

  // Si on change de mode, forcer un indicateur compatible
  useEffect(() => {
    const allowed = new Set(availableIndicators.map((i) => i.value));
    if (!allowed.has(indicator)) {
      setIndicator(availableIndicators[0]?.value ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderMode]);

  function openTour() {
    setIsTourOpen(true);
    setTourStep(0);
  }

  function closeTour() {
    setIsTourOpen(false);
    setSpotRect(null);
  }

  function nextStep() {
    setTourStep((s) => Math.min(s + 1, 3));
  }

  function prevStep() {
    setTourStep((s) => Math.max(s - 1, 0));
  }

  function getStepText(step) {
    if (step === 0) return "Étape 1/4 : Choisis l’échelle (région, département, commune).";
    if (step === 1) return "Étape 2/4 : Choisis le mode d’affichage (choroplèthe ou cercles).";
    if (step === 2) return "Étape 3/4 : Choisis l’indicateur à représenter.";
    return "Étape 4/4 : Choisis l’année.";
  }

  function getStepTargetRef(step) {
    if (step === 0) return scaleRef;
    if (step === 1) return modeRef;
    if (step === 2) return indicatorRef;
    return yearRef;
  }

  // Recalcule le spotlight à chaque step + resize/scroll
  useEffect(() => {
    if (!isTourOpen) return;

    const update = () => {
      const el = getStepTargetRef(tourStep)?.current;
      if (!el) return;

      const r = el.getBoundingClientRect();
      const padding = 10;

      setSpotRect({
        x: Math.max(0, r.left - padding),
        y: Math.max(0, r.top - padding),
        w: r.width + padding * 2,
        h: r.height + padding * 2,
      });

      // Scroll dans la sidebar si besoin
      try {
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      } catch {}
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [isTourOpen, tourStep]);

  // ESC pour fermer, Enter pour avancer
  useEffect(() => {
    if (!isTourOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") closeTour();
      if (e.key === "Enter") {
        if (tourStep < 3) nextStep();
        else closeTour();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isTourOpen, tourStep]);

  // Positionne la carte du tutoriel près du spotlight (sans sortir de l'écran)
  const tourCardPos = useMemo(() => {
    if (!spotRect) return { left: 24, top: 120 };

    const cardW = 360;
    const cardH = 170;
    const margin = 12;

    // par défaut : sous le spotlight
    let left = spotRect.x;
    let top = spotRect.y + spotRect.h + margin;

    // si ça dépasse en bas, on met au-dessus
    if (top + cardH > window.innerHeight - margin) {
      top = Math.max(margin, spotRect.y - cardH - margin);
    }

    // si ça dépasse à droite, on décale à gauche
    if (left + cardW > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - cardW - margin);
    }

    return { left, top };
  }, [spotRect]);

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

          <div ref={scaleRef} style={styles.fieldBlock}>
            <label style={styles.label}>
              Échelle
              <select style={styles.select} value={scale} onChange={(e) => setScale(e.target.value)}>
                <option value="region">Région</option>
                <option value="departement">Département</option>
                <option value="commune">Commune</option>
              </select>
            </label>
          </div>

          <div ref={modeRef} style={styles.fieldBlock}>
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
          </div>

          <div ref={indicatorRef} style={styles.fieldBlock}>
            <label style={styles.label}>
              Indicateur
              <select style={styles.select} value={indicator} onChange={(e) => setIndicator(e.target.value)}>
                {availableIndicators.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div ref={yearRef} style={styles.fieldBlock}>
            <label style={styles.label}>
              Année
              <select style={styles.select} value={year} onChange={(e) => setYear(Number(e.target.value))}>
                <option value={2022}>2022</option>
                <option value={2021}>2021</option>
              </select>
            </label>
          </div>

          <div style={styles.hint}>
            {renderMode === "choropleth"
              ? "Choroplèthe : indicateurs en parts (%)."
              : "Cercles : indicateurs en volumes (effectifs)."}
          </div>
        </aside>

        <main style={styles.mapContainer}>
          <MapView scale={scale} indicator={indicator} year={year} renderMode={renderMode} />
        </main>
      </div>

      {/* GEOlY (bas-gauche) + bulle absolute (ne décale pas Geoly) */}
      <div
        style={styles.geolyWrap}
        onMouseEnter={() => setIsGeolyHover(true)}
        onMouseLeave={() => setIsGeolyHover(false)}
      >
        {(isGeolyHover || isTourOpen) && (
          <div
            style={styles.geolyBubble}
            role="button"
            tabIndex={0}
            onClick={() => (isTourOpen ? null : openTour())}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isTourOpen) openTour();
            }}
          >
            Je peux t’aider ?
          </div>
        )}

        <img
          src="/images/geoly.png"
          alt="Geoly"
          style={styles.geolyImg}
          onClick={() => (isTourOpen ? null : openTour())}
        />
      </div>

      {/* OVERLAY TUTORIEL (spotlight + carte positionnée près du champ) */}
      {isTourOpen && spotRect && (
        <div style={styles.tourOverlay} onMouseDown={closeTour}>
          <div
            style={{
              ...styles.spotlight,
              left: spotRect.x,
              top: spotRect.y,
              width: spotRect.w,
              height: spotRect.h,
            }}
            onMouseDown={(e) => e.stopPropagation()}
          />

          <div
            style={{ ...styles.tourCard, left: tourCardPos.left, top: tourCardPos.top }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Tutoriel Geoly</div>
            <div style={{ fontSize: 13, color: "#333", lineHeight: 1.35 }}>
              {getStepText(tourStep)}
            </div>

            <div style={styles.tourBtns}>
              <button style={styles.btnGhost} onClick={prevStep} disabled={tourStep === 0}>
                Précédent
              </button>

              {tourStep < 3 ? (
                <button style={styles.btnPrimary} onClick={nextStep}>
                  Étape suivante
                </button>
              ) : (
                <button style={styles.btnPrimary} onClick={closeTour}>
                  Terminer
                </button>
              )}
            </div>

            <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
              Astuce : <b>Entrée</b> = suivant, <b>Échap</b> = fermer
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  app: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    fontFamily: "system-ui, sans-serif",
  },

  header: {
    height: "60px",
    background: "#ffffff",
    borderBottom: "1px solid #e5e5e5",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 24px",
    flexShrink: 0,
  },

  logo: {
    fontFamily: "Rubik, sans-serif",
    fontSize: "28px",
    fontWeight: 600,
    color: "#0b2c5f",
    letterSpacing: "1px",
  },

  userCircle: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    background: "#bdbdbd",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },

  content: {
    flex: 1,
    display: "flex",
    overflow: "hidden",
    minHeight: 0,
  },

  sidebar: {
    width: "300px",
    padding: "16px",
    borderRight: "1px solid #e5e5e5",
    background: "#fafafa",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    overflowY: "auto",
  },

  fieldBlock: {
    padding: 0,
  },

  label: {
    display: "grid",
    gap: "6px",
    fontSize: "14px",
  },

  select: {
    padding: "8px",
    fontSize: "14px",
  },

  hint: {
    marginTop: 6,
    fontSize: 12,
    color: "#666",
    lineHeight: 1.35,
  },

  mapContainer: {
    flex: 1,
    height: "100%",
    minWidth: 0,
  },

  // Geoly
  geolyWrap: {
    position: "fixed",
    left: 16,
    bottom: 16,
    zIndex: 1300,
    width: 86,
    height: 86,
    userSelect: "none",
  },

  geolyImg: {
    width: 86,
    height: "auto",
    cursor: "pointer",
    filter: "drop-shadow(0 8px 18px rgba(0,0,0,0.18))",
  },

  geolyBubble: {
    position: "absolute",
    left: 92, // à droite de Geoly, sans le déplacer
    bottom: 44,
    background: "#ffffff",
    border: "1px solid #e5e5e5",
    borderRadius: 12,
    padding: "8px 10px",
    fontSize: 13,
    boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
    cursor: "pointer",
    maxWidth: 180,
    whiteSpace: "nowrap",
  },

  // Tutoriel overlay
  tourOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    zIndex: 2000,
  },

  spotlight: {
    position: "fixed",
    borderRadius: 12,
    boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
    outline: "2px solid rgba(255,255,255,0.85)",
    background: "rgba(255,255,255,0.06)",
  },

  tourCard: {
    position: "fixed",
    width: 360,
    background: "#ffffff",
    borderRadius: 14,
    padding: 12,
    border: "1px solid #e5e5e5",
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
  },

  tourBtns: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 12,
  },

  btnPrimary: {
    padding: "8px 10px",
    borderRadius: 10,
    border: "none",
    background: "#0b2c5f",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700,
  },

  btnGhost: {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #d9d9d9",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 700,
  },
};