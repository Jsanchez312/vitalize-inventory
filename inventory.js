const SUPABASE_URL =
"https://namfjvpjafopzmlqpoqo.supabase.co/rest/v1/";

const SUPABASE_KEY =
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hbWZqdnBqYWZvcHptbHFwb3FvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NzQ3NzksImV4cCI6MjA5NzQ1MDc3OX0.SPH0BvGeRpa8ff8GJWiEySpu1z9qmIEhFiFEbDXS4DI";

const supabase =
window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const LOW_DOSE_SMS_THRESHOLD = 3;



const DEFAULT_JARS = [
  { name: "Myers", doses: 8, totalDoses: 10 },
  { name: "Immunity", doses: 3, totalDoses: 10 },
  { name: "NAD+", doses: 0, totalDoses: 10 },
  { name: "Zinc", doses: 12, totalDoses: 15 }
];

let currentUser = null;
let activeJarIndex = null;
let jars = [];

async function doLogin() {

  const email =
  document.getElementById("email").value;

  const password =
  document.getElementById("password").value;

  const { data, error } =
  await supabase.auth.signInWithPassword({

      email,
      password

  });

  if(error){

      document.getElementById(
      "login-error"
      ).style.display = "block";

      return;
  }

  currentUser = email;

  document.getElementById(
  "login-screen"
  ).style.display = "none";

  document.getElementById(
  "app"
  ).style.display = "block";

  document.getElementById(
  "user-badge"
  ).textContent = email;

  await loadJars();

  renderAll();
}

document.getElementById("password").addEventListener("keydown", event => {
  if (event.key === "Enter") doLogin();
});

document.getElementById("email").addEventListener("keydown", event => {
  if (event.key === "Enter") doLogin();
});

function doLogout() {
  currentUser = null;
  sessionStorage.removeItem("vw_user");
  document.getElementById("app").style.display = "none";
  document.getElementById("login-screen").style.display = "flex";
  document.getElementById("email").value = "";
  document.getElementById("password").value = "";
}

async function initApp(){

    const { data } =
    await supabase.auth.getUser();

    if(data.user){

        currentUser =
        data.user.email;

        document.getElementById(
        "login-screen"
        ).style.display = "none";

        document.getElementById(
        "app"
        ).style.display = "block";

        document.getElementById(
        "user-badge"
        ).textContent =
        currentUser;

        await loadJars();

        renderAll();
    }
}

async function loadJars() {

    const { data, error } =
    await supabase
        .from("jars")
        .select("*");

    if(error){
        console.error(error);
        return;
    }

    jars = data.map(jar => ({
        id: jar.id,
        name: jar.name,
        doses: jar.doses,
        totalDoses: jar.total_doses
    }));
}



function renderAll() {
  renderSummary();
  renderTable();
}

function renderSummary() {
  const totalJars = jars.length;
  const totalDoses = jars.reduce((sum, jar) => sum + jar.doses, 0);
  const lowCount = jars.filter(isLowDoseJar).length;
  const emptyCount = jars.filter(jar => jar.doses === 0).length;

  document.getElementById("jar-count-badge").textContent = pluralize(totalJars, "jar", "jars");

  document.getElementById("summary-grid").innerHTML = `
    <div class="summary-card ok">
      <div class="icon">J</div>
      <div class="label">Total jars</div>
      <div class="value">${totalJars}</div>
      <div class="sub">currently tracked</div>
    </div>
    <div class="summary-card ok">
      <div class="icon">D</div>
      <div class="label">Available doses</div>
      <div class="value">${totalDoses}</div>
      <div class="sub">across all medications</div>
    </div>
    <div class="summary-card ${lowCount > 0 ? "warn" : "ok"}">
      <div class="icon">L</div>
      <div class="label">Low dose jars</div>
      <div class="value">${lowCount}</div>
      <div class="sub">below ${LOW_DOSE_SMS_THRESHOLD} doses</div>
    </div>
    <div class="summary-card ${emptyCount > 0 ? "danger" : "ok"}">
      <div class="icon">E</div>
      <div class="label">Empty jars</div>
      <div class="value">${emptyCount}</div>
      <div class="sub">need replacement</div>
    </div>
  `;
}

function renderTable() {
  const tbody = document.getElementById("jar-table-body");

  if (jars.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:42px; color:var(--ink-muted);">No jars yet. Add a new jar to begin.</td></tr>';
    return;
  }

  tbody.innerHTML = jars.map((jar, index) => {
    const percent = jar.totalDoses > 0 ? Math.round((jar.doses / jar.totalDoses) * 100) : 0;
    const status = getJarStatus(jar);

    return `
      <tr>
        <td><span class="med-name">${escapeHtml(jar.name)}</span></td>
        <td><span class="dose-count">${jar.doses}</span></td>
        <td><span class="total-count">${jar.totalDoses}</span></td>
        <td><span class="badge ${status.badgeClass}">${status.label}</span></td>
        <td>
          <div class="progress-wrap">
            <div class="progress-bar-outer">
              <div class="progress-bar-inner ${status.progressClass}" style="width:${Math.min(percent, 100)}%"></div>
            </div>
            <span class="progress-number">${percent}%</span>
          </div>
        </td>
        <td>
          <div class="row-actions">
            <button class="btn-sm blue" onclick="openUseDose(${index})">Use</button>
            <button class="btn-sm" onclick="openAddDoses(${index})">Refill</button>
            <button class="btn-sm del" onclick="openDelete(${index})">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function getJarStatus(jar) {
  if (jar.doses === 0) {
    return { label: "Empty", badgeClass: "badge-danger", progressClass: "prog-danger" };
  }

  if (isLowDoseJar(jar)) {
    return { label: "Low", badgeClass: "badge-warn", progressClass: "prog-warn" };
  }

  return { label: "OK", badgeClass: "badge-ok", progressClass: "prog-ok" };
}

function isLowDoseJar(jar) {
  return jar.doses < LOW_DOSE_SMS_THRESHOLD;
}

function openModal(id) {
  document.getElementById(id).classList.add("open");
}

function closeModal(id) {
  document.getElementById(id).classList.remove("open");
}

function openAddJar() {
  document.getElementById("new-jar-name").value = "Medication " + String.fromCharCode(65 + jars.length);
  document.getElementById("new-jar-doses").value = 10;
  openModal("modal-add-jar");
  setTimeout(() => document.getElementById("new-jar-name").focus(), 50);
}

async function confirmAddJar() {
  const name = document.getElementById("new-jar-name").value.trim();
  const doses = parseInt(document.getElementById("new-jar-doses").value, 10);

  if (!name) {
    showToast("Enter a jar name.");
    return;
  }

  if (Number.isNaN(doses) || doses < 1) {
    showToast("Doses must be at least 1.");
    return;
  }

  if (jars.some(jar => jar.name.toLowerCase() === name.toLowerCase())) {
    showToast("A jar with that name already exists.");
    return;
  }

  const jar = { name, doses, totalDoses: doses };
  await supabase
.from("jars")
.insert([{
    name,
    doses,
    total_doses:doses
}]);

await loadJars();
  renderAll();
  showToast(`${name} added with ${pluralize(doses, "dose", "doses")}.`);
  triggerAutomaticLowDoseSMS(jar, "new jar added");
}

function openAddDoses(index) {
  activeJarIndex = index;
  document.getElementById("modal-jar-name-display").value = jars[index].name;
  document.getElementById("add-dose-count").value = 10;
  openModal("modal-add-doses");
  setTimeout(() => document.getElementById("add-dose-count").focus(), 50);
}

async function confirmAddDoses() {
  const amount = parseInt(document.getElementById("add-dose-count").value, 10);

  if (Number.isNaN(amount) || amount < 1) {
    showToast("Enter a valid number of doses.");
    return;
  }

  const jar = jars[activeJarIndex];
  jar.doses += amount;
  jar.totalDoses += amount;
  await supabase
.from("jars")
.update({
   doses: jar.doses,
   total_doses: jar.totalDoses
})
.eq("id", jar.id);

await loadJars();
  closeModal("modal-add-doses");
  renderAll();
  showToast(`${pluralize(amount, "dose", "doses")} added to ${jar.name}.`);
}

function openUseDose(index) {
  activeJarIndex = index;
  document.getElementById("use-jar-name-display").value = jars[index].name;
  document.getElementById("use-dose-count").value = 1;
  openModal("modal-use-dose");
  setTimeout(() => document.getElementById("use-dose-count").focus(), 50);
}

async function confirmUseDose() {
  const amount = parseInt(document.getElementById("use-dose-count").value, 10);

  if (Number.isNaN(amount) || amount < 1) {
    showToast("Enter a valid number.");
    return;
  }

  const jar = jars[activeJarIndex];
  if (amount > jar.doses) {
    showToast(`Not enough doses. Only ${jar.doses} left.`);
    return;
  }

  jar.doses -= amount;
  await supabase
.from("jars")
.update({
   doses: jar.doses
})
.eq("id", jar.id);

await loadJars();
  closeModal("modal-use-dose");
  renderAll();
  showToast(`${pluralize(amount, "dose", "doses")} used from ${jar.name}.`);
  triggerAutomaticLowDoseSMS(jar, "dose used");
}

function openDelete(index) {
  activeJarIndex = index;
  document.getElementById("delete-jar-name").textContent = jars[index].name;
  openModal("modal-delete");
}

async function confirmDelete() {
  const name = jars[activeJarIndex].name;
  await supabase
.from("jars")
.delete()
.eq("id", jars[activeJarIndex].id);

await loadJars();
  closeModal("modal-delete");
  renderAll();
  showToast(`${name} deleted.`);
}

document.querySelectorAll(".modal-backdrop").forEach(backdrop => {
  backdrop.addEventListener("click", event => {
    if (event.target === backdrop) backdrop.classList.remove("open");
  });
});

function triggerAutomaticLowDoseSMS(jar, reason) {
  if (!isLowDoseJar(jar)) return;
  sendLowStockSMS("automatic", [jar], reason);
}

async function sendLowStockSMS(source = "manual", targetJars = null, reason = "") {
  const lowJars = targetJars || jars.filter(isLowDoseJar);

  if (lowJars.length === 0) {
    showToast("All jars are above the low-dose threshold.");
    writeSmsLog("No low-dose jars found.");
    return;
  }

  if (!hasTwilioKeys()) {
    const message = "SMS not sent. Add Twilio values inside TWILIO_KEYS in inventory.js.";
    showToast(message);
    writeSmsLog(message);
    updateSmsStatus();
    return;
  }

  const body = buildSmsBody(lowJars, source, reason);
  writeSmsLog("Sending SMS...\n\n" + body);

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_KEYS.accountSid}/Messages.json`;
  const credentials = btoa(`${TWILIO_KEYS.accountSid}:${TWILIO_KEYS.authToken}`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + credentials,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        From: TWILIO_KEYS.fromNumber,
        To: TWILIO_KEYS.toNumber,
        Body: body
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data.message || JSON.stringify(data);
      writeSmsLog(`SMS failed (${response.status}): ${errorMessage}`);
      showToast("SMS failed. Check the Twilio keys in inventory.js.");
      return;
    }

    writeSmsLog(`SMS sent successfully.\nSID: ${data.sid}\nTo: ${TWILIO_KEYS.toNumber}\n\n${body}`);
    showToast(source === "automatic" ? "Automatic low-dose SMS sent." : "Low-stock SMS sent.");
  } catch (error) {
    writeSmsLog(`SMS failed: ${error.message}\n\nIf this is opened directly in a browser, Twilio may require a small server-side sender.`);
    showToast("SMS failed. See the SMS activity log.");
  }
}

function buildSmsBody(lowJars, source, reason) {
  const lines = lowJars.map(jar => {
    const doseText = jar.doses === 0 ? "EMPTY" : `${pluralize(jar.doses, "dose", "doses")} left`;
    return `- ${jar.name}: ${doseText}`;
  });

  const sourceText = source === "automatic" ? "Automatic low-dose alert" : "Manual low-stock alert";
  const reasonText = reason ? `\nReason: ${reason}` : "";

  return `${sourceText}${reasonText}\nTime: ${new Date().toLocaleString()}\nThreshold: below ${LOW_DOSE_SMS_THRESHOLD} doses\n\n${lines.join("\n")}\n\nPlease restock these medications.`;
}

function hasTwilioKeys() {
  return Boolean(
    TWILIO_KEYS.accountSid &&
    TWILIO_KEYS.authToken &&
    TWILIO_KEYS.fromNumber &&
    TWILIO_KEYS.toNumber
  );
}

function updateSmsStatus() {
  const pill = document.getElementById("sms-status-pill");
  if (!pill) return;

  if (hasTwilioKeys()) {
    pill.textContent = "SMS alerts: active";
    pill.style.background = "var(--success-soft)";
    pill.style.color = "var(--success)";
    return;
  }

  pill.textContent = "SMS alerts: add keys in code";
  pill.style.background = "var(--warn-soft)";
  pill.style.color = "var(--warn)";
}

function writeSmsLog(message) {
  const log = document.getElementById("sms-log");
  if (!log) return;
  log.textContent = message;
}

let toastTimer;
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.style.display = "none";
  }, 3200);
}

function pluralize(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

initApp();
