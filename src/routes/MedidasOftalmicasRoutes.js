// src/routes/MedidasOftalmicasRoutes.js
const express = require("express");
const router = express.Router();
const medidasOftalmicasController = require("../controllers/MedidasOftalmicasController");

// ============================================
// RUTAS DE MEDIDAS OFTÁLMICAS
// ============================================

// Obtener la medida más reciente de un cliente
router.get("/:clientId", medidasOftalmicasController.getMedidas);

// Obtener el historial completo de medidas de un cliente
router.get("/:clientId/historial", medidasOftalmicasController.getHistorialMedidas);

// Obtener una medida por su ID
router.get("/medida/:medidaId", medidasOftalmicasController.getMedidaById);

// Guardar o actualizar medidas de un cliente
router.post("/", medidasOftalmicasController.saveMedidas);

// Eliminar una medida específica (?medidaId=123) o todas las de un cliente
router.delete("/:clientId", medidasOftalmicasController.deleteMedidas);

module.exports = router;