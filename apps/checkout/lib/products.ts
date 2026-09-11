export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
};

export const products: Product[] = [
  {
    id: "prod_123",
    name: "Pro Plan",
    description: "Everything you need to get started.",
    price: 999,
    currency: "INR",
  },
];

export function getProduct(productId: string) {
  return products.find((product) => product.id === productId);
}