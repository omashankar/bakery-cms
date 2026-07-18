/**
 * Landing page mock data — will be replaced by CMS/backend later
 */

import { demoPhotoIds, unsplash } from "./demo-images";
import type { ProductVariantGroup } from "@/types/product";

export interface LandingProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  image: string;
  category: string;
  badge?: string;
  rating?: number;
  reviewCount?: number;
  isEggless?: boolean;
  flavours?: string[];
  inStock?: boolean;
  shapes?: string[];
  allowsMessage?: boolean;
  allowsPhotoUpload?: boolean;
  ingredients?: string;
  weights?: Array<{ label: string; price: number; serves?: string }>;
  barcode?: string;
  preparationTimeMinutes?: number;
  shelfLifeDays?: number;
  calories?: number;
  allergens?: string;
  careInstructions?: string;
  variantGroups?: ProductVariantGroup[];
}

export interface LandingCategory {
  id: string;
  name: string;
  slug: string;
  image: string;
  count: number;
}

export interface LandingTestimonial {
  id: string;
  name: string;
  role: string;
  content: string;
  avatar: string;
  rating: number;
}

export interface LandingOffer {
  id: string;
  title: string;
  description: string;
  discount: string;
  code?: string;
  image: string;
  expiresAt: string;
}

export interface LandingFaq {
  id: string;
  question: string;
  answer: string;
}

export const brandInfo = {
  name: "Monginis",
  tagline: "Crafting Sweet Memories Since 1956",
  description:
    "India's beloved bakery brand — premium cakes, pastries, and confections made with love for every celebration.",
};

export const contactInfo = {
  address: "123 Baker Street, Mumbai, Maharashtra 400001",
  phone: "+91 1800-123-4567",
  email: "hello@monginis.com",
  mapEmbedUrl:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3771.626326424726!2d72.8776559!3d19.0759837!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7c6306644edc1%3A0x5da4ed8f8d648c69!2sMumbai%2C%20Maharashtra!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin",
};

export const businessHours = [
  { day: "Monday – Saturday", hours: "9:00 AM – 9:00 PM" },
  { day: "Sunday", hours: "10:00 AM – 6:00 PM" },
  { day: "Public Holidays", hours: "10:00 AM – 4:00 PM" },
];

export const socialLinks = [
  { platform: "Instagram", href: "https://instagram.com", label: "Instagram" },
  { platform: "Facebook", href: "https://facebook.com", label: "Facebook" },
  { platform: "WhatsApp", href: "https://wa.me/", label: "WhatsApp" },
  { platform: "YouTube", href: "https://youtube.com", label: "YouTube" },
];

export const featuredProducts: LandingProduct[] = [
  {
    id: "1",
    name: "Chocolate Truffle Delight",
    slug: "chocolate-truffle-delight",
    description: "Rich Belgian chocolate layers with silky truffle ganache",
    price: 1299,
    compareAtPrice: 1599,
    image: unsplash(demoPhotoIds.chocolateCake, 600, 600),
    category: "Chocolate",
    badge: "Featured",
    rating: 4.9,
    reviewCount: 124,
    flavours: ["Chocolate", "Dark Chocolate", "Truffle"],
  },
  {
    id: "2",
    name: "Red Velvet Classic",
    slug: "red-velvet-classic",
    description: "Velvety crimson sponge with cream cheese frosting",
    price: 1149,
    image: unsplash(demoPhotoIds.redVelvet, 600, 600),
    category: "Premium",
    badge: "Bestseller",
    rating: 4.8,
  },
  {
    id: "3",
    name: "Black Forest Supreme",
    slug: "black-forest-supreme",
    description: "Cherry-filled chocolate sponge with whipped cream",
    price: 999,
    image: unsplash(demoPhotoIds.tiramisu, 600, 600),
    category: "Classic",
    rating: 4.7,
  },
  {
    id: "4",
    name: "Butterscotch Crunch",
    slug: "butterscotch-crunch",
    description: "Caramel butterscotch with crunchy praline layers",
    price: 899,
    image: unsplash(demoPhotoIds.brownieCake, 600, 600),
    category: "Classic",
    rating: 4.6,
  },
];

export const categories: LandingCategory[] = [
  {
    id: "1",
    name: "Birthday Cakes",
    slug: "birthday",
    image: unsplash(demoPhotoIds.chocolateCake, 400, 400),
    count: 48,
  },
  {
    id: "2",
    name: "Wedding Cakes",
    slug: "wedding",
    image: unsplash(demoPhotoIds.weddingCake, 400, 400),
    count: 32,
  },
  {
    id: "3",
    name: "Pastries",
    slug: "pastries",
    image: unsplash(demoPhotoIds.pastries, 400, 400),
    count: 64,
  },
  {
    id: "4",
    name: "Cupcakes",
    slug: "cupcakes",
    image: unsplash(demoPhotoIds.cupcakes, 400, 400),
    count: 24,
  },
  {
    id: "5",
    name: "Anniversary",
    slug: "anniversary",
    image: unsplash(demoPhotoIds.decoratedCake, 400, 400),
    count: 18,
  },
  {
    id: "6",
    name: "Custom Cakes",
    slug: "custom",
    image: unsplash(demoPhotoIds.cookies, 600, 600),
    count: 12,
  },
  {
    id: "7",
    name: "Photo Cakes",
    slug: "photo-cakes",
    image: unsplash(demoPhotoIds.decoratedCake, 400, 400),
    count: 22,
  },
  {
    id: "8",
    name: "Eggless Cakes",
    slug: "eggless",
    image: unsplash(demoPhotoIds.decoratedCake, 400, 400),
    count: 36,
  },
  {
    id: "9",
    name: "Seasonal",
    slug: "seasonal",
    image: unsplash(demoPhotoIds.dessertPlate, 400, 400),
    count: 15,
  },
];

export const trendingProducts: LandingProduct[] = [
  {
    id: "5",
    name: "Mango Mousse Paradise",
    slug: "mango-mousse-paradise",
    description: "Seasonal Alphonso mango mousse cake",
    price: 1099,
    image: unsplash(demoPhotoIds.dessertPlate, 600, 600),
    category: "Seasonal",
    badge: "Trending",
    rating: 4.9,
  },
  {
    id: "6",
    name: "Pistachio Rose Cake",
    slug: "pistachio-rose-cake",
    description: "Persian-inspired pistachio with rose essence",
    price: 1399,
    image: unsplash(demoPhotoIds.blushCake, 600, 600),
    category: "Premium",
    badge: "New",
    rating: 4.8,
  },
  {
    id: "7",
    name: "Tiramisu Elegance",
    slug: "tiramisu-elegance",
    description: "Italian classic with espresso-soaked layers",
    price: 1199,
    image: unsplash(demoPhotoIds.tiramisu, 600, 600),
    category: "International",
    rating: 4.7,
  },
];

export const bestSellers: LandingProduct[] = [
  {
    id: "8",
    name: "Vanilla Dream Cake",
    slug: "vanilla-dream-cake",
    description: "Classic vanilla sponge with buttercream",
    price: 749,
    image: unsplash(demoPhotoIds.decoratedCake, 600, 600),
    category: "Classic",
    badge: "Bestseller",
    rating: 4.9,
  },
  {
    id: "9",
    name: "Pineapple Gateau",
    slug: "pineapple-gateau",
    description: "Fresh pineapple with light whipped cream",
    price: 849,
    image: unsplash(demoPhotoIds.brownieCake, 600, 600),
    category: "Fruit",
    badge: "Bestseller",
    rating: 4.8,
  },
  {
    id: "10",
    name: "Choco Chip Brownie Cake",
    slug: "choco-chip-brownie-cake",
    description: "Dense brownie base with chocolate chips",
    price: 799,
    image: unsplash(demoPhotoIds.brownieCake, 600, 600),
    category: "Chocolate",
    badge: "Bestseller",
    rating: 4.7,
  },
  {
    id: "11",
    name: "Fresh Fruit Fantasy",
    slug: "fresh-fruit-fantasy",
    description: "Seasonal fresh fruits on vanilla sponge",
    price: 949,
    image: unsplash(demoPhotoIds.dessertPlate, 600, 600),
    category: "Fruit",
    badge: "Bestseller",
    rating: 4.8,
  },
];

export const weddingCakes: LandingProduct[] = [
  {
    id: "12",
    name: "Royal Tier Elegance",
    slug: "royal-tier-elegance",
    description: "5-tier masterpiece with fondant florals",
    price: 15999,
    image: unsplash(demoPhotoIds.weddingCake, 600, 800),
    category: "Wedding",
    badge: "Premium",
    rating: 5.0,
  },
  {
    id: "13",
    name: "Blush Rose Wedding",
    slug: "blush-rose-wedding",
    description: "Romantic blush tones with sugar roses",
    price: 12499,
    image: unsplash(demoPhotoIds.blushCake, 600, 800),
    category: "Wedding",
    rating: 4.9,
  },
  {
    id: "14",
    name: "Classic White Cascade",
    slug: "classic-white-cascade",
    description: "Timeless white fondant with cascading flowers",
    price: 18999,
    image: unsplash(demoPhotoIds.berryCake, 600, 800),
    category: "Wedding",
    rating: 4.9,
  },
];

export const photoCakes: LandingProduct[] = [
  {
    id: "pc-1",
    name: "Memory Lane Photo Cake",
    slug: "memory-lane-photo-cake",
    description: "Your favourite photo printed on premium vanilla fondant",
    price: 1499,
    image: unsplash(demoPhotoIds.decoratedCake, 600, 600),
    category: "Photo Cakes",
    badge: "Popular",
    rating: 4.8,
  },
  {
    id: "pc-2",
    name: "Celebration Portrait Cake",
    slug: "celebration-portrait-cake",
    description: "High-resolution edible print for birthdays and anniversaries",
    price: 1699,
    image: unsplash(demoPhotoIds.chocolateCake, 600, 600),
    category: "Photo Cakes",
    rating: 4.7,
  },
  {
    id: "pc-3",
    name: "Kids Photo Surprise",
    slug: "kids-photo-surprise",
    description: "Fun character frame with your child's photo",
    price: 1299,
    image: unsplash(demoPhotoIds.cupcakes, 600, 600),
    category: "Photo Cakes",
    badge: "New",
    rating: 4.9,
  },
  {
    id: "pc-4",
    name: "Couple Moments Cake",
    slug: "couple-moments-cake",
    description: "Romantic photo cake for anniversaries and proposals",
    price: 1899,
    image: unsplash(demoPhotoIds.weddingCake, 600, 600),
    category: "Photo Cakes",
    rating: 4.8,
  },
];

export const egglessCakes: LandingProduct[] = [
  {
    id: "eg-1",
    name: "Eggless Chocolate Fudge",
    slug: "eggless-chocolate-fudge",
    description: "Rich eggless chocolate layers with silky ganache",
    price: 1099,
    image: unsplash(demoPhotoIds.chocolateCake, 600, 600),
    category: "Eggless",
    badge: "Eggless",
    rating: 4.8,
    isEggless: true,
  },
  {
    id: "eg-2",
    name: "Eggless Vanilla Dream",
    slug: "eggless-vanilla-dream",
    description: "Classic vanilla sponge with buttercream — 100% eggless",
    price: 899,
    image: unsplash(demoPhotoIds.decoratedCake, 600, 600),
    category: "Eggless",
    badge: "Eggless",
    rating: 4.7,
    isEggless: true,
  },
  {
    id: "eg-3",
    name: "Eggless Red Velvet",
    slug: "eggless-red-velvet",
    description: "Velvety crumb with cream cheese frosting, no eggs",
    price: 1199,
    image: unsplash(demoPhotoIds.iceCreamCake, 600, 600),
    category: "Eggless",
    badge: "Bestseller",
    rating: 4.9,
    isEggless: true,
  },
  {
    id: "eg-4",
    name: "Eggless Fruit Fantasy",
    slug: "eggless-fruit-fantasy",
    description: "Fresh seasonal fruits on light eggless sponge",
    price: 999,
    image: unsplash(demoPhotoIds.dessertPlate, 600, 600),
    category: "Eggless",
    rating: 4.6,
    isEggless: true,
  },
];

export const seasonalCakes: LandingProduct[] = [
  {
    id: "ss-1",
    name: "Mango Mousse Paradise",
    slug: "mango-mousse-paradise",
    description: "Seasonal Alphonso mango mousse cake",
    price: 1099,
    image: unsplash(demoPhotoIds.dessertPlate, 600, 600),
    category: "Seasonal",
    badge: "Seasonal",
    rating: 4.9,
  },
  {
    id: "ss-2",
    name: "Strawberry Bliss",
    slug: "strawberry-bliss",
    description: "Fresh strawberries with whipped cream layers",
    price: 1149,
    image: unsplash(demoPhotoIds.decoratedCake, 600, 600),
    category: "Seasonal",
    badge: "Limited",
    rating: 4.8,
  },
  {
    id: "ss-3",
    name: "Festive Gulab Jamun Cake",
    slug: "festive-gulab-jamun-cake",
    description: "Indian festive favourite with gulab jamun topping",
    price: 1299,
    image: unsplash(demoPhotoIds.chocolateCake, 600, 600),
    category: "Seasonal",
    rating: 4.7,
  },
  {
    id: "ss-4",
    name: "Winter Spice Cake",
    slug: "winter-spice-cake",
    description: "Cinnamon and nutmeg notes with cream cheese frosting",
    price: 1049,
    image: unsplash(demoPhotoIds.cookies, 600, 600),
    category: "Seasonal",
    rating: 4.6,
  },
];

export const specialOffers: LandingOffer[] = [
  {
    id: "1",
    title: "Birthday Special",
    description: "Get 20% off on all birthday cakes above ₹999",
    discount: "20% OFF",
    code: "BDAY20",
    image: unsplash(demoPhotoIds.chocolateCake, 600, 400),
    expiresAt: "2026-12-31",
  },
  {
    id: "2",
    title: "Weekend Delight",
    description: "Buy 2 pastries and get 1 free every Saturday & Sunday",
    discount: "BOGO",
    image: unsplash(demoPhotoIds.pastries, 600, 400),
    expiresAt: "2026-12-31",
  },
  {
    id: "3",
    title: "Wedding Season",
    description: "Flat ₹2000 off on wedding cake bookings above ₹10000",
    discount: "₹2000 OFF",
    code: "WED2026",
    image: unsplash(demoPhotoIds.weddingCake, 600, 400),
    expiresAt: "2026-06-30",
  },
];

export const whyChooseUs = [
  {
    icon: "Award",
    title: "Legacy of Excellence",
    description:
      "Over six decades of baking expertise, trusted by generations of families across India.",
  },
  {
    icon: "Leaf",
    title: "Premium Ingredients",
    description:
      "Only the finest Belgian chocolate, fresh cream, and seasonal fruits in every creation.",
  },
  {
    icon: "Truck",
    title: "Same-Day Delivery",
    description:
      "Order by 2 PM for same-day delivery across 500+ cities. Freshness guaranteed.",
  },
  {
    icon: "Palette",
    title: "Custom Designs",
    description:
      "Personalized cakes crafted to your vision — from birthdays to grand weddings.",
  },
];

export const testimonials: LandingTestimonial[] = [
  {
    id: "1",
    name: "Priya Sharma",
    role: "Wedding Client",
    content:
      "Our wedding cake was absolutely stunning! Every guest asked where we got it from. The team understood our vision perfectly.",
    avatar: unsplash(demoPhotoIds.avatarWoman, 100, 100),
    rating: 5,
  },
  {
    id: "2",
    name: "Rahul Mehta",
    role: "Regular Customer",
    content:
      "Been ordering birthday cakes for my kids for 10 years. Consistent quality, beautiful designs, and always on time.",
    avatar: unsplash(demoPhotoIds.avatarMan, 100, 100),
    rating: 5,
  },
  {
    id: "3",
    name: "Ananya Patel",
    role: "Corporate Client",
    content:
      "We order pastries for all our office events. Professional service, premium taste, and great bulk pricing.",
    avatar: unsplash(demoPhotoIds.avatarWoman, 100, 100),
    rating: 5,
  },
];

export const galleryImages = [
  unsplash(demoPhotoIds.chocolateCake, 600, 750),
  unsplash(demoPhotoIds.blushCake, 600, 600),
  unsplash(demoPhotoIds.weddingCake, 600, 600),
  unsplash(demoPhotoIds.berryCake, 600, 750),
  unsplash(demoPhotoIds.stackCake, 600, 600),
  unsplash(demoPhotoIds.pinkCupcakes, 600, 600),
  unsplash(demoPhotoIds.dessertPlate, 600, 750),
  unsplash(demoPhotoIds.tiramisu, 600, 600),
  unsplash(demoPhotoIds.iceCreamCake, 600, 600),
  unsplash(demoPhotoIds.decoratedCake, 600, 750),
  unsplash(demoPhotoIds.brownieCake, 600, 600),
  unsplash(demoPhotoIds.pastries, 600, 600),
];

/** Curated captions aligned to galleryImages (index-matched). */
export const galleryCaptions = [
  { title: "Chocolate Truffle Tower", tag: "Signature" },
  { title: "Blush Rose Drip", tag: "Wedding" },
  { title: "Garden Celebration", tag: "Events" },
  { title: "Berry Tiered Classic", tag: "Wedding" },
  { title: "Golden Glaze Cake", tag: "Signature" },
  { title: "Rosewater Cupcakes", tag: "Cupcakes" },
  { title: "Pastel Macaron Cake", tag: "Artisan" },
  { title: "Tiramisu Indulgence", tag: "Dessert" },
  { title: "Cookies & Cream Cake", tag: "Signature" },
  { title: "Birthday Bright", tag: "Celebration" },
  { title: "Hazelnut Praline Cup", tag: "Artisan" },
  { title: "Minted Vanilla Cupcakes", tag: "Cupcakes" },
];

export const faqs: LandingFaq[] = [
  {
    id: "1",
    question: "How far in advance should I order a custom cake?",
    answer:
      "We recommend placing custom cake orders at least 48-72 hours in advance. For elaborate wedding cakes or large events, please book 2-4 weeks ahead to ensure availability and design consultations.",
  },
  {
    id: "2",
    question: "Do you offer eggless cake options?",
    answer:
      "Yes! We offer a wide range of eggless cakes across all categories including chocolate, vanilla, fruit, and premium flavours. All eggless options are clearly marked on our menu.",
  },
  {
    id: "3",
    question: "What are your delivery areas and charges?",
    answer:
      "We deliver across 500+ cities in India. Delivery is free for orders above ₹999 within city limits. Same-day delivery is available for orders placed before 2 PM.",
  },
  {
    id: "4",
    question: "Can I customize the design and flavour of my cake?",
    answer:
      "Absolutely! Our expert bakers can create custom designs based on your theme, colours, and preferences. Share your ideas during checkout or visit your nearest outlet for a design consultation.",
  },
  {
    id: "5",
    question: "How should I store my cake after delivery?",
    answer:
      "Cream cakes should be refrigerated and consumed within 24-48 hours. Fondant cakes can be stored at room temperature in a cool, dry place for up to 3 days. Always bring to room temperature before serving.",
  },
];

export const instagramPosts = [
  {
    id: "1",
    image: unsplash(demoPhotoIds.chocolateCake, 300, 300),
    likes: 1240,
  },
  {
    id: "2",
    image: unsplash(demoPhotoIds.dessertPlate, 300, 300),
    likes: 982,
  },
  {
    id: "3",
    image: unsplash(demoPhotoIds.weddingCake, 300, 300),
    likes: 2156,
  },
  {
    id: "4",
    image: unsplash(demoPhotoIds.pastries, 300, 300),
    likes: 876,
  },
  {
    id: "5",
    image: unsplash(demoPhotoIds.cupcakes, 300, 300),
    likes: 1543,
  },
  {
    id: "6",
    image: unsplash(demoPhotoIds.cookies, 300, 300),
    likes: 1890,
  },
];
