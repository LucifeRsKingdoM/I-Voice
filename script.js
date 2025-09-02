// Initialize variables
let db;
let currentUser;

// Wait for Supabase to be ready
async function waitForSupabase() {
    let attempts = 0;
    while (!window.supabaseClient && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    if (!window.supabaseClient) {
        throw new Error('Supabase client not available');
    }
    return window.supabaseClient;
}

// Database helper functions for Supabase
const DB = {
    getCurrentUser() {
        const user = sessionStorage.getItem('ivoice_current_user');
        return user ? JSON.parse(user) : null;
    },

    async waitForSupabase() {
        while (!window.supabaseClient) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return window.supabaseClient;
    },

    async getParties() {
        try {
            const supabase = await this.waitForSupabase();
            const user = this.getCurrentUser();
            if (!user) throw new Error('User not found');

            const { data, error } = await supabase
                .from('parties')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching parties:', error);
            return [];
        }
    },

    async addParty(party) {
        try {
            const supabase = await this.waitForSupabase();
            const user = this.getCurrentUser();
            if (!user) throw new Error('User not found');

            const { data, error } = await supabase
                .from('parties')
                .insert([{ ...party, user_id: user.id }])
                .select()
                .single();
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error adding party:', error);
            throw error;
        }
    },

    async getItems() {
        try {
            const supabase = await this.waitForSupabase();
            const user = this.getCurrentUser();
            if (!user) throw new Error('User not found');

            const { data, error } = await supabase
                .from('items')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching items:', error);
            return [];
        }
    },

    async addItem(item) {
        try {
            const supabase = await this.waitForSupabase();
            const user = this.getCurrentUser();
            if (!user) throw new Error('User not found');

            const { data, error } = await supabase
                .from('items')
                .insert([{ ...item, user_id: user.id }])
                .select()
                .single();
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error adding item:', error);
            throw error;
        }
    },

    async getInvoices() {
        try {
            const supabase = await this.waitForSupabase();
            const user = this.getCurrentUser();
            if (!user) throw new Error('User not found');

            const { data, error } = await supabase
                .from('invoices')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching invoices:', error);
            return [];
        }
    },

    async addInvoice(invoice) {
        try {
            const supabase = await this.waitForSupabase();
            const user = this.getCurrentUser();
            if (!user) throw new Error('User not found');

            const { data, error } = await supabase
                .from('invoices')
                .insert([{ ...invoice, user_id: user.id }])
                .select()
                .single();
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error adding invoice:', error);
            throw error;
        }
    },

    async deleteInvoice(id) {
        try {
            const supabase = await this.waitForSupabase();
            const { error } = await supabase
                .from('invoices')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
        } catch (error) {
            console.error('Error deleting invoice:', error);
            throw error;
        }
    },

    async getNextInvoiceNumber() {
        try {
            const supabase = await this.waitForSupabase();
            const user = this.getCurrentUser();
            if (!user) throw new Error('User not found');

            const { data, error } = await supabase
                .from('invoices')
                .select('invoice_number')
                .eq('user_id', user.id)
                .order('invoice_number', { ascending: false })
                .limit(1);
            
            if (error) throw error;
            
            if (data && data.length > 0) {
                const lastNumber = parseInt(data[0].invoice_number);
                return isNaN(lastNumber) ? 1001 : lastNumber + 1;
            }
            return 1001;
        } catch (error) {
            console.error('Error getting next invoice number:', error);
            return 1001;
        }
    }
};


// Initialize app
document.addEventListener('DOMContentLoaded', async function() {
    try {
        checkAuth();
        await initDatabase();
        await loadUserData();
        updateDashboard();
        setTodayDate();
        console.log('✅ App initialized successfully');
    } catch (error) {
        console.error('❌ App initialization failed:', error);
        showNotification('Using offline mode', 'warning');
    }
});

// Authentication
function checkAuth() {
    const user = sessionStorage.getItem('ivoice_current_user');
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    currentUser = JSON.parse(user);
    document.getElementById('userName').textContent = `Welcome, ${currentUser.name}!`;
}

function logout() {
    sessionStorage.removeItem('ivoice_current_user');
    window.location.href = 'index.html';
}

// Professional Notification System
function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    if (!container) return;
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    notification.innerHTML = `
        ${message}
        <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 300);
        }
    }, 5000);
}

// Custom Confirmation Modal
function showConfirm(message, callback) {
    const modal = document.getElementById('confirmModal');
    if (!modal) {
        const modalHTML = `
            <div id="confirmModal" class="modal">
                <div class="confirm-dialog">
                    <p id="confirmMessage"></p>
                    <div class="confirm-buttons">
                        <button id="confirmOk" class="btn btn-primary">OK</button>
                        <button id="confirmCancel" class="btn btn-secondary">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    const confirmModal = document.getElementById('confirmModal');
    document.getElementById('confirmMessage').textContent = message;
    confirmModal.classList.add('active');
    
    const cleanup = () => {
        confirmModal.classList.remove('active');
        document.getElementById('confirmOk').removeEventListener('click', onOk);
        document.getElementById('confirmCancel').removeEventListener('click', onCancel);
        confirmModal.removeEventListener('click', onBackdropClick);
    };
    
    const onOk = () => {
        cleanup();
        callback(true);
    };
    
    const onCancel = () => {
        cleanup();
        callback(false);
    };
    
    const onBackdropClick = (e) => {
        if (e.target === confirmModal) {
            cleanup();
            callback(false);
        }
    };
    
    document.getElementById('confirmOk').addEventListener('click', onOk);
    document.getElementById('confirmCancel').addEventListener('click', onCancel);
    confirmModal.addEventListener('click', onBackdropClick);
}

// Initialize database with proper invoice numbering
async function initDatabase() {
    try {
        db = {
            parties: await DB.getParties(),
            items: await DB.getItems(),
            invoices: await DB.getInvoices(),
            nextInvoiceId: await DB.getNextInvoiceNumber()
        };
        console.log('✅ Database initialized with Supabase data');
    } catch (error) {
        console.error('❌ Database initialization error:', error);
        showNotification('Error connecting to database: ' + error.message, 'error');
        
        // Fallback to localStorage
        const dbKey = 'ivoice_db_' + currentUser.id;
        let dbData = localStorage.getItem(dbKey);
        if (!dbData) {
            dbData = JSON.stringify({
                parties: [],
                items: [],
                invoices: [],
                nextInvoiceId: 1001
            });
            localStorage.setItem(dbKey, dbData);
        }
        
        db = JSON.parse(dbData);
        
        if (!db.nextInvoiceId) {
            const maxInvoiceNum = db.invoices.length > 0 
                ? Math.max(...db.invoices.map(inv => parseInt(inv.invoiceNumber) || 1000))
                : 1000;
            db.nextInvoiceId = maxInvoiceNum + 1;
            saveDatabase();
        }
    }
}

function saveDatabase() {
    const dbKey = 'ivoice_db_' + currentUser.id;
    localStorage.setItem(dbKey, JSON.stringify(db));
}

// Tab management
function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');
    
    switch(tabName) {
        case 'parties':
            loadParties();
            break;
        case 'items':
            loadItems();
            break;
        case 'invoices':
            loadInvoices();
            break;
        case 'dashboard':
            updateDashboard();
            break;
    }
}

// Dashboard functions
function updateDashboard() {
    if (!db || !db.invoices) return;
    
    const totalSales = db.invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const totalOutstanding = db.invoices.reduce((sum, inv) => sum + (inv.paid ? 0 : (inv.balance || 0)), 0);
    
    document.getElementById('totalSales').textContent = `₹${totalSales.toFixed(2)}`;
    document.getElementById('totalOutstanding').textContent = `₹${totalOutstanding.toFixed(2)}`;
    document.getElementById('totalItems').textContent = db.items ? db.items.length : 0;
    document.getElementById('totalParties').textContent = db.parties ? db.parties.length : 0;
    
    loadDashboardInvoices();
}

// Load recent invoices on dashboard
function loadDashboardInvoices() {
    const container = document.getElementById('dashboardInvoicesList');
    if (!container) return;
    
    container.innerHTML = '';
    if (!db || !db.invoices) return;
    
    const recentInvoices = [...db.invoices]
        .sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0))
        .slice(0, 5);
    
    if (recentInvoices.length === 0) {
        container.innerHTML = '<p style="color: #666; text-align: center;">No invoices found</p>';
        return;
    }
    
    recentInvoices.forEach(invoice => {
        const party = db.parties.find(p => p.id === (invoice.party_id || invoice.partyId));
        const div = document.createElement('div');
        div.className = 'dashboard-invoice-item';
        div.innerHTML = `
            <div class="invoice-info">
                <strong>Invoice #${invoice.invoice_number || invoice.invoiceNumber}</strong>
                <span>${party ? party.name : 'Unknown Party'}</span>
                <span>${new Date(invoice.date).toLocaleDateString()}</span>
            </div>
            <div class="invoice-amount">₹${(invoice.total || 0).toFixed(2)}</div>
        `;
        div.addEventListener('click', () => viewInvoicePDF(invoice.id));
        container.appendChild(div);
    });
}

// Party management
function loadParties() {
    const container = document.getElementById('partiesList');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!db.parties || db.parties.length === 0) {
        container.innerHTML = '<div style="padding: 2rem; text-align: center; color: #666;">No parties added yet. Click "New Party" to get started.</div>';
        return;
    }
    
    db.parties.forEach(party => {
        const outstanding = calculatePartyOutstanding(party.id);
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
            <div class="item-info">
                <div>
                    <div class="item-name">${party.name}</div>
                    <div class="item-details">${party.phone || ''} ${party.email ? '• ' + party.email : ''}</div>
                </div>
                <div class="item-amount">₹${outstanding.toFixed(2)}</div>
            </div>
        `;
        container.appendChild(item);
    });
}

function calculatePartyOutstanding(partyId) {
    return db.invoices
        .filter(inv => (inv.partyId === partyId || inv.party_id === partyId) && !inv.paid)
        .reduce((sum, inv) => sum + (inv.balance || 0), 0);
}

function searchParties() {
    const searchTerm = document.getElementById('partySearch').value.toLowerCase();
    const items = document.querySelectorAll('#partiesList .list-item');
    
    items.forEach(item => {
        const name = item.querySelector('.item-name').textContent.toLowerCase();
        if (name.includes(searchTerm)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

function showAddPartyModal() {
    document.getElementById('addPartyModal').classList.add('active');
}

// Updated addParty function with Supabase
async function addParty(event) {
    event.preventDefault();
    
    try {
        const party = {
            name: document.getElementById('partyName').value,
            phone: document.getElementById('partyPhone').value,
            email: document.getElementById('partyEmail').value,
            gst_number: document.getElementById('partyGST').value,
            address: document.getElementById('partyAddress').value,
            state: document.getElementById('partyState').value
        };

        const newParty = await DB.addParty(party);
        db.parties.push(newParty);
        
        closeModal('addPartyModal');
        loadParties();
        updateDashboard();
        
        document.querySelector('#addPartyModal form').reset();
        showNotification('Party added successfully!', 'success');
        
    } catch (error) {
        console.error('Error adding party:', error);
        
        // Fallback to localStorage
        const party = {
            id: Date.now(),
            name: document.getElementById('partyName').value,
            phone: document.getElementById('partyPhone').value,
            email: document.getElementById('partyEmail').value,
            gstNumber: document.getElementById('partyGST').value,
            address: document.getElementById('partyAddress').value,
            state: document.getElementById('partyState').value,
            createdAt: new Date().toISOString()
        };
        
        db.parties.push(party);
        saveDatabase();
        
        closeModal('addPartyModal');
        loadParties();
        updateDashboard();
        
        document.querySelector('#addPartyModal form').reset();
        showNotification('Party added successfully (offline)!', 'success');
    }
}

// Item management
function loadItems() {
    const container = document.getElementById('itemsList');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!db.items || db.items.length === 0) {
        container.innerHTML = '<div style="padding: 2rem; text-align: center; color: #666;">No items added yet. Click "New Item" to get started.</div>';
        return;
    }
    
    db.items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'list-item';
        itemDiv.innerHTML = `
            <div class="item-info">
                <div>
                    <div class="item-name">${item.name}</div>
                    <div class="item-details">₹${item.rate}/${item.unit} • Stock: ${item.stock || 0}</div>
                </div>
                <div class="item-amount">₹${item.rate}</div>
            </div>
        `;
        container.appendChild(itemDiv);
    });
}

function searchItems() {
    const searchTerm = document.getElementById('itemSearch').value.toLowerCase();
    const items = document.querySelectorAll('#itemsList .list-item');
    
    items.forEach(item => {
        const name = item.querySelector('.item-name').textContent.toLowerCase();
        if (name.includes(searchTerm)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

function showAddItemModal() {
    document.getElementById('addItemModal').classList.add('active');
}

// Updated addItem function with Supabase
async function addItem(event) {
    event.preventDefault();
    
    try {
        const item = {
            name: document.getElementById('itemName').value,
            hsn: document.getElementById('itemHSN').value,
            unit: document.getElementById('itemUnit').value,
            rate: parseFloat(document.getElementById('itemRate').value),
            gst_rate: parseFloat(document.getElementById('itemGSTRate').value),
            stock: parseInt(document.getElementById('itemStock').value) || 0
        };

        const newItem = await DB.addItem(item);
        db.items.push(newItem);
        
        closeModal('addItemModal');
        loadItems();
        updateDashboard();
        
        document.querySelector('#addItemModal form').reset();
        showNotification('Item added successfully!', 'success');
        
    } catch (error) {
        console.error('Error adding item:', error);
        
        // Fallback to localStorage
        const item = {
            id: Date.now(),
            name: document.getElementById('itemName').value,
            hsn: document.getElementById('itemHSN').value,
            unit: document.getElementById('itemUnit').value,
            rate: parseFloat(document.getElementById('itemRate').value),
            gstRate: parseFloat(document.getElementById('itemGSTRate').value),
            stock: parseInt(document.getElementById('itemStock').value) || 0,
            createdAt: new Date().toISOString()
        };
        
        db.items.push(item);
        saveDatabase();
        
        closeModal('addItemModal');
        loadItems();
        updateDashboard();
        
        document.querySelector('#addItemModal form').reset();
        showNotification('Item added successfully (offline)!', 'success');
    }
}

// Invoice management with proper toggle functionality
function createNewInvoice() {
    // Set initial values
    const invoiceNumberInput = document.getElementById('invoiceNumber');
    const invoiceToggle = document.getElementById('invoiceNumberToggle');
    
    if (invoiceToggle) {
        // Set default toggle state (ON)
        invoiceToggle.checked = true;
        
        // Set initial invoice number and readonly state
        invoiceNumberInput.value = db.nextInvoiceId || 1001;
        invoiceNumberInput.readOnly = true;
        invoiceNumberInput.style.backgroundColor = '#f0f0f0';
        invoiceNumberInput.style.cursor = 'not-allowed';
        
        // Add toggle event listener - FIXED
        invoiceToggle.onchange = function() {
            if (this.checked) {
                // Auto mode - readonly, auto number
                invoiceNumberInput.value = db.nextInvoiceId || 1001;
                invoiceNumberInput.readOnly = true;
                invoiceNumberInput.style.backgroundColor = '#f0f0f0';
                invoiceNumberInput.style.cursor = 'not-allowed';
            } else {
                // Edit mode - editable
                invoiceNumberInput.readOnly = false;
                invoiceNumberInput.style.backgroundColor = '#fff';
                invoiceNumberInput.style.cursor = 'text';
                invoiceNumberInput.focus();
            }
        };
    } else {
        invoiceNumberInput.value = db.nextInvoiceId || 1001;
    }
    
    // Set today's date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('invoiceDate').value = today;
    
    // Clear form
    document.getElementById('receivedAmount').value = 0;
    document.getElementById('invoiceParty').value = '';
    document.getElementById('paymentType').value = 'Credit';
    document.getElementById('poDate').value = '';
    document.getElementById('poNumber').value = '';
    document.getElementById('eWayBill').value = '';
    
    // Clear and add initial item row
    const itemsSection = document.querySelector('.items-section');
    itemsSection.innerHTML = '';
    addItemRow();
    
    // Populate dropdowns
    updateItemDropdowns();
    updatePartyDropdown();
    
    // Reset totals
    document.getElementById('invoiceSubtotal').textContent = '₹0.00';
    document.getElementById('invoiceTax').textContent = '₹0.00';
    document.getElementById('invoiceTotal').textContent = '₹0.00';
    document.getElementById('balanceDue').textContent = '₹0.00';
    
    document.getElementById('invoiceModal').classList.add('active');
}

// Fixed: Add item row without clearing existing selections
function addItemRow() {
    const itemsSection = document.querySelector('.items-section');
    const newRow = document.createElement('div');
    newRow.className = 'item-row';
    newRow.innerHTML = `
        <select class="item-select" onchange="updateItemDetails(this)">
            <option value="">Select Item...</option>
        </select>
        <input type="number" class="item-qty" placeholder="Qty" min="1" onchange="calculateItemTotal(this)">
        <input type="number" class="item-rate" placeholder="Rate" step="0.01" onchange="calculateItemTotal(this)">
        <input type="number" class="item-total" placeholder="Total" readonly>
        <button type="button" class="btn-remove" onclick="removeItemRow(this)">×</button>
    `;
    
    itemsSection.appendChild(newRow);
    updateItemDropdowns(); // This now preserves existing selections
}

// Remove item row
function removeItemRow(button) {
    const row = button.closest('.item-row');
    row.remove();
    calculateInvoiceTotal();
}

// Fixed: Update dropdowns without clearing existing selections
function updateItemDropdowns() {
    if (!db.items) return;
    
    document.querySelectorAll('.item-select').forEach(select => {
        const currentValue = select.value; // Preserve current selection
        select.innerHTML = '<option value="">Select Item...</option>';
        
        db.items.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = `${item.name} (₹${item.rate}/${item.unit})`;
            if (item.id == currentValue) {
                option.selected = true; // Restore selection
            }
            select.appendChild(option);
        });
    });
}

function updatePartyDropdown() {
    const partySelect = document.getElementById('invoiceParty');
    if (!partySelect || !db.parties) return;
    
    const currentValue = partySelect.value;
    partySelect.innerHTML = '<option value="">Choose Party...</option>';
    
    db.parties.forEach(party => {
        const option = document.createElement('option');
        option.value = party.id;
        option.textContent = party.name;
        if (party.id == currentValue) {
            option.selected = true;
        }
        partySelect.appendChild(option);
    });
}

function updateItemDetails(selectElement) {
    const itemId = parseInt(selectElement.value);
    const item = db.items.find(i => i.id === itemId);
    const row = selectElement.closest('.item-row');
    
    if (item) {
        row.querySelector('.item-rate').value = item.rate;
        if (row.querySelector('.item-qty').value) {
            calculateItemTotal(row.querySelector('.item-qty'));
        }
    }
}

function calculateItemTotal(input) {
    const row = input.closest('.item-row');
    const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
    const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
    const total = qty * rate;
    
    row.querySelector('.item-total').value = total.toFixed(2);
    calculateInvoiceTotal();
}

function calculateInvoiceTotal() {
    let subtotal = 0;
    let totalTax = 0;
    
    document.querySelectorAll('.item-row').forEach(row => {
        const itemId = parseInt(row.querySelector('.item-select').value);
        const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
        const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
        
        if (itemId && qty && rate) {
            const item = db.items.find(i => i.id === itemId);
            const itemTotal = qty * rate;
            const itemTax = itemTotal * ((item?.gstRate || item?.gst_rate || 18) / 100);
            
            subtotal += itemTotal;
            totalTax += itemTax;
        }
    });
    
    const total = subtotal + totalTax;
    
    document.getElementById('invoiceSubtotal').textContent = `₹${subtotal.toFixed(2)}`;
    document.getElementById('invoiceTax').textContent = `₹${totalTax.toFixed(2)}`;
    document.getElementById('invoiceTotal').textContent = `₹${total.toFixed(2)}`;
    
    calculateBalance();
}

function calculateBalance() {
    const total = parseFloat(document.getElementById('invoiceTotal').textContent.replace('₹', '').replace(',', '')) || 0;
    const received = parseFloat(document.getElementById('receivedAmount').value) || 0;
    const balance = total - received;
    
    document.getElementById('balanceDue').textContent = `₹${balance.toFixed(2)}`;
    document.getElementById('balanceDue').style.color = balance > 0 ? '#e74c3c' : '#27ae60';
}

// Updated saveInvoice function with Supabase
async function saveInvoice() {
    const invoiceNumber = document.getElementById('invoiceNumber').value;
    const partyId = parseInt(document.getElementById('invoiceParty').value);
    const date = document.getElementById('invoiceDate').value;
    
    if (!partyId || !date || !invoiceNumber) {
        showNotification('Please fill all required fields', 'error');
        return;
    }
    
    const items = [];
    document.querySelectorAll('.item-row').forEach(row => {
        const itemId = parseInt(row.querySelector('.item-select').value);
        const qty = parseFloat(row.querySelector('.item-qty').value);
        const rate = parseFloat(row.querySelector('.item-rate').value);
        const total = parseFloat(row.querySelector('.item-total').value);
        
        if (itemId && qty && rate) {
            const item = db.items.find(i => i.id === itemId);
            items.push({ 
                item_id: itemId,
                qty, 
                rate, 
                total,
                gst_rate: item?.gstRate || item?.gst_rate || 18,
                hsn: item?.hsn || '',
                name: item?.name || ''
            });
        }
    });
    
    if (items.length === 0) {
        showNotification('Please add at least one item', 'error');
        return;
    }
    
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const tax = items.reduce((sum, item) => sum + (item.total * item.gst_rate / 100), 0);
    const total = subtotal + tax;
    const received = parseFloat(document.getElementById('receivedAmount').value) || 0;
    const balance = total - received;
    
    const invoice = {
        invoice_number: invoiceNumber,
        party_id: partyId,
        date: date,
        payment_type: document.getElementById('paymentType').value,
        po_date: document.getElementById('poDate').value || null,
        po_number: document.getElementById('poNumber').value,
        eway_bill: document.getElementById('eWayBill').value,
        items: JSON.stringify(items),
        subtotal: subtotal,
        tax: tax,
        total: total,
        received: received,
        balance: balance,
        paid: balance <= 0
    };

    try {
        const newInvoice = await DB.addInvoice(invoice);
        db.invoices.push(newInvoice);
        db.nextInvoiceId = parseInt(invoiceNumber) + 1;
        
        closeModal('invoiceModal');
        loadInvoices();
        updateDashboard();
        
        showNotification(`Invoice #${invoiceNumber} created successfully!`, 'success');
        
    } catch (error) {
        console.error('Error saving invoice:', error);
        
        // Fallback to localStorage
        const fallbackInvoice = {
            id: Date.now(),
            invoiceNumber: invoiceNumber,
            partyId,
            date,
            paymentType: document.getElementById('paymentType').value,
            poDate: document.getElementById('poDate').value,
            poNumber: document.getElementById('poNumber').value,
            eWayBill: document.getElementById('eWayBill').value,
            items,
            subtotal,
            tax,
            total,
            received,
            balance,
            paid: balance <= 0,
            createdAt: new Date().toISOString()
        };
        
        db.invoices.push(fallbackInvoice);
        db.nextInvoiceId = parseInt(invoiceNumber) + 1;
        saveDatabase();
        
        closeModal('invoiceModal');
        loadInvoices();
        updateDashboard();
        
        showNotification(`Invoice #${invoiceNumber} created successfully (offline)!`, 'success');
    }
}

function loadInvoices() {
    const container = document.getElementById('invoicesList');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!db.invoices || db.invoices.length === 0) {
        container.innerHTML = '<div style="padding: 2rem; text-align: center; color: #666;">No invoices created yet. Click "New Invoice" to get started.</div>';
        return;
    }
    
    const sortedInvoices = [...db.invoices].sort((a, b) => {
        const aNum = parseInt(a.invoiceNumber || a.invoice_number);
        const bNum = parseInt(b.invoiceNumber || b.invoice_number);
        return bNum - aNum;
    });
    
    sortedInvoices.forEach(invoice => {
        const party = db.parties.find(p => p.id === (invoice.partyId || invoice.party_id));
        const invoiceDiv = document.createElement('div');
        invoiceDiv.className = 'list-item';
        invoiceDiv.innerHTML = `
            <div class="item-info">
                <div>
                    <div class="item-name">Invoice #${invoice.invoiceNumber || invoice.invoice_number}</div>
                    <div class="item-details">
                        ${party ? party.name : 'Unknown Party'} • ${new Date(invoice.date).toLocaleDateString()}
                        <span class="invoice-status ${invoice.paid ? 'status-paid' : 'status-pending'}">
                            ${invoice.paid ? 'PAID' : 'PENDING'}
                        </span>
                    </div>
                </div>
                <div>
                    <div class="item-amount">₹${(invoice.total || 0).toFixed(2)}</div>
                    <div class="invoice-actions">
                        <button class="btn-invoice-action btn-view" onclick="viewInvoicePDF(${invoice.id})">View</button>
                        <button class="btn-invoice-action btn-share" onclick="shareInvoicePDF(${invoice.id})">Share</button>
                        <button class="btn-invoice-action btn-delete" onclick="deleteInvoice(${invoice.id})">Delete</button>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(invoiceDiv);
    });
}

// View invoice PDF function
function viewInvoicePDF(invoiceId) {
    const invoice = db.invoices.find(inv => inv.id === invoiceId);
    if (!invoice) {
        showNotification('Invoice not found!', 'error');
        return;
    }
    
    generateInvoicePDF(invoice);
}

// Share invoice PDF function
function shareInvoicePDF(invoiceId) {
    const invoice = db.invoices.find(inv => inv.id === invoiceId);
    if (!invoice) {
        showNotification('Invoice not found!', 'error');
        return;
    }
    
    generateInvoicePDF(invoice);
    showNotification('PDF downloaded for sharing!', 'info');
}

// COMPLETE PDF generation function - MOST IMPORTANT
function generateInvoicePDF(invoice) {
    const party = db.parties.find(p => p.id === (invoice.partyId || invoice.party_id));
    const { jsPDF } = window.jspdf;
    
    if (!jsPDF) {
        showNotification('PDF library not loaded. Please refresh the page.', 'error');
        return;
    }
    
    try {
        const doc = new jsPDF('p', 'pt', 'a4');
        
        // Company Header
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text('I-VOICE', 50, 50);
        
        doc.setFontSize(16);
        doc.text('INVOICE MANAGEMENT SYSTEM', 50, 75);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Professional Invoice Management', 50, 95);
        
        // Invoice Details
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.text('TAX INVOICE', 400, 50);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.text(`Invoice No: ${invoice.invoiceNumber || invoice.invoice_number}`, 400, 75);
        doc.text(`Date: ${new Date(invoice.date).toLocaleDateString('en-IN')}`, 400, 95);
        doc.text(`Place of Supply: ${party?.state || 'N/A'}`, 400, 115);
        
        // Bill To Section
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('Bill To:', 50, 150);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.text(party?.name || 'N/A', 50, 170);
        
        const address = party?.address || 'N/A';
        const addressLines = doc.splitTextToSize(address, 250);
        let yPos = 190;
        addressLines.forEach(line => {
            doc.text(line, 50, yPos);
            yPos += 15;
        });
        
        doc.text(`Phone: ${party?.phone || 'N/A'}`, 50, yPos + 10);
        if (party?.email) {
            doc.text(`Email: ${party.email}`, 50, yPos + 25);
            yPos += 15;
        }
        if (party?.gstNumber || party?.gst_number) {
            doc.text(`GSTIN: ${party.gstNumber || party.gst_number}`, 50, yPos + 25);
            yPos += 15;
        }
        doc.text(`State: ${party?.state || 'N/A'}`, 50, yPos + 25);
        
        // Items Table
        const invoiceItems = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : (invoice.items || []);
        const tableData = invoiceItems.map((item, index) => {
            const itemDetails = db.items.find(i => i.id === (item.itemId || item.item_id));
            const gstRate = item.gst_rate || itemDetails?.gst_rate || itemDetails?.gstRate || 18;
            const gstAmount = (item.total * gstRate / 100);
            
            return [
                index + 1,
                item.name || itemDetails?.name || 'N/A',
                item.hsn || itemDetails?.hsn || 'N/A',
                item.qty,
                itemDetails?.unit || 'Nos',
                `₹${item.rate.toFixed(2)}`,
                `₹${item.total.toFixed(2)}`,
                `${gstRate}%`,
                `₹${gstAmount.toFixed(2)}`,
                `₹${(item.total + gstAmount).toFixed(2)}`
            ];
        });
        
        doc.autoTable({
            startY: 320,
            head: [['#', 'Item Name', 'HSN/SAC', 'Qty', 'Unit', 'Rate', 'Amount', 'GST%', 'GST Amt', 'Total']],
            body: tableData,
            theme: 'grid',
            headStyles: { 
                fillColor: [70, 130, 180],
                textColor: [255, 255, 255],
                fontStyle: 'bold'
            },
            styles: { 
                fontSize: 9,
                cellPadding: 4
            },
            columnStyles: {
                0: { halign: 'center', cellWidth: 30 },
                1: { cellWidth: 100 },
                2: { halign: 'center', cellWidth: 50 },
                3: { halign: 'center', cellWidth: 40 },
                4: { halign: 'center', cellWidth: 40 },
                5: { halign: 'right', cellWidth: 60 },
                6: { halign: 'right', cellWidth: 70 },
                7: { halign: 'center', cellWidth: 40 },
                8: { halign: 'right', cellWidth: 60 },
                9: { halign: 'right', cellWidth: 70 }
            },
            margin: { left: 50, right: 50 }
        });
        
        let finalY = doc.lastAutoTable.finalY + 30;
        
        // Totals Section
        const totalsX = 400;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.text(`Subtotal: ₹${(invoice.subtotal || 0).toFixed(2)}`, totalsX, finalY);
        doc.text(`Total GST: ₹${(invoice.tax || 0).toFixed(2)}`, totalsX, finalY + 20);
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(`Grand Total: ₹${(invoice.total || 0).toFixed(2)}`, totalsX, finalY + 45);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.text(`Amount Received: ₹${(invoice.received || 0).toFixed(2)}`, totalsX, finalY + 65);
        doc.text(`Balance Due: ₹${(invoice.balance || 0).toFixed(2)}`, totalsX, finalY + 85);
        
        // Amount in words
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('Amount in Words:', 50, finalY + 120);
        doc.setFont('helvetica', 'normal');
        const amountWords = numberToWords(Math.floor(invoice.total || 0)) + ' Rupees Only';
        const wordsLines = doc.splitTextToSize(amountWords, 500);
        let wordsY = finalY + 140;
        wordsLines.forEach(line => {
            doc.text(line, 50, wordsY);
            wordsY += 15;
        });
        
        // Terms and Conditions
        if (finalY + 200 < 750) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.text('Terms and Conditions:', 50, 750 - 120);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.text('1. Payment is due within 30 days of invoice date.', 50, 750 - 100);
            doc.text('2. Interest @ 2% per month will be charged on overdue amounts.', 50, 750 - 85);
            doc.text('3. All disputes are subject to local jurisdiction only.', 50, 750 - 70);
            
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text('For I-Voice Invoice Management', 400, 750 - 100);
            doc.text('Authorized Signatory', 400, 750 - 70);
        }
        
        // Save PDF with proper filename
        const fileName = `Invoice_${invoice.invoiceNumber || invoice.invoice_number}_${invoice.date}.pdf`;
        doc.save(fileName);
        showNotification('PDF generated successfully!', 'success');
        
    } catch (error) {
        console.error('PDF Generation Error:', error);
        showNotification('Error generating PDF. Please try again.', 'error');
    }
}

// Updated deleteInvoice function with confirmation
async function deleteInvoice(invoiceId) {
    const invoice = db.invoices.find(inv => inv.id === invoiceId);
    if (!invoice) {
        showNotification('Invoice not found!', 'error');
        return;
    }
    
    showConfirm(`Are you sure you want to delete Invoice #${invoice.invoiceNumber || invoice.invoice_number}?`, async (confirmed) => {
        if (confirmed) {
            try {
                await DB.deleteInvoice(invoiceId);
                db.invoices = db.invoices.filter(inv => inv.id !== invoiceId);
                loadInvoices();
                updateDashboard();
                showNotification(`Invoice #${invoice.invoiceNumber || invoice.invoice_number} deleted successfully!`, 'success');
            } catch (error) {
                console.error('Error deleting invoice:', error);
                
                // Fallback to localStorage
                db.invoices = db.invoices.filter(inv => inv.id !== invoiceId);
                saveDatabase();
                loadInvoices();
                updateDashboard();
                showNotification(`Invoice #${invoice.invoiceNumber || invoice.invoice_number} deleted successfully (offline)!`, 'success');
            }
        }
    });
}

// Utility function to convert number to words
function numberToWords(num) {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    
    if (num === 0) return 'Zero';
    
    function convertHundreds(num) {
        let result = '';
        
        if (num > 99) {
            result += ones[Math.floor(num / 100)] + ' Hundred ';
            num %= 100;
        }
        
        if (num > 19) {
            result += tens[Math.floor(num / 10)] + ' ';
            num %= 10;
        } else if (num > 9) {
            result += teens[num - 10] + ' ';
            num = 0;
        }
        
        if (num > 0) {
            result += ones[num] + ' ';
        }
        
        return result;
    }
    
    const crores = Math.floor(num / 10000000);
    const lakhs = Math.floor((num % 10000000) / 100000);
    const thousands = Math.floor((num % 100000) / 1000);
    const hundreds = num % 1000;
    
    let result = '';
    
    if (crores > 0) {
        result += convertHundreds(crores) + 'Crore ';
    }
    
    if (lakhs > 0) {
        result += convertHundreds(lakhs) + 'Lakh ';
    }
    
    if (thousands > 0) {
        result += convertHundreds(thousands) + 'Thousand ';
    }
    
    if (hundreds > 0) {
        result += convertHundreds(hundreds);
    }
    
    return result.trim();
}

// Utility functions
function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    if (document.getElementById('invoiceDate')) {
        document.getElementById('invoiceDate').value = today;
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Modal click outside to close
document.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
});

// Report functions with custom modals
function generateSalesReport() {
    if (!db.invoices) return;
    
    const totalSales = db.invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const totalInvoices = db.invoices.length;
    const avgInvoice = totalInvoices > 0 ? totalSales / totalInvoices : 0;
    
    const reportContent = `
        <div class="report-modal">
            <h3>Sales Report</h3>
            <div class="report-item">
                <label>Total Sales:</label>
                <span>₹${totalSales.toFixed(2)}</span>
            </div>
            <div class="report-item">
                <label>Total Invoices:</label>
                <span>${totalInvoices}</span>
            </div>
            <div class="report-item">
                <label>Average Invoice:</label>
                <span>₹${avgInvoice.toFixed(2)}</span>
            </div>
        </div>
    `;
    
    showReportModal('Sales Report', reportContent);
}

function generatePartyReport() {
    let reportContent = '<div class="report-modal"><h3>Party Outstanding Report</h3>';
    let hasOutstanding = false;
    
    db.parties.forEach(party => {
        const outstanding = calculatePartyOutstanding(party.id);
        if (outstanding > 0) {
            reportContent += `
                <div class="report-item">
                    <label>${party.name}:</label>
                    <span>₹${outstanding.toFixed(2)}</span>
                </div>
            `;
            hasOutstanding = true;
        }
    });
    
    if (!hasOutstanding) {
        reportContent += '<p style="text-align: center; color: #666;">No outstanding amounts found.</p>';
    }
    
    reportContent += '</div>';
    showReportModal('Party Report', reportContent);
}

function generateItemReport() {
    let reportContent = '<div class="report-modal"><h3>Inventory Report</h3>';
    
    if (!db.items || db.items.length === 0) {
        reportContent += '<p style="text-align: center; color: #666;">No items in inventory.</p>';
    } else {
        db.items.forEach(item => {
            reportContent += `
                <div class="report-item">
                    <label>${item.name}:</label>
                    <span>${item.stock || 0} ${item.unit} @ ₹${item.rate}/${item.unit}</span>
                </div>
            `;
        });
    }
    
    reportContent += '</div>';
    showReportModal('Inventory Report', reportContent);
}

function showReportModal(title, content) {
    let reportModal = document.getElementById('reportModal');
    if (!reportModal) {
        const modalHTML = `
            <div id="reportModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="reportTitle"></h3>
                        <span class="close" onclick="closeModal('reportModal')">&times;</span>
                    </div>
                    <div id="reportContent"></div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        reportModal = document.getElementById('reportModal');
    }
    
    document.getElementById('reportTitle').textContent = title;
    document.getElementById('reportContent').innerHTML = content;
    reportModal.classList.add('active');
}

async function loadUserData() {
    try {
        if (!db) {
            db = { parties: [], items: [], invoices: [], nextInvoiceId: 1001 };
        }
        
        loadParties();
        loadItems();
        loadInvoices();
        showNotification(`Welcome back, ${currentUser.name}!`, 'success');
    } catch (error) {
        console.error('Error loading user data:', error);
        showNotification('Error loading data', 'error');
    }
}
