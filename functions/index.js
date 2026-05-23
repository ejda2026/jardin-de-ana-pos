// Cloud Functions para Jardin de Ana POS
// Sistema de notificaciones push entre roles (mesero, cocina, caja)
//
// (A) onValueUpdated(/ordenes/{mesaId}) — cuando status pasa a 'lista':
//     notificar al mesero duenno de la mesa.

const { onValueUpdated } = require('firebase-functions/v2/database');
const { setGlobalOptions } = require('firebase-functions/v2');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

// La RTDB de este proyecto vive en us-central1.
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

const DB_INSTANCE = 'el-jardin-de-ana-default-rtdb';

function normalizar(s) {
  if (!s) return '';
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

// Obtiene todos los tokens (devices) de un mesero, filtrando por nombre.
// Devuelve { tokens: [string], invalidPaths: [string] } — invalidPaths se usa luego para limpieza.
async function tokensDeMesero(nombreMesero) {
  const nombreNorm = normalizar(nombreMesero);
  if (!nombreNorm) return { tokens: [], paths: [] };
  const snap = await admin.database().ref('/fcm_tokens/mesero').get();
  const data = snap.val() || {};
  const tokens = [];
  const paths = [];
  Object.entries(data).forEach(([deviceId, entry]) => {
    if (!entry || !entry.token) return;
    if (normalizar(entry.nombre) === nombreNorm) {
      tokens.push(entry.token);
      paths.push(`/fcm_tokens/mesero/${deviceId}`);
    }
  });
  return { tokens, paths };
}

// Envia notificacion a un set de tokens y limpia los que devuelven error de token invalido.
async function enviarA(tokens, paths, notification, data) {
  if (!tokens.length) return { sent: 0, cleaned: 0 };
  const message = {
    notification,
    data: data || {},
    tokens,
    webpush: {
      notification: {
        icon: '/jardin-de-ana-pos/icon-192.png',
        badge: '/jardin-de-ana-pos/icon-192.png',
        vibrate: [200, 100, 200]
      },
      fcmOptions: {
        link: 'https://ejda2026.github.io/jardin-de-ana-pos/'
      }
    }
  };
  const resp = await admin.messaging().sendEachForMulticast(message);
  // Limpieza de tokens invalidos (caducados / desregistrados)
  let cleaned = 0;
  const removes = [];
  resp.responses.forEach((r, i) => {
    if (!r.success) {
      const code = r.error && r.error.code;
      if (code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/invalid-argument') {
        removes.push(admin.database().ref(paths[i]).remove());
        cleaned++;
      }
    }
  });
  if (removes.length) await Promise.all(removes);
  return { sent: resp.successCount, cleaned };
}

// (A) Mesa lista — notificar al mesero
exports.notificarMesaLista = onValueUpdated(
  {
    ref: '/ordenes/{mesaId}',
    instance: DB_INSTANCE
  },
  async (event) => {
    const before = event.data.before.val();
    const after = event.data.after.val();
    if (!after) return null;
    const statusAnterior = before && before.status;
    const statusNuevo = after.status;
    if (statusNuevo !== 'lista') return null;
    if (statusAnterior === 'lista') return null;

    const mesa = event.params.mesaId;
    const mesero = after.mesero;
    if (!mesero) {
      logger.info(`Mesa ${mesa} lista pero sin mesero asignado — no se notifica`);
      return null;
    }
    const { tokens, paths } = await tokensDeMesero(mesero);
    if (!tokens.length) {
      logger.info(`Mesa ${mesa} lista para ${mesero} — sin tokens registrados`);
      return null;
    }
    const result = await enviarA(
      tokens,
      paths,
      {
        title: 'Mesa lista',
        body: `Tu mesa ${mesa} esta lista para entregar`
      },
      { mesa: String(mesa), tipo: 'mesa_lista', tag: `lista-${mesa}` }
    );
    logger.info(`Mesa ${mesa} lista para ${mesero}: enviados ${result.sent}/${tokens.length}, limpiados ${result.cleaned}`);
    return null;
  }
);
