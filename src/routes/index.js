const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const usuarioRoutes = require('./usuarioRoutes');
const pedidoRoutes = require('./pedidoRoutes');
const notificacionRoutes = require('./notificacionRoutes');
const statsRoutes = require('./statsRoutes');
const scrapingRoutes = require('./scrapingRoutes');
const transportadoraRoutes = require('./transportadoraRoutes');
const configuracionRoutes = require('./configuracionRoutes');
const estadoPedidoRoutes = require('./estadoPedidoRoutes');

router.use('/auth', authRoutes);
router.use('/usuarios', usuarioRoutes);
router.use('/pedidos', pedidoRoutes);
router.use('/notificaciones', notificacionRoutes);
router.use('/stats', statsRoutes);
router.use('/rastrear-guia', scrapingRoutes);
router.use('/transportadoras', transportadoraRoutes);
router.use('/configuracion', configuracionRoutes);
router.use('/estados-pedido', estadoPedidoRoutes);

module.exports = router;