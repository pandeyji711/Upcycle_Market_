const BASE_URL = "http://localhost:3000";
let following = []; // Global array to track following
const loginSection = document.getElementById("login-section");
const signupSection = document.getElementById("signup-section");
const postSection = document.getElementById("post-section");
const feedSection = document.getElementById("feed");
const logoutButton = document.getElementById("logout-btn");
const goToProfileBtn = document.getElementById("go-to-profile");
const search = document.getElementById("se");
const se = document.getElementById("search-btn");
document.getElementById("search-btn").addEventListener("click", handleSearch);
let apipub;

async function fetchpublic() {
  const endpoint =
    "https://script.google.com/macros/s/AKfycbxx3iQoL1f3OihLF6h_L2n1T_lR3mhYzKb3hqmL3bn_ArM0wvuNjaUjzkKmc6dFwZiG/exec";

  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    apipub = data.apik[0].apikey; // Accessing the API key
    // console.log("Fetched API Key:", apiKey);

    // Use the apiKey here
  } catch (error) {
    console.error("Error fetching API key:", error);
  }
}

// Check login status on page load
window.onload = () => {
  const user = localStorage.getItem("user");
  if (user) {
    const user1 = JSON.parse(user); // Parse the JSON string
    following = user1.following || [];
    console.log("Logged-in user:", user);
    console.log("Following array:", user1.following); // Check the following array
    loginSection.style.display = "none";
    signupSection.style.display = "none";
    postSection.style.display = "flex";
    postSection.style.justifyContent = "center";
    feedSection.style.display = "block";
    search.style.display = "block";
    // goToProfileBtn.style.display = "block";
    logoutButton.style.display = "block";
    loadFeed();
  }
};
// Fetch posts from the backend and load them into the profile section
// document.getElementById("profile-icon").addEventListener("click", () => {
//   // Hide main feed and show profile section
//   document.getElementById("post-section").style.display = "none";
//   document.getElementById("feed").style.display = "none";
//   document.getElementById("profile-section").style.display = "block";

//   loadUserPosts(); // Load user posts
// });

function loadUserPosts() {
  fetch("/api/posts")
    .then((response) => response.json())
    .then((posts) => {
      const profilePostsContainer = document.getElementById("profile-posts");
      profilePostsContainer.innerHTML = ""; // Clear previous posts

      posts.forEach((post) => {
        console.log(posts.media);
        const postDiv = document.createElement("div");
        postDiv.classList.add("post");
        postDiv.innerHTML = `
          <h3>${post.description}</h3>
          <img src="${post.media}" alt="Post Media" style="max-width: 200px;">
          <button onclick="editPost(${post.id})">Edit</button>
          <button onclick="deletePost(${post.id})">Delete</button>
        `;
        profilePostsContainer.appendChild(postDiv);
      });
    })
    .catch((error) => console.error("Error fetching posts:", error));
}

// Show Sign-Up form
document.getElementById("go-to-signup").addEventListener("click", () => {
  loginSection.style.display = "none";
  signupSection.style.display = "block";
});

// Show Login form
document.getElementById("go-to-login").addEventListener("click", () => {
  signupSection.style.display = "none";
  loginSection.style.display = "block";
});

// Login
document
  .getElementById("login-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value.trim();

    const response = await fetch(`${BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    if (data.success) {
      // alert("Login successful");
      // Store user info and following array in localStorage
      localStorage.setItem(
        "user",
        JSON.stringify({
          username: data.username,
          following: data.following || [], // Save following array
          profilePic: data.profilePic,
        })
      );
      // localStorage.setItem("user", JSON.stringify({ username }));
      loginSection.style.display = "none";
      signupSection.style.display = "none";
      postSection.style.display = "flex";
      postSection.style.justifyContent = "center";
      feedSection.style.display = "block";
      logoutButton.style.display = "block";
      search.style.display = "block";
      loadFeed();
    } else {
      alert(data.message);
    }
  });

// Signup
// Signup
document
  .getElementById("signup-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();

    // Get form inputs
    const username = document.getElementById("signup-username").value.trim();
    const password = document.getElementById("signup-password").value.trim();
    const name = document.getElementById("signup-name").value.trim();
    const email = document.getElementById("signup-email").value.trim();
    const profilePic = document.getElementById("signup-profile-pic").files[0];

    if (!profilePic) {
      alert("Please upload a profile picture.");
      return;
    }

    // Create a FormData object to send form data and the file
    const formData = new FormData();
    formData.append("username", username);
    formData.append("password", password);
    formData.append("name", name);
    formData.append("email", email);
    formData.append("profilePic", profilePic);

    try {
      const response = await fetch(`${BASE_URL}/signup`, {
        method: "POST",
        body: formData, // Send FormData to include the file
      });

      // Check if response is valid JSON
      const data = await response.json();
      console.log(data);

      if (response.ok && data.success) {
        alert(data.message);
        signupSection.style.display = "none";
        loginSection.style.display = "block";
      } else {
        alert(data.message || "Sign-up failed.");
      }
    } catch (error) {
      console.error("Error during signup:", error);
      console.log(data);
      alert("An error occurred during sign-up. Please try again.");
    }
  });

// Post
document.getElementById("post-btn").addEventListener("click", async () => {
  const description = document.getElementById("description").value.trim();
  const fileInput = document.getElementById("media-upload");
  const sellToggle = document.getElementById("sell-toggle").checked;
  const sellingPrice = document.getElementById("selling-price").value.trim();

  // Retrieve user object
  const user = JSON.parse(localStorage.getItem("user"));

  if (!user) {
    alert("You need to log in to post.");
    return;
  }

  // Validate input
  if (sellToggle && !sellingPrice) {
    alert("Please provide a selling price if you want to sell this item.");
    return;
  }

  // Prepare FormData
  const formData = new FormData();
  formData.append("description", description);
  formData.append("username", user.username);
  if (fileInput.files.length > 0) {
    formData.append("media", fileInput.files[0]);
  }
  formData.append("forSale", sellToggle);
  if (sellToggle) {
    formData.append("price", sellingPrice);
  }

  // Send data to the server
  try {
    const response = await fetch(`${BASE_URL}/post`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (data.success) {
      alert(data.message);
      loadFeed(); // Reload feed after successful post
      closePopup();
    } else {
      alert(data.message || "Failed to create post.");
    }
  } catch (error) {
    console.error("Error creating post:", error);
    alert("An error occurred. Please try again.");
  }
});

// Logout
logoutButton.addEventListener("click", () => {
  const user = localStorage.getItem("user");
  if (user == null) {
    alert("please login first ");
  } else {
    localStorage.removeItem("user");
    // alert("Logged out successfully");
    loginSection.style.display = "block";
    signupSection.style.display = "none";
    postSection.style.display = "none";
    feedSection.style.display = "none";
    logoutButton.style.display = "none";
    search.style.display = "none";
  }
});

// Load Feed
async function loadFeed() {
  const response = await fetch("/feed");
  const posts = await response.json();

  const feed = document.getElementById("feed");
  feed.innerHTML = ""; // Clear previous feed content

  const user = JSON.parse(localStorage.getItem("user")); // Current logged-in user
  if (!user) {
    alert("Please log in to interact with posts.");
    return;
  }

  posts.forEach((post) => {
    const postDiv = document.createElement("div");
    postDiv.className = "post";

    // Check if the current user has liked the post
    const isLiked = post.likedBy.includes(user.username);
    const likeButtonClass = isLiked ? "liked" : "unliked";
    const likeButtonText = isLiked ? "Unlike" : "Like";

    // Check if the current user follows the post's author
    const isFollowing = user.following?.includes(post.username) || false;
    const followButtonText = isFollowing ? "Unfollow" : "Follow";

    // Create the post content dynamically
    postDiv.innerHTML = `
    <div class="post-header">
      <img src="${post.profilePic}" alt="User Pic" class="post-pic">
      <div class="post-user">
        <h4><i class="fas fa-user"></i> ${post.username}</h4>
      </div>
      <button id="follow-btn-${post.username}" 
              onclick="toggleFollow('${user.username}', '${post.username}')">
        ${followButtonText}
      </button>
    </div>
    <div class="post-content">
      <p>${post.description}</p>
      ${
        post.media
          ? post.mediaType === "video"
            ? `<video controls width="100%"><source src="${post.media}" type="video/mp4"></video>`
            : `<img src="${post.media}" alt="Post Image" class="post-img">`
          : ""
      }
    </div>
    <div class="post-actions">
      <button id="like-btn-${post.id}" 
              class="${likeButtonClass}" 
              onclick="likePost('${post.id}')">
        <i class="fas fa-thumbs-up"></i> ${likeButtonText} (${post.likes})
      </button>
      <button><i class="fas fa-comment-alt"></i> Comment</button>
      <button><i class="fas fa-share"></i> Share</button>
      ${
        post.forSale
          ? `<button id="buy-btn-${post.id}" onclick="redirectToPayment(${post.price}, '${post.id}')">
               <i class="fas fa-shopping-cart"></i> Buy for $${post.price}
             </button>`
          : ""
      }
    </div>
    <div class="post-comments">
      ${post.comments
        .map(
          (comment) =>
            `<p><strong>${comment.username}:</strong> ${comment.comment}</p>`
        )
        .join("")}
      <input type="text" placeholder="Add a comment" id="comment-input-${
        post.id
      }">
      <button onclick="commentPost('${
        post.id
      }', document.getElementById('comment-input-${post.id}').value)">
        Submit
      </button>
    </div>
  `;

    // Append the post to the feed
    feed.appendChild(postDiv);
  });
}

async function redirectToPayment(price, postId) {
  const buybtn = document.getElementById(`buy-btn-${postId}`);
  buybtn.innerHTML = "redirecting..";
  buybtn.disabled = true;
  await fetchpublic();

  // Assume we are sending the price, postId to initiate the payment
  const user = JSON.parse(localStorage.getItem("user")); // Get current logged-in user
  const userUsername = user?.username; // The current logged-in user's username

  if (!userUsername) {
    alert("You need to be logged in to make a payment.");
    return;
  }

  // Send the data to the backend to create a Stripe checkout session
  fetch(`${BASE_URL}/create-checkout-session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: price, // Price of the post
      postId: postId, // ID of the post being bought
      buyerUsername: userUsername, // Logged-in user's username
    }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to create checkout session.");
      }
      return response.json(); // Parse the JSON response from the server
    })
    .then((data) => {
      if (data.success) {
        buybtn.innerHTML = `Buy for $${price}`;
        buybtn.disabled = false;
        const stripe = Stripe(
          apipub // Stripe publishable key
        );
        // Redirect to Stripe checkout with the sessionId
        return stripe.redirectToCheckout({ sessionId: data.sessionId });
      } else {
        alert("Failed to initiate payment. Please try again.");
      }
    })
    .catch((error) => {
      console.error("Error during payment initiation:", error);
      alert(
        "There was an error processing your request. Please try again later."
      );
    });
}

// Redirect to the payment gateway
// Frontend function to create Checkout session and redirect
const createCheckoutSession = async (amount, postId, buyerUsername) => {
  try {
    const response = await fetch(`${BASE_URL}/create-checkout-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount, postId, buyerUsername }),
    });

    const session = await response.json();
    if (session.success) {
      const stripe = Stripe(apipub); // Your Stripe Publishable Key
      const result = await stripe.redirectToCheckout({
        sessionId: session.sessionId,
      });
      if (result.error) {
        console.error(result.error.message); // Handle errors (e.g., show message to the user)
      }
    }
  } catch (error) {
    console.error("Error:", error);
  }
};
const handlePayment = async (amount, postId, buyerUsername) => {
  const response = await fetch(`/create-payment-intent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, postId, buyerUsername }),
  });

  const { clientSecret } = await response.json();

  const stripe = Stripe(apipub);
  const result = await stripe.confirmCardPayment(clientSecret, {
    payment_method: {
      card: cardElement, // cardElement is from Stripe's Elements
      billing_details: { name: buyerUsername },
    },
  });

  if (result.error) {
    console.error(result.error.message); // Handle error
  } else {
    if (result.paymentIntent.status === "succeeded") {
      console.log("Payment succeeded!");
      // Handle post-payment actions here (e.g., mark post as sold)
    }
  }
};

// Like Post
async function likePost(postId) {
  console.log(`Liking post with ID: ${postId}`);

  const user = JSON.parse(localStorage.getItem("user"));
  if (!user) {
    alert("You need to log in to like a post.");
    return;
  }

  try {
    const response = await fetch(`${BASE_URL}/like/${postId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user.username }), // Include username
    });

    const data = await response.json();

    if (response.ok) {
      // alert("Post liked!");
      loadFeed(); // Reload feed to show updated like count
    } else {
      alert(data.message);
    }
  } catch (error) {
    console.error("Error liking post:", error);
    alert("An error occurred while liking the post.");
  }
}

// Comment
async function commentPost(postId, comment) {
  // console.log(`Commenting on post with ID: ${postId}`);

  const user = JSON.parse(localStorage.getItem("user"));
  if (!user) {
    alert("You need to log in to comment.");
    return;
  }

  try {
    const response = await fetch(`${BASE_URL}/comment/${postId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user.username, comment }), // Include username
    });

    const data = await response.json();

    if (response.ok) {
      // alert("Comment added!");
      loadFeed(); // Reload feed to show new comments
    } else {
      alert(data.message);
    }
  } catch (error) {
    console.error("Error adding comment:", error);
    alert("An error occurred while adding the comment.");
  }
}
//follow
async function toggleFollow(currentUser, targetUser) {
  try {
    const response = await fetch(`${BASE_URL}/follow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentUser, targetUser }),
    });

    const result = await response.json();
    if (result.success) {
      const followBtn = document.getElementById(`follow-btn-${targetUser}`);
      followBtn.textContent = result.isFollowing ? "Unfollow" : "Follow";

      // Update localStorage safely
      const user = JSON.parse(localStorage.getItem("user")) || {};
      if (!user.following) user.following = []; // Initialize if undefined

      if (result.isFollowing) {
        if (!user.following.includes(targetUser)) {
          user.following.push(targetUser);
        }
      } else {
        user.following = user.following.filter((u) => u !== targetUser);
      }
      localStorage.setItem("user", JSON.stringify(user));
      loadFeed();
    } else {
      alert(result.message);
    }
  } catch (error) {
    console.error("Error toggling follow status:", error);
  }
}
//popup
// Open the popup
function openPostPopup() {
  document.getElementById("post-popup").style.display = "flex";
}

// Close the popup
function closePopup() {
  document.getElementById("post-popup").style.display = "none";
}

// Handle Post button click inside the popup
// document
//   .getElementById("popup-post-btn")
//   .addEventListener("click", function () {
//     const description = document.getElementById("popup-description").value;
//     const fileInput = document.getElementById("popup-media-upload");
//     const file = fileInput.files[0];

//     if (description || file) {
//       // Handle post logic here (e.g., save to feed or database)
//       alert("Post created successfully!");
//       closePopup();
//     } else {
//       alert("Please add a description or media to your post.");
//     }
//   });

//ai search
async function renderPosts(postIndices = []) {
  const response = await fetch(`${BASE_URL}/feed`);
  const posts = await response.json();
  const feed = document.getElementById("feed"); // Ensure there's an element with id="feed" in the HTML

  if (!feed) {
    console.error("Feed container not found.");
    return;
  }
  const user = JSON.parse(localStorage.getItem("user")); // Current logged-in user
  if (!user) {
    alert("Please log in to interact with posts.");
    return;
  }
  feed.innerHTML = "";
  if (postIndices.length === 0) {
    feed.innerHTML = "<p>No posts to display.</p>"; // Display a message if no indices are provided
    return;
  }

  // Render posts based on provided indices
  postIndices.forEach((index) => {
    const post = posts[index]; // Access the post using the index

    if (!post) {
      console.error(`Post not found for index ${index}`);
      return;
    }

    const postDiv = document.createElement("div");
    postDiv.className = "post";

    // Check if the current user has liked the post
    const isLiked = post.likedBy.includes(user.username);
    const likeButtonClass = isLiked ? "liked" : "unliked";
    const likeButtonText = isLiked ? "Unlike" : "Like";

    const isFollowing = user.following?.includes(post.username) || false;
    const followButtonText = isFollowing ? "Unfollow" : "Follow";

    // Create the post content dynamically
    postDiv.innerHTML = `
    <div class="post-header">
      <img src="${BASE_URL}/${post.profilePic}" alt="User Pic" class="post-pic">
      <div class="post-user">
        <h4><i class="fas fa-user"></i> ${post.username}</h4>
      </div>
      <button id="follow-btn-${post.username}" 
              onclick="toggleFollow('${user.username}', '${post.username}')">
        ${followButtonText}
      </button>
    </div>
    <div class="post-content">
      <p>${post.description}</p>
      ${
        post.media
          ? post.mediaType === "video"
            ? `<video controls width="100%"><source src="${BASE_URL}/${post.media}" type="video/mp4"></video>`
            : `<img src="${BASE_URL}/${post.media}" alt="Post Image" class="post-img">`
          : ""
      }
    </div>
    <div class="post-actions">
      <button id="like-btn-${post.id}" 
              class="${likeButtonClass}" 
              onclick="likePost('${post.id}')">
        <i class="fas fa-thumbs-up"></i> ${likeButtonText} (${post.likes})
      </button>
      <button><i class="fas fa-comment-alt"></i> Comment</button>
      <button><i class="fas fa-share"></i> Share</button>
      ${
        post.forSale
          ? `<button id="buy-btn-${post.id}" onclick="redirectToPayment(${post.price}, '${post.id}')">
               <i class="fas fa-shopping-cart"></i> Buy for $${post.price}
             </button>`
          : ""
      }
    </div>
    <div class="post-comments">
      ${post.comments
        .map(
          (comment) =>
            `<p><strong>${comment.username}:</strong> ${comment.comment}</p>`
        )
        .join("")}
      <input type="text" placeholder="Add a comment" id="comment-input-${
        post.id
      }">
      <button onclick="commentPost('${
        post.id
      }', document.getElementById('comment-input-${post.id}').value)">
        Submit
      </button>
    </div>
  `;

    // Append the post to the feed
    feed.appendChild(postDiv);
  });
}

// Initial render of all posts
// renderPosts();

// Example: Handle search and render specific posts
async function handleSearch() {
  const searchQuery = document.getElementById("search-input").value;
  se.disabled = true;
  se.innerText = "Analyzing...";
  try {
    const response = await fetch("http://localhost:3000/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: searchQuery }),
    });

    if (!response.ok) {
      console.log("Failed to");
      throw new Error("Failed to fetch search results");
    }

    const v = await response.json();
    se.disabled = false;
    se.innerText = "AI Search";
    renderPosts(v); // Render the filtered posts
  } catch (error) {
    se.disabled = false;
    se.innerText = "AI Search";
    console.error("Search error:", error.message);
    alert("Failed to fetch search results. Please try again.");
  }
}
//toggle sell
document.getElementById("sell-toggle").addEventListener("change", (event) => {
  const priceContainer = document.getElementById("selling-price-container");
  priceContainer.style.display = event.target.checked ? "block" : "none";
});

// Add event listener to a search input (example)
document.getElementById("search-btn").addEventListener("click", handleSearch);

function redirectToProfile() {
  const user = localStorage.getItem("user");
  if (user == null) {
    alert("please login first");
  } else {
    window.location.href = "/profile";
  }
}

// //edit post
// function editPost(postId) {
//   const newDescription = prompt("Edit your post description");
//   const newMedia = prompt("Edit media URL (image/video)");

//   fetch(`/api/posts/${postId}`, {
//     method: "PUT",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({ description: newDescription, media: newMedia }),
//   })
//     .then((response) => response.json())
//     .then((updatedPost) => {
//       alert("Post updated successfully!");
//       loadUserPosts(); // Reload posts
//     })
//     .catch((error) => console.error("Error updating post:", error));
// }
// //delete post
// function deletePost(postId) {
//   const confirmed = confirm("Are you sure you want to delete this post?");
//   if (confirmed) {
//     fetch(`/api/posts/${postId}`, { method: "DELETE" })
//       .then((response) => {
//         if (response.ok) {
//           alert("Post deleted successfully!");
//           loadUserPosts(); // Reload posts
//         } else {
//           alert("Error deleting post");
//         }
//       })
//       .catch((error) => console.error("Error deleting post:", error));
//   }
// }
// //switch back too feed
// const backToFeedButton = document.createElement("button");
// backToFeedButton.textContent = "Back to Feed";
// backToFeedButton.addEventListener("click", () => {
//   document.getElementById("profile-section").style.display = "none";
//   document.getElementById("post-section").style.display = "block";
//   document.getElementById("feed").style.display = "block";
// });
// document.getElementById("profile-section").appendChild(backToFeedButton);
