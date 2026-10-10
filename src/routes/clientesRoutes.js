// src/routes/clientesRoutes.js
const express = require("express");
const router = express.Router();
const clientesController = require("../controllers/clientesController");

// ============================================
// RUTAS ESTÁTICAS (DEBEN IR PRIMERO)
// ============================================

// --- Tipos de cliente ---
router.get("/tipos", clientesController.getTiposCliente);
router.post("/tipos", clientesController.createTipoCliente);
router.put("/tipos/:id", clientesController.updateTipoCliente);
router.delete("/tipos/:id", clientesController.deleteTipoCliente);

// --- Zonas de cliente ---
router.get("/zonas", clientesController.getZonasCliente);
router.post("/zonas", clientesController.createZonaCliente);
router.put("/zonas/:id", clientesController.updateZonaCliente);
router.delete("/zonas/:id", clientesController.deleteZonaCliente);

// --- Búsqueda ---
router.get("/search", clientesController.searchClientes);

// ============================================
// RUTA RAÍZ (LISTA DE CLIENTES) - ¡ESTA FALTABA!
// ============================================

router.get("/", clientesController.getClientes);
router.post("/", clientesController.createCliente);

// ============================================
// SUB-RUTAS CON :id (específicas primero)
// ============================================

// Medidas (historial va ANTES que la genérica)
router.get("/:id/medidas/historial", clientesController.getClienteMedidasHistorial);
router.get("/:id/medidas", clientesController.getClienteMedidas);
router.post("/:id/medidas", clientesController.saveClienteMedidas);
router.delete("/:id/medidas", clientesController.deleteClienteMedidas);

// Pedidos del cliente
router.get("/:id/pedidos", clientesController.getClientePedidos);

// ============================================
// RUTAS GENÉRICAS CON :id (AL FINAL)
// ============================================

router.get("/:id", clientesController.getClienteById);
router.put("/:id", clientesController.updateCliente);
router.delete("/:id", clientesController.deleteCliente);

module.exports = router;