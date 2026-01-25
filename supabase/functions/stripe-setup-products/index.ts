import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

/**
 * One-time setup function to create LessonLoop Stripe products and prices.
 * Run this once to set up all subscription products.
 */

const PRODUCTS = [
  {
    name: "LessonLoop Teacher",
    description: "Perfect for independent music educators. Unlimited students, calendar & scheduling, invoice generation, parent portal, practice tracking, and LoopAssist AI.",
    prices: {
      monthly: { amount: 1200, interval: "month" as const }, // £12/mo
      yearly: { amount: 12000, interval: "year" as const },  // £120/yr (save £24)
    },
    metadata: { plan_key: "teacher", db_plan: "solo_teacher" },
  },
  {
    name: "LessonLoop Studio",
    description: "For music schools and growing teams. Everything in Teacher plus up to 5 teachers, multi-location support, team scheduling, payroll reports, and bulk billing.",
    prices: {
      monthly: { amount: 2900, interval: "month" as const }, // £29/mo
      yearly: { amount: 29000, interval: "year" as const },  // £290/yr (save £58)
    },
    metadata: { plan_key: "studio", db_plan: "academy" },
  },
  {
    name: "LessonLoop Agency",
    description: "For teaching agencies and large academies. Everything in Studio plus unlimited teachers, API access, advanced analytics, dedicated account manager, and SLA guarantee.",
    prices: {
      monthly: { amount: 7900, interval: "month" as const }, // £79/mo
      yearly: { amount: 79000, interval: "year" as const },  // £790/yr (save £158)
    },
    metadata: { plan_key: "agency", db_plan: "agency" },
  },
];

serve(async (req) => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }

    // This is a one-time setup function - secured by requiring STRIPE_SECRET_KEY
    // In production, you'd want additional auth checks

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    const results: Record<string, { productId: string; monthlyPriceId: string; yearlyPriceId: string }> = {};

    for (const productDef of PRODUCTS) {
      // Check if product already exists
      const existingProducts = await stripe.products.search({
        query: `name:'${productDef.name}'`,
      });

      let product: Stripe.Product;

      if (existingProducts.data.length > 0) {
        product = existingProducts.data[0];
        console.log(`Product "${productDef.name}" already exists: ${product.id}`);
      } else {
        // Create new product
        product = await stripe.products.create({
          name: productDef.name,
          description: productDef.description,
          metadata: productDef.metadata,
        });
        console.log(`Created product "${productDef.name}": ${product.id}`);
      }

      // Check for existing prices
      const existingPrices = await stripe.prices.list({
        product: product.id,
        active: true,
      });

      let monthlyPrice = existingPrices.data.find(
        (p: Stripe.Price) => p.recurring?.interval === "month"
      );
      let yearlyPrice = existingPrices.data.find(
        (p: Stripe.Price) => p.recurring?.interval === "year"
      );

      // Create monthly price if missing
      if (!monthlyPrice) {
        monthlyPrice = await stripe.prices.create({
          product: product.id,
          unit_amount: productDef.prices.monthly.amount,
          currency: "gbp",
          recurring: { interval: productDef.prices.monthly.interval },
          metadata: { ...productDef.metadata, billing_interval: "monthly" },
        });
        console.log(`Created monthly price for "${productDef.name}": ${monthlyPrice.id}`);
      }

      // Create yearly price if missing
      if (!yearlyPrice) {
        yearlyPrice = await stripe.prices.create({
          product: product.id,
          unit_amount: productDef.prices.yearly.amount,
          currency: "gbp",
          recurring: { interval: productDef.prices.yearly.interval },
          metadata: { ...productDef.metadata, billing_interval: "yearly" },
        });
        console.log(`Created yearly price for "${productDef.name}": ${yearlyPrice.id}`);
      }

      results[productDef.metadata.plan_key] = {
        productId: product.id,
        monthlyPriceId: monthlyPrice.id,
        yearlyPriceId: yearlyPrice.id,
      };
    }

    // Format secrets for easy copy-paste
    const secretsConfig = {
      STRIPE_PRICE_TEACHER_MONTHLY: results.teacher.monthlyPriceId,
      STRIPE_PRICE_TEACHER_YEARLY: results.teacher.yearlyPriceId,
      STRIPE_PRICE_STUDIO_MONTHLY: results.studio.monthlyPriceId,
      STRIPE_PRICE_STUDIO_YEARLY: results.studio.yearlyPriceId,
      STRIPE_PRICE_AGENCY_MONTHLY: results.agency.monthlyPriceId,
      STRIPE_PRICE_AGENCY_YEARLY: results.agency.yearlyPriceId,
    };

    return new Response(
      JSON.stringify({
        success: true,
        message: "Stripe products and prices created successfully!",
        products: results,
        secrets: secretsConfig,
        instructions: "Copy the price IDs above and add them as secrets in your project.",
      }, null, 2),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Stripe setup error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
