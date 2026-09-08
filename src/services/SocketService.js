// src/services/SocketService.js
const { emitEvent } = require('../socket');

class SocketService {
  /**
   * Notifica una nueva venta
   */
  static notifyNewSale(saleData, userInfo) {
    emitEvent('nueva-venta', {
      ...saleData,
      timestamp: new Date().toISOString(),
      usuario: userInfo?.username || 'sistema'
    }, {
      negocioId: userInfo?.negocioId,
      tiendaId: userInfo?.tiendaId
    });
  }

  /**
   * Notifica una venta anulada
   */
  static notifyVoidedSale(saleData, userInfo) {
    emitEvent('venta-anulada', {
      ...saleData,
      timestamp: new Date().toISOString(),
      usuario: userInfo?.username || 'sistema'
    }, {
      negocioId: userInfo?.negocioId,
      tiendaId: userInfo?.tiendaId
    });
  }

  /**
   * Notifica actualización de inventario
   */
  static notifyInventoryUpdate(productData, userInfo) {
    emitEvent('inventario-actualizado', {
      ...productData,
      timestamp: new Date().toISOString()
    }, {
      negocioId: userInfo?.negocioId,
      tiendaId: userInfo?.tiendaId
    });
  }

  /**
   * Notifica actualización de cliente
   */
  static notifyClientUpdate(clientData, userInfo) {
    emitEvent('cliente-actualizado', {
      ...clientData,
      timestamp: new Date().toISOString()
    }, {
      negocioId: userInfo?.negocioId,
      tiendaId: userInfo?.tiendaId
    });
  }

  /**
   * Notifica cambio en pagos pendientes
   */
  static notifyPendingPayment(paymentData, userInfo) {
    emitEvent('pago-pendiente-actualizado', {
      ...paymentData,
      timestamp: new Date().toISOString()
    }, {
      negocioId: userInfo?.negocioId,
      tiendaId: userInfo?.tiendaId
    });
  }

  /**
   * Notifica cambio en entregas pendientes
   */
  static notifyPendingDelivery(deliveryData, userInfo) {
    emitEvent('entrega-pendiente-actualizada', {
      ...deliveryData,
      timestamp: new Date().toISOString()
    }, {
      negocioId: userInfo?.negocioId,
      tiendaId: userInfo?.tiendaId
    });
  }

  /**
   * Notifica cambio en caja
   */
  static notifyCashRegister(cashData, userInfo) {
    emitEvent('caja-actualizada', {
      ...cashData,
      timestamp: new Date().toISOString()
    }, {
      negocioId: userInfo?.negocioId,
      tiendaId: userInfo?.tiendaId
    });
  }

  /**
   * Notifica actualización general (para refrescar dashboards)
   */
  static notifyRefresh(module, userInfo) {
    emitEvent('refresh', {
      module,
      timestamp: new Date().toISOString()
    }, {
      negocioId: userInfo?.negocioId,
      tiendaId: userInfo?.tiendaId
    });
  }
}

module.exports = SocketService;