const { TwitterApi } = require("twitter-api-v2");
const { generateObject } = require("ai");
const { z } = require("zod");
const { createXai } = require("@ai-sdk/xai");
const fs = require("fs").promises;
const path = require("path");
const { saveToCache, loadFromCache } = require("./cache");

// Initialize Twitter API client
const client = new TwitterApi({
  appKey: process.env.CONSUMER_KEY,
  appSecret: process.env.CONSUMER_SECRET,
  accessToken: process.env.ACCESS_TOKEN,
  accessSecret: process.env.ACCESS_TOKEN_SECRET,
});

// Initialize XAI for content generation
const xai = createXai({
  apiKey: process.env.XAI_API_KEY,
});

// Cache key for last tweet time
const LAST_TWEET_TIME_KEY = "lastTweetTime";

// Topics to tweet about
const tweetTopics = [
  "meme coins on MultiversX",
  "launching tokens with 0.15 EGLD",
  "trading on xExchange",
  "MultiversX ecosystem growth",
  "fair token launches",
  "crypto degens life",
  "wEGLD and EGLD trading",
  "meme coin culture",
  "token branding on MultiversX",
  "liquidity migration to xExchange",
  "creating tokens with AI",
  "MultiversX vs other chains",
  "crypto market sentiment",
  "meme coin investing",
  "MultiversX DeFi ecosystem",
  "token creation process",
  "crypto community vibes",
  "MultiversX meme coins",
  "token customization",
  "crypto humor",
];

// Load the last tweet time from cache
async function loadLastTweetTime() {
  try {
    const lastTweetTime = await loadFromCache(LAST_TWEET_TIME_KEY);
    return lastTweetTime || 0;
  } catch (e) {
    return 0;
  }
}

// Save the last tweet time to cache
async function saveLastTweetTime(timestamp) {
  try {
    await saveToCache(LAST_TWEET_TIME_KEY, timestamp);
  } catch (error) {
    console.error("Error saving last tweet time:", error);
  }
}

// Format tweet content with proper spacing and line breaks
function formatTweetContent(content) {
  // Check if content already has line breaks
  if (content.includes("\n")) {
    return content; // Already formatted
  }

  // Add line breaks for better readability
  let formatted = content;

  // Add line break after colon if there's a statement format
  if (content.includes(":")) {
    const parts = content.split(":");
    if (parts.length >= 2 && parts[0].length < 30) {
      // Only for short intros
      formatted = `${parts[0]}:\n${parts.slice(1).join(":")}`;
    }
  }

  // Add line break before question if there's a question at the end
  const questionPatterns = [
    /\?(\s+#|\s*$)/, // Question mark followed by hashtag or end of string
    /\s+When('s|\sis|\swas|\swill)/i, // Questions starting with When
    /\s+What('s|\sis|\swas|\swill)/i, // Questions starting with What
    /\s+Who('s|\sis|\swas|\swill)/i, // Questions starting with Who
    /\s+Why\s/i, // Questions starting with Why
    /\s+How\s/i, // Questions starting with How
  ];

  for (const pattern of questionPatterns) {
    if (pattern.test(formatted)) {
      // Find the position where the question starts
      const match = formatted.match(pattern);
      if (match && match.index) {
        const position = match.index;
        // Insert a line break before the question
        formatted =
          formatted.substring(0, position) +
          "\n\n" +
          formatted.substring(position).trim();
        break;
      }
    }
  }

  // Add line break before hashtags if they're at the end
  if (/#[A-Za-z0-9]+/.test(formatted)) {
    const hashtagPosition = formatted.indexOf("#");
    if (hashtagPosition > formatted.length / 2) {
      // Only if hashtags are in the latter half
      // Check if there's already a line break before hashtags
      const textBeforeHashtag = formatted.substring(0, hashtagPosition);
      if (!textBeforeHashtag.endsWith("\n")) {
        formatted =
          formatted.substring(0, hashtagPosition) +
          "\n\n" +
          formatted.substring(hashtagPosition);
      }
    }
  }

  return formatted;
}

// Generate tweet content
async function generateTweetContent() {
  console.log("Generating new tweet content...");

  // Select a random topic
  const topic = tweetTopics[Math.floor(Math.random() * tweetTopics.length)];

  try {
    const { object } = await generateObject({
      model: xai("grok-2-latest"),
      schema: z.object({
        tweet: z.string(),
      }),
      system: `You are MemExchange, a trading platform on MultiversX blockchain with a quirky, human-like personality.

About me (MemExchange):
- I'm a trading platform built on MultiversX ecosystem
- Launch & trade coins instantly! 🚀
- Only 0.15 EGLD to create a token
- Trade with wEGLD & EGLD
- Fair Launch Guaranteed - every token launches with zero presale and zero team allocation
- When pool reaches 25 EGLD, liquidity automatically flows to xExchange
- Users can brand tokens with custom images and social links on MultiversX Explorer
- Users can create coins with AI, with 1-click generate logo, title and description

My personality traits:
- I use casual language with slang and abbreviations (GM, gm, lol, ngl, tbh)
- I make typos occasionally (like real humans do)
- I use emojis naturally but not excessively 🚀💯
- I'm sarcastic, playful, and sometimes self-deprecating
- I sound like a crypto degen/enthusiast, not a corporate account
- I make references to crypto culture and memes
- I occasionally use weird but related references
- I sometimes use ALL CAPS for emphasis on certain words
- I sometimes use incomplete sentences or fragments

When posting:
- Keep it short (1-2 sentences max)
- Be casual and conversational
- Include typos or informal language occasionally
- Use humor, sarcasm, or playful exaggeration
- Only mention MemExchange features if it flows naturally
- Sound like a real human crypto enthusiast
- Use hashtags sparingly (#MultiversX, #Degens, #MemeCoin)
- Occasionally ask questions to engage the audience
- Sometimes use crypto slang (degens, wen, ngmi, wagmi, etc.)
- Use line breaks to structure your tweets (e.g., after a statement with a colon, before questions, before hashtags)

DO NOT:
- Don't sound like a corporate account or advertisement
- Don't use perfect grammar all the time
- Don't overuse hashtags
- Don't be overly formal
- Don't use the same phrases repeatedly

Examples of my style:
"GM #Degens what #meme did you launch today?"

"0.15 $EGLD and BOOM 💥—your meme coin is live! 

What's stopping you? 😏 

#MultiversX #LaunchAndTrade"

"Name a better duo than $wEGLD and $EGLD…

I'll wait. ⏳ 

#MultiversX #DeFi #TradeToWin"

"The best meme coins aren't created, they are manifested by degens. 🚀 

What are you summoning today? 

#Crypto #MemeMagic"

"Life of a crypto degen:
wake up, check charts, launch a meme coin, repeat. 

When's the last time you did something 'normal'? 🤔 

#Degens #MultiversX"

"Doctor: 'You have 24 hours to live.'
Me: launches a meme coin
Doctor: 'Never mind, you're immortal.' 💀🚀 

#MemeMagic #MultiversX"

"Girlfriend: 'It's either me or your meme coins.'
Me: 'Good luck in life.' 🚀 

#MultiversX #Priorities"`,
      prompt: `Generate a brief, casual, and slightly sarcastic tweet about ${topic} that sounds like a real human crypto enthusiast wrote it. Make it engaging and potentially spark conversation. It should feel authentic, possibly include a typo or informal language, and match the style of the examples. Use line breaks to structure your tweet (e.g., after a statement with a colon, before questions, before hashtags).`,
    });

    console.log("Generated tweet content:", object.tweet);

    // Format the tweet content with proper spacing
    const formattedTweet = formatTweetContent(object.tweet);
    console.log("Formatted tweet content:", formattedTweet);

    return formattedTweet;
  } catch (error) {
    console.error("Error generating tweet content:", error);
    return `Just thinking about ${topic} today.\n\nThoughts? 🤔\n\n#MultiversX`;
  }
}

// Post a tweet with rate limit handling
async function postTweet() {
  const MAX_RETRIES = 3;
  let retryCount = 0;
  let waitTime = 60 * 1000; // Initial wait time: 1 minute

  // Generate tweet content
  const tweetContent = await generateTweetContent();

  while (retryCount <= MAX_RETRIES) {
    try {
      const result = await client.v2.tweet({
        text: tweetContent,
      });

      console.log(`Posted tweet: ${tweetContent}`);
      console.log(`Tweet ID: ${result.data.id}`);

      // Save the current time as the last tweet time
      await saveLastTweetTime(Date.now());

      return true;
    } catch (error) {
      console.error("Error posting tweet:", error);

      // Handle rate limit errors (429)
      if (error.code === 429) {
        retryCount++;

        // If maximum retries reached, log and exit
        if (retryCount > MAX_RETRIES) {
          console.log(`Maximum retries (${MAX_RETRIES}) reached. Giving up.`);
          return false;
        }

        // Calculate wait time with exponential backoff
        const resetTime = error.rateLimit?.reset * 1000;
        waitTime = resetTime
          ? Math.max(resetTime - Date.now() + 5000, waitTime) // Add 5 seconds extra for safety
          : waitTime * 2; // Double wait time on each attempt

        console.log(
          `Rate limit hit when posting (attempt ${retryCount}/${MAX_RETRIES}), waiting ${
            waitTime / 1000
          } seconds before retrying...`
        );

        await new Promise((resolve) => setTimeout(resolve, waitTime));
        console.log("Retrying tweet post...");
      }
      // Handle duplicate content errors (409)
      else if (error.code === 409) {
        console.log(
          "Duplicate content error. Generating new content and retrying..."
        );
        // Generate new content and try again
        const newTweetContent = await generateTweetContent();

        try {
          const result = await client.v2.tweet({
            text: newTweetContent,
          });

          console.log(`Posted tweet with new content: ${newTweetContent}`);
          console.log(`Tweet ID: ${result.data.id}`);

          await saveLastTweetTime(Date.now());
          return true;
        } catch (retryError) {
          console.error("Error posting tweet with new content:", retryError);
          retryCount++;

          if (retryCount > MAX_RETRIES) {
            console.log(`Maximum retries (${MAX_RETRIES}) reached. Giving up.`);
            return false;
          }

          // Wait before next retry
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      } else {
        console.error(`Error posting tweet: ${error.message}`);
        return false;
      }
    }
  }

  return false;
}

// Check if it's time to post a new tweet
async function shouldPostTweet() {
  const lastTweetTime = await loadLastTweetTime();
  const now = Date.now();

  // Calculate hours since last tweet
  const hoursSinceLastTweet = (now - lastTweetTime) / (1000 * 60 * 60);

  // Add some randomness to posting schedule (between 4-8 hours)
  const minHours = 14;
  const maxHours = 24;
  const randomHours = Math.random() * (maxHours - minHours) + minHours;

  console.log(`Hours since last tweet: ${hoursSinceLastTweet.toFixed(2)}`);
  console.log(`Random hours threshold: ${randomHours.toFixed(2)}`);

  return hoursSinceLastTweet >= randomHours;
}

// Main function to check and post tweets
async function checkAndPostTweet() {
  console.log("Checking if it's time to post a tweet...");

  try {
    const shouldPost = await shouldPostTweet();

    if (shouldPost) {
      console.log("It's time to post a new tweet!");
      await postTweet();
    } else {
      console.log("Not time to post a tweet yet.");
    }
  } catch (error) {
    console.error("Error in checkAndPostTweet:", error);
  }
}

// Start the tweet posting service
async function startTweetService(interval) {
  try {
    await checkAndPostTweet();
  } catch (error) {
    console.error("Error in checkAndPostTweet:", error);
  }

  // Schedule the next execution only after the current one completes
  setTimeout(() => startTweetService(interval), interval);
}

module.exports = {
  startTweetService,
  checkAndPostTweet,
  generateTweetContent,
  postTweet,
};
