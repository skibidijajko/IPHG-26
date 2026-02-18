let currentBoard = 'general';
let currentThreadId = null;
const emojiList = ['👍', '😂', '😢', '🔥', '💀', '🤔', '❤️', '😡', '👀'];

// Zmienna do przechowywania aktualnego posta dla pickera
let activePostId = null;

async function loadThreads() {
  const res = await fetch(`/api/${currentBoard}`);
  const threads = await res.json();

  const container = document.getElementById('thread-list');
  container.innerHTML = '';

  threads.forEach(thread => {
    const first = thread.posts[0];
    const div = document.createElement('div');
    div.className = 'thread';
    div.innerHTML = `
      <strong>${escapeHtml(thread.title)}</strong><br>
      ${first.image ? `<img src="${first.image}" alt="">` : ''}
      <small>${thread.posts.length} replies • ${new Date(thread.created).toLocaleString()}</small><br>
      <span>${escapeHtml(first.comment.substring(0,100))}${first.comment.length > 100 ? '...' : ''}</span>
    `;
    div.onclick = () => openThread(thread.id);
    container.appendChild(div);
  });

  document.getElementById('current-board-name').textContent = `/${currentBoard}/`;
}

async function openThread(id) {
  currentThreadId = id;
  const res = await fetch(`/api/${currentBoard}/${id}`);
  const thread = await res.json();

  document.getElementById('thread-list-section').classList.add('hidden');
  document.getElementById('new-thread-form').classList.add('hidden');
  document.getElementById('thread-view').classList.remove('hidden');

  document.getElementById('view-thread-title').textContent = thread.title;

  const postsDiv = document.getElementById('posts');
  postsDiv.innerHTML = '';

  thread.posts.forEach(p => {
    const postDiv = document.createElement('div');
    postDiv.className = 'post';
    postDiv.innerHTML = `
      <div class="meta">Anonymous • ${new Date(p.time).toLocaleTimeString()}</div>
      ${p.image ? `<img src="${p.image}" alt="">` : ''}
      <div>${escapeHtml(p.comment).replace(/\n/g, '<br>')}</div>
      <div class="reactions">
        ${Object.entries(p.reactions || {}).map(([e, c]) => `
          <button class="reaction-btn" data-emoji="${e}" data-post-id="${p.id}">
            ${e} <span class="count">${c}</span>
          </button>
        `).join('')}
        <!-- Przycisk otwierający picker -->
        <button class="emoji-toggle" data-post-id="${p.id}">Emoji</button>
      </div>
    `;
    postsDiv.appendChild(postDiv);
  });

  // Dodajemy obsługę kliknięć w istniejące reakcje
  document.querySelectorAll('.reaction-btn:not(.emoji-toggle)').forEach(btn => {
    btn.addEventListener('click', () => {
      sendReaction(btn.dataset.emoji, btn.dataset.postId);
    });
  });

  // Dodajemy obsługę przycisku "Emoji"
  document.querySelectorAll('.emoji-toggle').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation(); // zapobiega propagacji do innych elementów
      activePostId = btn.dataset.postId;

      const picker = document.getElementById('emoji-picker');
      const rect = btn.getBoundingClientRect();

      picker.style.left = `${rect.left + window.scrollX}px`;
      picker.style.top = `${rect.bottom + window.scrollY + 6}px`;

      picker.classList.remove('hidden');
    });
  });
}

// Funkcja wysyłająca reakcję
async function sendReaction(emoji, postId) {
  if (!emojiList.includes(emoji)) return; // tylko z listy

  try {
    const res = await fetch(`/api/${currentBoard}/${currentThreadId}/${postId}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji })
    });

    if (res.ok) {
      openThread(currentThreadId); // odśwież wątek
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to add reaction');
    }
  } catch (err) {
    console.error('Reaction error:', err);
  }
}

// Zamykanie pickera po kliknięciu poza nim
document.addEventListener('click', e => {
  const picker = document.getElementById('emoji-picker');
  if (picker && !picker.contains(e.target) && !e.target.classList.contains('emoji-toggle')) {
    picker.classList.add('hidden');
  }
});

// Obsługa kliknięcia emoji w pickerze (dodaj to raz na końcu)
document.querySelectorAll('#emoji-picker button').forEach(btn => {
  btn.addEventListener('click', async () => {
    if (!activePostId) return;
    const emoji = btn.dataset.emoji;
    await sendReaction(emoji, activePostId);
    document.getElementById('emoji-picker').classList.add('hidden');
  });
});

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]);
}

// Nawigacja boardów
document.querySelectorAll('#boards a').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    document.querySelectorAll('#boards a').forEach(el => el.classList.remove('active'));
    a.classList.add('active');
    currentBoard = a.dataset.board;
    currentThreadId = null;
    document.getElementById('thread-view').classList.add('hidden');
    document.getElementById('new-thread-form').classList.add('hidden');
    document.getElementById('thread-list-section').classList.remove('hidden');
    loadThreads();
  });
});

// Nowy wątek
document.getElementById('new-thread-btn').onclick = () => {
  document.getElementById('thread-list-section').classList.add('hidden');
  document.getElementById('new-thread-form').classList.remove('hidden');
  document.getElementById('form-board').textContent = currentBoard;
};

document.getElementById('create-thread').onclick = async () => {
  const title = document.getElementById('thread-title').value.trim();
  const comment = document.getElementById('thread-comment').value.trim();
  const file = document.getElementById('thread-image').files[0];

  if (!title || !comment) return alert('Title and comment required');

  const formData = new FormData();
  formData.append('title', title);
  formData.append('comment', comment);
  if (file) formData.append('image', file);

  try {
    const res = await fetch(`/api/${currentBoard}/thread`, { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    loadThreads();
    document.getElementById('new-thread-form').classList.add('hidden');
    document.getElementById('thread-list-section').classList.remove('hidden');
    document.getElementById('thread-title').value = '';
    document.getElementById('thread-comment').value = '';
    document.getElementById('thread-image').value = '';
    document.getElementById('thread-image-preview').innerHTML = '';
  } catch (err) {
    alert(err.message);
  }
};

document.getElementById('cancel-new-thread').onclick = () => {
  document.getElementById('new-thread-form').classList.add('hidden');
  document.getElementById('thread-list-section').classList.remove('hidden');
};

// Odpowiedź
document.getElementById('send-reply').onclick = async () => {
  const comment = document.getElementById('reply-comment').value.trim();
  const file = document.getElementById('reply-image').files[0];

  if (!comment) return;

  const formData = new FormData();
  formData.append('comment', comment);
  if (file) formData.append('image', file);

  try {
    const res = await fetch(`/api/${currentBoard}/${currentThreadId}/reply`, { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    document.getElementById('reply-comment').value = '';
    document.getElementById('reply-image').value = '';
    document.getElementById('reply-image-preview').innerHTML = '';
    openThread(currentThreadId);
  } catch (err) {
    alert(err.message);
  }
};

document.getElementById('back-to-list').onclick = () => {
  document.getElementById('thread-view').classList.add('hidden');
  document.getElementById('thread-list-section').classList.remove('hidden');
};

// Preview obrazka
document.getElementById('thread-image').onchange = e => previewImage(e, 'thread-image-preview');
document.getElementById('reply-image').onchange = e => previewImage(e, 'reply-image-preview');

function previewImage(e, previewId) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    document.getElementById(previewId).innerHTML = `<img src="${ev.target.result}">`;
  };
  reader.readAsDataURL(file);
}

// Start aplikacji
loadThreads();
