import { z } from "zod";
const money=z.coerce.number().finite().nonnegative();const title=z.string().trim().min(1,"Ce champ est obligatoire");
export const budgetEntrySchema=z.object({title,amount:money.positive(),potentialAmount:money,type:z.enum(["revenu","depense"]),category:title,bucket:title,scope:title,date:z.string().datetime(),note:z.string(),status:z.enum(["recu","peu","non"])});
export const tenantSchema=z.object({name:title,monthlyRent:money.positive(),dueDay:z.coerce.number().int().min(1).max(31),note:z.string()});
export const dubaiPartSchema=z.object({name:title,category:title,quantityBought:z.coerce.number().int().nonnegative(),quantitySold:z.coerce.number().int().nonnegative(),purchasePriceAED:money,targetSalePriceAED:money,note:z.string(),cashWithdrawnAED:money});
export const tripSchema=z.object({title,destinationSummary:z.string(),startDate:z.string().datetime(),endDate:z.string().datetime(),peopleCount:z.coerce.number().int().min(1),targetBudget:money,notes:z.string(),isCompleted:z.boolean()});
export const profileSchema=z.object({username:z.string().trim().min(2).max(40)});
