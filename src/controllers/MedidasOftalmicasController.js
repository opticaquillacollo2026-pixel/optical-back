// src/controllers/MedidasOftalmicasController.js
const medidasOftalmicasService = require("../services/MedidasOftalmicasService");

/**
 * Obtener la medida MÁS RECIENTE de un cliente
 */
const getMedidas = async (req, res) => {
  try {
    const { clientId } = req.params;

    console.log("=== Get Medidas Oftálmicas ===");
    console.log("clientId:", clientId);

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: "El ID del cliente es requerido",
      });
    }

    const result = await medidasOftalmicasService.getMedidas(clientId);

    if (!result) {
      return res.json({
        success: true,
        data: null,
        message: "El cliente no tiene medidas registradas",
      });
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error en getMedidas controller:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error al obtener las medidas",
    });
  }
};

/**
 * Obtener el HISTORIAL COMPLETO de medidas de un cliente
 */
const getHistorialMedidas = async (req, res) => {
  try {
    const { clientId } = req.params;

    console.log("=== Get Historial Medidas Oftálmicas ===");
    console.log("clientId:", clientId);

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: "El ID del cliente es requerido",
      });
    }

    const result = await medidasOftalmicasService.getHistorialMedidas(clientId);

    res.json({
      success: true,
      data: result || [],
    });
  } catch (error) {
    console.error("Error en getHistorialMedidas controller:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error al obtener el historial de medidas",
    });
  }
};

/**
 * Obtener una medida por su ID
 */
const getMedidaById = async (req, res) => {
  try {
    const { medidaId } = req.params;

    if (!medidaId) {
      return res.status(400).json({
        success: false,
        message: "El ID de la medida es requerido",
      });
    }

    const result = await medidasOftalmicasService.getMedidaById(medidaId);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Medida no encontrada",
      });
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error en getMedidaById controller:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error al obtener la medida",
    });
  }
};

/**
 * Guardar o actualizar las medidas oftálmicas de un cliente
 */
const saveMedidas = async (req, res) => {
  try {
    const {
      clientId,
      medidaId,
      lejosDerecho,
      lejosIzquierdo,
      cercaDerecho,
      cercaIzquierdo,
      dip,
      add,
      nota,
    } = req.body;

    console.log("=== Save Medidas Oftálmicas ===");
    console.log("clientId:", clientId, "medidaId:", medidaId);
    console.log("add recibido:", add);

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: "El ID del cliente es requerido",
      });
    }

    // ✅ Validar que ADD esté presente
    if (!add || add === "+" || add === "-") {
      return res.status(400).json({
        success: false,
        message: "El campo ADD es obligatorio para guardar las medidas",
      });
    }

    const result = await medidasOftalmicasService.saveMedidas({
      clientId,
      medidaId,
      lejosDerecho,
      lejosIzquierdo,
      cercaDerecho,
      cercaIzquierdo,
      dip,
      add,
      nota,
    });

    res.json({
      success: true,
      message: "Medidas guardadas exitosamente",
      data: result,
    });
  } catch (error) {
    console.error("Error en saveMedidas controller:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Error al guardar las medidas",
    });
  }
};

/**
 * Eliminar una medida específica o todas las medidas de un cliente
 */
const deleteMedidas = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { medidaId } = req.query;

    console.log("=== Delete Medidas Oftálmicas ===");
    console.log("clientId:", clientId, "medidaId:", medidaId);

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: "El ID del cliente es requerido",
      });
    }

    await medidasOftalmicasService.deleteMedidas(clientId, medidaId);

    res.json({
      success: true,
      message: medidaId
        ? "Medida eliminada exitosamente"
        : "Medidas eliminadas exitosamente",
    });
  } catch (error) {
    console.error("Error en deleteMedidas controller:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Error al eliminar las medidas",
    });
  }
};

module.exports = {
  getMedidas,
  getHistorialMedidas,
  getMedidaById,
  saveMedidas,
  deleteMedidas,
};