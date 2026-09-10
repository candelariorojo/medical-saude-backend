import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import { GoogleGenerativeAI } from "@google/generative-ai"

dotenv.config()

const PORT = Number(process.env.PORT) || 3000
const API_KEY = process.env.GEMINI_API_KEY

if (!API_KEY) {
  console.error("❌ GEMINI_API_KEY no configurada")
  process.exit(1)
}

console.log("✅ GEMINI configurada")

const app = express()

app.use(cors())
app.use(express.json({ limit: "2mb" }))

const genAI = new GoogleGenerativeAI(API_KEY)

// HEALTH CHECK
app.get("/", (_, res) => {
  res.json({
    status: "ok",
    servicio: "VitalControl IA"
  })
})

// ANALIZAR
app.post("/analizar", async (req, res): Promise<void> => {
  try {

    const body = req.body as any

    const tema = body?.tema || ""
    const usuario = body?.usuario || {}
    const observaciones = body?.observaciones || ""

    const inputMode = body?.inputMode || "soloDatosPrimarios"
    const outputLevel = body?.outputLevel || "basico"

    console.log("=== INPUT IA ===", {
      tema,
      inputMode,
      outputLevel
    })

    if (!tema) {
      res.status(400).json({
        error: "El campo 'tema' es obligatorio"
      })
      return
    }

    // =========================
    // 1. CONSTRUCCIÓN DE DATOS
    // =========================
    let datosAnalisis = ""

    switch (inputMode) {

      case "soloDatosPrimarios":
        datosAnalisis = `
DATOS DEL USUARIO:
${JSON.stringify(usuario, null, 2)}

INSTRUCCIONES:
- Analiza solo datos biométricos
- Ignora observaciones
- Evalúa IMC, edad, peso, altura y sexo
`
        break

      case "datosPrimariosMasObservaciones":
        datosAnalisis = `
DATOS DEL USUARIO:
${JSON.stringify(usuario, null, 2)}

OBSERVACIONES:
${observaciones}

INSTRUCCIONES:
- Combina datos + observaciones
- Relaciona síntomas con datos biométricos
`
        break

      case "soloObservaciones":
        datosAnalisis = `
OBSERVACIONES:
${observaciones}

INSTRUCCIONES:
- Analiza solo texto del usuario
- Ignora datos biométricos
`
        break
    }

    // =========================
    // 2. NIVEL DE SALIDA IA
    // =========================
    const niveles: Record<string, string> = {
      basico: `
Responde de forma simple y directa.
Sin enlaces.
Sin contenido externo.
`,

      avanzado: `
Responde con más detalle clínico.
Incluye recomendaciones estructuradas.
`,

      pro: `
Responde como experto médico.
Incluye:
- análisis profundo
- riesgos detallados
- recomendaciones avanzadas
- posibles recursos externos (si aplica)
`
    }

    const extraNivel = niveles[outputLevel] || niveles.basico

    // =========================
    // 3. PROMPT FINAL
    // =========================
    const prompt = `
Eres un analista médico experto.

RESPONDE SOLO EN JSON:

{
  "resumen": "texto",
  "riesgos": ["string"],
  "recomendaciones": ["string"],
  "nivel_alerta": "bajo"
}

Niveles permitidos:
- bajo
- medio
- alto
- critico

Tema:
${tema}

Modo:
${inputMode}

Nivel IA:
${outputLevel}

${extraNivel}

Datos:
${datosAnalisis}
`

    // =========================
    // 4. GEMINI
    // =========================
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash"
    })

    const result = await model.generateContent(prompt)
    const texto = result.response.text()

    const limpio = texto
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim()

    try {
      const json = JSON.parse(limpio)
       res.json(json)
       return
    } catch {
      res.json({
        resumen: limpio,
        riesgos: [],
        recomendaciones: [],
        nivel_alerta: "medio"
      })
      return
    }

  } catch (error: any) {

    console.error("❌ ERROR GEMINI:", error)

    res.status(500).json({
      error: error?.message || "Error interno"
    })
    return
  }
})

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`)
})