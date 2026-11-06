/* =====================================================================
   DATA & CONFIG  (edit this file to change products, categories, prices)
   ---------------------------------------------------------------------
   IMAGES: every product / category has an `image` field.
     image: ''                  -> shows the emoji placeholder (current state)
     image: 'paracetamol.webp'  -> loads assets/images/products/paracetamol.webp
   Categories use assets/images/categories/. If a file is missing or fails
   to load, the emoji placeholder is shown automatically.
   ===================================================================== */

const IMAGE_PATH = {
    products: 'assets/images/products/',
    categories: 'assets/images/categories/'
};

const FREE_DELIVERY_MIN = 499;   // ₹ — free delivery at or above this subtotal
const DELIVERY_FEE = 49;         // ₹ — charged below the minimum
const GST_RATE = 0.05;           // 5 %
const PAGE_SIZE = 10;            // products shown per "page" in the grid

const categories = [
    { name: 'Prescription', emoji: '💊', image: '', count: '2,400+ items', cat: 'prescription' },
    { name: 'OTC Medicines', emoji: '🩹', image: '', count: '1,800+ items', cat: 'otc' },
    { name: 'Wellness', emoji: '🌿', image: '', count: '950+ items', cat: 'wellness' },
    { name: 'Personal Care', emoji: '🧴', image: '', count: '1,200+ items', cat: 'personal-care' },
    { name: 'Baby Care', emoji: '👶', image: '', count: '680+ items', cat: 'baby-care' },
    { name: 'Medical Devices', emoji: '🩺', image: '', count: '420+ items', cat: 'devices' },
    { name: 'Ayurveda', emoji: '🕉️', image: '', count: '540+ items', cat: 'ayurveda' },
    { name: 'Supplements', emoji: '💪', image: '', count: '760+ items', cat: 'supplements' },
];

const allProducts = [
    { id: 1, name: 'Paracetamol 650mg (Strip of 15)', brand: 'Calpol', price: 35, mrp: 42, cat: 'otc', emoji: '💊', image: '', rating: 4.7, reviews: 1820, popular: 98, prescription: false, stock: 200, tags: ['discount'], desc: 'Fast relief from fever, headache and body ache. Each tablet contains 650mg Paracetamol IP. Safe for adults when used as directed.' },
    { id: 2, name: 'Vitamin C 1000mg Effervescent', brand: 'Limcee', price: 180, mrp: 240, cat: 'supplements', emoji: '💪', image: '', rating: 4.6, reviews: 940, popular: 89, prescription: false, stock: 150, tags: ['discount', 'new'], desc: 'Boost your immunity with 1000mg Vitamin C in delicious orange flavor. 20 effervescent tablets. Sugar-free formula.' },
    { id: 3, name: 'Digital Thermometer', brand: 'Omron', price: 349, mrp: 499, cat: 'devices', emoji: '🩺', image: '', rating: 4.8, reviews: 2100, popular: 95, prescription: false, stock: 80, tags: ['discount', 'hot'], desc: 'Accurate digital thermometer with flexible tip. Quick 10-second reading. Memory recall of last measurement. Waterproof.' },
    { id: 4, name: 'Glycomet 500mg (Strip of 20)', brand: 'USV', price: 89, mrp: 105, cat: 'prescription', emoji: '💊', image: '', rating: 4.5, reviews: 680, popular: 75, prescription: true, stock: 120, tags: ['discount', 'rx'], desc: 'Metformin Hydrochloride 500mg for type 2 diabetes management. To be taken strictly as per physician prescription.' },
    { id: 5, name: 'Pampers Premium Care Pants (M)', brand: 'Pampers', price: 899, mrp: 1199, cat: 'baby-care', emoji: '👶', image: '', rating: 4.7, reviews: 1540, popular: 92, prescription: false, stock: 60, tags: ['discount'], desc: 'Pack of 76 medium-size diaper pants for 6-11 kg babies. 12-hour dryness. Lotion-treated for sensitive skin.' },
    { id: 6, name: 'Liveasy Wellness Multivitamin', brand: 'Liveasy', price: 449, mrp: 699, cat: 'wellness', emoji: '🌿', image: '', rating: 4.4, reviews: 720, popular: 82, prescription: false, stock: 100, tags: ['discount', 'new'], desc: 'Complete daily multivitamin with 25+ essential vitamins and minerals. 60 tablets. Supports energy, immunity & bone health.' },
    { id: 7, name: 'Dettol Antiseptic Liquid 250ml', brand: 'Dettol', price: 155, mrp: 185, cat: 'personal-care', emoji: '🧴', image: '', rating: 4.8, reviews: 3200, popular: 99, prescription: false, stock: 200, tags: ['discount', 'hot'], desc: 'Trusted antiseptic liquid for first aid, personal hygiene and surface disinfection. Kills 99.9% germs.' },
    { id: 8, name: 'Ashwagandha Capsules 60s', brand: 'Himalaya', price: 299, mrp: 375, cat: 'ayurveda', emoji: '🕉️', image: '', rating: 4.5, reviews: 890, popular: 78, prescription: false, stock: 140, tags: ['discount'], desc: 'Pure Ashwagandha extract for stress relief, energy and immunity. 100% vegetarian. 60 capsules per bottle.' },
    { id: 9, name: 'Accu-Chek Active Glucometer', brand: 'Roche', price: 849, mrp: 1299, cat: 'devices', emoji: '🩺', image: '', rating: 4.6, reviews: 1280, popular: 88, prescription: false, stock: 45, tags: ['discount', 'hot'], desc: 'Complete blood glucose monitoring kit with 10 test strips. Fast 5-second results. Large memory of 500 readings.' },
    { id: 10, name: 'Crocin Advance 500mg (Strip of 15)', brand: 'GSK', price: 32, mrp: 38, cat: 'otc', emoji: '💊', image: '', rating: 4.7, reviews: 2100, popular: 96, prescription: false, stock: 180, tags: ['discount'], desc: 'Fast action formula with Optimiz technology for quick relief from headache and fever. Easy to swallow.' },
    { id: 11, name: 'Cetaphil Gentle Skin Cleanser 250ml', brand: 'Cetaphil', price: 549, mrp: 649, cat: 'personal-care', emoji: '🧴', image: '', rating: 4.6, reviews: 1850, popular: 85, prescription: false, stock: 90, tags: ['discount', 'new'], desc: 'Soap-free gentle cleanser for all skin types including sensitive skin. Dermatologist recommended. Non-comedogenic.' },
    { id: 12, name: 'Ecosprin 75mg (Strip of 14)', brand: 'USV', price: 14, mrp: 21, cat: 'prescription', emoji: '💊', image: '', rating: 4.4, reviews: 540, popular: 72, prescription: true, stock: 200, tags: ['discount', 'rx'], desc: 'Aspirin 75mg for prevention of heart attacks and strokes. To be taken only under medical supervision.' },
    { id: 13, name: 'Protein Powder 1kg Chocolate', brand: 'Optimum', price: 2199, mrp: 2999, cat: 'supplements', emoji: '💪', image: '', rating: 4.7, reviews: 1100, popular: 90, prescription: false, stock: 35, tags: ['discount', 'hot'], desc: 'Whey protein isolate with 24g protein per scoop. Delicious chocolate flavor. 33 servings per container.' },
    { id: 14, name: 'Himalaya Liv 52 Tablets 100s', brand: 'Himalaya', price: 225, mrp: 285, cat: 'ayurveda', emoji: '🕉️', image: '', rating: 4.5, reviews: 920, popular: 80, prescription: false, stock: 160, tags: ['discount'], desc: 'Ayurvedic liver tonic for healthy liver function. Improves digestion and appetite. 100 tablets.' },
    { id: 15, name: 'Huggies Wonder Pants (L)', brand: 'Huggies', price: 799, mrp: 999, cat: 'baby-care', emoji: '👶', image: '', rating: 4.6, reviews: 1340, popular: 87, prescription: false, stock: 75, tags: ['discount'], desc: 'Pack of 64 large diaper pants for 9-14 kg babies. 12-hour dryness. Soft & breathable material.' },
    { id: 16, name: 'Liveasy Calcium + Vitamin D3', brand: 'Liveasy', price: 299, mrp: 499, cat: 'wellness', emoji: '🌿', image: '', rating: 4.3, reviews: 450, popular: 70, prescription: false, stock: 110, tags: ['discount', 'new'], desc: 'Calcium 500mg + Vitamin D3 250IU for strong bones and teeth. 30 chewable tablets. Orange flavor.' },
    { id: 17, name: 'Pulse Oximeter Fingertip', brand: 'BPL', price: 1099, mrp: 1799, cat: 'devices', emoji: '🩺', image: '', rating: 4.5, reviews: 670, popular: 84, prescription: false, stock: 55, tags: ['discount', 'hot'], desc: 'Accurately measures blood oxygen saturation (SpO2) and pulse rate. OLED display. Auto power-off.' },
    { id: 18, name: 'Iodex Balm 50g', brand: 'Iodex', price: 125, mrp: 145, cat: 'personal-care', emoji: '🧴', image: '', rating: 4.4, reviews: 720, popular: 76, prescription: false, stock: 130, tags: ['discount'], desc: 'Fast pain relief balm for muscular pain, joint pain and backache. Trusted for over 100 years.' },
    { id: 19, name: 'Zincovit Tablets 15s', brand: 'Apex', price: 95, mrp: 120, cat: 'supplements', emoji: '💪', image: '', rating: 4.5, reviews: 380, popular: 74, prescription: false, stock: 160, tags: ['discount'], desc: 'Multivitamin with zinc for immunity boost. 15 tablets. Especially useful during viral infections.' },
    { id: 20, name: 'Triphala Churna 120g', brand: 'Dabur', price: 160, mrp: 200, cat: 'ayurveda', emoji: '🕉️', image: '', rating: 4.6, reviews: 560, popular: 79, prescription: false, stock: 120, tags: ['discount'], desc: 'Traditional Ayurvedic formula for digestive health and constipation relief. Made from 3 fruits.' },
];
