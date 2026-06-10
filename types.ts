
export type AppStage = 'MAIN_INPUT' | 'STAPLE_SELECTION' | 'RECIPE_GENERATION' | 'RESULT';

export interface Recipe {
  name: string;
  description: string;
  ingredients: {
    item: string;
    amount: string;
  }[];
  instructions: string[];
  nutrition: {
    calories: number;
    protein: string;
    carbs: string;
    fat: string;
    fiber: string;
  };
}

export interface SavedRecipe extends Recipe {
  id: string;
  imageUrl: string | null;
  savedAt: number;
}

export interface AppState {
  stage: AppStage;
  ingredients: string;
  suggestedStaples: string[];
  selectedStaples: string[];
  recipe: Recipe | null;
  imageUrl: string | null;
  isProcessing: boolean;
  error: string | null;
}
