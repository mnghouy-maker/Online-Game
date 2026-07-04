/* Golden Spin — slot game front-end.
 * The server decides every outcome; this file only animates and displays. */

(function () {
  let me = null;
  let config = null;
  let currentBet = 10;
  let spinning = false;
  let currentReels = ["cherry", "bell", "seven"]; // what's showing right now

  const $ = (id) => document.getElementById(id);

  /* ------------------------------ api ------------------------------ */

  async function api(path, opts) {
    const res = await fetch(path, Object.assign({
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
    }, opts));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed (" + res.status + ")");
    return data;
  }

  /* ----------------------------- screens --------------------------- */

  function show(screen) {
    $("login-screen").classList.toggle("hidden", screen !== "login");
    $("game-screen").classList.toggle("hidden", screen !== "game");
  }

  async function boot() {
    try {
      const data = await api("/api/me");
      me = data.user;
      enterGame();
    } catch (e) {
      show("login");
    }
  }

  async function enterGame() {
    config = await api("/api/config");
    $("hello").textContent = me.name;
    $("admin-link").classList.toggle("hidden", me.role !== "admin");
    setBalance(me.balance);
    buildBetButtons();
    buildPaytable();
    fillReelsInitial();
    loadHistory();
    show("game");
  }

  /* ------------------------------ login ----------------------------- */

  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("login-error").textContent = "";
    try {
      const data = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({
          username: $("login-username").value,
          password: $("login-password").value,
        }),
      });
      me = data.user;
      if (me.role === "admin") {
        window.location.href = "/admin";
      } else {
        enterGame();
      }
    } catch (err) {
      $("login-error").textContent = err.message;
    }
  });

  $("logout-btn").addEventListener("click", async () => {
    await api("/api/logout", { method: "POST" }).catch(() => {});
    window.location.reload();
  });

  /* ------------------------------ signup ---------------------------- */

  $("show-signup").addEventListener("click", () => {
    $("login-form").classList.add("hidden");
    $("signup-form").classList.remove("hidden");
    $("login-tagline").textContent = "Create your account. We approve it before you can play.";
  });

  $("show-login").addEventListener("click", () => {
    $("signup-form").classList.add("hidden");
    $("login-form").classList.remove("hidden");
    $("login-tagline").textContent = "Welcome back. Log in to play.";
  });

  $("signup-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("signup-error").textContent = "";
    $("signup-ok").classList.add("hidden");
    try {
      await api("/api/register", {
        method: "POST",
        body: JSON.stringify({
          username: $("su-username").value,
          name: $("su-name").value,
          password: $("su-password").value,
          requestedBalance: $("su-balance").value,
        }),
      });
      $("signup-form").reset();
      $("signup-ok").textContent =
        "Account created and sent for approval. Once we approve it and set your balance, you can log in.";
      $("signup-ok").classList.remove("hidden");
    } catch (err) {
      $("signup-error").textContent = err.message;
    }
  });

  /* ---------------------------- balance ----------------------------- */

  function setBalance(v) {
    me.balance = v;
    $("balance").textContent = v.toLocaleString();
  }

  /* --------------------------- bet buttons -------------------------- */

  function buildBetButtons() {
    const box = $("bet-buttons");
    box.innerHTML = "";
    config.bets.forEach((b) => {
      const btn = document.createElement("button");
      btn.className = "bet-btn" + (b === currentBet ? " selected" : "");
      btn.textContent = b;
      btn.addEventListener("click", () => {
        if (spinning) return;
        currentBet = b;
        box.querySelectorAll(".bet-btn").forEach((x) => x.classList.remove("selected"));
        btn.classList.add("selected");
      });
      box.appendChild(btn);
    });
  }

  /* ---------------------------- paytable ---------------------------- */

  function comboCell(sym, count) {
    let html = '<div class="combo">';
    for (let i = 0; i < count; i++) html += SYMBOL_SVG[sym];
    html += "</div>";
    return html;
  }

  function buildPaytable() {
    const rows = [];
    const tripleOrder = Object.entries(config.payTriple).sort((a, b) => b[1] - a[1]);
    tripleOrder.forEach(([sym, pay]) => {
      rows.push("<tr><td>" + comboCell(sym, 3) + '</td><td class="pays">x' + pay + "</td></tr>");
    });
    const pairOrder = Object.entries(config.payPair).sort((a, b) => b[1] - a[1]);
    pairOrder.forEach(([sym, pay]) => {
      rows.push("<tr><td>" + comboCell(sym, 2) + '</td><td class="pays">x' + pay + "</td></tr>");
    });
    $("paytable-body").innerHTML = rows.join("");
  }

  /* ------------------------------ reels ----------------------------- */

  function cellHtml(sym) {
    return '<div class="cell">' + SYMBOL_SVG[sym] + "</div>";
  }

  function fillReelsInitial() {
    currentReels.forEach((sym, i) => {
      const strip = document.querySelector("#reel-" + i + " .strip");
      strip.style.transition = "none";
      strip.style.transform = "translateY(0)";
      strip.innerHTML = cellHtml(sym);
    });
  }

  function randomFiller() {
    const keys = config.symbols;
    return keys[Math.floor(Math.random() * keys.length)];
  }

  // Animate one reel to land on `finalSym`. Resolves when the animation ends.
  function animateReel(i, finalSym, duration) {
    return new Promise((resolve) => {
      const reel = $("reel-" + i);
      const strip = reel.querySelector(".strip");
      const cellH = reel.clientHeight;

      const fillerCount = turbo ? 5 + i * 2 : 14 + i * 5;
      let html = cellHtml(currentReels[i]);
      for (let k = 0; k < fillerCount; k++) html += cellHtml(randomFiller());
      html += cellHtml(finalSym);
      strip.innerHTML = html;

      strip.style.transition = "none";
      strip.style.transform = "translateY(0)";
      strip.getBoundingClientRect(); // force reflow so the transition applies

      strip.style.transition = "transform " + duration + "ms cubic-bezier(0.15, 0.6, 0.25, 1)";
      strip.style.transform = "translateY(-" + (fillerCount + 1) * cellH + "px)";

      const done = () => {
        strip.removeEventListener("transitionend", done);
        // collapse the strip back to a single cell so the DOM stays small
        strip.style.transition = "none";
        strip.style.transform = "translateY(0)";
        strip.innerHTML = cellHtml(finalSym);
        resolve();
      };
      strip.addEventListener("transitionend", done);
      // safety net in case transitionend doesn't fire (tab in background)
      setTimeout(done, duration + 400);
    });
  }

  /* --------------------- auto / turbo / sound ----------------------- */

  let turbo = localStorage.getItem("gs_turbo") === "1";
  const AUTO_STEPS = [0, 10, 25, 50, -1]; // -1 = until stopped
  let autoTarget = 0;
  let autoLeft = 0;
  let autoRunning = false;
  let stopAuto = false;

  function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

  function autoLabel() {
    if (autoRunning) return "STOP" + (autoTarget === -1 ? "" : " (" + autoLeft + ")");
    if (autoTarget === 0) return "AUTO: OFF";
    return "AUTO: " + (autoTarget === -1 ? "ENDLESS" : autoTarget);
  }

  function updateAutoUi() {
    const b = $("auto-btn");
    b.textContent = autoLabel();
    b.classList.toggle("on", autoTarget !== 0 && !autoRunning);
    b.classList.toggle("stop", autoRunning);
    $("spin-btn").textContent = autoRunning ? "STOP" : "SPIN";
  }

  $("turbo-btn").classList.toggle("on", turbo);
  $("turbo-btn").addEventListener("click", () => {
    turbo = !turbo;
    localStorage.setItem("gs_turbo", turbo ? "1" : "0");
    $("turbo-btn").classList.toggle("on", turbo);
    CasinoAudio.click();
  });

  $("auto-btn").addEventListener("click", () => {
    CasinoAudio.click();
    if (autoRunning) { stopAuto = true; return; }
    autoTarget = AUTO_STEPS[(AUTO_STEPS.indexOf(autoTarget) + 1) % AUTO_STEPS.length];
    updateAutoUi();
  });

  CasinoAudio.bindControls("sound-btn", "music-btn");

  /* ------------------------------ spin ------------------------------ */

  // one spin; returns false when the auto session should stop
  async function spinOnce() {
    const line = $("result-line");

    if (me.balance < currentBet) {
      line.className = "result-line lose";
      line.textContent = "Not enough balance — ask us to top you up.";
      return false;
    }

    spinning = true;
    line.className = "result-line";
    line.innerHTML = "&nbsp;";
    document.querySelectorAll(".reel").forEach((r) => r.classList.remove("win-flash"));

    let result;
    try {
      result = await api("/api/spin", {
        method: "POST",
        body: JSON.stringify({ bet: currentBet }),
      });
    } catch (err) {
      line.className = "result-line lose";
      line.textContent = err.message;
      spinning = false;
      return false;
    }

    CasinoAudio.spin();
    // show the bet leaving the balance while the reels spin
    setBalance(me.balance - currentBet);

    const base = turbo ? [300, 420, 540] : [900, 1400, 1900];
    await Promise.all([
      animateReel(0, result.reels[0], base[0]).then(() => CasinoAudio.reelStop()),
      animateReel(1, result.reels[1], base[1]).then(() => CasinoAudio.reelStop()),
      animateReel(2, result.reels[2], base[2]).then(() => CasinoAudio.reelStop()),
    ]);

    currentReels = result.reels.slice();
    setBalance(result.balance);

    if (result.win > 0) {
      line.className = "result-line win";
      const what = result.kind === "triple" ? "Three " : "Two ";
      line.textContent = what + SYMBOL_NAME[result.symbol] + "s! You win " + result.win.toLocaleString() + " (x" + result.multiplier + ")";
      document.querySelectorAll(".reel").forEach((r) => r.classList.add("win-flash"));
      CasinoAudio.win(result.multiplier);
    } else {
      line.className = "result-line lose";
      line.textContent = "No luck this time.";
      CasinoAudio.lose();
    }

    loadHistory();
    spinning = false;
    return true;
  }

  async function runAuto() {
    autoRunning = true;
    stopAuto = false;
    autoLeft = autoTarget === -1 ? 0 : autoTarget;
    updateAutoUi();
    while (!stopAuto) {
      const ok = await spinOnce();
      if (!ok) break;
      if (autoTarget !== -1) {
        autoLeft--;
        if (autoLeft <= 0) break;
      }
      updateAutoUi();
      if (stopAuto) break;
      await delay(turbo ? 300 : 700);
    }
    autoRunning = false;
    autoTarget = 0;
    updateAutoUi();
  }

  $("spin-btn").addEventListener("click", async () => {
    if (autoRunning) { stopAuto = true; return; }
    if (spinning) return;
    if (autoTarget !== 0) { runAuto(); return; }
    $("spin-btn").disabled = true;
    await spinOnce();
    $("spin-btn").disabled = false;
  });

  /* ----------------------------- history ---------------------------- */

  async function loadHistory() {
    try {
      const data = await api("/api/history");
      const list = $("history-list");
      if (!data.spins.length) {
        list.innerHTML = '<li><span>No spins yet</span></li>';
        return;
      }
      list.innerHTML = data.spins.map((s) => {
        const t = new Date(s.at);
        const time = t.getHours().toString().padStart(2, "0") + ":" + t.getMinutes().toString().padStart(2, "0");
        const cost = s.freeSpin ? 0 : s.bet;
        const net = s.win - cost;
        const cls = net >= 0 && s.win > 0 ? "win" : "lose";
        const amt = (net > 0 ? "+" : "") + net.toLocaleString();
        const label = s.game === "fortune" ? (s.freeSpin ? "fortune · free" : "fortune · bet " + s.bet) : "bet " + s.bet;
        return "<li><span>" + time + " · " + label + "</span><span class=\"amt " + cls + "\">" + amt + "</span></li>";
      }).join("");
    } catch (e) { /* not fatal */ }
  }

  boot();
})();
