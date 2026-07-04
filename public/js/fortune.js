/* Fortune God — 5x3 slot front-end. The server decides every outcome. */

(function () {
  let me = null;
  let config = null;
  let currentBet = 10;
  let spinning = false;
  let freeSpins = 0;
  // what each column currently shows, grid[reel][row]
  let currentGrid = [
    ["M1", "A", "K"], ["M2", "K", "Q"], ["W", "M4", "J"],
    ["M3", "Q", "A"], ["M1", "J", "K"],
  ];

  const $ = (id) => document.getElementById(id);

  async function api(path, opts) {
    const res = await fetch(path, Object.assign({
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
    }, opts));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed (" + res.status + ")");
    return data;
  }

  /* ------------------------------ boot ------------------------------ */

  async function boot() {
    try {
      const data = await api("/api/me");
      me = data.user;
    } catch (e) {
      window.location.href = "/";
      return;
    }
    config = await api("/api/fortune/config");
    currentBet = config.bets[0];
    freeSpins = me.fortuneFreeSpins || 0;
    $("hello").textContent = me.name;
    $("admin-link").classList.toggle("hidden", me.role !== "admin");
    setBalance(me.balance);
    buildBetButtons();
    buildPaytable();
    buildGrid();
    updateFsUi();
    loadHistory();
    $("game-screen").classList.remove("hidden");
  }

  $("logout-btn").addEventListener("click", async () => {
    await api("/api/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/";
  });

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
        if (spinning || freeSpins > 0) return;
        currentBet = b;
        box.querySelectorAll(".bet-btn").forEach((x) => x.classList.remove("selected"));
        btn.classList.add("selected");
      });
      box.appendChild(btn);
    });
  }

  /* ---------------------------- paytable ---------------------------- */

  function payRow(sym, pays) {
    return "<tr><td><div class=\"combo\">" + FORTUNE_SVG[sym] +
      "<span class=\"combo-name\">" + FORTUNE_NAME[sym] + "</span></div></td>" +
      "<td class=\"pays\">" + pays + "</td></tr>";
  }

  function buildPaytable() {
    const rows = [];
    ["M1", "M2", "M3", "M4", "A", "K", "Q", "J"].forEach((sym) => {
      const p = config.paytable[sym];
      rows.push(payRow(sym, p[3] + " / " + p[4] + " / " + p[5]));
    });
    rows.push(payRow("S", config.scatterPay[3] + " / " + config.scatterPay[4] + " / " + config.scatterPay[5]));
    $("paytable-body").innerHTML = rows.join("");
    $("rules-note").innerHTML =
      "Pays shown for 3 / 4 / 5 in a row on any of the 10 lines, left to right. " +
      "WILD stands in for everything except the Fortune Coin. " +
      "3 or more Fortune Coins anywhere pay and start <strong>" + config.freeSpinsAward +
      " free spins with all wins x" + config.freeSpinMultiplier + "</strong> (they can retrigger).";
  }

  /* ------------------------------ grid ------------------------------ */

  function cellHtml(sym) {
    return '<div class="fcell">' + FORTUNE_SVG[sym] + "</div>";
  }

  function buildGrid() {
    const g = $("fgrid");
    g.innerHTML = "";
    for (let reel = 0; reel < 5; reel++) {
      const col = document.createElement("div");
      col.className = "fcol";
      col.id = "fcol-" + reel;
      const strip = document.createElement("div");
      strip.className = "fstrip";
      strip.innerHTML = currentGrid[reel].map(cellHtml).join("");
      col.appendChild(strip);
      g.appendChild(col);
    }
  }

  function randomSym() {
    const pool = ["M1", "M2", "M3", "M4", "A", "K", "Q", "J", "S", "W"];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function animateColumn(reel, finalSyms, duration) {
    return new Promise((resolve) => {
      const col = $("fcol-" + reel);
      const strip = col.querySelector(".fstrip");
      const cellH = col.clientHeight / 3;

      const fillers = 12 + reel * 4;
      let html = currentGrid[reel].map(cellHtml).join("");
      for (let k = 0; k < fillers; k++) html += cellHtml(randomSym());
      html += finalSyms.map(cellHtml).join("");
      strip.innerHTML = html;

      strip.style.transition = "none";
      strip.style.transform = "translateY(0)";
      strip.getBoundingClientRect();

      strip.style.transition = "transform " + duration + "ms cubic-bezier(0.15, 0.6, 0.25, 1)";
      strip.style.transform = "translateY(-" + (fillers + 3) * cellH + "px)";

      const done = () => {
        strip.removeEventListener("transitionend", done);
        strip.style.transition = "none";
        strip.style.transform = "translateY(0)";
        strip.innerHTML = finalSyms.map(cellHtml).join("");
        resolve();
      };
      strip.addEventListener("transitionend", done);
      setTimeout(done, duration + 400);
    });
  }

  function highlightWins(result) {
    const cols = [];
    for (let reel = 0; reel < 5; reel++) {
      cols.push($("fcol-" + reel).querySelectorAll(".fcell"));
    }
    result.lineWins.forEach((lw) => {
      const line = config.paylines[lw.line];
      for (let reel = 0; reel < lw.count; reel++) {
        cols[reel][line[reel]].classList.add("win-cell");
      }
    });
    if (result.scatters >= 3) {
      for (let reel = 0; reel < 5; reel++) {
        for (let row = 0; row < 3; row++) {
          if (result.grid[reel][row] === "S") cols[reel][row].classList.add("win-cell");
        }
      }
    }
  }

  /* --------------------------- free spins ui ------------------------ */

  function updateFsUi() {
    const banner = $("fs-banner");
    if (freeSpins > 0) {
      banner.textContent = "FREE SPINS: " + freeSpins + " left — all wins x" + config.freeSpinMultiplier;
      banner.classList.remove("hidden");
      $("spin-btn").textContent = "FREE SPIN";
    } else {
      banner.classList.add("hidden");
      $("spin-btn").textContent = "SPIN";
    }
    document.querySelectorAll(".bet-btn").forEach((b) => {
      b.disabled = freeSpins > 0;
      b.style.opacity = freeSpins > 0 ? "0.4" : "1";
    });
  }

  /* ------------------------------ spin ------------------------------ */

  $("spin-btn").addEventListener("click", async () => {
    if (spinning) return;
    const line = $("result-line");

    if (freeSpins === 0 && me.balance < currentBet) {
      line.className = "result-line lose";
      line.textContent = "Not enough balance — ask us to top you up.";
      return;
    }

    spinning = true;
    $("spin-btn").disabled = true;
    line.className = "result-line";
    line.innerHTML = "&nbsp;";
    document.querySelectorAll(".win-cell").forEach((c) => c.classList.remove("win-cell"));

    let result;
    try {
      result = await api("/api/fortune/spin", {
        method: "POST",
        body: JSON.stringify({ bet: currentBet }),
      });
    } catch (err) {
      line.className = "result-line lose";
      line.textContent = err.message;
      spinning = false;
      $("spin-btn").disabled = false;
      return;
    }

    if (result.cost > 0) setBalance(me.balance - result.cost);

    await Promise.all(
      result.grid.map((syms, reel) => animateColumn(reel, syms, 800 + reel * 250))
    );

    currentGrid = result.grid.map((c) => c.slice());
    freeSpins = result.freeSpinsLeft;
    setBalance(result.balance);
    highlightWins(result);

    const parts = [];
    if (result.win > 0) {
      parts.push("You win " + result.win.toLocaleString() +
        (result.multiplier > 1 ? " (x" + result.multiplier + ")" : ""));
    }
    if (result.freeSpinsWon > 0) {
      parts.push(result.freeSpinsWon + " FREE SPINS!");
    }
    if (parts.length) {
      line.className = "result-line win";
      line.textContent = parts.join(" — ");
    } else {
      line.className = "result-line lose";
      line.textContent = "No luck this time.";
    }

    updateFsUi();
    loadHistory();
    spinning = false;
    $("spin-btn").disabled = false;
  });

  /* ----------------------------- history ---------------------------- */

  async function loadHistory() {
    try {
      const data = await api("/api/history");
      const list = $("history-list");
      if (!data.spins.length) {
        list.innerHTML = "<li><span>No spins yet</span></li>";
        return;
      }
      list.innerHTML = data.spins.map((s) => {
        const t = new Date(s.at);
        const time = t.getHours().toString().padStart(2, "0") + ":" + t.getMinutes().toString().padStart(2, "0");
        const cost = s.freeSpin ? 0 : s.bet;
        const net = s.win - cost;
        const cls = net > 0 ? "win" : net === 0 && s.win > 0 ? "win" : "lose";
        const amt = (net > 0 ? "+" : "") + net.toLocaleString();
        const label = s.game === "fortune" ? (s.freeSpin ? "free spin" : "bet " + s.bet) : "reels · bet " + s.bet;
        return "<li><span>" + time + " · " + label + "</span><span class=\"amt " + cls + "\">" + amt + "</span></li>";
      }).join("");
    } catch (e) { /* not fatal */ }
  }

  boot();
})();
