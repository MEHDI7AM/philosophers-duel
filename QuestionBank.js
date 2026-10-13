// QuestionBank.js — picks philosophy questions. We weight the pool toward
// philosophers chosen by the ASKER (the philosopher who "throws" the question
// at the opponent — the opponent must reason within THEIR framework).

class QuestionBank {
  constructor() {
    this.recent = []; // last N question strings, to avoid repeats
    this.maxRecent = 20;
  }

  // Returns { text, philosopher } — the philosopher is the one whose framework
  // the question is drawn from. Picks from `philosopherIds` (the asker's roster).
  pick(philosopherIds) {
    const pool = [];
    const roster = (philosopherIds && philosopherIds.length)
      ? philosopherIds
      : PHILOSOPHERS.map(p => p.id);

    for (const id of roster) {
      const p = Philosophers_byId(id);
      if (!p) continue;
      for (const q of p.questions) pool.push({ text: q, philosopher: p });
    }

    // Filter out recently used (if possible)
    let candidates = pool.filter(q => this.recent.indexOf(q.text) === -1);
    if (!candidates.length) candidates = pool;

    const choice = candidates[Math.floor(Math.random() * candidates.length)];
    this.recent.push(choice.text);
    if (this.recent.length > this.maxRecent) this.recent.shift();
    return choice;
  }
}
