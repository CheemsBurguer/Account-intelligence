export type InsightCardDTO = {
    id: string;
    category: string;

    title: string;
    quote?: string;

    opportunityTitle: string;
    opportunityBody: string;

    propensityValue: number;

    impactTag?: {
        label: string;
        tone: "critica" | "alta" | "media" | "baja";
    };

    detectedAt?: string;

    factors?: Array<{
        label: string;
        level: "ALTA" | "MEDIA" | "BAJA";
    }>;
};