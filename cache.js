const fs = require("fs").promises;
const path = require("path");

// Directorio para almacenar archivos de caché
const CACHE_DIR = "./cache";

// Asegurar que el directorio de caché exista
async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (error) {
    if (error.code !== "EEXIST") {
      console.error("Error creating cache directory:", error);
    }
  }
}

// Guardar datos en caché
async function saveToCache(key, data, ttl = 24 * 60 * 60 * 1000) {
  // TTL por defecto: 24 horas
  await ensureCacheDir();

  const cacheData = {
    data,
    expires: Date.now() + ttl,
  };

  const filePath = path.join(CACHE_DIR, `${key}.json`);
  await fs.writeFile(filePath, JSON.stringify(cacheData, null, 2));
}

// Cargar datos desde caché
async function loadFromCache(key) {
  await ensureCacheDir();

  const filePath = path.join(CACHE_DIR, `${key}.json`);

  try {
    const data = await fs.readFile(filePath, "utf8");
    const cacheData = JSON.parse(data);

    // Verificar si los datos han expirado
    if (cacheData.expires > Date.now()) {
      return cacheData.data;
    }

    // Si han expirado, eliminar el archivo
    await fs.unlink(filePath).catch(() => {});
    return null;
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error(`Error loading cache for ${key}:`, error);
    }
    return null;
  }
}

// Verificar si un elemento está en caché y no ha expirado
async function isInCache(key) {
  const data = await loadFromCache(key);
  return data !== null;
}

// Eliminar un elemento de la caché
async function removeFromCache(key) {
  const filePath = path.join(CACHE_DIR, `${key}.json`);
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error(`Error removing cache for ${key}:`, error);
    }
  }
}

// Limpiar elementos expirados de la caché
async function cleanExpiredCache() {
  try {
    const files = await fs.readdir(CACHE_DIR);

    for (const file of files) {
      if (file.endsWith(".json")) {
        const filePath = path.join(CACHE_DIR, file);
        try {
          const data = await fs.readFile(filePath, "utf8");
          const cacheData = JSON.parse(data);

          if (cacheData.expires <= Date.now()) {
            await fs.unlink(filePath);
          }
        } catch (error) {
          console.error(`Error processing cache file ${file}:`, error);
        }
      }
    }
  } catch (error) {
    console.error("Error cleaning expired cache:", error);
  }
}

module.exports = {
  saveToCache,
  loadFromCache,
  isInCache,
  removeFromCache,
  cleanExpiredCache,
};
