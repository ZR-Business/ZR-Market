// ══════════════════════════════════════════════════════════════
//  ZR_Market Admin Pro — GitHub API Edition (English / EUR)
// ══════════════════════════════════════════════════════════════

const GITHUB_REPO   = 'ZR-Business/ZR_Market';
const GITHUB_FILE   = 'data.json';
const GITHUB_BRANCH = 'main';

class AdminZRMarketPro {
    constructor() {
        this.products      = [];
        this.mediaPreviews = [];
        this.editingId     = null;
        this.githubToken   = localStorage.getItem('zrmarket_gh_token') || '';
        this.init();
    }

    init() {
        this.checkAuth();
        this.renderTokenSection();
        this.loadProducts();
        this.setupEventListeners();
        this.renderOrdersList();
    }

    // ── AUTH ────────────────────────────────────────────────────
    checkAuth() {
        if (!localStorage.getItem('zrmarket_admin_pro')) {
            const pass = prompt('🔐 Admin Password:');
            if (pass === 'zrmarket2026') {
                localStorage.setItem('zrmarket_admin_pro', 'true');
            } else {
                alert('❌ Access denied');
                window.location.href = 'index.html';
                return;
            }
        }
        document.body.style.display = 'block';
    }

    logout() {
        localStorage.removeItem('zrmarket_admin_pro');
        window.location.href = 'index.html';
    }

    // ── TOKEN ────────────────────────────────────────────────────
    renderTokenSection() {
        const container = document.getElementById('tokenSection');
        if (!container) return;
        const hasToken = !!this.githubToken;
        container.innerHTML = `
            <div class="token-box ${hasToken ? 'token-ok' : 'token-missing'}">
                <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                    <div style="font-size:1.5rem;">${hasToken ? '🔑' : '⚠️'}</div>
                    <div style="flex:1;">
                        <strong>${hasToken ? 'GitHub Token configured ✅' : 'GitHub Token missing ⚠️'}</strong><br>
                        <small style="color:#666;">
                            ${hasToken
                                ? 'Products are automatically synced with GitHub.'
                                : 'Without a token, products will not be visible to all visitors.'}
                        </small>
                    </div>
                    <button onclick="admin.toggleTokenInput()" class="admin-btn" style="background:#ff6b35;color:white;padding:8px 16px;border-radius:8px;font-size:0.85rem;">
                        ${hasToken ? '🔄 Change Token' : '➕ Add Token'}
                    </button>
                    ${hasToken ? `<button onclick="admin.removeToken()" class="admin-btn danger" style="padding:8px 16px;border-radius:8px;font-size:0.85rem;">🗑️</button>` : ''}
                </div>
                <div id="tokenInputArea" style="display:none;margin-top:15px;">
                    <div style="background:#fff8e1;border:2px solid #ffc107;border-radius:10px;padding:12px;margin-bottom:10px;font-size:0.85rem;">
                        🔒 <strong>Security:</strong> The token is stored only in <em>your browser</em> — never in code or on GitHub.
                    </div>
                    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                        <input type="password" id="tokenInput"
                            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                            style="flex:1;padding:10px 14px;border:2px solid #ddd;border-radius:8px;font-size:0.9rem;min-width:200px;" value="">
                        <button onclick="admin.saveToken()" class="admin-btn primary" style="padding:10px 20px;border-radius:8px;width:auto;">
                            💾 Save
                        </button>
                    </div>
                    <small style="color:#aaa;margin-top:6px;display:block;">
                        GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → scope: ✅ repo
                    </small>
                </div>
            </div>`;
    }

    toggleTokenInput() {
        const area = document.getElementById('tokenInputArea');
        if (area) area.style.display = area.style.display === 'none' ? 'block' : 'none';
    }

    saveToken() {
        const input = document.getElementById('tokenInput');
        const token = input?.value.trim();
        if (!token || !token.startsWith('ghp_')) { alert('❌ Invalid token — must start with ghp_'); return; }
        this.githubToken = token;
        localStorage.setItem('zrmarket_gh_token', token);
        this.renderTokenSection();
        this.showNotification('🔑 Token saved! Publish a product to test.', 'success');
    }

    removeToken() {
        if (confirm('Delete the GitHub token?')) {
            this.githubToken = '';
            localStorage.removeItem('zrmarket_gh_token');
            this.renderTokenSection();
            this.showNotification('🗑️ Token removed', 'warning');
        }
    }

    // ── GITHUB API ───────────────────────────────────────────────
    async pushToGitHub(products) {
        if (!this.githubToken) {
            this.showNotification('⚠️ Add your GitHub Token first!', 'warning');
            return false;
        }
        const jsonStr = JSON.stringify(products, null, 2);
        const sizeKB = Math.round(new Blob([jsonStr]).size / 1024);
        if (sizeKB > 5000) {
            this.showNotification(`❌ Data too large (${sizeKB}KB) — reduce photos or their size`, 'error');
            return false;
        }
        const content = btoa(unescape(encodeURIComponent(jsonStr)));
        try {
            const getRes = await fetch(
                `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}?ref=${GITHUB_BRANCH}`,
                { headers: { Authorization: `token ${this.githubToken}`, Accept: 'application/vnd.github.v3+json' } }
            );
            let sha = null;
            if (getRes.ok) sha = (await getRes.json()).sha;
            else if (getRes.status !== 404) throw new Error(`GitHub GET: ${getRes.status}`);

            const putRes = await fetch(
                `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}`,
                {
                    method: 'PUT',
                    headers: {
                        Authorization: `token ${this.githubToken}`,
                        Accept: 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `🛍️ Update products — ${new Date().toLocaleString('en-GB')}`,
                        content,
                        branch: GITHUB_BRANCH,
                        ...(sha ? { sha } : {})
                    })
                }
            );
            if (!putRes.ok) throw new Error(`GitHub PUT: ${putRes.status}`);
            return true;
        } catch(err) {
            this.showNotification(`❌ GitHub error: ${err.message}`, 'error');
            return false;
        }
    }

    // ── LOAD ─────────────────────────────────────────────────────
    async loadProducts() {
        try {
            let jsonProducts = [];
            try {
                const res = await fetch('data.json');
                if (res.ok) jsonProducts = await res.json();
            } catch(e) {}
            if (jsonProducts.length > 0) {
                this.products = jsonProducts;
            } else {
                this.products = JSON.parse(localStorage.getItem('zrmarket_products') || '[]');
            }
        } catch(e) { this.products = []; }
        this.renderProductsList();
        document.getElementById('productsCount').textContent = this.products.length;
    }

    saveLocal() { localStorage.setItem('zrmarket_products', JSON.stringify(this.products)); }

    // ── MEDIA ────────────────────────────────────────────────────
    setupEventListeners() {
        const form = document.getElementById('productForm');
        if (form) form.addEventListener('submit', (e) => this.addProduct(e));

        const fileInput = document.getElementById('mediaFiles');
        if (fileInput) fileInput.addEventListener('change', (e) => this.handleFiles(e.target.files));

        const uploadZone = document.getElementById('uploadZone');
        if (uploadZone) {
            uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.style.borderColor = '#ff6b35'; });
            uploadZone.addEventListener('dragleave', () => { uploadZone.style.borderColor = ''; });
            uploadZone.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadZone.style.borderColor = '';
                this.handleFiles(e.dataTransfer.files);
            });
        }
        window.admin = this;
    }

    handleFiles(files) {
        const remaining = 10 - this.mediaPreviews.length;
        const toProcess = Array.from(files).slice(0, remaining);
        toProcess.forEach(file => {
            if (file.type.startsWith('video/')) {
                const url = URL.createObjectURL(file);
                this.mediaPreviews.push({ url, name: file.name, type: 'video' });
                this.renderPreviews();
            } else if (file.type.startsWith('image/')) {
                const img = new Image();
                const objectUrl = URL.createObjectURL(file);
                img.onload = () => {
                    const MAX = 1200;
                    const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
                    const canvas = document.createElement('canvas');
                    canvas.width  = Math.round(img.width  * ratio);
                    canvas.height = Math.round(img.height * ratio);
                    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                    const compressed = canvas.toDataURL('image/jpeg', 0.72);
                    URL.revokeObjectURL(objectUrl);
                    this.mediaPreviews.push({ url: compressed, name: file.name, type: 'image' });
                    this.renderPreviews();
                };
                img.src = objectUrl;
            }
        });
    }

    renderPreviews() {
        document.getElementById('previewContainer').innerHTML =
            this.mediaPreviews.map((p,i) => `
                <div class="preview-item">
                    ${p.type === 'video'
                        ? `<video src="${p.url}" style="width:100%;height:100%;object-fit:cover;"></video>`
                        : `<img src="${p.url}" style="width:100%;height:100%;object-fit:cover;">`}
                    <button class="remove-btn" onclick="admin.removeMedia(${i})">×</button>
                </div>`).join('');
    }

    removeMedia(i) { this.mediaPreviews.splice(i,1); this.renderPreviews(); }

    // ── ADD / EDIT PRODUCT ───────────────────────────────────────
    async addProduct(e) {
        e.preventDefault();
        if (!document.getElementById('productName').value.trim()) { alert('❌ Product name is required!'); return; }
        if (this.mediaPreviews.length === 0) { alert('📸 Please add at least 1 photo/video!'); return; }

        const btn = document.querySelector('.admin-btn.primary');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing...';

        const mediaData = this.mediaPreviews.map(m => ({ type:m.type, url:m.url, name:m.name }));

        if (this.editingId) {
            const idx = this.products.findIndex(p => p.id === this.editingId);
            if (idx !== -1) {
                this.products[idx] = {
                    ...this.products[idx],
                    name:        document.getElementById('productName').value.trim(),
                    price:       parseFloat(document.getElementById('productPrice').value) || 0,
                    description: document.getElementById('productDesc').value || '',
                    category:    document.getElementById('productCategory').value,
                    stock:       parseInt(document.getElementById('productStock').value) || 10,
                    media:       mediaData
                };
            }
            this.editingId = null;
        } else {
            this.products.unshift({
                id:          Date.now(),
                name:        document.getElementById('productName').value.trim(),
                price:       parseFloat(document.getElementById('productPrice').value) || 0,
                description: document.getElementById('productDesc').value || '',
                category:    document.getElementById('productCategory').value,
                stock:       parseInt(document.getElementById('productStock').value) || 10,
                media:       mediaData,
                date:        new Date().toISOString()
            });
        }

        this.saveLocal();
        const pushed = await this.pushToGitHub(this.products);

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-rocket"></i> Publish Product';

        if (pushed) {
            this.showNotification('✅ Product published on the site! (GitHub updated)', 'success');
        } else {
            this.showNotification('💾 Saved locally — add your GitHub token to publish publicly', 'warning');
        }

        document.getElementById('productForm').reset();
        this.mediaPreviews = [];
        document.getElementById('previewContainer').innerHTML = '';
        this.renderProductsList();
        document.getElementById('productsCount').textContent = this.products.length;
    }

    // ── PRODUCTS LIST ────────────────────────────────────────────
    renderProductsList() {
        document.getElementById('adminProductsList').innerHTML =
            this.products.map(p => `
                <div class="product-admin-item">
                    <div style="display:flex;align-items:center;gap:14px;">
                        ${p.media?.[0]
                            ? (p.media[0].type === 'video'
                                ? `<video src="${p.media[0].url}" style="width:60px;height:60px;object-fit:cover;border-radius:10px;" muted></video>`
                                : `<img src="${p.media[0].url}" style="width:60px;height:60px;object-fit:cover;border-radius:10px;">`)
                            : `<div style="width:60px;height:60px;background:#f0f0f0;border-radius:10px;display:flex;align-items:center;justify-content:center;"><i class="fas fa-image" style="color:#ccc;"></i></div>`}
                        <div>
                            <strong style="font-family:'Syne',sans-serif;">${p.name}</strong><br>
                            <small>💶 €${p.price.toFixed(2)} &nbsp;|&nbsp; 📦 ${p.stock} units &nbsp;|&nbsp; 🖼️ ${p.media?.length||0} media</small><br>
                            <small style="color:#ff6b35;font-weight:600;">${p.category}</small>
                        </div>
                    </div>
                    <div style="display:flex;gap:8px;">
                        <button onclick="admin.editProduct(${p.id})" style="background:#0d0d0d;color:white;padding:8px 14px;border-radius:8px;border:none;cursor:pointer;transition:opacity 0.2s;" onmouseover="this.style.opacity='0.75'" onmouseout="this.style.opacity='1'">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="admin.deleteProduct(${p.id})" style="background:#ff4757;color:white;padding:8px 14px;border-radius:8px;border:none;cursor:pointer;transition:opacity 0.2s;" onmouseover="this.style.opacity='0.75'" onmouseout="this.style.opacity='1'">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>`).join('')
            || '<p style="text-align:center;color:#bbb;padding:28px;">No products yet — add one above!</p>';
    }

    async deleteProduct(id) {
        const p = this.products.find(p => p.id === id);
        if (!confirm(`🗑️ Delete "${p?.name}" permanently?`)) return;
        this.products = this.products.filter(p => p.id !== id);
        this.saveLocal();
        const pushed = await this.pushToGitHub(this.products);
        this.renderProductsList();
        document.getElementById('productsCount').textContent = this.products.length;
        this.showNotification(pushed ? '🗑️ Product removed from site!' : '🗑️ Deleted locally', pushed ? 'success' : 'warning');
    }

    editProduct(id) {
        const p = this.products.find(p => p.id === id);
        if (!p) return;
        this.editingId = id;
        document.getElementById('productName').value     = p.name;
        document.getElementById('productPrice').value    = p.price;
        document.getElementById('productDesc').value     = p.description;
        document.getElementById('productCategory').value = p.category;
        document.getElementById('productStock').value    = p.stock;
        this.mediaPreviews = p.media ? [...p.media] : [];
        this.renderPreviews();
        document.querySelector('.admin-btn.primary').innerHTML = '<i class="fas fa-save"></i> Save Changes';
        document.getElementById('productName').scrollIntoView({ behavior:'smooth' });
        this.showNotification(`✏️ Editing "${p.name}"`, 'success');
    }

    // ── ORDERS ───────────────────────────────────────────────────
    renderOrdersList() {
        const container = document.getElementById('adminOrdersList');
        if (!container) return;
        const orders = JSON.parse(localStorage.getItem('zrmarket_orders') || '[]');
        if (orders.length === 0) {
            container.innerHTML = '<div class="admin-orders-empty"><i class="fas fa-receipt" style="font-size:2rem;display:block;margin-bottom:10px;opacity:0.3;"></i>No orders yet.</div>';
            return;
        }
        container.innerHTML = orders.map(o => `
            <div class="order-row">
                <div class="order-row-header">
                    <span class="order-ref-badge">#${o.ref}</span>
                    <span style="font-size:0.85rem;color:#888;">${new Date(o.date).toLocaleString('en-GB')}</span>
                    <span class="order-status">✅ ${o.status}</span>
                    <strong style="font-family:'Syne',sans-serif;color:#ff6b35;">€${o.total.toFixed(2)}</strong>
                </div>
                <div style="font-size:0.85rem;color:#555;">
                    <strong>${o.customer.firstName} ${o.customer.lastName}</strong> — ${o.customer.email}<br>
                    📍 ${o.customer.address}, ${o.customer.city} ${o.customer.zip}, ${o.customer.country}
                </div>
                <div style="margin-top:8px;font-size:0.82rem;color:#888;">
                    ${o.items.map(i => `${i.name} × ${i.qty}`).join(' &nbsp;|&nbsp; ')}
                </div>
            </div>`).join('');
    }

    // ── NOTIFICATIONS ────────────────────────────────────────────
    showNotification(msg, type = 'success') {
        const bg = {
            success: 'linear-gradient(45deg,#2ed573,#1abc9c)',
            warning: 'linear-gradient(45deg,#ffa502,#ff6348)',
            error:   'linear-gradient(45deg,#ff4757,#c0392b)'
        };
        const n = document.createElement('div');
        n.style.cssText = `position:fixed;top:100px;right:20px;background:${bg[type]||bg.success};color:white;
            padding:14px 22px;border-radius:12px;z-index:10000;font-weight:bold;max-width:360px;
            box-shadow:0 8px 24px rgba(0,0,0,0.2);transform:translateX(420px);
            transition:transform 0.3s;font-size:0.88rem;line-height:1.5;font-family:'DM Sans',sans-serif;`;
        n.textContent = msg;
        document.body.appendChild(n);
        setTimeout(() => n.style.transform = 'translateX(0)', 100);
        setTimeout(() => { n.style.transform = 'translateX(420px)'; setTimeout(() => n.remove(), 300); }, 4500);
    }
}

const admin = new AdminZRMarketPro();