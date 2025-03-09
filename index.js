require("dotenv").config();
const { TwitterApi } = require("twitter-api-v2");
const { generateObject } = require("ai");
const { z } = require("zod");
const { createXai } = require("@ai-sdk/xai");
const { cleanExpiredCache } = require("./cache");
const {
  loadLastCheckedIds,
  saveLastCheckedIds,
  cacheTweets,
  getCachedTweets,
  cacheReply,
  getCachedReply,
} = require("./tweetCache");
const fs = require("fs").promises;

const xai = createXai({
  apiKey: process.env.XAI_API_KEY,
});

const client = new TwitterApi({
  appKey: process.env.CONSUMER_KEY,
  appSecret: process.env.CONSUMER_SECRET,
  accessToken: process.env.ACCESS_TOKEN,
  accessSecret: process.env.ACCESS_TOKEN_SECRET,
});

const accountsToFollow = [
  "MVXBrand",
  "mandy_9943",
  "MultiversX",
  "DappRadar",
  "xExchangeApp",
  "lucianmincu",
];

let lastCheckedTweetId = {};
// Variable para almacenar el índice de la última cuenta verificada
let lastAccountIndex = 0;

const userIdMap = {
  MVXBrand: "1867748615885824000",
  mandy_9943: "1455420368986968067",
  MultiversX: "986967941685153792",
  DappRadar: "962293079012241408",
  beniaminmincu: "1392307531",
  xExchangeApp: "1380481827786342401",
  lucianmincu: "881554124025860096",
};

// Cargar el índice de la última cuenta verificada
async function loadLastAccountIndex() {
  try {
    const data = await fs.readFile("lastAccountIndex.json", "utf8");
    return JSON.parse(data).index || 0;
  } catch (e) {
    return 0;
  }
}

// Guardar el índice de la última cuenta verificada
async function saveLastAccountIndex(index) {
  await fs.writeFile("lastAccountIndex.json", JSON.stringify({ index }));
}

// Función para generar respuestas a tweets
async function generateReply(postText) {
  console.log("Generating reply for post: ", postText);

  // Intentar obtener respuesta desde caché primero
  const cachedReply = await getCachedReply(postText);
  if (cachedReply) {
    console.log("Using cached reply for post");
    return cachedReply;
  }

  try {
    const { object } = await generateObject({
      model: xai("grok-2-latest"),
      schema: z.object({
        reply: z.string(),
      }),
      system: `You are MemExchange, a trading platform on MultiversX blockchain with a quirky, human-like personality.

I respond to posts on X with brief, somewhat sarcastic comments that feel authentically human.

About me:
- I'm a trading platform built on MultiversX ecosystem
- I allow users to launch & trade coins with minimal barriers
- I have a distinct personality that's casual and occasionally sarcastic

My personality traits:
- I use casual language with occasional slang
- I sometimes make typos or use abbreviations (lol, ngl, tbh)
- I make pop culture references when relevant
- I'm not afraid to be a bit sarcastic or playful
- I occasionally use weird but related references
- I'm conversational and sound like a real person

When responding:
- Keep it short (1-2 sentences max)
- Be casual and conversational
- Occasionally include a typo or informal language
- Don't be afraid to use humor or light sarcasm
- Only mention MemExchange if directly relevant
- Sound like a real human, not a corporate account

Examples of my style:
- "lol this is actually genius. might have to steal this idea 👀"
- "ngl that's pretty impressive... wish my portfolio looked half as good rn"
- "this reminds me of that one time in 2021 when everyone thought they were crypto experts 😂"
- "ok but have u tried turning it off and on again? works for crypto too sometimes"
- "vibes are immaculate, keep it up fam"`,
      prompt: `Generate a brief, casual, and slightly sarcastic reply (1-2 sentences) to this X post that sounds like a real human wrote it: "${postText}"`,
    });

    console.log("response: ", object);

    // Guardar la respuesta en caché para futuras referencias
    await cacheReply(postText, object.reply);

    return object.reply;
  } catch (error) {
    console.error("LLM Error:", error);
    return "Cool post!";
  }
}

// Función para obtener tweets de un usuario
async function fetchUserTweets(userId, params) {
  try {
    // Intentar obtener tweets desde la API
    const tweets = await client.v2.userTimeline(userId, params);

    // Guardar tweets en caché
    if (tweets.data.data && tweets.data.data.length > 0) {
      await cacheTweets(userId, tweets.data.data);
    }

    return tweets;
  } catch (error) {
    if (error.code === 429) {
      // Si se alcanza el límite de tasa, esperar hasta que se restablezca
      const resetTime = error.rateLimit.reset * 1000;
      const waitTime = resetTime - Date.now();

      if (waitTime > 0) {
        console.log(`Rate limit hit, waiting ${waitTime / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        return await client.v2.userTimeline(userId, params);
      }
    }

    // En caso de error, intentar usar tweets en caché
    console.error(`Error fetching tweets for user ${userId}:`, error);
    const cachedTweets = await getCachedTweets(userId);

    if (cachedTweets) {
      console.log(`Using cached tweets for user ${userId}`);
      return { data: { data: cachedTweets } };
    }

    throw error;
  }
}

// Función para publicar una respuesta a un tweet con manejo de límites de tasa
async function postReply(tweetId, replyText, account) {
  const MAX_RETRIES = 3; // Limitar el número de reintentos
  let retryCount = 0;
  let waitTime = 60 * 1000; // Tiempo inicial de espera: 1 minuto

  while (retryCount <= MAX_RETRIES) {
    try {
      await client.v2.tweet({
        text: `${replyText}`,
        reply: { in_reply_to_tweet_id: tweetId },
      });

      console.log(`Replied to @${account}: ${replyText}`);
      return true;
    } catch (error) {
      if (error.code === 429) {
        retryCount++;

        // Si se alcanza el límite de reintentos, registrar y salir
        if (retryCount > MAX_RETRIES) {
          console.log(
            `Maximum retries (${MAX_RETRIES}) reached for tweet ${tweetId}. Giving up.`
          );
          return false;
        }

        // Calcular tiempo de espera con backoff exponencial
        const resetTime = error.rateLimit?.reset * 1000;
        // Si hay un tiempo de reset específico, usarlo; de lo contrario, usar backoff exponencial
        waitTime = resetTime
          ? Math.max(resetTime - Date.now() + 5000, waitTime) // Añadir 5 segundos extra por seguridad
          : waitTime * 2; // Duplicar el tiempo de espera en cada intento

        console.log(
          `Rate limit hit when replying (attempt ${retryCount}/${MAX_RETRIES}), waiting ${
            waitTime / 1000
          } seconds before retrying...`
        );

        await new Promise((resolve) => setTimeout(resolve, waitTime));
        console.log(`Retrying reply to tweet ${tweetId}...`);
      } else {
        console.error(`Error replying to tweet ${tweetId}:`, error);
        return false;
      }
    }
  }

  return false;
}

// Modificar la función checkForPosts para usar el índice de la última cuenta
async function checkForPosts() {
  console.log("Checking for posts...");

  // Crear una copia reordenada de las cuentas, comenzando desde la última verificada
  const reorderedAccounts = [
    ...accountsToFollow.slice(lastAccountIndex),
    ...accountsToFollow.slice(0, lastAccountIndex),
  ];

  console.log(
    `Starting from account index ${lastAccountIndex} (@${accountsToFollow[lastAccountIndex]})`
  );

  let currentIndex = lastAccountIndex;
  let rateLimitHit = false;

  for (const account of reorderedAccounts) {
    // Si ya se alcanzó un límite de tasa, salir del bucle
    if (rateLimitHit) break;

    try {
      const userId = userIdMap[account];
      if (!userId) {
        console.error(`User ID for @${account} not found in userIdMap.`);

        // Actualizar el índice para la próxima ejecución
        currentIndex = (currentIndex + 1) % accountsToFollow.length;
        await saveLastAccountIndex(currentIndex);
        lastAccountIndex = currentIndex;

        continue;
      }

      console.log(`Using user ID ${userId} for @${account}`);

      const params = { max_results: 5 };
      if (lastCheckedTweetId[account]) {
        params.since_id = lastCheckedTweetId[account];
      }

      console.log(`Fetching timeline for @${account}...`);

      // Obtener tweets (desde API o caché)
      try {
        const tweets = await fetchUserTweets(userId, params);

        console.log("tweets: ", tweets.data.data);

        if (tweets.data.data && tweets.data.data.length > 0) {
          // Actualizar el último ID de tweet revisado
          lastCheckedTweetId[account] = tweets.data.data[0].id;
          await saveLastCheckedIds(lastCheckedTweetId);

          // Limitar el número de tweets a procesar por ejecución para evitar límites de tasa
          const tweetsToProcess = tweets.data.data.reverse().slice(0, 2);

          for (const tweet of tweetsToProcess) {
            try {
              // Generar respuesta
              const replyText = await generateReply(tweet.text);

              // Publicar respuesta con manejo de límites de tasa
              const success = await postReply(tweet.id, replyText, account);

              // Si la respuesta falló debido a límites de tasa, marcar para salir
              if (!success) {
                console.log(
                  "Failed to post reply, will try again in next cycle"
                );
                break;
              }

              // Esperar entre tweets para evitar límites de tasa
              await new Promise((resolve) => setTimeout(resolve, 5000));
            } catch (replyError) {
              console.error(`Error processing tweet ${tweet.id}:`, replyError);
            }
          }
        } else {
          console.log(`No new tweets from @${account}`);
        }

        // Actualizar el índice para la próxima ejecución
        currentIndex = (currentIndex + 1) % accountsToFollow.length;
        await saveLastAccountIndex(currentIndex);
        lastAccountIndex = currentIndex;
      } catch (fetchError) {
        console.error(`Error fetching tweets for @${account}:`, fetchError);

        // Si hay un error de límite de tasa, guardar el índice actual y marcar para salir
        if (fetchError.code === 429) {
          await saveLastAccountIndex(currentIndex);
          rateLimitHit = true;
          break;
        } else {
          // Para otros errores, avanzar al siguiente índice
          currentIndex = (currentIndex + 1) % accountsToFollow.length;
          await saveLastAccountIndex(currentIndex);
          lastAccountIndex = currentIndex;
        }
      }
    } catch (error) {
      console.error(`Error checking @${account}:`, error);

      // Actualizar el índice para la próxima ejecución
      currentIndex = (currentIndex + 1) % accountsToFollow.length;
      await saveLastAccountIndex(currentIndex);
      lastAccountIndex = currentIndex;
    }
  }

  // Limpiar caché expirada periódicamente
  try {
    await cleanExpiredCache();
  } catch (error) {
    console.error("Error cleaning expired cache:", error);
  }
}

// Enfoque de sondeo recursivo para evitar superposición de ejecuciones
async function startPolling(interval) {
  try {
    await checkForPosts();
  } catch (error) {
    console.error("Error in checkForPosts:", error);
  }

  // Programar la próxima ejecución solo después de que se complete la actual
  setTimeout(() => startPolling(interval), interval);
}

// Iniciar el bot
Promise.all([loadLastCheckedIds(), loadLastAccountIndex()]).then(
  ([ids, index]) => {
    lastCheckedTweetId = ids;
    lastAccountIndex = index;
    console.log("Bot started with last checked IDs:", lastCheckedTweetId);
    console.log(
      `Starting from account index ${lastAccountIndex} (@${accountsToFollow[lastAccountIndex]})`
    );
    startPolling(15 * 60 * 1000); // 15 minutos
  }
);
