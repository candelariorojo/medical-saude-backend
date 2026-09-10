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
    // 🔥 FIX TYPES SAFE
    const body = req.body as any

    const tema = body?.tema || ""
    const usuario = body?.usuario || {}
    const observaciones = body?.observaciones || ""
    const modo = body?.modo || "basico"

    if (!tema) {
      res.status(400).json({
        error: "El campo 'tema' es obligatorio"
      })
      return
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash"
    })

    const prompt = `
Eres un analista médico experto.

RESPONDE ÚNICAMENTE JSON VÁLIDO:

{
  "resumen": "texto",
  "riesgos": ["string"],
  "recomendaciones": ["string"],
  "nivel_alerta": "bajo"
}

Tema: ${tema}

Usuario:
${JSON.stringify(usuario, null, 2)}

Observaciones:
${observaciones}

Modo:
${modo}
`

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
