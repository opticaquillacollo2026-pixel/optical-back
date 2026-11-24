// src/services/HistorialVentasService.js
const { query } = require("../../db");
const { pool } = require("../../db");

// ============================================
// FUNCIONES DE UTILIDAD PARA FILTROS DE FECHA
// ============================================

// La columna venta.fecha_hora es TIMESTAMP SIN ZONA HORARIA y almacena hora de Bolivia.
// Los límites de búsqueda deben ser fechas locales sin conversión a UTC.
const getBoliviaToday = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const get = (type) => parts.find(part => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
};

const parseCalendarDate = (value) => {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
};

const formatCalendarDate = (date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addCalendarDays = (date, days) => {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

const buildDateFilter = (dateFilterType, specificDate, startDate, endDate, startParamIndex = 1) => {
  let dateCondition = '';
  const params = [];
  let paramIndex = startParamIndex;

  if (!dateFilterType || dateFilterType === 'all') {
    return { dateCondition, params, paramIndex };
  }

  const today = parseCalendarDate(getBoliviaToday());
  let start = null;
  let end = null;
  const weekDay = today.getUTCDay() || 7;

  switch (dateFilterType) {
    case 'today':
      start = today;
      end = addCalendarDays(today, 1);
      break;
    case 'yesterday':
      start = addCalendarDays(today, -1);
      end = today;
      break;
    case 'thisWeek':
      start = addCalendarDays(today, 1 - weekDay);
      end = addCalendarDays(start, 7);
      break;
    case 'lastWeek':
      end = addCalendarDays(today, 1 - weekDay);
      start = addCalendarDays(end, -7);
      break;
    case 'thisMonth':
      start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
      break;
    case 'lastMonth':
      start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
      end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      break;
    case 'specific':
      start = parseCalendarDate(specificDate);
      end = start ? addCalendarDays(start, 1) : null;
      break;
    case 'range':
      start = parseCalendarDate(startDate);
      const lastDay = parseCalendarDate(endDate);
      end = lastDay ? addCalendarDays(lastDay, 1) : null;
      break;
    default:
      break;
  }

  if (start && end) {
    dateCondition = ` AND v.fecha_hora >= $${paramIndex}::timestamp AND v.fecha_hora < $${paramIndex + 1}::timestamp`;
    params.push(formatCalendarDate(start), formatCalendarDate(end));
    paramIndex += 2;
  }
  return { dateCondition, params, paramIndex };
};

// ============================================
// FUNCIÓN PARA CONVERTIR VENTA A FORMATO FRONTEND
// ============================================

const mapVentaToFrontend = (row) => {
  return {
    id: row.id_venta?.toString(),
    codigoVenta: row.codigo_pedido,
    fecha: row.fecha_hora || row.fecha_pedido,
    usuario: row.usuario || 'Sistema',
    metodoPago: row.metodo_pago || 'efectivo',
    subtotal: parseFloat(row.sub_total || 0),
    descuento: parseFloat(row.descuento || 0),
    motivoDescuento: row.motivo_descripcion || '',
    total: parseFloat(row.total || 0),
    clientName: row.cliente_nombre || 'Cliente',
    clienteCelular: row.cliente_celular || '',
    tiendaCelular: row.tienda_celular || '',
    tiendaId: row.id_tienda?.toString(),
    pagoEfectivo: parseFloat(row.monto_efectivo || 0),
    pagoQR: parseFloat(row.monto_qr || 0),
    lentes: [],
    productosAdicionales: []
  };
};

// ============================================
// GET - OBTENER VENTAS CON FILTROS
// ============================================

const getVentas = async (filtros, userInfo) => {
  try {
    const {
      dateFilterType,
      specificDate,
      startDate,
      endDate,
      selectedMetodoPago,
      searchTerm,
      tiendaId: tiendaIdFiltro,
      sortDirection = 'desc'
    } = filtros;

    const { negocioId, tiendaId } = userInfo;

    if (!negocioId) {
      console.warn("⚠️ negocioId no proporcionado");
      return [];
    }

    let queryText = `
      SELECT 
        v.id_venta,
        v.fecha_hora,
        v.monto_efectivo,
        v.monto_qr,
        v.metodo_pago,
        v.id_usuario,
        p.id_pedido,
        p.codigo_pedido,
        p.sub_total,
        p.descuento,
        p.motivo_descripcion,
        p.total,
        p.id_tienda,
        p.fecha_pedido,
        per.nombre || ' ' || per.apellido as cliente_nombre,
        per.celular as cliente_celular,
        t.celular as tienda_celular,
        u.usuario
      FROM venta v
      INNER JOIN pedido p ON v.id_pedido = p.id_pedido
      INNER JOIN persona per ON p.id_cliente = per.id_persona
      LEFT JOIN usuario u ON v.id_usuario = u.id_usuario
      INNER JOIN tienda t ON p.id_tienda = t.id_tienda
      WHERE t.id_negocio = $1
    `;

    const params = [parseInt(negocioId)];
    let paramIndex = 2;

    if (tiendaId && tiendaId !== 'todas') {
      queryText += ` AND p.id_tienda = $${paramIndex}`;
      params.push(parseInt(tiendaId));
      paramIndex++;
    }

    if (tiendaIdFiltro && tiendaIdFiltro !== 'todas' && tiendaIdFiltro !== tiendaId) {
      queryText += ` AND p.id_tienda = $${paramIndex}`;
      params.push(parseInt(tiendaIdFiltro));
      paramIndex++;
    }

    if (searchTerm && searchTerm.trim() !== '') {
      const searchPattern = `%${searchTerm.trim()}%`;
      queryText += ` AND (
        p.codigo_pedido ILIKE $${paramIndex} OR 
        per.nombre ILIKE $${paramIndex} OR 
        per.apellido ILIKE $${paramIndex} OR
        u.usuario ILIKE $${paramIndex}
      )`;
      params.push(searchPattern);
      paramIndex++;
    }

    if (selectedMetodoPago && selectedMetodoPago !== 'all') {
      if (selectedMetodoPago === 'efectivo') {
        queryText += ` AND v.monto_efectivo IS NOT NULL AND v.monto_efectivo > 0`;
      } else if (selectedMetodoPago === 'qr') {
        queryText += ` AND v.monto_qr IS NOT NULL AND v.monto_qr > 0`;
      } else if (selectedMetodoPago === 'mixto') {
        queryText += ` AND v.monto_efectivo IS NOT NULL AND v.monto_efectivo > 0 AND v.monto_qr IS NOT NULL AND v.monto_qr > 0`;
      }
    }

    const { dateCondition, params: dateParams, paramIndex: newParamIndex } = buildDateFilter(
      dateFilterType,
      specificDate,
      startDate,
      endDate,
      paramIndex
    );
    queryText += dateCondition;
    params.push(...dateParams);
    paramIndex = newParamIndex;

    queryText += ` ORDER BY v.fecha_hora ${sortDirection === 'desc' ? 'DESC' : 'ASC'}`;

    console.log("📝 Query ejecutada:", queryText);
    console.log("📝 Params:", params);

    const result = await query(queryText, params);

    if (result.rows.length === 0) {
      return [];
    }

    const ventas = result.rows.map(row => mapVentaToFrontend(row));

    for (let venta of ventas) {
      const pedidoResult = await query(
        `SELECT id_pedido FROM venta WHERE id_venta = $1`,
        [parseInt(venta.id)]
      );
      
      if (pedidoResult.rows.length === 0) continue;
      const idPedido = pedidoResult.rows[0].id_pedido;

      const lentesResult = await query(
        `
        SELECT 
          l.id_lente,
          l.tipo_lente,
          o.nombre_organico as organico,
          m.nombre_material as frame,
          m2.nombre_material as franela,
          m3.nombre_material as estuche,
          edl.total as total_lente
        FROM entrega_detalle_lente edl
        INNER JOIN lente l ON edl.id_lente = l.id_lente
        INNER JOIN entrega_pendiente ep ON edl.id_entrega_pendiente = ep.id_entrega_pendiente
        LEFT JOIN organico o ON l.id_organico = o.id_organico
        LEFT JOIN material m ON l.id_montura = m.id_material
        LEFT JOIN material m2 ON l.id_franela = m2.id_material
        LEFT JOIN material m3 ON l.id_estuche = m3.id_material
        WHERE ep.id_pedido = $1
        `,
        [idPedido]
      );

      venta.lentes = lentesResult.rows.map(l => ({
        id: l.id_lente?.toString(),
        tipo: l.tipo_lente || 'No especificado',
        organico: l.organico || 'Sin orgánico',
        frame: l.frame || '',
        franela: l.franela || '',
        estuche: l.estuche || '',
        total: parseFloat(l.total_lente || 0)
      }));

      const materialesResult = await query(
        `
        SELECT 
          m.nombre_material,
          edm.cantidad,
          edm.total as total_material
        FROM entrega_detalle_material edm
        INNER JOIN material m ON edm.id_material = m.id_material
        INNER JOIN entrega_pendiente ep ON edm.id_entrega_pendiente = ep.id_entrega_pendiente
        WHERE ep.id_pedido = $1
        `,
        [idPedido]
      );

      venta.productosAdicionales = materialesResult.rows.map(m => ({
        nombre: m.nombre_material,
        cantidad: m.cantidad || 1,
        total: parseFloat(m.total_material || 0)
      }));
    }

    return ventas;
  } catch (error) {
    console.error("Error en getVentas service:", error);
    throw new Error(error.message || "Error al obtener las ventas");
  }
};

// ============================================
// GET - OBTENER VENTA POR ID
// ============================================

const getVentaById = async (id, userInfo) => {
  try {
    const { negocioId } = userInfo;

    const idNum = parseInt(id);
    if (isNaN(idNum)) {
      return null;
    }

    if (!negocioId) {
      return null;
    }

    const result = await query(
      `
      SELECT 
        v.id_venta,
        v.fecha_hora,
        v.monto_efectivo,
        v.monto_qr,
        v.metodo_pago,
        v.id_usuario,
        p.id_pedido,
        p.codigo_pedido,
        p.sub_total,
        p.descuento,
        p.motivo_descripcion,
        p.total,
        p.id_tienda,
        per.nombre || ' ' || per.apellido as cliente_nombre,
        per.celular as cliente_celular,
        t.celular as tienda_celular,
        u.usuario
      FROM venta v
      INNER JOIN pedido p ON v.id_pedido = p.id_pedido
      INNER JOIN persona per ON p.id_cliente = per.id_persona
      LEFT JOIN usuario u ON v.id_usuario = u.id_usuario
      INNER JOIN tienda t ON p.id_tienda = t.id_tienda
      WHERE v.id_venta = $1 AND t.id_negocio = $2
      `,
      [idNum, parseInt(negocioId)]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    
    const venta = {
      id: row.id_venta?.toString(),
      codigoVenta: row.codigo_pedido,
      fecha: row.fecha_hora,
      usuario: row.usuario || 'Sistema',
      subtotal: parseFloat(row.sub_total || 0),
      descuento: parseFloat(row.descuento || 0),
      motivoDescuento: row.motivo_descripcion || '',
      total: parseFloat(row.total || 0),
      metodoPago: row.metodo_pago || 'efectivo',
      clientName: row.cliente_nombre || 'Cliente',
      clienteCelular: row.cliente_celular || '',
      tiendaCelular: row.tienda_celular || '',
      tiendaId: row.id_tienda?.toString(),
      pagoEfectivo: parseFloat(row.monto_efectivo || 0),
      pagoQR: parseFloat(row.monto_qr || 0),
      items: []
    };

    const entregaResult = await query(
      `SELECT id_entrega_pendiente FROM entrega_pendiente WHERE id_pedido = $1`,
      [row.id_pedido]
    );

    const idEntrega = entregaResult.rows.length > 0 ? entregaResult.rows[0].id_entrega_pendiente : null;

    let lentesQuery = `
      SELECT 
        l.id_lente,
        l.tipo_lente,
        o.nombre_organico as organico,
        m.nombre_material as frame,
        m2.nombre_material as franela,
        m3.nombre_material as estuche,
        edl.total as total_lente
      FROM lente l
      LEFT JOIN organico o ON l.id_organico = o.id_organico
      LEFT JOIN material m ON l.id_montura = m.id_material
      LEFT JOIN material m2 ON l.id_franela = m2.id_material
      LEFT JOIN material m3 ON l.id_estuche = m3.id_material
    `;

    let lentesParams = [];

    if (idEntrega) {
      lentesQuery += `
        INNER JOIN entrega_detalle_lente edl ON l.id_lente = edl.id_lente
        WHERE edl.id_entrega_pendiente = $1
      `;
      lentesParams = [idEntrega];
    } else {
      lentesQuery += `
        INNER JOIN entrega_detalle_lente edl ON l.id_lente = edl.id_lente
        INNER JOIN entrega_pendiente ep ON edl.id_entrega_pendiente = ep.id_entrega_pendiente
        WHERE ep.id_pedido = $1
      `;
      lentesParams = [row.id_pedido];
    }

    const lentesResult = await query(lentesQuery, lentesParams);

    lentesResult.rows.forEach((l) => {
      const grupo = `Lente ${l.tipo_lente || 'No especificado'}`;
      const totalLente = parseFloat(l.total_lente || 0);
      
      venta.items.push({
        nombre: `Lente ${l.tipo_lente || 'No especificado'}`,
        cantidad: 1,
        precioUnitario: 0,
        subtotal: 0,
        esLente: true,
        grupo: grupo,
        esTituloLente: true
      });
      
      if (l.frame) {
        venta.items.push({
          nombre: `Montura: ${l.frame}`,
          cantidad: 1,
          precioUnitario: 0,
          subtotal: 0,
          esLente: true,
          grupo: grupo
        });
      }
      
      if (l.organico) {
        venta.items.push({
          nombre: `Orgánico: ${l.organico}`,
          cantidad: 1,
          precioUnitario: 0,
          subtotal: 0,
          esLente: true,
          grupo: grupo
        });
      }
      
      if (l.franela) {
        venta.items.push({
          nombre: `Franela: ${l.franela}`,
          cantidad: 1,
          precioUnitario: 0,
          subtotal: 0,
          esLente: true,
          grupo: grupo
        });
      }
      
      if (l.estuche) {
        venta.items.push({
          nombre: `Estuche: ${l.estuche}`,
          cantidad: 1,
          precioUnitario: 0,
          subtotal: 0,
          esLente: true,
          grupo: grupo
        });
      }

      if (totalLente > 0) {
        venta.items.push({
          nombre: `Total Lente`,
          cantidad: 1,
          precioUnitario: totalLente,
          subtotal: totalLente,
          esLente: true,
          grupo: grupo,
          esTotal: true
        });
      }
    });

    let materialesQuery = `
      SELECT 
        m.nombre_material,
        edm.cantidad,
        edm.total as total_material
      FROM entrega_detalle_material edm
      INNER JOIN material m ON edm.id_material = m.id_material
    `;

    let materialesParams = [];

    if (idEntrega) {
      materialesQuery += ` WHERE edm.id_entrega_pendiente = $1`;
      materialesParams = [idEntrega];
    } else {
      materialesQuery += `
        INNER JOIN entrega_pendiente ep ON edm.id_entrega_pendiente = ep.id_entrega_pendiente
        WHERE ep.id_pedido = $1
      `;
      materialesParams = [row.id_pedido];
    }

    const materialesResult = await query(materialesQuery, materialesParams);

    if (materialesResult.rows.length > 0) {
      venta.items.push({
        nombre: 'Productos Adicionales',
        cantidad: 1,
        precioUnitario: 0,
        subtotal: 0,
        esLente: false,
        grupo: 'Productos Adicionales',
        esTituloLente: true
      });
    }

    materialesResult.rows.forEach(m => {
      const totalMaterial = parseFloat(m.total_material || 0);
      const cantidad = parseInt(m.cantidad || 1);
      
      venta.items.push({
        nombre: m.nombre_material,
        cantidad: cantidad,
        precioUnitario: cantidad > 0 ? totalMaterial / cantidad : 0,
        subtotal: totalMaterial,
        esLente: false,
        grupo: 'Productos Adicionales'
      });
    });

    return venta;
  } catch (error) {
    console.error("Error en getVentaById service:", error);
    return null;
  }
};

// ============================================
// GET - OBTENER VENTAS POR CÓDIGO
// ============================================

const getVentasByCodigo = async (codigoVenta, userInfo) => {
  try {
    const { negocioId, tiendaId } = userInfo;

    if (!negocioId) {
      return [];
    }

    let queryText = `
      SELECT 
        v.id_venta,
        v.fecha_hora,
        v.monto_efectivo,
        v.monto_qr,
        v.metodo_pago,
        v.id_usuario,
        p.id_pedido,
        p.codigo_pedido,
        p.sub_total,
        p.descuento,
        p.motivo_descripcion,
        p.total,
        p.id_tienda,
        per.nombre || ' ' || per.apellido as cliente_nombre,
        per.celular as cliente_celular,
        t.celular as tienda_celular,
        u.usuario
      FROM venta v
      INNER JOIN pedido p ON v.id_pedido = p.id_pedido
      INNER JOIN persona per ON p.id_cliente = per.id_persona
      LEFT JOIN usuario u ON v.id_usuario = u.id_usuario
      INNER JOIN tienda t ON p.id_tienda = t.id_tienda
      WHERE p.codigo_pedido ILIKE $1 AND t.id_negocio = $2
    `;

    const params = [`%${codigoVenta}%`, parseInt(negocioId)];
    let paramIndex = 3;

    if (tiendaId && tiendaId !== 'todas') {
      queryText += ` AND p.id_tienda = $${paramIndex}`;
      params.push(parseInt(tiendaId));
      paramIndex++;
    }

    queryText += ` ORDER BY v.fecha_hora DESC`;

    const result = await query(queryText, params);

    return result.rows.map(row => mapVentaToFrontend(row));
  } catch (error) {
    console.error("Error en getVentasByCodigo service:", error);
    return [];
  }
};

// ============================================
// GET - OBTENER VENTAS POR CLIENTE
// ============================================

const getVentasByCliente = async (clientName, userInfo) => {
  try {
    const { negocioId, tiendaId } = userInfo;

    if (!negocioId) {
      return [];
    }

    let queryText = `
      SELECT 
        v.id_venta,
        v.fecha_hora,
        v.monto_efectivo,
        v.monto_qr,
        v.metodo_pago,
        v.id_usuario,
        p.id_pedido,
        p.codigo_pedido,
        p.sub_total,
        p.descuento,
        p.motivo_descripcion,
        p.total,
        p.id_tienda,
        per.nombre || ' ' || per.apellido as cliente_nombre,
        per.celular as cliente_celular,
        t.celular as tienda_celular,
        u.usuario
      FROM venta v
      INNER JOIN pedido p ON v.id_pedido = p.id_pedido
      INNER JOIN persona per ON p.id_cliente = per.id_persona
      LEFT JOIN usuario u ON v.id_usuario = u.id_usuario
      INNER JOIN tienda t ON p.id_tienda = t.id_tienda
      WHERE (per.nombre ILIKE $1 OR per.apellido ILIKE $1) AND t.id_negocio = $2
    `;

    const params = [`%${clientName}%`, parseInt(negocioId)];
    let paramIndex = 3;

    if (tiendaId && tiendaId !== 'todas') {
      queryText += ` AND p.id_tienda = $${paramIndex}`;
      params.push(parseInt(tiendaId));
      paramIndex++;
    }

    queryText += ` ORDER BY v.fecha_hora DESC`;

    const result = await query(queryText, params);

    return result.rows.map(row => mapVentaToFrontend(row));
  } catch (error) {
    console.error("Error en getVentasByCliente service:", error);
    return [];
  }
};

// ============================================
// GET - RESUMEN DE VENTAS
// ============================================

const getResumenVentas = async (filtros, userInfo) => {
  try {
    const ventas = await getVentas(filtros, userInfo);

    const resumen = ventas.reduce((acc, v) => {
      acc.totalEfectivo += v.pagoEfectivo || 0;
      acc.totalQR += v.pagoQR || 0;
      acc.totalVentas += v.total || 0;
      if (v.metodoPago === 'mixto') {
        acc.totalMixto += v.total || 0;
      }
      return acc;
    }, { totalVentas: 0, totalEfectivo: 0, totalQR: 0, totalMixto: 0 });

    return {
      ...resumen,
      cantidadVentas: ventas.length
    };
  } catch (error) {
    console.error("Error en getResumenVentas service:", error);
    return {
      totalVentas: 0,
      totalEfectivo: 0,
      totalQR: 0,
      totalMixto: 0,
      cantidadVentas: 0
    };
  }
};

// ============================================
// GET - RESUMEN POR CLIENTE
// ============================================

const getResumenClientes = async (filtros, userInfo) => {
  try {
    const { negocioId, tiendaId } = userInfo;
    const { tipoFiltro = 'todos' } = filtros;

    if (!negocioId) {
      return [];
    }

    let queryText = `
      SELECT 
        per.nombre || ' ' || per.apellido as nombre,
        COALESCE(SUM(v.monto_efectivo), 0) as total_efectivo,
        COALESCE(SUM(v.monto_qr), 0) as total_qr,
        COALESCE(SUM(p.total), 0) as total_general,
        COUNT(DISTINCT v.id_venta) as total_ventas
      FROM venta v
      INNER JOIN pedido p ON v.id_pedido = p.id_pedido
      INNER JOIN persona per ON p.id_cliente = per.id_persona
      INNER JOIN tienda t ON p.id_tienda = t.id_tienda
      WHERE t.id_negocio = $1
    `;

    const params = [parseInt(negocioId)];
    let paramIndex = 2;

    if (tiendaId && tiendaId !== 'todas') {
      queryText += ` AND p.id_tienda = $${paramIndex}`;
      params.push(parseInt(tiendaId));
      paramIndex++;
    }

    if (filtros.searchTerm && filtros.searchTerm.trim() !== '') {
      const searchPattern = `%${filtros.searchTerm.trim()}%`;
      queryText += ` AND (per.nombre ILIKE $${paramIndex} OR per.apellido ILIKE $${paramIndex})`;
      params.push(searchPattern);
      paramIndex++;
    }

    const { dateCondition, params: dateParams, paramIndex: newParamIndex } = buildDateFilter(
      filtros.dateFilterType,
      filtros.specificDate,
      filtros.startDate,
      filtros.endDate,
      paramIndex
    );
    queryText += dateCondition;
    params.push(...dateParams);
    paramIndex = newParamIndex;

    queryText += ` GROUP BY per.id_persona, per.nombre, per.apellido ORDER BY total_general DESC`;

    const result = await query(queryText, params);

    let clientes = result.rows.map(row => ({
      nombre: row.nombre,
      totalEfectivo: parseFloat(row.total_efectivo || 0),
      totalQR: parseFloat(row.total_qr || 0),
      totalMixto: 0,
      totalGeneral: parseFloat(row.total_general || 0)
    }));

    clientes = clientes.map(c => ({
      ...c,
      totalMixto: (c.totalEfectivo > 0 && c.totalQR > 0) ? c.totalGeneral : 0
    }));

    if (tipoFiltro === 'efectivo') {
      clientes = clientes.filter(c => c.totalEfectivo > 0);
    } else if (tipoFiltro === 'qr') {
      clientes = clientes.filter(c => c.totalQR > 0);
    } else if (tipoFiltro === 'mixto') {
      clientes = clientes.filter(c => c.totalEfectivo > 0 && c.totalQR > 0);
    }

    return clientes;
  } catch (error) {
    console.error("Error en getResumenClientes service:", error);
    return [];
  }
};

// ============================================
// GET - ESTADÍSTICAS RÁPIDAS
// ============================================

const getEstadisticasRapidas = async (tiendaIdFiltro, userInfo) => {
  try {
    const { negocioId, tiendaId } = userInfo;

    if (!negocioId) {
      return {
        totalVentasHoy: 0,
        totalVentasMes: 0,
        promedioVenta: 0,
        cantidadVentasHoy: 0
      };
    }

    const today = parseCalendarDate(getBoliviaToday());
    const startOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

    let queryText = `
      SELECT 
        COUNT(DISTINCT v.id_venta) as total_ventas,
        COALESCE(SUM(v.monto_efectivo + v.monto_qr), 0) as total_monto
      FROM venta v
      INNER JOIN pedido p ON v.id_pedido = p.id_pedido
      INNER JOIN tienda t ON p.id_tienda = t.id_tienda
      WHERE t.id_negocio = $1 AND v.fecha_hora >= $2
    `;

    const params = [parseInt(negocioId), formatCalendarDate(startOfMonth)];
    let paramIndex = 3;

    const tiendaEfectiva = tiendaIdFiltro && tiendaIdFiltro !== 'todas' ? tiendaIdFiltro : tiendaId;
    if (tiendaEfectiva && tiendaEfectiva !== 'todas') {
      queryText += ` AND p.id_tienda = $${paramIndex}`;
      params.push(parseInt(tiendaEfectiva));
      paramIndex++;
    }

    const mesResult = await query(queryText, params);
    const totalMes = parseFloat(mesResult.rows[0]?.total_monto || 0);
    const cantidadMes = parseInt(mesResult.rows[0]?.total_ventas || 0);

    let hoyQuery = `
      SELECT 
        COUNT(DISTINCT v.id_venta) as total_ventas,
        COALESCE(SUM(v.monto_efectivo + v.monto_qr), 0) as total_monto
      FROM venta v
      INNER JOIN pedido p ON v.id_pedido = p.id_pedido
      INNER JOIN tienda t ON p.id_tienda = t.id_tienda
      WHERE t.id_negocio = $1 AND v.fecha_hora >= $2 AND v.fecha_hora < $3
    `;

    const hoyParams = [parseInt(negocioId), formatCalendarDate(today), formatCalendarDate(addCalendarDays(today, 1))];
    let hoyIndex = 4;

    if (tiendaEfectiva && tiendaEfectiva !== 'todas') {
      hoyQuery += ` AND p.id_tienda = $${hoyIndex}`;
      hoyParams.push(parseInt(tiendaEfectiva));
    }

    const hoyResult = await query(hoyQuery, hoyParams);
    const totalHoy = parseFloat(hoyResult.rows[0]?.total_monto || 0);
    const cantidadHoy = parseInt(hoyResult.rows[0]?.total_ventas || 0);

    const promedio = cantidadMes > 0 ? totalMes / cantidadMes : 0;

    return {
      totalVentasHoy: totalHoy,
      totalVentasMes: totalMes,
      promedioVenta: promedio,
      cantidadVentasHoy: cantidadHoy
    };
  } catch (error) {
    console.error("Error en getEstadisticasRapidas service:", error);
    return {
      totalVentasHoy: 0,
      totalVentasMes: 0,
      promedioVenta: 0,
      cantidadVentasHoy: 0
    };
  }
};

// ============================================
// GET - TIENDAS DISPONIBLES
// ============================================

const getTiendas = async (negocioId) => {
  try {
    if (!negocioId) {
      return [];
    }

    const result = await query(
      `
      SELECT 
        id_tienda as id,
        nombre_tienda as nombre,
        celular as celular
      FROM tienda
      WHERE id_negocio = $1 AND estado = 'activo'
      ORDER BY nombre_tienda
      `,
      [parseInt(negocioId)]
    );

    return result.rows.map(row => ({
      id: row.id.toString(),
      nombre: row.nombre,
      celular: row.celular || ''
    }));
  } catch (error) {
    console.error("Error en getTiendas service:", error);
    return [];
  }
};

// ============================================
// GET - MÉTODOS DE PAGO DISPONIBLES
// ============================================

const getMetodosPago = async () => {
  try {
    return ["all", "efectivo", "qr", "mixto"];
  } catch (error) {
    console.error("Error en getMetodosPago service:", error);
    return ["all"];
  }
};

// ============================================
// GET - TIPOS DE FILTRO DE FECHA
// ============================================

const getTiposFiltroFecha = async () => {
  try {
    return ["all", "today", "yesterday", "thisWeek", "lastWeek", "thisMonth", "lastMonth", "specific", "range"];
  } catch (error) {
    console.error("Error en getTiposFiltroFecha service:", error);
    return ["all"];
  }
};

// ============================================
// HELPER: REINGRESAR STOCK DE UN MATERIAL
// ============================================
// Reglas:
//   - Si NO existe registro en material_tienda → no controla stock → no reingresa (return false)
//   - Si existe registro → reingresa cantidad y registra movimiento
// Devuelve true si se reingresó, false si no se controlaba stock.

const reingresarStockMaterial = async (client, idMaterial, tiendaId, cantidad, userId, descripcion) => {
  if (!idMaterial || cantidad <= 0) return false;

  const stockResult = await client.query(
    `
    SELECT stock, id_material_tienda
    FROM material_tienda
    WHERE id_material = $1 AND id_tienda = $2
    `,
    [parseInt(idMaterial), parseInt(tiendaId)]
  );

  if (stockResult.rows.length === 0) {
    // No hay registro → material sin control de stock → no reingresa
    console.log(`ℹ️ Material ${idMaterial} sin registro en tienda ${tiendaId}. No se reingresa stock.`);
    return false;
  }

  const stockAnterior = parseInt(stockResult.rows[0].stock) || 0;
  const idMaterialTienda = stockResult.rows[0].id_material_tienda;
  const stockNuevo = stockAnterior + cantidad;

  await client.query(
    `
    UPDATE material_tienda
    SET stock = $1
    WHERE id_material_tienda = $2
    `,
    [stockNuevo, idMaterialTienda]
  );

  await client.query(
    `
    INSERT INTO movimientos_stock (
      id_material_tienda,
      id_usuario,
      cantidad_anterior,
      cantidad_nueva,
      cantidad_modificada,
      fecha_movimiento
    )
    VALUES ($1, $2, $3, $4, $5, TIMEZONE('America/La_Paz', NOW()))
    `,
    [idMaterialTienda, userId, stockAnterior, stockNuevo, cantidad]
  );

  console.log(`✅ Stock reingresado: Material ${idMaterial}, Tienda ${tiendaId}, ${cantidad} unidades (${stockAnterior} → ${stockNuevo}). ${descripcion || ''}`);
  return true;
};

// ============================================
// DELETE - ANULAR VENTA (CON REINGRESO COMPLETO DE STOCK)
// ============================================

const anularVenta = async (id, userInfo) => {
  const { negocioId, userId, username } = userInfo;

  console.log("🔍 anularVenta service - id:", id, "userInfo:", userInfo);

  const idNum = parseInt(id);
  if (isNaN(idNum)) {
    throw new Error("ID de venta inválido");
  }

  if (!negocioId) {
    throw new Error("Negocio ID es requerido");
  }

  if (!userId) {
    throw new Error("Usuario ID es requerido para registrar movimientos de stock");
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. VERIFICAR QUE LA VENTA EXISTA Y PERTENEZCA AL NEGOCIO
    const ventaResult = await client.query(
      `
      SELECT 
        v.id_venta,
        v.id_pedido,
        v.monto_efectivo,
        v.monto_qr,
        v.fecha_hora,
        p.id_tienda,
        p.total,
        p.sub_total,
        p.descuento,
        p.motivo_descripcion,
        p.id_cliente,
        p.codigo_pedido
      FROM venta v
      INNER JOIN pedido p ON v.id_pedido = p.id_pedido
      INNER JOIN tienda t ON p.id_tienda = t.id_tienda
      WHERE v.id_venta = $1 AND t.id_negocio = $2
      `,
      [idNum, parseInt(negocioId)]
    );

    if (ventaResult.rows.length === 0) {
      throw new Error("Venta no encontrada o no pertenece al negocio");
    }

    const venta = ventaResult.rows[0];
    const idPedido = venta.id_pedido;
    const tiendaIdPedido = venta.id_tienda;
    const totalEfectivoVenta = parseFloat(venta.monto_efectivo || 0);
    const totalQRVenta = parseFloat(venta.monto_qr || 0);

    console.log(`💰 Venta ${venta.codigo_pedido} - Efectivo: ${totalEfectivoVenta} Bs, QR: ${totalQRVenta} Bs`);

    // 2. OBTENER LA ENTREGA PENDIENTE
    const entregaResult = await client.query(
      `
      SELECT id_entrega_pendiente 
      FROM entrega_pendiente 
      WHERE id_pedido = $1
      `,
      [idPedido]
    );

    const idEntrega = entregaResult.rows.length > 0 ? entregaResult.rows[0].id_entrega_pendiente : null;

    // 3. REINGRESAR STOCK DE LENTES (MONTURA, FRANELA, ESTUCHE)
    //    Cada lente descontó 1 unidad de montura, 1 de franela y 1 de estuche al vender.
    if (idEntrega) {
      const lentesEntrega = await client.query(
        `
        SELECT 
          edl.id_lente,
          l.id_montura,
          l.id_franela,
          l.id_estuche,
          l.tipo_lente
        FROM entrega_detalle_lente edl
        INNER JOIN lente l ON edl.id_lente = l.id_lente
        WHERE edl.id_entrega_pendiente = $1
        `,
        [idEntrega]
      );

      for (const lente of lentesEntrega.rows) {
        if (lente.id_montura) {
          await reingresarStockMaterial(
            client,
            lente.id_montura,
            tiendaIdPedido,
            1,
            userId,
            `Anulación venta ${venta.codigo_pedido} - Montura lente ${lente.tipo_lente}`
          );
        }
        if (lente.id_franela) {
          await reingresarStockMaterial(
            client,
            lente.id_franela,
            tiendaIdPedido,
            1,
            userId,
            `Anulación venta ${venta.codigo_pedido} - Franela lente ${lente.tipo_lente}`
          );
        }
        if (lente.id_estuche) {
          await reingresarStockMaterial(
            client,
            lente.id_estuche,
            tiendaIdPedido,
            1,
            userId,
            `Anulación venta ${venta.codigo_pedido} - Estuche lente ${lente.tipo_lente}`
          );
        }
      }
    }

    // 4. REINGRESAR STOCK DE PRODUCTOS ADICIONALES
    //    Cada producto descontó `cantidad` unidades al vender.
    if (idEntrega) {
      const materialesEntrega = await client.query(
        `
        SELECT 
          edm.id_material,
          edm.cantidad
        FROM entrega_detalle_material edm
        WHERE edm.id_entrega_pendiente = $1
        `,
        [idEntrega]
      );

      for (const mat of materialesEntrega.rows) {
        const cantidad = parseInt(mat.cantidad) || 1;
        await reingresarStockMaterial(
          client,
          mat.id_material,
          tiendaIdPedido,
          cantidad,
          userId,
          `Anulación venta ${venta.codigo_pedido} - Producto adicional`
        );
      }
    }

    // 5. ELIMINAR DETALLES DE LENTES Y OBTENER IDs DE LENTES PARA BORRAR
    let idsLentesAEliminar = [];
    if (idEntrega) {
      const lentesIdsResult = await client.query(
        `SELECT id_lente FROM entrega_detalle_lente WHERE id_entrega_pendiente = $1`,
        [idEntrega]
      );
      idsLentesAEliminar = lentesIdsResult.rows.map(r => r.id_lente);

      await client.query(
        `DELETE FROM entrega_detalle_lente WHERE id_entrega_pendiente = $1`,
        [idEntrega]
      );

      // 6. ELIMINAR DETALLES DE MATERIALES
      await client.query(
        `DELETE FROM entrega_detalle_material WHERE id_entrega_pendiente = $1`,
        [idEntrega]
      );

      // 7. ELIMINAR LA ENTREGA PENDIENTE
      await client.query(
        `DELETE FROM entrega_pendiente WHERE id_entrega_pendiente = $1`,
        [idEntrega]
      );
    }

    // 8. ELIMINAR LOS REGISTROS DE LENTE (evita huérfanos)
    if (idsLentesAEliminar.length > 0) {
      await client.query(
        `DELETE FROM lente WHERE id_lente = ANY($1::int[])`,
        [idsLentesAEliminar]
      );
      console.log(`✅ Eliminados ${idsLentesAEliminar.length} registros de lente`);
    }

    // 9. OBTENER LA CAJA DE LA TIENDA
    const cajaResult = await client.query(
      `
      SELECT id_caja, total 
      FROM caja 
      WHERE id_tienda = $1
      `,
      [tiendaIdPedido]
    );

    if (cajaResult.rows.length === 0) {
      throw new Error("No se encontró la caja de la tienda");
    }

    const caja = cajaResult.rows[0];
    const idCaja = caja.id_caja;

    // 10. OBTENER EL TOTAL ACTUAL DE LA CAJA
    const cajaActual = await client.query(
      `SELECT total FROM caja WHERE id_caja = $1`,
      [idCaja]
    );
    const totalActual = parseFloat(cajaActual.rows[0]?.total || 0);

    // 11. SI HAY EFECTIVO QUE DEVOLVER, RESTAR DE LA CAJA
    if (totalEfectivoVenta > 0) {
      const nuevoTotal = Math.max(0, totalActual - totalEfectivoVenta);

      console.log(`💰 Caja: total actual ${totalActual} Bs, restando ${totalEfectivoVenta} Bs = ${nuevoTotal} Bs`);

      await client.query(
        `
        UPDATE caja 
        SET total = $1 
        WHERE id_caja = $2
        `,
        [nuevoTotal, idCaja]
      );

      await client.query(
        `
        INSERT INTO transaccion_caja (
          id_caja,
          id_usuario,
          monto_nuevo,
          monto_anterior,
          monto,
          tipo_movimiento,
          descripcion,
          id_venta,
          fecha
        )
        VALUES (
          $1, 
          $2, 
          $3,
          $4,
          $5,
          'egreso',
          $6,
          $7,
          TIMEZONE('America/La_Paz', NOW())
        )
        `,
        [
          idCaja,
          userId,
          nuevoTotal,
          totalActual,
          totalEfectivoVenta,
          `ANULACIÓN - Devolución efectivo Venta ${venta.codigo_pedido}`,
          idNum
        ]
      );

      console.log(`✅ Registrado egreso de ${totalEfectivoVenta} Bs por anulación`);
    }

    // 12. ELIMINAR LA TRANSACCIÓN ORIGINAL DE CAJA (si existe)
    await client.query(
      `DELETE FROM transaccion_caja WHERE id_venta = $1 AND id_caja = $2`,
      [idNum, idCaja]
    );
    console.log(`✅ Eliminada transacción de caja original`);

    // 13. ELIMINAR EL REGISTRO DE VENTA
    await client.query(
      `DELETE FROM venta WHERE id_venta = $1`,
      [idNum]
    );

    // 14. VERIFICAR SI QUEDAN MÁS VENTAS PARA ESTE PEDIDO
    const ventasRestantes = await client.query(
      `SELECT COUNT(*) as total FROM venta WHERE id_pedido = $1`,
      [idPedido]
    );

    const restantes = parseInt(ventasRestantes.rows[0]?.total || 0);

    // 15. SI NO QUEDAN MÁS VENTAS, ELIMINAR EL PEDIDO
    if (restantes === 0) {
      await client.query(
        `DELETE FROM pago_pendiente WHERE id_pedido = $1`,
        [idPedido]
      );

      await client.query(
        `DELETE FROM pedido WHERE id_pedido = $1`,
        [idPedido]
      );
      console.log(`✅ Pedido ${venta.codigo_pedido} eliminado (sin ventas restantes)`);
    } else {
      console.log(`ℹ️ Quedan ${restantes} ventas para el pedido ${venta.codigo_pedido}, no se elimina`);
    }

    await client.query('COMMIT');

    console.log(`✅ Venta ${venta.codigo_pedido} anulada correctamente por ${username}`);
    console.log(`💰 Efectivo devuelto: ${totalEfectivoVenta} Bs`);
    console.log(`💰 QR devuelto: ${totalQRVenta} Bs (no afecta caja)`);

    return {
      success: true,
      message: `Venta ${venta.codigo_pedido} anulada correctamente`,
      codigoVenta: venta.codigo_pedido,
      efectivoDevuelto: totalEfectivoVenta,
      qrDevuelto: totalQRVenta
    };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("❌ Error en anularVenta service:", error);
    throw new Error(error.message || "Error al anular la venta");
  } finally {
    client.release();
  }
};

module.exports = {
  getVentas,
  getVentaById,
  getVentasByCodigo,
  getVentasByCliente,
  getResumenVentas,
  getResumenClientes,
  getEstadisticasRapidas,
  getTiendas,
  getMetodosPago,
  getTiposFiltroFecha,
  anularVenta
};