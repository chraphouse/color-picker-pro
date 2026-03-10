document.addEventListener('DOMContentLoaded', async () => {
  await loadHistory();
  setupListeners();
});

let history = [];

function setupListeners() {
  document.getElementById('pickBtn').addEventListener('click', pickColor);
  document.getElementById('clearHistory').addEventListener('click', clearHistory);

  // Click to copy format values
  document.querySelectorAll('.format-value').forEach(el => {
    el.addEventListener('click', () => {
      navigator.clipboard.writeText(el.textContent);
      el.classList.add('copied');
      showToast('Copied: ' + el.textContent);
      setTimeout(() => el.classList.remove('copied'), 1000);
    });
  });

  // Manual input
  const manualInput = document.getElementById('manualInput');
  manualInput.addEventListener('input', () => {
    const color = parseColor(manualInput.value.trim());
    if (color) {
      document.getElementById('manualSwatch').style.background = manualInput.value.trim();
      showColor(color.r, color.g, color.b);
    }
  });

  manualInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const color = parseColor(manualInput.value.trim());
      if (color) {
        addToHistory(color.r, color.g, color.b);
      }
    }
  });
}

async function pickColor() {
  try {
    // Use EyeDropper API — available in Chrome 95+
    const eyeDropper = new EyeDropper();
    const result = await eyeDropper.open();
    const hex = result.sRGBHex;
    const { r, g, b } = hexToRgb(hex);

    showColor(r, g, b);
    addToHistory(r, g, b);
  } catch (e) {
    // User cancelled or API not available
    if (e.name !== 'AbortError') {
      // Fallback: use a color input
      const input = document.createElement('input');
      input.type = 'color';
      input.addEventListener('input', () => {
        const { r, g, b } = hexToRgb(input.value);
        showColor(r, g, b);
        addToHistory(r, g, b);
      });
      input.click();
    }
  }
}

function showColor(r, g, b) {
  const hex = rgbToHex(r, g, b);
  const hsl = rgbToHsl(r, g, b);

  document.getElementById('colorPreview').style.background = hex;
  document.getElementById('hexValue').textContent = hex;
  document.getElementById('rgbValue').textContent = `rgb(${r}, ${g}, ${b})`;
  document.getElementById('hslValue').textContent = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
  document.getElementById('currentSection').classList.add('show');
}

async function addToHistory(r, g, b) {
  const hex = rgbToHex(r, g, b);

  // Remove duplicate if exists
  history = history.filter(c => c !== hex);
  history.unshift(hex);

  // Keep max 24
  if (history.length > 24) history.pop();

  await chrome.storage.local.set({ colorHistory: history });
  renderHistory();
}

async function loadHistory() {
  const result = await chrome.storage.local.get('colorHistory');
  history = result.colorHistory || [];
  renderHistory();
}

function renderHistory() {
  const grid = document.getElementById('historyGrid');
  if (history.length === 0) {
    grid.innerHTML = '<div class="empty-history">No colors picked yet</div>';
    return;
  }

  grid.innerHTML = history.map(hex =>
    `<div class="history-swatch" style="background:${hex}" data-hex="${hex}" title="${hex}"></div>`
  ).join('');

  grid.querySelectorAll('.history-swatch').forEach(el => {
    el.addEventListener('click', () => {
      const hex = el.dataset.hex;
      const { r, g, b } = hexToRgb(hex);
      showColor(r, g, b);
      navigator.clipboard.writeText(hex);
      showToast('Copied: ' + hex);
    });
  });
}

async function clearHistory() {
  history = [];
  await chrome.storage.local.set({ colorHistory: [] });
  renderHistory();
}

// Color conversion utilities
function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  return {
    r: parseInt(hex.substr(0, 2), 16),
    g: parseInt(hex.substr(2, 2), 16),
    b: parseInt(hex.substr(4, 2), 16),
  };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function parseColor(str) {
  // Try hex
  if (/^#?[0-9a-f]{3,6}$/i.test(str)) {
    return hexToRgb(str.replace('#', ''));
  }
  // Try rgb()
  const rgbMatch = str.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return { r: +rgbMatch[1], g: +rgbMatch[2], b: +rgbMatch[3] };
  }
  // Try hsl()
  const hslMatch = str.match(/hsl\(\s*(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?/i);
  if (hslMatch) {
    return hslToRgb(+hslMatch[1], +hslMatch[2], +hslMatch[3]);
  }
  return null;
}

function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1500);
}
