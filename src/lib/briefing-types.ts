export interface BriefingData {
  missionSummary: string;
  forceComposition: {
    totalVehicles: number;
    totalPersonnel: number;
    byCategory: { category: string; count: number; types: string }[];
  };
  supplyRequirements: {
    classIII: {
      totalGallons: number;
      hemttLoads: number;
      resupplySchedule: string;
      status: "green" | "amber" | "red";
    };
    classI: {
      totalMeals: number;
      personnelCount: number;
      mealBreakdown: string;
      status: "green" | "amber" | "red";
    };
    classV: {
      assessment: string;
      details: { platform: string; basicLoad: string }[];
      status: "green" | "amber" | "red";
    };
  };
  criticalRisks: {
    risk: string;
    severity: "low" | "medium" | "high" | "critical";
    mitigation: string;
  }[];
  movementAnalysis: {
    route: string;
    distance: string;
    estimatedTime: string;
    fuelCost: string;
  }[];
  recommendation: string;
  generatedAt: string;
}
