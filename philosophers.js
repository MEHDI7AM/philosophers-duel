// philosophers.js — the roster. Each entry contains:
//   id, name, era, blurb (short tagline), themes[] (keyword tags),
//   keywords[] (concepts the evaluator rewards), signature (quote/motif),
//   color (primary visual), accent (secondary visual),
//   questions[] (philosopher-specific prompts), ultName.
// This is DATA — read by QuestionBank and Evaluator; the roster is driven
// by this file so expanding the cast is one entry.

var PHILOSOPHERS = [
  {
    id: 'socrates', name: 'Socrates', era: 'Ancient Greece',
    blurb: 'The questioner — "I know that I know nothing."',
    color: '#d8b45a', accent: '#8a6f30',
    themes: ['virtue', 'ignorance', 'dialectic', 'ethics', 'self-knowledge'],
    keywords: ['question', 'ignorance', 'virtue', 'know', 'examine', 'wisdom', 'soul', 'dialogue', 'contradiction', 'definition', 'justice', 'good'],
    signature: 'The unexamined life is not worth living.',
    ultName: 'Socratic Elenchus',
    questions: [
      'If virtue is knowledge, why do wise people sometimes do wrong?',
      'Is it worse to commit injustice or to suffer it?',
      'Can anyone truly know what justice is, or only approach it?',
      'Does admitting ignorance make a person wiser than claiming knowledge?'
    ]
  },
  {
    id: 'plato', name: 'Plato', era: 'Ancient Greece',
    blurb: 'The world of Forms behind the world of shadows.',
    color: '#b89cff', accent: '#5a3f8a',
    themes: ['forms', 'ideal', 'reality', 'knowledge', 'justice'],
    keywords: ['form', 'ideal', 'shadow', 'cave', 'reality', 'knowledge', 'reason', 'soul', 'justice', 'truth', 'eternal', 'perfect', 'appearance'],
    signature: 'What we see is a shadow of what is.',
    ultName: 'Allegory of the Cave',
    questions: [
      'Is the chair you see more real than the idea of a chair?',
      'If prisoners in a cave only see shadows, how could they ever know the sun?',
      'Should philosophers rule, or does power corrupt wisdom?',
      'Is beauty something we discover or something we invent?'
    ]
  },
  {
    id: 'aristotle', name: 'Aristotle', era: 'Ancient Greece',
    blurb: 'Virtue is a habit — the golden mean between extremes.',
    color: '#e8a05a', accent: '#8a4820',
    themes: ['virtue', 'habit', 'ethics', 'telos', 'reason'],
    keywords: ['virtue', 'habit', 'mean', 'moderation', 'telos', 'purpose', 'function', 'flourishing', 'eudaimonia', 'character', 'practice', 'reason', 'nature'],
    signature: 'We are what we repeatedly do.',
    ultName: 'Golden Mean Strike',
    questions: [
      'Is courage the absence of fear, or something in between fear and recklessness?',
      'Does happiness come from pleasure or from fulfilling your nature?',
      'Can a person be virtuous without acting virtuously?',
      'If every thing has a purpose, what is the purpose of a human being?'
    ]
  },
  {
    id: 'nietzsche', name: 'Nietzsche', era: 'Modern',
    blurb: 'God is dead — now create your own values.',
    color: '#e04040', accent: '#6a1a1a',
    themes: ['will to power', 'eternal recurrence', 'ubermensch', 'morality', 'nihilism'],
    keywords: ['will', 'power', 'overcome', 'übermensch', 'overman', 'master', 'slave', 'morality', 'value', 'create', 'strength', 'herd', 'eternal', 'recurrence', 'god', 'dead', 'nihilism', 'affirm', 'yes', 'life'],
    signature: 'What does not kill me makes me stronger.',
    ultName: 'Will to Power',
    questions: [
      'If you had to live your exact life over and over for eternity, would you say yes to it?',
      'Is compassion a virtue, or a form of weakness that denies life?',
      'If God is dead, who creates meaning — and by what right?',
      'Is the "good" man really good, or just too timid to be dangerous?'
    ]
  },
  {
    id: 'kant', name: 'Kant', era: 'Enlightenment',
    blurb: 'Act only on principles you would make universal law.',
    color: '#6a8ad8', accent: '#2a3f6a',
    themes: ['duty', 'reason', 'categorical imperative', 'autonomy'],
    keywords: ['duty', 'universal', 'law', 'categorical', 'imperative', 'reason', 'autonomy', 'rational', 'maxim', 'end', 'means', 'dignity', 'moral', 'principle', 'free', 'will'],
    signature: 'Act so that you treat humanity always as an end.',
    ultName: 'Categorical Imperative',
    questions: [
      'Would it be wrong to lie to a murderer at your door asking where your friend is hiding?',
      'Can an action be moral if it is done for personal gain, even if it helps others?',
      'If everyone lied when convenient, could promises still exist?',
      'Is using a person — ever — compatible with respecting their humanity?'
    ]
  },
  {
    id: 'descartes', name: 'Descartes', era: 'Early Modern',
    blurb: 'I think, therefore I am. Doubt everything else.',
    color: '#aacde8', accent: '#3a5a8a',
    themes: ['doubt', 'certainty', 'mind', 'dualism', 'reason'],
    keywords: ['doubt', 'think', 'cogito', 'exist', 'mind', 'body', 'certain', 'reason', 'clear', 'distinct', 'demon', 'dream', 'self', 'consciousness', 'rational'],
    signature: 'I think, therefore I am.',
    ultName: 'Cogito Blade',
    questions: [
      'How do you know you are not dreaming right now?',
      'If an evil demon could deceive your senses, what is left that you can trust?',
      'Is your mind the same thing as your brain, or something separate?',
      'What single truth could survive radical doubt?'
    ]
  },
  {
    id: 'camus', name: 'Camus', era: 'Existentialism',
    blurb: 'Life is absurd — rebel, create, live anyway.',
    color: '#e8c080', accent: '#8a6428',
    themes: ['absurd', 'rebellion', 'meaning', 'suicide', 'sun'],
    keywords: ['absurd', 'meaning', 'meaningless', 'rebel', 'revolt', 'sisyphus', 'suicide', 'live', 'embrace', 'defiance', 'happy', 'push', 'rock', 'silence', 'universe', 'confront'],
    signature: 'One must imagine Sisyphus happy.',
    ultName: 'Revolt of Sisyphus',
    questions: [
      'If the universe is silent and life is absurd, why not end it?',
      'Can a person be happy pushing the same rock up the same hill forever?',
      'Does meaning have to come from somewhere, or can we live without it?',
      'Is suicide a philosophical answer to absurdity, or a surrender to it?'
    ]
  },
  {
    id: 'kierkegaard', name: 'Kierkegaard', era: 'Existentialism',
    blurb: 'Faith is a leap into the unknown.',
    color: '#8a6ad8', accent: '#3a2a6a',
    themes: ['faith', 'anxiety', 'subjectivity', 'leap', 'individual'],
    keywords: ['faith', 'leap', 'anxiety', 'dread', 'subjective', 'individual', 'passion', 'absurd', 'god', 'commit', 'choice', 'despair', 'self', 'infinite', 'eternal', 'inward'],
    signature: 'Anxiety is the dizziness of freedom.',
    ultName: 'Leap of Faith',
    questions: [
      'Is faith reasonable, or must it be a leap beyond reason?',
      'If you could prove God existed, would faith still have any meaning?',
      'Why does freedom cause anxiety rather than joy?',
      'Can a person live truthfully without passionately committing to something uncertain?'
    ]
  },
  {
    id: 'spinoza', name: 'Spinoza', era: 'Early Modern',
    blurb: 'God and nature are one. Understand, and be free.',
    color: '#5ac8a0', accent: '#1a6a4a',
    themes: ['substance', 'determinism', 'freedom', 'nature', 'understanding'],
    keywords: ['substance', 'god', 'nature', 'cause', 'necessity', 'determined', 'understand', 'conatus', 'passion', 'reason', 'free', 'adequate', 'idea', 'joy', 'eternity', 'one'],
    signature: 'Deus sive natura — God, or nature.',
    ultName: 'Geometric Necessity',
    questions: [
      'If every event has a cause, in what sense can anyone be free?',
      'Is God a person who watches over us, or the whole order of nature?',
      'Can understanding why you feel sad make the sadness itself change?',
      'If everything had to happen the way it did, how should that change how you live?'
    ]
  },
  {
    id: 'confucius', name: 'Confucius', era: 'Ancient China',
    blurb: 'Cultivate ren — human-heartedness through ritual.',
    color: '#e85a7a', accent: '#8a2a4a',
    themes: ['ren', 'ritual', 'relationship', 'harmony', 'virtue'],
    keywords: ['ren', 'humaneness', 'ritual', 'li', 'virtue', 'harmony', 'family', 'relationship', 'duty', 'cultivate', 'junzi', 'exemplary', 'respect', 'tradition', 'society', 'order'],
    signature: 'What you do not wish for yourself, do not do to others.',
    ultName: 'Rectification of Names',
    questions: [
      'Does living well mean fulfilling your role in family and society, or defining yourself apart from them?',
      'Can rituals and manners actually shape character, or are they empty forms?',
      'If a ruler is corrupt, do subjects still owe them loyalty?',
      'Is harmony with others the same as agreeing with them?'
    ]
  },
  {
    id: 'laotzu', name: 'Lao Tzu', era: 'Ancient China',
    blurb: 'The Tao that can be spoken is not the eternal Tao.',
    color: '#80d8c0', accent: '#2a6a5a',
    themes: ['tao', 'wuwei', 'nature', 'simplicity', 'softness'],
    keywords: ['tao', 'way', 'wuwei', 'non-action', 'effortless', 'water', 'soft', 'yield', 'nature', 'simple', 'empty', 'unnamed', 'flow', 'spontaneous', 'return'],
    signature: 'Water is soft, yet it carves stone.',
    ultName: 'Flow of the Tao',
    questions: [
      'Can you achieve more by doing less?',
      'Why does water, the softest thing, overcome what is hard?',
      'If naming something distorts it, how should we speak of the deepest things?',
      'Is striving for virtue itself a form of losing it?'
    ]
  },
  {
    id: 'hume', name: 'Hume', era: 'Enlightenment',
    blurb: 'Reason is — and ought only to be — the slave of the passions.',
    color: '#c8a088', accent: '#6a4a2a',
    themes: ['empiricism', 'skepticism', 'causation', 'passion', 'self'],
    keywords: ['impression', 'idea', 'habit', 'custom', 'cause', 'experience', 'passion', 'reason', 'skeptic', 'self', 'bundle', 'is', 'ought', 'induction', 'sympathy'],
    signature: 'You cannot derive an ought from an is.',
    ultName: 'Bundle of Perceptions',
    questions: [
      'When billiard balls strike, do you see causation — or just one event followed by another?',
      'If you look inward, do you find a "self" — or only a bundle of changing feelings?',
      'Can you derive what we ought to do from what simply is?',
      'Is tomorrow\'s sunrise rationally certain, or merely a strong habit of expectation?'
    ]
  }
];

function Philosophers_byId(id) {
  for (var i = 0; i < PHILOSOPHERS.length; i++) if (PHILOSOPHERS[i].id === id) return PHILOSOPHERS[i];
  return null;
}

function Philosophers_all() { return PHILOSOPHERS.slice(); }
