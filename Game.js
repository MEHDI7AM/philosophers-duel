// Game.js — main controller. State machine:
//   'menu'        -> pick game mode
//   'select-p1'   -> P1 picks 3 philosophers
//   'select-p2'   -> P2 picks 3 philosophers (local duel) or auto (solo)
//   'fight'       -> turn-based philosophy combat
//   'victory'     -> show result, allow rematch
//
// Combat loop:
//   • A question is drawn from the ASKING philosopher's pool
//     (asker = opponent's roster — their philosopher "challenges" you).
//   • Current player answers → Evaluator.score → damage.
//   • Opponent takes damage, HP < 0 => victory.
//   • Combo multiplier increases on back-to-back strong hits.
//   • Ult meter fills with each answer; when full, next hit is Ultimate.
//
// Multiplayer: calls Multiplayer.connect() for parity with platform rules.
// Actual networked PvP would be substantial; this build ships a complete
// single-player (vs AI) + local-duel experience, with MP connection
// established so Leaderboard and future PvP are available.

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this.state = 'menu';
    this.lastTime = 0;
    this.entities = [];
    this.fighters = [null, null];
    this.rosters = [[], []]; // array of philosopher ids per player
    this.names = ['Player 1', 'Player 2'];
    this.hp = [100, 100];
    this.combo = [1, 1];
    this.ult = [0, 0]; // 0..100
    this.defending = [false, false];
    this.turn = 0; // 0 = p1, 1 = p2
    this.round = 1;
    this.mode = 'solo'; // 'solo' | 'duel' | 'knowledge' | 'tournament'
    this.aiSkill = 0.6;
    this.tournamentStage = 0;
    this.tournamentOpponents = ['socrates', 'nietzsche', 'kant', 'plato'];
    this.questionBank = new QuestionBank();
    this.currentQuestion = null;
    this.selecting = { player: 0, selected: [] };
    this.fx = new FxLayer(document.getElementById('fx-layer'));
    this.evalLock = false; // during the brief resolution animation
    this.aiTimer = 0;

    this._cacheUI();
    this._bindUI();
    this._loadWorldSettings();
    if (window.Worlds && Worlds.onChange) {
      Worlds.onChange(() => this._loadWorldSettings());
    }
    this._resizeCanvas();
    window.addEventListener('resize', () => this._resizeCanvas());

    // In-game restart: pressing R after a KO (or any time during combat/
    // victory) returns to the main menu, from which the player can start a
    // fresh run. The on-screen Rematch / Main Menu buttons remain the
    // primary paths; this is a keyboard affordance for the dead-end case.
    window.addEventListener('keydown', (e) => {
      if ((e.key === 'r' || e.key === 'R') && (this.state === 'victory')) {
        // Only trigger when NOT typing in the answer box (which it isn't
        // once the fight has ended — the question panel is hidden).
        if (document.activeElement && document.activeElement.tagName === 'TEXTAREA') return;
        e.preventDefault();
        this.reset();
      }
    });

    this._initMultiplayer();
    this._initSaveLeaderboard();

    this.start();
  }

  // Reads editor-tunable DESIGN values from the world document and applies
  // them to the live game. Called at construction and on every Worlds.onChange
  // so slider edits in the Worlds tab take effect without restarting.
  _loadWorldSettings() {
    let s = {};
    try {
      if (window.Worlds && Worlds.list) {
        const id = Worlds.list()[0];
        const w = id ? Worlds.get(id) : null;
        s = (w && w.data && w.data.settings) || {};
      } else if (typeof WorldsData !== 'undefined' && WorldsData.worlds) {
        const first = Object.keys(WorldsData.worlds)[0];
        s = (first && WorldsData.worlds[first].data && WorldsData.worlds[first].data.settings) || {};
      }
    } catch (e) { /* fall back to defaults */ }
    this.startingHp = s.startingHp ?? 100;
    this.aiBaseSkill = s.aiBaseSkill ?? 0.6;
    // Apply to live state when possible
    if (this.state === 'menu') {
      this.hp = [this.startingHp, this.startingHp];
    }
    this.aiSkill = this.aiBaseSkill;
  }

  // Full reset — return to the main menu for a clean new run after a KO.
  reset() {
    this.ui.victory.classList.add('hidden');
    this.ui.hud.classList.add('hidden');
    this.ui.qPanel.classList.add('hidden');
    this.ui.waitBanner.classList.add('hidden');
    this.ui.selectScreen.classList.add('hidden');
    this.entities = [];
    this.fighters = [null, null];
    this.rosters = [[], []];
    this.hp = [this.startingHp, this.startingHp];
    this.combo = [1, 1];
    this.ult = [0, 0];
    this.defending = [false, false];
    this.round = 1;
    this.state = 'menu';
    this.ui.menu.classList.remove('hidden');
  }

  async _initMultiplayer() {
    try {
      if (!window.Multiplayer) {
        this.ui.mpStatus.textContent = 'Offline mode';
        return;
      }
      await Multiplayer.connect();
      Multiplayer.registerGameConfig({
        worldBounds: { width: 1280, height: 720 },
        playerSpeed: 0,
        maxPlayerSpeed: 0,
        maxEntitySpeed: 0,
        playerCollisionRadius: 24,
        spawn: { x: 640, y: 540 },
        entityTypes: {},
        collisionRules: []
      });

      // Authoritative state subscription — required for all multiplayer games.
      // We don't drive gameplay from it (this is a turn-based philosophical
      // duel, not a spatial sim) but we keep the latest snapshot available.
      Multiplayer.onStateSync((state) => {
        this._mpState = state;
      });

      // Host-authoritative turn-based move path. A non-host client submits
      // their answer via sendMessage('duel_answer', ...); the host validates
      // (turn ownership + game state), scores it, applies damage, and
      // publishes the new board via setGameData. All clients mirror.
      Multiplayer.onMessage('duel_answer', (data) => {
        if (!Multiplayer.isHost()) return;
        this._hostHandleAnswer(data);
      });
      Multiplayer.onGameDataUpdate((data) => {
        this._applySharedDuelState(data);
      });
      Multiplayer.onHostChange(() => {
        // Newly promoted host: no-op; shared state already in gameData.
      });

      this.ui.mpStatus.textContent = 'Online — ' + (Multiplayer.getPlayerCount() || 1) + ' player(s)';
    } catch (e) {
      this.ui.mpStatus.textContent = 'Offline mode';
    }
  }

  // Host-side: validate a submitted answer, score it, publish the result.
  // Used only when a networked duel is wired up; the local/AI modes bypass
  // this path. Kept here so the host-authoritative pattern is present.
  _hostHandleAnswer(data) {
    if (!this._mpDuel) return;
    const expectedTurn = this._mpDuel.turn;
    const sender = data.from;
    if (this._mpDuel.players[expectedTurn] !== sender) return; // not their turn
    const q = this._mpDuel.currentQuestion;
    if (!q) return;
    const philosopher = Philosophers_byId(q.philosopherId);
    const result = Evaluator.evaluate(data.text || '', philosopher, q.text);
    const target = 1 - expectedTurn;
    const damage = Math.round(result.score * 0.22);
    this._mpDuel.hp[target] = Math.max(0, this._mpDuel.hp[target] - damage);
    this._mpDuel.lastResult = { tier: result.tier, score: result.score, damage, by: sender };
    this._mpDuel.turn = target;
    Multiplayer.setGameData(this._mpDuel);
  }

  _applySharedDuelState(data) {
    if (!data) return;
    this._mpDuel = data;
  }

  async _initSaveLeaderboard() {
    try {
      if (window.SaveData) {
        this.save = await SaveData.init({
          wins: 0,
          totalScore: 0,
          brilliantHits: 0,
          leaderboard: [
            { field: 'wins', label: 'Duel Wins' },
            { field: 'totalScore', label: 'Total Score' },
            { field: 'brilliantHits', label: 'Brilliant Strikes' }
          ]
        });
      }
    } catch (e) { /* fallback: no save */ }
  }

  _cacheUI() {
    const $ = (id) => document.getElementById(id);
    this.ui = {
      menu: $('menu'),
      mpStatus: $('mp-status'),
      selectScreen: $('select-screen'),
      selectTitle: $('select-title'),
      philosGrid: $('philos-grid'),
      chosenRow: $('chosen-row'),
      confirmBtn: $('btn-confirm-philos'),
      hud: $('hud'),
      p1Name: $('p1-name'), p2Name: $('p2-name'),
      p1Philos: $('p1-philos'), p2Philos: $('p2-philos'),
      p1Hp: $('p1-hp'), p2Hp: $('p2-hp'),
      p1Combo: $('p1-combo'), p2Combo: $('p2-combo'),
      p1Ult: $('p1-ult'), p2Ult: $('p2-ult'),
      turnIndicator: $('turn-indicator'),
      timer: $('timer'),
      qPanel: $('question-panel'),
      qPhilosLabel: $('q-philos-label'),
      qTurnLabel: $('q-turn-label'),
      qText: $('q-text'),
      answerInput: $('answer-input'),
      submitBtn: $('btn-submit'),
      defendBtn: $('btn-defend'),
      evalBox: $('eval-box'),
      waitBanner: $('wait-banner'),
      victory: $('victory'),
      victoryTitle: $('victory-title'),
      victorySub: $('victory-sub'),
      rematchBtn: $('btn-rematch'),
      menuBtn: $('btn-menu'),
      soloBtn: $('btn-solo'),
      duelBtn: $('btn-duel'),
      knowledgeBtn: $('btn-knowledge'),
      tournamentBtn: $('btn-tournament')
    };
  }

  _bindUI() {
    this.ui.soloBtn.addEventListener('click', () => this._startFlow('solo'));
    this.ui.duelBtn.addEventListener('click', () => this._startFlow('duel'));
    this.ui.knowledgeBtn.addEventListener('click', () => this._startFlow('knowledge'));
    this.ui.tournamentBtn.addEventListener('click', () => this._startFlow('tournament'));
    this.ui.confirmBtn.addEventListener('click', () => this._confirmSelection());
    this.ui.submitBtn.addEventListener('click', () => this._submitAnswer());
    this.ui.defendBtn.addEventListener('click', () => this._toggleDefense());
    this.ui.rematchBtn.addEventListener('click', () => this._rematch());
    this.ui.menuBtn.addEventListener('click', () => this._toMenu());
    this.ui.answerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this._submitAnswer();
      }
    });
  }

  _resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.viewW = rect.width;
    this.viewH = rect.height;
    this._placeFighters();
  }

  _placeFighters() {
    if (!this.viewW) return;
    const groundY = this.viewH * 0.82;
    if (this.fighters[0]) {
      this.fighters[0].x = this.viewW * 0.22 - this.fighters[0].width / 2;
      this.fighters[0].y = groundY - this.fighters[0].height;
      this.fighters[0].anchorX = this.fighters[0].x;
      this.fighters[0].anchorY = this.fighters[0].y;
      this.fighters[0].setFacing(1);
    }
    if (this.fighters[1]) {
      this.fighters[1].x = this.viewW * 0.78 - this.fighters[1].width / 2;
      this.fighters[1].y = groundY - this.fighters[1].height;
      this.fighters[1].anchorX = this.fighters[1].x;
      this.fighters[1].anchorY = this.fighters[1].y;
      this.fighters[1].setFacing(-1);
    }
  }

  // -------- Flow --------

  _startFlow(mode) {
    this.mode = mode;
    this.ui.menu.classList.add('hidden');
    if (mode === 'knowledge') {
      // No opponent needed, but still pick philosophers for themed questions.
      this.selecting = { player: 0, selected: [] };
      this._showSelect('Choose 3 Philosophers (Knowledge Mode)');
    } else if (mode === 'tournament') {
      this.tournamentStage = 0;
      this.selecting = { player: 0, selected: [] };
      this._showSelect('Choose Your 3 Philosophers — Tournament');
    } else if (mode === 'duel') {
      this.selecting = { player: 0, selected: [] };
      this._showSelect('Choose 3 Philosophers — Player 1');
    } else {
      // solo
      this.selecting = { player: 0, selected: [] };
      this._showSelect('Choose 3 Philosophers — You');
    }
  }

  _showSelect(title) {
    this.ui.selectTitle.textContent = title;
    this.ui.selectScreen.classList.remove('hidden');
    this._renderPhilosophers();
    this._renderChosen();
  }

  _renderPhilosophers() {
    const grid = this.ui.philosGrid;
    grid.innerHTML = '';
    for (const p of PHILOSOPHERS) {
      const card = document.createElement('div');
      card.className = 'philos-card';
      if (this.selecting.selected.indexOf(p.id) !== -1) card.classList.add('selected');
      const port = document.createElement('canvas');
      port.className = 'portrait';
      port.width = 160; port.height = 80;
      this._paintPortrait(port.getContext('2d'), p, 160, 80);
      card.appendChild(port);
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = p.name;
      card.appendChild(name);
      const desc = document.createElement('div');
      desc.className = 'desc';
      desc.textContent = p.blurb;
      card.appendChild(desc);
      card.addEventListener('click', () => this._togglePhilos(p.id));
      grid.appendChild(card);
    }
  }

  _paintPortrait(ctx, p, w, h) {
    // background gradient of the philosopher's palette
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, p.accent);
    g.addColorStop(1, p.color);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // silhouette of a robed figure
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 1.1, w * 0.3, h * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.45, h * 0.22, 0, Math.PI * 2);
    ctx.fill();
    // name initials
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 28px Cinzel, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const initials = p.name.split(' ').map(s => s[0]).join('').substring(0, 2);
    ctx.fillText(initials, w * 0.5, h * 0.45);
  }

  _togglePhilos(id) {
    const idx = this.selecting.selected.indexOf(id);
    if (idx >= 0) this.selecting.selected.splice(idx, 1);
    else if (this.selecting.selected.length < 3) this.selecting.selected.push(id);
    this._renderPhilosophers();
    this._renderChosen();
  }

  _renderChosen() {
    const row = this.ui.chosenRow;
    row.innerHTML = '';
    for (const id of this.selecting.selected) {
      const p = Philosophers_byId(id);
      const chip = document.createElement('div');
      chip.className = 'chosen-chip';
      chip.textContent = p.name;
      row.appendChild(chip);
    }
    this.ui.confirmBtn.disabled = this.selecting.selected.length !== 3;
  }

  _confirmSelection() {
    const picked = this.selecting.selected.slice();
    if (picked.length !== 3) return;

    if (this.mode === 'duel' && this.selecting.player === 0) {
      this.rosters[0] = picked;
      this.selecting = { player: 1, selected: [] };
      this.ui.selectTitle.textContent = 'Choose 3 Philosophers — Player 2';
      this._renderPhilosophers();
      this._renderChosen();
      return;
    }

    if (this.mode === 'solo') {
      this.rosters[0] = picked;
      this.rosters[1] = this._pickAiRoster();
      this.names = ['You', 'AI Opponent'];
      this.aiSkill = this.aiBaseSkill || 0.6;
    } else if (this.mode === 'duel') {
      this.rosters[1] = picked;
      this.names = ['Player 1', 'Player 2'];
    } else if (this.mode === 'knowledge') {
      this.rosters[0] = picked;
      this.rosters[1] = picked; // mirror; no real opponent damage
      this.names = ['You', 'The Mind'];
    } else if (this.mode === 'tournament') {
      this.rosters[0] = picked;
      this._setupTournamentFoe();
      this.names = ['You', 'AI: ' + Philosophers_byId(this.tournamentOpponents[this.tournamentStage]).name];
      this.aiSkill = (this.aiBaseSkill || 0.6) - 0.2 + this.tournamentStage * 0.15;
    }

    this.ui.selectScreen.classList.add('hidden');
    this._startFight();
  }

  _pickAiRoster() {
    const pool = PHILOSOPHERS.map(p => p.id).filter(id => this.rosters[0].indexOf(id) === -1);
    const picks = [];
    while (picks.length < 3 && pool.length) {
      picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    return picks;
  }

  _setupTournamentFoe() {
    const foeId = this.tournamentOpponents[this.tournamentStage];
    const foe = Philosophers_byId(foeId);
    // Build a roster: the foe + two thematic allies
    const allies = PHILOSOPHERS.filter(p => p.id !== foeId).sort(() => Math.random() - 0.5).slice(0, 2);
    this.rosters[1] = [foe.id, allies[0].id, allies[1].id];
  }

  _startFight() {
    const hp0 = this.startingHp || 100;
    this.hp = [hp0, hp0];
    this.combo = [1, 1];
    this.ult = [0, 0];
    this.defending = [false, false];
    this.round = 1;
    this.turn = Math.random() < 0.5 ? 0 : 1;

    // Build fighters — the primary (first-chosen) philosopher is their visual
    this.fighters[0] = new Fighter(0, 0, Philosophers_byId(this.rosters[0][0]), 1);
    this.fighters[1] = new Fighter(0, 0, Philosophers_byId(this.rosters[1][0]), -1);
    this.entities = [this.fighters[0], this.fighters[1]];
    this._placeFighters();

    // HUD
    this.ui.hud.classList.remove('hidden');
    this.ui.p1Name.textContent = this.names[0];
    this.ui.p2Name.textContent = this.names[1];
    this.ui.p1Philos.textContent = this.rosters[0].map(id => Philosophers_byId(id).name).join(' · ');
    this.ui.p2Philos.textContent = this.rosters[1].map(id => Philosophers_byId(id).name).join(' · ');
    this._updateHud();

    this.state = 'fight';
    this._nextQuestion();
  }

  // -------- Combat --------

  _nextQuestion() {
    this.ui.evalBox.classList.add('hidden');
    this.ui.answerInput.value = '';
    this.ui.answerInput.disabled = false;
    this.ui.submitBtn.disabled = false;
    this.ui.defendBtn.disabled = false;

    // Who answers = whose turn. Who ASKS = opponent (their roster drives the Q)
    const answerer = this.turn;
    const asker = 1 - this.turn;
    const q = this.questionBank.pick(this.rosters[asker]);
    this.currentQuestion = q;

    this.ui.qPanel.classList.remove('hidden');
    this.ui.qPhilosLabel.textContent = q.philosopher.name + ' asks:';
    this.ui.qTurnLabel.textContent = (this.mode === 'knowledge')
      ? 'Reflect'
      : (answerer === 0 ? this.names[0] + "'s turn" : this.names[1] + "'s turn");
    this.ui.qText.textContent = q.text;
    this._updateHud();

    // If AI is answering, run it after a short "thinking" delay
    const isAiTurn = (this.mode === 'solo' || this.mode === 'tournament') && answerer === 1;
    if (isAiTurn) {
      this.ui.answerInput.disabled = true;
      this.ui.submitBtn.disabled = true;
      this.ui.defendBtn.disabled = true;
      this.ui.waitBanner.classList.remove('hidden');
      this.aiTimer = 1.6 + Math.random() * 1.2;
    } else {
      this.ui.waitBanner.classList.add('hidden');
      this.ui.answerInput.focus();
    }
  }

  _submitAnswer() {
    if (this.state !== 'fight' || this.evalLock) return;
    const text = this.ui.answerInput.value;
    // Networked duel: non-host clients send intent; host validates and
    // publishes the result. For local/AI modes this.mode is 'solo' / 'duel'
    // etc. and we resolve locally — the single device IS the authority.
    if (this.mode === 'netduel' && window.Multiplayer && !Multiplayer.isHost()) {
      Multiplayer.sendMessage('duel_answer', { text });
      return;
    }
    this._resolveAnswer(text);
  }

  _toggleDefense() {
    if (this.state !== 'fight') return;
    this.defending[this.turn] = !this.defending[this.turn];
    this.ui.defendBtn.textContent = this.defending[this.turn]
      ? '🛡 Defense READY'
      : '🛡 Defense (half damage next hit)';
  }

  _resolveAnswer(text) {
    this.evalLock = true;
    const answerer = this.turn;
    const target = 1 - this.turn;
    const q = this.currentQuestion;
    const result = Evaluator.evaluate(text, q.philosopher, q.text);

    // Base damage: score 0..100 scaled down a bit (full 100 ≈ 22 dmg, 60 ≈ 13)
    let damage = result.score * 0.22;

    // Combo multiplier (for strong+ hits)
    if (result.tier === 'strong' || result.tier === 'brilliant') {
      this.combo[answerer] = Math.min(5, this.combo[answerer] + 1);
    } else {
      this.combo[answerer] = 1;
    }
    const comboMult = 1 + (this.combo[answerer] - 1) * 0.2;
    damage *= comboMult;

    // Critical
    if (result.crit) damage *= 1.35;

    // Build ult meter
    this.ult[answerer] = Math.min(100, this.ult[answerer] + result.score * 0.35);

    // Ultimate — if full and tier >= solid, consume for an ultimate
    let isUlt = false;
    if (this.ult[answerer] >= 100 && (result.tier === 'strong' || result.tier === 'brilliant')) {
      isUlt = true;
      this.ult[answerer] = 0;
      damage *= 1.8;
    }

    // Defense from opponent halves damage
    let defended = false;
    if (this.defending[target]) {
      damage *= 0.5;
      this.defending[target] = false;
      defended = true;
    }

    damage = Math.round(damage);
    if (result.tier === 'miss') damage = 0;

    // Apply (not in Knowledge mode)
    const applyDamage = (this.mode !== 'knowledge');
    if (applyDamage) {
      this.hp[target] = Math.max(0, this.hp[target] - damage);
    }

    // Animate fighters
    const attackerFighter = this.fighters[answerer];
    const targetFighter = this.fighters[target];
    const power = Math.min(1, result.score / 100);
    if (damage > 0) {
      if (isUlt) attackerFighter.playUlt();
      else attackerFighter.playAttack(power);
      // delayed impact
      setTimeout(() => {
        if (applyDamage) {
          targetFighter.takeHit(damage);
          this._spawnDamagePopup(target, damage, isUlt, result.crit);
          if (isUlt || result.crit) this.fx.flash();
        } else {
          // knowledge mode: still show the score as a satisfying number
          this._spawnDamagePopup(target, result.score, false, false, 'learn');
        }
      }, 250);
    } else {
      // miss: little recoil animation
      attackerFighter.playAttack(0.1);
    }

    // Build eval box
    this._showEval(result, damage, { combo: comboMult, isUlt, defended });

    // Update totals
    if (this.save && answerer === 0 && this.mode !== 'knowledge') {
      this.save.totalScore += result.score;
      if (result.tier === 'brilliant') this.save.brilliantHits += 1;
    }

    this._updateHud();

    // Victory check
    if (applyDamage && (this.hp[0] <= 0 || this.hp[1] <= 0)) {
      setTimeout(() => this._endFight(), 1500);
      return;
    }

    // Pass turn after a beat
    setTimeout(() => {
      this.evalLock = false;
      // In knowledge mode we don't alternate — just keep asking
      if (this.mode !== 'knowledge') {
        this.turn = 1 - this.turn;
        this.round += 1;
      }
      this._nextQuestion();
    }, 2200);
  }

  _showEval(result, damage, extras) {
    const el = this.ui.evalBox;
    el.classList.remove('hidden');
    const tierLabel = {
      miss: 'MISS',
      weak: 'WEAK',
      solid: 'SOLID',
      strong: 'STRONG',
      brilliant: 'BRILLIANT'
    }[result.tier];
    const extraNotes = [];
    if (extras.isUlt) extraNotes.push('✦ ULTIMATE');
    if (result.crit) extraNotes.push('✦ CRITICAL');
    if (extras.combo > 1) extraNotes.push('Combo x' + extras.combo.toFixed(1));
    if (extras.defended) extraNotes.push('(Opponent defended)');
    el.innerHTML =
      '<span class="score">' + result.score + ' / 100 — ' + tierLabel + '</span>' +
      result.feedback +
      (extraNotes.length ? '<br><em style="color:#ffcc55">' + extraNotes.join(' · ') + '</em>' : '') +
      (this.mode === 'knowledge'
        ? ''
        : ('<br><strong style="color:#ff8855">Damage: ' + damage + '</strong>'));
  }

  _spawnDamagePopup(targetIdx, amount, isUlt, isCrit, variantOverride) {
    const f = this.fighters[targetIdx];
    const rect = this.canvas.getBoundingClientRect();
    const sx = rect.left + f.x + f.width / 2;
    const sy = rect.top + f.y + 20;
    const containerRect = document.getElementById('fx-layer').getBoundingClientRect();
    const popX = sx - containerRect.left;
    const popY = sy - containerRect.top;
    let variant = '';
    if (variantOverride === 'learn') variant = ''; // no color pop for knowledge
    else if (isUlt) variant = 'ult';
    else if (isCrit) variant = 'crit';
    this.fx.popup(popX, popY, (amount > 0 ? '-' : '') + amount, variant);
  }

  _updateHud() {
    this.ui.p1Hp.style.width = Math.max(0, this.hp[0]) + '%';
    this.ui.p2Hp.style.width = Math.max(0, this.hp[1]) + '%';
    this.ui.p1Combo.textContent = 'Combo x' + this.combo[0];
    this.ui.p2Combo.textContent = 'Combo x' + this.combo[1];
    this.ui.p1Ult.style.width = this.ult[0] + '%';
    this.ui.p2Ult.style.width = this.ult[1] + '%';
    this.ui.turnIndicator.textContent = (this.mode === 'knowledge')
      ? 'Knowledge'
      : ('Round ' + this.round);
  }

  _endFight() {
    this.state = 'victory';
    this.ui.qPanel.classList.add('hidden');
    this.ui.waitBanner.classList.add('hidden');

    const winner = this.hp[0] > 0 ? 0 : 1;
    const loser = 1 - winner;
    this.fighters[winner].victory();
    this.fighters[loser].state = 'ko';
    this.fighters[loser].stateT = 0;

    const titles = winner === 0 ? ['Victory!', 'Mind over might.', 'Reason triumphs.'] : ['Defeated', 'The argument did not hold.', 'Return and reason again.'];
    this.ui.victoryTitle.textContent = titles[0];
    const won = (winner === 0);
    this.ui.victorySub.textContent = won
      ? (this.mode === 'tournament' && this.tournamentStage < this.tournamentOpponents.length - 1
          ? 'You bested ' + this.names[1] + '. Next: ' + Philosophers_byId(this.tournamentOpponents[this.tournamentStage + 1]).name
          : 'You bested ' + this.names[1] + '.')
      : this.names[1] + ' outreasoned you.';

    if (this.save && won && this.mode !== 'knowledge') {
      this.save.wins += 1;
    }
    if (window.Leaderboard && Leaderboard.isAvailable()) {
      try {
        if (this.save) {
          Leaderboard.finalize('wins', this.save.wins);
          Leaderboard.finalize('score', this.save.totalScore);
        }
      } catch (e) { /* ignore */ }
    }

    // Tournament: next stage
    if (won && this.mode === 'tournament' && this.tournamentStage < this.tournamentOpponents.length - 1) {
      this.ui.rematchBtn.textContent = 'Next Opponent';
      this._tournamentContinue = true;
    } else {
      this.ui.rematchBtn.textContent = 'Rematch';
      this._tournamentContinue = false;
    }

    this.ui.victory.classList.remove('hidden');
  }

  _rematch() {
    this.ui.victory.classList.add('hidden');
    if (this._tournamentContinue) {
      this.tournamentStage += 1;
      this._setupTournamentFoe();
      this.names = ['You', 'AI: ' + Philosophers_byId(this.tournamentOpponents[this.tournamentStage]).name];
      this.aiSkill = 0.4 + this.tournamentStage * 0.15;
    }
    this._startFight();
  }

  _toMenu() {
    this.ui.victory.classList.add('hidden');
    this.ui.hud.classList.add('hidden');
    this.ui.qPanel.classList.add('hidden');
    this.entities = [];
    this.fighters = [null, null];
    this.state = 'menu';
    this.ui.menu.classList.remove('hidden');
  }

  // -------- Loop --------

  start() {
    const frame = (t) => {
      const dt = Math.min((t - this.lastTime) / 1000 || 0, 0.05);
      this.lastTime = t;
      this.update(dt);
      this.draw();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  update(dt) {
    for (const e of this.entities) if (e && e.update) e.update(dt);

    if (this.state === 'fight' && this.aiTimer > 0) {
      this.aiTimer -= dt;
      if (this.aiTimer <= 0 && !this.evalLock) {
        const q = this.currentQuestion;
        const text = Evaluator.aiAnswer(q.philosopher, q.text, this.aiSkill);
        this.ui.answerInput.value = text;
        this.ui.waitBanner.classList.add('hidden');
        this._resolveAnswer(text);
      }
    }
  }

  draw() {
    const ctx = this.ctx;
    const W = this.viewW, H = this.viewH;
    if (!W) return;

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#1a0f28');
    sky.addColorStop(0.5, '#2a1a3a');
    sky.addColorStop(1, '#4a2a3a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Moon
    const moonImg = lib.sprite('moon');
    ctx.globalAlpha = 0.95;
    ctx.drawImage(moonImg, W * 0.72, H * 0.06, 160, 160);
    ctx.globalAlpha = 1;

    // Stars
    ctx.fillStyle = 'rgba(255,240,200,0.6)';
    for (let i = 0; i < 60; i++) {
      const x = (i * 173) % W;
      const y = (i * 97) % (H * 0.5);
      const r = (i % 3) * 0.5 + 0.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Mountains
    ctx.drawImage(lib.sprite('mountains'), 0, H * 0.4, W, H * 0.35);

    // Clouds
    ctx.drawImage(lib.sprite('cloud'), W * 0.05, H * 0.18, 220, 90);
    ctx.drawImage(lib.sprite('cloud'), W * 0.45, H * 0.1, 180, 70);

    // Ground
    const ground = ctx.createLinearGradient(0, H * 0.75, 0, H);
    ground.addColorStop(0, '#2a1a1a');
    ground.addColorStop(1, '#120808');
    ctx.fillStyle = ground;
    ctx.fillRect(0, H * 0.75, W, H * 0.25);
    // Ground stone pattern
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.moveTo((W / 12) * i + ((i % 2) * 30), H * 0.78);
      ctx.lineTo((W / 12) * i + ((i % 2) * 30) + 60, H * 0.78);
      ctx.stroke();
    }

    // Columns (background architecture)
    ctx.drawImage(lib.sprite('column'), W * 0.03, H * 0.3, 60, 240 * (H / 720));
    ctx.drawImage(lib.sprite('column'), W * 0.93, H * 0.3, 60, 240 * (H / 720));
    ctx.drawImage(lib.sprite('column'), W * 0.4, H * 0.33, 50, 200 * (H / 720));
    ctx.drawImage(lib.sprite('column'), W * 0.55, H * 0.33, 50, 200 * (H / 720));

    // Braziers
    const brazFlicker = 1 + Math.sin(performance.now() / 180) * 0.08;
    ctx.save();
    ctx.scale(brazFlicker, brazFlicker);
    ctx.drawImage(lib.sprite('brazier'), (W * 0.13) / brazFlicker, (H * 0.6) / brazFlicker, 60, 90);
    ctx.drawImage(lib.sprite('brazier'), (W * 0.84) / brazFlicker, (H * 0.6) / brazFlicker, 60, 90);
    ctx.restore();

    // Draw fighters
    for (const e of this.entities) if (e && e.draw) e.draw(ctx);

    // Floor glow under each fighter in combat
    if (this.state === 'fight' || this.state === 'victory') {
      for (let i = 0; i < 2; i++) {
        const f = this.fighters[i];
        if (!f) continue;
        const active = (this.state === 'fight' && i === this.turn);
        ctx.globalAlpha = active ? 0.45 : 0.15;
        const grd = ctx.createRadialGradient(f.x + f.width / 2, f.y + f.height, 5, f.x + f.width / 2, f.y + f.height, 90);
        grd.addColorStop(0, f.color);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.ellipse(f.x + f.width / 2, f.y + f.height, 90, 20, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // Menu dim backdrop glow
    if (this.state === 'menu') {
      // Draw title silhouettes
      ctx.fillStyle = 'rgba(216,180,90,0.08)';
      ctx.font = 'bold 160px Cinzel, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ΦΔ', W / 2, H / 2);
    }
  }
}
