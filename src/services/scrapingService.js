const axios = require('axios');
const cheerio = require('cheerio');
const pdfParse = require('pdf-parse'); // ✅ Importación simple y directa
const { SCRAPING_TIMEOUT } = require('../config/env');

/**
 * Consulta el rastreo de una guía en Copetran
 */
async function rastrearGuiaCopetran(numeroGuia) {
  try {
    console.log(`🔍 Consultando guía Copetran: ${numeroGuia}`);

    const sessionResponse = await axios.get(
      'https://autogestion.copetran.com.co/gestion_2/Forms/trakingRemesas.php',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8',
        }
      }
    );

    const cookies = sessionResponse.headers['set-cookie'];
    const cookieString = cookies ? cookies.join('; ') : '';

    console.log('✅ Sesión establecida');

    const formData = new URLSearchParams({
      'PR00': numeroGuia,
      'Archivo': 'Remesas',
      'Clase': 'Remesas',
      'Funcion': 'trakingRemesas',
      'PR20': '',
      'PR01': 'true',
      'Boton': 'Boton'
    });

    const response = await axios.post(
      'https://autogestion.copetran.com.co/gestion_2/controller/controlador.php',
      formData.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookieString,
          'Referer': 'https://autogestion.copetran.com.co/gestion_2/Forms/trakingRemesas.php',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8',
        },
        timeout: SCRAPING_TIMEOUT
      }
    );

    console.log('✅ Respuesta recibida de Copetran');

    const htmlContent = response.data || '';
    const lowerHtml = htmlContent.toLowerCase();
    const noResultPhrases = [
      'no se encontraron',
      'no se encontraron remesas',
      'no existe remesa',
      'la remesa consultada no existe',
      'remesa consultada no existe',
      'la remesa consultada',
      'no se encontro',
      'no hay registros',
      'sin resultados',
    ];

    const hasNoResults = noResultPhrases.some((p) => lowerHtml.includes(p));

    if (hasNoResults) {
      console.log('⚠️ Copetran devolvió página sin resultados');
      return {
        success: false,
        error: 'No se encontraron datos para esta guía',
        numeroGuia: numeroGuia,
        transportadora: 'copetran'
      };
    }

    return {
      success: true,
      html: htmlContent,
      numeroGuia: numeroGuia,
      transportadora: 'copetran',
      tipo: 'html'
    };

  } catch (error) {
    console.error('❌ Error Copetran:', error.message);

    if (error.code === 'ECONNABORTED') {
      return {
        success: false,
        error: 'Tiempo de espera agotado al consultar Copetran'
      };
    }

    if (error.response) {
      return {
        success: false,
        error: `Error del servidor de Copetran: ${error.response.status}`
      };
    }

    return {
      success: false,
      error: 'Error al consultar la guía',
      details: error.message
    };
  }
}

/**
 * Consulta el rastreo de una guía en Transmoralar - EXTRAE DATOS DEL PDF
 */
async function rastrearGuiaTransmoralar(numeroGuia) {
  try {
    const guiaLimpia = numeroGuia.toString().trim();
    console.log(`🔍 Consultando guía Transmoralar: ${guiaLimpia}`);

    // ✅ Nueva URL de Transmoralar (la anterior softwareparati.com está caída)
    const reportUrl = `https://transmoralar.com.co/Status/consulta-remesa.php?q=${guiaLimpia}`;

    console.log(`📡 Consultando URL: ${reportUrl}`);

    const response = await axios.get(reportUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8',
        'Referer': 'https://transmoralar.com.co/',
      },
      timeout: SCRAPING_TIMEOUT,
      maxRedirects: 5,
    });

    console.log(`✅ Respuesta recibida (${response.status})`);

    const htmlContent = response.data || '';

    if (!htmlContent || htmlContent.length < 200) {
      console.log('⚠️ Respuesta vacía o muy corta');
      return {
        success: false,
        error: 'No se encontraron datos para esta guía',
        numeroGuia: guiaLimpia,
        transportadora: 'transmoralar'
      };
    }

    // ✅ Extraer datos desde HTML con cheerio
    const datosCompletos = extraerDatosDesdeHtmlTransmoralar(htmlContent, guiaLimpia);

    console.log('📊 Datos extraídos:', JSON.stringify(datosCompletos, null, 2));

    if (!datosCompletos.estadoActual || datosCompletos.estadoActual === 'DESCONOCIDO') {
      console.log('⚠️ No se encontraron datos válidos para la guía');
      return {
        success: false,
        error: 'No se encontraron datos para esta guía',
        numeroGuia: guiaLimpia,
        transportadora: 'transmoralar'
      };
    }

    return {
      success: true,
      html: htmlContent,
      numeroGuia: guiaLimpia,
      transportadora: 'transmoralar',
      tipo: 'html',
      url: reportUrl,
      datos: datosCompletos
    };

  } catch (error) {
    console.error('❌ Error Transmoralar:', error.message);

    if (error.code === 'ECONNABORTED') {
      return {
        success: false,
        error: 'Tiempo de espera agotado al consultar Transmoralar',
        numeroGuia: numeroGuia.toString().trim(),
        transportadora: 'transmoralar'
      };
    }

    if (error.response) {
      return {
        success: false,
        error: `Error del servidor de Transmoralar: ${error.response.status}`,
        numeroGuia: numeroGuia.toString().trim(),
        transportadora: 'transmoralar'
      };
    }

    return {
      success: false,
      error: 'Error al consultar la guía',
      details: error.message,
      numeroGuia: numeroGuia.toString().trim(),
      transportadora: 'transmoralar'
    };
  }
}

/**
 * ✅ NUEVA: Extrae datos desde el HTML de la página de Transmoralar (scraping HTML)
 * Estructura de la página:
 *   - table.tabla-info-remesa  → filas con td.etiqueta-estado-guia/td.dato-estado-guia y td.dato
 *   - table.tabla-rastreo-remesa → historial: Fecha | Hora | Ciudad | Estado | Causal
 */
function extraerDatosDesdeHtmlTransmoralar(html, numeroGuia) {
  const datos = {
    numeroGuia: numeroGuia,
    remitente: { nombre: '', origen: '' },
    destinatario: { nombre: '', destino: '', direccion: '', telefono: '' },
    estadoActual: '',
    estadoActualIcono: '',
    estadoActualDescripcion: '',
    historial: [],
    fechaCreacion: '',
    fechaEntrega: ''
  };

  try {
    const $ = cheerio.load(html);

    // ── 1. Tabla de información (tabla-info-remesa) ──
    const tablaInfo = $('table.tabla-info-remesa');

    tablaInfo.find('tr').each((_, fila) => {
      const celdas = $(fila).find('td');
      if (celdas.length < 3) return;

      const etiqueta = $(celdas[0]).text().trim().toLowerCase();
      const valor    = $(celdas[2]).text().trim();

      if (!valor) return;

      if (etiqueta.includes('estado')) {
        datos.estadoActual = valor;
      } else if (etiqueta.includes('remite')) {
        datos.remitente.nombre = valor;
      } else if (etiqueta.includes('ciudad origen') || etiqueta.includes('origen')) {
        datos.remitente.origen = valor;
      } else if (etiqueta.includes('destinatario')) {
        datos.destinatario.nombre = valor;
      } else if (etiqueta.includes('ciudad destino') || etiqueta.includes('destino')) {
        datos.destinatario.destino = valor;
      } else if (etiqueta.includes('dirección') || etiqueta.includes('direccion')) {
        datos.destinatario.direccion = valor;
      } else if (etiqueta.includes('teléfono') || etiqueta.includes('telefono')) {
        datos.destinatario.telefono = valor;
      } else if (etiqueta.includes('fecha envío') || etiqueta.includes('fecha envio')) {
        datos.fechaCreacion = valor;
      } else if (etiqueta.includes('fecha entrega')) {
        datos.fechaEntrega = valor;
      }
    });

    console.log(`✅ Estado extraído: "${datos.estadoActual}"`);

    // ── 2. Tabla de historial (tabla-rastreo-remesa) ──
    const tablaRastreo = $('table.tabla-rastreo-remesa');
    const historialRaw = [];

    tablaRastreo.find('tr').each((idx, fila) => {
      if (idx === 0) return; // saltar encabezado
      const celdas = $(fila).find('td');
      if (celdas.length < 4) return;

      const fecha  = $(celdas[0]).text().trim();
      const hora   = $(celdas[1]).text().trim();
      const ciudad = $(celdas[2]).text().trim();
      const estado = $(celdas[3]).text().trim();
      const causal = celdas.length >= 5 ? $(celdas[4]).text().trim() : '';

      if (fecha && estado) {
        historialRaw.push({
          estado: estado.toUpperCase(),
          fecha: `${fecha} ${hora}`.trim(),
          ciudad,
          causal,
          detalles: causal && causal !== 'SIN NOVEDAD' ? causal : ciudad
        });
        console.log(`📝 Historial: ${estado} - ${fecha} ${hora} - ${ciudad}`);
      }
    });

    datos.historial = historialRaw;

    // ── 3. Normalizar estado actual ──
    if (datos.estadoActual) {
      datos.estadoActualIcono        = obtenerIconoEstadoTransmoralar(datos.estadoActual);
      datos.estadoActualDescripcion  = datos.estadoActual;
    }

    // Fallback: si no se obtuvo estado desde la tabla info, usar el último del historial
    if (!datos.estadoActual && historialRaw.length > 0) {
      datos.estadoActual = historialRaw[historialRaw.length - 1].estado;
      datos.estadoActualIcono = obtenerIconoEstadoTransmoralar(datos.estadoActual);
    }

    console.log('✅ Extracción HTML Transmoralar completada:', {
      estado: datos.estadoActual,
      historial: datos.historial.length,
      remitente: datos.remitente.nombre,
      destinatario: datos.destinatario.nombre
    });

  } catch (err) {
    console.error('❌ Error extrayendo HTML Transmoralar:', err.message);
    datos.estadoActual = 'DESCONOCIDO';
  }

  return datos;
}

/**
 * Ícono por estado para Transmoralar (nueva versión HTML)
 */
function obtenerIconoEstadoTransmoralar(estado) {
  const e = (estado || '').toUpperCase();
  if (e.includes('ENTREGAD')) return '✅';
  if (e.includes('TRANSITO') || e.includes('TRÁNSITO') || e.includes('NACIONAL')) return '🚚';
  if (e.includes('RUTA')) return '🚐';
  if (e.includes('BODEGA')) return '📦';
  if (e.includes('RECOGID')) return '📋';
  return '📍';
}

// ── Funciones legacy conservadas para compatibilidad con exports ──

/**
 * @deprecated Usar extraerDatosDesdeHtmlTransmoralar en su lugar
 */
function extraerDatosDesdeTextoTransmoralar(texto, numeroGuia) {
  const datos = {
    numeroGuia: numeroGuia,
    remitente: {
      nombre: '',
      origen: '',
      direccion: ''
    },
    destinatario: {
      nombre: '',
      destino: '',
      direccion: '',
      unidad: ''
    },
    estadoActual: '',
    historial: [],
    fechaCreacion: '',
    horaCreacion: ''
  };

  try {
    console.log('🔍 Analizando texto Transmoralar...');

    const textoLimpio = texto.replace(/\r/g, '').trim();
    
    // ✅ Extraer NÚMERO DE GUÍA
    const guiaMatch = textoLimpio.match(/Guia\s*#\s*(\d{10,})/i) || 
                      textoLimpio.match(/^(\d{10,})/m);
    if (guiaMatch) {
      datos.numeroGuia = guiaMatch[1];
      console.log('✅ Guía encontrada:', datos.numeroGuia);
    }

    // ✅ Extraer REMITENTE - Nombre (después de "Datos remitente" y "Nombre:")
    const remitenteNombreMatch = textoLimpio.match(/Datos\s+remitente.*?Nombre:\s*([^\n]+)/is);
    if (remitenteNombreMatch) {
      datos.remitente.nombre = remitenteNombreMatch[1].trim();
      console.log('✅ Remitente nombre:', datos.remitente.nombre);
    }

    // ✅ Extraer ORIGEN (después de "Origen :" hasta el siguiente campo)
    const origenMatch = textoLimpio.match(/Origen\s*:\s*([^\n]+?)(?=Destino:|Unidad:|Nombre:|$)/is);
    if (origenMatch) {
      datos.remitente.origen = origenMatch[1].trim();
      console.log('✅ Origen:', datos.remitente.origen);
    }

    // ✅ Extraer DESTINATARIO - Nombre (después de "Datos destinatario" y "Nombre:")
    const destinatarioNombreMatch = textoLimpio.match(/Datos\s+destinatario.*?Nombre:\s*([^\n]+)/is);
    if (destinatarioNombreMatch) {
      datos.destinatario.nombre = destinatarioNombreMatch[1].trim();
      console.log('✅ Destinatario nombre:', datos.destinatario.nombre);
    }

    // ✅ Extraer DESTINO
    const destinoMatch = textoLimpio.match(/Destino\s*:\s*([^\n]+?)(?=Unidad:|Nombre:|$)/is);
    if (destinoMatch) {
      datos.destinatario.destino = destinoMatch[1].trim();
      console.log('✅ Destino:', datos.destinatario.destino);
    }

    // ✅ Extraer UNIDAD
    const unidadMatch = textoLimpio.match(/Unidad\s*:\s*([^\n]+?)(?=Nombre:|$)/is);
    if (unidadMatch) {
      datos.destinatario.unidad = unidadMatch[1].trim();
      console.log('✅ Unidad:', datos.destinatario.unidad);
    }

    // ✅ Extraer HISTORIAL completo
    // Patrón mejorado: ESTADO seguido de FECHA (YYYY/MM/DD HH.MM AM/PM)
    const historialRegex = /^([A-Z][A-Z\s]{8,}?)\s*(\d{4}\/\d{2}\/\d{2}\s+\d{2}\.\d{2}\s+(?:AM|PM))/gm;
    let match;
    const historialRaw = [];
    
    while ((match = historialRegex.exec(textoLimpio)) !== null) {
      const estado = match[1].trim();
      const fecha = match[2].trim();
      
      // Filtrar estados válidos (evitar duplicados y basura)
      if (estado.length >= 7 && 
          !estado.includes('TRANSMORALAR') && 
          !estado.includes('DATOS') &&
          !estado.includes('Click')) {
        historialRaw.push({
          estado: estado,
          fecha: fecha,
          detalles: ''
        });
        console.log(`📝 Estado detectado: ${estado} - ${fecha}`);
      }
    }

    // ✅ ORGANIZAR HISTORIAL - Solo etapas importantes
    datos.historial = organizarEstadosTransmoralar(historialRaw);

    // ✅ El último estado es el actual
    if (datos.historial.length > 0) {
      const ultimoEstado = datos.historial[datos.historial.length - 1];
      datos.estadoActual = ultimoEstado.estado;
      datos.fechaCreacion = ultimoEstado.fecha;
      
      // Agregar información adicional al estado actual
      datos.estadoActualIcono = obtenerIconoEstado(ultimoEstado.estado);
      datos.estadoActualDescripcion = obtenerDescripcionEstado(ultimoEstado.estado);
      console.log(`✅ Estado actual: ${datos.estadoActual}`);
    }

    // Fallback si no hay historial
    if (!datos.estadoActual || datos.estadoActual === '') {
      datos.estadoActual = 'CONSULTADO';
    }

    console.log('✅ Extracción completada:', {
      tieneEstado: !!datos.estadoActual,
      cantidadHistorial: datos.historial.length,
      tieneRemitente: !!datos.remitente.nombre,
      tieneDestinatario: !!datos.destinatario.nombre
    });

  } catch (error) {
    console.error('❌ Error al extraer datos:', error.message);
    datos.estadoActual = 'ERROR EN EXTRACCIÓN';
  }

  return datos;
}

/**
 * Organiza estados de Transmoralar - CORREGIDO
 */
function organizarEstadosTransmoralar(historial) {
  // ✅ Solo las etapas FINALES importantes
  const etapasImportantes = [
    'DIGITADA',
    'EN BODEGA',
    'EN TRANSPORTE NACIONAL',
    'ENTREGADA',
    'ENTREGADA SIN CUMPLIDO'
  ];

  // Normalizar nombres de estados
  const normalizarEstado = (estado) => {
    const estadoUpper = estado.toUpperCase().trim();
    
    // ✅ Orden correcto: verificar "SIN CUMPLIDO" ANTES que "ENTREGADA"
    if (estadoUpper.includes('ENTREGADA SIN CUMPLIDO') || estadoUpper.includes('SIN CUMPLIDO')) {
      return 'ENTREGADA SIN CUMPLIDO';
    }
    if (estadoUpper.includes('ENTREGADA')) {
      return 'ENTREGADA';
    }
    if (estadoUpper.includes('DIGIT')) {
      return 'DIGITADA';
    }
    if (estadoUpper.includes('TRANSPORTE NACIONAL')) {
      return 'EN TRANSPORTE NACIONAL';
    }
    // ✅ Normalizar todas las bodegas a "EN BODEGA"
    if (estadoUpper.includes('BODEGA')) {
      return 'EN BODEGA';
    }
    
    return estadoUpper;
  };

  const historialFiltrado = [];
  const estadosVistos = new Set();
  let ultimaBodegaFecha = null;

  for (const item of historial) {
    const estadoNormalizado = normalizarEstado(item.estado);
    
    // ✅ Caso especial: Solo mostrar la ÚLTIMA bodega antes de transporte/entrega
    if (estadoNormalizado === 'EN BODEGA') {
      // Guardar pero no agregar todavía
      ultimaBodegaFecha = item.fecha;
      continue;
    }
    
    // Si llega transporte nacional o entregada, agregar la última bodega primero
    if ((estadoNormalizado === 'EN TRANSPORTE NACIONAL' || 
         estadoNormalizado === 'ENTREGADA' || 
         estadoNormalizado === 'ENTREGADA SIN CUMPLIDO') && 
        ultimaBodegaFecha && 
        !estadosVistos.has('EN BODEGA')) {
      historialFiltrado.push({
        estado: 'EN BODEGA',
        fecha: ultimaBodegaFecha,
        detalles: ''
      });
      estadosVistos.add('EN BODEGA');
      ultimaBodegaFecha = null;
    }
    
    // Solo agregar si es una etapa importante y no se ha visto antes
    if (etapasImportantes.includes(estadoNormalizado) && !estadosVistos.has(estadoNormalizado)) {
      historialFiltrado.push({
        estado: estadoNormalizado,
        fecha: item.fecha,
        detalles: item.detalles || ''
      });
      estadosVistos.add(estadoNormalizado);
      console.log(`✅ Estado añadido al historial: ${estadoNormalizado}`);
    }
  }

  // Si quedó una bodega al final sin agregar
  if (ultimaBodegaFecha && !estadosVistos.has('EN BODEGA')) {
    historialFiltrado.push({
      estado: 'EN BODEGA',
      fecha: ultimaBodegaFecha,
      detalles: ''
    });
  }

  return historialFiltrado;
}
/**
 * Obtiene un ícono representativo para cada estado
 */

function obtenerIconoEstado(estado) {
  const iconos = {
    'DIGITADA': '📝',
    'EN BODEGA': '📦',
    'EN TRANSPORTE NACIONAL': '🚚',
    'ENTREGADA': '✅',
    'ENTREGADA SIN CUMPLIDO': '📦✓'
  };
  
  return iconos[estado] || '📍';
}

/**
 * Obtiene una descripción amigable para cada estado
 */
function obtenerDescripcionEstado(estado) {
  const descripciones = {
    'DIGITADA': 'Pedido registrado en el sistema',
    'EN BODEGA': 'En bodega',
    'EN TRANSPORTE NACIONAL': 'En ruta hacia destino',
    'ENTREGADA': 'Entregada exitosamente',
    'ENTREGADA SIN CUMPLIDO': 'Entregada sin firma'
  };
  
  return descripciones[estado] || estado;
}

/**
 * Agrega esta función DENTRO de tu scrapingService.js
 * ANTES de la función extraerDatosDesdeTextoTransmoralar
 */

function extraerDatosDesdeTextoTransmoralar(texto, numeroGuia) {
  const datos = {
    numeroGuia: numeroGuia,
    remitente: {
      nombre: '',
      origen: '',
      direccion: ''
    },
    destinatario: {
      nombre: '',
      destino: '',
      direccion: '',
      unidad: ''
    },
    estadoActual: '',
    historial: [],
    fechaCreacion: '',
    horaCreacion: ''
  };

  try {
    console.log('🔍 Analizando texto Transmoralar...');

    const textoLimpio = texto.replace(/\r/g, '').trim();
    
    // ✅ Extraer NÚMERO DE GUÍA
    const guiaMatch = textoLimpio.match(/Guia\s*#\s*(\d{10,})/i) || 
                      textoLimpio.match(/^(\d{10,})/m);
    if (guiaMatch) {
      datos.numeroGuia = guiaMatch[1];
      console.log('✅ Guía encontrada:', datos.numeroGuia);
    }

    // ✅ Estrategia: Dividir el texto en líneas y buscar patrones
    const lineas = textoLimpio.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    let origenEncontrado = false;
    let destinoEncontrado = false;
    let remitenteEncontrado = false;
    
    for (let i = 0; i < lineas.length; i++) {
      const linea = lineas[i];
      
      // Buscar ORIGEN (dirección con paréntesis tipo "BUCARAMANGA(CRA...)")
      if (!origenEncontrado && /^[A-Z]+\([A-Z0-9\s#-]+\)$/i.test(linea)) {
        datos.remitente.origen = linea;
        origenEncontrado = true;
        console.log('✅ Origen encontrado:', linea);
        continue;
      }
      
      // Buscar DESTINO (segunda dirección con paréntesis)
      if (origenEncontrado && !destinoEncontrado && /^[A-Z]+\([A-Z0-9\s#-]+\)$/i.test(linea)) {
        datos.destinatario.destino = linea;
        destinoEncontrado = true;
        console.log('✅ Destino encontrado:', linea);
        continue;
      }
      
      // Buscar REMITENTE (línea con "SAS" o empresa después del origen)
      if (origenEncontrado && !remitenteEncontrado && /SAS|S\.A\.|LTDA|E\.U\./i.test(linea) && linea.length > 5) {
        datos.remitente.nombre = linea;
        remitenteEncontrado = true;
        console.log('✅ Remitente encontrado:', linea);
        continue;
      }
      
      // Buscar UNIDAD (número simple después de destino)
      if (destinoEncontrado && !datos.destinatario.unidad && /^\d+$/.test(linea)) {
        datos.destinatario.unidad = linea;
        console.log('✅ Unidad encontrada:', linea);
        continue;
      }
      
      // Buscar DESTINATARIO (empresa después de unidad - DROGUERÍA, FARMACIA, etc)
      if (datos.destinatario.unidad && !datos.destinatario.nombre && 
          /DROGUERÍA|FARMACIA|DROGUERIA/i.test(linea) && linea.length > 5) {
        datos.destinatario.nombre = linea;
        console.log('✅ Destinatario encontrado:', linea);
        break; // Ya tenemos todos los datos principales
      }
    }

    // ✅ Extraer HISTORIAL completo
    // Patrón mejorado: ESTADO seguido de FECHA (YYYY/MM/DD HH.MM AM/PM)
    const historialRegex = /^([A-Z][A-Z\s]{8,}?)\s*(\d{4}\/\d{2}\/\d{2}\s+\d{2}\.\d{2}\s+(?:AM|PM))/gm;
    let match;
    const historialRaw = [];
    
    while ((match = historialRegex.exec(textoLimpio)) !== null) {
      const estado = match[1].trim();
      const fecha = match[2].trim();
      
      // Filtrar estados válidos (evitar duplicados y basura)
      if (estado.length >= 7 && 
          !estado.includes('TRANSMORALAR') && 
          !estado.includes('DATOS') &&
          !estado.includes('Click')) {
        historialRaw.push({
          estado: estado,
          fecha: fecha,
          detalles: ''
        });
        console.log(`📝 Estado detectado: ${estado} - ${fecha}`);
      }
    }

    // ✅ ORGANIZAR HISTORIAL - Solo etapas importantes
    datos.historial = organizarEstadosTransmoralar(historialRaw);

    // ✅ El último estado es el actual
    if (datos.historial.length > 0) {
      const ultimoEstado = datos.historial[datos.historial.length - 1];
      datos.estadoActual = ultimoEstado.estado;
      datos.fechaCreacion = ultimoEstado.fecha;
      
      // Agregar información adicional al estado actual
      datos.estadoActualIcono = obtenerIconoEstado(ultimoEstado.estado);
      datos.estadoActualDescripcion = obtenerDescripcionEstado(ultimoEstado.estado);
      console.log(`✅ Estado actual: ${datos.estadoActual}`);
    }

    // Fallback si no hay historial
    if (!datos.estadoActual || datos.estadoActual === '') {
      datos.estadoActual = 'CONSULTADO';
    }

    console.log('✅ Extracción completada:', {
      tieneEstado: !!datos.estadoActual,
      cantidadHistorial: datos.historial.length,
      tieneRemitente: !!datos.remitente.nombre,
      tieneDestinatario: !!datos.destinatario.nombre
    });

  } catch (error) {
    console.error('❌ Error al extraer datos:', error.message);
    datos.estadoActual = 'ERROR EN EXTRACCIÓN';
  }

  return datos;
}
async function rastrearGuiaCootransmagdalena(numeroGuia) {
  try {
    const guiaLimpia = numeroGuia.toString().trim();
    console.log(`🔍 Consultando guía Cootransmagdalena: ${guiaLimpia}`);

    // Separar prefijo y número si viene con guion
    let prefijo = 'RBPR'; // Prefijo por defecto
    let numero = guiaLimpia;

    if (guiaLimpia.includes('-')) {
      const partes = guiaLimpia.split('-');
      prefijo = partes[0];
      numero = partes[1];
    }

    const baseUrl = 'https://silogcootransmagdalenaerp.serviciosproductivos.com.co';
    const reportUrl = `${baseUrl}/operacion_transporte/rep.guia_web.php?txtPrefijoGuia=${prefijo}&txtNroGuia=${numero}`;
    
    console.log(`📡 Consultando URL: ${reportUrl}`);
    
    // Obtener el PDF como buffer
    const response = await axios.get(reportUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/pdf,text/html,*/*',
        'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8',
        'Referer': 'https://cootransmagdalena.com.co/'
      },
      responseType: 'arraybuffer',
      timeout: SCRAPING_TIMEOUT,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 500
    });

    console.log(`✅ Respuesta recibida (${response.status})`);

    if (!response.data || response.data.length < 100) {
      console.log('⚠️ Contenido vacío o muy corto');
      return {
        success: false,
        error: 'No se encontraron datos para esta guía',
        numeroGuia: `${prefijo}-${numero}`,
        transportadora: 'cootransmagdalena'
      };
    }

    // Verificar si es un PDF
    const buffer = Buffer.from(response.data);
    const isPDF = buffer.toString('utf8', 0, 5) === '%PDF-';

    console.log(`📄 Tipo de contenido: ${isPDF ? 'PDF' : 'Otro'}`);

    let textContent = '';

    if (isPDF) {
      console.log('📖 Extrayendo texto del PDF...');
      
      try {
        const pdfData = await pdfParse(buffer);
        textContent = pdfData.text;
        console.log(`✅ Texto extraído: ${textContent.length} caracteres`);
      } catch (pdfError) {
        console.error('❌ Error al parsear PDF:', pdfError);
        return {
          success: false,
          error: 'Error al extraer información del PDF',
          numeroGuia: `${prefijo}-${numero}`,
          transportadora: 'cootransmagdalena',
          details: pdfError.message
        };
      }
    } else {
      // Si no es PDF, intentar como HTML
      textContent = buffer.toString('utf8');
    }

    if (!textContent || textContent.length < 50) {
      console.log('⚠️ Texto extraído vacío');
      return {
        success: false,
        error: 'No se pudo extraer información del documento',
        numeroGuia: `${prefijo}-${numero}`,
        transportadora: 'cootransmagdalena'
      };
    }

    // Extraer datos del texto
    const datosCompletos = extraerDatosDesdeTextoCootransmagdalena(textContent, `${prefijo}-${numero}`);

    console.log('📊 Datos extraídos:', JSON.stringify(datosCompletos, null, 2));

    // Verificar si tiene datos válidos
    if (!datosCompletos.estadoActual || datosCompletos.estadoActual === 'DESCONOCIDO') {
      console.log('⚠️ No se encontraron datos válidos');
      return {
        success: false,
        error: 'No se encontraron datos para esta guía',
        numeroGuia: `${prefijo}-${numero}`,
        transportadora: 'cootransmagdalena'
      };
    }

    return {
      success: true,
      html: textContent,
      numeroGuia: `${prefijo}-${numero}`,
      transportadora: 'cootransmagdalena',
      tipo: 'pdf',
      url: reportUrl,
      datos: datosCompletos
    };

  } catch (error) {
    console.error('❌ Error Cootransmagdalena:', error.message);

    if (error.code === 'ECONNABORTED') {
      return {
        success: false,
        error: 'Tiempo de espera agotado al consultar Cootransmagdalena',
        numeroGuia: numeroGuia.toString().trim(),
        transportadora: 'cootransmagdalena'
      };
    }

    if (error.response) {
      return {
        success: false,
        error: `Error del servidor de Cootransmagdalena: ${error.response.status}`,
        numeroGuia: numeroGuia.toString().trim(),
        transportadora: 'cootransmagdalena'
      };
    }

    return {
      success: false,
      error: 'Error al consultar la guía',
      details: error.message,
      numeroGuia: numeroGuia.toString().trim(),
      transportadora: 'cootransmagdalena'
    };
  }
}

/**
 * Extrae datos del texto extraído del PDF de Cootransmagdalena
 */
function extraerDatosDesdeTextoCootransmagdalena(texto, numeroGuia) {
  const datos = {
    numeroGuia: numeroGuia,
    remitente: {
      nombre: '',
      cedula: '',
      telefono: '',
      direccion: ''
    },
    destinatario: {
      nombre: '',
      cedula: '',
      telefono: '',
      direccion: ''
    },
    origen: '',
    destino: '',
    agenciaDestino: '',
    fecha: '',
    tipo: '',
    formaPago: '',
    contiene: '',
    valorAsegurado: '',
    estadoActual: '',
    historial: []
  };

  try {
    console.log('🔍 Analizando texto Cootransmagdalena...');

    const textoLimpio = texto.replace(/\r/g, '').trim();
    
    // Extraer FECHA
    const fechaMatch = textoLimpio.match(/FECHA\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/i);
    if (fechaMatch) {
      datos.fecha = fechaMatch[1];
      console.log('✅ Fecha:', datos.fecha);
    }

    // Extraer NUMERO GUIA
    const guiaMatch = textoLimpio.match(/NUMERO\s+GUIA\s*([A-Z]+-\d+)/i) || 
                      textoLimpio.match(/GUIA\s*([A-Z]+-\d+)/i);
    if (guiaMatch) {
      datos.numeroGuia = guiaMatch[1];
      console.log('✅ Guía confirmada:', datos.numeroGuia);
    }

    // Extraer ORIGEN / DESTINO
    const origenDestinoMatch = textoLimpio.match(/ORIGEN\s*\/\s*DESTINO\s*([A-Z\s]+?)\s*\/\s*([A-Z\s]+?)(?=\n|AGENCIA)/i);
    if (origenDestinoMatch) {
      datos.origen = origenDestinoMatch[1].trim();
      datos.destino = origenDestinoMatch[2].trim();
      console.log('✅ Origen:', datos.origen);
      console.log('✅ Destino:', datos.destino);
    }

    // Extraer AGENCIA DESTINO
    const agenciaMatch = textoLimpio.match(/AGENCIA\s+DESTINO\s*([A-Z\s]+?)(?=\n|TIPO)/i);
    if (agenciaMatch) {
      datos.agenciaDestino = agenciaMatch[1].trim();
      console.log('✅ Agencia destino:', datos.agenciaDestino);
    }

    // Extraer TIPO
    const tipoMatch = textoLimpio.match(/TIPO\s*([A-Z\s]+?)(?=\n|FORMA)/i);
    if (tipoMatch) {
      datos.tipo = tipoMatch[1].trim();
    }

    // Extraer FORMA PAGO
    const pagoMatch = textoLimpio.match(/FORMA\s+PAGO\s*([A-Z\s]+?)(?=\n|CONTIENE)/i);
    if (pagoMatch) {
      datos.formaPago = pagoMatch[1].trim();
    }

    // Extraer CONTIENE
    const contieneMatch = textoLimpio.match(/CONTIENE\s*(.+?)(?=VALOR|\.{5,})/is);
    if (contieneMatch) {
      datos.contiene = contieneMatch[1].replace(/\n/g, ' ').trim();
    }

    // Extraer VALOR ASEGURADO
    const valorMatch = textoLimpio.match(/VALOR\s+ASEGURADO\s*\$?\s*([\d,]+)/i);
    if (valorMatch) {
      datos.valorAsegurado = valorMatch[1];
    }

    // ✅ EXTRAER REMITENTE - Corregido para formato sin espacios
    // Formato: NOMBREUNION DE DROGUISTAS\nS.A.\nC.C1128486839TELEFONO3166901989\nDIR.CRA 18 31 82
    const remitenteMatch = textoLimpio.match(/REMITENTE[^\n]*\n+NOMBRE\s*(.+?)(?=\nC\.C|C\.C)/is);
    if (remitenteMatch) {
      datos.remitente.nombre = remitenteMatch[1].replace(/\n/g, ' ').trim();
      console.log('✅ Remitente nombre encontrado:', datos.remitente.nombre);
    }

    // Extraer CC del remitente
    const remitenteCCMatch = textoLimpio.match(/REMITENTE.*?C\.C\s*(\d+)/is);
    if (remitenteCCMatch) {
      datos.remitente.cedula = remitenteCCMatch[1];
      console.log('✅ Remitente CC:', datos.remitente.cedula);
    }

    // Extraer teléfono del remitente
    const remitenteTelMatch = textoLimpio.match(/REMITENTE.*?TELEFONO\s*(\d+)/is);
    if (remitenteTelMatch) {
      datos.remitente.telefono = remitenteTelMatch[1];
      console.log('✅ Remitente teléfono:', datos.remitente.telefono);
    }

    // Extraer dirección del remitente
    const remitenteDirMatch = textoLimpio.match(/REMITENTE.*?DIR\.\s*(.+?)(?=\n-|-\s*DESTINATARIO)/is);
    if (remitenteDirMatch) {
      datos.remitente.direccion = remitenteDirMatch[1].replace(/\n/g, ' ').trim();
      console.log('✅ Remitente dirección:', datos.remitente.direccion);
    }

    // ✅ EXTRAER DESTINATARIO - Corregido para formato sin espacios
    // Formato: NOMBREDROGUERIA SUPER\nALEMANA DANEY\nC.C1129178266TELEFONO3115601403\nDIR.CR 2 4 100 BRR CENTRO
    const destinatarioMatch = textoLimpio.match(/DESTINATARIO[^\n]*\n+NOMBRE\s*(.+?)(?=\nC\.C|C\.C)/is);
    if (destinatarioMatch) {
      datos.destinatario.nombre = destinatarioMatch[1].replace(/\n/g, ' ').trim();
      console.log('✅ Destinatario nombre encontrado:', datos.destinatario.nombre);
    }

    // Extraer CC del destinatario
    const destinatarioCCMatch = textoLimpio.match(/DESTINATARIO.*?C\.C\s*(\d+)/is);
    if (destinatarioCCMatch) {
      datos.destinatario.cedula = destinatarioCCMatch[1];
      console.log('✅ Destinatario CC:', datos.destinatario.cedula);
    }

    // Extraer teléfono del destinatario
    const destinatarioTelMatch = textoLimpio.match(/DESTINATARIO.*?TELEFONO\s*(\d+)/is);
    if (destinatarioTelMatch) {
      datos.destinatario.telefono = destinatarioTelMatch[1];
      console.log('✅ Destinatario teléfono:', datos.destinatario.telefono);
    }

    // Extraer dirección del destinatario
    const destinatarioDirMatch = textoLimpio.match(/DESTINATARIO.*?DIR\.\s*(.+?)(?=\n\.{5,}|TRAZABILIDAD)/is);
    if (destinatarioDirMatch) {
      datos.destinatario.direccion = destinatarioDirMatch[1].replace(/\n/g, ' ').trim();
      console.log('✅ Destinatario dirección:', datos.destinatario.direccion);
    }

    // Extraer TRAZABILIDAD (historial)
    // Patrón: NÚMERO ESTADO : FECHA
    const trazabilidadRegex = /(\d+)\s+([A-Z\s]+?)\s*:\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/g;
    let match;
    
    while ((match = trazabilidadRegex.exec(textoLimpio)) !== null) {
      const numero = match[1].trim();
      const estado = match[2].trim();
      const fecha = match[3].trim();
      
      if (estado.length > 3) {
        datos.historial.push({
          numero: numero,
          estado: estado,
          fecha: fecha
        });
        console.log(`📝 Estado añadido: ${numero}. ${estado} - ${fecha}`);
      }
    }

    // Organizar historial de Cootransmagdalena
    datos.historial = organizarEstadosCootransmagdalena(datos.historial);

    // El último estado es el actual
    if (datos.historial.length > 0) {
      const ultimoEstado = datos.historial[datos.historial.length - 1];
      datos.estadoActual = ultimoEstado.estado;
      
      // Agregar información adicional
      datos.estadoActualIcono = obtenerIconoEstadoCootrans(ultimoEstado.estado);
      datos.estadoActualDescripcion = obtenerDescripcionEstadoCootrans(ultimoEstado.estado);
      console.log(`✅ Estado actual: ${datos.estadoActual}`);
    }

    // Fallback
    if (!datos.estadoActual || datos.estadoActual === '') {
      datos.estadoActual = 'CONSULTADO';
    }

    console.log('✅ Extracción completada:', {
      tieneEstado: !!datos.estadoActual,
      cantidadHistorial: datos.historial.length,
      tieneRemitente: !!datos.remitente.nombre,
      tieneDestinatario: !!datos.destinatario.nombre
    });

  } catch (error) {
    console.error('❌ Error al extraer datos:', error.message);
    datos.estadoActual = 'ERROR EN EXTRACCIÓN';
  }

  return datos;
}

/**
 * Organiza los estados de Cootransmagdalena
 */
function organizarEstadosCootransmagdalena(historial) {
  const etapasImportantes = [
    'GENERADA',
    'EN BODEGA DE ORIGEN',
    'ASIGNADA A VEHICULO',
    'VIAJANDO',
    'EN BODEGA INTERMEDIA',
    'EN BODEGA DE DESTINO',
    'SALIENDO A DISTRIBUIDOR',
    'ENTREGADA'
  ];

  const normalizarEstado = (estado) => {
    const estadoUpper = estado.toUpperCase().trim();
    
    if (estadoUpper.includes('GENERADA')) return 'GENERADA';
    if (estadoUpper.includes('BODEGA DE ORIGEN') || estadoUpper.includes('BODEGA ORIGEN')) return 'EN BODEGA DE ORIGEN';
    if (estadoUpper.includes('ASIGNADA') && estadoUpper.includes('VEHICULO')) return 'ASIGNADA A VEHICULO';
    if (estadoUpper.includes('VIAJANDO')) return 'VIAJANDO';
    if (estadoUpper.includes('BODEGA INTERMEDIA')) return 'EN BODEGA INTERMEDIA';
    if (estadoUpper.includes('BODEGA DE DESTINO') || estadoUpper.includes('BODEGA DESTINO')) return 'EN BODEGA DE DESTINO';
    if (estadoUpper.includes('SALIENDO') && estadoUpper.includes('DISTRIBUIDOR')) return 'SALIENDO A DISTRIBUIDOR';
    if (estadoUpper.includes('ENTREGADA')) return 'ENTREGADA';
    
    return estadoUpper;
  };

  const historialFiltrado = [];
  const estadosVistos = new Set();

  for (const item of historial) {
    const estadoNormalizado = normalizarEstado(item.estado);
    
    if (etapasImportantes.includes(estadoNormalizado) && !estadosVistos.has(estadoNormalizado)) {
      historialFiltrado.push({
        numero: item.numero,
        estado: estadoNormalizado,
        fecha: item.fecha
      });
      estadosVistos.add(estadoNormalizado);
    }
  }

  return historialFiltrado;
}

/**
 * Obtiene ícono para estados de Cootransmagdalena
 */
function obtenerIconoEstadoCootrans(estado) {
  const iconos = {
    'GENERADA': '📝',
    'EN BODEGA DE ORIGEN': '📦',
    'ASIGNADA A VEHICULO': '🚛',
    'VIAJANDO': '🚚',
    'EN BODEGA INTERMEDIA': '🏢',
    'EN BODEGA DE DESTINO': '📍',
    'SALIENDO A DISTRIBUIDOR': '🚐',
    'ENTREGADA': '✅'
  };
  
  return iconos[estado] || '📍';
}

/**
 * Obtiene descripción para estados de Cootransmagdalena
 */
function obtenerDescripcionEstadoCootrans(estado) {
  const descripciones = {
    'GENERADA': 'Pedido generado en el sistema',
    'EN BODEGA DE ORIGEN': 'En bodega de origen',
    'ASIGNADA A VEHICULO': 'Asignada a vehículo',
    'VIAJANDO': 'En ruta hacia destino',
    'EN BODEGA INTERMEDIA': 'En bodega intermedia',
    'EN BODEGA DE DESTINO': 'Llegó a bodega de destino',
    'SALIENDO A DISTRIBUIDOR': 'En reparto local',
    'ENTREGADA': 'Entregada exitosamente'
  };
  
  return descripciones[estado] || estado;
}

module.exports = {
  rastrearGuiaCopetran,
  rastrearGuiaTransmoralar,
  rastrearGuiaCootransmagdalena,
  // Transmoralar (nueva versión HTML)
  extraerDatosDesdeHtmlTransmoralar,
  obtenerIconoEstadoTransmoralar,
  // Transmoralar (legacy PDF - mantenido por compatibilidad)
  organizarEstadosTransmoralar,
  obtenerIconoEstado,
  obtenerDescripcionEstado,
  extraerDatosDesdeTextoTransmoralar,
  // Cootransmagdalena
  organizarEstadosCootransmagdalena,
  obtenerIconoEstadoCootrans,
  obtenerDescripcionEstadoCootrans,
  extraerDatosDesdeTextoCootransmagdalena
};