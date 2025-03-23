import express from "express";
import OpenAI from "openai";
import { fileURLToPath } from "url";
import cors from "cors";
import fs from "fs";
import path from "path";
import bodyParser from "body-parser";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import Stripe from "stripe";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Define __dirname manually for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use environment variables for sensitive data
const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // e.g., set in .env file
const STRIPE_SECRET = process.env.STRIPE_SECRET; // Secure Stripe key
let apiKey; // If needed, fetched via function
let apiSecret; // For stripe, though we use STRIPE_SECRET directly

const BASE_URL = "http://localhost:3000";
const PORT = process.env.PORT || 3000;
const app = express();

// Enable CORS for all origins
app.use(cors());

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from uploads and public directories
app.use(express.static("uploads"));
app.use(express.static(path.join(__dirname, "public")));

// Optional: Set CORS headers manually if needed (already enabled by cors middleware)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

// Multer setup for handling file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|mp4/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(
      new Error(
        "Error: File upload only supports the following filetypes - " +
          filetypes
      )
    );
  },
});

// Utility functions for reading and writing the JSON "database"
const DB_PATH = path.join(__dirname, "database", "data.json");
const getDB = () => JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
const saveDB = (data) =>
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

// --- Routes ---

// Home endpoint
app.get("/home", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "home.html"));
});

// Login API
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const db = getDB();

  const user = db.users.find((u) => u.username === username);
  if (user && (await bcrypt.compare(password, user.password))) {
    // Remove sensitive fields before sending
    const { password: pwd, ...safeUser } = user;
    res.json({
      success: true,
      ...safeUser,
    });
  } else {
    res.status(401).json({ success: false, message: "Invalid credentials!" });
  }
});

// Signup API
app.post("/signup", upload.single("profilePic"), async (req, res) => {
  const { username, password, name, email } = req.body;
  const db = getDB();

  if (db.users.find((u) => u.username === username)) {
    return res
      .status(409)
      .json({ success: false, message: "Username already exists!" });
  }
  if (!req.file) {
    return res
      .status(400)
      .json({ success: false, message: "Profile picture is required!" });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.users.push({
      username,
      password: hashedPassword,
      name,
      email,
      profilePic: req.file.filename,
      followers: [],
      following: [],
    });
    saveDB(db);
    res.status(200).json({ success: true, message: "Signup successful!" });
  } catch (error) {
    console.error("Error during signup:", error);
    res.status(500).json({ success: false, message: "Server error!" });
  }
});

// Create Post API
app.post("/post", upload.single("media"), (req, res) => {
  const { description, username, forSale, price } = req.body;
  const db = getDB();
  const user = db.users.find((u) => u.username === username);
  if (!user) {
    return res.status(401).json({ success: false, message: "User not found!" });
  }
  const newPost = {
    id: uuidv4(),
    username,
    profilePic: user.profilePic,
    description,
    media: req.file ? req.file.filename : null,
    mediaType: req.file
      ? req.file.mimetype.startsWith("video/")
        ? "video"
        : "image"
      : null,
    forSale: forSale === "true",
    price: forSale === "true" ? Number(price) : null,
    likes: 0,
    likedBy: [],
    comments: [],
  };
  db.posts.push(newPost);
  saveDB(db);
  res.json({ success: true, message: "Post created successfully!" });
});

// Feed API
app.get("/feed", (req, res) => {
  const db = getDB();
  res.json(db.posts);
});

// Like API
app.post("/like/:id", (req, res) => {
  const postId = req.params.id;
  const { username } = req.body;
  const db = getDB();

  if (!username) {
    return res.status(400).json({
      success: false,
      message: "Username is required to like a post",
    });
  }
  const post = db.posts.find((p) => p.id === postId);
  if (post) {
    if (post.likedBy.includes(username)) {
      post.likes--;
      post.likedBy = post.likedBy.filter((user) => user !== username);
      saveDB(db);
      res.json({ success: true, message: "Post unliked successfully!" });
    } else {
      post.likes++;
      post.likedBy.push(username);
      saveDB(db);
      res.json({ success: true, message: "Post liked successfully!" });
    }
  } else {
    res.status(404).json({ success: false, message: "Post not found" });
  }
});

// Comment API
app.post("/comment/:id", (req, res) => {
  const { comment, username } = req.body;
  const db = getDB();
  const post = db.posts.find((p) => p.id === req.params.id);
  if (post) {
    post.comments.push({ username, comment });
    saveDB(db);
    res.json({ success: true, message: "Comment added!" });
  } else {
    res.status(404).json({ success: false, message: "Post not found!" });
  }
});

// Update Post API (fixed bug: using db.posts instead of undefined 'posts')
app.put("/api/posts/:id", (req, res) => {
  const postId = req.params.id;
  const updatedPost = req.body;
  const db = getDB();
  const postIndex = db.posts.findIndex((post) => post.id === postId);
  if (postIndex === -1) {
    return res.status(404).send("Post not found");
  }
  db.posts[postIndex] = { ...db.posts[postIndex], ...updatedPost };
  saveDB(db);
  res.json(db.posts[postIndex]);
});

// Delete Post API
app.delete("/api/posts/:id", (req, res) => {
  const postId = req.params.id;
  const db = getDB();
  const postIndex = db.posts.findIndex((post) => post.id === postId);
  if (postIndex === -1) {
    return res.status(404).send("Post not found");
  }
  db.posts.splice(postIndex, 1);
  saveDB(db);
  res.send("Post deleted");
});

// User Profile API
app.get("/user/:username", (req, res) => {
  const db = getDB();
  const user = db.users.find((u) => u.username === req.params.username);
  if (user) {
    // Exclude sensitive fields
    const { password, ...safeUser } = user;
    res.json(safeUser);
  } else {
    res.status(404).json({ success: false, message: "User not found!" });
  }
});

// User Posts API
app.get("/posts", (req, res) => {
  const { username } = req.query;
  const db = getDB();
  const userPosts = db.posts.filter((post) => post.username === username);
  res.json(userPosts);
});

// Follow/Unfollow API
app.post("/follow", (req, res) => {
  const { currentUser, targetUser } = req.body;
  const db = getDB();
  const follower = db.users.find((u) => u.username === currentUser);
  const followee = db.users.find((u) => u.username === targetUser);
  if (!follower || !followee) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  const isFollowing = followee.followers.includes(currentUser);
  if (isFollowing) {
    followee.followers = followee.followers.filter((u) => u !== currentUser);
    follower.following = follower.following.filter((u) => u !== targetUser);
  } else {
    followee.followers.push(currentUser);
    follower.following.push(targetUser);
  }
  saveDB(db);
  res.json({ success: true, isFollowing: !isFollowing });
});

// Endpoint to fetch raw database data (for debugging)
app.get("/data", (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    res.json(data);
  } catch (error) {
    console.error("Error reading/parsing JSON file:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// AI Search API
const openai = new OpenAI({
  baseURL: "https://models.inference.ai.azure.com",
  apiKey: OPENAI_API_KEY,
});

/**
 * Calls the OpenAI API with the given prompt and retries until a valid JSON array is returned.
 * @param {string} prompt - The prompt to send to the API.
 * @param {number} maxRetries - Maximum number of retries.
 * @returns {Promise<Array>} - The valid array of scores.
 */
async function fetchValidScores(prompt, maxRetries = 5) {
  let attempts = 0;
  while (attempts < maxRetries) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: prompt }],
        temperature: 1,
        max_tokens: 4096,
        top_p: 1,
      });

      const rawResponse = response.choices[0]?.message?.content?.trim();
      const scores = JSON.parse(rawResponse);

      if (Array.isArray(scores)) {
        return scores;
      } else {
        console.warn(
          `Attempt ${
            attempts + 1
          }: Received result is not an array. Retrying...`
        );
      }
    } catch (error) {
      console.warn(
        `Attempt ${
          attempts + 1
        }: Error parsing response or calling API. Retrying...`
      );
    }
    attempts++;
  }
  throw new Error("Failed to get valid scores after maximum retries.");
}

app.post("/api/search", async (req, res) => {
  try {
    const filePath = path.join(__dirname, "database", "data.json");
    if (!fs.existsSync(filePath)) {
      return res.status(500).json({ error: "Database file not found." });
    }
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    // console.log(data.posts);
    const { query } = req.body; // User's search query

    if (!query) {
      return res.status(400).json({ error: "Search query is required" });
    }

    const prompt = `
You are an AI model specialized in semantic matching and relevance scoring. Your goal is to evaluate how well posts in a dataset match a given search query.
. You are given:
- A search query: "${query}"
- A dataset of posts: ${JSON.stringify(data.posts)}

Each post in the dataset contains  fields Like :"username","forSale","likedBy:[]","comments:[]" "description" and "media type". Your task is to assign each post a relevance score between 1 and 100 based solely on the following factors:
// example post:
 {
      "id": "ab270ea8-e4a0-4b55-91ac-994a68991fc9",
      "username": "kiara",
      "profilePic": "1732541684746.png",
      "description": "The image shows a rectangular frame made from colorful popsicle sticks arranged in layers, creating a vibrant border around a black center.\r\n\r\nMaterials Used:\r\nPopsicle sticks (various colors)\r\nAdhesive (e.g., glue) for sticking the sticks together",
      "media": "1732598454344.png",
      "mediaType": "image",
      "forSale": true,
      "price": 20,
      "likes": 1,
      "likedBy": [
        "kiara"
      ],
      "comments": []
    }
//
1. **Semantic Similarity**: How closely does the post's description match the search query?
2. **Media Type Alignment**: How well does the post's media type correspond to the intent and context of the search query?
3. find posts size how may posts it have , and you have to give scores accordingly
Use these scoring guidelines:
- **90-100**: Perfect match – the description and media type directly address the search query.
- **70-89**: Good match – one of the fields (description or media type) aligns very well with the query.
- **50-69**: Partial match – there is some relevance in either field, but the overall match is not strong.
- **1-49**: Poor match – minimal or no alignment with the search query.

Task:
For every post in the dataset, calculate a relevance score following the criteria above. Return a JSON array of these scores in the order corresponding to the posts in the dataset (e.g., [85, 72, 45, ...]). Do not include any commentary or explanation; output only the JSON array.

Be precise, consistent, and ensure every post is assigned a score.

`;

    // Call the helper function to fetch valid scores
    const scores1 = await fetchValidScores(prompt, 5);
    console.log(scores1);
    // Sorting function to rank posts based on scores
    const rankedPosts = scores1
      .map((score, index) => ({ score, index }))
      .sort((a, b) => b.score - a.score)
      .map((item) => item.index);

    res.json(rankedPosts);
  } catch (error) {
    console.error("Error processing search:", error.message);
    res
      .status(500)
      .json({ error: "Failed to process search. Please try again." });
  }
});

// Payment Endpoint (Stripe Checkout)
app.post("/create-checkout-session", async (req, res) => {
  try {
    const stripe = new Stripe(STRIPE_SECRET);
    const { amount, postId, buyerUsername } = req.body;
    if (!amount || !postId || !buyerUsername) {
      return res
        .status(400)
        .json({ success: false, error: "Missing parameters" });
    }
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Post #${postId}`,
            },
            unit_amount: amount * 100,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${BASE_URL}/payment-success`,
      cancel_url: `${BASE_URL}/payment-fail`,
    });
    res.json({ success: true, sessionId: session.id });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Payment Success Page
app.get("/payment-success", (req, res) => {
  res.sendFile(path.join(__dirname, "payment-success.html"));
});

// Payment Failure Page
app.get("/payment-fail", (req, res) => {
  res.sendFile(path.join(__dirname, "payment-fail.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
