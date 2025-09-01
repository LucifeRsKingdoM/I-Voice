// Initialize SQLite
let db;
let currentUser;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    initDatabase();
    loadUserData();
    updateDashboard();
    setTodayDate();
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
    sessionStorage.removeItem('ivoice_current_user');  // ✅ Only remove session
    // DON'T remove localStorage - keep the database data!
    window.location.href = 'index.html';
}


// Modern Notification System
function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
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
        // Create confirm modal if it doesn't exist
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
function initDatabase() {
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
    const totalSales = db.invoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalOutstanding = db.invoices.reduce((sum, inv) => sum + (inv.paid ? 0 : inv.balance), 0);
    
    document.getElementById('totalSales').textContent = `₹${totalSales.toFixed(2)}`;
    document.getElementById('totalOutstanding').textContent = `₹${totalOutstanding.toFixed(2)}`;
    document.getElementById('totalItems').textContent = db.items.length;
    document.getElementById('totalParties').textContent = db.parties.length;
    
    // Load recent invoices on dashboard
    loadDashboardInvoices();
}

// Load recent invoices on dashboard
function loadDashboardInvoices() {
    const container = document.getElementById('dashboardInvoicesList');
    if (!container) return;
    
    container.innerHTML = '';
    const recentInvoices = [...db.invoices]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);
    
    if (recentInvoices.length === 0) {
        container.innerHTML = '<p style="color: #666; text-align: center;">No invoices found</p>';
        return;
    }
    
    recentInvoices.forEach(invoice => {
        const party = db.parties.find(p => p.id === invoice.partyId);
        const div = document.createElement('div');
        div.className = 'dashboard-invoice-item';
        div.innerHTML = `
            <div class="invoice-info">
                <strong>Invoice #${invoice.invoiceNumber}</strong>
                <span>${party ? party.name : 'Unknown Party'}</span>
                <span>${new Date(invoice.date).toLocaleDateString()}</span>
            </div>
            <div class="invoice-amount">₹${invoice.total.toFixed(2)}</div>
        `;
        div.addEventListener('click', () => viewInvoicePDF(invoice.id));
        container.appendChild(div);
    });
}

// Party management
function loadParties() {
    const container = document.getElementById('partiesList');
    container.innerHTML = '';
    
    if (db.parties.length === 0) {
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
        .filter(inv => inv.partyId === partyId && !inv.paid)
        .reduce((sum, inv) => sum + inv.balance, 0);
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

function addParty(event) {
    event.preventDefault();
    
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
    showNotification('Party added successfully!', 'success');
}

// Item management
function loadItems() {
    const container = document.getElementById('itemsList');
    container.innerHTML = '';
    
    if (db.items.length === 0) {
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
                    <div class="item-details">₹${item.rate}/${item.unit} • Stock: ${item.stock}</div>
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

function addItem(event) {
    event.preventDefault();
    
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
    showNotification('Item added successfully!', 'success');
}

// Invoice management with fixed item row handling
function createNewInvoice() {
    // Set initial values
    const invoiceNumberInput = document.getElementById('invoiceNumber');
    const invoiceToggle = document.getElementById('invoiceNumberToggle');
    
    // Set default toggle state (ON)
    invoiceToggle.checked = true;
    
    // Set initial invoice number and readonly state
    invoiceNumberInput.value = db.nextInvoiceId;
    invoiceNumberInput.readOnly = true;
    invoiceNumberInput.style.backgroundColor = '#f0f0f0';
    
    // Add toggle event listener
    invoiceToggle.addEventListener('change', function() {
        if (this.checked) {
            // Auto mode - readonly, auto number
            invoiceNumberInput.value = db.nextInvoiceId;
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
    });
    
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
            const itemTax = itemTotal * (item?.gstRate || 18) / 100;
            
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

function saveInvoice() {
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
                itemId, 
                qty, 
                rate, 
                total,
                gstRate: item?.gstRate || 18,
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
    const tax = items.reduce((sum, item) => sum + (item.total * item.gstRate / 100), 0);
    const total = subtotal + tax;
    const received = parseFloat(document.getElementById('receivedAmount').value) || 0;
    const balance = total - received;
    
    const invoice = {
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
    
    db.invoices.push(invoice);
    db.nextInvoiceId = parseInt(invoiceNumber) + 1;
    saveDatabase();
    
    closeModal('invoiceModal');
    loadInvoices();
    updateDashboard();
    
    showNotification(`Invoice #${invoiceNumber} created successfully!`, 'success');
}

function loadInvoices() {
    const container = document.getElementById('invoicesList');
    container.innerHTML = '';
    
    if (db.invoices.length === 0) {
        container.innerHTML = '<div style="padding: 2rem; text-align: center; color: #666;">No invoices created yet. Click "New Invoice" to get started.</div>';
        return;
    }
    
    const sortedInvoices = [...db.invoices].sort((a, b) => parseInt(b.invoiceNumber) - parseInt(a.invoiceNumber));
    
    sortedInvoices.forEach(invoice => {
        const party = db.parties.find(p => p.id === invoice.partyId);
        const invoiceDiv = document.createElement('div');
        invoiceDiv.className = 'list-item';
        invoiceDiv.innerHTML = `
            <div class="item-info">
                <div>
                    <div class="item-name">Invoice #${invoice.invoiceNumber}</div>
                    <div class="item-details">
                        ${party ? party.name : 'Unknown Party'} • ${new Date(invoice.date).toLocaleDateString()}
                        <span class="invoice-status ${invoice.paid ? 'status-paid' : 'status-pending'}">
                            ${invoice.paid ? 'PAID' : 'PENDING'}
                        </span>
                    </div>
                </div>
                <div>
                    <div class="item-amount">₹${invoice.total.toFixed(2)}</div>
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

// Delete invoice with custom confirmation
function deleteInvoice(invoiceId) {
    const invoice = db.invoices.find(inv => inv.id === invoiceId);
    if (!invoice) {
        showNotification('Invoice not found!', 'error');
        return;
    }
    
    showConfirm(`Are you sure you want to delete Invoice #${invoice.invoiceNumber}?`, (confirmed) => {
        if (confirmed) {
            db.invoices = db.invoices.filter(inv => inv.id !== invoiceId);
            saveDatabase();
            loadInvoices();
            updateDashboard();
            showNotification(`Invoice #${invoice.invoiceNumber} deleted successfully!`, 'success');
        }
    });
}

// PDF generation function
function generateInvoicePDF(invoice) {
    const party = db.parties.find(p => p.id === invoice.partyId);
    const { jsPDF } = window.jspdf;
    
    if (!jsPDF) {
        showNotification('PDF library not loaded. Please refresh the page.', 'error');
        return;
    }
    
    try {
        const doc = new jsPDF('p', 'pt', 'a4');
        
        // Company Header
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('I-VOICE', 50, 50);
        
        doc.setFontSize(16);
        doc.text('INVOICE MANAGEMENT SYSTEM', 50, 75);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Powered by: I-Voice', 50, 95);
        
        // Invoice Details
        doc.setFont('helvetica', 'bold');
        doc.text('Tax Invoice', 400, 50);
        
        doc.setFont('helvetica', 'normal');
        doc.text(`Invoice No: ${invoice.invoiceNumber}`, 400, 75);
        doc.text(`Date: ${new Date(invoice.date).toLocaleDateString('en-IN')}`, 400, 95);
        doc.text(`Place of Supply: ${party?.state || 'N/A'}`, 400, 115);
        
        // Bill To Section
        doc.setFont('helvetica', 'bold');
        doc.text('Bill To:', 50, 230);
        
        doc.setFont('helvetica', 'normal');
        doc.text(party?.name || 'N/A', 50, 250);
        
        const address = party?.address || 'N/A';
        const addressLines = doc.splitTextToSize(address, 250);
        let yPos = 270;
        addressLines.forEach(line => {
            doc.text(line, 50, yPos);
            yPos += 15;
        });
        
        doc.text(`Contact: ${party?.phone || 'N/A'}`, 50, yPos + 10);
        if (party?.email) {
            doc.text(`Email: ${party.email}`, 50, yPos + 25);
            yPos += 15;
        }
        if (party?.gstNumber) {
            doc.text(`GSTIN: ${party.gstNumber}`, 50, yPos + 25);
            yPos += 15;
        }
        doc.text(`State: ${party?.state || 'N/A'}`, 50, yPos + 25);
        
        // Items Table
        const tableData = invoice.items.map((item, index) => {
            const itemDetails = db.items.find(i => i.id === item.itemId);
            return [
                index + 1,
                item.name || itemDetails?.name || 'N/A',
                item.hsn || itemDetails?.hsn || 'N/A',
                item.qty,
                itemDetails?.unit || 'Nos',
                `₹${item.rate.toFixed(2)}`,
                `₹${(item.total * item.gstRate / 100).toFixed(2)} (${item.gstRate}%)`,
                `₹${(item.total + (item.total * item.gstRate / 100)).toFixed(2)}`
            ];
        });
        
        doc.autoTable({
            startY: 380,
            head: [['#', 'Item Name', 'HSN/SAC', 'Quantity', 'Unit', 'Price/Unit', 'GST', 'Amount']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [100, 100, 100] },
            styles: { fontSize: 9 },
            margin: { left: 50, right: 50 }
        });
        
        let finalY = doc.lastAutoTable.finalY + 30;
        
        // Totals Section
        const totalsX = 400;
        doc.setFont('helvetica', 'normal');
        doc.text(`Sub Total: ₹${invoice.subtotal.toFixed(2)}`, totalsX, finalY);
        doc.text(`Total Tax: ₹${invoice.tax.toFixed(2)}`, totalsX, finalY + 20);
        
        doc.setFont('helvetica', 'bold');
        doc.text(`Total: ₹${invoice.total.toFixed(2)}`, totalsX, finalY + 40);
        doc.text(`Received: ₹${invoice.received.toFixed(2)}`, totalsX, finalY + 60);
        doc.text(`Balance: ₹${invoice.balance.toFixed(2)}`, totalsX, finalY + 80);
        
        // Amount in words
        doc.setFont('helvetica', 'bold');
        doc.text('Invoice Amount In Words:', 50, finalY + 120);
        doc.setFont('helvetica', 'normal');
        const amountWords = numberToWords(Math.floor(invoice.total)) + ' Rupees only';
        doc.text(amountWords, 50, finalY + 140);
        
        // Terms and Conditions
        if (finalY + 200 < 741) {
            doc.setFont('helvetica', 'bold');
            doc.text('Terms and Conditions:', 50, 741 - 120);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.text('Interest will be charged @22% p.a on bill if not paid as agreed upon.', 50, 741 - 100);
            doc.text('In case of any defect, kindly inform within 15 days from delivery.', 50, 741 - 85);
            doc.text('Subject to your city jurisdiction only.', 50, 741 - 70);
            
            doc.text('For: I-Voice', 400, 741 - 100);
            doc.text('Authorized Signatory', 400, 741 - 70);
        }
        
        // Save PDF
        doc.save(`Invoice_${invoice.invoiceNumber}_${invoice.date}.pdf`);
        showNotification('PDF generated successfully!', 'success');
        
    } catch (error) {
        console.error('PDF Generation Error:', error);
        showNotification('Error generating PDF. Please try again.', 'error');
    }
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
    const totalSales = db.invoices.reduce((sum, inv) => sum + inv.total, 0);
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
    
    if (db.items.length === 0) {
        reportContent += '<p style="text-align: center; color: #666;">No items in inventory.</p>';
    } else {
        db.items.forEach(item => {
            reportContent += `
                <div class="report-item">
                    <label>${item.name}:</label>
                    <span>${item.stock} ${item.unit} @ ₹${item.rate}/${item.unit}</span>
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

function loadUserData() {
    loadParties();
    loadItems();
    loadInvoices();
    updateDashboard();
    showNotification(`Welcome back, ${currentUser.name}!`, 'success');
}
