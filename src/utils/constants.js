// Jerarquía de estados de pedidos (no se puede retroceder)
const JERARQUIA_ESTADOS = {
  'pendiente': 1,
  'recibido': 2,
  'en_proceso': 3,
  'facturado': 4,
  'entregado_transportadora': 5,
  'en_transito': 6,
  'entregado_cliente': 7,
  'confirmado_qr': 8   // conservado por compatibilidad con pedidos históricos
};

// Tipos de notificaciones
const TIPOS_NOTIFICACION = {
  PEDIDO_CREADO: 'pedido_creado',
  CAMBIO_ESTADO: 'cambio_estado',
  ENTREGA_TRANSPORTADORA: 'entrega_transportadora',
  ENTREGADO: 'entregado',
  PEDIDO_PENDIENTE: 'pedido_pendiente'
};

// Roles de usuario
const ROLES = {
  CLIENTE: 'cliente',
  VENDEDOR: 'vendedor',
  ADMIN: 'admin'
};

// Estados de pedido activos (confirmado_qr solo existe por datos históricos)
const ESTADOS_PEDIDO = {
  PENDIENTE: 'pendiente',
  RECIBIDO: 'recibido',
  EN_PROCESO: 'en_proceso',
  FACTURADO: 'facturado',
  ENTREGADO_TRANSPORTADORA: 'entregado_transportadora',
  EN_TRANSITO: 'en_transito',
  ENTREGADO_CLIENTE: 'entregado_cliente'
};

// Origen de cambio de estado
const ORIGEN_ESTADO = {
  MANUAL: 'manual',
  AUTOMATICO: 'automatico',
  TRANSPORTADORA: 'transportadora'
};

module.exports = {
  JERARQUIA_ESTADOS,
  TIPOS_NOTIFICACION,
  ROLES,
  ESTADOS_PEDIDO,
  ORIGEN_ESTADO
};