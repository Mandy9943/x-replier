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

const accountsToFollow = [
  "MVXBrand",
  "mandy_9943",
  "MultiversX",
  "DappRadar",
  "xExchangeApp",
  "lucianmincu",
];
let lastCheckedTweetId = {};
const userIdMap = {
  MVXBrand: "1867748615885824000",
  mandy_9943: "1455420368986968067",
  MultiversX: "986967941685153792",
  DappRadar: "962293079012241408",
  beniaminmincu: "1392307531",
  xExchangeApp: "1380481827786342401",
  lucianmincu: "881554124025860096",
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
            text: `${replyText}`,
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

// Replace the interval-based execution with a recursive timeout approach
async function startPolling(interval) {
  try {
    await checkForPosts();
  } catch (error) {
    console.error("Error in checkForPosts:", error);
  }

  // Schedule the next execution only after the current one completes
  setTimeout(() => startPolling(interval), interval);
}

loadLastCheckedIds().then(() => {
  console.log("Bot started...");
  startPolling(15 * 60 * 1000); // 15 minutes
});
