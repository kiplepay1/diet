# MyDiet — Malaysian Guided Meal Planner

MyDiet is a React + Vite app focused on guided, affordable everyday Malaysian meals. It is designed around mamak, Malay and simple home-cooked food rather than requiring users to invent their own diet plan.

## What's included

- Structured 30-day or 60-day guided meal programme with a day counter and restart option
- Assigned daily meals for breakfast, lunch, tea time and dinner, rotating through Malaysian meal choices across programme days
- Estimated daily calorie target from age, sex, height, weight and activity level
- Meal calorie allocation: 25% breakfast, 35% lunch, 10% tea time, 30% dinner
- Affordable mamak, Malay and home-style meal suggestions with estimated calories, protein and RM cost
- Preference for a mix of food, mamak or Malay food
- Change-menu action to rotate suggestions
- One-tap logging of a suggested meal into the food diary
- Browser meal-time reminders with editable times
- Food diary, food library, weight history and budget tracking
- Firebase email/password authentication, Firestore sync and optional photo upload
- Demo mode using browser local storage
- GitHub Pages Actions workflow and repository-aware Vite base path

## Important behaviour and limitations

- Meal plans are practical suggestions, not compulsory restrictions. Users should be able to swap a meal or log what they actually ate.
- Calories, protein and prices are estimates. Restaurant recipes, portion sizes, oil and gravy vary.
- Browser reminders currently work while the MyDiet page is open. Notifications when the browser is fully closed require Firebase Cloud Messaging (FCM), a service worker and push configuration; that is not included in this version.
- Food photos are attached to diary entries; automatic food recognition and image-based calorie estimation are not included.
- The meal planner is a deterministic starter planner, not a live AI nutrition service.
- Calorie estimates are not medical advice. Users with medical conditions, pregnancy, a history of disordered eating or therapeutic diet needs should consult a qualified health professional.

## Run locally

Use Node.js 20 LTS or later:

```bash
npm install
cp .env.example .env.local
npm run dev
```

The app starts in demo mode if Firebase settings are not configured. Demo data stays in the current browser.

## Firebase setup

1. Create or open a project at https://console.firebase.google.com/.
2. Add a Web app in Project settings and copy its Firebase web config.
3. Copy `.env.example` to `.env.local` and enter the matching `VITE_FIREBASE_*` values.
4. Set `VITE_DEMO_MODE=false`.
5. Enable Email/Password under Authentication > Sign-in method.
6. Create Firestore and Storage.
7. Publish `firestore.rules` and `storage.rules`.
8. Add the deployed GitHub Pages domain under Authentication > Settings > Authorized domains.

Do not commit `.env.local` or private service-account keys.

## Deploy to GitHub Pages

1. Upload the contents of this project folder to the root of your GitHub repository (so `package.json`, `index.html`, `src/` and `.github/` are at repository root).
2. Ensure your default branch is named `main`. If not, edit `.github/workflows/deploy.yml` and change the branch under `on.push.branches`.
3. In GitHub repository Settings > Pages, set Build and deployment Source to **GitHub Actions**.
4. If you want Firebase cloud login and sync, open Settings > Secrets and variables > Actions > New repository secret. Add these six secrets using the exact names: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, and `VITE_FIREBASE_APP_ID`. Copy each value from Firebase Project settings > Your apps > Web app. Without these secrets, the app falls back to browser-only demo mode.
5. Open the Actions tab and wait for **Deploy MyDiet to GitHub Pages** to finish successfully.
6. Open the Pages URL shown in the workflow deployment and refresh the page.

The workflow calculates the correct Vite base path from the repository name, including the special `username.github.io` user-site case.

## Production build

```bash
npm install
npm run build
npm run preview
```

Vite writes the compiled site to `dist/`.

## Firestore data model

- `users/{uid}` — profile and estimated calorie/protein targets
- `food_logs/{autoId}` — date, meal, food, portion, calories, protein, cost, source and optional photo URL
- `weight_logs/{autoId}` — date and weight

Food options and meal-plan options are bundled locally in `src/foodData.js` and `src/mealPlanner.js`.
