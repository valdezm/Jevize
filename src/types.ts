import { z } from 'zod';
export const ChoiceSchema=z.object({id:z.string().min(1),description:z.string().min(1)});
export const DecisionRequestSchema=z.object({state:z.unknown(),goal:z.string().min(1),choices:z.array(ChoiceSchema).min(2).max(255)});
export type DecisionRequest=z.infer<typeof DecisionRequestSchema>;
export type DecisionResult={id:string;decision:string;probabilities:Record<string,number>;model:string;confidence:number;source:'teacher'|'student';latencyMs:number};
