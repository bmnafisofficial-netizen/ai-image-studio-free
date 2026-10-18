import { createIcons, icons } from 'https://cdn.jsdelivr.net/npm/lucide@latest/+esm';

const $ = (id) => document.getElementById(id);
const promptBox = $('ai-prompt'), generateBtn = $('ai-generate'), statusEl = $('ai-status');
const result = $('ai-result'), empty = $('empty'), loading = $('loading'), actions = $('actions');
const historyEl = $('history');
const refreshIcons = () => createIcons({ icons });

const STYLES = [
  { id: 'none', label: 'None', suffix: '' },
  { id: 'photo', label: 'Photo', suffix: ', photorealistic, high detail, natural lighting' },
  { id: 'cinematic', label: 'Cinematic', suffix: ', cinematic lighting, dramatic, film still' },
  { id: 'anime', label: 'Anime', suffix: ', anime style, vibrant colors' },
  { id: 'watercolor', label: 'Watercolor', suffix: ', watercolor painting, soft textures' },
  { id: '3d', label: '3D Render', suffix: ', 3D render, octane, studio lighting' },
  { id: 'pixel', label: 'Pixel Art', suffix: ', pixel art, retro 16-bit' },
];
const IDEAS = [
  'A beautiful village in Bangladesh at sunset, cinematic lighting',
  'A cozy cabin in a snowy forest at night with warm glowing windows',
  'A futuristic city floating above the clouds, golden hour',
  'A cat astronaut exploring a colorful alien planet',
  'An underwater temple surrounded by glowing jellyfish',
  'A bustling night market with lanterns and street food stalls',
  'A lighthouse on a cliff during a stormy sea',
];

let style = 'none';
let current = null; // { src, prompt, full }
const history = [];

// Style chips
$('styles').innerHTML = STYLES.map(s =>
  `<button class="chip h-8 px-3 rounded-full border border-white/10 text-sm text-slate-300 hover:bg-white/5 transition" data-style="${s.id}" aria-pressed="${s.id === style}">${s.label}</button>`
).join('');
$('styles').addEventListener('click', e => {
  const b = e.target.closest('[data-style]'); if (!b) return;
  style = b.dataset.style;
  document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c.dataset.style === style));
});

// Prompt helpers
const updateCount = () => $('char-count').textContent = `${promptBox.value.length} / 1000`;
promptBox.addEventListener('input', updateCount);
promptBox.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generate(); });
$('clear-prompt').onclick = () => { promptBox.value = ''; updateCount(); promptBox.focus(); };
$('surprise').onclick = () => {
  let idea; do { idea = IDEAS[Math.floor(Math.random() * IDEAS.length)]; } while (idea === promptBox.value && IDEAS.length > 1);
  promptBox.value = idea; updateCount();
};

// Free public image service (Pollinations.ai) \u2014 no account or API key required for visitors.
const IMAGE_ENDPOINT = 'https://image.pollinations.ai/prompt/';
const TIMEOUT_MS = 120000;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => { img.onload = img.onerror = null; reject(new Error('The free image service took too long. Please try again.')); }, TIMEOUT_MS);
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); reject(new Error('The free image service is busy right now. Wait a few seconds and try again.')); };
    img.src = url;
  });
}

function buildUrl(fullPrompt, seed) {
  const params = new URLSearchParams({ width: '1024', height: '1024', seed: String(seed), nologo: 'true' });
  return IMAGE_ENDPOINT + encodeURIComponent(fullPrompt) + '?' + params;
}

async function requestImage(fullPrompt) {
  const seed = Math.floor(Math.random() * 1e9);
  try {
    return (await loadImage(buildUrl(fullPrompt, seed))).src;
  } catch {
    // One automatic retry \u2014 the anonymous tier sometimes rejects bursts.
    await new Promise(r => setTimeout(r, 4000));
    return (await loadImage(buildUrl(fullPrompt, seed + 1))).src;
  }
}

function setStatus(msg, tone = 'muted') {
  statusEl.textContent = msg;
  statusEl.className = 'text-sm text-center min-h-[1.25rem] ' +
    (tone === 'error' ? 'text-rose-400' : tone === 'ok' ? 'text-emerald-400' : 'text-slate-400');
}

function show(item) {
  current = item;
  empty.classList.add('hidden');
  loading.classList.add('hidden'); loading.classList.remove('flex');
  result.classList.remove('hidden'); result.classList.add('flex');
  const img = document.createElement('img');
  img.src = item.src; img.alt = item.prompt;
  img.className = 'max-w-full max-h-full object-contain cursor-zoom-in';
  img.onclick = openLightbox;
  result.replaceChildren(img);
  actions.classList.remove('hidden'); actions.classList.add('flex');
  $('current-prompt').textContent = item.prompt;
  renderHistory();
}

function renderHistory() {
  $('history-empty').classList.toggle('hidden', history.length > 0);
  $('clear-history').classList.toggle('hidden', history.length === 0);
  historyEl.innerHTML = '';
  history.forEach((h, i) => {
    const b = document.createElement('button');
    b.className = 'aspect-square rounded-lg overflow-hidden border-2 transition ' + (h === current ? 'border-violet-500' : 'border-transparent hover:border-white/20');
    b.title = h.prompt;
    const img = document.createElement('img');
    img.src = h.src; img.alt = h.prompt; img.className = 'w-full h-full object-cover';
    b.appendChild(img);
    b.onclick = () => show(history[i]);
    historyEl.appendChild(b);
  });
}
$('clear-history').onclick = () => { history.length = 0; renderHistory(); };

async function generate(basePrompt) {
  const prompt = (typeof basePrompt === 'string' ? basePrompt : promptBox.value).trim();
  if (!prompt) { setStatus('Please enter an image description first.', 'error'); promptBox.focus(); return; }
  if (generateBtn.disabled) return;

  const styleObj = STYLES.find(s => s.id === style);
  const full = prompt + (styleObj?.suffix || '');

  generateBtn.disabled = true;
  generateBtn.querySelector('span').textContent = 'Generating…';
  empty.classList.add('hidden');
  result.classList.add('hidden'); result.classList.remove('flex');
  loading.classList.remove('hidden'); loading.classList.add('flex');
  actions.classList.add('hidden'); actions.classList.remove('flex');
  setStatus('Generating… this can take up to a minute on the free service.');

  try {
    const src = await requestImage(full);
    const item = { src, prompt, full, style };
    history.unshift(item);
    if (history.length > 24) history.pop();
    show(item);
    setStatus('Your image is ready!', 'ok');
  } catch (err) {
    loading.classList.add('hidden'); loading.classList.remove('flex');
    if (current) show(current); else empty.classList.remove('hidden');
    setStatus('Could not generate image: ' + (err?.message || err?.error?.message || 'please try again.'), 'error');
  } finally {
    generateBtn.disabled = false;
    generateBtn.querySelector('span').textContent = 'Generate image';
  }
}
generateBtn.onclick = () => generate();
$('regen').onclick = () => current && generate(current.prompt);
$('reuse').onclick = () => { if (!current) return; promptBox.value = current.prompt; updateCount(); promptBox.focus(); };

// Download
$('ai-download').onclick = async () => {
  if (!current) return;
  const name = (current.prompt.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40).replace(/^-|-$/g, '') || 'ai-image') + '.jpg';
  try {
    const res = await fetch(current.src);
    if (!res.ok) throw new Error();
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    setStatus('Download started!', 'ok');
  } catch {
    window.open(current.src, '_blank', 'noopener');
    setStatus('Image opened in a new tab — right-click it and choose "Save image as".');
  }
};

// Lightbox
function openLightbox() {
  if (!current) return;
  $('lb-img').src = current.src;
  $('lightbox').classList.remove('hidden'); $('lightbox').classList.add('flex');
}
function closeLightbox() { $('lightbox').classList.add('hidden'); $('lightbox').classList.remove('flex'); }
$('open').onclick = openLightbox;
$('lb-close').onclick = closeLightbox;
$('lightbox').onclick = e => { if (e.target.id === 'lightbox') closeLightbox(); };
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

refreshIcons();
renderHistory();
