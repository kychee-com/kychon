// admin-editor.js — Inline editing for admins
// Loaded dynamically only when user role is admin

import { patch } from './api.js?v=5';

const API = window.__WILDLYCHEE_API || 'https://api.run402.com';
const ANON_KEY = window.__WILDLYCHEE_ANON_KEY || '';

// --- Simple text editing via contenteditable ---
function initEditableText() {
  document.querySelectorAll('[data-editable]').forEach((el) => {
    el.addEventListener('click', () => {
      el.contentEditable = 'true';
      el.focus();
    });

    el.addEventListener('blur', async () => {
      el.contentEditable = 'false';
      const [table, id, field] = el.dataset.editable.split('.');
      if (!table || !id || !field) return;
      try {
        await patch(`${table}?id=eq.${id}`, { [field]: el.textContent.trim() });
      } catch (e) {
        console.error('Save failed:', e);
      }
    });

    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        el.blur();
      }
    });
  });
}

// --- Rich text editing via Tiptap ---
let tiptapLoaded = false;
let Editor, StarterKit, _Placeholder;

async function loadTiptap() {
  if (tiptapLoaded) return;
  try {
    const core = await import('https://esm.sh/@tiptap/core@2');
    const starter = await import('https://esm.sh/@tiptap/starter-kit@2');
    Editor = core.Editor;
    StarterKit = starter.default || starter.StarterKit;
    tiptapLoaded = true;
  } catch (e) {
    console.error('Failed to load Tiptap:', e);
  }
}

function initEditableRich() {
  document.querySelectorAll('[data-editable-rich]').forEach((el) => {
    let editor = null;

    el.addEventListener('click', async () => {
      if (editor) return;
      await loadTiptap();
      if (!Editor) return;

      const originalContent = el.innerHTML;
      editor = new Editor({
        element: el,
        extensions: [StarterKit],
        content: originalContent,
        onBlur: async () => {
          const [table, id, field] = el.dataset.editableRich.split('.');
          if (!table || !id || !field) return;
          const html = editor.getHTML();
          try {
            await patch(`${table}?id=eq.${id}`, { [field]: html });
          } catch (e) {
            console.error('Rich text save failed:', e);
          }
          editor.destroy();
          editor = null;
        },
      });
    });
  });
}

// --- Image editing via click-to-upload ---
function initEditableImage() {
  document.querySelectorAll('[data-editable-image]').forEach((el) => {
    el.style.cursor = 'pointer';

    el.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.addEventListener('change', async () => {
        const file = input.files[0];
        if (!file) return;
        const storagePath = el.dataset.editableImage;
        const session = JSON.parse(localStorage.getItem('wl_session') || '{}');

        try {
          const formData = new FormData();
          formData.append('file', file);
          const res = await fetch(`${API}/storage/v1/upload/${storagePath}`, {
            method: 'POST',
            headers: {
              apikey: ANON_KEY,
              Authorization: `Bearer ${session.access_token}`,
            },
            body: formData,
          });
          if (res.ok) {
            const data = await res.json();
            const img = el.tagName === 'IMG' ? el : el.querySelector('img');
            if (img) img.src = data.url || `/storage/${storagePath}`;
          }
        } catch (e) {
          console.error('Image upload failed:', e);
        }
      });
      input.click();
    });
  });
}

// --- Init all ---
initEditableText();
initEditableRich();
initEditableImage();
