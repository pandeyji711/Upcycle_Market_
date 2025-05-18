import express from "express";
import OpenAI from "openai";
import mongoose from "mongoose";
import fs from "fs";
import { fileURLToPath } from "url";
import cors from "cors";
import path from "path";
import bodyParser from "body-parser";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import Stripe from "stripe";
import dotenv from "dotenv";
const baseURL = "http://localhost:3000";
const BASE_URL = "http://localhost:3000";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

const app = express();

// Load environment variables
dotenv.config();

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Get __dirname with ES module syntax
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(bodyParser.json());

const STRIPE_SECRET = process.env.STRIPE_SECRET;
const PORT = process.env.PORT || 3000;
const mongopass = process.env.mongo_password;
// Enable CORS for all origins
app.use(cors());
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

// Connect to MongoDB
mongoose
  .connect(
    `mongodb+srv://anurag_:${mongopass}cluster0.0gmv1vr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`
  )
  .then(() => console.log("✅ Connected to MongoDB!"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Schemas
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  name: String,
  email: String,
  profilePic: String,
  followers: [String],
  following: [String],
});

const postSchema = new mongoose.Schema({
  id: String,
  username: String,
  profilePic: String,
  description: String,
  media: String,
  mediaType: String,
  forSale: Boolean,
  price: Number,
  likes: Number,
  likedBy: [String],
  comments: [
    {
      username: String,
      comment: String,
    },
  ],
});

const User = mongoose.model("User", userSchema);
const Post = mongoose.model("Post", postSchema);

// Multer Cloudinary storage setup
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "upcycle_media", // folder in Cloudinary
    allowed_formats: ["jpg", "jpeg", "png", "gif", "mp4"],
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max
});

// Routes

app.get("/home", (req, res) => res.render("home"));
app.get("/", (req, res) => res.render("index"));

// Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (user && (await bcrypt.compare(password, user.password))) {
    const { password, ...safeUser } = user.toObject();

    res.json({ success: true, ...safeUser });
  } else {
    res.status(401).json({ success: false, message: "Invalid credentials!" });
  }
});

// Signup with Cloudinary upload for profilePic
app.post("/signup", upload.single("profilePic"), async (req, res) => {
  const { username, password, name, email } = req.body;

  if (await User.findOne({ username })) {
    return res
      .status(409)
      .json({ success: false, message: "Username already exists!" });
  }

  if (!req.file || !req.file.path) {
    return res
      .status(400)
      .json({ success: false, message: "Profile picture is required!" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      username,
      password: hashedPassword,
      name,
      email,
      profilePic: req.file.path, // Cloudinary URL
      followers: [],
      following: [],
    });
    await newUser.save();
    res.json({ success: true, message: "Signup successful!" });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ success: false, message: "Server error!" });
  }
});
//feed
app.get("/feed", async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});
// Create Post with Cloudinary upload for media
app.post("/post", upload.single("media"), async (req, res) => {
  const { description, username, forSale, price } = req.body;
  const user = await User.findOne({ username });
  if (!user)
    return res.status(401).json({ success: false, message: "User not found!" });

  try {
    let mediaUrl = null;
    let mediaType = null;

    if (req.file) {
      // Upload file to Cloudinary
      const result = await cloudinary.uploader.upload(req.file.path, {
        resource_type: req.file.mimetype.startsWith("video/")
          ? "video"
          : "image",
        folder: "upcycle_media", // optional: put it into a folder
      });

      mediaUrl = result.secure_url;
      mediaType = req.file.mimetype.startsWith("video/") ? "video" : "image";

      // ✅ Correct local file deletion
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    }

    const newPost = new Post({
      id: uuidv4(),
      username,
      profilePic: user.profilePic,
      description,
      media: mediaUrl,
      mediaType,
      forSale: forSale === "true",
      price: forSale === "true" ? Number(price) : null,
      likes: 0,
      likedBy: [],
      comments: [],
    });

    await newPost.save();
    res.json({
      success: true,
      message: "Post created successfully!",
      post: newPost,
    });
  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    res.status(500).json({ success: false, message: "Upload failed" });
  }
});

// Like/unlike
app.post("/like/:id", async (req, res) => {
  const { username } = req.body;
  const post = await Post.findOne({ id: req.params.id });
  if (!post)
    return res.status(404).json({ success: false, message: "Post not found" });

  if (post.likedBy.includes(username)) {
    post.likes--;
    post.likedBy = post.likedBy.filter((u) => u !== username);
  } else {
    post.likes++;
    post.likedBy.push(username);
  }
  await post.save();
  res.json({
    success: true,
    message: post.likedBy.includes(username)
      ? "Post liked successfully!"
      : "Post unliked successfully!",
  });
});

// Comment on post
app.post("/comment/:id", async (req, res) => {
  const { comment, username } = req.body;
  const post = await Post.findOne({ id: req.params.id });
  if (!post)
    return res.status(404).json({ success: false, message: "Post not found!" });

  post.comments.push({ username, comment });
  await post.save();
  res.json({ success: true, message: "Comment added!" });
});

// Update post
app.put("/api/posts/:id", async (req, res) => {
  const updatedPost = await Post.findOneAndUpdate(
    { id: req.params.id },
    req.body,
    { new: true }
  );
  if (!updatedPost) return res.status(404).send("Post not found");
  res.json(updatedPost);
});

// Delete post
app.delete("/api/posts/:id", async (req, res) => {
  const deleted = await Post.findOneAndDelete({ id: req.params.id });
  if (!deleted) return res.status(404).send("Post not found");
  res.send("Post deleted");
});

// Get user profile
app.get("/user/:username", async (req, res) => {
  const user = await User.findOne({ username: req.params.username }).lean();
  if (!user)
    return res.status(404).json({ success: false, message: "User not found!" });

  const { password, ...safeUser } = user;
  res.json(safeUser);
});

// Get user posts
app.get("/posts", async (req, res) => {
  const posts = await Post.find({ username: req.query.username });
  res.json(posts);
});

// Follow/unfollow
app.post("/follow", async (req, res) => {
  const { currentUser, targetUser } = req.body;

  const follower = await User.findOne({ username: currentUser });
  const followee = await User.findOne({ username: targetUser });

  if (!follower || !followee) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  const isFollowing = followee.followers.includes(currentUser);

  if (isFollowing) {
    // Unfollow
    await User.findOneAndUpdate(
      { username: targetUser },
      { $pull: { followers: currentUser } }
    );

    await User.findOneAndUpdate(
      { username: currentUser },
      { $pull: { following: targetUser } }
    );
  } else {
    // Follow
    await User.findOneAndUpdate(
      { username: targetUser },
      { $addToSet: { followers: currentUser } }
    );

    await User.findOneAndUpdate(
      { username: currentUser },
      { $addToSet: { following: targetUser } }
    );
  }

  res.json({ success: true, isFollowing: !isFollowing });
});

// Debug route for all data
app.get("/data", async (req, res) => {
  const users = await User.find();
  const posts = await Post.find();
  res.json({ users, posts });
});
//fetch post data for ai
let PostData;
async function fetchData() {
  const PostData = await Post.find();
  // console.log(d);
}

// AI Search API

const endpoint = "https://models.github.ai/inference";
const token = process.env.OPENAI_API_KEY;
const model = "openai/gpt-4.1";
/**
 * Calls the OpenAI API with the given prompt and retries until a valid JSON array is returned.
 * @param {string} prompt - The prompt to send to the API.
 * @param {number} maxRetries - Maximum number of retries.
 * @returns {Promise<Array>} - The valid array of scores.
 */
const openai = new OpenAI({ baseURL: endpoint, apiKey: token });

async function fetchValidScores(prompt, maxRetries = 5) {
  for (let attempts = 0; attempts < maxRetries; attempts++) {
    try {
      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant scoring posts.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 1,
        top_p: 1,
      });

      const content = response.choices[0].message.content?.trim();
      const match = content.match(/\[.*\]/s);
      if (!match) throw new Error("No valid JSON array found.");
      const scores = JSON.parse(match[0]);

      if (Array.isArray(scores)) return scores;
    } catch (err) {
      console.warn(`Attempt ${attempts + 1} failed:`, err.message);
      await new Promise((res) => setTimeout(res, 1000 * (attempts + 1)));
    }
  }

  throw new Error("Failed to get valid scores after retries.");
}

app.post("/api/search", async (req, res) => {
  try {
    fetchData();
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
- A dataset of posts: ${JSON.stringify(PostData)}

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
    // console.log(scores1);
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
  res.render("payment-success");
});
app.get("/index", (req, res) => {
  res.render("index");
});
// Payment Failure Page
app.get("/payment-fail", (req, res) => {
  res.render("payment-fail");
});
app.get("/profile", (req, res) => {
  res.render("profile");
});
// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
