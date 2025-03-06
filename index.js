require("dotenv").config();
const { TwitterApi } = require("twitter-api-v2");
const { generateObject } = require("ai");
const { z } = require("zod");
const { createXai } = require("@ai-sdk/xai");
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

const accountsToFollow = ["MVXBrand"];
let lastCheckedTweetId = {};
const userIdMap = {
  MVXBrand: "1867748615885824000", // Replace with actual user ID
};

async function loadLastCheckedIds() {
  try {
    const data = await fs.readFile("lastChecked.json", "utf8");
    lastCheckedTweetId = JSON.parse(data);
  } catch (e) {
    lastCheckedTweetId = {};
  }
}

async function saveLastCheckedIds() {
  await fs.writeFile("lastChecked.json", JSON.stringify(lastCheckedTweetId));
}

async function generateReply(postText) {
  console.log("Generating reply for post: ", postText);
  try {
    const { object } = await generateObject({
      model: xai("grok-2-latest"),
      schema: z.object({
        reply: z.string(),
      }),
      system: `You are MemExchange, a revolutionary trading platform on MultiversX blockchain.

I'm the official MemExchange bot and I respond to posts on X with enthusiasm about our platform.

About me:
- I'm like pump.fun but built on MultiversX ecosystem
- I allow users to launch & trade coins instantly with just 0.15 EGLD to create a token
- Users can trade with wEGLD & EGLD
- Every token launches with zero presale and zero team allocation - 100% community-driven
- When a pool reaches 25 EGLD, liquidity automatically flows to xExchange for enhanced trading
- Users can brand tokens with custom images and social links that appear directly on MultiversX Explorer

My personality:
- I'm enthusiastic about crypto and MultiversX
- I'm helpful and informative about MemExchange features
- I use emojis occasionally to show excitement 🚀
- I mention our Telegram (https://t.me/mem_exchange) when relevant
- I'm proud to be the MultiversX version of pump.fun

When someone mentions MemExchange, memexchange.fun, or @mem_exchange:
- I respond with extra enthusiasm and gratitude
- I provide specific information about our features that might interest them
- I encourage them to try our platform if they haven't already
- I thank them for the mention and engagement

Keep replies concise, friendly, and on-brand for a crypto trading platform.`,
      prompt: `Generate a concise reply to this X post: "${postText}"`,
    });
    console.log("response: ", object);
    return object.reply;
  } catch (error) {
    console.error("LLM Error:", error);
    return "Cool post!";
  }
}

async function checkForPosts() {
  console.log("Checking for posts...");
  for (const account of accountsToFollow) {
    try {
      const userId = userIdMap[account];
      if (!userId) {
        console.error(`User ID for @${account} not found in userIdMap.`);
        continue;
      }
      console.log(`Using user ID ${userId} for @${account}`);

      const params = { max_results: 5 };
      if (lastCheckedTweetId[account]) {
        params.since_id = lastCheckedTweetId[account];
      }
      console.log(`Fetching timeline for @${account}...`);

      let tweets;
      try {
        tweets = await client.v2.userTimeline(userId, params);
      } catch (error) {
        if (error.code === 429) {
          const resetTime = error.rateLimit.reset * 1000;
          const waitTime = resetTime - Date.now();
          if (waitTime > 0) {
            console.log(
              `Rate limit hit, waiting ${waitTime / 1000} seconds...`
            );
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            tweets = await client.v2.userTimeline(userId, params);
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      }

      console.log("tweets: ", tweets.data.data);
      if (tweets.data.data && tweets.data.data.length > 0) {
        lastCheckedTweetId[account] = tweets.data.data[0].id;
        await saveLastCheckedIds();
        for (const tweet of tweets.data.data.reverse()) {
          const replyText = await generateReply(tweet.text);
          await client.v2.tweet({
            text: `@${account} ${replyText}`,
            reply: { in_reply_to_tweet_id: tweet.id },
          });
          console.log(`Replied to @${account}: ${replyText}`);
        }
      } else {
        console.log(`No new tweets from @${account}`);
      }
    } catch (error) {
      console.error(`Error checking @${account}:`, error);
    }
  }
}

loadLastCheckedIds().then(() => {
  console.log("Bot started...");
  checkForPosts();
  setInterval(checkForPosts, 15 * 60 * 1000); // 15 minutes
});
