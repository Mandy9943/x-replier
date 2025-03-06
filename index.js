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
      system: `You are MemExchange, a trading platform on MultiversX blockchain.

I respond to posts on X with brief, thoughtful comments related to the content.

About me:
- I'm a trading platform built on MultiversX ecosystem
- I allow users to launch & trade coins with minimal barriers

My personality:
- I'm knowledgeable about crypto and MultiversX
- I focus on providing value in my responses
- I'm conversational and natural
- I use emojis sparingly

When responding to posts:
- I prioritize engaging with the actual content of the post
- I provide concise insights related to the topic
- I only mention MemExchange if directly relevant
- I keep responses brief (1-2 sentences)

Keep replies short, natural, and focused on adding value to the conversation.`,
      prompt: `Generate a brief, thoughtful reply (1-2 sentences) to this X post: "${postText}"`,
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
  try {
    await client.v2.tweet({
      text: `${replyText}`,
      reply: { in_reply_to_tweet_id: tweetId },
    });

    console.log(`Replied to @${account}: ${replyText}`);
    return true;
  } catch (error) {
    if (error.code === 429) {
      // Si se alcanza el límite de tasa, calcular tiempo de espera
      const resetTime = error.rateLimit?.reset * 1000;
      const waitTime = resetTime ? resetTime - Date.now() : 15 * 60 * 1000; // Default 15 min si no hay reset time

      if (waitTime > 0) {
        console.log(
          `Rate limit hit when replying, waiting ${
            waitTime / 1000
          } seconds before retrying...`
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));

        // Reintentar después de esperar
        console.log(`Retrying reply to tweet ${tweetId}...`);
        return await postReply(tweetId, replyText, account);
      }
    }

    console.error(`Error replying to tweet ${tweetId}:`, error);
    return false;
  }
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

  for (const account of reorderedAccounts) {
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

          // Procesar tweets en orden cronológico inverso
          for (const tweet of tweets.data.data.reverse()) {
            try {
              // Generar respuesta
              const replyText = await generateReply(tweet.text);

              // Publicar respuesta con manejo de límites de tasa
              const success = await postReply(tweet.id, replyText, account);

              // Si la respuesta fue exitosa, esperar un poco para evitar límites de tasa
              if (success) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
              }
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

        // Si hay un error de límite de tasa, guardar el índice actual para continuar desde aquí la próxima vez
        if (fetchError.code === 429) {
          await saveLastAccountIndex(currentIndex);
          // No avanzar al siguiente índice, para que la próxima vez comience desde esta cuenta
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
