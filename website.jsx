import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as d3 from "d3";
import _ from "lodash";

// ─── PERSISTENT STORAGE ───
const STORAGE_KEYS = {
  mentalMathScores: "qp-mental-math-scores",
  hardProblems: "qp-hard-problems",
  hardProblemTime: "qp-hard-problem-time",
  hardProblemAttempts: "qp-hard-problem-attempts",
};

async function loadData(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

async function saveData(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error("Storage error:", e);
  }
}

// ─── HARD PROBLEM BANK ───
const PROBLEM_BANK = {
  probability: [
    { id: "p1", title: "Birthday Problem", desc: "What is the minimum number of people needed in a room such that the probability of two people sharing the same birthday exceeds 50%?", hint: "Use the complementary counting approach.", answer: "23" },
    { id: "p2", title: "Dice Expected Value", desc: "You roll a fair 6-sided die. You can choose to accept the value or roll again (once). What's the optimal strategy and expected value?", hint: "Compare E[die] with the threshold for re-rolling.", answer: "4.25" },
    { id: "p3", title: "Coupon Collector", desc: "A cereal box contains one of n different toys. How many boxes must you buy on average to collect all n toys? Express for general n.", hint: "Sum of n/k for k=1 to n.", answer: "n * H_n (n-th harmonic number)" },
    { id: "p4", title: "Gambler's Ruin", desc: "You start with $k. Each round you win $1 with probability p or lose $1 with probability 1-p. What is the probability of reaching $N before going broke?", hint: "Set up the recurrence relation.", answer: "(1-(q/p)^k)/(1-(q/p)^N) for p≠0.5" },
    { id: "p5", title: "Broken Stick", desc: "A stick of length 1 is broken at two uniformly random points. What is the probability the three pieces can form a triangle?", hint: "Triangle inequality on all three pairs.", answer: "1/4" },
    { id: "p6", title: "Conditional Coin", desc: "I flip two coins. At least one is heads. What is the probability both are heads?", hint: "Careful with the sample space.", answer: "1/3" },
    { id: "p7", title: "Random Walk Return", desc: "In a 1D symmetric random walk starting at 0, what is the probability of eventually returning to 0?", hint: "Think about the recurrence properties.", answer: "1 (certain)" },
    { id: "p8", title: "Monty Hall Variant", desc: "There are 100 doors with one prize. You pick one, the host opens 98 empty doors. Should you switch?", hint: "Generalize the classic Monty Hall.", answer: "Yes, switch. P(win) = 99/100" },
    { id: "p9", title: "Ballot Problem", desc: "Candidate A gets a votes, B gets b votes (a > b). What's the probability A is strictly ahead throughout the count?", hint: "Reflection principle.", answer: "(a-b)/(a+b)" },
    { id: "p10", title: "Hat Problem", desc: "N people throw their hats in a pile and each picks one randomly. What is the expected number of people who get their own hat?", hint: "Linearity of expectation.", answer: "1, for any N" },
    { id: "p11", title: "Bayes' Disease Test", desc: "A disease affects 1% of the population. A test is 99% accurate (both sensitivity and specificity). You test positive. What is the probability you actually have the disease?", hint: "P(disease|positive) = P(positive|disease)×P(disease) / P(positive)", answer: "≈ 50%. P = (0.99×0.01)/(0.99×0.01 + 0.01×0.99) = 0.5" },
    { id: "p12", title: "St. Petersburg Paradox", desc: "A fair coin is flipped until heads appears. You win $2^n where n is the flip number. What is the expected payout? Why won't rational people pay much to play?", hint: "E = Σ (1/2^n)·(2^n) for n=1 to ∞.", answer: "E = ∞, but due to logarithmic utility, a fair price is roughly $20–$25 for most people." },
    { id: "p13", title: "Geometric Expected Value", desc: "You roll a fair die repeatedly until you get a 6. What are the expected number of rolls and the variance?", hint: "Geometric(p=1/6): E=1/p, Var=(1-p)/p².", answer: "E = 6, Var = 30, SD ≈ 5.48" },
    { id: "p14", title: "Poisson Probability", desc: "A Poisson process has rate λ=3 events per minute. What is the probability of exactly 5 events in one minute?", hint: "P(X=k) = e^{-λ}·λ^k / k!", answer: "e^{-3}·3^5/5! = 243e^{-3}/120 ≈ 0.1008" },
    { id: "p15", title: "Total Expectation", desc: "A fair coin is flipped. If heads, you roll a d6; if tails, you roll a d12. What is the expected result?", hint: "E[X] = E[X|H]P(H) + E[X|T]P(T).", answer: "E = 3.5×0.5 + 6.5×0.5 = 5" },
    { id: "p16", title: "Secretary Problem", desc: "You interview n candidates sequentially and must immediately hire or reject each. What strategy maximizes the probability of selecting the best candidate?", hint: "Optimal: skip the first r* candidates, then hire the next one better than all seen so far.", answer: "Skip first n/e ≈ 37%, then pick the next new best. Optimal P → 1/e ≈ 36.8%" },
    { id: "p17", title: "Two Envelopes", desc: "Two envelopes contain $X and $2X. You open one and see $100. The other has either $200 or $50 with equal probability — so E[switch] = $125. Should you switch?", hint: "Think about whether equal probability of double/half is consistent with any valid prior on X.", answer: "No edge to switching. The calculation is flawed: you cannot assign equal probability to both cases without an improper prior on X." },
    { id: "p18", title: "Buffon's Needle", desc: "A needle of length L is dropped randomly on a floor with parallel lines spaced D apart (L ≤ D). What is the probability it crosses a line?", hint: "Integrate over the drop angle θ ∈ [0, π] and the distance from the nearest line.", answer: "P = 2L/(πD)" },
    { id: "p19", title: "Order Statistics", desc: "X₁, X₂, X₃ are i.i.d. Uniform(0,1). What are the expected values of the maximum, the median, and the minimum?", hint: "E[X_(k:n)] = k/(n+1) for uniform order statistics.", answer: "E[min]=1/4, E[median]=2/4=1/2, E[max]=3/4" },
    { id: "p20", title: "Hypergeometric Draw", desc: "An urn has 5 red and 5 blue balls. You draw 3 without replacement. What is the probability of exactly 2 red?", hint: "Hypergeometric: C(5,2)×C(5,1)/C(10,3).", answer: "C(5,2)×C(5,1)/C(10,3) = 10×5/120 = 50/120 = 5/12 ≈ 0.4167" },
  ],
  sequences: [
    { id: "s1", title: "Fibonacci Mod", desc: "What is the last digit of the 100th Fibonacci number?", hint: "Pisano period for mod 10 is 60.", answer: "5" },
    { id: "s2", title: "Sum of Squares", desc: "Find a closed form for 1² + 2² + ... + n².", hint: "Try telescoping with (k+1)³ - k³.", answer: "n(n+1)(2n+1)/6" },
    { id: "s3", title: "Geometric Series Twist", desc: "Evaluate: Σ(k=1 to ∞) k·x^k for |x|<1.", hint: "Differentiate the geometric series.", answer: "x/(1-x)²" },
    { id: "s4", title: "Recurrence Relation", desc: "Solve: a(n) = 5a(n-1) - 6a(n-2) with a(0)=1, a(1)=1.", hint: "Characteristic equation: r²-5r+6=0.", answer: "a(n) = 3·2^n - 2·3^n... verify boundary" },
    { id: "s5", title: "Catalan Numbers", desc: "How many valid arrangements of n pairs of parentheses exist? Express as a formula.", hint: "C(2n,n)/(n+1).", answer: "C(2n,n)/(n+1)" },
    { id: "s6", title: "Sum of Cubes", desc: "Find a closed form for 1³ + 2³ + ... + n³.", hint: "Notice the surprising identity involving triangular numbers.", answer: "[n(n+1)/2]² — the square of the n-th triangular number" },
    { id: "s7", title: "Alternating Harmonic Series", desc: "Evaluate: 1 − 1/2 + 1/3 − 1/4 + ... to infinity.", hint: "Related to the Taylor series of ln(1+x) evaluated at x=1.", answer: "ln(2) ≈ 0.6931" },
    { id: "s8", title: "Arithmetico-Geometric Series", desc: "Evaluate Σ_{k=1}^∞ k/2^k (i.e. 1/2 + 2/4 + 3/8 + 4/16 + ...).", hint: "Differentiate the geometric series Σ x^k with respect to x, then set x=1/2.", answer: "2 (use x/(1-x)² evaluated at x=1/2)" },
    { id: "s9", title: "Basel Problem", desc: "What is the exact sum of 1 + 1/4 + 1/9 + 1/16 + ... = Σ 1/n²?", hint: "Euler compared the Taylor series of sin(x)/x with its product form over roots.", answer: "π²/6 ≈ 1.6449" },
    { id: "s10", title: "Tribonacci Sequence", desc: "The Tribonacci sequence starts 0, 0, 1 with T(n) = T(n-1)+T(n-2)+T(n-3). What is T(10)?", hint: "Extend term by term from the start.", answer: "T(10) = 149. Sequence: 0,0,1,1,2,4,7,13,24,44,81,149..." },
  ],
  combinatorics: [
    { id: "c1", title: "Derangements", desc: "How many permutations of {1,...,n} have no fixed points? Give the formula.", hint: "Inclusion-exclusion on fixed points.", answer: "n! Σ(-1)^k/k! for k=0..n" },
    { id: "c2", title: "Stars and Bars", desc: "How many non-negative integer solutions exist for x₁ + x₂ + x₃ = 10?", hint: "Stars and bars formula.", answer: "C(12,2) = 66" },
    { id: "c3", title: "Grid Paths", desc: "How many shortest paths exist from (0,0) to (m,n) on a grid, moving only right or up?", hint: "Choose which steps go right.", answer: "C(m+n, m)" },
    { id: "c4", title: "Pigeonhole Application", desc: "Given 5 points with integer coordinates in the plane, prove that at least one pair has a midpoint with integer coordinates.", hint: "Consider parity of (x,y).", answer: "4 parity classes for (x mod 2, y mod 2), 5 points → pigeonhole" },
    { id: "c5", title: "Handshake Lemma", desc: "At a party of 10 people, each shakes hands with exactly 3 others. Is this possible?", hint: "Sum of degrees must be even.", answer: "Yes. 10×3=30, and 30 is even, so the sum of degrees is valid. (e.g., two disjoint 5-cycles each with chords)" },
    { id: "c6", title: "Inclusion-Exclusion (3 sets)", desc: "100 students: 70 like Math, 60 like Science, 50 like Art. 40 like Math+Science, 35 like Math+Art, 30 like Science+Art. 20 like all three. How many like at least one subject?", hint: "|A∪B∪C| = |A|+|B|+|C| − |A∩B| − |A∩C| − |B∩C| + |A∩B∩C|.", answer: "70+60+50−40−35−30+20 = 95" },
    { id: "c7", title: "Circular Arrangements", desc: "In how many distinct ways can 6 people sit around a circular table (rotations counted as the same)?", hint: "Fix one person to remove rotational equivalence.", answer: "(6−1)! = 5! = 120" },
    { id: "c8", title: "Multiset Permutations", desc: "How many distinct arrangements of the letters in MISSISSIPPI are there?", hint: "n!/(n₁!·n₂!·...) for repeated letters. Count each letter's frequency.", answer: "11!/(4!·4!·2!·1!) = 34,650" },
    { id: "c9", title: "Partition into Groups", desc: "How many ways can 9 people be split into 3 indistinguishable groups of 3?", hint: "Divide by 3! to remove the ordering of the groups.", answer: "C(9,3)·C(6,3)·C(3,3) / 3! = 84·20·1/6 = 280" },
    { id: "c10", title: "Compositions of n", desc: "In how many ways can the integer 5 be written as an ordered sum of positive integers (e.g., 2+3 ≠ 3+2)?", hint: "Each composition of n corresponds to a subset of {1,...,n−1}.", answer: "2^(5−1) = 16" },
  ],
  estimation: [
    { id: "e1", title: "Piano Tuners", desc: "How many piano tuners are in Chicago?", hint: "Fermi estimation: population → pianos → tuning frequency → tuners needed.", answer: "~100-300 (classic Fermi)" },
    { id: "e2", title: "Golf Balls in Bus", desc: "How many golf balls fit in a school bus?", hint: "Estimate bus volume, golf ball volume, packing efficiency ~64%.", answer: "~500,000" },
    { id: "e3", title: "√2 Approximation", desc: "Estimate √2 to 4 decimal places without a calculator.", hint: "Newton's method: x_{n+1} = (x_n + 2/x_n)/2.", answer: "1.4142" },
    { id: "e4", title: "Log Estimation", desc: "Estimate ln(50) without a calculator.", hint: "ln(50) = ln(100/2) = ln(100) - ln(2).", answer: "≈ 3.912" },
    { id: "e5", title: "Market Cap", desc: "Estimate the total revenue of all McDonald's restaurants in the US per year.", hint: "# locations × avg revenue per location.", answer: "~$40-50B" },
    { id: "e6", title: "US Gas Stations", desc: "Estimate the number of gas stations in the United States.", hint: "Consider US population, vehicle ownership rate, fill-up frequency, and average throughput per station per day.", answer: "~150,000 (actual: ~145,000)" },
    { id: "e7", title: "Words Spoken Per Day", desc: "Estimate the average number of words a person speaks per day.", hint: "Waking hours × fraction spent talking × speaking rate (~130 words/min).", answer: "~16,000 words/day (studies find range of 7,000–25,000)" },
    { id: "e8", title: "Stack of Bills to the Moon", desc: "If you stacked $1 bills to reach the Moon (384,000 km away), how much money would that be?", hint: "A US $1 bill is approximately 0.1 mm thick.", answer: "384×10⁹ mm / 0.1 mm = 3.84×10¹² bills = $3.84 trillion" },
    { id: "e9", title: "NYC Taxi Annual Revenue", desc: "Estimate the gross annual revenue of a single NYC taxi driver.", hint: "Estimate shifts per week, hours per shift, fares per hour, and average fare.", answer: "~$75,000–$100,000 gross revenue/year before expenses" },
    { id: "e10", title: "Red Blood Cells in Body", desc: "Estimate the number of red blood cells in the human body.", hint: "Blood volume (~5 L) × RBC density (~5 million per mL).", answer: "~25 trillion (5 L × 5×10⁶/mL = 2.5×10¹³)" },
  ],
  mental_tricks: [
    { id: "m1", title: "Squaring Near 50", desc: "Calculate 47² mentally.", hint: "47² = (50-3)² = 2500 - 300 + 9.", answer: "2209" },
    { id: "m2", title: "Multiply by 11", desc: "Calculate 7326 × 11 mentally.", hint: "Insert sums of adjacent digits.", answer: "80586" },
    { id: "m3", title: "Divisibility by 7", desc: "Is 2744 divisible by 7? Find a fast mental check.", hint: "Double the last digit, subtract from the rest.", answer: "Yes (2744 = 7 × 392 = 14³)" },
    { id: "m4", title: "Cross Multiplication", desc: "Calculate 23 × 47 mentally.", hint: "23×47 = 23×50 - 23×3 = 1150 - 69.", answer: "1081" },
    { id: "m5", title: "Percentage Trick", desc: "Calculate 37% of 84 mentally.", hint: "37% of 84 = 84% of 37 (commutativity).", answer: "31.08" },
    { id: "m6", title: "Squaring Numbers Ending in 5", desc: "Calculate 85² mentally.", hint: "For n5²: take n×(n+1), then append 25. Here n=8.", answer: "7225. (8×9=72, append 25)" },
    { id: "m7", title: "Near-100 Multiplication", desc: "Calculate 97 × 96 mentally.", hint: "(100−a)(100−b) = 10000 − 100(a+b) + ab.", answer: "9312. (a=3, b=4: 10000−700+12=9312)" },
    { id: "m8", title: "Casting Out Nines", desc: "Use casting out nines to check: is 3456 × 78 = 269,568 plausible?", hint: "Replace each number by its digit sum (mod 9) and verify the product matches.", answer: "3456→(3+4+5+6)=18→0; 78→15→6; 0×6=0 mod 9. 269568→(2+6+9+5+6+8)=36→0. Consistent. (Not proof, but a quick sanity check.)" },
    { id: "m9", title: "Rule of 72", desc: "An investment grows at 8% per year. About how many years until it doubles?", hint: "Rule of 72: years ≈ 72 / annual rate.", answer: "72/8 = 9 years (exact: ln2/ln1.08 ≈ 9.0 years)" },
    { id: "m10", title: "Fast Fraction to Decimal", desc: "Convert 7/11 to a decimal mentally.", hint: "1/11 = 0.090909..., so multiply by 7.", answer: "0.6̄3̄ = 0.636363... (repeating 63)" },
  ],
  brainteasers: [
    { id: "b1", title: "100 Lockers", desc: "100 students toggle lockers 1-100. Student k toggles every k-th locker. Which lockers are open at the end?", hint: "A locker is toggled once per divisor.", answer: "Perfect squares: 1,4,9,16,25,36,49,64,81,100" },
    { id: "b2", title: "Blue Eyes Island", desc: "On an island of 100 blue-eyed people, a visitor says 'at least one of you has blue eyes.' Everyone is a perfect logician. What happens?", hint: "Induction from the base case of 1 person.", answer: "All 100 leave on night 100" },
    { id: "b3", title: "Two Egg Problem", desc: "You have 2 eggs and a 100-floor building. Find the highest safe floor with minimum worst-case drops.", hint: "Optimize: if first egg breaks at floor k, you need k-1 more checks.", answer: "14 drops (triangular numbers: 14+13+12+...)" },
    { id: "b4", title: "Prisoner Hat Problem", desc: "100 prisoners in a line each see hats ahead. They guess their own hat color (B/W). One strategy guarantees 99 survive. What is it?", hint: "First person encodes parity.", answer: "First person calls parity of black hats seen. Each subsequent deduces from heard answers." },
    { id: "b5", title: "12 Balls Problem", desc: "12 balls, one is different weight. 3 weighings on a balance scale to find which and whether heavier/lighter.", hint: "Ternary encoding.", answer: "Split 4-4-4, then narrow with relabeling strategy" },
    { id: "b6", title: "3 Light Switches", desc: "Three switches outside a room each control one of three bulbs inside. You may enter the room only once. How do you identify which switch controls which bulb?", hint: "You have three observable states for each bulb — think beyond on/off.", answer: "Turn switch 1 on for 10 min, then off. Turn switch 2 on. Enter: hot+off=switch 1, on=switch 2, cold+off=switch 3." },
    { id: "b7", title: "Burning Ropes", desc: "Two ropes each take exactly 60 minutes to burn (but burn unevenly). How do you measure exactly 45 minutes using only these ropes and a lighter?", hint: "Lighting both ends of a rope halves the remaining burn time.", answer: "Light rope 1 from both ends and rope 2 from one end simultaneously. When rope 1 finishes (30 min), light rope 2's other end — it burns out in 15 more minutes. Total: 45 min." },
    { id: "b8", title: "9 Coins, 2 Weighings", desc: "You have 9 coins; one is lighter than the rest. Find the counterfeit coin in exactly 2 weighings on a balance scale.", hint: "Divide into three groups of equal size.", answer: "Split into 3 groups of 3. Weigh group A vs B. If balanced, the counterfeit is in group C; otherwise it's in the lighter group. Weigh 2 of the 3 suspects — if balanced, the third is counterfeit; otherwise the lighter pan holds it." },
    { id: "b9", title: "Water Jug Problem", desc: "You have a 3L jug and a 5L jug and unlimited water. Measure exactly 4 liters.", hint: "Fill one, pour into the other, empty when full, repeat.", answer: "Fill 5L → pour into 3L (3L full, 2L left) → empty 3L → pour 2L into 3L → fill 5L → pour into 3L until full (1L poured) → 4L remains in 5L." },
    { id: "b10", title: "Ants on a Pole", desc: "100 ants are placed randomly on a 1-metre pole. Each walks at 1 cm/s in a random direction. When two ants collide they reverse direction. When does the last ant fall off?", hint: "Ants passing through each other is equivalent to reversing — what does each 'ant' actually represent?", answer: "At most 100 seconds. Treat collisions as pass-throughs: each position just moves to an end, so the longest possible journey is 100 s regardless of starting positions or collisions." },
  ],
};

const CATEGORY_COLORS = {
  probability: { dark: "#0000a2", light: "#3594cc" },
  sequences: { dark: "#bc272d", light: "#f0b077" },
  combinatorics: { dark: "#4a2377", light: "#8cc5e3" },
  estimation: { dark: "#d31f1", light: "#f47a00" },
  mental_tricks: { dark: "#007191", light: "#62c8d3" },
  brainteasers: { dark: "#c31e23", light: "#ff5a5e" },
};

// Fix the estimation color
CATEGORY_COLORS.estimation = { dark: "#d31f11", light: "#f47a00" };

// ─── APP ───
export default function App() {
  const [activeTab, setActiveTab] = useState("mental");
  const [loaded, setLoaded] = useState(false);

  // Shared data
  const [scores, setScores] = useState([]);
  const [problemState, setProblemState] = useState({});
  const [timeTracking, setTimeTracking] = useState({});

  useEffect(() => {
    (async () => {
      const s = await loadData(STORAGE_KEYS.mentalMathScores, []);
      const p = await loadData(STORAGE_KEYS.hardProblemAttempts, {});
      const t = await loadData(STORAGE_KEYS.hardProblemTime, {});
      setScores(s);
      setProblemState(p);
      setTimeTracking(t);
      setLoaded(true);
    })();
  }, []);

  const saveScores = useCallback((s) => {
    setScores(s);
    saveData(STORAGE_KEYS.mentalMathScores, s);
  }, []);

  const saveProblemState = useCallback((p) => {
    setProblemState(p);
    saveData(STORAGE_KEYS.hardProblemAttempts, p);
  }, []);

  const saveTimeTracking = useCallback((t) => {
    setTimeTracking(t);
    saveData(STORAGE_KEYS.hardProblemTime, t);
  }, []);

  if (!loaded) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "'JetBrains Mono', monospace", color: "var(--text-primary, #e0e0e0)", background: "var(--bg-primary, #0a0a0f)" }}>Loading...</div>;

  const tabs = [
    { key: "mental", label: "Mental Math" },
    { key: "hard", label: "Problem Bank" },
    { key: "resources", label: "Resources" },
  ];

  return (
    <div style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", background: "#0a0a0f", color: "#d4d4d8", minHeight: "100vh" }}>
      <header style={{ borderBottom: "1px solid #1e1e2e", padding: "16px 24px", display: "flex", alignItems: "center", gap: 24, background: "#0d0d14" }}>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, color: "#f0f0f5", margin: 0, letterSpacing: "-0.5px" }}>
          <span style={{ color: "#6366f1" }}>Q</span>uant <span style={{ color: "#6366f1" }}>P</span>rep
        </h1>
        <nav style={{ display: "flex", gap: 4 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
              padding: "8px 16px", borderRadius: 6, border: "none", cursor: "pointer",
              background: activeTab === t.key ? "#6366f1" : "transparent",
              color: activeTab === t.key ? "#fff" : "#71717a",
              fontFamily: "inherit", fontSize: 13, fontWeight: 500, transition: "all 0.2s"
            }}>{t.label}</button>
          ))}
        </nav>
      </header>
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px" }}>
        {activeTab === "mental" && <MentalMathTab scores={scores} saveScores={saveScores} />}
        {activeTab === "hard" && <HardProblemsTab problemState={problemState} saveProblemState={saveProblemState} timeTracking={timeTracking} saveTimeTracking={saveTimeTracking} />}
        {activeTab === "resources" && <ResourcesTab />}
      </main>
    </div>
  );
}

// ─── MENTAL MATH TAB ───
function MentalMathTab({ scores, saveScores }) {
  const [gameState, setGameState] = useState("config"); // config | playing | results
  const [config, setConfig] = useState({
    totalTime: 60,
    modes: ["multiplication"],
    maxNumber: 12,
    perQuestionLimit: 0, // 0 = no limit
  });
  const [currentQ, setCurrentQ] = useState(null);
  const [answer, setAnswer] = useState("");
  const [results, setResults] = useState([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [questionTimeLeft, setQuestionTimeLeft] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);
  const inputRef = useRef(null);
  const timerRef = useRef(null);
  const qTimerRef = useRef(null);
  const startTimeRef = useRef(null);
  const qStartRef = useRef(null);

  // Scoreboard state
  const [sortField, setSortField] = useState("qpm");
  const [sortDir, setSortDir] = useState("desc");
  const [filterMode, setFilterMode] = useState("all");
  const [showChart, setShowChart] = useState(false);

  function generateQuestion(modes, maxNum) {
    const mode = modes[Math.floor(Math.random() * modes.length)];
    let a, b, correctAnswer;
    switch (mode) {
      case "addition":
        a = Math.floor(Math.random() * maxNum) + 1;
        b = Math.floor(Math.random() * maxNum) + 1;
        correctAnswer = a + b;
        return { text: `${a} + ${b}`, answer: correctAnswer, mode };
      case "subtraction":
        a = Math.floor(Math.random() * maxNum) + 1;
        b = Math.floor(Math.random() * maxNum) + 1;
        if (b > a) [a, b] = [b, a];
        correctAnswer = a - b;
        return { text: `${a} − ${b}`, answer: correctAnswer, mode };
      case "multiplication":
        a = Math.floor(Math.random() * maxNum) + 1;
        b = Math.floor(Math.random() * maxNum) + 1;
        correctAnswer = a * b;
        return { text: `${a} × ${b}`, answer: correctAnswer, mode };
      case "division":
        b = Math.floor(Math.random() * maxNum) + 1;
        correctAnswer = Math.floor(Math.random() * maxNum) + 1;
        a = b * correctAnswer;
        return { text: `${a} ÷ ${b}`, answer: correctAnswer, mode };
      default:
        return generateQuestion(["multiplication"], maxNum);
    }
  }

  function startGame() {
    const q = generateQuestion(config.modes, config.maxNumber);
    setCurrentQ(q);
    setAnswer("");
    setResults([]);
    setTimeLeft(config.totalTime);
    setQuestionCount(0);
    setQuestionTimeLeft(config.perQuestionLimit || 0);
    startTimeRef.current = Date.now();
    qStartRef.current = Date.now();
    setGameState("playing");

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          endGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    if (config.perQuestionLimit > 0) {
      qTimerRef.current = setInterval(() => {
        setQuestionTimeLeft(prev => {
          if (prev <= 1) {
            endGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    setTimeout(() => inputRef.current?.focus(), 100);
  }

  function endGame() {
    clearInterval(timerRef.current);
    clearInterval(qTimerRef.current);
    setGameState("results");
  }

  function handleSubmit(e) {
    if (e) e.preventDefault();
    if (!currentQ || gameState !== "playing") return;
    const userAns = parseInt(answer, 10);
    const correct = userAns === currentQ.answer;
    const elapsed = (Date.now() - qStartRef.current) / 1000;

    setResults(prev => [...prev, { ...currentQ, userAnswer: userAns, correct, time: elapsed }]);
    setQuestionCount(prev => prev + 1);

    const nextQ = generateQuestion(config.modes, config.maxNumber);
    setCurrentQ(nextQ);
    setAnswer("");
    qStartRef.current = Date.now();
    if (config.perQuestionLimit > 0) {
      setQuestionTimeLeft(config.perQuestionLimit);
    }
    inputRef.current?.focus();
  }

  // Save results when game ends
  useEffect(() => {
    if (gameState === "results" && results.length > 0) {
      const totalElapsed = (Date.now() - startTimeRef.current) / 1000;
      const correctCount = results.filter(r => r.correct).length;
      const entry = {
        id: Date.now(),
        date: new Date().toISOString(),
        modes: config.modes.join(", "),
        maxNumber: config.maxNumber,
        totalTime: config.totalTime,
        perQuestionLimit: config.perQuestionLimit,
        totalQuestions: results.length,
        correct: correctCount,
        accuracy: results.length > 0 ? Math.round((correctCount / results.length) * 100) : 0,
        qpm: results.length > 0 ? Math.round((results.length / (totalElapsed / 60)) * 100) / 100 : 0,
        elapsed: Math.round(totalElapsed),
      };
      saveScores([entry, ...scores]);
    }
  }, [gameState]);

  const filteredScores = useMemo(() => {
    let s = [...scores];
    if (filterMode !== "all") s = s.filter(x => x.modes.includes(filterMode));
    s.sort((a, b) => {
      const av = a[sortField], bv = b[sortField];
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return s;
  }, [scores, sortField, sortDir, filterMode]);

  const inputStyle = {
    background: "#1a1a2e", border: "1px solid #2a2a3e", borderRadius: 6, padding: "8px 12px",
    color: "#e0e0e8", fontFamily: "inherit", fontSize: 14, outline: "none", width: "100%",
    boxSizing: "border-box",
  };

  const btnStyle = (active) => ({
    padding: "6px 14px", borderRadius: 6, border: active ? "1px solid #6366f1" : "1px solid #2a2a3e",
    background: active ? "#6366f120" : "#1a1a2e", color: active ? "#818cf8" : "#71717a",
    cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 500, transition: "all 0.15s",
  });

  if (gameState === "playing") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 60 }}>
        <div style={{ display: "flex", gap: 32, marginBottom: 40, fontSize: 14, color: "#71717a" }}>
          <span>Time: <span style={{ color: timeLeft <= 10 ? "#ef4444" : "#e0e0e8", fontWeight: 600 }}>{timeLeft}s</span></span>
          {config.perQuestionLimit > 0 && (
            <span>Q Time: <span style={{ color: questionTimeLeft <= 3 ? "#ef4444" : "#e0e0e8", fontWeight: 600 }}>{questionTimeLeft}s</span></span>
          )}
          <span>Answered: <span style={{ color: "#e0e0e8", fontWeight: 600 }}>{results.length}</span></span>
          <span>Correct: <span style={{ color: "#22c55e", fontWeight: 600 }}>{results.filter(r => r.correct).length}</span></span>
        </div>
        <div style={{ fontSize: 48, fontWeight: 700, color: "#f0f0f5", marginBottom: 32, fontFamily: "'Space Grotesk', sans-serif" }}>
          {currentQ?.text}
        </div>
        <div style={{ width: 200 }}>
          <input
            ref={inputRef}
            type="number"
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }}
            style={{ ...inputStyle, fontSize: 24, textAlign: "center", padding: "12px" }}
            autoFocus
          />
        </div>
        <button onClick={endGame} style={{ ...btnStyle(false), marginTop: 40, color: "#ef4444", borderColor: "#ef444444" }}>
          End Game
        </button>
      </div>
    );
  }

  if (gameState === "results") {
    const last = scores[0];
    return (
      <div>
        <div style={{ textAlign: "center", marginBottom: 40, paddingTop: 20 }}>
          <h2 style={{ fontFamily: "'Space Grotesk'", fontSize: 28, color: "#f0f0f5", marginBottom: 8 }}>Results</h2>
          <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap", marginTop: 16 }}>
            {[
              { label: "Questions", val: last?.totalQuestions },
              { label: "Correct", val: last?.correct },
              { label: "Accuracy", val: `${last?.accuracy}%` },
              { label: "QPM", val: last?.qpm },
              { label: "Time", val: `${last?.elapsed}s` },
            ].map(({ label, val }) => (
              <div key={label} style={{ background: "#1a1a2e", borderRadius: 8, padding: "16px 24px", minWidth: 90, border: "1px solid #2a2a3e" }}>
                <div style={{ fontSize: 11, color: "#71717a", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: "#e0e0e8" }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 14, color: "#71717a", marginBottom: 12 }}>Question Review</h3>
            <div style={{ maxHeight: 200, overflowY: "auto", textAlign: "left", maxWidth: 500, margin: "0 auto" }}>
              {results.map((r, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", fontSize: 13, borderBottom: "1px solid #1e1e2e", color: r.correct ? "#22c55e" : "#ef4444" }}>
                  <span>{r.text} = {r.answer}</span>
                  <span>{r.correct ? "✓" : `✗ (${r.userAnswer})`} {r.time.toFixed(1)}s</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <button onClick={() => setGameState("config")} style={{ ...btnStyle(true), display: "block", margin: "0 auto", padding: "10px 28px", fontSize: 14 }}>
          Back to Config
        </button>
        <div style={{ marginTop: 48 }}>
          <Scoreboard scores={scores} filteredScores={filteredScores} sortField={sortField} setSortField={setSortField}
            sortDir={sortDir} setSortDir={setSortDir} filterMode={filterMode} setFilterMode={setFilterMode}
            showChart={showChart} setShowChart={setShowChart} />
        </div>
      </div>
    );
  }

  // CONFIG
  return (
    <div>
      <div style={{ maxWidth: 560, margin: "0 auto", paddingTop: 20 }}>
        <h2 style={{ fontFamily: "'Space Grotesk'", fontSize: 24, color: "#f0f0f5", marginBottom: 24 }}>Mental Math</h2>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: "#71717a", display: "block", marginBottom: 6 }}>Modes</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["addition", "subtraction", "multiplication", "division"].map(m => (
              <button key={m} onClick={() => {
                setConfig(prev => ({
                  ...prev,
                  modes: prev.modes.includes(m) ? prev.modes.filter(x => x !== m) : [...prev.modes, m]
                }));
              }} style={btnStyle(config.modes.includes(m))}>
                {m}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div>
            <label style={{ fontSize: 12, color: "#71717a", display: "block", marginBottom: 6 }}>Total Time (s)</label>
            <input type="number" value={config.totalTime} onChange={e => setConfig(prev => ({ ...prev, totalTime: parseInt(e.target.value) || 60 }))}
              style={inputStyle} min={10} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#71717a", display: "block", marginBottom: 6 }}>Max Number</label>
            <input type="number" value={config.maxNumber} onChange={e => setConfig(prev => ({ ...prev, maxNumber: parseInt(e.target.value) || 12 }))}
              style={inputStyle} min={2} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#71717a", display: "block", marginBottom: 6 }}>Per-Q Limit (s)</label>
            <input type="number" value={config.perQuestionLimit} onChange={e => setConfig(prev => ({ ...prev, perQuestionLimit: parseInt(e.target.value) || 0 }))}
              style={inputStyle} min={0} />
            <div style={{ fontSize: 10, color: "#52525b", marginTop: 4 }}>0 = no limit</div>
          </div>
        </div>

        {config.perQuestionLimit > 0 && config.totalTime % config.perQuestionLimit !== 0 && (
          <div style={{ fontSize: 12, color: "#f59e0b", marginBottom: 12, padding: "8px 12px", background: "#f59e0b10", borderRadius: 6, border: "1px solid #f59e0b30" }}>
            Per-question limit should divide total time evenly.
          </div>
        )}

        <button onClick={startGame} disabled={config.modes.length === 0} style={{
          ...btnStyle(true), width: "100%", padding: "12px", fontSize: 16, fontWeight: 600,
          opacity: config.modes.length === 0 ? 0.4 : 1,
          background: "#6366f1", color: "#fff", borderColor: "#6366f1",
        }}>
          Start
        </button>
      </div>

      <div style={{ marginTop: 48 }}>
        <Scoreboard scores={scores} filteredScores={filteredScores} sortField={sortField} setSortField={setSortField}
          sortDir={sortDir} setSortDir={setSortDir} filterMode={filterMode} setFilterMode={setFilterMode}
          showChart={showChart} setShowChart={setShowChart} />
      </div>
    </div>
  );
}

// ─── SCOREBOARD ───
function Scoreboard({ scores, filteredScores, sortField, setSortField, sortDir, setSortDir, filterMode, setFilterMode, showChart, setShowChart }) {
  const chartRef = useRef(null);

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const columns = [
    { key: "date", label: "Date", render: v => new Date(v).toLocaleDateString() },
    { key: "modes", label: "Mode" },
    { key: "maxNumber", label: "Range" },
    { key: "totalQuestions", label: "Qs" },
    { key: "correct", label: "Correct" },
    { key: "accuracy", label: "Acc%", render: v => `${v}%` },
    { key: "qpm", label: "QPM" },
    { key: "elapsed", label: "Time", render: v => `${v}s` },
  ];

  const thStyle = (key) => ({
    padding: "8px 10px", textAlign: "left", fontSize: 11, color: sortField === key ? "#818cf8" : "#52525b",
    cursor: "pointer", fontWeight: 600, borderBottom: "1px solid #1e1e2e", userSelect: "none",
    whiteSpace: "nowrap", letterSpacing: "0.5px",
  });

  // Chart
  useEffect(() => {
    if (!showChart || !chartRef.current || filteredScores.length < 2) return;
    const el = chartRef.current;
    el.innerHTML = "";
    const margin = { top: 20, right: 20, bottom: 40, left: 50 };
    const width = el.clientWidth - margin.left - margin.right;
    const height = 220 - margin.top - margin.bottom;

    const svg = d3.select(el).append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const data = [...filteredScores].reverse().map((d, i) => ({ ...d, idx: i }));
    const x = d3.scaleLinear().domain([0, data.length - 1]).range([0, width]);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.qpm) * 1.1]).range([height, 0]);

    svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).ticks(Math.min(data.length, 8)).tickFormat(i => "")).selectAll("text,line,path").attr("stroke", "#333");
    svg.append("g").call(d3.axisLeft(y).ticks(5)).selectAll("text").attr("fill", "#666").attr("font-size", 10);
    svg.selectAll(".domain, .tick line").attr("stroke", "#2a2a3e");

    const line = d3.line().x(d => x(d.idx)).y(d => y(d.qpm)).curve(d3.curveMonotoneX);
    svg.append("path").datum(data).attr("fill", "none").attr("stroke", "#6366f1").attr("stroke-width", 2).attr("d", line);
    svg.selectAll("circle").data(data).join("circle").attr("cx", d => x(d.idx)).attr("cy", d => y(d.qpm)).attr("r", 3).attr("fill", "#6366f1");

    svg.append("text").attr("x", width / 2).attr("y", height + 35).attr("text-anchor", "middle").attr("fill", "#52525b").attr("font-size", 11).text("Game #");
    svg.append("text").attr("transform", "rotate(-90)").attr("x", -height / 2).attr("y", -38).attr("text-anchor", "middle").attr("fill", "#52525b").attr("font-size", 11).text("QPM");
  }, [showChart, filteredScores]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ fontFamily: "'Space Grotesk'", fontSize: 18, color: "#f0f0f5", margin: 0 }}>Scoreboard</h3>
        <div style={{ display: "flex", gap: 6 }}>
          <select value={filterMode} onChange={e => setFilterMode(e.target.value)} style={{
            background: "#1a1a2e", border: "1px solid #2a2a3e", borderRadius: 6, padding: "4px 10px",
            color: "#d4d4d8", fontFamily: "inherit", fontSize: 12
          }}>
            <option value="all">All modes</option>
            {["addition", "subtraction", "multiplication", "division"].map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <button onClick={() => setShowChart(!showChart)} style={{
            padding: "4px 12px", borderRadius: 6, border: "1px solid #2a2a3e", background: showChart ? "#6366f120" : "#1a1a2e",
            color: showChart ? "#818cf8" : "#71717a", cursor: "pointer", fontFamily: "inherit", fontSize: 12
          }}>
            {showChart ? "Hide Chart" : "Chart"}
          </button>
        </div>
      </div>

      {showChart && <div ref={chartRef} style={{ background: "#0d0d14", borderRadius: 8, border: "1px solid #1e1e2e", padding: "12px", marginBottom: 16, minHeight: 220 }} />}

      {filteredScores.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "#52525b", fontSize: 13, background: "#0d0d14", borderRadius: 8, border: "1px solid #1e1e2e" }}>No scores yet. Play a game!</div>
      ) : (
        <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid #1e1e2e" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#0d0d14" }}>
                {columns.map(c => (
                  <th key={c.key} onClick={() => handleSort(c.key)} style={thStyle(c.key)}>
                    {c.label} {sortField === c.key ? (sortDir === "asc" ? "↑" : "↓") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredScores.slice(0, 50).map((s, i) => (
                <tr key={s.id || i} style={{ background: i % 2 === 0 ? "#0a0a0f" : "#0d0d14" }}>
                  {columns.map(c => (
                    <td key={c.key} style={{ padding: "6px 10px", borderBottom: "1px solid #1a1a2e", color: c.key === "qpm" ? "#818cf8" : "#a1a1aa" }}>
                      {c.render ? c.render(s[c.key]) : s[c.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── HARD PROBLEMS TAB ───
function HardProblemsTab({ problemState, saveProblemState, timeTracking, saveTimeTracking }) {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedProblem, setSelectedProblem] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [userAnswer, setUserAnswer] = useState("");
  const [showTimeLog, setShowTimeLog] = useState(false);
  const [timerActive, setTimerActive] = useState(false);
  const timerIntervalRef = useRef(null);
  const sessionStartRef = useRef(null);
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const chartRef = useRef(null);

  const categories = Object.keys(PROBLEM_BANK);

  function getStatus(id) {
    return problemState[id] || "untouched"; // untouched | attempted | solved
  }

  function markAttempted(id) {
    if (getStatus(id) === "untouched") {
      saveProblemState({ ...problemState, [id]: "attempted" });
    }
  }

  function markSolved(id) {
    saveProblemState({ ...problemState, [id]: "solved" });
  }

  function startTimer(id) {
    markAttempted(id);
    sessionStartRef.current = Date.now();
    setSessionElapsed(0);
    setTimerActive(true);
    timerIntervalRef.current = setInterval(() => {
      setSessionElapsed(Math.floor((Date.now() - sessionStartRef.current) / 1000));
    }, 1000);
  }

  function stopTimer(id) {
    clearInterval(timerIntervalRef.current);
    setTimerActive(false);
    if (sessionStartRef.current) {
      const elapsed = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      const today = new Date().toISOString().slice(0, 10);
      const existing = timeTracking[id] || {};
      existing[today] = (existing[today] || 0) + elapsed;
      saveTimeTracking({ ...timeTracking, [id]: existing });
      sessionStartRef.current = null;
    }
  }

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  }

  // Stacked area chart
  useEffect(() => {
    if (!chartRef.current) return;
    const el = chartRef.current;
    el.innerHTML = "";

    // Build daily data from timeTracking
    const dayData = {};
    for (const [pid, days] of Object.entries(timeTracking)) {
      const cat = categories.find(c => PROBLEM_BANK[c].some(p => p.id === pid));
      if (!cat) continue;
      for (const [day, secs] of Object.entries(days)) {
        if (!dayData[day]) dayData[day] = {};
        dayData[day][cat] = (dayData[day][cat] || 0) + 1;
      }
    }

    // Also count from problemState as attempts per day (approximate with today if no time data)
    const today = new Date().toISOString().slice(0, 10);
    for (const [pid, status] of Object.entries(problemState)) {
      const cat = categories.find(c => PROBLEM_BANK[c].some(p => p.id === pid));
      if (!cat) continue;
      if (!timeTracking[pid]) {
        if (!dayData[today]) dayData[today] = {};
        dayData[today][cat] = (dayData[today][cat] || 0) + 1;
      }
    }

    const sortedDays = Object.keys(dayData).sort();
    if (sortedDays.length === 0) {
      d3.select(el).append("div").style("padding", "40px").style("text-align", "center").style("color", "#52525b").style("font-size", "13px").text("Start solving problems to see your progress chart.");
      return;
    }

    const margin = { top: 20, right: 120, bottom: 40, left: 50 };
    const width = el.clientWidth - margin.left - margin.right;
    const height = 260 - margin.top - margin.bottom;

    const svg = d3.select(el).append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const series = categories.map(cat => sortedDays.map(day => dayData[day]?.[cat] || 0));
    const stackData = sortedDays.map((day, i) => {
      const obj = { day };
      categories.forEach((cat, ci) => { obj[cat] = series[ci][i]; });
      return obj;
    });

    const stack = d3.stack().keys(categories);
    const stacked = stack(stackData);

    const x = d3.scalePoint().domain(sortedDays).range([0, width]).padding(0.5);
    const yMax = d3.max(stacked, s => d3.max(s, d => d[1])) || 5;
    const y = d3.scaleLinear().domain([0, yMax]).range([height, 0]);

    const area = d3.area()
      .x((d, i) => x(sortedDays[i]))
      .y0(d => y(d[0]))
      .y1(d => y(d[1]))
      .curve(d3.curveBasis);

    stacked.forEach((layer, i) => {
      const cat = categories[i];
      const colors = CATEGORY_COLORS[cat] || { dark: "#555", light: "#888" };
      svg.append("path").datum(layer).attr("d", area).attr("fill", colors.dark).attr("opacity", 0.85);
    });

    svg.append("g").attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).tickFormat(d => d.slice(5))).selectAll("text").attr("fill", "#666").attr("font-size", 10).attr("transform", "rotate(-30)").attr("text-anchor", "end");
    svg.selectAll(".domain, .tick line").attr("stroke", "#2a2a3e");
    svg.append("g").call(d3.axisLeft(y).ticks(5)).selectAll("text").attr("fill", "#666").attr("font-size", 10);

    // Legend
    const legend = svg.append("g").attr("transform", `translate(${width + 12}, 0)`);
    categories.forEach((cat, i) => {
      const g = legend.append("g").attr("transform", `translate(0, ${i * 18})`);
      g.append("rect").attr("width", 12).attr("height", 12).attr("rx", 2).attr("fill", CATEGORY_COLORS[cat]?.dark || "#555");
      g.append("text").attr("x", 16).attr("y", 10).attr("fill", "#888").attr("font-size", 10).text(cat.slice(0, 8));
    });

    svg.append("text").attr("x", width / 2).attr("y", height + 38).attr("text-anchor", "middle").attr("fill", "#52525b").attr("font-size", 11).text("Date");
    svg.append("text").attr("transform", "rotate(-90)").attr("x", -height / 2).attr("y", -38).attr("text-anchor", "middle").attr("fill", "#52525b").attr("font-size", 11).text("Problems Attempted");
  }, [problemState, timeTracking]);

  // Problem view
  if (selectedProblem) {
    const prob = selectedProblem;
    const status = getStatus(prob.id);
    const timeLog = timeTracking[prob.id] || {};
    const statusColor = status === "solved" ? "#22c55e" : status === "attempted" ? "#eab308" : "#52525b";

    return (
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <button onClick={() => { stopTimer(prob.id); setSelectedProblem(null); setShowHint(false); setShowAnswer(false); setUserAnswer(""); }}
          style={{ background: "none", border: "none", color: "#6366f1", cursor: "pointer", fontFamily: "inherit", fontSize: 13, marginBottom: 16, padding: 0 }}>
          ← Back
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: statusColor, display: "inline-block" }} />
          <h2 style={{ fontFamily: "'Space Grotesk'", fontSize: 22, color: "#f0f0f5", margin: 0 }}>{prob.title}</h2>
        </div>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: "#a1a1aa", marginBottom: 24 }}>{prob.desc}</p>

        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          <button onClick={() => setShowHint(!showHint)} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #eab30830", background: showHint ? "#eab30815" : "transparent", color: "#eab308", cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>
            {showHint ? "Hide Hint" : "Show Hint"}
          </button>
          <button onClick={() => setShowAnswer(!showAnswer)} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #22c55e30", background: showAnswer ? "#22c55e15" : "transparent", color: "#22c55e", cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>
            {showAnswer ? "Hide Answer" : "Show Answer"}
          </button>
          {!timerActive ? (
            <button onClick={() => startTimer(prob.id)} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #6366f130", background: "transparent", color: "#818cf8", cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>
              Start Timer
            </button>
          ) : (
            <button onClick={() => stopTimer(prob.id)} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #ef444430", background: "#ef444415", color: "#ef4444", cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>
              Stop Timer ({formatTime(sessionElapsed)})
            </button>
          )}
          {status !== "solved" && (
            <button onClick={() => markSolved(prob.id)} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #22c55e30", background: "#22c55e15", color: "#22c55e", cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>
              Mark Solved ✓
            </button>
          )}
        </div>

        {showHint && (
          <div style={{ background: "#eab30808", border: "1px solid #eab30825", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#eab308" }}>
            {prob.hint}
          </div>
        )}
        {showAnswer && (
          <div style={{ background: "#22c55e08", border: "1px solid #22c55e25", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#22c55e" }}>
            {prob.answer}
          </div>
        )}

        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 12, color: "#71717a", display: "block", marginBottom: 6 }}>Your Work / Notes</label>
          <textarea value={userAnswer} onChange={e => setUserAnswer(e.target.value)} rows={4} style={{
            background: "#1a1a2e", border: "1px solid #2a2a3e", borderRadius: 6, padding: "10px 14px",
            color: "#e0e0e8", fontFamily: "inherit", fontSize: 13, width: "100%", boxSizing: "border-box", resize: "vertical"
          }} placeholder="Work through the problem here..." />
        </div>

        <button onClick={() => setShowTimeLog(!showTimeLog)} style={{ background: "none", border: "none", color: "#71717a", cursor: "pointer", fontFamily: "inherit", fontSize: 12, padding: 0, marginBottom: 8 }}>
          {showTimeLog ? "▾ Hide Time Log" : "▸ Time Log"}
        </button>
        {showTimeLog && (
          <div style={{ background: "#0d0d14", borderRadius: 8, border: "1px solid #1e1e2e", padding: 12, fontSize: 12 }}>
            {Object.keys(timeLog).length === 0 ? (
              <span style={{ color: "#52525b" }}>No time tracked yet.</span>
            ) : (
              Object.entries(timeLog).sort((a, b) => b[0].localeCompare(a[0])).map(([day, secs]) => (
                <div key={day} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #1a1a2e", color: "#a1a1aa" }}>
                  <span>{day}</span>
                  <span>{formatTime(secs)}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  // Category view
  if (selectedCategory) {
    const problems = PROBLEM_BANK[selectedCategory];
    const colors = CATEGORY_COLORS[selectedCategory];
    return (
      <div>
        <button onClick={() => setSelectedCategory(null)} style={{ background: "none", border: "none", color: "#6366f1", cursor: "pointer", fontFamily: "inherit", fontSize: 13, marginBottom: 16, padding: 0 }}>
          ← Back
        </button>
        <h2 style={{ fontFamily: "'Space Grotesk'", fontSize: 22, color: "#f0f0f5", marginBottom: 20, textTransform: "capitalize" }}>{selectedCategory}</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {problems.map(p => {
            const status = getStatus(p.id);
            const statusColor = status === "solved" ? "#22c55e" : status === "attempted" ? "#eab308" : "#2a2a3e";
            return (
              <button key={p.id} onClick={() => { setSelectedProblem(p); setShowHint(false); setShowAnswer(false); setUserAnswer(""); }}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 8,
                  border: `1px solid ${statusColor}40`, background: "#0d0d14", cursor: "pointer",
                  fontFamily: "inherit", fontSize: 14, color: "#d4d4d8", textAlign: "left", transition: "all 0.15s"
                }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{p.title}</span>
                <span style={{ fontSize: 11, color: "#52525b" }}>
                  {status === "solved" ? "✓ Solved" : status === "attempted" ? "In Progress" : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Category overview + chart
  return (
    <div>
      <h2 style={{ fontFamily: "'Space Grotesk'", fontSize: 24, color: "#f0f0f5", marginBottom: 8 }}>Problem Bank</h2>
      <p style={{ fontSize: 13, color: "#71717a", marginBottom: 24 }}>Classic quant interview problems organized by category. Track your progress as you work through them.</p>

      <div ref={chartRef} style={{ background: "#0d0d14", borderRadius: 8, border: "1px solid #1e1e2e", padding: "12px", marginBottom: 32, minHeight: 260 }} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
        {categories.map(cat => {
          const problems = PROBLEM_BANK[cat];
          const solved = problems.filter(p => getStatus(p.id) === "solved").length;
          const attempted = problems.filter(p => getStatus(p.id) === "attempted").length;
          const colors = CATEGORY_COLORS[cat];
          return (
            <button key={cat} onClick={() => setSelectedCategory(cat)} style={{
              padding: "20px", borderRadius: 10, border: `1px solid ${colors.dark}40`,
              background: `linear-gradient(135deg, ${colors.dark}15, ${colors.dark}05)`,
              cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "all 0.2s",
            }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#e0e0e8", marginBottom: 8, textTransform: "capitalize" }}>{cat.replace("_", " ")}</div>
              <div style={{ fontSize: 12, color: "#71717a", marginBottom: 12 }}>{problems.length} problems</div>
              <div style={{ display: "flex", gap: 4, height: 4, borderRadius: 2, overflow: "hidden", background: "#1e1e2e" }}>
                <div style={{ width: `${(solved / problems.length) * 100}%`, background: "#22c55e", borderRadius: 2, transition: "width 0.3s" }} />
                <div style={{ width: `${(attempted / problems.length) * 100}%`, background: "#eab308", borderRadius: 2, transition: "width 0.3s" }} />
              </div>
              <div style={{ fontSize: 11, color: "#52525b", marginTop: 8 }}>
                {solved} solved · {attempted} in progress
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── RESOURCES TAB ───
function ResourcesTab() {
  const sections = [
    {
      title: "Practice Platforms",
      items: [
        { name: "LeetCode", url: "https://leetcode.com", desc: "Coding problems — focus on Math, Dynamic Programming, and Greedy sections for quant prep" },
        { name: "Project Euler", url: "https://projecteuler.net", desc: "Math + programming challenges. Good for building computational thinking." },
        { name: "Brilliant.org", url: "https://brilliant.org", desc: "Interactive math and probability courses" },
        { name: "HackerRank Math", url: "https://hackerrank.com/domains/mathematics", desc: "Math-specific programming challenges" },
      ]
    },
    {
      title: "Quant Interview Resources",
      items: [
        { name: "Heard on the Street", url: "https://www.amazon.com/Heard-Street-Quantitative-Questions-Interviews/dp/0994103867", desc: "Timothy Crack's classic quant interview guide" },
        { name: "Green Book (50 Challenging Problems)", url: "https://www.amazon.com/Fifty-Challenging-Problems-Probability-Solutions/dp/0486653552", desc: "Mosteller's probability problem set — compact and sharp" },
        { name: "Brainstellar", url: "https://brainstellar.com", desc: "Curated quant puzzles sorted by difficulty" },
        { name: "Cut the Knot", url: "https://www.cut-the-knot.org/probability.shtml", desc: "Deep probability problem archive with solutions" },
      ]
    },
    {
      title: "LeetCode Problem Recs (Quant-Relevant)",
      desc: "These build the pattern-recognition and optimization skills quant firms test:",
      items: [
        { name: "#70 Climbing Stairs", url: "https://leetcode.com/problems/climbing-stairs/", desc: "Dynamic programming fundamental" },
        { name: "#322 Coin Change", url: "https://leetcode.com/problems/coin-change/", desc: "Classic DP optimization" },
        { name: "#62 Unique Paths", url: "https://leetcode.com/problems/unique-paths/", desc: "Combinatorics via DP" },
        { name: "#53 Maximum Subarray", url: "https://leetcode.com/problems/maximum-subarray/", desc: "Kadane's algorithm — shows up in trading contexts" },
        { name: "#121 Best Time to Buy/Sell Stock", url: "https://leetcode.com/problems/best-time-to-buy-and-sell-stock/", desc: "Directly relevant to trading logic" },
        { name: "#238 Product of Array Except Self", url: "https://leetcode.com/problems/product-of-array-except-self/", desc: "Efficient computation patterns" },
        { name: "#146 LRU Cache", url: "https://leetcode.com/problems/lru-cache/", desc: "Data structure design — systems interviews" },
        { name: "#295 Find Median from Data Stream", url: "https://leetcode.com/problems/find-median-from-data-stream/", desc: "Heap usage — streaming statistics" },
      ]
    },
    {
      title: "Math Refreshers",
      items: [
        { name: "3Blue1Brown", url: "https://www.youtube.com/c/3blue1brown", desc: "Linear algebra and calculus visualized" },
        { name: "MIT OCW Probability", url: "https://ocw.mit.edu/courses/6-041-probabilistic-systems-analysis-and-applied-probability-fall-2010/", desc: "Full probability course with problem sets" },
        { name: "Khan Academy Statistics", url: "https://www.khanacademy.org/math/statistics-probability", desc: "Solid fundamentals review" },
      ]
    },
    {
      title: "Suggested Additional Tabs",
      desc: "Ideas for expanding this prep tool:",
      items: [
        { name: "Market Intuition Trainer", desc: "Quick estimation games: 'Is X > Y?' for market caps, populations, rates. Builds the fast numerical intuition firms test." },
        { name: "Probability Simulator", desc: "Interactive Monte Carlo sims for classic problems. Run 10k trials of Monty Hall, birthday problem, etc. to build intuition." },
        { name: "Speed Reading / Pattern Recognition", desc: "Flash sequences of numbers, ask to identify patterns or compute running stats. Tests working memory under pressure." },
        { name: "Mock Interview Timer", desc: "45-minute structured sessions: 15 min mental math, 15 min brainteasers, 15 min probability. Simulates interview pacing." },
      ]
    },
  ];

  return (
    <div>
      <h2 style={{ fontFamily: "'Space Grotesk'", fontSize: 24, color: "#f0f0f5", marginBottom: 8 }}>Resources & Recommendations</h2>
      <p style={{ fontSize: 13, color: "#71717a", marginBottom: 32 }}>Curated links and tools for quant interview preparation.</p>

      {sections.map((section, si) => (
        <div key={si} style={{ marginBottom: 32 }}>
          <h3 style={{ fontFamily: "'Space Grotesk'", fontSize: 17, color: "#e0e0e8", marginBottom: 4 }}>{section.title}</h3>
          {section.desc && <p style={{ fontSize: 12, color: "#52525b", marginBottom: 12 }}>{section.desc}</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {section.items.map((item, ii) => (
              <div key={ii} style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "10px 14px", borderRadius: 8, border: "1px solid #1e1e2e", background: "#0d0d14" }}>
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: "#818cf8", fontSize: 14, fontWeight: 500, textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0 }}>
                    {item.name} ↗
                  </a>
                ) : (
                  <span style={{ color: "#e0e0e8", fontSize: 14, fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0 }}>{item.name}</span>
                )}
                <span style={{ fontSize: 12, color: "#71717a" }}>{item.desc}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
