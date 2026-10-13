// Evaluator.js — scores a player's answer against the asking philosopher's
// conceptual framework. We don't have real LLM here, so we use a weighted
// heuristic that rewards:
//   • coverage of the philosopher's KEYWORDS and THEMES (concept match)
//   • reasoning length & structure (depth, not fluff)
//   • logical/argument markers ("because", "if…then", "therefore")
//   • use of concrete examples ("for example", "like", "such as")
//   • addressing the question (keyword overlap with the prompt)
// Returns { score (0..100), tier ('miss'|'weak'|'solid'|'strong'|'brilliant'),
//           crit, feedback }.
// This is deliberately generous for short-but-insightful answers and
// penalizes keyword-stuffing without reasoning.

class Evaluator {
  static evaluate(answer, philosopher, questionText) {
    const raw = (answer || '').trim();
    if (!raw) return this._pack(0, 'You said nothing. Silence is not an argument.', philosopher);

    const lower = raw.toLowerCase();
    const words = lower.split(/\s+/).filter(Boolean);
    const wc = words.length;

    // Too short -> cannot be good
    if (wc < 3) return this._pack(6 + Math.floor(Math.random() * 6),
      'Too brief to be a real argument.', philosopher);

    // Concept match: keywords of the philosopher
    let conceptHits = 0;
    const matchedConcepts = [];
    for (const k of philosopher.keywords) {
      if (lower.indexOf(k.toLowerCase()) !== -1) {
        conceptHits++;
        matchedConcepts.push(k);
      }
    }
    const conceptScore = Math.min(35, conceptHits * 7);

    // Reasoning markers
    const reasoningWords = ['because', 'therefore', 'thus', 'hence', 'since',
      'if', 'then', 'implies', 'follows', 'reason', 'argue', 'suppose',
      'however', 'yet', 'although', 'but', 'on the other hand', 'conversely'];
    let reasoningHits = 0;
    for (const r of reasoningWords) if (lower.indexOf(r) !== -1) reasoningHits++;
    const reasoningScore = Math.min(20, reasoningHits * 4);

    // Example / illustration
    const exampleWords = ['example', 'like', 'such as', 'imagine', 'suppose', 'consider', 'for instance'];
    let exampleHits = 0;
    for (const e of exampleWords) if (lower.indexOf(e) !== -1) exampleHits++;
    const exampleScore = Math.min(10, exampleHits * 5);

    // Depth: length within reason (bonus up to 20 for a solid paragraph,
    // but keyword-stuffed walls of text are capped)
    let depthScore;
    if (wc < 8) depthScore = wc * 1.2;
    else if (wc < 20) depthScore = 10 + (wc - 8) * 0.6;
    else if (wc < 60) depthScore = 17 + (wc - 20) * 0.1;
    else depthScore = 21 + Math.min(3, (wc - 60) * 0.05);
    depthScore = Math.min(20, depthScore);

    // Question-addressing: overlap of significant question words with answer
    const qWords = (questionText || '').toLowerCase()
      .replace(/[^a-z\s]/g, ' ').split(/\s+/)
      .filter(w => w.length > 4 && !['would', 'could', 'should', 'their', 'there', 'where', 'which', 'about'].includes(w));
    let qHits = 0;
    for (const qw of qWords) if (lower.indexOf(qw) !== -1) qHits++;
    const addressScore = Math.min(15, qHits * 3);

    let total = conceptScore + reasoningScore + exampleScore + depthScore + addressScore;
    // Small randomness to avoid identical runs
    total += Math.floor(Math.random() * 5);
    // Soft cap and floor
    total = Math.max(0, Math.min(100, total));

    // Critical hit: strong concept + reasoning + decent length
    const crit = conceptHits >= 2 && reasoningHits >= 2 && wc >= 15 && total >= 70;
    if (crit) total = Math.min(100, total + 8);

    return this._pack(total, null, philosopher, {
      conceptHits, matchedConcepts, reasoningHits, exampleHits, qHits, wc, crit
    });
  }

  static _pack(score, forcedFeedback, philosopher, info) {
    let tier;
    if (score < 20) tier = 'miss';
    else if (score < 40) tier = 'weak';
    else if (score < 65) tier = 'solid';
    else if (score < 85) tier = 'strong';
    else tier = 'brilliant';

    let feedback = forcedFeedback;
    if (!feedback) feedback = this._buildFeedback(tier, philosopher, info);

    return { score: Math.round(score), tier, crit: !!(info && info.crit), feedback };
  }

  static _buildFeedback(tier, philosopher, info) {
    const name = philosopher.name;
    const concepts = (info && info.matchedConcepts.length)
      ? info.matchedConcepts.slice(0, 3).join(', ')
      : null;

    const openings = {
      miss: [
        `${name} is unmoved. Your answer wanders from the question.`,
        `A hollow swing. ${name}'s framework barely surfaces.`,
        `No ${name} in that — just assertion without argument.`
      ],
      weak: [
        `${name} notes a glimmer${concepts ? ' ("' + concepts + '")' : ''}, but little reasoning.`,
        `Partial — you touch the topic but don't press it.`,
        `${name} would ask: and WHY?`
      ],
      solid: [
        `A real argument. ${concepts ? '"' + concepts + '" is the right territory.' : ''} More reasoning would land harder.`,
        `${name} nods. You address the question, with some force.`,
        `Grounded. The reasoning tracks, if briefly.`
      ],
      strong: [
        `${name} is pleased: concept${concepts ? ' (' + concepts + ')' : ''} + argument + example.`,
        `Well-reasoned. You bring ${name}'s framework to bear on the problem.`,
        `This is how ${name} would want it argued.`
      ],
      brilliant: [
        `${name} would sign this. Concept, argument, and insight converge.`,
        `A philosophical strike. You don't just quote ${name} — you think with ${name}.`,
        `Masterful. The reasoning is coherent, concrete, and faithful to ${name}'s spirit.`
      ]
    };
    const pool = openings[tier];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // AI opponent — generates a plausible answer at a target skill level (0..1).
  static aiAnswer(philosopher, questionText, skill) {
    const kws = philosopher.keywords;
    const take = Math.max(1, Math.round(skill * 3 + Math.random() * 2));
    const picked = [];
    const pool = kws.slice();
    for (let i = 0; i < take && pool.length; i++) {
      picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    const connectors = ['because', 'therefore', 'however', 'suppose', 'if then'];
    const useReason = Math.random() < 0.4 + skill * 0.5;
    const useExample = Math.random() < 0.2 + skill * 0.4;
    const parts = [];
    parts.push(this._stub(philosopher, picked));
    if (useReason) parts.push(connectors[Math.floor(Math.random() * connectors.length)] + ' ' + this._stub(philosopher, picked));
    if (useExample) parts.push('for example, ' + this._example(philosopher));
    // Low-skill AI shortens / strips reasoning
    if (skill < 0.35) return picked[0] || 'maybe';
    return parts.join(' ');
  }

  static _stub(p, picked) {
    const templates = [
      `the ${picked[0] || p.themes[0]} is central here`,
      `${p.name} would argue that ${picked[0] || p.themes[0]} shapes everything`,
      `we must consider ${picked[0] || p.themes[0]} and ${picked[1] || p.themes[1] || 'reason'}`,
      `the question turns on ${picked[0] || p.themes[0]}`
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  static _example(p) {
    const egs = {
      socrates: 'imagine a man certain he is wise',
      nietzsche: 'consider a herd that fears the exception',
      camus: 'picture Sisyphus smiling at the stone',
      kant: 'imagine a world where everyone lied freely',
      kierkegaard: 'think of Abraham on the mountain',
      descartes: 'suppose a demon deceives all your senses',
      plato: 'think of prisoners who have only seen shadows',
      aristotle: 'consider the brave man between coward and reckless',
      spinoza: 'imagine every event as a necessary ripple',
      confucius: 'consider a son who honors his parent in deed',
      laotzu: 'water that wears down stone without effort',
      hume: 'two billiard balls — do you see the cause itself?'
    };
    return egs[p.id] || 'the matter at hand';
  }
}
