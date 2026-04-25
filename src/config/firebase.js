const admin = require('firebase-admin');

let firebaseInitialized = false;

function initializeFirebase() {
  // Opción 1: desde variable de entorno (para producción en Render)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      firebaseInitialized = true;
      console.log('✅ Firebase Admin SDK inicializado desde variable de entorno');
      return true;
    } catch (error) {
      console.error('❌ Error al parsear FIREBASE_SERVICE_ACCOUNT_JSON:', error.message);
      return false;
    }
  }

  // Opción 2: desde archivo local (para desarrollo en tu computador)
  const fs = require('fs');
  const path = require('path');
  const filePath = path.resolve('./apptransportadoras-firebase-adminsdk-fbsvc-9c4cfa1f95.json');
  
  if (fs.existsSync(filePath)) {
    try {
      const serviceAccount = require(filePath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      firebaseInitialized = true;
      console.log('✅ Firebase Admin SDK inicializado desde archivo local');
      return true;
    } catch (error) {
      console.error('❌ Error al inicializar Firebase:', error.message);
      return false;
    }
  }

  console.warn('⚠️ Firebase no configurado. Las notificaciones push NO funcionarán.');
  return false;
}

function isFirebaseInitialized() {
  return firebaseInitialized;
}

function getFirebaseAdmin() {
  return admin;
}

module.exports = { initializeFirebase, isFirebaseInitialized, getFirebaseAdmin };