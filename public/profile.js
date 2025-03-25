const BASE_URL = "http://localhost:3000";
const logoutButton = document.getElementById("logout-btn");
const pro = document.getElementById("profile-pic");
// Load user profile details on page load
const user = JSON.parse(localStorage.getItem("user"));
pro.src = user.profilePic;
function redirectToProfile() {
  window.location.href = "profile.html";
}
window.onload = () => {
  const user = JSON.parse(localStorage.getItem("user"));
  loadFeed();
  if (!user) {
    alert("Please log in first.");
    window.location.href = "index.html";
    return;
  }
  logoutButton.addEventListener("click", () => {
    localStorage.removeItem("user");
    alert("Logged out successfully");
    logoutButton.style.display = "none";
    goBackToHome();
  });
};
// Fetch and display user details
fetch(`${BASE_URL}/user/${user.username}`)
  .then((response) => response.json())
  .then((data) => {
    // Update profile info
    document.getElementById("profile-name").textContent = data.name;
    document.getElementById(
      "profile-username"
    ).textContent = `@${data.username}`;
    document.getElementById("profile-email").textContent = data.email;
  })
  .catch((error) => console.error("Error fetching user details:", error));

// Fetch and display user posts
async function loadFeed() {
  fetch(`${BASE_URL}/posts?username=${user.username}`)
    .then((response) => response.json())
    .then((posts) => {
      const postsContainer = document.getElementById("profile-posts");
      postsContainer.innerHTML = ""; // Clear previous posts

      posts.forEach((post) => {
        const postDiv = document.createElement("div");
        postDiv.className = "post";

        // Check if the current user has liked the post
        const isLiked = post.likedBy.includes(user.username);
        const likeButtonClass = isLiked ? "liked" : "unliked";
        const likeButtonText = isLiked ? "Unlike" : "Like";

        // Check if the current user follows the post's author

        // Create the post content dynamically
        postDiv.innerHTML = `
    <div class="post-header">
      <img src="${BASE_URL}/${post.profilePic}" alt="User Pic" class="post-pic">
      <div class="post-user">
        <h4><i class="fas fa-user"></i> ${post.username}</h4>
      </div>
      </button>
           <button class="delete-btn" data-post-id="${
             post.id
           }">Delete Post</button>
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

        postsContainer.appendChild(postDiv);
      });

      // Update profile stats
      document.querySelectorAll(".delete-btn").forEach((btn) => {
        btn.addEventListener("click", deletePost);
      });
      document.getElementById("total-posts").textContent = posts.length;
      const totalLikes = posts.reduce((sum, post) => sum + post.likes, 0);
      document.getElementById("total-likes").textContent = totalLikes;
      const totalComments = posts.reduce(
        (sum, post) => sum + post.comments.length,
        0
      );
      document.getElementById("total-comments").textContent = totalComments;
    })
    .catch((error) => console.error("Error fetching user posts:", error));
}

async function likePost(postId) {
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user) {
    alert("You need to log in to like a post.");
    return;
  }

  const response = await fetch(`${BASE_URL}/like/${postId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: user.username }), // Include username
  });

  const data = await response.json();

  if (data.success) {
    loadFeed();
    // alert("Post liked!");
    // Reload feed to show updated like count
  } else {
    alert(data.message);
  }
}
// Function to toggle comment input visibility
function toggleCommentInput(postId) {
  const commentSection = document.getElementById(`comment-section-${postId}`);
  if (commentSection) {
    commentSection.style.display = 
      commentSection.style.display === "none" ? "block" : "none";
  }
}

// Function to add comment
async function commentPost(postId) {
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user) {
    alert("You need to log in to comment.");
    return;
  }

  const commentInput = document.getElementById(`comment-input-${postId}`);
  const comment = commentInput.value.trim();
  if (!comment) {
    alert("Comment cannot be empty!");
    return;
  }

  const response = await fetch(`${BASE_URL}/comment/${postId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: user.username, comment }), 
  });

  const data = await response.json();
  if (data.success) {
    commentInput.value = ""; // Clear input after successful comment
    loadFeed(); // Reload feed to show new comments
  } else {
    alert(data.message);
  }
}
// // Comment
// async function commentPost(postId, comment) {
//   const user = JSON.parse(localStorage.getItem("user"));
//   if (!user) {
//     alert("You need to log in to comment.");
//     return;
//   }

//   const response = await fetch(`${BASE_URL}/comment/${postId}`, {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({ username: user.username, comment }), // Include username
//   });

//   const data = await response.json();
//   if (data.success) {
//     // alert("Comment added!");
//     loadFeed(); // Reload feed to show new comments
//   } else {
//     alert(data.message);
//   }
// }

//delete post
function deletePost(event) {
  const postId = event.target.dataset.postId;
  const user = JSON.parse(localStorage.getItem("user"));

  // Send request to delete the post
  fetch(`${BASE_URL}/api/posts/${postId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username: user.username }),
  })
    .then((response) => {
      if (response.ok) {
        alert("Post deleted successfully");
        // Remove the post from the UI
        event.target.closest(".post").remove();
        updatePostStats();
      } else {
        alert("Failed to delete post");
      }
    })
    .catch((error) => {
      console.error("Error deleting post:", error);
      // alert("Error deleting post");
    });
}

// Function to update post stats after deletion
function updatePostStats() {
  const postsContainer = document.getElementById("profile-posts");
  const posts = postsContainer.getElementsByClassName("post");
  document.getElementById("total-posts").textContent = posts.length;
  let totalLikes = 0;
  let totalComments = 0;
  for (let post of posts) {
    totalLikes += parseInt(
      post.querySelector("p:nth-child(3)").textContent.split(":")[1].trim()
    );
    totalComments += parseInt(
      post.querySelector("p:nth-child(4)").textContent.split(":")[1].trim()
    );
  }
  document.getElementById("total-likes").textContent = totalLikes;
  document.getElementById("total-comments").textContent = totalComments;
}
// Navigate back to home
function goBackToHome() {
  window.location.href = "index.html";
}
