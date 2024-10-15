import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";

import {
  getDatabase,
  ref,
  set,
  get,
  remove,
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAy4Hhw1mNo3QXKbEkvN_FpdZ44IMriQO8",
  authDomain: "food-log-95e73.firebaseapp.com",
  projectId: "food-log-95e73",
  storageBucket: "food-log-95e73.appspot.com",
  messagingSenderId: "90089979354",
  appId: "1:90089979354:web:03033e24819b3e612c54e3",
};

// Initialize Firebase and services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Set session persistence
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Error setting persistence:", error);
});

// Global state for food log and totals
let totalCalories = 0;
let totalProtein = 0;
let currentDayLog = [];

// Initialize event listeners
window.addEventListener("load", () => {
  console.log("Page loaded, checking auth state...");
  // Show spinner when page loads and auth state is being checked
  document.getElementById("loading-spinner").style.display = "flex";
  document.getElementById("login-trigger").style.display = "none";
  onAuthStateChanged(auth, (user) => {
    // Hide spinner after auth check is done
    document.getElementById("loading-spinner").style.display = "none";
    if (user) {
      // User is signed in
      console.log("User is authenticated. Loading today's log...");
      document.querySelector(".container").style.display = "block";
      loadLogForToday();
    } else {
      console.log("No authenticated user. Showing login section...");
      document.querySelector(".container").style.display = "none";
      document.getElementById("login-trigger").style.display = "block";
    }
  });
});

// Dropdown custom select functionality
document.querySelectorAll(".custom-select-wrapper").forEach((wrapper) => {
  const trigger = wrapper.querySelector(".custom-select-trigger");
  const options = wrapper.querySelector(".custom-options");
  const unitDisplay = document.getElementById("food-weight-label");

  trigger.addEventListener("click", () => {
    wrapper.querySelector(".custom-select").classList.toggle("open");
  });

  options.addEventListener("click", (event) => {
    if (event.target.classList.contains("custom-option")) {
      const selectedOption = event.target;
      trigger.textContent = selectedOption.textContent;
      updateTriggerAttributes(trigger, selectedOption);
      unitDisplay.textContent = `Amount: (${selectedOption.getAttribute(
        "data-unit"
      )})`;
      wrapper.querySelector(".custom-select").classList.remove("open");
    }
  });
});

// Update trigger attributes for food selection
function updateTriggerAttributes(trigger, selectedOption) {
  trigger.setAttribute(
    "data-calories",
    selectedOption.getAttribute("data-calories")
  );
  trigger.setAttribute(
    "data-protein",
    selectedOption.getAttribute("data-protein")
  );
  trigger.setAttribute("data-unit", selectedOption.getAttribute("data-unit"));
  trigger.setAttribute("data-value", selectedOption.getAttribute("data-value"));
}

// Add food to log
document.getElementById("add-food").addEventListener("click", async () => {
  const foodWeight = parseFloat(document.getElementById("food-weight").value);
  if (isNaN(foodWeight) || foodWeight <= 0) {
    alert("Please enter a valid amount.");
    return;
  }

  const foodSelect = document.querySelector(".custom-select-trigger");
  const foodData = {
    name: foodSelect.getAttribute("data-value"),
    caloriesPerUnit: parseFloat(foodSelect.getAttribute("data-calories")),
    proteinPerUnit: parseFloat(foodSelect.getAttribute("data-protein")),
    unit: foodSelect.getAttribute("data-unit"),
  };

  const calories = foodData.caloriesPerUnit * foodWeight;
  const protein = foodData.proteinPerUnit * foodWeight;

  const foodLogEntry = {
    foodName: foodData.name,
    amount: `${foodWeight} ${foodData.unit}`,
    calories: calories.toFixed(2),
    protein: protein.toFixed(2),
  };

  try {
    await addFoodToLogAndSave(foodLogEntry);
    updateTotals();
    resetFoodSelection();
  } catch (error) {
    console.error("Error adding food to log:", error);
    alert("Failed to add food to log. Please try again.");
  }
});

// Update totals display
function updateTotals() {
  document.getElementById("total-calories").textContent =
    totalCalories.toFixed(2);
  document.getElementById("total-protein").textContent =
    totalProtein.toFixed(2);
}

// Add food to log and save to Firebase
async function addFoodToLogAndSave(foodLogEntry) {
  const userId = auth.currentUser.uid;
  const selectedDate =
    document.getElementById("log-date").value || getLocalDate();

  // Add to current day log
  currentDayLog.push(foodLogEntry);

  // Update totals
  totalCalories += parseFloat(foodLogEntry.calories);
  totalProtein += parseFloat(foodLogEntry.protein);

  // Prepare log data
  const logData = {
    log: currentDayLog,
    totals: { totalCalories, totalProtein },
  };

  try {
    // Save to Firebase
    await set(ref(db, `foodLogs/${userId}/${selectedDate}`), logData);
    console.log("Food added to log successfully.");
    // If save is successful, update the UI
    addFoodToLogUI(foodLogEntry);
    updateTotals(); // Update totals display after adding food
    updateCalorieDeficit(); // Update deficit if applicable
  } catch (error) {
    console.error("Error saving food log:", error);
    alert("Failed to save food log. Please try again.");
  }
}

// Add food to table UI
function addFoodToLogUI({ foodName, amount, calories, protein }) {
  const logBody = document.getElementById("log-body");
  const row = document.createElement("tr");

  row.innerHTML = `
    <td>${foodName}</td>
    <td>${amount}</td>
    <td>${calories} kcal</td>
    <td>${protein}g</td>
    <td><button class="remove-food"></button></td>
  `;

  logBody.appendChild(row);
  row.querySelector(".remove-food").addEventListener("click", () => {
    removeFoodFromLog(
      foodName,
      amount,
      parseFloat(calories),
      parseFloat(protein),
      row
    );
  });
}

// Reset food selection
function resetFoodSelection() {
  const foodSelect = document.querySelector(".custom-select-trigger");
  foodSelect.textContent = "Select Food";
  foodSelect.removeAttribute("data-calories");
  foodSelect.removeAttribute("data-protein");
  foodSelect.removeAttribute("data-unit");
  foodSelect.removeAttribute("data-value");

  document.getElementById("food-weight").value = "";
  const unitDisplay = document.getElementById("food-weight-label");
  unitDisplay.textContent = "Amount:";
}

// Remove food from log
async function removeFoodFromLog(foodName, amount, calories, protein, row) {
  const userId = auth.currentUser.uid;
  const selectedDate =
    document.getElementById("log-date").value || getLocalDate();

  try {
    // Remove from current day log
    currentDayLog = currentDayLog.filter(
      (entry) => !(entry.foodName === foodName && entry.amount === amount)
    );

    // Update totals
    totalCalories -= calories;
    totalProtein -= protein;

    // Prepare updated log data
    const logData = {
      log: currentDayLog,
      totals: { totalCalories, totalProtein },
    };

    // Save updated log to Firebase
    if (currentDayLog.length === 0) {
      await remove(ref(db, `foodLogs/${userId}/${selectedDate}`));
    } else {
      await set(ref(db, `foodLogs/${userId}/${selectedDate}`), logData);
    }

    // If save is successful, update the UI
    row.remove();
    updateTotals(); // Update totals display after removing food
    updateCalorieDeficit(); // Update deficit if applicable
  } catch (error) {
    console.error("Error removing food from log:", error);
    alert("Failed to remove food from log. Please try again.");
  }
}

// Load log for today
function loadLogForToday() {
  const today = getLocalDate();
  console.log("loading log for: " + today);
  loadLogForDate(today);
}

// Load log for a selected date
function loadLogForDate(date) {
  console.log("loading log for: " + date);
  const logBody = document.getElementById("log-body");
  logBody.innerHTML = "";
  totalCalories = 0;
  totalProtein = 0;
  currentDayLog = [];

  const userId = auth.currentUser.uid;
  document.getElementById("resting-calories").value = "2328";
  document.getElementById("active-calories").value = "0";
  loadCalorieDeficitForDate(userId, date);

  get(ref(db, `foodLogs/${userId}/${date}`))
    .then((snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        totalCalories = data.totals.totalCalories;
        totalProtein = data.totals.totalProtein;
        updateTotals(); // Update totals display after loading log

        data.log.forEach((entry) => {
          addFoodToLogUI(entry);
          currentDayLog.push(entry);
        });
      } else {
        totalCalories = 0;
        totalProtein = 0;
        updateTotals(); // Update totals display even if log is empty
      }
      updateCalorieDeficit(); // Update deficit after loading log
    })
    .catch(function (error) {
      console.error("Error loading log for date:", error);
      alert("Failed to load log. Pleae try again.");
    })
    .finally(() => {
      // Hide the loading spinner after data is loaded (or if there's an error)
      document.getElementById("loading-spinner").style.display = "none";
    });
}

// Modal functionality
const modal = document.getElementById("login-modal");
const loginTrigger = document.getElementById("login-trigger");
const closeBtn = document.querySelector(".close-btn");

loginTrigger.addEventListener("click", () => {
  modal.style.display = "flex";
});

closeBtn.addEventListener("click", () => {
  modal.style.display = "none";
});

window.addEventListener("click", (event) => {
  if (event.target === modal) modal.style.display = "none";
});

// Login and logout functionality
document.getElementById("login-btn").addEventListener("click", () => {
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      console.log("User logged in:", userCredential.user);
      modal.style.display = "none";
      document.getElementById("login-trigger").style.display = "none";
      document.getElementById("logout-btn").style.display = "block";
      loadLogForToday();
    })
    .catch(function (error) {
      console.error("Error logging in:", error);
      alert("Error logging in. Please try again.");
    });
});

document.getElementById("logout-btn").addEventListener("click", () => {
  signOut(auth)
    .then(() => {
      console.log("User logged out");
      document.getElementById("logout-btn").style.display = "none";
      document.getElementById("login-trigger").style.display = "block";
    })
    .catch(function (error) {
      console.error("Error logging out:", error);
      alert("Error logging out. Please try again.");
    });
});

// Calorie deficit handling
const burnCaloriesModal = document.getElementById("burn-calories-modal");
const burnCaloriesBtn = document.getElementById("burn-calories-btn");
const closeBurnModalBtn = burnCaloriesModal.querySelector(".close-btn");
const calculateDeficitBtn = document.getElementById("calculate-deficit-btn");

burnCaloriesBtn.addEventListener("click", () => {
  burnCaloriesModal.style.display = "flex";
});

closeBurnModalBtn.addEventListener("click", () => {
  burnCaloriesModal.style.display = "none";
});

window.addEventListener("click", (event) => {
  if (event.target === burnCaloriesModal) {
    burnCaloriesModal.style.display = "none";
  }
});

calculateDeficitBtn.addEventListener("click", async () => {
  const restingCalories =
    parseFloat(document.getElementById("resting-calories").value) || 0;
  const activeCalories =
    parseFloat(document.getElementById("active-calories").value) || 0;
  const totalBurnedCalories = restingCalories + activeCalories;
  const calorieDeficit = totalCalories - totalBurnedCalories;

  // Save to Firebase first
  try {
    await saveCalorieDeficitToFirebase(
      restingCalories,
      activeCalories,
      calorieDeficit
    );

    // Then update the UI
    const existingDeficit = document.getElementById("calorie-deficit");
    if (existingDeficit) {
      existingDeficit.textContent = Math.ceil(calorieDeficit);
    } else {
      const deficitParagraph = document.createElement("p");
      deficitParagraph.innerHTML = `<span id="calorie-deficit">${Math.ceil(
        calorieDeficit
      )}</span> kcal`;
      document.querySelector(".total-deficit").appendChild(deficitParagraph);
    }

    burnCaloriesModal.style.display = "none";
  } catch (error) {
    console.error("Error saving calorie deficit:", error);
    alert("Failed to save calorie deficit. Please try again.");
  }
});

document
  .getElementById("resting-calories")
  .addEventListener("change", updateCalorieDeficit);
document
  .getElementById("active-calories")
  .addEventListener("change", updateCalorieDeficit);

// Get today's date in YYYY-MM-DD format
function getLocalDate() {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  const localDate = new Date(today.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 10);
}

// Update calorie deficit based on the total burned and consumed calories
async function updateCalorieDeficit() {
  const restingCalories =
    parseFloat(document.getElementById("resting-calories").value) || 0;
  const activeCalories =
    parseFloat(document.getElementById("active-calories").value) || 0;
  const totalBurnedCalories = restingCalories + activeCalories;
  const calorieDeficit = totalCalories - totalBurnedCalories;

  try {
    // Save to Firebase first
    await saveCalorieDeficitToFirebase(
      restingCalories,
      activeCalories,
      calorieDeficit
    );

    // Then update the UI
    const existingDeficit = document.getElementById("calorie-deficit");
    if (existingDeficit) {
      existingDeficit.textContent = Math.ceil(calorieDeficit);
    } else {
      const deficitParagraph = document.createElement("p");
      deficitParagraph.innerHTML = `<span id="calorie-deficit">${Math.ceil(
        calorieDeficit
      )}</span> kcal`;
      document.querySelector(".total-deficit").appendChild(deficitParagraph);
    }
  } catch (error) {
    console.error("Error updating calorie deficit:", error);
    alert("Failed to update calorie deficit. Please try again.");
  }
}

// Save calorie deficit to Firebase
function saveCalorieDeficitToFirebase(
  restingCalories,
  activeCalories,
  calorieDeficit
) {
  const selectedDate =
    document.getElementById("log-date").value || getLocalDate();
  const userId = auth.currentUser.uid;
  const deficitData = {
    restingCalories,
    activeCalories,
    calorieDeficit,
  };

  set(ref(db, `deficits/${userId}/${selectedDate}`), deficitData)
    .then(() => console.log("Calorie deficit saved successfully!"))
    .catch(function (error) {
      console.error("Error saving calorie deficit:", error);
      alert("Error saving calorie deficit. Please try again.");
    });
}

// Load calorie deficit data for a selected date
function loadCalorieDeficitForDate(userId, date) {
  get(ref(db, `deficits/${userId}/${date}`))
    .then((snapshot) => {
      const existingDeficit = document.getElementById("calorie-deficit");
      if (snapshot.exists()) {
        const data = snapshot.val();
        document.getElementById("resting-calories").value =
          data.restingCalories || "2328";
        document.getElementById("active-calories").value =
          data.activeCalories || "0";

        if (existingDeficit) {
          existingDeficit.textContent = Math.ceil(data.calorieDeficit);
        } else {
          const deficitParagraph = document.createElement("p");
          deficitParagraph.innerHTML = `<span id="calorie-deficit">${Math.ceil(
            data.calorieDeficit
          )}</span> kcal`;
          document
            .querySelector(".total-deficit")
            .appendChild(deficitParagraph);
        }
      } else {
        resetCalorieDeficit();
      }
    })
    .catch(function (error) {
      console.error("Error loading calorie deficit:", error);
      alert("Error loading calorie deficit. Please try again.");
    });
}

// Reset calorie deficit
function resetCalorieDeficit() {
  document.getElementById("resting-calories").value = "2328";
  document.getElementById("active-calories").value = "0";

  const existingDeficit = document.getElementById("calorie-deficit");
  if (existingDeficit) {
    existingDeficit.parentNode.remove();
  }
}

// Event listener for changing the log date
document.getElementById("log-date").addEventListener("change", function () {
  const selectedDate = this.value;
  const today = new Date().toISOString().slice(0, 10);
  const logTitle = document.querySelector(".summary-section h2");

  // Show the loading spinner
  document.getElementById("loading-spinner").style.display = "flex";

  if (selectedDate === today) {
    logTitle.textContent = "Today's Log";
    document.getElementById("log-body").innerHTML = "";
    loadLogForToday();
  } else {
    const [year, month, day] = selectedDate.split("-");
    const formattedDate = `${parseInt(month)}/${parseInt(day)}/${year}`;
    logTitle.textContent = formattedDate;
    loadLogForDate(selectedDate);
  }
});
