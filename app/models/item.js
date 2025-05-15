import { z } from "zod";

const VariantSchema = z.object({
  size: z.string().min(1),
  color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),
  sku: z.string().regex(/^[A-Z0-9_-]+$/),
  quantity: z.coerce.number().int().min(0),
  price: z.coerce.number().positive(),
  barcode: z.string().regex(/^[0-9]{12,14}$/),
  measurements: z.record(z.coerce.number()).optional(),
});

export const ItemSchema = z
  .object({
    name: z.string().min(2).max(100),
    gender: z.enum(["LADIES", "GENTS"]),
    category: z.string().min(1),
    material: z.string().regex(
      /^\s*\d+%\s*[A-Za-z ]+(?:,\s*\d+%\s*[A-Za-z ]+)*\s*$/,
      "Material must look like “95% Cotton” or “80% Wool, 20% Nylon”"
    ),
    variants: z.array(VariantSchema).min(1),
    storeId: z.string().min(1),
    createdBy: z.string().min(1),
    createdAt: z.preprocess(
      val => (typeof val === "string" ? new Date(val) : val),
      z.date().optional().default(() => new Date())
    ),
    updatedAt: z.preprocess(
      val => (typeof val === "string" ? new Date(val) : val),
      z.date().optional().default(() => new Date())
    ),
    deletedAt: z.date().nullable().default(null),
  })
  .superRefine((data, ctx) => {
    const genderSizes = {
      LADIES: ["XXS", "XS", "S", "M", "L", "XL", "XXL", "Plus Size"],
      GENTS: ["XS", "S", "M", "L", "XL", "XXL", "XXXL"],
    };

    data.variants.forEach((v, i) => {
      if (!genderSizes[data.gender].includes(v.size)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["variants", i, "size"],
          message: `Invalid size “${v.size}” for ${data.gender} items`,
        });
      }
    });

    const seen = new Set();
    data.variants.forEach((v, i) => {
      if (seen.has(v.sku)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["variants", i, "sku"],
          message: "Duplicate SKU",
        });
      }
      seen.add(v.sku);
    });
  });

export function validateItem(raw) {
  // normalize SKU & barcode
  const data = {
    ...raw,
    variants: Array.isArray(raw.variants)
      ? raw.variants.map(v => ({
          ...v,
          sku: String(v.sku).toUpperCase().replace(/[^A-Z0-9_-]/g, ""),
          barcode: String(v.barcode).replace(/[^0-9]/g, ""),
        }))
      : [],
  };

  const result = ItemSchema.safeParse(data);
  console.log('lkj',result)

  if (!result.success) {
    // for debugging: log the exact issues array
    console.error("Validation errors:", result.error.issues);
  }

  return result;
}
