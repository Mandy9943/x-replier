const { saveToCache, loadFromCache } = require("./cache");
const fs = require("fs").promises;

// Clave para el caché de los últimos IDs de tweets revisados
const LAST_CHECKED_IDS_KEY = "lastCheckedIds";

// Clave para el caché de tweets por usuario
const getUserTweetsKey = (userId) => `tweets_${userId}`;

// Clave para el caché de respuestas generadas
const getReplyKey = (tweetText) =>
  `reply_${Buffer.from(tweetText).toString("base64").substring(0, 50)}`;

// Cargar los últimos IDs de tweets revisados
async function loadLastCheckedIds() {
  try {
    // Primero intentar cargar desde el archivo lastChecked.json para compatibilidad
    const data = await fs.readFile("lastChecked.json", "utf8");
    const lastCheckedIds = JSON.parse(data);

    // Guardar en caché para futuras referencias
    await saveToCache(LAST_CHECKED_IDS_KEY, lastCheckedIds);

    return lastCheckedIds;
  } catch (e) {
    // Si el archivo no existe, intentar cargar desde caché
    const cachedIds = await loadFromCache(LAST_CHECKED_IDS_KEY);
    return cachedIds || {};
  }
}

// Guardar los últimos IDs de tweets revisados
async function saveLastCheckedIds(lastCheckedIds) {
  // Guardar en el archivo lastChecked.json para compatibilidad
  await fs.writeFile("lastChecked.json", JSON.stringify(lastCheckedIds));

  // Guardar en caché para futuras referencias
  await saveToCache(LAST_CHECKED_IDS_KEY, lastCheckedIds);
}

// Guardar tweets en caché
async function cacheTweets(userId, tweets, ttl = 60 * 60 * 1000) {
  // TTL por defecto: 1 hora
  await saveToCache(getUserTweetsKey(userId), tweets, ttl);
}

// Cargar tweets desde caché
async function getCachedTweets(userId) {
  return await loadFromCache(getUserTweetsKey(userId));
}

// Guardar respuesta generada en caché
async function cacheReply(tweetText, reply, ttl = 7 * 24 * 60 * 60 * 1000) {
  // TTL por defecto: 7 días
  await saveToCache(getReplyKey(tweetText), reply, ttl);
}

// Cargar respuesta generada desde caché
async function getCachedReply(tweetText) {
  return await loadFromCache(getReplyKey(tweetText));
}

module.exports = {
  loadLastCheckedIds,
  saveLastCheckedIds,
  cacheTweets,
  getCachedTweets,
  cacheReply,
  getCachedReply,
};
