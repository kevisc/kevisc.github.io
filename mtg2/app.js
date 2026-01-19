// MTG Deck Builder Application
// Using Scryfall API for card data and prices

class MTGDeckBuilder {
    constructor() {
        this.deck = {
            name: 'Untitled Deck',
            format: 'commander',
            commander: null,
            partner: null,
            main: [],
            sideboard: [],
            maybeboard: []
        };

        this.currentTab = 'main';
        this.searchCache = new Map();
        this.cardCache = new Map();
        this.searchTimeout = null;
        this.selectedCard = null;

        // Search state for infinite scroll
        this.currentSearchQuery = '';
        this.currentSearchResults = [];
        this.nextPageUrl = null;
        this.isLoadingMore = false;
        this.hasMoreResults = false;

        // Format configurations
        this.formatConfigs = {
            commander: { minCards: 100, maxCards: 100, maxCopies: 1, hasSideboard: false, hasCommander: true },
            standard: { minCards: 60, maxCards: Infinity, maxCopies: 4, hasSideboard: true, hasCommander: false },
            modern: { minCards: 60, maxCards: Infinity, maxCopies: 4, hasSideboard: true, hasCommander: false },
            legacy: { minCards: 60, maxCards: Infinity, maxCopies: 4, hasSideboard: true, hasCommander: false },
            vintage: { minCards: 60, maxCards: Infinity, maxCopies: 4, hasSideboard: true, hasCommander: false },
            pauper: { minCards: 60, maxCards: Infinity, maxCopies: 4, hasSideboard: true, hasCommander: false }
        };

        // Basic lands (unlimited copies allowed)
        this.basicLands = [
            'plains', 'island', 'swamp', 'mountain', 'forest',
            'snow-covered plains', 'snow-covered island', 'snow-covered swamp',
            'snow-covered mountain', 'snow-covered forest', 'wastes'
        ];

        this.init();
    }

    init() {
        this.bindElements();
        this.bindEvents();
        this.updateFormatUI();
        this.loadFromStorage();
    }

    bindElements() {
        // Header
        this.formatSelect = document.getElementById('format');
        this.newDeckBtn = document.getElementById('new-deck');
        this.exportBtn = document.getElementById('export-deck');
        this.importBtn = document.getElementById('import-deck');

        // Commander section
        this.commanderSection = document.getElementById('commander-section');
        this.commanderSlot = document.getElementById('commander-slot');
        this.partnerSection = document.getElementById('partner-section');
        this.partnerSlot = document.getElementById('partner-slot');
        this.colorIdentityDisplay = document.getElementById('color-identity-display');

        // Search
        this.searchInput = document.getElementById('card-search');
        this.searchBtn = document.getElementById('search-btn');
        this.toggleAdvancedBtn = document.getElementById('toggle-advanced');
        this.advancedSearch = document.getElementById('advanced-search');
        this.searchResults = document.getElementById('search-results');

        // Advanced search fields
        this.setFilter = document.getElementById('set-filter');
        this.typeFilter = document.getElementById('type-filter');
        this.cmcFilter = document.getElementById('cmc-filter');
        this.rarityFilter = document.getElementById('rarity-filter');
        this.colorFilters = document.querySelectorAll('.color-filter input');

        // Deck
        this.deckNameInput = document.getElementById('deck-name');
        this.deckCount = document.getElementById('deck-count');
        this.deckTarget = document.getElementById('deck-target');
        this.deckTabs = document.querySelectorAll('.tab-btn');
        this.deckDropZone = document.getElementById('deck-drop-zone');
        this.deckList = document.getElementById('deck-list');

        // Validation
        this.validationStatus = document.getElementById('validation-status');
        this.validationMessages = document.getElementById('validation-messages');

        // Stats
        this.manaCurve = document.getElementById('mana-curve');
        this.colorDistribution = document.getElementById('color-distribution');
        this.priceUsd = document.getElementById('price-usd');
        this.priceEur = document.getElementById('price-eur');
        this.priceTix = document.getElementById('price-tix');
        this.deckProgress = document.getElementById('deck-progress');
        this.progressText = document.getElementById('progress-text');

        // Modals
        this.cardModal = document.getElementById('card-modal');
        this.priceModal = document.getElementById('price-modal');
        this.importModal = document.getElementById('import-modal');
        this.exportModal = document.getElementById('export-modal');

        // Loading
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.toastContainer = document.getElementById('toast-container');

        // Hover preview
        this.hoverPreview = document.getElementById('card-hover-preview');
        this.hoverPreviewImage = document.getElementById('hover-preview-image');
        this.hoverPreviewImageBack = document.getElementById('hover-preview-image-back');

        // Context menu
        this.contextMenu = document.getElementById('card-context-menu');
        this.contextMenuCardId = null;
    }

    bindEvents() {
        // Format change
        this.formatSelect.addEventListener('change', () => this.changeFormat());

        // Search
        this.searchInput.addEventListener('input', () => this.handleSearchInput());
        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.performSearch();
        });
        this.searchBtn.addEventListener('click', () => this.performSearch());
        this.toggleAdvancedBtn.addEventListener('click', () => this.toggleAdvanced());

        // Deck actions
        this.newDeckBtn.addEventListener('click', () => this.newDeck());
        this.exportBtn.addEventListener('click', () => this.showExportModal());
        this.importBtn.addEventListener('click', () => this.showImportModal());

        // Deck name
        this.deckNameInput.addEventListener('change', () => {
            this.deck.name = this.deckNameInput.value;
            this.saveToStorage();
        });

        // Tabs
        this.deckTabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });

        // Drag and drop
        this.setupDragAndDrop();

        // Commander slots
        this.commanderSlot.addEventListener('click', () => this.searchForCommander());
        this.partnerSlot.addEventListener('click', () => this.searchForPartner());

        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.closeModals());
        });

        // Modal backgrounds
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeModals();
            });
        });

        // Card modal actions
        document.getElementById('modal-add-deck').addEventListener('click', () => {
            if (this.selectedCard) {
                this.addCardToDeck(this.selectedCard, 'main');
                this.closeModals();
            }
        });

        document.getElementById('modal-add-sideboard').addEventListener('click', () => {
            if (this.selectedCard) {
                this.addCardToDeck(this.selectedCard, 'sideboard');
                this.closeModals();
            }
        });

        document.getElementById('modal-add-maybe').addEventListener('click', () => {
            if (this.selectedCard) {
                this.addCardToDeck(this.selectedCard, 'maybeboard');
                this.closeModals();
            }
        });

        document.getElementById('modal-set-commander').addEventListener('click', () => {
            if (this.selectedCard) {
                this.setCommander(this.selectedCard);
                this.closeModals();
            }
        });

        // Price breakdown
        document.getElementById('show-price-breakdown').addEventListener('click', () => this.showPriceBreakdown());

        // Export options
        document.querySelectorAll('.export-options button').forEach(btn => {
            btn.addEventListener('click', () => this.exportDeck(btn.dataset.format));
        });

        document.getElementById('copy-export').addEventListener('click', () => this.copyExport());
        document.getElementById('import-confirm').addEventListener('click', () => this.importDeck());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModals();
            if (e.key === '/' && !e.target.matches('input, textarea')) {
                e.preventDefault();
                this.searchInput.focus();
            }
        });

        // Infinite scroll for search results
        this.searchResults.addEventListener('scroll', () => {
            if (this.isLoadingMore || !this.hasMoreResults) return;

            const { scrollTop, scrollHeight, clientHeight } = this.searchResults;
            // Load more when scrolled to 80% of the content
            if (scrollTop + clientHeight >= scrollHeight * 0.8) {
                this.loadMoreResults();
            }
        });

        // Context menu handlers
        this.contextMenu.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                this.handleContextMenuAction(action);
            });
        });

        // Close context menu on click outside
        document.addEventListener('click', (e) => {
            if (!this.contextMenu.contains(e.target)) {
                this.hideContextMenu();
            }
        });

        // Close context menu on scroll
        this.searchResults.addEventListener('scroll', () => {
            this.hideContextMenu();
        });
    }

    showContextMenu(cardId, x, y) {
        this.contextMenuCardId = cardId;
        const card = this.cardCache.get(cardId);

        // Position menu
        const menuWidth = 180;
        const menuHeight = 200;

        // Keep menu within viewport
        if (x + menuWidth > window.innerWidth) {
            x = window.innerWidth - menuWidth - 10;
        }
        if (y + menuHeight > window.innerHeight) {
            y = window.innerHeight - menuHeight - 10;
        }

        this.contextMenu.style.left = `${x}px`;
        this.contextMenu.style.top = `${y}px`;

        // Show/hide commander option based on card and format
        const commanderBtn = this.contextMenu.querySelector('[data-action="set-commander"]');
        const isLegendary = card?.type_line?.toLowerCase().includes('legendary') &&
                          card?.type_line?.toLowerCase().includes('creature');
        const canBeCommander = isLegendary || card?.oracle_text?.toLowerCase().includes('can be your commander');

        if (this.deck.format === 'commander' && canBeCommander) {
            commanderBtn.style.display = 'block';
        } else {
            commanderBtn.style.display = 'none';
        }

        // Show/hide sideboard option based on format
        const sideboardBtn = this.contextMenu.querySelector('[data-action="add-sideboard"]');
        const config = this.formatConfigs[this.deck.format];
        sideboardBtn.style.display = config.hasSideboard ? 'block' : 'none';

        this.contextMenu.classList.add('visible');
    }

    hideContextMenu() {
        this.contextMenu.classList.remove('visible');
        this.contextMenuCardId = null;
    }

    handleContextMenuAction(action) {
        const card = this.cardCache.get(this.contextMenuCardId);
        if (!card) {
            this.hideContextMenu();
            return;
        }

        switch (action) {
            case 'add-main':
                this.addCardToDeck(card, 'main');
                break;
            case 'add-sideboard':
                this.addCardToDeck(card, 'sideboard');
                break;
            case 'add-maybe':
                this.addCardToDeck(card, 'maybeboard');
                break;
            case 'set-commander':
                this.setCommander(card);
                break;
            case 'view-details':
                this.showCardModal(this.contextMenuCardId);
                break;
        }

        this.hideContextMenu();
    }

    setupDragAndDrop() {
        this.deckDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.deckDropZone.classList.add('drag-over');
        });

        this.deckDropZone.addEventListener('dragleave', () => {
            this.deckDropZone.classList.remove('drag-over');
        });

        this.deckDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.deckDropZone.classList.remove('drag-over');

            const cardData = e.dataTransfer.getData('application/json');
            if (cardData) {
                const card = JSON.parse(cardData);
                this.addCardToDeck(card, this.currentTab);
            }
        });
    }

    // Search functionality
    async handleSearchInput() {
        clearTimeout(this.searchTimeout);
        const query = this.searchInput.value.trim();

        if (query.length < 2) {
            return;
        }

        this.searchTimeout = setTimeout(() => this.performSearch(), 300);
    }

    async performSearch() {
        const query = this.searchInput.value.trim();
        if (!query) return;

        let searchQuery = query;

        // Build advanced search query
        if (!this.advancedSearch.classList.contains('hidden')) {
            const parts = [query];

            if (this.setFilter.value) {
                parts.push(`set:${this.setFilter.value}`);
            }
            if (this.typeFilter.value) {
                parts.push(`type:${this.typeFilter.value}`);
            }
            if (this.cmcFilter.value) {
                parts.push(`cmc:${this.cmcFilter.value}`);
            }
            if (this.rarityFilter.value) {
                parts.push(`rarity:${this.rarityFilter.value}`);
            }

            const colors = Array.from(this.colorFilters)
                .filter(cb => cb.checked)
                .map(cb => cb.value);
            if (colors.length > 0) {
                parts.push(`color<=${colors.join('')}`);
            }

            searchQuery = parts.join(' ');
        }

        // Add color identity filter for Commander format
        if (this.deck.format === 'commander' && this.deck.commander) {
            const identity = this.getColorIdentity();
            if (identity.length > 0) {
                searchQuery += ` identity<=${identity.join('')}`;
            }
        }

        await this.searchCards(searchQuery);
    }

    async searchCards(query) {
        this.showLoading();

        // Reset search state for new search
        this.currentSearchQuery = query;
        this.currentSearchResults = [];
        this.nextPageUrl = null;
        this.hasMoreResults = false;

        try {
            const response = await fetch(
                `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&order=name&unique=cards`
            );

            if (!response.ok) {
                if (response.status === 404) {
                    this.displaySearchResults([], false);
                    this.hideLoading();
                    return;
                }
                throw new Error('Search failed');
            }

            const data = await response.json();
            const cards = data.data || [];

            // Store pagination info
            this.hasMoreResults = data.has_more || false;
            this.nextPageUrl = data.next_page || null;

            // Cache individual cards
            cards.forEach(card => {
                this.cardCache.set(card.id, card);
                this.cardCache.set(card.name.toLowerCase(), card);
            });

            this.currentSearchResults = cards;
            this.displaySearchResults(cards, false);
        } catch (error) {
            console.error('Search error:', error);
            this.showToast('Search failed. Please try again.', 'error');
        }

        this.hideLoading();
    }

    async loadMoreResults() {
        if (!this.nextPageUrl || this.isLoadingMore) return;

        this.isLoadingMore = true;

        // Show loading indicator at bottom
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'loading-more';
        loadingIndicator.innerHTML = '<div class="spinner-small"></div><span>Loading more cards...</span>';
        this.searchResults.appendChild(loadingIndicator);

        try {
            const response = await fetch(this.nextPageUrl);

            if (!response.ok) {
                throw new Error('Failed to load more results');
            }

            const data = await response.json();
            const cards = data.data || [];

            // Update pagination info
            this.hasMoreResults = data.has_more || false;
            this.nextPageUrl = data.next_page || null;

            // Cache individual cards
            cards.forEach(card => {
                this.cardCache.set(card.id, card);
                this.cardCache.set(card.name.toLowerCase(), card);
            });

            // Add to current results
            this.currentSearchResults = [...this.currentSearchResults, ...cards];

            // Remove loading indicator
            loadingIndicator.remove();

            // Append new results
            this.displaySearchResults(cards, true);
        } catch (error) {
            console.error('Load more error:', error);
            this.showToast('Failed to load more cards', 'error');
            loadingIndicator.remove();
        }

        this.isLoadingMore = false;
    }

    displaySearchResults(cards, append = false) {
        if (cards.length === 0 && !append) {
            this.searchResults.innerHTML = `
                <div class="results-placeholder">
                    <p>No cards found</p>
                    <p class="hint">Try a different search term</p>
                </div>
            `;
            return;
        }

        const colorIdentity = this.deck.format === 'commander' && this.deck.commander
            ? this.getColorIdentity()
            : null;

        const cardElements = cards.map(card => {
            const imageUrl = this.getCardImage(card);
            const price = card.prices?.usd || card.prices?.usd_foil || '?';
            const isValidForDeck = this.isCardValidForDeck(card, colorIdentity);
            const warningClass = isValidForDeck ? '' : 'invalid';
            const warningLabel = this.getCardWarning(card);

            return `
                <div class="card-result ${warningClass}"
                     draggable="true"
                     data-card-id="${card.id}"
                     title="${card.name}">
                    <img src="${imageUrl}" alt="${card.name}" loading="lazy">
                    ${price !== '?' ? `<span class="card-price">$${price}</span>` : ''}
                    ${warningLabel ? `<span class="card-warning">${warningLabel}</span>` : ''}
                </div>
            `;
        }).join('');

        if (append) {
            // Append to existing grid
            const grid = this.searchResults.querySelector('.search-results-grid');
            if (grid) {
                grid.insertAdjacentHTML('beforeend', cardElements);
            }
        } else {
            // Create new grid
            const html = `
                <div class="search-results-grid">
                    ${cardElements}
                </div>
                ${this.hasMoreResults ? '<div class="scroll-hint">Scroll down for more results</div>' : ''}
            `;
            this.searchResults.innerHTML = html;
        }

        // Bind events only to new card results (or all if not appending)
        const selector = append ? '.card-result:not([data-bound])' : '.card-result';
        this.searchResults.querySelectorAll(selector).forEach(el => {
            el.setAttribute('data-bound', 'true');
            el.addEventListener('click', () => this.showCardModal(el.dataset.cardId));
            el.addEventListener('dblclick', () => {
                const card = this.cardCache.get(el.dataset.cardId);
                if (card) this.addCardToDeck(card, this.currentTab);
            });
            el.addEventListener('dragstart', (e) => {
                const card = this.cardCache.get(el.dataset.cardId);
                if (card) {
                    e.dataTransfer.setData('application/json', JSON.stringify(card));
                }
            });
            // Right-click context menu
            el.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.hideHoverPreview();
                this.showContextMenu(el.dataset.cardId, e.clientX, e.clientY);
            });
            // Hover preview events
            el.addEventListener('mouseenter', (e) => this.showHoverPreview(el.dataset.cardId, e));
            el.addEventListener('mousemove', (e) => this.updateHoverPreviewPosition(e));
            el.addEventListener('mouseleave', () => this.hideHoverPreview());
        });

        // Remove scroll hint when no more results
        if (!this.hasMoreResults) {
            const hint = this.searchResults.querySelector('.scroll-hint');
            if (hint) hint.remove();
        }
    }

    getCardImage(card) {
        if (card.image_uris?.normal) {
            return card.image_uris.normal;
        }
        if (card.card_faces?.[0]?.image_uris?.normal) {
            return card.card_faces[0].image_uris.normal;
        }
        return 'https://cards.scryfall.io/normal/front/0/0/00000000-0000-0000-0000-000000000000.jpg';
    }

    isCardValidForDeck(card, colorIdentity) {
        // Check format legality
        const format = this.deck.format;
        const legality = card.legalities?.[format];
        if (legality !== 'legal' && legality !== 'restricted') {
            return false;
        }

        // Check color identity for Commander
        if (colorIdentity && card.color_identity) {
            const cardIdentity = card.color_identity || [];
            return cardIdentity.every(c => colorIdentity.includes(c));
        }

        return true;
    }

    getCardWarning(card) {
        const format = this.deck.format;
        const legality = card.legalities?.[format];

        if (legality === 'banned') return 'BANNED';
        if (legality === 'not_legal') return 'NOT LEGAL';
        if (legality === 'restricted') return 'RESTRICTED';

        return null;
    }

    // Card modal
    async showCardModal(cardId) {
        let card = this.cardCache.get(cardId);

        if (!card) {
            this.showLoading();
            try {
                const response = await fetch(`https://api.scryfall.com/cards/${cardId}`);
                card = await response.json();
                this.cardCache.set(cardId, card);
            } catch (error) {
                console.error('Failed to fetch card:', error);
                this.hideLoading();
                return;
            }
            this.hideLoading();
        }

        this.selectedCard = card;
        this.hideHoverPreview();

        // Handle card images (including double-faced cards)
        const modalImages = document.getElementById('modal-card-images');
        const frontImage = document.getElementById('modal-card-image');
        const backImage = document.getElementById('modal-card-image-back');

        if (card.card_faces && card.card_faces.length > 1 && card.card_faces[0].image_uris) {
            // Double-faced card
            modalImages.classList.add('double-faced');
            frontImage.src = card.card_faces[0].image_uris.normal || card.card_faces[0].image_uris.large;
            backImage.src = card.card_faces[1].image_uris.normal || card.card_faces[1].image_uris.large;
            backImage.classList.remove('hidden');
        } else {
            // Single-faced card
            modalImages.classList.remove('double-faced');
            frontImage.src = this.getCardImageLarge(card);
            backImage.classList.add('hidden');
        }

        // Populate card details
        document.getElementById('modal-card-name').textContent = card.name;
        document.getElementById('modal-card-type').textContent = card.type_line || '';

        // Oracle text (handle double-faced cards)
        let oracleText = card.oracle_text || '';
        if (card.card_faces) {
            oracleText = card.card_faces.map(face =>
                `${face.name}\n${face.oracle_text || ''}`
            ).join('\n\n---\n\n');
        }
        document.getElementById('modal-card-text').textContent = oracleText;

        // Card stats (CMC, Power/Toughness, etc.)
        const statsContainer = document.getElementById('modal-card-stats');
        let statsHtml = '';

        if (card.mana_cost) {
            statsHtml += `<div class="stat-badge"><span class="label">Mana:</span><span class="value">${card.mana_cost.replace(/[{}]/g, '')}</span></div>`;
        }
        if (card.cmc !== undefined) {
            statsHtml += `<div class="stat-badge"><span class="label">CMC:</span><span class="value">${card.cmc}</span></div>`;
        }
        if (card.power && card.toughness) {
            statsHtml += `<div class="stat-badge"><span class="label">P/T:</span><span class="value">${card.power}/${card.toughness}</span></div>`;
        }
        if (card.loyalty) {
            statsHtml += `<div class="stat-badge"><span class="label">Loyalty:</span><span class="value">${card.loyalty}</span></div>`;
        }
        if (card.rarity) {
            statsHtml += `<div class="stat-badge"><span class="label">Rarity:</span><span class="value">${card.rarity}</span></div>`;
        }
        statsContainer.innerHTML = statsHtml;

        // Set info
        const setInfo = document.getElementById('modal-set-info');
        setInfo.innerHTML = `
            <span>${card.set_name || 'Unknown Set'}</span>
            <span>#${card.collector_number || '?'}</span>
            <span>${card.released_at || ''}</span>
        `;

        // Prices
        document.getElementById('modal-price-usd').textContent =
            card.prices?.usd ? `$${card.prices.usd}` : (card.prices?.usd_foil ? `$${card.prices.usd_foil} (foil)` : 'N/A');
        document.getElementById('modal-price-eur').textContent =
            card.prices?.eur ? `€${card.prices.eur}` : (card.prices?.eur_foil ? `€${card.prices.eur_foil} (foil)` : 'N/A');
        document.getElementById('modal-price-tix').textContent =
            card.prices?.tix ? `${card.prices.tix}` : 'N/A';

        // Legality badges
        const legalityHtml = Object.entries(card.legalities || {})
            .filter(([format]) => ['commander', 'standard', 'modern', 'legacy', 'vintage', 'pauper'].includes(format))
            .map(([format, status]) => `
                <span class="legality-badge ${status}">${format}: ${status.replace('_', ' ')}</span>
            `).join('');
        document.getElementById('modal-legality').innerHTML = legalityHtml;

        // Show/hide commander button
        const setCommanderBtn = document.getElementById('modal-set-commander');
        const isLegendary = card.type_line?.toLowerCase().includes('legendary') &&
                          card.type_line?.toLowerCase().includes('creature');
        const canBeCommander = isLegendary || card.oracle_text?.toLowerCase().includes('can be your commander');

        if (this.deck.format === 'commander' && canBeCommander) {
            setCommanderBtn.classList.remove('hidden');
        } else {
            setCommanderBtn.classList.add('hidden');
        }

        this.cardModal.classList.add('active');
    }

    // Get larger card image for modal
    getCardImageLarge(card) {
        if (card.image_uris?.large) {
            return card.image_uris.large;
        }
        if (card.image_uris?.normal) {
            return card.image_uris.normal;
        }
        if (card.card_faces?.[0]?.image_uris?.large) {
            return card.card_faces[0].image_uris.large;
        }
        if (card.card_faces?.[0]?.image_uris?.normal) {
            return card.card_faces[0].image_uris.normal;
        }
        return 'https://cards.scryfall.io/normal/front/0/0/00000000-0000-0000-0000-000000000000.jpg';
    }

    // Hover preview methods
    showHoverPreview(cardId, event) {
        const card = this.cardCache.get(cardId);
        if (!card) return;

        // Check if it's a double-faced card
        if (card.card_faces && card.card_faces.length > 1 && card.card_faces[0].image_uris) {
            this.hoverPreview.classList.add('double-faced');
            this.hoverPreviewImage.src = card.card_faces[0].image_uris.normal;
            this.hoverPreviewImageBack.src = card.card_faces[1].image_uris.normal;
            this.hoverPreviewImageBack.classList.remove('hidden');
        } else {
            this.hoverPreview.classList.remove('double-faced');
            this.hoverPreviewImage.src = this.getCardImageLarge(card);
            this.hoverPreviewImageBack.classList.add('hidden');
        }

        this.updateHoverPreviewPosition(event);
        this.hoverPreview.classList.add('visible');
    }

    updateHoverPreviewPosition(event) {
        const padding = 20;
        const previewWidth = this.hoverPreview.classList.contains('double-faced') ? 420 : 270;
        const previewHeight = 370;

        let x = event.clientX + padding;
        let y = event.clientY - previewHeight / 2;

        // Keep within viewport
        if (x + previewWidth > window.innerWidth) {
            x = event.clientX - previewWidth - padding;
        }
        if (y < padding) {
            y = padding;
        }
        if (y + previewHeight > window.innerHeight - padding) {
            y = window.innerHeight - previewHeight - padding;
        }

        this.hoverPreview.style.left = `${x}px`;
        this.hoverPreview.style.top = `${y}px`;
    }

    hideHoverPreview() {
        this.hoverPreview.classList.remove('visible');
    }

    // Deck management
    addCardToDeck(card, zone = 'main') {
        if (!card) return;

        const config = this.formatConfigs[this.deck.format];
        const deckZone = this.deck[zone];

        // Check if card already exists in zone
        const existingIndex = deckZone.findIndex(c => c.id === card.id);

        if (existingIndex >= 0) {
            // Increment quantity
            const existing = deckZone[existingIndex];
            const isBasicLand = this.isBasicLand(card);
            const maxCopies = isBasicLand ? Infinity : config.maxCopies;

            if (existing.quantity < maxCopies) {
                existing.quantity++;
                this.showToast(`Added another ${card.name}`, 'success');
            } else {
                this.showToast(`Maximum copies of ${card.name} reached`, 'warning');
                return;
            }
        } else {
            // Add new card
            deckZone.push({
                ...card,
                quantity: 1
            });
            this.showToast(`Added ${card.name}`, 'success');
        }

        this.updateDeckUI();
        this.validateDeck();
        this.updateStats();
        this.saveToStorage();
    }

    removeCardFromDeck(cardId, zone = 'main') {
        const deckZone = this.deck[zone];
        const index = deckZone.findIndex(c => c.id === cardId);

        if (index >= 0) {
            deckZone.splice(index, 1);
            this.updateDeckUI();
            this.validateDeck();
            this.updateStats();
            this.saveToStorage();
        }
    }

    changeCardQuantity(cardId, zone, delta) {
        const deckZone = this.deck[zone];
        const card = deckZone.find(c => c.id === cardId);

        if (!card) return;

        const config = this.formatConfigs[this.deck.format];
        const isBasicLand = this.isBasicLand(card);
        const maxCopies = isBasicLand ? Infinity : config.maxCopies;

        card.quantity = Math.max(0, Math.min(maxCopies, card.quantity + delta));

        if (card.quantity === 0) {
            this.removeCardFromDeck(cardId, zone);
        } else {
            this.updateDeckUI();
            this.validateDeck();
            this.updateStats();
            this.saveToStorage();
        }
    }

    isBasicLand(card) {
        return this.basicLands.includes(card.name.toLowerCase()) ||
               (card.type_line?.toLowerCase().includes('basic') &&
                card.type_line?.toLowerCase().includes('land'));
    }

    // Commander
    setCommander(card, isPartner = false) {
        if (isPartner) {
            this.deck.partner = card;
            this.showToast(`${card.name} set as partner commander`, 'success');
        } else {
            this.deck.commander = card;
            this.showToast(`${card.name} set as commander`, 'success');

            // Check for partner
            const hasPartner = card.keywords?.includes('Partner') ||
                              card.oracle_text?.toLowerCase().includes('partner');

            if (hasPartner) {
                this.partnerSection.classList.remove('hidden');
            } else {
                this.partnerSection.classList.add('hidden');
                this.deck.partner = null;
            }
        }

        this.updateCommanderUI();
        this.updateColorIdentityDisplay();
        this.validateDeck();
        this.saveToStorage();
    }

    updateCommanderUI() {
        // Main commander
        if (this.deck.commander) {
            this.commanderSlot.classList.add('has-commander');
            this.commanderSlot.innerHTML = `
                <div class="commander-card" data-card-id="${this.deck.commander.id}">
                    <img src="${this.getCardImage(this.deck.commander)}" alt="${this.deck.commander.name}">
                    <div class="commander-info">
                        <h3>${this.deck.commander.name}</h3>
                        <p>${this.deck.commander.type_line}</p>
                        <button class="btn btn-small btn-danger commander-remove-btn">Remove</button>
                    </div>
                </div>
            `;
            // Bind events for commander card
            const commanderCard = this.commanderSlot.querySelector('.commander-card');
            commanderCard.style.cursor = 'pointer';
            commanderCard.addEventListener('click', (e) => {
                if (!e.target.classList.contains('commander-remove-btn')) {
                    this.showCardModal(this.deck.commander.id);
                }
            });
            commanderCard.addEventListener('mouseenter', (e) => this.showHoverPreview(this.deck.commander.id, e));
            commanderCard.addEventListener('mousemove', (e) => this.updateHoverPreviewPosition(e));
            commanderCard.addEventListener('mouseleave', () => this.hideHoverPreview());
            this.commanderSlot.querySelector('.commander-remove-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeCommander();
            });
        } else {
            this.commanderSlot.classList.remove('has-commander');
            this.commanderSlot.innerHTML = `
                <div class="commander-placeholder">
                    <span>Search and select a Commander</span>
                </div>
            `;
        }

        // Partner
        if (this.deck.partner) {
            this.partnerSlot.classList.add('has-commander');
            this.partnerSlot.innerHTML = `
                <div class="commander-card" data-card-id="${this.deck.partner.id}">
                    <img src="${this.getCardImage(this.deck.partner)}" alt="${this.deck.partner.name}">
                    <div class="commander-info">
                        <h3>${this.deck.partner.name}</h3>
                        <p>${this.deck.partner.type_line}</p>
                        <button class="btn btn-small btn-danger partner-remove-btn">Remove</button>
                    </div>
                </div>
            `;
            // Bind events for partner card
            const partnerCard = this.partnerSlot.querySelector('.commander-card');
            partnerCard.style.cursor = 'pointer';
            partnerCard.addEventListener('click', (e) => {
                if (!e.target.classList.contains('partner-remove-btn')) {
                    this.showCardModal(this.deck.partner.id);
                }
            });
            partnerCard.addEventListener('mouseenter', (e) => this.showHoverPreview(this.deck.partner.id, e));
            partnerCard.addEventListener('mousemove', (e) => this.updateHoverPreviewPosition(e));
            partnerCard.addEventListener('mouseleave', () => this.hideHoverPreview());
            this.partnerSlot.querySelector('.partner-remove-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.removePartner();
            });
        } else if (!this.partnerSection.classList.contains('hidden')) {
            this.partnerSlot.classList.remove('has-commander');
            this.partnerSlot.innerHTML = `
                <div class="commander-placeholder">
                    <span>Select a Partner</span>
                </div>
            `;
        }
    }

    removeCommander() {
        this.deck.commander = null;
        this.deck.partner = null;
        this.partnerSection.classList.add('hidden');
        this.updateCommanderUI();
        this.updateColorIdentityDisplay();
        this.validateDeck();
        this.saveToStorage();
    }

    removePartner() {
        this.deck.partner = null;
        this.updateCommanderUI();
        this.updateColorIdentityDisplay();
        this.validateDeck();
        this.saveToStorage();
    }

    getColorIdentity() {
        const identity = new Set();

        if (this.deck.commander?.color_identity) {
            this.deck.commander.color_identity.forEach(c => identity.add(c));
        }
        if (this.deck.partner?.color_identity) {
            this.deck.partner.color_identity.forEach(c => identity.add(c));
        }

        return Array.from(identity);
    }

    updateColorIdentityDisplay() {
        const identity = this.getColorIdentity();

        if (identity.length === 0) {
            this.colorIdentityDisplay.innerHTML = '<span class="mana mana-c">C</span>';
            return;
        }

        const colorOrder = ['W', 'U', 'B', 'R', 'G'];
        const sortedIdentity = identity.sort((a, b) =>
            colorOrder.indexOf(a) - colorOrder.indexOf(b)
        );

        this.colorIdentityDisplay.innerHTML = sortedIdentity
            .map(c => `<span class="mana mana-${c.toLowerCase()}">${c}</span>`)
            .join('');
    }

    searchForCommander() {
        this.searchInput.value = 'type:legendary type:creature';
        this.performSearch();
        this.showToast('Search for your commander', 'info');
    }

    searchForPartner() {
        this.searchInput.value = 'keyword:partner type:legendary type:creature';
        this.performSearch();
        this.showToast('Search for a partner commander', 'info');
    }

    // UI Updates
    updateDeckUI() {
        const zone = this.deck[this.currentTab];
        const config = this.formatConfigs[this.deck.format];

        // Update count
        const totalCards = this.deck.main.reduce((sum, c) => sum + c.quantity, 0) +
            (this.deck.format === 'commander' && this.deck.commander ? 1 : 0) +
            (this.deck.partner ? 1 : 0);

        this.deckCount.textContent = totalCards;
        this.deckTarget.textContent = config.minCards;

        // Group cards by type
        const categories = this.categorizeCards(zone);

        // Hide drop zone if there are cards
        if (zone.length > 0) {
            this.deckDropZone.classList.add('hidden');
        } else {
            this.deckDropZone.classList.remove('hidden');
        }

        // Render deck list
        let html = '';

        for (const [category, cards] of Object.entries(categories)) {
            if (cards.length === 0) continue;

            const categoryCount = cards.reduce((sum, c) => sum + c.quantity, 0);

            html += `
                <div class="deck-category">
                    <div class="deck-category-header">
                        <h4>${category}</h4>
                        <span>${categoryCount}</span>
                    </div>
                    ${cards.map(card => this.renderDeckCard(card)).join('')}
                </div>
            `;
        }

        this.deckList.innerHTML = html;

        // Bind events
        this.deckList.querySelectorAll('.deck-card-item').forEach(el => {
            const cardId = el.dataset.cardId;

            el.querySelector('.qty-minus')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.changeCardQuantity(cardId, this.currentTab, -1);
            });

            el.querySelector('.qty-plus')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.changeCardQuantity(cardId, this.currentTab, 1);
            });

            el.querySelector('.card-remove')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeCardFromDeck(cardId, this.currentTab);
            });

            // Click anywhere on card row to open modal
            el.addEventListener('click', () => {
                this.showCardModal(cardId);
            });

            // Hover preview for deck cards
            el.addEventListener('mouseenter', (e) => this.showHoverPreview(cardId, e));
            el.addEventListener('mousemove', (e) => this.updateHoverPreviewPosition(e));
            el.addEventListener('mouseleave', () => this.hideHoverPreview());
        });
    }

    categorizeCards(cards) {
        const categories = {
            'Creatures': [],
            'Instants': [],
            'Sorceries': [],
            'Artifacts': [],
            'Enchantments': [],
            'Planeswalkers': [],
            'Lands': [],
            'Other': []
        };

        cards.forEach(card => {
            const type = card.type_line?.toLowerCase() || '';

            if (type.includes('creature')) {
                categories['Creatures'].push(card);
            } else if (type.includes('instant')) {
                categories['Instants'].push(card);
            } else if (type.includes('sorcery')) {
                categories['Sorceries'].push(card);
            } else if (type.includes('artifact')) {
                categories['Artifacts'].push(card);
            } else if (type.includes('enchantment')) {
                categories['Enchantments'].push(card);
            } else if (type.includes('planeswalker')) {
                categories['Planeswalkers'].push(card);
            } else if (type.includes('land')) {
                categories['Lands'].push(card);
            } else {
                categories['Other'].push(card);
            }
        });

        return categories;
    }

    renderDeckCard(card) {
        const warnings = this.getCardValidationWarnings(card);
        const warningClass = warnings.length > 0 ? (warnings.some(w => w.type === 'error') ? 'error' : 'warning') : '';
        const manaHtml = this.renderManaCost(card.mana_cost);
        const price = card.prices?.usd ? `$${(parseFloat(card.prices.usd) * card.quantity).toFixed(2)}` : '';

        return `
            <div class="deck-card-item ${warningClass}" data-card-id="${card.id}">
                <div class="card-quantity">
                    <button class="qty-minus">-</button>
                    <span>${card.quantity}</span>
                    <button class="qty-plus">+</button>
                </div>
                <div class="card-info">
                    <span class="card-name">${card.name}</span>
                    <span class="card-meta">${card.type_line?.split('—')[0]?.trim() || ''}</span>
                </div>
                <div class="card-mana">${manaHtml}</div>
                <span class="card-price-small">${price}</span>
                <button class="card-remove">×</button>
            </div>
        `;
    }

    renderManaCost(manaCost) {
        if (!manaCost) return '';

        const manaMap = {
            'W': 'mana-w',
            'U': 'mana-u',
            'B': 'mana-b',
            'R': 'mana-r',
            'G': 'mana-g',
            'C': 'mana-c'
        };

        return manaCost.replace(/\{([^}]+)\}/g, (match, symbol) => {
            const className = manaMap[symbol] || 'mana-c';
            return `<span class="mana-symbol ${className}">${symbol}</span>`;
        });
    }

    // Validation
    validateDeck() {
        const messages = [];
        const config = this.formatConfigs[this.deck.format];
        const colorIdentity = this.getColorIdentity();

        // Total card count
        const mainCount = this.deck.main.reduce((sum, c) => sum + c.quantity, 0);
        const commanderCount = this.deck.commander ? 1 : 0;
        const partnerCount = this.deck.partner ? 1 : 0;
        const totalCount = mainCount + commanderCount + partnerCount;

        if (totalCount < config.minCards) {
            messages.push({
                type: 'warning',
                text: `Deck needs ${config.minCards - totalCount} more cards (${totalCount}/${config.minCards})`
            });
        }

        if (config.maxCards !== Infinity && totalCount > config.maxCards) {
            messages.push({
                type: 'error',
                text: `Deck has too many cards (${totalCount}/${config.maxCards})`
            });
        }

        // Commander requirement
        if (config.hasCommander && !this.deck.commander) {
            messages.push({
                type: 'error',
                text: 'No commander selected'
            });
        }

        // Check each card
        for (const card of this.deck.main) {
            const cardWarnings = this.getCardValidationWarnings(card);
            messages.push(...cardWarnings);
        }

        // Check sideboard
        for (const card of this.deck.sideboard) {
            const cardWarnings = this.getCardValidationWarnings(card, 'sideboard');
            messages.push(...cardWarnings);
        }

        // Update UI
        this.updateValidationUI(messages);

        return messages.filter(m => m.type === 'error').length === 0;
    }

    getCardValidationWarnings(card, zone = 'main') {
        const warnings = [];
        const config = this.formatConfigs[this.deck.format];
        const format = this.deck.format;

        // Check legality
        const legality = card.legalities?.[format];
        if (legality === 'banned') {
            warnings.push({
                type: 'error',
                text: `${card.name} is banned in ${format}`
            });
        } else if (legality === 'not_legal') {
            warnings.push({
                type: 'error',
                text: `${card.name} is not legal in ${format}`
            });
        } else if (legality === 'restricted' && card.quantity > 1) {
            warnings.push({
                type: 'error',
                text: `${card.name} is restricted to 1 copy in ${format}`
            });
        }

        // Check copy limit
        if (!this.isBasicLand(card) && card.quantity > config.maxCopies) {
            warnings.push({
                type: 'error',
                text: `Too many copies of ${card.name} (max ${config.maxCopies})`
            });
        }

        // Check color identity for Commander
        if (format === 'commander' && this.deck.commander) {
            const colorIdentity = this.getColorIdentity();
            const cardIdentity = card.color_identity || [];

            if (!cardIdentity.every(c => colorIdentity.includes(c))) {
                warnings.push({
                    type: 'error',
                    text: `${card.name} is outside commander's color identity`
                });
            }
        }

        return warnings;
    }

    updateValidationUI(messages) {
        const errors = messages.filter(m => m.type === 'error');
        const warnings = messages.filter(m => m.type === 'warning');

        if (errors.length > 0) {
            this.validationStatus.textContent = `${errors.length} error(s)`;
            this.validationStatus.className = 'validation-status invalid';
        } else if (warnings.length > 0) {
            this.validationStatus.textContent = `${warnings.length} warning(s)`;
            this.validationStatus.className = 'validation-status warning';
        } else {
            this.validationStatus.textContent = 'Valid';
            this.validationStatus.className = 'validation-status valid';
        }

        this.validationMessages.innerHTML = messages
            .map(m => `<li class="${m.type}">${m.text}</li>`)
            .join('');
    }

    // Statistics
    updateStats() {
        this.updateManaCurve();
        this.updateColorDistribution();
        this.updateTypeBreakdown();
        this.updatePrices();
        this.updateProgress();
    }

    updateManaCurve() {
        const curve = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, '7+': 0 };

        this.deck.main.forEach(card => {
            if (card.type_line?.toLowerCase().includes('land')) return;

            const cmc = card.cmc || 0;
            const bucket = cmc >= 7 ? '7+' : cmc;
            curve[bucket] = (curve[bucket] || 0) + card.quantity;
        });

        const maxCount = Math.max(...Object.values(curve), 1);

        this.manaCurve.querySelectorAll('.curve-bar').forEach(bar => {
            const cmc = bar.dataset.cmc;
            const count = curve[cmc] || 0;
            const height = (count / maxCount) * 100;

            const barEl = bar.querySelector('.bar');
            barEl.innerHTML = `<div class="bar-fill" style="height: ${height}%"></div>`;
            barEl.dataset.count = count;
        });
    }

    updateColorDistribution() {
        const colors = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };

        this.deck.main.forEach(card => {
            (card.color_identity || []).forEach(c => {
                colors[c] = (colors[c] || 0) + card.quantity;
            });
            if (!card.color_identity || card.color_identity.length === 0) {
                colors.C += card.quantity;
            }
        });

        Object.entries(colors).forEach(([color, count]) => {
            const bar = this.colorDistribution.querySelector(`.color-${color.toLowerCase()}`);
            if (bar) {
                bar.querySelector('.count').textContent = count;
            }
        });
    }

    updateTypeBreakdown() {
        const types = {
            creature: 0,
            instant: 0,
            sorcery: 0,
            artifact: 0,
            enchantment: 0,
            planeswalker: 0,
            land: 0
        };

        this.deck.main.forEach(card => {
            const type = card.type_line?.toLowerCase() || '';

            if (type.includes('creature')) types.creature += card.quantity;
            if (type.includes('instant')) types.instant += card.quantity;
            if (type.includes('sorcery')) types.sorcery += card.quantity;
            if (type.includes('artifact')) types.artifact += card.quantity;
            if (type.includes('enchantment')) types.enchantment += card.quantity;
            if (type.includes('planeswalker')) types.planeswalker += card.quantity;
            if (type.includes('land')) types.land += card.quantity;
        });

        Object.entries(types).forEach(([type, count]) => {
            const el = document.querySelector(`.type-count[data-type="${type}"]`);
            if (el) el.textContent = count;
        });
    }

    updatePrices() {
        let totalUsd = 0;
        let totalEur = 0;
        let totalTix = 0;

        // Commander
        if (this.deck.commander?.prices) {
            totalUsd += parseFloat(this.deck.commander.prices.usd || 0);
            totalEur += parseFloat(this.deck.commander.prices.eur || 0);
            totalTix += parseFloat(this.deck.commander.prices.tix || 0);
        }

        // Partner
        if (this.deck.partner?.prices) {
            totalUsd += parseFloat(this.deck.partner.prices.usd || 0);
            totalEur += parseFloat(this.deck.partner.prices.eur || 0);
            totalTix += parseFloat(this.deck.partner.prices.tix || 0);
        }

        // Main deck
        this.deck.main.forEach(card => {
            const qty = card.quantity;
            totalUsd += parseFloat(card.prices?.usd || 0) * qty;
            totalEur += parseFloat(card.prices?.eur || 0) * qty;
            totalTix += parseFloat(card.prices?.tix || 0) * qty;
        });

        // Sideboard
        this.deck.sideboard.forEach(card => {
            const qty = card.quantity;
            totalUsd += parseFloat(card.prices?.usd || 0) * qty;
            totalEur += parseFloat(card.prices?.eur || 0) * qty;
            totalTix += parseFloat(card.prices?.tix || 0) * qty;
        });

        this.priceUsd.textContent = `$${totalUsd.toFixed(2)}`;
        this.priceEur.textContent = `€${totalEur.toFixed(2)}`;
        this.priceTix.textContent = totalTix.toFixed(2);
    }

    updateProgress() {
        const config = this.formatConfigs[this.deck.format];
        const mainCount = this.deck.main.reduce((sum, c) => sum + c.quantity, 0);
        const commanderCount = (this.deck.commander ? 1 : 0) + (this.deck.partner ? 1 : 0);
        const totalCount = mainCount + commanderCount;

        const progress = Math.min(100, (totalCount / config.minCards) * 100);

        this.deckProgress.style.width = `${progress}%`;
        this.progressText.textContent = `${Math.round(progress)}%`;

        // Update detail counts
        const landCount = this.deck.main
            .filter(c => c.type_line?.toLowerCase().includes('land'))
            .reduce((sum, c) => sum + c.quantity, 0);

        document.getElementById('land-count').textContent =
            `${landCount} / ${this.deck.format === 'commander' ? 37 : 24}`;

        // Ramp count (rough estimate based on card text)
        const rampCount = this.deck.main
            .filter(c => {
                const text = (c.oracle_text || '').toLowerCase();
                return text.includes('add {') ||
                       text.includes('search your library for a basic land') ||
                       text.includes('mana ability');
            })
            .reduce((sum, c) => sum + c.quantity, 0);
        document.getElementById('ramp-count').textContent = `${rampCount} / 10`;

        // Draw count
        const drawCount = this.deck.main
            .filter(c => {
                const text = (c.oracle_text || '').toLowerCase();
                return text.includes('draw a card') || text.includes('draw cards');
            })
            .reduce((sum, c) => sum + c.quantity, 0);
        document.getElementById('draw-count').textContent = `${drawCount} / 10`;

        // Removal count
        const removalCount = this.deck.main
            .filter(c => {
                const text = (c.oracle_text || '').toLowerCase();
                return text.includes('destroy target') ||
                       text.includes('exile target') ||
                       text.includes('deals') && text.includes('damage');
            })
            .reduce((sum, c) => sum + c.quantity, 0);
        document.getElementById('removal-count').textContent = `${removalCount} / 10`;
    }

    showPriceBreakdown() {
        const allCards = [
            ...(this.deck.commander ? [{ ...this.deck.commander, quantity: 1, zone: 'Commander' }] : []),
            ...(this.deck.partner ? [{ ...this.deck.partner, quantity: 1, zone: 'Partner' }] : []),
            ...this.deck.main.map(c => ({ ...c, zone: 'Main' })),
            ...this.deck.sideboard.map(c => ({ ...c, zone: 'Sideboard' }))
        ];

        // Sort by price descending
        allCards.sort((a, b) => {
            const priceA = parseFloat(a.prices?.usd || 0) * a.quantity;
            const priceB = parseFloat(b.prices?.usd || 0) * b.quantity;
            return priceB - priceA;
        });

        const tableHtml = `
            <table>
                <thead>
                    <tr>
                        <th>Card</th>
                        <th>Qty</th>
                        <th>Zone</th>
                        <th class="price-col">USD</th>
                        <th class="price-col">EUR</th>
                    </tr>
                </thead>
                <tbody>
                    ${allCards.map(card => `
                        <tr>
                            <td>${card.name}</td>
                            <td>${card.quantity}</td>
                            <td>${card.zone}</td>
                            <td class="price-col">$${((parseFloat(card.prices?.usd || 0)) * card.quantity).toFixed(2)}</td>
                            <td class="price-col">€${((parseFloat(card.prices?.eur || 0)) * card.quantity).toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        document.getElementById('price-breakdown-table').innerHTML = tableHtml;
        this.priceModal.classList.add('active');
    }

    // Format handling
    changeFormat() {
        const newFormat = this.formatSelect.value;
        this.deck.format = newFormat;

        this.updateFormatUI();
        this.validateDeck();
        this.updateStats();
        this.saveToStorage();
    }

    updateFormatUI() {
        const config = this.formatConfigs[this.deck.format];

        // Show/hide commander section
        if (config.hasCommander) {
            this.commanderSection.classList.add('visible');
        } else {
            this.commanderSection.classList.remove('visible');
        }

        // Update target count
        this.deckTarget.textContent = config.minCards;

        // Show/hide sideboard tab
        const sideboardTab = document.querySelector('[data-tab="sideboard"]');
        if (config.hasSideboard) {
            sideboardTab.classList.remove('hidden');
        } else {
            sideboardTab.classList.add('hidden');
            if (this.currentTab === 'sideboard') {
                this.switchTab('main');
            }
        }

        this.updateDeckUI();
    }

    switchTab(tab) {
        this.currentTab = tab;

        this.deckTabs.forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });

        this.updateDeckUI();
    }

    toggleAdvanced() {
        this.advancedSearch.classList.toggle('hidden');
        this.toggleAdvancedBtn.textContent =
            this.advancedSearch.classList.contains('hidden') ? 'Advanced' : 'Simple';
    }

    // Import/Export
    showExportModal() {
        this.exportModal.classList.add('active');
        this.exportDeck('text');
    }

    showImportModal() {
        document.getElementById('import-textarea').value = '';
        this.importModal.classList.add('active');
    }

    exportDeck(format) {
        let output = '';

        switch (format) {
            case 'text':
                output = this.exportAsText();
                break;
            case 'mtgo':
                output = this.exportAsMTGO();
                break;
            case 'arena':
                output = this.exportAsArena();
                break;
            case 'json':
                output = JSON.stringify(this.deck, null, 2);
                break;
        }

        document.getElementById('export-textarea').value = output;
    }

    exportAsText() {
        let output = `// ${this.deck.name}\n// Format: ${this.deck.format}\n\n`;

        if (this.deck.commander) {
            output += `// Commander\n1 ${this.deck.commander.name}\n`;
            if (this.deck.partner) {
                output += `1 ${this.deck.partner.name}\n`;
            }
            output += '\n';
        }

        output += '// Main Deck\n';
        this.deck.main.forEach(card => {
            output += `${card.quantity} ${card.name}\n`;
        });

        if (this.deck.sideboard.length > 0) {
            output += '\n// Sideboard\n';
            this.deck.sideboard.forEach(card => {
                output += `${card.quantity} ${card.name}\n`;
            });
        }

        return output;
    }

    exportAsMTGO() {
        let output = '';

        if (this.deck.commander) {
            output += `1 ${this.deck.commander.name}\n`;
            if (this.deck.partner) {
                output += `1 ${this.deck.partner.name}\n`;
            }
        }

        this.deck.main.forEach(card => {
            output += `${card.quantity} ${card.name}\n`;
        });

        if (this.deck.sideboard.length > 0) {
            output += '\nSideboard\n';
            this.deck.sideboard.forEach(card => {
                output += `${card.quantity} ${card.name}\n`;
            });
        }

        return output;
    }

    exportAsArena() {
        let output = '';

        if (this.deck.commander) {
            output += `Commander\n1 ${this.deck.commander.name}\n\n`;
        }

        output += 'Deck\n';
        this.deck.main.forEach(card => {
            const setCode = card.set?.toUpperCase() || '';
            const collectorNumber = card.collector_number || '';
            output += `${card.quantity} ${card.name} (${setCode}) ${collectorNumber}\n`;
        });

        if (this.deck.sideboard.length > 0) {
            output += '\nSideboard\n';
            this.deck.sideboard.forEach(card => {
                const setCode = card.set?.toUpperCase() || '';
                const collectorNumber = card.collector_number || '';
                output += `${card.quantity} ${card.name} (${setCode}) ${collectorNumber}\n`;
            });
        }

        return output;
    }

    async importDeck() {
        const text = document.getElementById('import-textarea').value.trim();
        if (!text) return;

        this.showLoading();

        const lines = text.split('\n').filter(line =>
            line.trim() && !line.startsWith('//') && !line.startsWith('#')
        );

        let currentZone = 'main';
        const cardsToAdd = [];

        for (const line of lines) {
            // Check for zone markers
            if (line.toLowerCase().includes('sideboard')) {
                currentZone = 'sideboard';
                continue;
            }
            if (line.toLowerCase().includes('commander')) {
                currentZone = 'commander';
                continue;
            }
            if (line.toLowerCase() === 'deck') {
                currentZone = 'main';
                continue;
            }

            // Parse card line
            const match = line.match(/^(\d+)?\s*(.+?)(?:\s+\([A-Z0-9]+\))?(?:\s+\d+)?$/);
            if (match) {
                const quantity = parseInt(match[1]) || 1;
                const cardName = match[2].trim();

                cardsToAdd.push({ name: cardName, quantity, zone: currentZone });
            }
        }

        // Fetch card data from Scryfall
        for (const item of cardsToAdd) {
            try {
                const response = await fetch(
                    `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(item.name)}`
                );

                if (response.ok) {
                    const card = await response.json();

                    if (item.zone === 'commander') {
                        this.setCommander(card);
                    } else {
                        for (let i = 0; i < item.quantity; i++) {
                            this.addCardToDeck(card, item.zone);
                        }
                    }
                }

                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.error(`Failed to import ${item.name}:`, error);
            }
        }

        this.hideLoading();
        this.closeModals();
        this.showToast('Deck imported successfully', 'success');
    }

    copyExport() {
        const textarea = document.getElementById('export-textarea');
        textarea.select();
        document.execCommand('copy');
        this.showToast('Copied to clipboard', 'success');
    }

    // Deck management
    newDeck() {
        if (confirm('Start a new deck? Current deck will be cleared.')) {
            this.deck = {
                name: 'Untitled Deck',
                format: this.deck.format,
                commander: null,
                partner: null,
                main: [],
                sideboard: [],
                maybeboard: []
            };

            this.deckNameInput.value = this.deck.name;
            this.updateCommanderUI();
            this.updateColorIdentityDisplay();
            this.updateDeckUI();
            this.validateDeck();
            this.updateStats();
            this.saveToStorage();

            this.showToast('New deck created', 'success');
        }
    }

    // Storage
    saveToStorage() {
        try {
            localStorage.setItem('mtg-deck-builder', JSON.stringify(this.deck));
        } catch (error) {
            console.error('Failed to save deck:', error);
        }
    }

    loadFromStorage() {
        try {
            const saved = localStorage.getItem('mtg-deck-builder');
            if (saved) {
                this.deck = JSON.parse(saved);
                this.deckNameInput.value = this.deck.name;
                this.formatSelect.value = this.deck.format;

                // Cache loaded cards
                [...this.deck.main, ...this.deck.sideboard, ...this.deck.maybeboard].forEach(card => {
                    this.cardCache.set(card.id, card);
                });
                if (this.deck.commander) {
                    this.cardCache.set(this.deck.commander.id, this.deck.commander);
                }
                if (this.deck.partner) {
                    this.cardCache.set(this.deck.partner.id, this.deck.partner);
                }

                this.updateFormatUI();
                this.updateCommanderUI();
                this.updateColorIdentityDisplay();
                this.updateDeckUI();
                this.validateDeck();
                this.updateStats();
            }
        } catch (error) {
            console.error('Failed to load deck:', error);
        }
    }

    // Utilities
    closeModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
        this.selectedCard = null;
    }

    showLoading() {
        this.loadingOverlay.classList.add('active');
    }

    hideLoading() {
        this.loadingOverlay.classList.remove('active');
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        this.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

// Initialize app
const app = new MTGDeckBuilder();
