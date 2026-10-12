import { FoodItem } from '../types/index.js';

export const FOODS: FoodItem[] = [
  { k: 'jollof', n: 'Jollof Rice', a: 'assets/jollof.webp' },
  { k: 'chicken', n: 'Chicken', a: 'assets/chicken.webp' },
  { k: 'plantain', n: 'Plantain', a: 'assets/plantain.webp' },
  { k: 'amala', n: 'Amala', a: 'assets/amala.webp' },
  { k: 'puffpuff', n: 'Puff Puff', a: 'assets/puffpuff.webp' },
  { k: 'suya', n: 'Suya', a: 'assets/suya.webp' },
  { k: 'moimoi', n: 'Moi Moi', a: 'assets/moimoi.webp' },
  { k: 'fish', n: 'Fish', a: 'assets/fish.webp' },
  { k: 'meatpie', n: 'Meat Pie', a: 'assets/meatpie.webp' },
  { k: 'eba', n: 'Eba', a: 'assets/eba.webp' },
  { k: 'friedrice', n: 'Fried Rice', a: 'assets/friedrice.webp' },
  { k: 'akara', n: 'Akara', a: 'assets/akara.webp' },
  { k: 'whiterice', n: 'White Rice', a: 'assets/whiterice.webp' },
  { k: 'egusi', n: 'Egusi Soup', a: 'assets/egusi.webp' },
  { k: 'ogbono', n: 'Ogbono Soup', a: 'assets/ogbono.webp' },
  { k: 'ebans', n: 'Ebans', a: 'assets/ebans.webp' }
];

export const SPECIAL_ASSETS: Record<string, string> = {
  c: 'assets/chef.webp',
  b: 'assets/bomb.webp',
  h: 'assets/cutterh.webp',
  v: 'assets/cutterv.webp'
};

export function getFoodIconHtml(food: FoodItem): string {
  return `<img src="${food.a}" alt="${food.n}" draggable="false">`;
}

export function getSpecialIconHtml(specialType: string): string {
  const assetUrl = SPECIAL_ASSETS[specialType];
  return `<img src="${assetUrl}" alt="${specialType}" draggable="false">`;
}
