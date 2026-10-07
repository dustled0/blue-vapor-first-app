// ============ DATA ============
// Edit this file to add/remove products and customers.
// Products are displayed in the order listed here.
// Each product has a category — used to display section headers in the UI.

const HOT_WATER_PRODUCTS = [
    'Bear Brand', 'Hitzz', 'Kopiko Black', 'Kopiko Brown', 'Kopiko Supreme',
    'Kopiko White', 'Malungay', 'Milo', 'Nescafe Classic Stick', 'Nescafe Original 3 in 1'
];

const PRODUCTS = [
    // Cigarettes (A-Z)
    { name: 'Mighty Red', price: 10, category: 'Cigarettes' },
    { name: 'Mighty White', price: 10, category: 'Cigarettes' },
    { name: 'Winston', price: 11, category: 'Cigarettes' },
    // Hot Water (A-Z)
    { name: 'Bear Brand', price: 15, category: 'Hot Water' },
    { name: 'Hitzz', price: 8, category: 'Hot Water' },
    { name: 'Kopiko Black', price: 10, category: 'Hot Water' },
    { name: 'Kopiko Brown', price: 10, category: 'Hot Water' },
    { name: 'Kopiko Supreme', price: 10, category: 'Hot Water' },
    { name: 'Kopiko White', price: 10, category: 'Hot Water' },
    { name: 'Malungay', price: 8, category: 'Hot Water' },
    { name: 'Milo', price: 10, category: 'Hot Water' },
    { name: 'Nescafe Classic Stick', price: 10, category: 'Hot Water' },
    { name: 'Nescafe Original 3 in 1', price: 10, category: 'Hot Water' },
    // Drinks (A-Z)
    { name: 'C2', price: 15, category: 'Drinks' },
    { name: 'Cobra', price: 25, category: 'Drinks' },
    { name: 'Coke 1 liter', price: 50, category: 'Drinks' },
    { name: 'Coke 8oz', price: 15, category: 'Drinks' },
    { name: 'Lemon', price: 15, category: 'Drinks' },
    { name: 'Nature Spring', price: 15, category: 'Drinks' },
    { name: 'Royal 1 liter', price: 50, category: 'Drinks' },
    { name: 'Sprite 1 liter', price: 50, category: 'Drinks' },
    { name: 'Sting bottle', price: 20, category: 'Drinks' },
    { name: 'Sting plastic', price: 25, category: 'Drinks' },
    // Detergents (A-Z)
    { name: 'Ariel', price: 10, category: 'Detergents' },
    { name: 'Surf', price: 10, category: 'Detergents' },
    { name: 'Wings', price: 10, category: 'Detergents' },
    // Flakes (A-Z)
    { name: 'Fita', price: 10, category: 'Flakes' },
    { name: 'Lava Cake', price: 10, category: 'Flakes' },
    { name: 'Presto', price: 10, category: 'Flakes' },
    { name: 'Skyflakes', price: 10, category: 'Flakes' },

    // Noodles (A-Z)
    { name: 'Lucky Me Noodles - Beef', price: 12, category: 'Noodles' },
    { name: 'Lucky Me Noodles - Chicken', price: 12, category: 'Noodles' },
    { name: 'Pansit Canton - Chilimansi', price: 25, category: 'Noodles' },
    { name: 'Pansit Canton - Extra Hot Chili', price: 25, category: 'Noodles' },
    { name: 'Pansit Canton - Kalamansi', price: 25, category: 'Noodles' },
    // Shampoo (A-Z)
    { name: 'Cream Silk', price: 10, category: 'Shampoo' },
    { name: 'Head & Shoulders', price: 10, category: 'Shampoo' },
    { name: 'Keratin Gold', price: 10, category: 'Shampoo' },
    { name: 'Sunsilk', price: 10, category: 'Shampoo' },
    // Toothpaste (A-Z)
    { name: 'Colgate', price: 10, category: 'Toothpaste' },
    // Other Products (A-Z)
    { name: 'Ajinomoto', price: 8, category: 'Other Products' },
    { name: 'Barako', price: 10, category: 'Other Products' },
    { name: 'Bread', price: 40, category: 'Other Products' },
    { name: 'Crispy Fry', price: 22, category: 'Other Products' },
    { name: 'Datu Puti', price: 10, category: 'Other Products' },
    { name: 'Energen', price: 15, category: 'Other Products' },
    { name: 'Fresh Gata', price: 40, category: 'Other Products' },
    { name: 'Hot Water', price: 2, category: 'Other Products' },
    { name: 'Ice', price: 5, category: 'Other Products' },
    { name: 'Knorr Cubes', price: 10, category: 'Other Products' },
    { name: 'Magic Sarap', price: 10, category: 'Other Products' },
    { name: 'Nestea', price: 26, category: 'Other Products' },
    { name: 'Osyter Sauce', price: 10, category: 'Other Products' },
    { name: 'Rexona', price: 10, category: 'Other Products' },
    { name: 'Safeguard', price: 25, category: 'Other Products' },
    { name: 'Salabat', price: 8, category: 'Other Products' },
    { name: 'Tang orange', price: 26, category: 'Other Products' },
    { name: 'Toasted Bread', price: 15, category: 'Other Products' },
];

// Customers (A-Z)
const CUSTOMERS = [
    'Argie', 'Ate', 'Ate Buko', 'Cyril', 'Deborah', 'Denis', 'Dodong', 'Dondon',
    'Drake', 'Inday', 'James', 'Jason', 'Jessie', 'Raul', 'Ryan'
];

const HOT_WATER_FEE = 5;
// Products whose hot water fee differs from HOT_WATER_FEE
const HOT_WATER_FEE_OVERRIDES = { 'Malungay': 2 };
