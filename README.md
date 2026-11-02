# MyDiet — Malaysian Food & Weight Tracker

A responsive React + Vite starter app for tracking Malaysian meals, calories, protein, food spending and weight.

## Included in this MVP

- Responsive dashboard for desktop and mobile
- Email/password Firebase Authentication
- Firestore food diary and weight history
- Firebase Storage food photo uploads
- Manual food logging with editable calories, protein, quantity and cost
- Starter Malaysian food library (mamak, Malay, home cooking, breakfast, drinks, snacks)
- Daily calorie, protein and food budget summaries
- Starter rule-based meal advisor
- Body profile and estimated calorie/protein targets
- Demo mode for trying the app before connecting Firebase

## Important limitations

- Food photos are uploaded and attached to a food log, but this version does **not** automatically recognise food or calculate nutrition from an image.
- The advisor is a transparent rule-based starter, not a connected generative AI service.
- Food calories, protein and prices are estimates. Actual serving size, recipe, cooking oil, gravy and local prices vary.
- The calorie calculation is an estimate, not medical advice. Discuss weight-loss targets with a qualified health professional if you have a medical condition, are pregnant, have a history of disordered eating, or need a therapeutic diet.

## 1. Run locally

Install Node.js 20 LTS or later.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open the local URL printed by Vite.

By default, `.env.example` has `VITE_DEMO_MODE=true`. The app will run without Firebase and save demo records in this browser's local storage. Demo data is not cloud-synced.

## 2. Connect Firebase

1. Open https://console.firebase.google.com/
2. Create a Firebase project (or use your existing project).
3. In Project settings > General > Your apps, add a Web app.
4. Copy the Firebase web configuration values.
5. In the project folder, copy `.env.example` to `.env.local`.
6. Paste the values into the matching `VITE_FIREBASE_*` fields.
7. Change `VITE_DEMO_MODE=true` to `VITE_DEMO_MODE=false`.
8. In Firebase Authentication > Sign-in method, enable **Email/Password**.
9. Create a Firestore database.
10. In Firebase Storage, get started and create a bucket.
11. In Firestore Rules, paste the contents of `firestore.rules` and publish.
12. In Storage Rules, paste the contents of `storage.rules` and publish.
13. Restart the dev server after editing `.env.local`.

Never commit `.env.local` to GitHub. It is ignored by `.gitignore`. Firebase web config is intended for client apps, but database and storage security rules are essential. Do not put private service-account keys or AI API keys in frontend environment variables.

## 3. Push to GitHub

Create a new empty GitHub repository, then run these commands in the project folder:

```bash
git init
git add .
git commit -m "Initial MyDiet app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Replace the remote URL with your own repository URL.

## 4. Deploy with Vercel

1. Sign in to https://vercel.com/ using GitHub.
2. Import this repository.
3. Framework preset: **Vite**.
4. Add the same `VITE_FIREBASE_*` values under Project Settings > Environment Variables.
5. Deploy.
6. In Firebase Authentication > Settings > Authorized domains, add your deployed domain (for example `your-project.vercel.app`).

Alternatively, deploy the `dist` folder to Firebase Hosting after running `npm run build`.

## 5. Build for production

```bash
npm run build
npm run preview
```

Vite outputs the production application into `dist/`.

## Firestore data model

- `users/{uid}` — profile and calculated targets
- `food_logs/{autoId}` — date, meal, food, portion, calories, protein, cost, source, optional photo URL
- `weight_logs/{autoId}` — date and weight

Food library is currently bundled in `src/foodData.js` so the app works immediately. It can later be migrated to Firestore if you want to manage food entries without redeploying.

## Suggested next upgrades

1. AI food-photo analysis through a secure Firebase Cloud Function or other backend. Do not call a paid AI API directly from browser code or expose its secret key.
2. Food library management screen and custom food creation.
3. Weekly meal plan generator with actual local price inputs.
4. Export diary to CSV and edit existing diary entries.
5. More precise portion references and verified Malaysian nutrition data.
