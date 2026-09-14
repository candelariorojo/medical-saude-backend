import express, { Request, Response } from "express"
import cors from "cors"
import dotenv from "dotenv"
import { GoogleGenerativeAI } from "@google/generative-ai"

dotenv.config()

const PORT = Number(process.env.PORT) || 3000
const API_KEY = process.env.GEMINI_API_KEY

if (!API_KEY) {
  console.error("❌ GEMINI_API_KEY no configurada en las variables de entorno.")
  process.exit(1)
}

console.log("✅ GEMINI API Key cargada correctamente.")

const app = express()

// ==========================================
// CONFIGURACIÓN DE CORS PROFESIONAL
// ==========================================
const allowedOrigins = [
  "https://medical-saude.netlify.app",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173"
]

app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir peticiones sin origen (como Postman o curl)
      if (!origin) return callback(null, true)

      if (allowedOrigins.includes(origin) || origin.endsWith(".netlify.app")) {
        return callback(null, true)
      } else {
        console.warn(`⚠️ Petición bloqueada por CORS desde: ${origin}`)
        return callback(new Error("Acceso bloqueado por la política de CORS"))
      }
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  })
)

app.use(express.json({ limit: "2mb" }))

const genAI = new GoogleGenerativeAI(API_KEY)

// ==========================================
// RUTAS
// ==========================================

// HEALTH CHECK (Para verificar que Render está vivo)
app.get("/", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    servicio: "VitalControl IA Backend",
    timestamp: new Date().toISOString()
  })
})

// ANALIZAR MEDIANTE IA
app.post("/analizar", async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      tema = "",
      usuario = {},
      observaciones = "",
      inputMode = "soloDatosPrimarios",
      outputLevel = "basico"
    } = req.body || {}

    console.log("=== NUEVA PETICIÓN IA ===", {
      tema,
      inputMode,
      outputLevel,
      timestamp: new Date().toISOString()
    })

    if (!tema) {
      res.status(400).json({ error: "El campo 'tema' es obligatorio" })
      return
    }

    // 1. Construcción dinámica de datos
    let datosAnalisis = ""
    switch (inputMode) {
      case "soloDatosPrimarios":
        datosAnalisis = `
DATOS DEL USUARIO:
${JSON.stringify(usuario, null, 2)}

INSTRUCCIONES:
- Analiza solo datos biométricos.
- Ignora observaciones.
- Evalúa IMC, edad, peso, altura y sexo.
`
        break

      case "datosPrimariosMasObservaciones":
        datosAnalisis = `
DATOS DEL USUARIO:
${JSON.stringify(usuario, null, 2)}

OBSERVACIONES:
${observaciones}

INSTRUCCIONES:
- Combina datos y observaciones.
- Relaciona síntomas con los datos biométricos.
`
        break

      case "soloObservaciones":
        datosAnalisis = `
OBSERVACIONES:
${observaciones}

INSTRUCCIONES:
- Analiza solo el texto introducido por el usuario.
- Ignora datos biométricos.
`
        break

      default:
        datosAnalisis = `DATOS: ${JSON.stringify(usuario, null, 2)}`
    }

    // 2. Nivel de detalle en la respuesta
    const niveles: Record<string, string> = {
      basico: "Responde de forma simple y directa. Sin enlaces ni contenido externo.",
      avanzado: "Responde con detalle clínico e incluye recomendaciones estructuradas.",
      pro: "Responde como un médico experto con análisis profundo, riesgos detallados y recomendaciones avanzadas."
    }

    const extraNivel = niveles[outputLevel] || niveles.basico

    // 3. Prompt estandarizado
    const prompt = `
Eres un analista médico experto integrado en la plataforma VitalControl.

Estructura tu análisis estrictamente bajo este esquema:
{
  "resumen": "string con el resumen clínico",
  "riesgos": ["arreglo de cadenas con posibles riesgos"],
  "recomendaciones": ["arreglo de cadenas con recomendaciones concretas"],
  "nivel_alerta": "bajo | medio | alto | critico"
}

Tema principal: ${tema}
Modo de entrada: ${inputMode}
Nivel requerido: ${outputLevel} (${extraNivel})

Datos recibidos:
${datosAnalisis}
`

    // 4. Llamada a Gemini con forzado de respuesta en formato JSON
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json"
      }
    })

    const result = await model.generateContent(prompt)
    const textoRespuesta = result.response.text().trim()

    // 5. Parseo seguro del JSON
    try {
      const jsonRespuesta = JSON.parse(textoRespuesta)
      res.json(jsonRespuesta)
      return
    } catch (parseError) {
      console.warn("⚠️ Fallo en el parseo JSON directo de Gemini. Aplicando fallback.")
      res.json({
        resumen: textoRespuesta,
        riesgos: [],
        recomendaciones: [],
        nivel_alerta: "medio"
      })
      return
    }
  } catch (error: any) {
    console.error("❌ ERROR EN PROCESAMIENTO GEMINI:", error)
    res.status(500).json({
      error: "Error interno al procesar la solicitud con la IA",
      detalle: error?.message || "Error desconocido"
    })
    return
  }
})

// Manejador de rutas inexistentes (404)
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Ruta no encontrada" })
})

app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en el puerto: ${PORT}`)
})