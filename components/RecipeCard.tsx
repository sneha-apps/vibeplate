
import React from 'react';
import { Recipe } from '../types';

interface RecipeCardProps {
  recipe: Recipe;
}

const RecipeCard: React.FC<RecipeCardProps> = ({ recipe }) => {
  return (
    <div className="bg-white rounded-[2rem] p-8 md:p-12 shadow-sm border border-zinc-100 transition-all duration-700 animate-in fade-in slide-in-from-bottom-4">
      <div className="max-w-3xl mx-auto">
        <header className="mb-10 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-zinc-900 mb-4 tracking-tight">
            {recipe.name}
          </h2>
          <p className="text-xl text-zinc-500 font-light leading-relaxed italic">
            "{recipe.description}"
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-12">
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-400 mb-6">Ingredients</h3>
            <ul className="space-y-4">
              {recipe.ingredients.map((ing, idx) => (
                <li key={idx} className="flex items-baseline group">
                  <span className="w-24 font-medium text-zinc-900 shrink-0">{ing.amount}</span>
                  <span className="text-zinc-600 group-hover:text-zinc-900 transition-colors">{ing.item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-400 mb-6">Instructions</h3>
            <div className="space-y-8">
              {recipe.instructions.map((step, idx) => (
                <div key={idx} className="flex gap-4">
                  <span className="text-2xl font-light text-zinc-300 shrink-0">
                    {(idx + 1).toString().padStart(2, '0')}
                  </span>
                  <p className="text-zinc-700 leading-relaxed pt-1">
                    {step}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-16 pt-12 border-t border-zinc-100">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-400 mb-8 text-center">Nutritional Facts</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {[
              { label: 'Calories', value: recipe.nutrition.calories },
              { label: 'Protein', value: recipe.nutrition.protein },
              { label: 'Carbs', value: recipe.nutrition.carbs },
              { label: 'Fat', value: recipe.nutrition.fat },
              { label: 'Fiber', value: recipe.nutrition.fiber },
            ].map((stat, idx) => (
              <div key={idx} className="text-center p-4 bg-zinc-50 rounded-2xl">
                <p className="text-xs text-zinc-400 font-medium uppercase mb-1">{stat.label}</p>
                <p className="text-lg font-semibold text-zinc-900">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecipeCard;
