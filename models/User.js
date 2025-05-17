// const mongoose = require("mongoose");
import mongoose from "mongoose";
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  name: String,
  email: String,
  profilePic: String,
  followers: [String],
  following: [String],
});

const User = mongoose.model("User", userSchema);
export default User; // ✅ Default export
