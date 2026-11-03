// src/services/loginservice.js
const { query } = require("../../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const authenticateUser = async (username, password) => {
  try {
    console.log("=== authenticateUser ===");
    console.log("Username:", username);
    
    const userQuery = `
      SELECT 
        u.id_usuario,
        u.id_persona,
        u.usuario,
        u.password,
        u.id_rol,
        u.estado,
        p.nombre,
        p.apellido,
        p.celular,
        r.nombre as rol_nombre
      FROM usuario u
      INNER JOIN persona p ON u.id_persona = p.id_persona
      INNER JOIN rol r ON u.id_rol = r.id_rol
      WHERE u.usuario = $1
    `;

    const result = await query(userQuery, [username]);

    if (result.rows.length === 0) {
      return { success: false, message: "Usuario no encontrado" };
    }

    const user = result.rows[0];

    if (user.estado !== 'activo') {
      return { success: false, message: "Usuario inactivo" };
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return { success: false, message: "Credenciales incorrectas" };
    }

    let stores = [];
    
    if (user.rol_nombre === 'Spider Admin') {
      stores = [];
    } else {
      const storesQuery = `
        SELECT 
          t.id_tienda,
          t.nombre_tienda,
          t.id_negocio,
          n.nombre_negocio,
          t.estado,
          t.logo,
          t.fecha_pago,
          t.precio,
          t.cant_usuarios
        FROM usuario_tienda ut
        INNER JOIN tienda t ON ut.id_tienda = t.id_tienda
        INNER JOIN negocio n ON t.id_negocio = n.id_negocio
        WHERE ut.id_usuario = $1
        AND t.estado = 'activo'
      `;

      const storesResult = await query(storesQuery, [user.id_usuario]);
      stores = storesResult.rows;

      if (stores.length === 0) {
        return { success: false, message: "Usuario sin tiendas activas" };
      }
    }

    const permissionsQuery = `
      SELECT p.nombre as permiso_nombre, up.tipo
      FROM usuario_permiso up
      INNER JOIN permiso p ON up.id_permiso = p.id_permiso
      WHERE up.id_usuario = $1
      UNION
      SELECT p.nombre as permiso_nombre, 'concedido' as tipo
      FROM rol_permiso rp
      INNER JOIN permiso p ON rp.id_permiso = p.id_permiso
      WHERE rp.id_rol = $2
    `;

    const permissionsResult = await query(permissionsQuery, [user.id_usuario, user.id_rol]);

    const grantedPermissions = permissionsResult.rows
      .filter(row => row.tipo === 'concedido')
      .map(row => row.permiso_nombre);

    const revokedPermissions = permissionsResult.rows
      .filter(row => row.tipo === 'revocado')
      .map(row => row.permiso_nombre);

    const storesWithLogo = stores.map(s => ({
      id_tienda: s.id_tienda,
      nombre_tienda: s.nombre_tienda,
      id_negocio: s.id_negocio,
      nombre_negocio: s.nombre_negocio,
      estado: s.estado,
      logo: s.logo ? s.logo.toString('base64') : null,
      fecha_pago: s.fecha_pago,
      precio: s.precio ? parseFloat(s.precio) : null,
      cant_usuarios: s.cant_usuarios
    }));

    let fechaPagoVencida = false;
    let fechaPagoPrincipal = null;
    
    if (storesWithLogo.length > 0 && storesWithLogo[0].fecha_pago) {
      const fp = new Date(storesWithLogo[0].fecha_pago);
      fechaPagoPrincipal = fp.toISOString();
      
      const hoyStr = new Date().toISOString().split("T")[0];
      const fpStr = fp.toISOString().split("T")[0];
      fechaPagoVencida = fpStr <= hoyStr;

      // ============================================
      // REGLA: Bloquear si venció hace más de 60 días
      // ============================================
      const hoy = new Date();
      const diffTime = Math.abs(hoy.getTime() - fp.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (fechaPagoVencida && diffDays > 60) {
        console.log(`[login] Bloqueado. Fecha de pago vencida hace ${diffDays} días.`);
        
        // Formatear la fecha de pago para mostrarla en el mensaje
        const fechaFormateada = fp.toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });

        return {
          success: false,
          code: "CUENTA_SUSPENDIDA",
          message: `La fecha de pago ha expirado hace más de 2 meses (fecha de pago: ${fechaFormateada}). Contacte a soporte para reactivar su cuenta.`
        };
      }
    }

    const token = jwt.sign(
      {
        id_usuario: user.id_usuario,
        id_persona: user.id_persona,
        usuario: user.usuario,
        rol: user.rol_nombre,
        id_rol: user.id_rol
      },
      process.env.JWT_SECRET || "opticavision-secret-key-2024",
      { expiresIn: "12h" }
    );

    const userData = {
      id_usuario: user.id_usuario,
      id_persona: user.id_persona,
      username: user.usuario,
      name: user.nombre,
      lastname: user.apellido,
      role: user.rol_nombre,
      id_rol: user.id_rol,
      phoneNumber: user.celular,
      status: user.estado,
      grantedPermissions,
      revokedPermissions,
      tiendaIds: storesWithLogo.map(s => s.id_tienda),
      tiendaNombre: storesWithLogo.length > 0 ? storesWithLogo[0].nombre_tienda : null,
      negocioId: storesWithLogo.length > 0 ? storesWithLogo[0].id_negocio : null,
      stores: storesWithLogo,
      fechaPago: fechaPagoPrincipal,
      fechaPagoVencida: fechaPagoVencida,
      isSpiderAdmin: user.rol_nombre === 'Spider Admin'
    };

    return {
      success: true,
      message: "Autenticación exitosa",
      token,
      user: userData,
      stores: storesWithLogo,
      negocioId: storesWithLogo.length > 0 ? storesWithLogo[0].id_negocio : null
    };

  } catch (error) {
    console.error("Error en authService:", error);
    throw new Error("Error al autenticar usuario");
  }
};

const getUserStores = async (userId, userRole) => {
  try {
    if (userRole === 'Spider Admin') return [];
    
    const storesQuery = `
      SELECT 
        t.id_tienda,
        t.nombre_tienda,
        t.id_negocio,
        n.nombre_negocio,
        t.estado,
        t.logo,
        t.fecha_pago,
        t.precio,
        t.cant_usuarios
      FROM usuario_tienda ut
      INNER JOIN tienda t ON ut.id_tienda = t.id_tienda
      INNER JOIN negocio n ON t.id_negocio = n.id_negocio
      WHERE ut.id_usuario = $1 AND t.estado = 'activo'
    `;

    const result = await query(storesQuery, [userId]);
    return result.rows.map(s => ({
      id_tienda: s.id_tienda,
      nombre_tienda: s.nombre_tienda,
      id_negocio: s.id_negocio,
      nombre_negocio: s.nombre_negocio,
      estado: s.estado,
      logo: s.logo ? s.logo.toString('base64') : null,
      fecha_pago: s.fecha_pago,
      precio: s.precio ? parseFloat(s.precio) : null,
      cant_usuarios: s.cant_usuarios
    }));
  } catch (error) {
    console.error("Error al obtener tiendas:", error);
    return [];
  }
};

const changePassword = async (userId, currentPassword, newPassword) => {
  try {
    const userQuery = `SELECT password FROM usuario WHERE id_usuario = $1`;
    const result = await query(userQuery, [userId]);
    if (result.rows.length === 0) return { success: false, message: "Usuario no encontrado" };

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) return { success: false, message: "Contraseña actual incorrecta" };

    if (newPassword.length < 6) {
      return { success: false, message: "La nueva contraseña debe tener al menos 6 caracteres" };
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await query(`UPDATE usuario SET password = $1 WHERE id_usuario = $2`, [hashedPassword, userId]);
    return { success: true, message: "Contraseña cambiada exitosamente" };
  } catch (error) {
    console.error("Error al cambiar contraseña:", error);
    throw new Error("Error al cambiar contraseña");
  }
};

const getUsuarioByUsername = async (username) => {
  try {
    const userQuery = `
      SELECT u.*, p.nombre, p.apellido, p.celular, r.nombre as rol_nombre
      FROM usuario u
      INNER JOIN persona p ON u.id_persona = p.id_persona
      INNER JOIN rol r ON u.id_rol = r.id_rol
      WHERE u.usuario = $1
    `;
    const result = await query(userQuery, [username]);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error("Error al obtener usuario:", error);
    return null;
  }
};

module.exports = {
  authenticateUser,
  getUserStores,
  changePassword,
  getUsuarioByUsername
};