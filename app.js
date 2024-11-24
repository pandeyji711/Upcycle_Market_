const express = require("express");
const cors = require("cors"); // Import CORS package
const bodyParser = require("body-parser");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcryptjs");
// const data = require("./database/data.json");
// console.log(data);
const app = express();
const PORT = 3000;
const genAI = new GoogleGenerativeAI("AIzaSyCOhVYSHrIB107NoKOMdHnOED9h29ZhFm4");
const model = genAI.getGenerativeModel({ model: "gemini-pro" });
// Enable CORS for all origins
app.use(cors());
// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use((req, res, next) => {
  // Enable CORS for frontend
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});
// Middleware
app.use(bodyParser.json());
app.use(express.static("uploads"));

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
  limits: { fileSize: 500 * 1024 * 1024 }, // Limit to 200MB
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
      "Error: File upload only supports the following filetypes - " + filetypes
    );
  },
});

// Read/write JSON database
const getDB = () => JSON.parse(fs.readFileSync("./database/data.json", "utf8"));
const saveDB = (data) =>
  fs.writeFileSync("./database/data.json", JSON.stringify(data, null, 2));

// Login API
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const db = getDB();

  // Find the user by username
  const user = db.users.find((u) => u.username === username);

  // Check if user exists and compare hashed passwords
  console.log(user);
  if (user && (await bcrypt.compare(password, user.password))) {
    res.json({
      success: true,
      username: user.username,
      following: user.following, // Send the following array
    });
  } else {
    res.status(401).json({ success: false, message: "Invalid credentials!" });
  }
});
app.post("/signup", upload.single("profilePic"), async (req, res) => {
  const { username, password, name, email } = req.body;
  const db = getDB();

  // Check if the username already exists
  if (db.users.find((u) => u.username === username)) {
    return res
      .status(409)
      .json({ success: false, message: "Username already exists!" });
  }

  // Check if a file was uploaded
  if (!req.file) {
    return res
      .status(400)
      .json({ success: false, message: "Profile picture is required!" });
  }

  try {
    // Hash the password before saving it
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save the user data along with the profile picture path
    db.users.push({
      username,
      password: hashedPassword,
      name,
      email,
      profilePic: req.file.filename, // Save the path to the uploaded file
      followers: [],
      following: [],
    });
    saveDB(db); // Save the updated database

    res.status(200).json({ success: true, message: "Signup successful!" });
  } catch (error) {
    console.error("Error during signup:", error);
    res.status(500).json({ success: false, message: "Server error!" });
  }
});
// Post API
app.post("/post", upload.single("media"), (req, res) => {
  const { description, username } = req.body;
  const db = getDB();

  const user = db.users.find((u) => u.username === username);
  if (!user) {
    return res.status(401).json({ success: false, message: "User not found!" });
  }
  const profilePic = user.profilePic;

  const newPost = {
    id: uuidv4(),
    username,
    profilePic,
    description,
    media: req.file ? req.file.filename : null,
    mediaType: req.file
      ? req.file.mimetype.startsWith("video/")
        ? "video"
        : "image"
      : null,

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
  const { username } = req.body; // Get username from request body
  const db = getDB(); // Load the database here

  if (!username) {
    return res.status(400).json({
      success: false,
      message: "Username is required to like a post",
    });
  }

  const post = db.posts.find((p) => p.id === postId); // Use db instead of data

  if (post) {
    if (post.likedBy.includes(username)) {
      // Unlike the post
      post.likes--;
      post.likedBy = post.likedBy.filter((user) => user !== username); // Remove username
      saveDB(db); // Save the updated database
      res.json({ success: true, message: "Post unliked successfully!" });
    } else {
      // Like the post
      post.likes++;
      post.likedBy.push(username); // Add username to likedBy array
      saveDB(db); // Save the updated database
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

  // Use string matching for UUID
  const post = db.posts.find((p) => p.id === req.params.id);

  if (post) {
    post.comments.push({ username, comment });
    saveDB(db); // Save updated data
    res.json({ success: true, message: "Comment added!" });
  } else {
    res.status(404).json({ success: false, message: "Post not found!" });
  }
});

app.put("/api/posts/:id", (req, res) => {
  console.log("hii");
  const postId = req.params.id;
  const updatedPost = req.body; // Expected { description: 'new text', media: 'new media' }

  const postIndex = posts.findIndex((post) => post.id === postId);
  if (postIndex === -1) {
    return res.status(404).send("Post not found");
  }

  posts[postIndex] = { ...posts[postIndex], ...updatedPost };
  res.json(posts[postIndex]);
});

// Delete a post
app.delete("/api/posts/:id", (req, res) => {
  const postId = req.params.id;
  const db = getDB();
  const postIndex = db.posts.findIndex((post) => post.id === postId);

  if (postIndex === -1) {
    return res.status(404).send("Post not found");
  }

  db.posts.splice(postIndex, 1); // Remove the post
  saveDB(db);
  res.send("Post deleted");
});

//profile page
app.get("/user/:username", (req, res) => {
  const db = getDB();
  const user = db.users.find((u) => u.username === req.params.username);
  if (user) {
    res.json(user);
  } else {
    res.status(404).json({ success: false, message: "User not found!" });
  }
});

app.get("/posts", (req, res) => {
  const { username } = req.query;
  const db = getDB();
  const userPosts = db.posts.filter((post) => post.username === username);
  res.json(userPosts);
});

//follow
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
    // Unfollow
    followee.followers = followee.followers.filter((u) => u !== currentUser);
    follower.following = follower.following.filter((u) => u !== targetUser);
  } else {
    // Follow
    followee.followers.push(currentUser);
    follower.following.push(targetUser);
  }

  saveDB(db);
  res.json({ success: true, isFollowing: !isFollowing });
});

//fetching data from database
app.get("/data", (req, res) => {
  const filePath = path.join(__dirname, "database", "data.json");

  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8")); // Dynamically read and parse JSON
    res.json(data);
  } catch (error) {
    console.error("Error reading or parsing the JSON file:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// ai search
app.post("/api/search", async (req, res) => {
  try {
    const filePath = path.join(__dirname, "database", "data.json");
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const { query } = req.body; // User's search query
    if (!query) {
      return res.status(400).json({ error: "Search query is required" });
    }

    const prompt = `
You are an advanced AI model trained for semantic matching. Your task is to analyze a user's search query and a dataset of posts to assign a relevance score to each post based on how well its description and media type align with the query.

### Input:
1. **Search Query**: "${query}"
2. **Dataset**: ${JSON.stringify(data)}

### Scoring Criteria:
- Focus primarily on matching the post's **description** and **media type** with the search query.
- Evaluate the semantic similarity between the query and the description.
- Consider how well the media type corresponds to the query's intent.

### Scoring Guidelines:
- **90-100**: Perfect match - the description and media type directly address the query.
- **70-89**: Good match - the description or media type aligns well, even if not perfectly.
- **50-69**: Partial match - either the description or media type has some relevance.
- **1-49**: Poor match - minimal or no alignment with the query.

### Task:
1. Analyze each post in the dataset using the criteria above.
2. Assign a relevance score (1-100) to every post, ensuring that every post gets a score.
3. Focus only on the post's **description** and **media type** when determining relevance.

### Output:
Return a JSON array of relevance scores, one for each post in the dataset, e.g., [85, 72, 45, ...].
- Do not include explanations or additional text, only the JSON array.
`;

    const result = await model.generateContent(prompt);
    const rawResponse = result.response.text();

    // Parse the scores
    const scores = JSON.parse(rawResponse);

    if (!Array.isArray(scores)) {
      throw new Error("Invalid AI response format.");
    }

    // Pair scores with posts and filter/sort by relevance
    function filter(v) {
      // Create a vector of pairs {value, index}
      let vp = [];
      for (let i = 0; i < v.length; i++) {
        vp.push({ value: v[i], index: i });
      }

      // Sort the pairs in descending order of values
      vp.sort((a, b) => b.value - a.value);

      // Extract indices from the sorted pairs
      let res = [];
      for (let i = 0; i < vp.length; i++) {
        res.push(vp[i].index);
      }

      return res;
    }

    let filteredPosts = filter(scores);
    console.log(filteredPosts);
    res.json(filteredPosts);
  } catch (error) {
    console.error("Error processing search:", error.message);
    res
      .status(500)
      .json({ error: "Failed to process search. Please try again." });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
