import React, { useEffect, useMemo, useState } from "react";
import {
  Activity, Apple, Camera, ChartNoAxesCombined, ChefHat, CircleHelp, Flame,
  Home, LogOut, Plus, Search, Settings, Sparkles, Target, Trash2, TrendingDown,
  Utensils, Wallet, Weight, X, ImagePlus
} from "lucide-react";
import {
  createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword,
  signOut
} from "firebase/auth";
import {
  addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, query, setDoc, where
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage, demoMode } from "./firebase";
import { FOOD_LIBRARY, MEALS } from "./foodData";
import { createMealPlan, MEAL_SLOTS } from "./mealPlanner";

const today = () => { const d = new Date(); const offset = d.getTimezoneOffset(); return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10); };
const money = n => `RM ${Number(n || 0).toFixed(2)}`;
const localRead = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const localWrite = (key, value) => localStorage.setItem(key, JSON.stringify(value));

function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(demoMode);
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [page, setPage] = useState("Meal plan");
  const [profile, setProfile] = useState(() => localRead("mydiet_profile", {
    name:"", age:"", sex:"Male", height:"", weight:"", targetWeight:"",
    activity:"Lightly active", budget:20, calorieTarget:0, proteinTarget:0, foodStyle:"Mix", programDuration:30, programStartDate:today()
  }));
  const [logs, setLogs] = useState(() => localRead("mydiet_logs", []));
  const [weights, setWeights] = useState(() => localRead("mydiet_weights", []));
  const [foodSearch, setFoodSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [showLog, setShowLog] = useState(false);
  const [selectedFood, setSelectedFood] = useState(null);
  const [foodQuery, setFoodQuery] = useState("");
  const [meal, setMeal] = useState("Lunch");
  const [quantity, setQuantity] = useState(1);
  const [cost, setCost] = useState("");
  const [customCalories, setCustomCalories] = useState("");
  const [customProtein, setCustomProtein] = useState("");
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [weightInput, setWeightInput] = useState("");
  const [advisorQuestion, setAdvisorQuestion] = useState("");
  const [toast, setToast] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [planRotation, setPlanRotation] = useState(0);
  const [reminders, setReminders] = useState(() => localRead("mydiet_reminders", { enabled:false, breakfastTime:"07:30", lunchTime:"12:30", teaTime:"16:00", dinnerTime:"19:30" }));

  useEffect(() => {
    if (demoMode) { setUser({ uid:"demo-user", email:"demo@mydiet.local" }); setAuthReady(true); return; }
    const unsub = onAuthStateChanged(auth, u => { setUser(u); setAuthReady(true); });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user || demoMode) return;
    getDoc(doc(db, "users", user.uid)).then(snap => {
      if (snap.exists()) setProfile(p => ({ ...p, ...snap.data() }));
    }).catch(err => notify(`Could not load profile: ${err.message}`));
    const q = query(collection(db, "food_logs"), where("userId", "==", user.uid));
    const unsub = onSnapshot(q, snap => setLogs(snap.docs.map(d => ({ id:d.id, ...d.data() }))), err => notify(err.message));
    const wq = query(collection(db, "weight_logs"), where("userId", "==", user.uid));
    const unw = onSnapshot(wq, snap => setWeights(snap.docs.map(d => ({ id:d.id, ...d.data() })).sort((a,b)=>a.date.localeCompare(b.date))), err => notify(err.message));
    return () => { unsub(); unw(); };
  }, [user]);

  useEffect(() => { if (demoMode) localWrite("mydiet_logs", logs); }, [logs]);
  useEffect(() => { if (demoMode) localWrite("mydiet_weights", weights); }, [weights]);
  useEffect(() => { localWrite("mydiet_profile", profile); }, [profile]);
  useEffect(() => { localWrite("mydiet_reminders", reminders); }, [reminders]);

  // Browser reminders work while this app is open. Background reminders need push messaging/service-worker setup.
  useEffect(() => {
    if (!reminders.enabled || !("Notification" in window) || Notification.permission !== "granted") return;
    const check = () => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
      const day = today();
      MEAL_SLOTS.forEach(slot => {
        if (reminders[slot.timeKey] === hhmm) {
          const key = `mydiet_notice_${day}_${slot.key}`;
          if (!localStorage.getItem(key)) {
            new Notification(`MyDiet: ${slot.label} time`, { body: "Check today's meal plan and enjoy your meal.", tag:key });
            localStorage.setItem(key, "1");
          }
        }
      });
    };
    check();
    const timer = window.setInterval(check, 20000);
    return () => window.clearInterval(timer);
  }, [reminders]);

  function notify(msg) { setToast(msg); setTimeout(() => setToast(""), 3200); }

  async function handleAuth(e) {
    e.preventDefault(); setAuthError("");
    try {
      if (authMode === "register") await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
    } catch (err) { setAuthError(err.message.replace("Firebase: ", "")); }
  }

  async function saveProfile(e) {
    e?.preventDefault();
    if (!profile.height || !profile.weight || !profile.age) { notify("Please enter age, height and current weight."); return; }
    const h = Number(profile.height) / 100, w = Number(profile.weight), age = Number(profile.age);
    const bmr = profile.sex === "Male" ? 10*w + 6.25*(h*100) - 5*age + 5 : 10*w + 6.25*(h*100) - 5*age - 161;
    const factor = profile.activity === "Very active" ? 1.725 : profile.activity === "Moderately active" ? 1.55 : profile.activity === "Lightly active" ? 1.375 : 1.2;
    const maintenance = bmr * factor;
    const goalWeight = Number(profile.targetWeight || 0);
    const hasWeightLossGoal = !goalWeight || goalWeight < w;
    const deficit = hasWeightLossGoal ? 350 : 0;
    const minimumGuide = profile.sex === "Male" ? 1500 : 1200;
    const target = Math.max(minimumGuide, Math.round((maintenance - deficit) / 50) * 50);
    const kgToLose = goalWeight > 0 && goalWeight < w ? Number((w - goalWeight).toFixed(1)) : 0;
    const estimatedWeeks = kgToLose ? Math.ceil(kgToLose / 0.5) : 0;
    const next = { ...profile, calorieTarget:target, proteinTarget:Math.round(w*1.4), kgToLose, estimatedWeeks, programDuration:Number(profile.programDuration || 30), programStartDate:profile.programStartDate || today() };
    setProfile(next);
    if (!demoMode && user) await setDoc(doc(db, "users", user.uid), { ...next, updatedAt:new Date().toISOString() }, { merge:true });
    notify("Profile saved and calorie target estimated.");
  }

  const todayLogs = useMemo(() => logs.filter(l => l.date === today()), [logs]);
  const totals = useMemo(() => todayLogs.reduce((a,l) => ({
    calories:a.calories + Number(l.calories || 0),
    protein:a.protein + Number(l.protein || 0),
    cost:a.cost + Number(l.cost || 0)
  }), {calories:0,protein:0,cost:0}), [todayLogs]);
  const calorieTarget = Number(profile.calorieTarget || 0);
  const budget = Number(profile.budget || 20);
  const remaining = Math.max(0, calorieTarget - totals.calories);
  const budgetLeft = Math.max(0, budget - totals.cost);
  const progress = calorieTarget ? Math.min(100, totals.calories / calorieTarget * 100) : 0;

  async function addFoodLog(e) {
    e.preventDefault();
    if (!selectedFood) return;
    if (customCalories === "" || !Number.isFinite(Number(customCalories)) || Number(customCalories) < 0) { notify("Please enter a valid calorie estimate for this food."); return; }
    const q = Math.max(0.25, Number(quantity) || 1);
    const entry = {
      userId:user.uid, date:today(), mealType:meal, foodId:selectedFood.id || "custom",
      foodName:selectedFood.name, portion:selectedFood.serving || "serving", quantity:q,
      calories:Math.round(Number(customCalories || selectedFood.calories || 0) * q),
      protein:Math.round(Number(customProtein || selectedFood.protein || 0) * q * 10) / 10,
      cost:Number(cost || selectedFood.price || 0) * q,
      source:photo ? "photo" : "manual", photoUrl:"", createdAt:new Date().toISOString()
    };
    try {
      if (photo && !demoMode && storage) {
        const fileRef = ref(storage, `food_photos/${user.uid}/${Date.now()}-${photo.name}`);
        await uploadBytes(fileRef, photo);
        entry.photoUrl = await getDownloadURL(fileRef);
      }
      if (demoMode) setLogs(prev => [...prev, { ...entry, id:crypto.randomUUID() }]);
      else await addDoc(collection(db, "food_logs"), entry);
      setShowLog(false); resetLog(); notify("Food added to today's diary.");
    } catch (err) { notify(`Could not save food: ${err.message}`); }
  }

  function resetLog() {
    setSelectedFood(null); setFoodQuery(""); setQuantity(1); setCost(""); setCustomCalories(""); setCustomProtein("");
    setPhoto(null); setPhotoPreview("");
  }

  async function removeLog(id) {
    if (!window.confirm("Delete this food entry?")) return;
    if (demoMode) setLogs(prev => prev.filter(x => x.id !== id));
    else await deleteDoc(doc(db, "food_logs", id));
  }

  async function addWeight(e) {
    e.preventDefault();
    const val = Number(weightInput);
    if (!val || val < 20 || val > 350) return notify("Enter a valid weight in kg.");
    const entry = { userId:user.uid, date:today(), weight:val, createdAt:new Date().toISOString() };
    if (demoMode) setWeights(prev => [...prev.filter(x=>x.date!==today()), {...entry,id:crypto.randomUUID()}]);
    else await addDoc(collection(db, "weight_logs"), entry);
    setProfile(p => ({...p, weight:String(val)})); setWeightInput(""); notify("Weight entry saved.");
  }

  const programStart = new Date(`${profile.programStartDate || today()}T00:00:00`);
  const todayDate = new Date(`${today()}T00:00:00`);
  const programDay = Math.max(1, Math.floor((todayDate - programStart) / 86400000) + 1);
  const programDuration = Number(profile.programDuration || 30);
  const programComplete = programDay > programDuration;
  const mealPlan = useMemo(() => createMealPlan(calorieTarget || 1800, profile.foodStyle || "Mix", programDay - 1, budget), [calorieTarget, profile.foodStyle, programDay, budget]);
  const plannedCost = mealPlan.reduce((sum, item) => sum + item.cost, 0);
  const plannedCalories = mealPlan.reduce((sum, item) => sum + item.calories, 0);

  function restartProgram() {
    const next = { ...profile, programStartDate: today() };
    setProfile(next);
    if (!demoMode && user) setDoc(doc(db, "users", user.uid), { programStartDate: today(), updatedAt:new Date().toISOString() }, { merge:true }).catch(err => notify(`Could not restart programme: ${err.message}`));
    notify(`Your ${programDuration}-day meal programme has restarted.`);
  }

  async function enableReminders() {
    if (!("Notification" in window)) { notify("This browser does not support notifications."); return; }
    const permission = await Notification.requestPermission();
    if (permission === "granted") { setReminders(r => ({ ...r, enabled:true })); notify("Meal reminders enabled while MyDiet is open."); }
    else notify("Please allow notifications in your browser settings.");
  }

  async function logPlannedMeal(item) {
    if (!user) { notify("Please sign in first."); return; }
    const entry = { userId:user.uid, date:today(), mealType:item.key, foodId:`plan-${item.key.toLowerCase().replaceAll(" ","-")}`, foodName:item.name, portion:"Suggested meal", quantity:1, calories:item.calories, protein:item.protein, cost:item.cost, source:"meal-plan", photoUrl:"", createdAt:new Date().toISOString() };
    try {
      if (demoMode) setLogs(prev => [...prev, { ...entry, id:crypto.randomUUID() }]);
      else await addDoc(collection(db, "food_logs"), entry);
      notify(`${item.label} added to your food diary.`);
    } catch (err) { notify(`Could not save meal: ${err.message}`); }
  }

  const foodMatches = foodQuery.trim().length < 2 ? [] : FOOD_LIBRARY.filter(f => {
    const query = foodQuery.toLowerCase().trim();
    const name = f.name.toLowerCase();
    const aliases = { "chicken rice":"nasi ayam", "nasi ayam":"nasi ayam", "fried chicken":"ayam goreng", "fried rice":"nasi goreng", "white rice":"white rice", "boiled egg":"boiled egg", "roti telur":"roti telur" };
    const alias = aliases[query];
    return name.includes(query) || query.split(/\s+/).every(word => name.includes(word)) || Boolean(alias && name.includes(alias));
  }).slice(0, 6);

  function chooseFood(f) {
    setSelectedFood(f);
    setFoodQuery(f.name);
    setCustomCalories(String(f.calories));
    setCustomProtein(String(f.protein));
    setCost(String(f.price));
  }

  function useCustomFood() {
    const name = foodQuery.trim();
    if (!name) return;
    setSelectedFood({ id:"custom", name, category:"Custom", serving:"1 serving", calories:0, protein:0, price:0 });
    setCustomCalories(""); setCustomProtein(""); setCost("");
  }

  const filteredFoods = FOOD_LIBRARY.filter(f =>
    (category === "All" || f.category === category) &&
    f.name.toLowerCase().includes(foodSearch.toLowerCase())
  );

  function getAdvice() {
    const q = advisorQuestion.toLowerCase();
    let options = [];
    if (q.includes("mamak") || q.includes("nasi kandar")) {
      options = [
        ["Thosai + dhal + 1 boiled egg","Approx. 310 kcal","Good balance; ask for dhal on the side."],
        ["Chapati + dhal + tandoori chicken","Approx. 450 kcal","More protein and filling."],
        ["Nasi kandar: half rice + ayam + vegetables","Approx. 550–650 kcal","Ask for less gravy and avoid extra fried sides."]
      ];
    } else if (q.includes("breakfast") || q.includes("pagi")) {
      options = [
        ["2 boiled eggs + 2 wholemeal bread","Approx. 300 kcal","Easy, affordable protein."],
        ["Oats + milk + banana","Approx. 350 kcal","Fibre helps you stay full."],
        ["Thosai + dhal","Approx. 230 kcal","Simple mamak option."]
      ];
    } else {
      options = [
        ["Rice (about 1 cup) + chicken soup + vegetables","Approx. 450 kcal","A filling everyday meal."],
        ["Rice + 2 eggs + vegetables","Approx. 400 kcal","Low-cost home-cooked option."],
        ["Ikan bakar + rice + ulam","Approx. 450–550 kcal","Protein-rich; keep sambal moderate."]
      ];
    }
    return options;
  }

  if (!authReady) return <div className="loading-screen">Loading MyDiet…</div>;
  if (!user && !demoMode) return <div className="auth-wrap"><div className="auth-card">
    <div className="brand-mark">M</div><p className="eyebrow">YOUR EVERYDAY FOOD COMPANION</p><h1>{authMode==="login"?"Welcome back":"Create your account"}</h1>
    <p className="muted">Track Malaysian meals, portions, calories and food spending.</p>
    <form onSubmit={handleAuth} className="stack">
      <label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
      <label>Password<input type="password" minLength="6" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters"/></label>
      {authError && <p className="error">{authError}</p>}
      <button className="primary full">{authMode==="login"?"Sign in":"Create account"}</button>
    </form>
    <button className="text-button" onClick={()=>setAuthMode(authMode==="login"?"register":"login")}>{authMode==="login"?"New here? Create an account":"Already registered? Sign in"}</button>
  </div></div>;

  const nav = [
    {name:"Home",icon:Home},{name:"Meal plan",icon:ChefHat},{name:"Diary",icon:Utensils},{name:"Food library",icon:Apple},
    {name:"AI advisor",icon:Sparkles},{name:"Progress",icon:ChartNoAxesCombined}
  ];

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">M</div><div><b>MyDiet</b><small>Eat well. Spend less.</small></div></div>
      <div className="nav-label">MENU</div>
      {nav.map(n=><button key={n.name} className={`nav-item ${page===n.name?"active":""}`} onClick={()=>setPage(n.name)}><n.icon size={18}/>{n.name}</button>)}
      <div className="sidebar-bottom">
        <button className="nav-item" onClick={()=>setProfileOpen(true)}><Settings size={18}/>Profile & settings</button>
        {!demoMode && <button className="nav-item" onClick={()=>signOut(auth)}><LogOut size={18}/>Sign out</button>}
        <div className="budget-mini"><span>Daily food budget</span><b>{money(budget)}</b><small>{money(budgetLeft)} remaining today</small></div>
        <small className="muted">{demoMode?"Demo mode · data stored in this browser":"Firebase cloud sync enabled"}</small>
      </div>
    </aside>

    <main className="main-content">
      <header className="topbar"><div><span className="eyebrow">MONDAY, YOUR HEALTH JOURNEY</span><h2>{page==="Home"?"Your daily overview":page}</h2></div>
        <div className="top-actions"><span className="date-pill">{new Date().toLocaleDateString("en-MY",{day:"numeric",month:"short",year:"numeric"})}</span><button className="avatar" onClick={()=>setProfileOpen(true)}>{(profile.name||user?.email||"M").charAt(0).toUpperCase()}</button></div>
      </header>

      {page==="Home" && <div className="page-stack">
        <section className="welcome-row"><div><p className="eyebrow">YOUR PLAN, YOUR PACE</p><h1>Small choices add up<span>.</span></h1><p className="muted">A practical plan built around Malaysian food and your daily budget.</p></div><div className="welcome-icon"><ChefHat size={38}/></div></section>
        {!profile.calorieTarget && <div className="notice"><CircleHelp size={20}/><div><b>Set up your body profile</b><p>Add your age, height, weight and activity level to calculate a personal calorie target.</p></div><button className="secondary" onClick={()=>setProfileOpen(true)}>Set up</button></div>}
        <section className="stats-grid">
          <div className="stat-card"><div className="stat-head"><span>Calories eaten</span><Flame/></div><strong>{Math.round(totals.calories).toLocaleString()} <small>/ {calorieTarget||"—"} kcal</small></strong><div className="progress-track"><div className="progress-fill green" style={{width:`${progress}%`}}/></div><small className="muted">{calorieTarget?`${Math.round(remaining)} kcal remaining`:"Set your profile to get a target"}</small></div>
          <div className="stat-card"><div className="stat-head"><span>Food budget</span><Wallet/></div><strong>{money(totals.cost)} <small>/ {money(budget)}</small></strong><div className="progress-track"><div className="progress-fill blue" style={{width:`${Math.min(100,totals.cost/budget*100)}%`}}/></div><small className="muted">{money(budgetLeft)} left for today</small></div>
          <div className="stat-card"><div className="stat-head"><span>Protein</span><Activity/></div><strong>{Math.round(totals.protein)} <small>/ {profile.proteinTarget||"—"} g</small></strong><div className="progress-track"><div className="progress-fill orange" style={{width:`${profile.proteinTarget?Math.min(100,totals.protein/profile.proteinTarget*100):0}%`}}/></div><small className="muted">Build meals around protein</small></div>
        </section>
        <section className="content-grid">
          <div className="panel"><div className="panel-heading"><div><h3>Today's meals</h3><p className="muted">Your food diary for {today()}</p></div><button className="secondary" onClick={()=>setShowLog(true)}><Plus size={16}/> Add food</button></div>
            {MEALS.map(m=>{const rows=todayLogs.filter(l=>l.mealType===m);return <div className="meal-row" key={m}><div className="meal-name"><span className="meal-dot"/><b>{m}</b></div><div className="meal-foods">{rows.length?rows.map(l=><div className="food-line" key={l.id}><span>{l.foodName} <small>× {l.quantity}</small></span><b>{Math.round(l.calories)} kcal</b></div>):<span className="muted">Nothing logged yet</span>}</div></div>})}
          </div>
          <div className="panel advisor-card"><div className="advisor-icon"><Sparkles/></div><p className="eyebrow">A LITTLE GUIDANCE</p><h3>Make your next meal count.</h3><p className="muted">Get simple meal ideas based on your remaining calories and RM{budget} daily budget.</p><button className="primary full" onClick={()=>setPage("AI advisor")}>Ask MyDiet advisor <Sparkles size={16}/></button><div className="tip"><b>Remember</b><p>Try to include a protein source and vegetables in your main meals. You don't need to skip meals to lose weight.</p></div></div>
        </section>
        <section className="home-shortcuts-section">
          <div className="home-shortcuts-heading"><div><p className="eyebrow">QUICK ACCESS</p><h3>Where would you like to go?</h3><p className="muted">All MyDiet features are one tap away.</p></div></div>
          <div className="home-shortcuts">
            <button className="shortcut-card" onClick={()=>setPage("Meal plan")}><span className="shortcut-icon green"><ChefHat size={21}/></span><span className="shortcut-copy"><b>Meal plan</b><small>See today's suggested meals</small></span><span className="shortcut-arrow">›</span></button>
            <button className="shortcut-card" onClick={()=>setPage("Diary")}><span className="shortcut-icon peach"><Utensils size={21}/></span><span className="shortcut-copy"><b>Food diary</b><small>Review meals and calories</small></span><span className="shortcut-arrow">›</span></button>
            <button className="shortcut-card" onClick={()=>setPage("Food library")}><span className="shortcut-icon yellow"><Apple size={21}/></span><span className="shortcut-copy"><b>Food library</b><small>Find and log Malaysian food</small></span><span className="shortcut-arrow">›</span></button>
            <button className="shortcut-card" onClick={()=>setPage("AI advisor")}><span className="shortcut-icon purple"><Sparkles size={21}/></span><span className="shortcut-copy"><b>MyDiet advisor</b><small>Get practical food suggestions</small></span><span className="shortcut-arrow">›</span></button>
            <button className="shortcut-card" onClick={()=>setPage("Progress")}><span className="shortcut-icon blue"><ChartNoAxesCombined size={21}/></span><span className="shortcut-copy"><b>My progress</b><small>Track your weight journey</small></span><span className="shortcut-arrow">›</span></button>
            <button className="shortcut-card" onClick={()=>setProfileOpen(true)}><span className="shortcut-icon grey"><Settings size={21}/></span><span className="shortcut-copy"><b>Profile & settings</b><small>Update goals and preferences</small></span><span className="shortcut-arrow">›</span></button>
          </div>
        </section>
      </div>}

      {page==="Meal plan" && <div className="page-stack">
        <section className="welcome-row"><div><p className="eyebrow">YOUR DAILY FOOD GUIDE</p><h1>Today's meal plan<span>.</span></h1><p className="muted">Affordable halal-friendly mamak, Malay and home-style meals based on your calorie target.</p></div><div className="welcome-icon"><ChefHat size={38}/></div></section>
        {!profile.calorieTarget && <div className="notice"><CircleHelp size={20}/><div><b>Set up your body profile first</b><p>Enter your age, height, current weight, target weight and activity level to estimate your daily calorie target.</p></div><button className="secondary" onClick={()=>setProfileOpen(true)}>Set up profile</button></div>}
        <div className="program-banner"><div><span className="eyebrow">YOUR STRUCTURED WEIGHT-LOSS PROGRAMME</span><h2>Day {Math.min(programDay, programDuration)} of {programDuration}</h2><p>One daily menu, planned around affordable Malaysian mamak, Malay and home-cooked halal-friendly food.</p></div><div className="program-days"><b>{Math.max(0, programDuration - Math.min(programDay, programDuration))}</b><small>days left</small></div></div>
        <div className="program-progress"><div style={{width:`${Math.min(100, programDay / programDuration * 100)}%`}}/></div>
        <div className="plan-summary"><div><span>Daily calorie target</span><b>{calorieTarget || 1800} kcal</b></div><div><span>Today's assigned meals</span><b>{plannedCalories} kcal</b></div><div><span>Calories logged</span><b>{Math.round(totals.calories)} kcal</b></div></div>
        <p className="plan-budget-line">Today's planned food cost: <b>{money(plannedCost)}</b> · Daily budget: <b>{money(budget)}</b>{plannedCost > budget ? " · This menu is above your budget estimate." : " · Within your budget estimate."}</p>
        {profile.targetWeight && <p className="footnote">Goal: {profile.weight} kg → {profile.targetWeight} kg. Estimated timeline at a gradual average pace: about {profile.estimatedWeeks || 0} weeks. The {programDuration}-day programme is a first phase, not a promise that the full target will be reached in that time.</p>}
        {programComplete && <div className="notice"><CircleHelp size={20}/><div><b>Your {programDuration}-day programme is complete.</b><p>Review your weight trend and restart a fresh programme if appropriate.</p></div><button className="secondary" onClick={restartProgram}>Start again</button></div>}
        <div className="panel plan-intro"><div><h3>Today's assigned menu</h3><p className="muted">Follow the listed meals and portions as your daily plan. If an item is unavailable, choose a similar protein-and-vegetable option and log what you actually ate. Do not skip meals to compensate.</p></div><button className="secondary" onClick={restartProgram}>Restart programme</button></div>
        <div className="plan-grid">{mealPlan.map(item=>{const logged=todayLogs.some(l=>l.mealType===item.key && l.source==="meal-plan");return <article className={`plan-card ${logged?"meal-completed":""}`} key={item.key}><div className="plan-card-top"><div><span className="food-category">{item.label} · {reminders[item.timeKey] || "Set time"}</span><h3>{item.name}</h3></div><div className="plan-calories"><b>{item.calories}</b><small>kcal</small></div></div><p className="plan-note">{item.note}</p><div className="plan-meta"><span><Flame size={14}/> {item.protein}g protein</span><span><Wallet size={14}/> {money(item.cost)}</span><span>Meal allowance: {item.targetCalories} kcal</span></div><button className={logged?"secondary full":"primary full"} disabled={logged} onClick={()=>logPlannedMeal(item)}>{logged?"Meal marked as eaten ✓":"I ate this meal · Mark complete"}</button></article>})}</div>
        <p className="footnote">Meal calories and prices are estimates; restaurant portions, oil and recipes vary. MyDiet provides a structured guide, not a medical prescription. If you feel unwell, unusually hungry or weak, eat appropriately and seek qualified advice rather than forcing the calorie target. Confirm halal status with the restaurant.</p>
        <div className="panel"><div className="panel-heading"><div><h3>Meal-time reminders</h3><p className="muted">Get a browser notification at your chosen meal times.</p></div><span className="tag">{reminders.enabled ? "Enabled" : "Not enabled"}</span></div><div className="reminder-times">{MEAL_SLOTS.map(slot=><label key={slot.key}>{slot.label}<input type="time" value={reminders[slot.timeKey]} onChange={e=>setReminders(r=>({...r,[slot.timeKey]:e.target.value}))}/></label>)}</div><div className="reminder-actions"><button className="primary" onClick={enableReminders}>Enable notifications</button><button className="secondary" onClick={()=>setReminders(r=>({...r,enabled:false}))}>Turn off</button></div><p className="footnote">Important: browser reminders run while MyDiet is open. For notifications when the browser is closed, we need to add Firebase Cloud Messaging (FCM), a service worker and push setup.</p></div>
      </div>}

      {page==="Diary" && <div className="page-stack"><div className="page-intro"><div><h1>Food diary</h1><p className="muted">See what you've eaten and what it adds up to.</p></div><button className="primary" onClick={()=>setShowLog(true)}><Plus size={17}/> Add food</button></div>
        <div className="stats-grid compact"><div className="stat-card"><span className="muted">Calories</span><strong>{Math.round(totals.calories)} kcal</strong></div><div className="stat-card"><span className="muted">Protein</span><strong>{Math.round(totals.protein)} g</strong></div><div className="stat-card"><span className="muted">Spending</span><strong>{money(totals.cost)}</strong></div></div>
        {MEALS.map(m=><div className="panel diary-panel" key={m}><h3>{m}</h3>{todayLogs.filter(l=>l.mealType===m).length===0?<p className="muted empty">No food logged.</p>:todayLogs.filter(l=>l.mealType===m).map(l=><div className="diary-entry" key={l.id}>{l.photoUrl?<img src={l.photoUrl} alt="Food"/>:<div className="food-thumb"><Utensils/></div>}<div className="entry-main"><b>{l.foodName}</b><small>{l.portion} · {l.quantity} serving · {money(l.cost)}</small></div><div className="entry-nutrition"><b>{Math.round(l.calories)} kcal</b><small>{l.protein}g protein</small></div><button className="icon-button danger" onClick={()=>removeLog(l.id)} title="Delete"><Trash2 size={17}/></button></div>)}</div>)}
      </div>}

      {page==="Food library" && <div className="page-stack"><div className="page-intro"><div><h1>Malaysian food library</h1><p className="muted">Search everyday food and add a serving to your diary.</p></div></div>
        <div className="search-box"><Search size={18}/><input value={foodSearch} onChange={e=>setFoodSearch(e.target.value)} placeholder="Search roti canai, nasi ayam, telur..."/></div>
        <div className="chips">{["All",...new Set(FOOD_LIBRARY.map(f=>f.category))].map(c=><button key={c} className={category===c?"chip active":"chip"} onClick={()=>setCategory(c)}>{c}</button>)}</div>
        <div className="food-grid">{filteredFoods.map(f=><div className="food-card" key={f.id}><div className="food-card-top"><span className="food-category">{f.category}</span><span className="cal-pill">{f.calories} kcal</span></div><h3>{f.name}</h3><p className="muted">{f.serving}</p><div className="food-meta"><span>{f.protein}g protein</span><span>{money(f.price)}</span></div><button className="secondary full" onClick={()=>{setSelectedFood(f);setCost(String(f.price));setCustomCalories(String(f.calories));setCustomProtein(String(f.protein));setShowLog(true)}}><Plus size={15}/> Add to diary</button></div>)}</div>
        <p className="footnote">Nutrition and price figures are estimates. Actual portions, recipes, oil and gravy can change the values significantly. Edit values when logging.</p>
      </div>}

      {page==="AI advisor" && <div className="page-stack"><div className="page-intro"><div><h1>MyDiet advisor</h1><p className="muted">Practical suggestions using familiar Malaysian food.</p></div><div className="advisor-icon large"><Sparkles/></div></div>
        <div className="advisor-summary"><div><span>Calories left</span><b>{calorieTarget?Math.round(remaining)+" kcal":"Set profile first"}</b></div><div><span>Budget left</span><b>{money(budgetLeft)}</b></div><div><span>Protein so far</span><b>{Math.round(totals.protein)} g</b></div></div>
        <div className="panel"><h3>What are you in the mood for?</h3><p className="muted">Try: "I want mamak food", "suggest a cheap breakfast", or "what should I eat for dinner?"</p><textarea rows="3" value={advisorQuestion} onChange={e=>setAdvisorQuestion(e.target.value)} placeholder="Tell MyDiet what you're craving..."/>
          <div className="suggestion-chips">{["Mamak food under RM10","Cheap breakfast","Dinner idea","High protein meal"].map(s=><button className="chip" key={s} onClick={()=>setAdvisorQuestion(s)}>{s}</button>)}</div><button className="primary" onClick={()=>{if(!advisorQuestion.trim())setAdvisorQuestion("Suggest a balanced, affordable Malaysian meal");}}>Get suggestions <Sparkles size={16}/></button>
        </div>
        {advisorQuestion.trim() && <div className="panel"><div className="panel-heading"><h3>Suggestions for you</h3><span className="tag">Rule-based starter advisor</span></div>{getAdvice().map((a,i)=><div className="recommendation" key={a[0]}><div className="rec-number">{i+1}</div><div className="rec-body"><b>{a[0]}</b><strong>{a[1]}</strong><p className="muted">{a[2]}</p></div></div>)}<p className="footnote">These are starter suggestions, not live AI-generated nutrition analysis. The app considers your budget and daily totals as context; verify portions and prices at the restaurant.</p></div>}
      </div>}

      {page==="Progress" && <div className="page-stack"><div className="page-intro"><div><h1>Your progress</h1><p className="muted">Small, steady changes matter more than daily fluctuations.</p></div></div>
        <div className="stats-grid compact"><div className="stat-card"><span className="muted">Current weight</span><strong>{profile.weight?`${profile.weight} kg`:"—"}</strong></div><div className="stat-card"><span className="muted">Target weight</span><strong>{profile.targetWeight?`${profile.targetWeight} kg`:"—"}</strong></div><div className="stat-card"><span className="muted">Entries</span><strong>{weights.length}</strong></div></div>
        <div className="panel"><h3>Log your weight</h3><form className="weight-form" onSubmit={addWeight}><input type="number" step="0.1" min="20" max="350" placeholder="e.g. 82.5 kg" value={weightInput} onChange={e=>setWeightInput(e.target.value)}/><button className="primary">Save weight</button></form></div>
        <div className="panel"><h3>Weight history</h3>{weights.length===0?<p className="muted empty">No weight entries yet. Add your first weigh-in above.</p>:<div className="weight-list">{[...weights].sort((a,b)=>b.date.localeCompare(a.date)).map(w=><div key={w.id} className="weight-row"><span>{new Date(w.date+"T00:00:00").toLocaleDateString("en-MY",{day:"numeric",month:"short",year:"numeric"})}</span><b>{w.weight} kg</b></div>)}</div>}</div>
      </div>}
    </main>

    {showLog && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget){setShowLog(false);resetLog()}}}><div className="modal"><div className="modal-heading"><div><p className="eyebrow">FOOD DIARY</p><h2>Add food</h2></div><button className="icon-button" onClick={()=>{setShowLog(false);resetLog()}}><X/></button></div>
      <form onSubmit={addFoodLog} className="stack">
        <label>Meal<select value={meal} onChange={e=>setMeal(e.target.value)}>{MEALS.map(m=><option key={m}>{m}</option>)}</select></label>
        <label>What did you eat? <input type="text" value={foodQuery} onChange={e=>{setFoodQuery(e.target.value);setSelectedFood(null);setCustomCalories("");setCustomProtein("");setCost("")}} placeholder="Type e.g. nasi lemak, roti canai, chicken rice" autoComplete="off" /></label>
        {foodQuery.trim().length >= 2 && !selectedFood && <div className="food-match-list">
          {foodMatches.length > 0 ? foodMatches.map(f=><button type="button" className="food-match" key={f.id} onClick={()=>chooseFood(f)}><span><b>{f.name}</b><small>{f.serving}</small></span><strong>{f.calories} kcal</strong></button>) : <p className="footnote">No close match in the Malaysian food library.</p>}
          <button type="button" className="secondary full" onClick={useCustomFood}>Use “{foodQuery.trim()}” as a custom food</button>
        </div>}
        {selectedFood && <div className="selected-food"><b>{selectedFood.name}</b><span>{selectedFood.serving} · {selectedFood.id === "custom" ? "Custom estimate" : "Matched from food library"}</span></div>}
        <div className="form-two"><label>Quantity<input type="number" min="0.25" step="0.25" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label><label>Cost (RM)<input type="number" min="0" step="0.10" value={cost} onChange={e=>setCost(e.target.value)} placeholder="e.g. 5.00"/></label></div>
        <div className="form-two"><label>Calories per serving<input type="number" min="0" value={customCalories} onChange={e=>setCustomCalories(e.target.value)} placeholder="kcal"/></label><label>Protein per serving (g)<input type="number" min="0" value={customProtein} onChange={e=>setCustomProtein(e.target.value)} placeholder="grams"/></label></div>
        <label className="upload-label"><ImagePlus size={18}/> Add food photo (optional)<input type="file" accept="image/*" capture="environment" onChange={e=>{const f=e.target.files?.[0];if(f){setPhoto(f);setPhotoPreview(URL.createObjectURL(f))}}}/></label>
        {photoPreview && <img className="photo-preview" src={photoPreview} alt="Selected food"/>}
        <p className="footnote">Library matches fill calories and protein automatically. Estimates vary by portion and recipe. For a custom food, enter your best calorie estimate. Photos are saved with the diary entry but are not yet AI-analysed.</p>
        {selectedFood && <div className="selected-food"><b>Estimated total</b><strong>{Math.round((Number(customCalories)||0)*(Math.max(0.25,Number(quantity)||1)))} kcal</strong></div>}
        <button className="primary full" disabled={!selectedFood || customCalories === ""}>Save to diary</button>
      </form></div></div>}

    {profileOpen && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setProfileOpen(false)}}><div className="modal"><div className="modal-heading"><div><p className="eyebrow">PERSONAL SETTINGS</p><h2>Your body profile</h2></div><button className="icon-button" onClick={()=>setProfileOpen(false)}><X/></button></div>
      <form className="stack" onSubmit={async e=>{await saveProfile(e);setProfileOpen(false)}}><label>Name<input value={profile.name} onChange={e=>setProfile({...profile,name:e.target.value})} placeholder="Your name"/></label>
        <div className="form-two"><label>Age<input type="number" min="18" max="100" value={profile.age} onChange={e=>setProfile({...profile,age:e.target.value})}/></label><label>Sex<select value={profile.sex} onChange={e=>setProfile({...profile,sex:e.target.value})}><option>Male</option><option>Female</option></select></label></div>
        <div className="form-two"><label>Height (cm)<input type="number" value={profile.height} onChange={e=>setProfile({...profile,height:e.target.value})} placeholder="170"/></label><label>Current weight (kg)<input type="number" step="0.1" value={profile.weight} onChange={e=>setProfile({...profile,weight:e.target.value})} placeholder="85"/></label></div>
        <div className="form-two"><label>Target weight (kg)<input type="number" step="0.1" value={profile.targetWeight} onChange={e=>setProfile({...profile,targetWeight:e.target.value})} placeholder="75"/></label><label>Daily budget (RM)<input type="number" value={profile.budget} onChange={e=>setProfile({...profile,budget:Number(e.target.value)})}/></label></div>
        <label>Activity level<select value={profile.activity} onChange={e=>setProfile({...profile,activity:e.target.value})}><option>Sedentary</option><option>Lightly active</option><option>Moderately active</option><option>Very active</option></select></label>
        <label>Preferred food style<select value={profile.foodStyle || "Mix"} onChange={e=>setProfile({...profile,foodStyle:e.target.value})}><option value="Mix">Mix of mamak, Malay & home food</option><option value="Mamak">Mamak food</option><option value="Malay">Malay food</option></select></label>
        <label>Meal programme duration<select value={profile.programDuration || 30} onChange={e=>setProfile({...profile,programDuration:Number(e.target.value),programStartDate:today()})}><option value={30}>30 days (1 month)</option><option value={60}>60 days (2 months)</option></select><small className="muted">Changing duration restarts the programme from today.</small></label>
        <button className="primary full">Save profile & calculate targets</button>
        {profile.calorieTarget>0 && <p className="success-note">Daily calorie guide: {profile.calorieTarget} kcal · Protein guide: {profile.proteinTarget}g/day · Programme: {profile.programDuration || 30} days</p>}
      </form></div></div>}
    {toast && <div className="toast">{toast}</div>}
  </div>;
}

export default App;
