/******************************************************
 *   PiSpace Shooter - Final app.js (Firebase v9 Modular)
 *   This code uses placeholders for Pi Wallet authentication,
 *   which must be replaced with real Pi Network SDK methods.
 ******************************************************/

// ------------------------------------
// 1. Import necessary Firebase v9 modules
// ------------------------------------
import { 
  initializeApp 
} from "firebase/app";
import { 
  getAnalytics 
} from "firebase/analytics";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signOut
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs
} from "firebase/firestore";

// If you're using SweetAlert2 as an ES module:
import Swal from "sweetalert2";

// ------------------------------------
// 2. Firebase Configuration
//    Replace with your actual config if different
// ------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyAZKtnnm3hc6ViJLSLhV7PK8calqELiL_4",
  authDomain: "magic-image-ai-15a0d.firebaseapp.com",
  databaseURL: "https://magic-image-ai-15a0d-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "magic-image-ai-15a0d",
  storageBucket: "magic-image-ai-15a0d.firebasestorage.app",
  messagingSenderId: "864109068756",
  appId: "1:864109068756:web:2d680b0c0d5b791f32d641",
  measurementId: "G-M6EM5CCVQ2"
};

// ------------------------------------
// 3. Initialize Firebase
// ------------------------------------
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app); // optional
const auth = getAuth(app);
const db = getFirestore(app);

/**
 * Global Game State
 */
let currentUser = null;
let currentScore = 0;
let freeGamesCount = 3; // New users get first 3 games free
let userCoins = 0;
let userPiAddress = "";
let userGamesUsed = 0;

/**
 * Canvas Setup
 */
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
let gameActive = false;
let asteroids = [];
let bullets = [];
let player = {
  x: canvas.width / 2,
  y: canvas.height - 50,
  radius: 20
};

/**
 * Helper: Toggle Overlay
 */
function toggleOverlay(id, show) {
  const overlay = document.getElementById(id);
  overlay.style.display = show ? "flex" : "none";
}

/**
 * Helper: Show Message using SweetAlert2
 */
function showMessage(title, text, icon = "info") {
  Swal.fire({
    icon: icon,
    title: title,
    text: text
  });
}

/**
 * Pi Wallet Login - Placeholder
 * Replace with real Pi Network authentication
 */
export function piWalletLogin() {
  // Simulate Pi Wallet login via Firebase anonymous sign-in
  signInAnonymously(auth)
    .then(() => {
      toggleOverlay("authOverlay", false);
      showMessage("Pi Wallet Login", "Simulated login successful.", "success");
    })
    .catch((error) => {
      showMessage("Error", error.message, "error");
    });
}

/**
 * Save or Update Pi Address
 */
export function savePiAddress() {
  const newPiAddress = document.getElementById("piAddressInput").value;
  if (!currentUser) {
    showMessage("Error", "You must login first", "error");
    return;
  }
  if (newPiAddress.trim() === "") {
    showMessage("Error", "Pi address is required", "error");
    return;
  }
  const userRef = doc(db, "users", currentUser.uid);
  updateDoc(userRef, { piAddress: newPiAddress })
    .then(() => {
      userPiAddress = newPiAddress;
      showMessage("Success", "Pi address updated", "success");
    })
    .catch((err) => {
      showMessage("Error", err.message, "error");
    });
}

/**
 * Firebase Auth State Listener
 */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    const userRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(userRef);

    if (!docSnap.exists()) {
      // Create new user in Firestore
      await setDoc(userRef, {
        username: "user" + Date.now(),
        piAddress: "",
        coins: 0,
        totalScore: 0,
        highScore: 0,
        freeGames: 3,
        gameHistory: []
      });
      showMessage("Welcome!", "New user profile created.", "success");
      userCoins = 0;
      freeGamesCount = 3;
    } else {
      const data = docSnap.data();
      userCoins = data.coins || 0;
      userPiAddress = data.piAddress || "";
      freeGamesCount = data.freeGames || 3;
    }
    toggleOverlay("menuOverlay", true);
  } else {
    toggleOverlay("authOverlay", true);
  }
});

/**
 * Logout
 */
export function logout() {
  signOut(auth)
    .then(() => {
      currentUser = null;
      showMessage("Logged Out", "You have been logged out.", "info");
      toggleOverlay("menuOverlay", false);
      toggleOverlay("authOverlay", true);
    })
    .catch((error) => {
      showMessage("Error", error.message, "error");
    });
}

/**
 * Start the Game
 */
export function startGame() {
  if (freeGamesCount <= 0) {
    showMessage("No Free Games Left", "Purchase more credits or coins to play!", "error");
    return;
  }

  freeGamesCount--;
  const userRef = doc(db, "users", currentUser.uid);
  updateDoc(userRef, { freeGames: freeGamesCount });

  resetGame();
  gameActive = true;
  toggleOverlay("menuOverlay", false);
  gameLoop();
}

/**
 * Reset Game Variables
 */
function resetGame() {
  currentScore = 0;
  player.x = canvas.width / 2;
  player.y = canvas.height - 50;
  asteroids = [];
  bullets = [];
}

/**
 * Main Game Loop
 */
function gameLoop() {
  if (!gameActive) return;

  // Clear the canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw player
  drawPlayer();

  // Update bullets
  updateBullets();

  // Spawn and update asteroids
  spawnAsteroids();
  updateAsteroids();

  // Check collisions
  checkCollisions();

  // Display score
  ctx.fillStyle = "#fff";
  ctx.font = "20px Arial";
  ctx.fillText("Score: " + currentScore, 10, 30);

  requestAnimationFrame(gameLoop);
}

/**
 * Draw Player
 */
function drawPlayer() {
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, 2 * Math.PI);
  ctx.fillStyle = "#00eaff";
  ctx.fill();
  ctx.closePath();
}

/**
 * Handle Key Down - Move & Shoot
 */
document.addEventListener("keydown", (e) => {
  if (!gameActive) return;
  if (e.key === "ArrowLeft" && player.x > player.radius) {
    player.x -= 10;
  } else if (e.key === "ArrowRight" && player.x < canvas.width - player.radius) {
    player.x += 10;
  } else if (e.key === "ArrowUp" || e.key === " ") {
    bullets.push({ x: player.x, y: player.y - player.radius });
  }
});

/**
 * Update Bullets
 */
function updateBullets() {
  for (let i = 0; i < bullets.length; i++) {
    bullets[i].y -= 5;
    ctx.beginPath();
    ctx.arc(bullets[i].x, bullets[i].y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = "#ffae00";
    ctx.fill();
    ctx.closePath();

    if (bullets[i].y < -10) {
      bullets.splice(i, 1);
      i--;
    }
  }
}

/**
 * Spawn Asteroids Periodically
 */
let asteroidSpawnCounter = 0;
function spawnAsteroids() {
  asteroidSpawnCounter++;
  if (asteroidSpawnCounter > 50) {
    const radius = Math.random() * 20 + 10;
    asteroids.push({
      x: Math.random() * (canvas.width - radius * 2) + radius,
      y: -radius,
      radius: radius,
      speed: Math.random() * 2 + 1
    });
    asteroidSpawnCounter = 0;
  }
}

/**
 * Update Asteroids
 */
function updateAsteroids() {
  for (let i = 0; i < asteroids.length; i++) {
    asteroids[i].y += asteroids[i].speed;
    ctx.beginPath();
    ctx.arc(asteroids[i].x, asteroids[i].y, asteroids[i].radius, 0, 2 * Math.PI);
    ctx.fillStyle = "#ff2d2d";
    ctx.fill();
    ctx.closePath();

    if (asteroids[i].y > canvas.height + asteroids[i].radius) {
      asteroids.splice(i, 1);
      i--;
      continue;
    }
  }
}

/**
 * Check Collisions
 */
function checkCollisions() {
  // Bullets vs Asteroids
  for (let i = 0; i < asteroids.length; i++) {
    for (let j = 0; j < bullets.length; j++) {
      const dx = asteroids[i].x - bullets[j].x;
      const dy = asteroids[i].y - bullets[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < asteroids[i].radius + 5) {
        currentScore += 10;
        asteroids.splice(i, 1);
        bullets.splice(j, 1);
        i--;
        break;
      }
    }
  }

  // Player vs Asteroid
  for (let i = 0; i < asteroids.length; i++) {
    const dx = asteroids[i].x - player.x;
    const dy = asteroids[i].y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < asteroids[i].radius + player.radius) {
      // Game over
      gameActive = false;
      endGame();
      return;
    }
  }
}

/**
 * End Game
 */
function endGame() {
  showMessage("Game Over", `Your final score: ${currentScore}`, "info");
  if (currentUser) {
    const userRef = doc(db, "users", currentUser.uid);
    getDoc(userRef).then((docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Update high score if needed
        if (currentScore > (data.highScore || 0)) {
          updateDoc(userRef, { highScore: currentScore });
        }
        // Add to total score
        updateDoc(userRef, {
          totalScore: (data.totalScore || 0) + currentScore
        });
      }
    });
  }
  toggleOverlay("menuOverlay", true);
}

/**
 * Load Leaderboard (Top 10)
 */
async function loadLeaderboard() {
  const tableBody = document.querySelector("#leaderboardTable tbody");
  tableBody.innerHTML = "";

  const q = query(
    collection(db, "users"),
    orderBy("highScore", "desc"),
    limit(10)
  );
  try {
    const snapshot = await getDocs(q);
    let rank = 1;
    snapshot.forEach((docItem) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${rank}</td>
        <td>${docItem.data().username}</td>
        <td>${docItem.data().highScore || 0}</td>
      `;
      tableBody.appendChild(tr);
      rank++;
    });
    toggleOverlay("leaderboardOverlay", true);
  } catch (err) {
    showMessage("Error", err.message, "error");
  }
}

/**
 * Link to Leaderboard Overlay
 */
document.getElementById("leaderboardOverlay").addEventListener("click", (e) => {
  if (e.target.id === "leaderboardOverlay") {
    toggleOverlay("leaderboardOverlay", false);
  }
});

export function loadLeaderboardOverlay() {
  loadLeaderboard();
}

/**
 * Buy Coins
 * 1 Pi = 10 coins
 */
export function buyCoins() {
  const selection = document.getElementById("topUpSelect").value;
  let piAmount = 0;
  if (selection === "custom") {
    piAmount = Number(document.getElementById("customPiAmount").value) || 0;
  } else {
    piAmount = Number(selection);
  }
  if (piAmount <= 0) {
    showMessage("Error", "Invalid Pi amount", "error");
    return;
  }
  // Placeholder: Replace with Pi payment flow
  const coinsToCredit = piAmount * 10;
  userCoins += coinsToCredit;
  saveCoinBalance();
  showMessage("Purchase Successful", `You received ${coinsToCredit} coins!`, "success");
}

/**
 * Update custom top-up display
 */
document.getElementById("topUpSelect").addEventListener("change", (e) => {
  if (e.target.value === "custom") {
    document.getElementById("customPiAmount").style.display = "block";
  } else {
    document.getElementById("customPiAmount").style.display = "none";
  }
});

/**
 * Save Coin Balance
 */
function saveCoinBalance() {
  if (!currentUser) return;
  const userRef = doc(db, "users", currentUser.uid);
  updateDoc(userRef, { coins: userCoins });
}

/**
 * Withdraw Coin Request
 */
export function withdrawCoinRequest() {
  const amount = Number(document.getElementById("withdrawCoins").value);
  if (amount < 100) {
    showMessage("Minimum withdrawal is 100 coins", "Enter a valid amount", "error");
    return;
  }
  if (amount > userCoins) {
    showMessage("Insufficient Coins", "You don’t have enough coins", "error");
    return;
  }
  // Placeholder: Implement actual Pi transfer to user's Pi address
  userCoins -= amount;
  saveCoinBalance();
  showMessage("Withdrawal Requested", `Successfully withdrew ${amount} coins.`, "success");
}

/**
 * Create 2-Player Match
 * fee: 10 → 15 coins, 20 → 33 coins, 100 → 180 coins
 */
export function createP2PMatch(fee) {
  if (userCoins < fee) {
    showMessage("Not Enough Coins", `You need at least ${fee} coins to join.`, "error");
    return;
  }
  userCoins -= fee;
  saveCoinBalance();

  // Create match doc in Firestore
  const matchRef = collection(db, "matches");
  const newMatch = {
    players: [currentUser.uid],
    fee: fee,
    status: "pending",
    results: {}
  };
  addDoc(matchRef, newMatch)
    .then(() => {
      showMessage(
        "Match Created",
        "2-player match created. Another user will join indirectly!",
        "success"
      );
    });
}

/**
 * Create 4-Player Match
 * fee: 10 → 30 coins, 100 → 350 coins
 */
export function create4PlayerMatch(fee) {
  if (userCoins < fee) {
    showMessage("Not Enough Coins", `You need at least ${fee} coins to join.`, "error");
    return;
  }
  userCoins -= fee;
  saveCoinBalance();

  const matchRef = collection(db, "matches");
  const newMatch = {
    players: [currentUser.uid],
    fee: fee,
    status: "pending",
    results: {}
  };
  addDoc(matchRef, newMatch)
    .then(() => {
      showMessage(
        "Match Created",
        "4-player match created. More players will join indirectly!",
        "success"
      );
    });
}
