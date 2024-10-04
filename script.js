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
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";

import { remove } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js"; // Import the remove method

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

// Set persistence so the session is maintained across refreshes
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Error setting persistence:", error);
});

// Variables to track total calories and protein
let totalCalories = 0;
let totalProtein = 0;
let currentDayLog = [];

// Event listener to load the log for today when the page loads
// window.addEventListener("load", loadLogForToday);

// Dropdown functionality for custom select element
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
      trigger.setAttribute(
        "data-calories",
        selectedOption.getAttribute("data-calories")
      );
      trigger.setAttribute(
        "data-protein",
        selectedOption.getAttribute("data-protein")
      );
      trigger.setAttribute(
        "data-unit",
        selectedOption.getAttribute("data-unit")
      );
      trigger.setAttribute(
        "data-value",
        selectedOption.getAttribute("data-value")
      );
      unitDisplay.textContent = `Amount: (${selectedOption.getAttribute(
        "data-unit"
      )})`;
      wrapper.querySelector(".custom-select").classList.remove("open");
    }
  });
});

// Adding food to the log
document.getElementById("add-food").addEventListener("click", () => {
  const foodSelect = document.querySelector(".custom-select-trigger");
  const foodWeight = parseFloat(document.getElementById("food-weight").value);

  if (isNaN(foodWeight) || foodWeight <= 0) {
    alert("Please enter a valid amount.");
    return;
  }

  const foodName = foodSelect.getAttribute("data-value");
  const caloriesPerUnit = parseFloat(foodSelect.getAttribute("data-calories"));
  const proteinPerUnit = parseFloat(foodSelect.getAttribute("data-protein"));
  const unitType = foodSelect.getAttribute("data-unit");

  const calories = caloriesPerUnit * foodWeight;
  const protein = proteinPerUnit * foodWeight;

  totalCalories += calories;
  totalProtein += protein;

  const foodLogEntry = {
    foodName,
    amount: `${foodWeight} ${unitType}`,
    calories: calories.toFixed(2),
    protein: protein.toFixed(2),
  };

  currentDayLog.push(foodLogEntry);
  addFoodToLog(
    foodLogEntry.foodName,
    foodLogEntry.amount,
    foodLogEntry.calories,
    foodLogEntry.protein
  );
  updateTotals();
  saveLogForSelectedDate();
});

// Add food entry to the log
function addFoodToLog(foodName, amount, calories, protein) {
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

  const removeButton = row.querySelector(".remove-food");
  removeButton.addEventListener("click", () => {
    removeFoodFromLog(
      foodName,
      amount,
      parseFloat(calories),
      parseFloat(protein),
      row
    );
  });

  document.getElementById("food-weight").value = "";
}

// Remove food from the log
function removeFoodFromLog(foodName, amount, calories, protein, row) {
  // Subtract the calories and protein from the totals
  totalCalories -= calories;
  totalProtein -= protein;

  // Remove the corresponding row from the table
  row.remove();

  // Filter out the removed food item from the current day's log
  currentDayLog = currentDayLog.filter(
    (entry) => !(entry.foodName === foodName && entry.amount === amount)
  );

  // If the log is empty after removing the item, delete the day's log
  if (currentDayLog.length === 0) {
    deleteLogForSelectedDate();
  } else {
    // Otherwise, update the totals and save the log
    updateTotals();
    saveLogForSelectedDate();
  }
}

// Update total calories and protein
function updateTotals() {
  document.getElementById("total-calories").textContent =
    totalCalories.toFixed(2);
  document.getElementById("total-protein").textContent =
    totalProtein.toFixed(2);

  // Recalculate the calorie deficit automatically
  const restingCalories =
    parseFloat(document.getElementById("resting-calories").value) || 0;
  const activeCalories =
    parseFloat(document.getElementById("active-calories").value) || 0;

  const totalBurnedCalories = restingCalories + activeCalories;
  const calorieDeficit = totalCalories - totalBurnedCalories;

  // Update the deficit display
  const deficitParagraph = document.getElementById("calorie-deficit");
  if (deficitParagraph) {
    deficitParagraph.textContent = calorieDeficit.toFixed(2);
  } else {
    const newDeficitParagraph = document.createElement("p");
    newDeficitParagraph.innerHTML = `<b>Total Calorie Deficit:</b> <span id="calorie-deficit">${calorieDeficit.toFixed(
      2
    )}</span> kcal`;
    document.querySelector(".totals").appendChild(newDeficitParagraph);
  }

  // Optionally save the updated deficit to Firebase if needed
  saveCalorieDeficitToFirebase(restingCalories, activeCalories, calorieDeficit);
}

// Save log for the selected date
function saveLogForSelectedDate() {
  const selectedDate =
    document.getElementById("log-date").value || getLocalDate(); // Use local date if no date is selected
  const logData = {
    log: currentDayLog,
    totals: { totalCalories, totalProtein },
  };

  const userId = auth.currentUser.uid;
  set(ref(db, `foodLogs/${userId}/${selectedDate}`), logData)
    .then(() => console.log("Log updated successfully!"))
    .catch((error) => console.error("Error updating log:", error));
}

// load log for today
// function loadLogForToday() {
//   if (!auth.currentUser) {
//     console.error("User is not authenticated.");
//     return;
//   }

//   // Get the current local date and format it correctly (YYYY-MM-DD)
//   const today = new Date();
//   const localDate = new Date(
//     today.getTime() - today.getTimezoneOffset() * 60000
//   )
//     .toISOString()
//     .slice(0, 10);

//   // console.log("Local date:", localDate); // Debugging to check the date

//   const userId = auth.currentUser.uid;

//   get(ref(db, `foodLogs/${userId}/${localDate}`))
//     .then((snapshot) => {
//       if (snapshot.exists()) {
//         const data = snapshot.val();
//         currentDayLog = data.log;
//         totalCalories = data.totals.totalCalories;
//         totalProtein = data.totals.totalProtein;

//         currentDayLog.forEach((entry) => {
//           addFoodToLog(
//             entry.foodName,
//             entry.amount,
//             entry.calories,
//             entry.protein
//           );
//         });
//         updateTotals();
//       }
//     })
//     .catch((error) => console.error("Error loading today's log:", error));
// }

// Load calorie deficit for today's date
function loadLogForToday() {
  const today = getLocalDate();
  loadLogForDate(today);
}

// Delete log for the selected date from Firebase
function deleteLogForSelectedDate() {
  const selectedDate =
    document.getElementById("log-date").value || getLocalDate(); // Use local date if no date is selected
  const userId = auth.currentUser.uid;
  remove(ref(db, `foodLogs/${userId}/${selectedDate}`))
    .then(() => {
      console.log("Log deleted successfully!");
      updateTotals(); // Reset totals
    })
    .catch((error) => console.error("Error deleting log:", error));
}

// Event listener for changing the log date
document.getElementById("log-date").addEventListener("change", function () {
  const selectedDate = this.value;
  const today = new Date().toISOString().slice(0, 10);
  const logTitle = document.querySelector(".summary-section h2");

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

// Load log for a selected date
function loadLogForDate(date) {
  const logBody = document.getElementById("log-body");
  logBody.innerHTML = ""; // Clear previous entries
  totalCalories = 0;
  totalProtein = 0;
  currentDayLog = [];

  const userId = auth.currentUser.uid;
  get(ref(db, `foodLogs/${userId}/${date}`))
    .then((snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        totalCalories = data.totals.totalCalories;
        totalProtein = data.totals.totalProtein;
        updateTotals();

        data.log.forEach((entry) => {
          addFoodToLog(
            entry.foodName,
            entry.amount,
            entry.calories,
            entry.protein
          );
        });
      } else {
        totalCalories = 0;
        totalProtein = 0;
        updateTotals();
      }
    })
    .catch((error) => console.error("Error loading log for date:", error));

  loadCalorieDeficitForDate(userId, date); // Load the calorie deficit for the selected date
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
      const logBody = document.getElementById("log-body");
      logBody.innerHTML = "";
      // loadLogForToday();
    })
    .catch((error) => console.error("Error logging in:", error));
});

document.getElementById("logout-btn").addEventListener("click", () => {
  signOut(auth)
    .then(() => {
      console.log("User logged out");
      document.getElementById("logout-btn").style.display = "none";
      document.getElementById("login-trigger").style.display = "block";
    })
    .catch((error) => console.error("Error logging out:", error));
});

// Wait for Firebase auth state resolution on page load
window.addEventListener("load", () => {
  console.log("Page loaded, checking auth state...");
  document.getElementById("login-trigger").style.display = "none";

  // Listen for auth state changes and load the log once authentication is confirmed
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // User is signed in
      console.log("User is authenticated. Loading today's log...");
      document.querySelector(".container").style.display = "block";
      // document.querySelector(".auth-section").style.display = "none";

      // Load log only after authentication is confirmed
      loadLogForToday();
    } else {
      // User is not signed in
      console.log("No authenticated user. Showing login section...");
      document.querySelector(".container").style.display = "none";
      // document.querySelector(".auth-section").style.display = "block";
      document.getElementById("login-trigger").style.display = "block";
    }
  });
});

// Get the modal elements
const burnCaloriesModal = document.getElementById("burn-calories-modal");
const burnCaloriesBtn = document.getElementById("burn-calories-btn");
const closeBurnModalBtn = burnCaloriesModal.querySelector(".close-btn");
const calculateDeficitBtn = document.getElementById("calculate-deficit-btn");

// Open the burn calories modal
burnCaloriesBtn.addEventListener("click", () => {
  burnCaloriesModal.style.display = "flex";
});

// Close the modal
closeBurnModalBtn.addEventListener("click", () => {
  burnCaloriesModal.style.display = "none";
});

// Close the modal when clicking outside of it
window.addEventListener("click", (event) => {
  if (event.target === burnCaloriesModal) {
    burnCaloriesModal.style.display = "none";
  }
});

// Calculate and display the calorie deficit
calculateDeficitBtn.addEventListener("click", () => {
  const restingCalories =
    parseFloat(document.getElementById("resting-calories").value) || 0;
  const activeCalories =
    parseFloat(document.getElementById("active-calories").value) || 0;

  const totalBurnedCalories = restingCalories + activeCalories;

  // Calculate deficit
  const calorieDeficit = totalCalories - totalBurnedCalories; // totalCalories is from the food log

  // Display the deficit in the totals section
  const deficitParagraph = document.createElement("p");
  deficitParagraph.innerHTML = `<b>Total Calorie Deficit:</b> <span id="calorie-deficit">${calorieDeficit.toFixed(
    2
  )}</span> kcal`;

  // Remove existing deficit if it exists
  const existingDeficit = document.getElementById("calorie-deficit");
  if (existingDeficit) {
    existingDeficit.parentNode.remove();
  }

  // Add the deficit to the totals section
  document.querySelector(".totals").appendChild(deficitParagraph);

  // Save the deficit to Firebase
  saveCalorieDeficitToFirebase(restingCalories, activeCalories, calorieDeficit);

  // Close the modal
  burnCaloriesModal.style.display = "none";
});

// Function to get the local date in YYYY-MM-DD format
function getLocalDate() {
  const today = new Date();
  const offset = today.getTimezoneOffset(); // Get the local timezone offset
  const localDate = new Date(today.getTime() - offset * 60 * 1000); // Adjust the time by offset

  return localDate.toISOString().slice(0, 10); // Return YYYY-MM-DD
}

// Save calorie deficit data to Firebase
function saveCalorieDeficitToFirebase(
  restingCalories,
  activeCalories,
  calorieDeficit
) {
  const selectedDate =
    document.getElementById("log-date").value || getLocalDate(); // Use local date if no date is selected
  const userId = auth.currentUser.uid;

  const deficitData = {
    restingCalories,
    activeCalories,
    calorieDeficit,
  };

  set(ref(db, `deficits/${userId}/${selectedDate}`), deficitData)
    .then(() => console.log("Calorie deficit saved successfully!"))
    .catch((error) => console.error("Error saving calorie deficit:", error));
}

// Load calorie deficit data for a selected date
function loadCalorieDeficitForDate(userId, date) {
  get(ref(db, `deficits/${userId}/${date}`))
    .then((snapshot) => {
      const existingDeficit = document.getElementById("calorie-deficit");
      if (snapshot.exists()) {
        const data = snapshot.val();
        const { restingCalories, activeCalories, calorieDeficit } = data;

        document.getElementById("resting-calories").value = restingCalories;
        document.getElementById("active-calories").value = activeCalories;

        if (existingDeficit) {
          existingDeficit.textContent = calorieDeficit.toFixed(2);
        } else {
          const deficitParagraph = document.createElement("p");
          deficitParagraph.innerHTML = `<b>Total Calorie Deficit:</b> <span id="calorie-deficit">${calorieDeficit.toFixed(
            2
          )}</span> kcal`;
          document.querySelector(".totals").appendChild(deficitParagraph);
        }
      } else {
        if (existingDeficit) {
          existingDeficit.parentNode.remove();
        }
      }
    })
    .catch((error) => console.error("Error loading calorie deficit:", error));
}
