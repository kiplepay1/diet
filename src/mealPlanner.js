// Everyday Malaysian halal-friendly meal ideas. Nutrition and prices are estimates.
export const MEAL_SLOTS = [
  { key: "Breakfast", timeKey: "breakfastTime", label: "Breakfast", share: 0.25 },
  { key: "Lunch", timeKey: "lunchTime", label: "Lunch", share: 0.35 },
  { key: "Tea time", timeKey: "teaTime", label: "Tea time", share: 0.10 },
  { key: "Dinner", timeKey: "dinnerTime", label: "Dinner", share: 0.30 }
];

const OPTIONS = {
  "Breakfast": [
    { name: "Thosai + dhal + 1 boiled egg", calories: 310, protein: 14, cost: 4.2, note: "Ask for dhal on the side; choose plain water or kopi O kosong.", style: "Mamak" },
    { name: "2 chapati + dhal", calories: 420, protein: 13, cost: 5, note: "Filling option. Keep dhal portion moderate.", style: "Mamak" },
    { name: "Wholemeal bread + 2 eggs", calories: 300, protein: 19, cost: 2.5, note: "Easy to prepare at home and budget-friendly.", style: "Home" },
    { name: "Oats with milk + banana", calories: 355, protein: 14, cost: 3.3, note: "Good fibre option; use unsweetened milk if possible.", style: "Home" },
    { name: "Nasi lemak kecil + telur", calories: 430, protein: 16, cost: 5, note: "Choose a smaller rice portion and go easy on sambal.", style: "Malay" }
  ],
  "Lunch": [
    { name: "Nasi campur: ½–1 cup rice + ayam kicap + sayur", calories: 520, protein: 32, cost: 8, note: "Ask for half rice, one piece of chicken and one serving of vegetables.", style: "Malay" },
    { name: "Nasi kandar: half rice + ayam + sayur", calories: 580, protein: 32, cost: 9, note: "Take one protein lauk, vegetables and kuah banjir-free (a little gravy).", style: "Mamak" },
    { name: "Nasi ayam: half rice + chicken + soup", calories: 480, protein: 30, cost: 8, note: "Leave some rice if the serving is large; choose clear soup.", style: "Malay" },
    { name: "Chapati + tandoori chicken + dhal", calories: 490, protein: 38, cost: 9, note: "A higher-protein mamak option; avoid extra creamy sauces.", style: "Mamak" },
    { name: "Rice + ikan bakar + ulam", calories: 500, protein: 34, cost: 9, note: "Keep rice to about one cup and sambal moderate.", style: "Malay" }
  ],
  "Tea time": [
    { name: "1 banana + 1 boiled egg", calories: 183, protein: 7, cost: 1.5, note: "Simple snack to bridge the gap until dinner.", style: "Home" },
    { name: "Plain yoghurt + banana", calories: 190, protein: 8, cost: 3.5, note: "Choose plain, unsweetened yoghurt.", style: "Home" },
    { name: "1 chapati + dhal (small portion)", calories: 260, protein: 9, cost: 3.5, note: "A practical mamak snack; skip teh tarik if possible.", style: "Mamak" },
    { name: "Kopi O kosong + 2 boiled eggs", calories: 161, protein: 12, cost: 3, note: "Low-cost protein snack.", style: "Mamak" }
  ],
  "Dinner": [
    { name: "Sup ayam + ½–1 cup rice + vegetables", calories: 450, protein: 32, cost: 7, note: "Choose clear soup and keep rice to a moderate portion.", style: "Malay" },
    { name: "Ikan bakar + ½–1 cup rice + ulam", calories: 460, protein: 35, cost: 8, note: "A balanced Malay-style dinner; sambal on the side.", style: "Malay" },
    { name: "2 chapati + dhal + tandoori chicken (small)", calories: 510, protein: 36, cost: 9, note: "Good protein; ask for less oil and sauce.", style: "Mamak" },
    { name: "Nasi goreng kampung (small) + telur", calories: 500, protein: 20, cost: 7, note: "Ask for less oil, extra vegetables and one egg.", style: "Malay" },
    { name: "Rice + tofu + sardines + vegetables", calories: 470, protein: 30, cost: 5, note: "Affordable home-cooked combination.", style: "Home" }
  ]
};

export function createMealPlan(calorieTarget, style = "Mix", rotation = 0, dailyBudget = 20) {
  const target = Number(calorieTarget) || 1800;
  return MEAL_SLOTS.map((slot, index) => {
    const choices = OPTIONS[slot.key].filter(x => style === "Mix" || x.style === style || x.style === "Home");
    const pool = choices.length ? choices : OPTIONS[slot.key];
    const targetForMeal = target * slot.share;
    const costWeight = dailyBudget <= 20 ? 6 : dailyBudget <= 30 ? 3 : 1.2;
    const ranked = pool.map((item, i) => ({ item, i, score: Math.abs(item.calories - targetForMeal) + item.cost * costWeight }))
      .sort((a, b) => a.score - b.score);
    const selected = ranked[(rotation + index) % ranked.length].item;
    return { ...slot, targetCalories: Math.round(targetForMeal), ...selected };
  });
}
