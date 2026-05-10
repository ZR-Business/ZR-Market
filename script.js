class ZRMarket {
    constructor() {
        this.products         = [];
        this.cart             = JSON.parse(localStorage.getItem('zrmarket_cart') || '[]');
        this.visibleProducts  = 6;
        this.sliderState      = {};
        this.modalSliderState = { current: 0, total: 0 };
        this.currentModalId   = null;
        this.currentStars     = 5;
        this.init();
    }

    async init() {
        await this.loadProducts();
        this.renderProducts();
        this.updateStats();
        this.setupEventListeners();
        this.animateOnScroll();
        this.createProductModal();
        this.updateCartBadge();
    }

    // ── DATA ─────────────────────────────────────────────────────
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
            this.products.sort((a,b) => new Date(b.date||0) - new Date(a.date||0));
        } catch(e) { this.products = []; }
    }

    // ── RENDER PRODUCTS ─────────────────────────────────────────
    renderProducts() {
        const grid = document.getElementById('productsGrid');
        const list = this.products.slice(0, this.visibleProducts);

        if (list.length === 0) {
            grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:#bbb;">
                <i class="fas fa-box-open" style="font-size:3rem;margin-bottom:16px;display:block;"></i>
                <p style="font-size:1rem;">No products yet. Check back soon!</p>
            </div>`;
            document.getElementById('loadMoreBtn').style.display = 'none';
            return;
        }

        grid.innerHTML = list.map((product, index) => {
            const mediaList = product.media ? [...product.media] : [];
            if (mediaList.length === 0 && product.image) mediaList.push({ type:'image', url:product.image });
            const hasMultiple = mediaList.length > 1;

            return `
            <div class="product-card" data-index="${index}" data-category="${product.category||'Tech'}" onclick="shop.openModal(${product.id})">
                <div class="product-image" data-stock="${product.stock > 0 ? 'In Stock' : 'Sold Out'}">
                    <div class="media-slider" id="slider-${product.id}">
                        ${mediaList.length > 0 ? mediaList.map((m,i) => `
                            <div class="slide ${i===0?'active':''}">
                                ${m.type==='video'
                                    ? `<video src="${m.url}" muted autoplay loop playsinline style="width:100%;height:100%;object-fit:cover;"></video>`
                                    : `<img src="${m.url}" alt="${product.name}" onerror="this.src='https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400';" style="width:100%;height:100%;object-fit:cover;">`}
                            </div>`).join('') : `
                            <div class="slide active">
                                <div style="height:270px;background:linear-gradient(45deg,#111,#222);display:flex;align-items:center;justify-content:center;">
                                    <i class="fas fa-image" style="font-size:3.5rem;color:#444;"></i>
                                </div>
                            </div>`}
                    </div>
                    ${hasMultiple ? `
                        <button class="slider-btn prev" onclick="event.stopPropagation();shop.slideMedia('${product.id}',-1)"><i class="fas fa-chevron-left"></i></button>
                        <button class="slider-btn next" onclick="event.stopPropagation();shop.slideMedia('${product.id}',1)"><i class="fas fa-chevron-right"></i></button>
                        <div class="slider-dots">${mediaList.map((_,i)=>`<span class="dot ${i===0?'active':''}" onclick="event.stopPropagation();shop.goToSlide('${product.id}',${i})"></span>`).join('')}</div>
                        <div class="media-count"><i class="fas fa-images"></i> ${mediaList.length}</div>` : ''}
                    ${product.category ? `<div class="category-badge">${product.category}</div>` : ''}
                </div>
                <div class="product-info">
                    <h3 title="${product.name}">${product.name||'Premium Product'}</h3>
                    <div class="product-price">${product.price ? '€'+product.price.toFixed(2) : '€9.99'}</div>
                    <p class="product-desc">${(product.description||'Premium quality guaranteed').substring(0,80)}${(product.description?.length > 80)?'...':''}</p>
                    <div class="product-actions">
                        <button class="product-order" onclick="event.stopPropagation();shop.addToCart(${product.id})">
                            <i class="fas fa-shopping-bag"></i> Add to Cart
                        </button>
                        <button class="add-cart-btn" onclick="event.stopPropagation();shop.openModal(${product.id})">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${product.stock === 0 ? '<span class="stock-out">🔴 Sold Out</span>' : '<span class="stock-info">🟢 Available</span>'}
                    </div>
                </div>
            </div>`;
        }).join('');

        this.sliderState = {};
        list.forEach(p => {
            this.sliderState[p.id] = { current:0, total: p.media?.length || (p.image?1:0) };
        });

        document.getElementById('loadMoreBtn').style.display =
            this.products.length > this.visibleProducts ? 'flex' : 'none';
    }

    // ── CARD SLIDER ──────────────────────────────────────────────
    slideMedia(productId, dir) {
        const slider = document.getElementById(`slider-${productId}`);
        if (!slider) return;
        const slides = slider.querySelectorAll('.slide');
        const dots   = slider.parentElement.querySelectorAll('.dot');
        if (!slides.length) return;
        if (!this.sliderState[productId]) this.sliderState[productId] = { current:0, total:slides.length };
        let cur = this.sliderState[productId].current;
        slides[cur].classList.remove('active');
        if (dots[cur]) dots[cur].classList.remove('active');
        cur = (cur + dir + slides.length) % slides.length;
        this.sliderState[productId].current = cur;
        slides[cur].classList.add('active');
        if (dots[cur]) dots[cur].classList.add('active');
    }

    goToSlide(productId, index) {
        const slider = document.getElementById(`slider-${productId}`);
        if (!slider) return;
        const slides = slider.querySelectorAll('.slide');
        const dots   = slider.parentElement.querySelectorAll('.dot');
        if (!this.sliderState[productId]) this.sliderState[productId] = { current:0, total:slides.length };
        const cur = this.sliderState[productId].current;
        slides[cur].classList.remove('active');
        if (dots[cur]) dots[cur].classList.remove('active');
        this.sliderState[productId].current = index;
        slides[index].classList.add('active');
        if (dots[index]) dots[index].classList.add('active');
    }

    // ── CART ─────────────────────────────────────────────────────
    addToCart(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;
        if (product.stock === 0) { this.showNotification('❌ This product is out of stock.'); return; }

        const existing = this.cart.find(i => i.id === productId);
        if (existing) {
            existing.qty++;
        } else {
            this.cart.push({ id: productId, qty: 1 });
        }
        this.saveCart();
        this.updateCartBadge();
        this.showNotification(`✅ "${product.name}" added to cart!`);
    }

    removeFromCart(productId) {
        this.cart = this.cart.filter(i => i.id !== productId);
        this.saveCart();
        this.updateCartBadge();
        this.renderCartItems();
    }

    changeQty(productId, delta) {
        const item = this.cart.find(i => i.id === productId);
        if (!item) return;
        item.qty += delta;
        if (item.qty <= 0) this.cart = this.cart.filter(i => i.id !== productId);
        this.saveCart();
        this.updateCartBadge();
        this.renderCartItems();
    }

    saveCart() { localStorage.setItem('zrmarket_cart', JSON.stringify(this.cart)); }

    cartTotal() {
        return this.cart.reduce((sum, item) => {
            const p = this.products.find(p => p.id === item.id);
            return sum + (p ? p.price * item.qty : 0);
        }, 0);
    }

    updateCartBadge() {
        const total = this.cart.reduce((sum,i) => sum + i.qty, 0);
        const badge = document.getElementById('cartBadge');
        if (badge) {
            badge.textContent = total;
            badge.style.display = total > 0 ? 'flex' : 'none';
        }
    }

    openCart() {
        document.getElementById('cartSidebar').classList.add('open');
        document.getElementById('cartOverlay').classList.add('open');
        document.body.classList.add('no-scroll');
        this.renderCartItems();
    }

    closeCart() {
        document.getElementById('cartSidebar').classList.remove('open');
        document.getElementById('cartOverlay').classList.remove('open');
        document.body.classList.remove('no-scroll');
    }

    renderCartItems() {
        const container = document.getElementById('cartItems');
        const footer    = document.getElementById('cartFooter');

        if (this.cart.length === 0) {
            container.innerHTML = `<div class="cart-empty">
                <i class="fas fa-shopping-bag"></i>
                <p>Your cart is empty</p>
            </div>`;
            footer.style.display = 'none';
            return;
        }

        container.innerHTML = this.cart.map(item => {
            const p = this.products.find(p => p.id === item.id);
            if (!p) return '';
            const imgUrl = p.media?.[0]?.url || p.image || null;
            return `
            <div class="cart-item">
                ${imgUrl
                    ? `<img class="cart-item-img" src="${imgUrl}" alt="${p.name}">`
                    : `<div class="cart-item-img-placeholder"><i class="fas fa-image"></i></div>`}
                <div class="cart-item-info">
                    <div class="cart-item-name">${p.name}</div>
                    <div class="cart-item-price">€${(p.price * item.qty).toFixed(2)}</div>
                    <div class="cart-item-qty">
                        <button class="qty-btn" onclick="shop.changeQty(${p.id},-1)">−</button>
                        <span class="qty-num">${item.qty}</span>
                        <button class="qty-btn" onclick="shop.changeQty(${p.id},1)">+</button>
                    </div>
                </div>
                <button class="cart-item-remove" onclick="shop.removeFromCart(${p.id})"><i class="fas fa-times"></i></button>
            </div>`;
        }).join('');

        document.getElementById('cartTotal').textContent = '€' + this.cartTotal().toFixed(2);
        footer.style.display = 'block';
    }

    // ── CHECKOUT ─────────────────────────────────────────────────
    openCheckout() {
        if (this.cart.length === 0) return;
        this.closeCart();

        const summary = document.getElementById('checkoutSummary');
        summary.innerHTML = this.cart.map(item => {
            const p = this.products.find(p => p.id === item.id);
            if (!p) return '';
            const imgUrl = p.media?.[0]?.url || p.image || null;
            return `
            <div class="checkout-item">
                ${imgUrl
                    ? `<img src="${imgUrl}" alt="${p.name}">`
                    : `<div class="checkout-item-ph"><i class="fas fa-image"></i></div>`}
                <div class="checkout-item-info">
                    <div class="checkout-item-name">${p.name}</div>
                    <div class="checkout-item-meta">Qty: ${item.qty}</div>
                </div>
                <div class="checkout-item-price">€${(p.price * item.qty).toFixed(2)}</div>
            </div>`;
        }).join('');

        const total = this.cartTotal().toFixed(2);
        document.getElementById('checkoutTotalDisplay').textContent = '€' + total;
        document.getElementById('placeOrderTotal').textContent = '€' + total;

        document.getElementById('checkoutModal').classList.add('open');
        document.body.classList.add('no-scroll');
    }

    closeCheckout() {
        document.getElementById('checkoutModal').classList.remove('open');
        document.body.classList.remove('no-scroll');
    }

    formatCard(input) {
        let v = input.value.replace(/\D/g,'').substring(0,16);
        input.value = v.replace(/(.{4})/g,'$1 ').trim();
    }

    formatExpiry(input) {
        let v = input.value.replace(/\D/g,'');
        if (v.length >= 3) v = v.substring(0,2) + '/' + v.substring(2,4);
        input.value = v;
    }

    placeOrder() {
        const firstName = document.getElementById('ckFirstName').value.trim();
        const lastName  = document.getElementById('ckLastName').value.trim();
        const email     = document.getElementById('ckEmail').value.trim();
        const address   = document.getElementById('ckAddress').value.trim();
        const city      = document.getElementById('ckCity').value.trim();
        const zip       = document.getElementById('ckZip').value.trim();
        const card      = document.getElementById('ckCard').value.trim();
        const expiry    = document.getElementById('ckExpiry').value.trim();
        const cvv       = document.getElementById('ckCvv').value.trim();
        const cardName  = document.getElementById('ckCardName').value.trim();

        if (!firstName || !lastName || !email || !address || !city || !zip) {
            this.showNotification('⚠️ Please fill in all delivery details.'); return;
        }
        if (!email.includes('@')) { this.showNotification('⚠️ Please enter a valid email.'); return; }
        if (!card || card.replace(/\s/g,'').length < 16) { this.showNotification('⚠️ Please enter a valid card number.'); return; }
        if (!expiry || expiry.length < 5) { this.showNotification('⚠️ Please enter card expiry (MM/YY).'); return; }
        if (!cvv || cvv.length < 3) { this.showNotification('⚠️ Please enter your CVV.'); return; }
        if (!cardName) { this.showNotification('⚠️ Please enter the name on card.'); return; }

        // Save order
        const orderRef = 'ZR-' + Date.now().toString(36).toUpperCase();
        const order = {
            ref:       orderRef,
            date:      new Date().toISOString(),
            customer:  { firstName, lastName, email, address, city, zip, country: document.getElementById('ckCountry').value },
            items:     this.cart.map(item => {
                const p = this.products.find(p => p.id === item.id);
                return { id: item.id, name: p?.name, price: p?.price, qty: item.qty };
            }),
            total:     this.cartTotal(),
            status:    'confirmed'
        };

        const orders = JSON.parse(localStorage.getItem('zrmarket_orders') || '[]');
        orders.unshift(order);
        localStorage.setItem('zrmarket_orders', JSON.stringify(orders));

        // Update stock (local)
        this.cart.forEach(item => {
            const p = this.products.find(p => p.id === item.id);
            if (p && p.stock > 0) p.stock = Math.max(0, p.stock - item.qty);
        });

        // Clear cart
        this.cart = [];
        this.saveCart();
        this.updateCartBadge();

        this.closeCheckout();

        // Show success
        document.getElementById('successMsg').textContent =
            `Thank you, ${firstName}! Your order has been placed.`;
        document.getElementById('successOrderRef').textContent = `Order #${orderRef}`;
        document.getElementById('successModal').classList.add('open');
    }

    closeSuccess() {
        document.getElementById('successModal').classList.remove('open');
        document.body.classList.remove('no-scroll');
        this.renderProducts();
    }

    // ── PRODUCT MODAL ────────────────────────────────────────────
    createProductModal() {
        const modal = document.createElement('div');
        modal.id = 'productModal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="shop.closeModal()"></div>
            <div class="modal-box">
                <button class="modal-close" onclick="shop.closeModal()"><i class="fas fa-times"></i></button>
                <div class="modal-inner">
                    <div class="modal-media">
                        <div class="modal-slider" id="modalSlider"></div>
                        <button class="slider-btn prev" id="modalPrev" onclick="shop.modalSlide(-1)" style="display:none;"><i class="fas fa-chevron-left"></i></button>
                        <button class="slider-btn next" id="modalNext" onclick="shop.modalSlide(1)" style="display:none;"><i class="fas fa-chevron-right"></i></button>
                        <div class="slider-dots" id="modalDots"></div>
                    </div>
                    <div class="modal-details">
                        <span class="modal-category" id="modalCategory"></span>
                        <h2 id="modalName"></h2>
                        <div class="modal-price" id="modalPrice"></div>
                        <div id="modalStock"></div>
                        <p class="modal-desc" id="modalDesc"></p>
                        <button class="modal-order-btn" onclick="shop.addToCart(shop.currentModalId);shop.closeModal();">
                            <i class="fas fa-shopping-bag"></i> Add to Cart
                        </button>
                        <button class="modal-cart-btn" onclick="shop.addToCart(shop.currentModalId);shop.closeModal();shop.openCart();">
                            <i class="fas fa-shopping-cart"></i> Add & View Cart
                        </button>
                        <div class="modal-comments">
                            <h4><i class="fas fa-comments"></i> Customer Reviews (<span id="commentsCount">0</span>)</h4>
                            <div class="comments-list" id="commentsList"></div>
                            <div class="comment-form">
                                <input type="text" id="commentName" placeholder="Your name..." maxlength="30">
                                <div class="star-rating" id="starRating">
                                    <span onclick="shop.setStars(1)">★</span>
                                    <span onclick="shop.setStars(2)">★</span>
                                    <span onclick="shop.setStars(3)">★</span>
                                    <span onclick="shop.setStars(4)">★</span>
                                    <span onclick="shop.setStars(5)">★</span>
                                </div>
                                <textarea id="commentText" placeholder="Share your experience..." rows="3" maxlength="300"></textarea>
                                <button onclick="shop.submitComment()" class="comment-submit">
                                    <i class="fas fa-paper-plane"></i> Post Review
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modal);
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { this.closeModal(); this.closeCheckout(); } });
    }

    openModal(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;
        this.currentModalId = productId;
        const mediaList = product.media ? [...product.media] : [];
        if (mediaList.length === 0 && product.image) mediaList.push({ type:'image', url:product.image });
        this.modalSliderState = { current:0, total:mediaList.length };

        document.getElementById('modalSlider').innerHTML = mediaList.map((m,i) => `
            <div class="modal-slide" style="position:absolute;inset:0;opacity:${i===0?1:0};transition:opacity 0.4s;pointer-events:${i===0?'auto':'none'};">
                ${m.type==='video'
                    ? `<video src="${m.url}" controls style="width:100%;height:100%;object-fit:contain;background:#000;"></video>`
                    : `<img src="${m.url}" alt="${product.name}" style="width:100%;height:100%;object-fit:contain;background:#111;">`}
            </div>`).join('')
            || `<div style="height:100%;display:flex;align-items:center;justify-content:center;background:#111;"><i class="fas fa-image" style="font-size:4rem;color:#444;"></i></div>`;

        document.getElementById('modalDots').innerHTML = mediaList.length > 1
            ? mediaList.map((_,i) => `<span class="dot ${i===0?'active':''}" onclick="shop.modalGoTo(${i})"></span>`).join('') : '';
        document.getElementById('modalPrev').style.display = mediaList.length > 1 ? 'flex' : 'none';
        document.getElementById('modalNext').style.display = mediaList.length > 1 ? 'flex' : 'none';

        document.getElementById('modalCategory').textContent = product.category || '';
        document.getElementById('modalName').textContent     = product.name;
        document.getElementById('modalPrice').textContent    = '€' + (product.price?.toFixed(2) || '0.00');
        document.getElementById('modalStock').innerHTML      = product.stock === 0
            ? '<span style="color:#ff4757;">🔴 Out of Stock</span>'
            : `<span style="color:#2ed573;">🟢 In Stock (${product.stock} available)</span>`;
        document.getElementById('modalDesc').textContent = product.description || 'Premium quality guaranteed.';

        this.renderComments(productId);
        this.currentStars = 5;
        this.updateStarUI(5);
        document.getElementById('productModal').classList.add('open');
        document.body.classList.add('no-scroll');
    }

    closeModal() {
        document.getElementById('productModal').classList.remove('open');
        document.body.classList.remove('no-scroll');
        this.currentModalId = null;
    }

    modalSlide(dir) {
        const slides = document.querySelectorAll('.modal-slide');
        const dots   = document.querySelectorAll('#modalDots .dot');
        if (!slides.length) return;
        let cur = this.modalSliderState.current;
        slides[cur].style.opacity = '0'; slides[cur].style.pointerEvents = 'none';
        if (dots[cur]) dots[cur].classList.remove('active');
        cur = (cur + dir + slides.length) % slides.length;
        this.modalSliderState.current = cur;
        slides[cur].style.opacity = '1'; slides[cur].style.pointerEvents = 'auto';
        if (dots[cur]) dots[cur].classList.add('active');
    }

    modalGoTo(index) {
        const slides = document.querySelectorAll('.modal-slide');
        const dots   = document.querySelectorAll('#modalDots .dot');
        const cur    = this.modalSliderState.current;
        slides[cur].style.opacity = '0'; slides[cur].style.pointerEvents = 'none';
        if (dots[cur]) dots[cur].classList.remove('active');
        this.modalSliderState.current = index;
        slides[index].style.opacity = '1'; slides[index].style.pointerEvents = 'auto';
        if (dots[index]) dots[index].classList.add('active');
    }

    // ── REVIEWS ──────────────────────────────────────────────────
    getComments(productId)          { return JSON.parse(localStorage.getItem(`zrmarket_comments_${productId}`) || '[]'); }
    saveComments(productId, list)   { localStorage.setItem(`zrmarket_comments_${productId}`, JSON.stringify(list)); }

    renderComments(productId) {
        const comments = this.getComments(productId);
        document.getElementById('commentsCount').textContent = comments.length;
        document.getElementById('commentsList').innerHTML = comments.length > 0
            ? comments.map(c => `
                <div class="comment-item">
                    <div class="comment-header">
                        <strong>${c.name}</strong>
                        <span class="comment-stars">${'★'.repeat(c.stars)}${'☆'.repeat(5-c.stars)}</span>
                        <span class="comment-date">${c.date}</span>
                    </div>
                    <p>${c.text}</p>
                </div>`).join('')
            : '<p class="no-comments">Be the first to leave a review! 💬</p>';
    }

    setStars(n) { this.currentStars = n; this.updateStarUI(n); }
    updateStarUI(n) {
        document.querySelectorAll('#starRating span').forEach((s,i) => { s.style.color = i < n ? '#f7931e' : '#ddd'; });
    }

    submitComment() {
        const name = document.getElementById('commentName').value.trim();
        const text = document.getElementById('commentText').value.trim();
        if (!name || !text) { this.showNotification('⚠️ Please enter your name and review!'); return; }
        const comments = this.getComments(this.currentModalId);
        comments.unshift({ name, text, stars: this.currentStars, date: new Date().toLocaleDateString('en-GB') });
        this.saveComments(this.currentModalId, comments);
        this.renderComments(this.currentModalId);
        document.getElementById('commentName').value = '';
        document.getElementById('commentText').value = '';
        this.currentStars = 5; this.updateStarUI(5);
        this.showNotification('✅ Review posted, thank you! 🙏');
    }

    // ── STATS & EVENTS ────────────────────────────────────────────
    updateStats() {
        document.getElementById('productsCountHero').textContent = this.products.length;
    }

    setupEventListeners() {
        const hamburger = document.querySelector('.hamburger');
        const navMenu   = document.querySelector('.nav-menu');
        hamburger?.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
        document.querySelectorAll('a[href^="#"]').forEach(a => {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelector(a.getAttribute('href'))?.scrollIntoView({ behavior:'smooth' });
            });
        });
        document.querySelectorAll('.category-card')?.forEach(card => {
            card.addEventListener('click', (e) => this.filterByCategory(e.currentTarget.dataset.category));
        });
        window.shop = this;
    }

    filterByCategory(category) {
        document.querySelectorAll('.product-card').forEach(card => {
            const match = category === 'All' || card.dataset.category === category;
            card.style.opacity   = match ? '1' : '0.3';
            card.style.transform = match ? '' : 'scale(0.95)';
        });
    }

    animateOnScroll() {
        const observer = new IntersectionObserver(
            (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('animate'); }),
            { threshold: 0.1 }
        );
        document.querySelectorAll('.product-card, .category-card, .trust-item').forEach(el => observer.observe(el));
    }

    showNotification(message) {
        const n = document.createElement('div');
        n.className = 'notification';
        n.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
        document.body.appendChild(n);
        setTimeout(() => n.classList.add('show'), 100);
        setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 300); }, 3500);
    }
}

document.addEventListener('DOMContentLoaded', () => { window.shop = new ZRMarket(); });