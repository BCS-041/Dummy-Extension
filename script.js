let countdownEl = document.getElementById("countdown");
let startBtn = document.getElementById("startBtn");
let intervalInput = document.getElementById("interval");
let controls = document.getElementById("controls");

let refreshInterval = 30; // default 30s
let timerInterval = null;
let endTime = null;

function formatTime(seconds) {
  let mins = Math.floor(seconds / 60);
  let secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  endTime = Date.now() + refreshInterval * 1000;

  timerInterval = setInterval(() => {
    let remaining = Math.floor((endTime - Date.now()) / 1000);

    if (remaining <= 0) {
      clearInterval(timerInterval);

      // 🔄 Refresh Tableau here
      console.log("Refreshing Tableau...");

      // restart loop
      startTimer();
    } else {
      countdownEl.textContent = formatTime(remaining);
    }
  }, 1000);
}

startBtn.addEventListener("click", () => {
  let val = parseInt(intervalInput.value, 10);
  if (!isNaN(val) && val > 0) refreshInterval = val;

  countdownEl.textContent = formatTime(refreshInterval);
  controls.style.display = "none"; // hide input and start
  startTimer();
});
