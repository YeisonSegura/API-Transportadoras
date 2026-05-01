const { getFirebaseAdmin, isFirebaseInitialized } = require('../config/firebase');
const { pool } = require('../config/database');

/**
 * Envía una notificación push mediante Firebase Cloud Messaging
 */
async function enviarNotificacionPush(fcmToken, titulo, mensaje, data = {}) {
  if (!fcmToken || fcmToken === null || fcmToken === 'LOGGED_OUT') {
    console.log('⚠️ Token FCM no disponible o sesión cerrada, notificación no enviada');
    return false;
  }

  if (!isFirebaseInitialized()) {
    console.log('⚠️ Firebase no inicializado, notificación no enviada');
    console.log('   Configura firebase-service-account.json en el servidor');
    return false;
  }

  try {
    const admin = getFirebaseAdmin();
    const message = {
      token: fcmToken,
      notification: {
        title: titulo,
        body: mensaje
      },
      data: {
        ...data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'orders_channel'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    // Convertir todos los valores de data a strings (requisito de FCM)
    if (message.data) {
      Object.keys(message.data).forEach(key => {
        if (message.data[key] !== null && message.data[key] !== undefined) {
          message.data[key] = String(message.data[key]);
        }
      });
    }

    const response = await admin.messaging().send(message);
    console.log(`✅ Notificación push enviada: "${titulo}" - ID: ${response}`);
    return true;
  } catch (error) {
    console.error('❌ Error al enviar notificación FCM:', error.message);
    if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered') {
      console.log('   Token FCM inválido o expirado');
    }
    return false;
  }
}

/**
 * Envía una notificación a un usuario específico
 */
async function enviarNotificacionAUsuario(usuarioId, titulo, mensaje, pedidoId = null) {
  try {
    const [usuarios] = await pool.query(
      'SELECT token_fcm FROM usuarios WHERE id = ? AND token_fcm IS NOT NULL',
      [usuarioId]
    );

    if (usuarios.length > 0 && usuarios[0].token_fcm) {
      await enviarNotificacionPush(
        usuarios[0].token_fcm,
        titulo,
        mensaje,
        { pedido_id: pedidoId ? pedidoId.toString() : null }
      );
    }
  } catch (error) {
    console.error('Error al enviar notificación a usuario:', error.message);
  }
}

/**
 * Crea una notificación en la base de datos
 */
async function crearNotificacion(connection, usuarioId, pedidoId, tipo, titulo, mensaje) {
  try {
    await connection.query(
      `INSERT INTO notificaciones (usuario_id, pedido_id, tipo, titulo, mensaje)
       VALUES (?, ?, ?, ?, ?)`,
      [usuarioId, pedidoId, tipo, titulo, mensaje]
    );
  } catch (error) {
    console.error('Error al crear notificación en BD:', error.message);
    throw error;
  }
}

/**
 * Notifica a todos los administradores
 */
async function notificarAdministradores(connection, pedidoId, tipo, titulo, mensaje) {
  try {
    const [admins] = await connection.query(
      'SELECT id FROM usuarios WHERE rol = "admin"'
    );

    for (const admin of admins) {
      await crearNotificacion(connection, admin.id, pedidoId, tipo, titulo, mensaje);
      await enviarNotificacionAUsuario(admin.id, titulo, mensaje, pedidoId);
    }
  } catch (error) {
    console.error('Error al notificar administradores:', error.message);
    throw error;
  }
}

module.exports = {
  enviarNotificacionPush,
  enviarNotificacionAUsuario,
  crearNotificacion,
  notificarAdministradores
};
