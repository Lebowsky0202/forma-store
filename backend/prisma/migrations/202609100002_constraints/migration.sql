ALTER TABLE "Product" ADD CONSTRAINT "Product_price_check" CHECK ("price" > 0 AND ("oldPrice" IS NULL OR "oldPrice" >= "price"));
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_stock_check" CHECK ("stock" >= 0);
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_quantity_check" CHECK ("quantity" BETWEEN 1 AND 99);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_values_check" CHECK ("quantity" BETWEEN 1 AND 99 AND "unitPrice" > 0 AND "total" = "unitPrice" * "quantity");
ALTER TABLE "Order" ADD CONSTRAINT "Order_values_check" CHECK ("subtotal" > 0 AND "shippingCost" >= 0 AND "total" = "subtotal" + "shippingCost");
ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_check" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "ShippingMethod" ADD CONSTRAINT "ShippingMethod_price_check" CHECK ("price" >= 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_check" CHECK ("amount" > 0);
