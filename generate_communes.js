import fs from 'fs'

// 200 communes (échantillon simplifié)
const communes = [
  "75056","69123","13055","06088","44109","33063","35238","67482","59350","34172",
  "31555","92026","94028","92050","93066","76351","59491","29019","80021","86194",
  "17300","83069","93029","92012","92004","92007","92036","92049","92040","92044",
  "92002","92022","92046","92075","92073","93048","93071","93064","93005","94017",
  "94068","94080","94041","94052","94058","94059","94033","94038","94019","94003",
  "94081","94022","94021","94055","94060","94002","94054","94037","94053","94028"
]

// Génération cohérente
function generateRow(code, year) {
  const base = Math.floor(50000 + Math.random() * 450000)

  const mm_15p = base
  const mm_25_49 = Math.floor(base * (0.25 + Math.random() * 0.05))
  const mm_15_34 = Math.floor(base * (0.20 + Math.random() * 0.05))
  const mm_50p = Math.floor(base * (0.30 + Math.random() * 0.05))
  const mm_cspp = Math.floor(base * (0.18 + Math.random() * 0.08))
  const mm_femmes = Math.floor(base * (0.50 + Math.random() * 0.02))

  const part_25_49 = (mm_25_49 / mm_15p) * 100
  const part_15_34 = (mm_15_34 / mm_15p) * 100
  const part_50p = (mm_50p / mm_15p) * 100
  const part_cspp = (mm_cspp / mm_15p) * 100

  return `${code},${year},${mm_15p},${mm_25_49},${mm_15_34},${mm_50p},${mm_cspp},${mm_femmes},${part_25_49.toFixed(1)},${part_15_34.toFixed(1)},${part_50p.toFixed(1)},${part_cspp.toFixed(1)}`
}

let csv = "geo_id,annee,mm_15p,mm_25_49,mm_15_34,mm_50p,mm_cspp,mm_femmes,part_25_49,part_15_34,part_50p,part_cspp\n"

for (const code of communes) {
  csv += generateRow(code, 2022) + "\n"
  csv += generateRow(code, 2021) + "\n"
}

// Assure-toi que le dossier existe
fs.mkdirSync("./public/data", { recursive: true })

fs.writeFileSync("./public/data/data_commune.csv", csv)

console.log("✅ data_commune.csv généré avec succès")