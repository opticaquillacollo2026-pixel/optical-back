// src/services/clientesService.js
const { query } = require("../../db");

// ============================================
// HELPERS
// ============================================

const formatMedidaRow = (row) => {
  if (!row) return null;
  return {
    id: row.id_medida?.toString() || null,
    clientId: row.id_persona?.toString() || null,
    fecha: row.fecha_medida || null,
    nota: row.nota || "",
    lejosDerecho: {
      esfera: row.lejos_od_esfera || "",
      cilindro: row.lejos_od_cilindro || "",
      eje: row.lejos_od_eje || "",
      av: "",
    },
    lejosIzquierdo: {
      esfera: row.lejos_oi_esfera || "",
      cilindro: row.lejos_oi_cilindro || "",
      eje: row.lejos_oi_eje || "",
      av: "",
    },
    cercaDerecho: {
      esfera: row.cerca_od_esfera || "",
      cilindro: row.cerca_od_cilindro || "",
      eje: row.cerca_od_eje || "",
      av: "",
    },
    cercaIzquierdo: {
      esfera: row.cerca_oi_esfera || "",
      cilindro: row.cerca_oi_cilindro || "",
      eje: row.cerca_oi_eje || "",
      av: "",
    },
    dip: row.dip || "",
    add: row.add_medida || "",
  };
};

// ============================================
// CLIENTES
// ============================================

const getClientes = async ({ negocioId, searchTerm, month }) => {
  try {
    let queryText = `
      SELECT DISTINCT
        p.id_persona as id,
        p.nombre,
        p.apellido as apellidos,
        p.celular,
        p.fecha_nacimiento,
        p.estado,
        p.id_tipo_cliente,
        p.id_cliente_zona,
        pn.carnet_persona as carnet,
        tc.nombre_tipo_cliente as tipo_cliente,
        cz.nombre_zona as zona_cliente,
        NULL as created_at
      FROM persona p
      INNER JOIN persona_negocio pn ON p.id_persona = pn.id_persona
      LEFT JOIN tipo_cliente tc ON p.id_tipo_cliente = tc.id_tipo_cliente
      LEFT JOIN cliente_zona cz ON p.id_cliente_zona = cz.id_cliente_zona
      WHERE pn.id_negocio = $1
        AND p.estado = 'activo'
        AND p.id_persona NOT IN (
          SELECT id_persona FROM usuario WHERE estado = 'activo'
        )
    `;

    const params = [negocioId];

    if (searchTerm && searchTerm.trim()) {
      queryText += ` AND (
        p.nombre ILIKE $${params.length + 1} OR
        p.apellido ILIKE $${params.length + 1} OR
        pn.carnet_persona ILIKE $${params.length + 1} OR
        p.celular ILIKE $${params.length + 1}
      )`;
      params.push(`%${searchTerm.trim()}%`);
    }

    if (month && month !== "all") {
      queryText += ` AND EXTRACT(MONTH FROM p.fecha_nacimiento) = $${params.length + 1}`;
      params.push(parseInt(month));
    }

    queryText += ` ORDER BY p.nombre, p.apellido`;

    const result = await query(queryText, params);

    return result.rows.map((row) => ({
      id: row.id.toString(),
      nombre: row.nombre,
      apellidos: row.apellidos,
      carnet: row.carnet || "",
      celular: row.celular || "",
      fecha_nacimiento: row.fecha_nacimiento,
      tipo_cliente: row.tipo_cliente || "",
      tipo_cliente_id: row.id_tipo_cliente,
      zona_cliente: row.zona_cliente || "",
      zona_cliente_id: row.id_cliente_zona,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error("Error en getClientes service:", error);
    throw new Error("Error al obtener clientes");
  }
};

const searchClientes = async (term, negocioId) => {
  try {
    const result = await query(
      `
      SELECT DISTINCT
        p.id_persona as id,
        p.nombre,
        p.apellido as apellidos,
        p.celular,
        p.fecha_nacimiento,
        p.id_tipo_cliente,
        p.id_cliente_zona,
        pn.carnet_persona as carnet,
        tc.nombre_tipo_cliente as tipo_cliente,
        cz.nombre_zona as zona_cliente,
        NULL as created_at
      FROM persona p
      INNER JOIN persona_negocio pn ON p.id_persona = pn.id_persona
      LEFT JOIN tipo_cliente tc ON p.id_tipo_cliente = tc.id_tipo_cliente
      LEFT JOIN cliente_zona cz ON p.id_cliente_zona = cz.id_cliente_zona
      WHERE pn.id_negocio = $1
        AND p.estado = 'activo'
        AND p.id_persona NOT IN (
          SELECT id_persona FROM usuario WHERE estado = 'activo'
        )
        AND (
          p.nombre ILIKE $2 OR
          p.apellido ILIKE $2 OR
          pn.carnet_persona ILIKE $2 OR
          p.celular ILIKE $2
        )
      ORDER BY p.nombre, p.apellido
      LIMIT 20
      `,
      [negocioId, `%${term.trim()}%`]
    );

    return result.rows.map((row) => ({
      id: row.id.toString(),
      nombre: row.nombre,
      apellidos: row.apellidos,
      carnet: row.carnet || "",
      celular: row.celular || "",
      fecha_nacimiento: row.fecha_nacimiento,
      tipo_cliente: row.tipo_cliente || "",
      tipo_cliente_id: row.id_tipo_cliente,
      zona_cliente: row.zona_cliente || "",
      zona_cliente_id: row.id_cliente_zona,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error("Error en searchClientes service:", error);
    throw new Error("Error al buscar clientes");
  }
};

const getClienteById = async (id, negocioId) => {
  try {
    const result = await query(
      `
      SELECT 
        p.id_persona as id,
        p.nombre,
        p.apellido as apellidos,
        p.celular,
        p.fecha_nacimiento,
        p.id_tipo_cliente,
        p.id_cliente_zona,
        pn.carnet_persona as carnet,
        tc.nombre_tipo_cliente as tipo_cliente,
        cz.nombre_zona as zona_cliente,
        NULL as created_at
      FROM persona p
      INNER JOIN persona_negocio pn ON p.id_persona = pn.id_persona
      LEFT JOIN tipo_cliente tc ON p.id_tipo_cliente = tc.id_tipo_cliente
      LEFT JOIN cliente_zona cz ON p.id_cliente_zona = cz.id_cliente_zona
      WHERE p.id_persona = $1 AND pn.id_negocio = $2 AND p.estado = 'activo'
      `,
      [id, negocioId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id.toString(),
      nombre: row.nombre,
      apellidos: row.apellidos,
      carnet: row.carnet || "",
      celular: row.celular || "",
      fecha_nacimiento: row.fecha_nacimiento,
      tipo_cliente: row.tipo_cliente || "",
      tipo_cliente_id: row.id_tipo_cliente,
      zona_cliente: row.zona_cliente || "",
      zona_cliente_id: row.id_cliente_zona,
      createdAt: row.created_at,
    };
  } catch (error) {
    console.error("Error en getClienteById service:", error);
    throw new Error("Error al obtener cliente");
  }
};

const createCliente = async (data, negocioId) => {
  const client = await query("BEGIN");
  try {
    const personaResult = await query(
      `
      INSERT INTO persona (
        nombre, apellido, celular, fecha_nacimiento,
        id_tipo_cliente, id_cliente_zona, estado
      ) VALUES ($1, $2, $3, $4, $5, $6, 'activo')
      RETURNING id_persona
      `,
      [
        data.nombre.trim(),
        data.apellidos.trim(),
        data.celular?.trim() || null,
        data.fecha_nacimiento || null,
        data.tipoClienteId || null,
        data.zonaClienteId || null,
      ]
    );

    const idPersona = personaResult.rows[0].id_persona;

    await query(
      `
      INSERT INTO persona_negocio (id_persona, id_negocio, carnet_persona)
      VALUES ($1, $2, $3)
      `,
      [idPersona, negocioId, data.carnet.trim()]
    );

    await query("COMMIT");

    return await getClienteById(idPersona, negocioId);
  } catch (error) {
    await query("ROLLBACK");
    console.error("Error en createCliente service:", error);
    if (error.code === "23505") {
      throw new Error("Ya existe un cliente con ese carnet en este negocio");
    }
    throw new Error(error.message || "Error al crear cliente");
  }
};

const updateCliente = async (id, data, negocioId) => {
  const client = await query("BEGIN");
  try {
    const checkResult = await query(
      `SELECT id_persona FROM persona_negocio WHERE id_persona = $1 AND id_negocio = $2`,
      [id, negocioId]
    );

    if (checkResult.rows.length === 0) {
      throw new Error("Cliente no encontrado en este negocio");
    }

    await query(
      `
      UPDATE persona SET
        nombre = COALESCE($1, nombre),
        apellido = COALESCE($2, apellido),
        celular = COALESCE($3, celular),
        fecha_nacimiento = COALESCE($4, fecha_nacimiento),
        id_tipo_cliente = $5,
        id_cliente_zona = $6
      WHERE id_persona = $7
      `,
      [
        data.nombre?.trim() || null,
        data.apellidos?.trim() || null,
        data.celular?.trim() || null,
        data.fecha_nacimiento || null,
        data.tipoClienteId || null,
        data.zonaClienteId || null,
        id,
      ]
    );

    if (data.carnet) {
      await query(
        `
        UPDATE persona_negocio SET carnet_persona = $1
        WHERE id_persona = $2 AND id_negocio = $3
        `,
        [data.carnet.trim(), id, negocioId]
      );
    }

    await query("COMMIT");

    return await getClienteById(id, negocioId);
  } catch (error) {
    await query("ROLLBACK");
    console.error("Error en updateCliente service:", error);
    if (error.code === "23505") {
      throw new Error("Ya existe un cliente con ese carnet en este negocio");
    }
    throw new Error(error.message || "Error al actualizar cliente");
  }
};

const deleteCliente = async (id, negocioId) => {
  try {
    const checkResult = await query(
      `SELECT id_persona FROM persona_negocio WHERE id_persona = $1 AND id_negocio = $2`,
      [id, negocioId]
    );

    if (checkResult.rows.length === 0) {
      throw new Error("Cliente no encontrado en este negocio");
    }

    await query(`UPDATE persona SET estado = 'eliminado' WHERE id_persona = $1`, [id]);

    return true;
  } catch (error) {
    console.error("Error en deleteCliente service:", error);
    throw new Error(error.message || "Error al eliminar cliente");
  }
};

// ============================================
// MEDIDAS DE CLIENTES
// ============================================

const getClienteMedidas = async (clientId, negocioId) => {
  try {
    const checkResult = await query(
      `SELECT id_persona FROM persona_negocio WHERE id_persona = $1 AND id_negocio = $2`,
      [clientId, negocioId]
    );

    if (checkResult.rows.length === 0) {
      throw new Error("Cliente no encontrado en este negocio");
    }

    const result = await query(
      `
      SELECT 
        m.id_medida,
        m.id_persona,
        m.fecha_medida,
        m.nota,
        m.lejos_od_esfera, m.lejos_od_cilindro, m.lejos_od_eje,
        m.lejos_oi_esfera, m.lejos_oi_cilindro, m.lejos_oi_eje,
        m.cerca_od_esfera, m.cerca_od_cilindro, m.cerca_od_eje,
        m.cerca_oi_esfera, m.cerca_oi_cilindro, m.cerca_oi_eje,
        m.dip, m.add_medida
      FROM medida m
      WHERE m.id_persona = $1
      ORDER BY m.fecha_medida DESC NULLS LAST, m.id_medida DESC
      LIMIT 1
      `,
      [clientId]
    );

    if (result.rows.length === 0) return null;

    return formatMedidaRow(result.rows[0]);
  } catch (error) {
    console.error("Error en getClienteMedidas service:", error);
    throw new Error(error.message || "Error al obtener medidas del cliente");
  }
};

const getClienteMedidasHistorial = async (clientId, negocioId) => {
  try {
    const checkResult = await query(
      `SELECT id_persona FROM persona_negocio WHERE id_persona = $1 AND id_negocio = $2`,
      [clientId, negocioId]
    );

    if (checkResult.rows.length === 0) {
      throw new Error("Cliente no encontrado en este negocio");
    }

    const result = await query(
      `
      SELECT 
        m.id_medida,
        m.id_persona,
        m.fecha_medida,
        m.nota,
        m.lejos_od_esfera, m.lejos_od_cilindro, m.lejos_od_eje,
        m.lejos_oi_esfera, m.lejos_oi_cilindro, m.lejos_oi_eje,
        m.cerca_od_esfera, m.cerca_od_cilindro, m.cerca_od_eje,
        m.cerca_oi_esfera, m.cerca_oi_cilindro, m.cerca_oi_eje,
        m.dip, m.add_medida
      FROM medida m
      WHERE m.id_persona = $1
      ORDER BY m.fecha_medida DESC NULLS LAST, m.id_medida DESC
      `,
      [clientId]
    );

    return result.rows.map(formatMedidaRow);
  } catch (error) {
    console.error("Error en getClienteMedidasHistorial service:", error);
    throw new Error(error.message || "Error al obtener historial de medidas");
  }
};

const saveClienteMedidas = async (clientId, data, negocioId) => {
  try {
    const checkResult = await query(
      `SELECT id_persona FROM persona_negocio WHERE id_persona = $1 AND id_negocio = $2`,
      [clientId, negocioId]
    );

    if (checkResult.rows.length === 0) {
      throw new Error("Cliente no encontrado en este negocio");
    }

    const medidas = data.medidas || data;
    const nota = data.nota || null;

    const result = await query(
      `
      INSERT INTO medida (
        id_persona,
        lejos_od_esfera, lejos_od_cilindro, lejos_od_eje,
        lejos_oi_esfera, lejos_oi_cilindro, lejos_oi_eje,
        cerca_od_esfera, cerca_od_cilindro, cerca_od_eje,
        cerca_oi_esfera, cerca_oi_cilindro, cerca_oi_eje,
        dip, add_medida, nota, fecha_medida
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        TIMEZONE('America/La_Paz', NOW())
      )
      RETURNING id_medida
      `,
      [
        clientId,
        medidas.lejosDerecho?.esfera || "",
        medidas.lejosDerecho?.cilindro || "",
        medidas.lejosDerecho?.eje || "",
        medidas.lejosIzquierdo?.esfera || "",
        medidas.lejosIzquierdo?.cilindro || "",
        medidas.lejosIzquierdo?.eje || "",
        medidas.cercaDerecho?.esfera || "",
        medidas.cercaDerecho?.cilindro || "",
        medidas.cercaDerecho?.eje || "",
        medidas.cercaIzquierdo?.esfera || "",
        medidas.cercaIzquierdo?.cilindro || "",
        medidas.cercaIzquierdo?.eje || "",
        medidas.dip || "",
        medidas.add || "",
        nota,
      ]
    );

    return { id: result.rows[0].id_medida };
  } catch (error) {
    console.error("Error en saveClienteMedidas service:", error);
    throw new Error(error.message || "Error al guardar medidas");
  }
};

const deleteClienteMedidas = async (clientId, negocioId) => {
  try {
    const checkResult = await query(
      `SELECT id_persona FROM persona_negocio WHERE id_persona = $1 AND id_negocio = $2`,
      [clientId, negocioId]
    );

    if (checkResult.rows.length === 0) {
      throw new Error("Cliente no encontrado en este negocio");
    }

    await query(`DELETE FROM medida WHERE id_persona = $1`, [clientId]);
    return true;
  } catch (error) {
    console.error("Error en deleteClienteMedidas service:", error);
    throw new Error(error.message || "Error al eliminar medidas");
  }
};

// ============================================
// HISTORIAL DE PEDIDOS DEL CLIENTE
// ============================================

const getClientePedidos = async (clientId, negocioId) => {
  try {
    const checkResult = await query(
      `SELECT id_persona FROM persona_negocio WHERE id_persona = $1 AND id_negocio = $2`,
      [clientId, negocioId]
    );

    if (checkResult.rows.length === 0) {
      throw new Error("Cliente no encontrado en este negocio");
    }

    const pedidosResult = await query(
      `
      SELECT 
        p.id_pedido,
        p.codigo_pedido,
        p.fecha_pedido,
        p.total,
        p.sub_total,
        p.descuento,
        p.motivo_descripcion,
        p.estado_pago,
        p.id_tienda,
        t.nombre_tienda,
        COALESCE(
          (SELECT SUM(v.monto_pagado) FROM venta v WHERE v.id_pedido = p.id_pedido),
          0
        ) AS monto_pagado
      FROM pedido p
      INNER JOIN tienda t ON p.id_tienda = t.id_tienda
      WHERE p.id_cliente = $1 AND t.id_negocio = $2
      ORDER BY p.fecha_pedido DESC
      `,
      [clientId, negocioId]
    );

    const pedidos = [];

    for (const row of pedidosResult.rows) {
      const idPedido = row.id_pedido;

      const lentesResult = await query(
        `
        SELECT 
          edl.id_entrega_detalle_lente,
          edl.id_lente,
          l.tipo_lente,
          edl.total,
          o.nombre_organico AS material_nombre,
          m_montura.nombre_material AS frame_nombre,
          m_franela.nombre_material AS franela_nombre,
          m_estuche.nombre_material AS estuche_nombre
        FROM entrega_pendiente ep
        INNER JOIN entrega_detalle_lente edl ON ep.id_entrega_pendiente = edl.id_entrega_pendiente
        INNER JOIN lente l ON edl.id_lente = l.id_lente
        LEFT JOIN organico o ON l.id_organico = o.id_organico
        LEFT JOIN material m_montura ON l.id_montura = m_montura.id_material
        LEFT JOIN material m_franela ON l.id_franela = m_franela.id_material
        LEFT JOIN material m_estuche ON l.id_estuche = m_estuche.id_material
        WHERE ep.id_pedido = $1
        `,
        [idPedido]
      );

      const productosResult = await query(
        `
        SELECT 
          edm.id_entrega_detalle_material,
          edm.id_material,
          edm.cantidad,
          edm.total,
          m.nombre_material AS nombre
        FROM entrega_pendiente ep
        INNER JOIN entrega_detalle_material edm ON ep.id_entrega_pendiente = edm.id_entrega_pendiente
        INNER JOIN material m ON edm.id_material = m.id_material
        WHERE ep.id_pedido = $1
        `,
        [idPedido]
      );

      pedidos.push({
        id: idPedido.toString(),
        codigo: row.codigo_pedido,
        fecha: row.fecha_pedido,
        total: parseFloat(row.total || 0),
        subtotal: parseFloat(row.sub_total || 0),
        descuento: parseFloat(row.descuento || 0),
        motivoDescuento: row.motivo_descripcion || "",
        estadoPago: row.estado_pago,
        montoPagado: parseFloat(row.monto_pagado || 0),
        tiendaId: row.id_tienda?.toString() || "",
        tiendaNombre: row.nombre_tienda || "",
        lentes: lentesResult.rows.map((l) => ({
          id: l.id_entrega_detalle_lente.toString(),
          tipo: l.tipo_lente || "Lejos",
          materialNombre: l.material_nombre || "",
          frameNombre: l.frame_nombre || "",
          franelaNombre: l.franela_nombre || "",
          estucheNombre: l.estuche_nombre || "",
          total: parseFloat(l.total || 0),
        })),
        productos: productosResult.rows.map((p) => ({
          id: p.id_entrega_detalle_material.toString(),
          nombre: p.nombre || "",
          cantidad: parseInt(p.cantidad || 1),
          total: parseFloat(p.total || 0),
        })),
      });
    }

    return pedidos;
  } catch (error) {
    console.error("Error en getClientePedidos service:", error);
    throw new Error(error.message || "Error al obtener pedidos del cliente");
  }
};

// ============================================
// TIPOS DE CLIENTE
// ============================================

const getTiposCliente = async (negocioId) => {
  try {
    const result = await query(
      `SELECT id_tipo_cliente as id, nombre_tipo_cliente as nombre
       FROM tipo_cliente WHERE id_negocio = $1 ORDER BY nombre_tipo_cliente`,
      [negocioId]
    );
    return result.rows;
  } catch (error) {
    console.error("Error en getTiposCliente service:", error);
    throw new Error("Error al obtener tipos de cliente");
  }
};

const createTipoCliente = async (nombre, negocioId) => {
  try {
    const result = await query(
      `INSERT INTO tipo_cliente (nombre_tipo_cliente, id_negocio)
       VALUES ($1, $2) RETURNING id_tipo_cliente as id, nombre_tipo_cliente as nombre`,
      [nombre, negocioId]
    );
    return result.rows[0];
  } catch (error) {
    console.error("Error en createTipoCliente service:", error);
    if (error.code === "23505") {
      throw new Error("Ya existe un tipo de cliente con ese nombre");
    }
    throw new Error("Error al crear tipo de cliente");
  }
};

const updateTipoCliente = async (id, nombre, negocioId) => {
  try {
    const result = await query(
      `UPDATE tipo_cliente SET nombre_tipo_cliente = $1
       WHERE id_tipo_cliente = $2 AND id_negocio = $3
       RETURNING id_tipo_cliente as id, nombre_tipo_cliente as nombre`,
      [nombre, id, negocioId]
    );

    if (result.rows.length === 0) {
      throw new Error("Tipo de cliente no encontrado");
    }

    return result.rows[0];
  } catch (error) {
    console.error("Error en updateTipoCliente service:", error);
    if (error.code === "23505") {
      throw new Error("Ya existe un tipo de cliente con ese nombre");
    }
    throw new Error(error.message || "Error al actualizar tipo de cliente");
  }
};

const deleteTipoCliente = async (id, negocioId) => {
  try {
    const result = await query(
      `DELETE FROM tipo_cliente WHERE id_tipo_cliente = $1 AND id_negocio = $2 RETURNING id_tipo_cliente`,
      [id, negocioId]
    );

    if (result.rows.length === 0) {
      throw new Error("Tipo de cliente no encontrado");
    }

    return true;
  } catch (error) {
    console.error("Error en deleteTipoCliente service:", error);
    if (error.code === "23503") {
      throw new Error("No se puede eliminar el tipo porque hay clientes asignados a él");
    }
    throw new Error(error.message || "Error al eliminar tipo de cliente");
  }
};

// ============================================
// ZONAS DE CLIENTE
// ============================================

const getZonasCliente = async (negocioId) => {
  try {
    const result = await query(
      `SELECT id_cliente_zona as id, nombre_zona as nombre
       FROM cliente_zona WHERE id_negocio = $1 AND estado = 'activo'
       ORDER BY nombre_zona`,
      [negocioId]
    );
    return result.rows;
  } catch (error) {
    console.error("Error en getZonasCliente service:", error);
    throw new Error("Error al obtener zonas de cliente");
  }
};

const createZonaCliente = async (nombre, negocioId) => {
  try {
    const result = await query(
      `INSERT INTO cliente_zona (nombre_zona, id_negocio, estado)
       VALUES ($1, $2, 'activo')
       RETURNING id_cliente_zona as id, nombre_zona as nombre`,
      [nombre, negocioId]
    );
    return result.rows[0];
  } catch (error) {
    console.error("Error en createZonaCliente service:", error);
    if (error.code === "23505") {
      throw new Error("Ya existe una zona con ese nombre");
    }
    throw new Error("Error al crear zona de cliente");
  }
};

const updateZonaCliente = async (id, nombre, negocioId) => {
  try {
    const result = await query(
      `UPDATE cliente_zona SET nombre_zona = $1
       WHERE id_cliente_zona = $2 AND id_negocio = $3
       RETURNING id_cliente_zona as id, nombre_zona as nombre`,
      [nombre, id, negocioId]
    );

    if (result.rows.length === 0) {
      throw new Error("Zona de cliente no encontrada");
    }

    return result.rows[0];
  } catch (error) {
    console.error("Error en updateZonaCliente service:", error);
    if (error.code === "23505") {
      throw new Error("Ya existe una zona con ese nombre");
    }
    throw new Error(error.message || "Error al actualizar zona de cliente");
  }
};

const deleteZonaCliente = async (id, negocioId) => {
  try {
    const result = await query(
      `UPDATE cliente_zona SET estado = 'eliminado'
       WHERE id_cliente_zona = $1 AND id_negocio = $2
       RETURNING id_cliente_zona`,
      [id, negocioId]
    );

    if (result.rows.length === 0) {
      throw new Error("Zona de cliente no encontrada");
    }

    return true;
  } catch (error) {
    console.error("Error en deleteZonaCliente service:", error);
    throw new Error(error.message || "Error al eliminar zona de cliente");
  }
};

module.exports = {
  getClientes,
  searchClientes,
  getClienteById,
  createCliente,
  updateCliente,
  deleteCliente,
  getClienteMedidas,
  getClienteMedidasHistorial,
  saveClienteMedidas,
  deleteClienteMedidas,
  getClientePedidos,
  getTiposCliente,
  createTipoCliente,
  updateTipoCliente,
  deleteTipoCliente,
  getZonasCliente,
  createZonaCliente,
  updateZonaCliente,
  deleteZonaCliente,
};