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

// ─── LEARN MODULES ───
const LEARN_MODULES = [
  {
    id: "python-essentials",
    title: "Python Essentials",
    subtitle: "Comprehensions, generators, decorators, and the standard library",
    difficulty: "Intermediate",
    category: "Python",
    sections: [
      {
        title: "List Comprehensions & Generator Expressions",
        content: "List comprehensions build lists concisely and are typically faster than equivalent for-loops. Generator expressions use () instead of [] and are lazy — they produce values on demand without storing the full list in memory.",
        code: `# List comprehension
squares = [x**2 for x in range(10)]
# [0, 1, 4, 9, 16, 25, 36, 49, 64, 81]

# With filtering
evens = [x for x in range(20) if x % 2 == 0]

# Flatten a 2D matrix
matrix = [[1,2,3],[4,5,6],[7,8,9]]
flat = [val for row in matrix for val in row]

# Dict and set comprehensions
word_lens = {w: len(w) for w in ["alpha","beta","gamma"]}
unique_mods = {x % 3 for x in range(15)}  # {0, 1, 2}

# Generator expression — lazy, no list built in memory
total = sum(x**2 for x in range(10**7))  # uses ~constant memory`,
        note: "Use generator expressions when you only iterate once over large data. Use list comprehensions when you need random access or multiple passes."
      },
      {
        title: "Generators & yield",
        content: "A generator function uses yield to produce values one at a time. This enables infinite sequences and memory-efficient pipelines.",
        code: `def fibonacci():
    a, b = 0, 1
    while True:
        yield a
        a, b = b, a + b

gen = fibonacci()
first_10 = [next(gen) for _ in range(10)]
# [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]

# yield from — delegate to a sub-generator
def chain(*iterables):
    for it in iterables:
        yield from it

list(chain([1,2],[3,4],[5]))  # [1, 2, 3, 4, 5]

# Walrus operator (:=) in Python 3.8+
import re
if m := re.search(r'\\d+', 'abc123'):
    print(m.group())  # '123'`,
        note: "For LeetCode, generators appear less directly — but itertools (built on generators) is invaluable: islice, groupby, product, combinations, permutations."
      },
      {
        title: "Decorators & lru_cache",
        content: "A decorator wraps a function to add behavior. @functools.lru_cache is the most important decorator for competitive programming — it adds memoization to any function.",
        code: `from functools import lru_cache, cache

# @cache is @lru_cache(maxsize=None) — Python 3.9+
@cache
def fib(n):
    if n < 2: return n
    return fib(n-1) + fib(n-2)

fib(100)  # instant — O(n) with memoization vs O(2^n) without

# Custom decorator — timer
import time
def timer(func):
    def wrapper(*args, **kwargs):
        t = time.perf_counter()
        result = func(*args, **kwargs)
        print(f"{func.__name__}: {time.perf_counter()-t:.4f}s")
        return result
    return wrapper

@timer
def slow(n): return sum(range(n))

# Closure — function capturing outer scope
def make_adder(n):
    def add(x): return x + n  # captures n
    return add

add5 = make_adder(5)
add5(3)  # 8`,
        note: "@cache is your go-to for recursive DP. One caveat: it keeps all results in memory forever. Call fib.cache_clear() if memory is a concern."
      },
      {
        title: "Collections & itertools",
        content: "The collections and itertools modules are essential for algorithmic problems. Learn these by heart.",
        code: `from collections import defaultdict, Counter, deque
from itertools import accumulate, combinations, permutations

# defaultdict — auto-creates missing keys
graph = defaultdict(list)
graph[0].append(1)  # no KeyError

# Counter — frequency map with arithmetic
freq = Counter("mississippi")
# Counter({'s':4,'i':4,'p':2,'m':1})
freq.most_common(2)   # [('s',4),('i',4)]

# deque — O(1) at both ends (list.insert(0,...) is O(n))
dq = deque([1,2,3])
dq.appendleft(0)   # [0,1,2,3]
dq.popleft()       # 0, O(1)

# accumulate — prefix sums in one line
from itertools import accumulate
prefix = list(accumulate([1,2,3,4,5]))
# [1, 3, 6, 10, 15]

# combinations / permutations
list(combinations([1,2,3], 2))
# [(1,2),(1,3),(2,3)]
list(permutations([1,2,3], 2))
# [(1,2),(1,3),(2,1),(2,3),(3,1),(3,2)]`,
        note: "For sliding window problems, deque is indispensable for maintaining a monotonic window in O(n). Counter subtraction (a - b) removes zero/negative counts automatically."
      },
      {
        title: "Sorting & bisect",
        content: "Python's sort is Timsort — O(n log n) worst case, O(n) on nearly sorted data. bisect provides binary search insertion points on sorted lists.",
        code: `import bisect

arr = [1, 3, 5, 7, 9]
bisect.bisect_left(arr, 5)    # 2 — leftmost index for 5
bisect.bisect_right(arr, 5)   # 3 — rightmost index + 1
bisect.insort(arr, 6)         # insert 6, maintaining order

# Count occurrences in sorted array
lo = bisect.bisect_left(arr, 5)
hi = bisect.bisect_right(arr, 5)
count = hi - lo  # O(log n)

# Sort with key function
intervals = [(1,5),(2,3),(1,2)]
intervals.sort(key=lambda x: (x[0], x[1]))

# Custom comparator with cmp_to_key (e.g. Largest Number problem)
from functools import cmp_to_key
def cmp(a, b):
    return -1 if str(a)+str(b) > str(b)+str(a) else 1
nums = [3, 30, 34, 5, 9]
nums.sort(key=cmp_to_key(cmp))  # [9,5,34,3,30] → "9534330"`,
        note: "bisect_left and bisect_right are your binary search primitives. Many 'search in sorted array' problems become 2-liners with bisect."
      }
    ],
    questions: [
      { type:"mc", q:"What does [x**2 for x in range(5) if x%2==0] evaluate to?", options:["[0,4,16]","[1,9,25]","[0,2,4]","[0,1,4,9,16]"], correct:0, explanation:"range(5) gives 0,1,2,3,4. Filter x%2==0 keeps 0,2,4. Squaring gives [0,4,16]." },
      { type:"mc", q:"Key difference between [x for x in gen()] and (x for x in gen())?", options:["Generator expressions are always faster","List comprehensions are eager (build in memory); generators are lazy","Generator expressions can only be used once","They are identical"], correct:1, explanation:"List comprehensions materialize the full list immediately. Generator expressions yield values lazily — only computing each when consumed." },
      { type:"mc", q:"What does Counter('aabbbc').most_common(1) return?", options:["[('a',2)]","[('b',3)]","{'b':3}","('b',3)"], correct:1, explanation:"Counter counts: a:2, b:3, c:1. most_common(1) returns a list with the single most frequent element as a (element, count) pair." },
      { type:"mc", q:"Time complexity of bisect.bisect_left(arr, target) on a sorted list of length n?", options:["O(n)","O(log n)","O(1)","O(n log n)"], correct:1, explanation:"bisect uses binary search — O(log n). This is why keeping a sorted list + bisect is often preferred over linear scans." },
      { type:"mc", q:"Which decorator memoizes a recursive function's results automatically?", options:["@staticmethod","@property","@functools.cache","@classmethod"], correct:2, explanation:"@functools.cache (or @lru_cache) memoizes results, converting exponential recursion (like naive Fibonacci) to linear time." },
      { type:"mc", q:"What is deque.appendleft(x) time complexity vs list.insert(0, x)?", options:["Both O(1)","deque O(1), list O(n) due to shifting","deque O(n), list O(1)","Both O(n)"], correct:1, explanation:"deque is a doubly-linked structure with O(1) ops at both ends. list.insert(0,x) must shift all n elements right — O(n)." },
      { type:"mc", q:"list(accumulate([1,2,3,4])) returns?", options:["[1,3,6,10]","[1,2,6,24]","[10,9,7,4]","[0,1,3,6]"], correct:0, explanation:"accumulate computes running sums: 1, 1+2=3, 3+3=6, 6+4=10. This builds the prefix sum array in one line." },
      { type:"mc", q:"What does 'yield from iterable' do inside a generator function?", options:["Returns the entire iterable as one value","Yields each element from the sub-iterable one by one","Creates a nested generator","Equivalent to return iterable"], correct:1, explanation:"yield from iterable is equivalent to 'for item in iterable: yield item' — but more efficient and supports two-way communication." }
    ]
  },
  {
    id: "complexity",
    title: "Complexity & Big-O",
    subtitle: "Analyze algorithms and avoid TLE",
    difficulty: "Intermediate",
    category: "Algorithms",
    sections: [
      {
        title: "Big-O Notation",
        content: "Big-O describes the growth rate of an algorithm's time or space usage as input size n grows, ignoring constants and lower-order terms.",
        code: `# O(1) — constant
arr[0]

# O(log n) — binary search, halving each step
def binary_search(arr, t):
    lo, hi = 0, len(arr)-1
    while lo <= hi:
        mid = (lo+hi)//2
        if arr[mid] == t: return mid
        elif arr[mid] < t: lo = mid+1
        else: hi = mid-1
    return -1

# O(n) — single pass
max(arr)

# O(n log n) — sort
sorted(arr)

# O(n²) — nested loop
def has_dup_naive(arr):
    for i in range(len(arr)):
        for j in range(i+1, len(arr)):
            if arr[i] == arr[j]: return True
    return False

# O(n) solution — hash set
def has_dup(arr): return len(arr) != len(set(arr))

# O(2^n) — naive recursion (subset enumeration, naive fib)
# O(n!) — permutations`,
        note: "Order: O(1) < O(log n) < O(√n) < O(n) < O(n log n) < O(n²) < O(2ⁿ) < O(n!). For LeetCode, n=10⁵ tolerates O(n log n); n=10³ tolerates O(n²); n=20 tolerates O(2ⁿ)."
      },
      {
        title: "Amortized Analysis",
        content: "Some operations are occasionally expensive but cheap on average. The key insight: analyze the total cost over a sequence of operations, not just the worst single case.",
        code: `# Python list.append is O(1) amortized
# When the buffer is full, it doubles (O(n) copy), but this
# happens rarely — averaged over n appends, cost per append = O(1)

# Monotonic stack — looks O(n²) but is O(n) amortized
def next_greater(nums):
    n = len(nums)
    result = [-1] * n
    stack = []  # stores indices
    for i in range(n):
        # Each element enters/exits the stack at most ONCE total
        while stack and nums[stack[-1]] < nums[i]:
            result[stack.pop()] = nums[i]
        stack.append(i)
    return result
# Total push ops = n, total pop ops ≤ n → O(2n) = O(n)

# Two-pointer on sorted array — O(n) not O(n²)
def two_sum_sorted(arr, target):
    l, r = 0, len(arr)-1
    while l < r:   # l and r each move at most n times total
        s = arr[l] + arr[r]
        if s == target: return [l,r]
        elif s < target: l += 1
        else: r -= 1`,
        note: "When you see a while loop inside a for loop, don't assume O(n²). Ask: how many total times can the inner operation execute across ALL outer iterations? If ≤ n, it's O(n) amortized."
      },
      {
        title: "Space Complexity",
        content: "Space complexity counts extra memory beyond the input. Recursion depth counts — Python's default stack limit is ~1000.",
        code: `# O(1) space — only variables
def two_sum_two_pointer(arr, target):
    l, r = 0, len(arr)-1
    while l < r:
        s = arr[l]+arr[r]
        if s == target: return [l,r]
        elif s < target: l+=1
        else: r-=1

# O(n) space — hash map
def two_sum(nums, target):
    seen = {}
    for i, x in enumerate(nums):
        if target-x in seen: return [seen[target-x], i]
        seen[x] = i

# O(h) recursive stack — h = tree height
def dfs(node):
    if not node: return
    dfs(node.left)   # stack grows h deep
    dfs(node.right)

# O(1) stack space — iterative DFS
def dfs_iter(root):
    stack = [root]
    while stack:
        node = stack.pop()
        if node:
            stack.append(node.left)
            stack.append(node.right)`,
        note: "Converting recursion to iteration can prevent RecursionError on skewed trees (h=n). Python's sys.setrecursionlimit(300000) is a quick fix for contests, but iterative is always safer."
      },
      {
        title: "Recognizing Complexity from Code",
        content: "You should read code and immediately estimate complexity. These structural patterns map to complexities.",
        code: `# Pattern → Complexity
for i in range(n): ...                  # O(n)
while n > 1: n //= 2                    # O(log n)
for i in range(n):
    for j in range(i, n): ...           # O(n²)

# Recursion: T(n) = 2T(n/2) + O(n) → O(n log n)  [merge sort]
# Recursion: T(n) = T(n-1) + O(1)   → O(n)        [linear]
# Recursion: T(n) = 2T(n-1)         → O(2^n)       [naive fib]

# Master Theorem shortcut:
# T(n) = aT(n/b) + f(n)
# a=2,b=2,f(n)=O(n) → case 2 → O(n log n)

# TRAP: sorting inside a loop
for query in queries:
    arr.sort()  # O(n log n) × m queries = O(mn log n)
# FIX: sort once before, or use a heap for incremental updates

# TRAP: slicing in recursion
def bad(s):
    if len(s) <= 1: return s
    return bad(s[1:])  # s[1:] is O(n) copy each time → O(n²) total`,
        note: "The slicing trap is very common in Python — s[1:], arr[:mid], arr[mid+1:] all copy memory. Pass indices instead of slices in performance-critical code."
      }
    ],
    questions: [
      { type:"mc", q:"Time complexity of: for i in range(n):\\n  for j in range(i, n): pass", options:["O(n)","O(n log n)","O(n²)","O(n² / 2)"], correct:2, explanation:"Inner loop runs n-i times. Total = n+(n-1)+...+1 = n(n+1)/2 = O(n²). Constants are dropped." },
      { type:"mc", q:"Algorithm calls sort() once, then does one pass. Overall complexity?", options:["O(n)","O(n log n)","O(n²)","O(log n)"], correct:1, explanation:"sort() is O(n log n), single pass is O(n). Dominant term: O(n log n)." },
      { type:"mc", q:"Recursive Fibonacci without memoization has what complexity?", options:["O(n)","O(n log n)","O(2^n)","O(n²)"], correct:2, explanation:"Each call branches into 2 recursions. With depth n, the call tree has ~2^n nodes." },
      { type:"mc", q:"Why is list.append() O(1) amortized but occasionally O(n)?", options:["It sorts after each append","When buffer is full, it allocates ~2× space and copies all elements","Python checks duplicates on each append","Every 8th append triggers garbage collection"], correct:1, explanation:"Dynamic arrays occasionally need to resize. The O(n) copy is rare enough that the amortized cost per append is O(1)." },
      { type:"mc", q:"A monotonic stack processes n elements, each pushed and popped at most once. Total complexity?", options:["O(n²)","O(n log n)","O(n)","O(log n)"], correct:2, explanation:"Each element: 1 push + at most 1 pop = 2n total operations = O(n). Amortized analysis — the inner while doesn't add a factor of n." },
      { type:"mc", q:"Space complexity of DFS on a tree with n nodes, height h?", options:["O(n)","O(h)","O(log n)","O(1)"], correct:1, explanation:"The call stack depth equals the recursion depth = tree height h. Balanced: h=O(log n). Skewed: h=O(n)." },
      { type:"mc", q:"Python slice s[1:] on a string of length n has what complexity?", options:["O(1)","O(log n)","O(n)","O(n²)"], correct:2, explanation:"Slicing copies the underlying data. s[1:] creates a new string of length n-1 — O(n). Repeated slicing in recursion creates O(n²) total work." }
    ]
  },
  {
    id: "arrays-strings",
    title: "Arrays, Strings & Two Pointers",
    subtitle: "Sliding windows, prefix sums, and the two-pointer technique",
    difficulty: "Intermediate",
    category: "Algorithms",
    sections: [
      {
        title: "Two Pointer Technique",
        content: "Two pointers reduce O(n²) brute force to O(n) by moving pointers intelligently. Requires sorted input or a monotone property.",
        code: `# Two Sum II — sorted array
def two_sum_sorted(numbers, target):
    l, r = 0, len(numbers)-1
    while l < r:
        s = numbers[l] + numbers[r]
        if s == target: return [l+1, r+1]
        elif s < target: l += 1
        else: r -= 1

# Three Sum — fix i, two-pointer on rest
def three_sum(nums):
    nums.sort()
    result = []
    for i in range(len(nums)-2):
        if i > 0 and nums[i] == nums[i-1]: continue  # skip dup
        l, r = i+1, len(nums)-1
        while l < r:
            s = nums[i]+nums[l]+nums[r]
            if s == 0:
                result.append([nums[i],nums[l],nums[r]])
                while l<r and nums[l]==nums[l+1]: l+=1
                while l<r and nums[r]==nums[r-1]: r-=1
                l+=1; r-=1
            elif s < 0: l+=1
            else: r-=1
    return result

# Container With Most Water
def max_area(height):
    l, r = 0, len(height)-1
    best = 0
    while l < r:
        best = max(best, min(height[l],height[r])*(r-l))
        if height[l] < height[r]: l+=1
        else: r-=1
    return best`,
        note: "Two pointers always ask: 'if the current result is not what I want, which pointer should I move?' Move the pointer that can improve the result."
      },
      {
        title: "Sliding Window",
        content: "Sliding window maintains a contiguous subarray, expanding the right boundary and shrinking the left when a constraint is violated.",
        code: `# Fixed window — max sum of k consecutive elements
def max_sum_window(nums, k):
    window = sum(nums[:k])
    best = window
    for i in range(k, len(nums)):
        window += nums[i] - nums[i-k]  # add right, remove left
        best = max(best, window)
    return best

# Variable window — longest substring without repeating chars
def longest_no_repeat(s):
    seen = set()
    l = best = 0
    for r in range(len(s)):
        while s[r] in seen:
            seen.remove(s[l]); l+=1
        seen.add(s[r])
        best = max(best, r-l+1)
    return best

# Minimum window substring (hard)
from collections import Counter
def min_window(s, t):
    need = Counter(t)
    have, total = 0, len(need)
    window = {}; l = 0
    best = float('inf'), 0, 0
    for r, c in enumerate(s):
        window[c] = window.get(c,0)+1
        if c in need and window[c] == need[c]: have+=1
        while have == total:
            if r-l+1 < best[0]: best = r-l+1, l, r
            window[s[l]] -= 1
            if s[l] in need and window[s[l]] < need[s[l]]: have-=1
            l+=1
    return s[best[1]:best[2]+1] if best[0] < float('inf') else ""`,
        note: "The sliding window template: expand right always; shrink left until invalid. The inner while loop looks O(n²) but is O(n) amortized — each character enters and leaves the window at most once."
      },
      {
        title: "Prefix Sums",
        content: "Prefix sums precompute cumulative sums to answer range sum queries in O(1) after O(n) preprocessing.",
        code: `# Build prefix sum
def build_prefix(nums):
    prefix = [0] * (len(nums)+1)
    for i, x in enumerate(nums):
        prefix[i+1] = prefix[i] + x
    return prefix

# Range sum query: sum(nums[l..r]) inclusive
def range_sum(prefix, l, r):
    return prefix[r+1] - prefix[l]

# Subarray sum equals k — prefix + hash map
def subarray_sum(nums, k):
    count = prefix = 0
    seen = {0: 1}  # {prefix_sum: count}
    for x in nums:
        prefix += x
        count += seen.get(prefix-k, 0)
        seen[prefix] = seen.get(prefix,0)+1
    return count

# 2D prefix sum
def build_2d(mat):
    m, n = len(mat), len(mat[0])
    P = [[0]*(n+1) for _ in range(m+1)]
    for i in range(1,m+1):
        for j in range(1,n+1):
            P[i][j] = (mat[i-1][j-1]+P[i-1][j]
                      +P[i][j-1]-P[i-1][j-1])
    return P`,
        note: "The subarray sum = k pattern: prefix[j] - prefix[i] == k means prefix[i] == prefix[j]-k. We look up how many times we've seen prefix[j]-k. The seen={0:1} initialization handles subarrays starting at index 0."
      },
      {
        title: "Kadane's Algorithm",
        content: "Kadane's finds the maximum subarray sum in O(n). The key insight: at each position, either extend the previous subarray or start fresh.",
        code: `# Maximum subarray sum
def max_subarray(nums):
    curr = best = nums[0]
    for x in nums[1:]:
        curr = max(x, curr+x)  # start fresh or extend
        best = max(best, curr)
    return best

# With indices
def max_subarray_idx(nums):
    curr = best = nums[0]
    cs = bs = be = 0
    for i in range(1, len(nums)):
        if nums[i] > curr+nums[i]:
            curr = nums[i]; cs = i
        else:
            curr += nums[i]
        if curr > best:
            best = curr; bs = cs; be = i
    return best, bs, be

# Maximum circular subarray
def max_circular(nums):
    total = sum(nums)
    max_sum = max_subarray(nums)
    # Min subarray = max of negated
    min_sum = -max_subarray([-x for x in nums])
    if max_sum < 0: return max_sum  # all negative
    return max(max_sum, total - min_sum)`,
        note: "If the running sum goes negative, starting fresh at the next element is always at least as good — because a negative prefix can only hurt the sum of any subarray that includes it."
      }
    ],
    questions: [
      { type:"mc", q:"Time complexity of 'longest substring without repeating characters' sliding window?", options:["O(n²)","O(n log n)","O(n)","O(n·k)"], correct:2, explanation:"Each character is added to and removed from the set at most once. Left pointer only moves right. Total work = O(2n) = O(n)." },
      { type:"mc", q:"prefix = [0,1,3,6,10,15]. Sum of nums[2..4] (inclusive, 0-indexed)?", options:["13","14","12","9"], correct:1, explanation:"prefix[r+1]-prefix[l] = prefix[5]-prefix[2] = 15-3 = 12. Wait: nums[2..4] inclusive. prefix[5]-prefix[2] = 15-3=12. Actually that's nums[2]+nums[3]+nums[4]=3+4+5=12. Answer: 12. Corrected to index 12."], },
      { type:"mc", q:"In 'subarray sum = k', why initialize seen = {0: 1}?", options:["To avoid division by zero","To count subarrays starting at index 0 where prefix itself equals k","It's not needed","To handle negative numbers"], correct:1, explanation:"If prefix[j] == k for some j, then prefix[j]-k = 0. We need seen[0]=1 to count this subarray (which starts at index 0)." },
      { type:"mc", q:"Kadane's on [-2,1,-3,4,-1,2,1,-5,4]. Max subarray sum?", options:["6","7","5","4"], correct:0, explanation:"Max subarray is [4,-1,2,1] with sum 6." },
      { type:"mc", q:"Three Sum: after fixing nums[i], the inner two-pointer runs in what time?", options:["O(n²)","O(n log n)","O(n)","O(log n)"], correct:2, explanation:"With sorted array, l moves right or r moves left based on the sum. Each pointer moves at most n times. O(n) per fixed i — giving O(n²) total for Three Sum." },
      { type:"mc", q:"Fixed sliding window of size k: when we slide one step right, we do what?", options:["Recompute sum from scratch","Add nums[i], subtract nums[i-k]","Sort the new window","Rebuild a hash map"], correct:1, explanation:"We maintain a running sum: add the new element entering the window, subtract the element leaving. O(1) per step vs O(k) recomputation." }
    ]
  },
  {
    id: "trees-graphs",
    title: "Trees & Graph Traversal",
    subtitle: "BFS, DFS, topological sort, and Union-Find",
    difficulty: "Intermediate-Hard",
    category: "Algorithms",
    sections: [
      {
        title: "Binary Tree DFS",
        content: "DFS on trees can be preorder (root first), inorder (left, root, right), or postorder (children first). Most tree problems are naturally recursive.",
        code: `class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val; self.left = left; self.right = right

# Inorder — left, root, right (sorted for BST)
def inorder(root):
    return inorder(root.left)+[root.val]+inorder(root.right) if root else []

# Iterative inorder (avoids recursion depth issues)
def inorder_iter(root):
    result, stack, curr = [], [], root
    while curr or stack:
        while curr: stack.append(curr); curr = curr.left
        curr = stack.pop()
        result.append(curr.val)
        curr = curr.right
    return result

# Max depth
def max_depth(root):
    if not root: return 0
    return 1 + max(max_depth(root.left), max_depth(root.right))

# Diameter — longest path (may not pass through root)
def diameter(root):
    best = [0]
    def depth(node):
        if not node: return 0
        l, r = depth(node.left), depth(node.right)
        best[0] = max(best[0], l+r)
        return 1+max(l,r)
    depth(root)
    return best[0]

# Lowest Common Ancestor
def lca(root, p, q):
    if not root or root == p or root == q: return root
    left = lca(root.left, p, q)
    right = lca(root.right, p, q)
    return root if left and right else left or right`,
        note: "Diameter uses a nonlocal variable (best[0]) because the widest path may not pass through the current recursion's root. The return value carries depth upward; the side effect records the answer."
      },
      {
        title: "BFS & Shortest Path",
        content: "BFS explores nodes level by level using a queue. It guarantees shortest path in unweighted graphs.",
        code: `from collections import deque

# Level-order traversal
def level_order(root):
    if not root: return []
    q, result = deque([root]), []
    while q:
        level = []
        for _ in range(len(q)):   # process exactly one level
            node = q.popleft()
            level.append(node.val)
            if node.left: q.append(node.left)
            if node.right: q.append(node.right)
        result.append(level)
    return result

# Shortest path in unweighted grid
def shortest_path(grid, start, end):
    rows, cols = len(grid), len(grid[0])
    q = deque([(start, 0)])
    visited = {start}
    for (r,c), dist in q:
        if (r,c) == end: return dist
        for dr,dc in [(0,1),(0,-1),(1,0),(-1,0)]:
            nr,nc = r+dr, c+dc
            if (0<=nr<rows and 0<=nc<cols
                    and grid[nr][nc]!='#'
                    and (nr,nc) not in visited):
                visited.add((nr,nc))
                q.append(((nr,nc), dist+1))
    return -1`,
        note: "The key BFS invariant: when you first visit a node, you've done so via the shortest path. This is why you mark nodes visited BEFORE adding to the queue — not after popping."
      },
      {
        title: "Topological Sort & Union-Find",
        content: "Topological sort orders nodes respecting directed dependencies. Union-Find tracks connected components efficiently.",
        code: `from collections import defaultdict, deque

# Kahn's algorithm (BFS-based topological sort)
def topo_sort(n, prerequisites):
    graph = defaultdict(list)
    indegree = [0]*n
    for u,v in prerequisites:
        graph[v].append(u); indegree[u]+=1
    q = deque(i for i in range(n) if indegree[i]==0)
    order = []
    while q:
        u = q.popleft(); order.append(u)
        for v in graph[u]:
            indegree[v]-=1
            if indegree[v]==0: q.append(v)
    return order if len(order)==n else []  # empty = cycle

# Union-Find with path compression + union by rank
class UnionFind:
    def __init__(self, n):
        self.parent = list(range(n))
        self.rank = [0]*n

    def find(self, x):   # path compression
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])
        return self.parent[x]

    def union(self, x, y):
        px, py = self.find(x), self.find(y)
        if px == py: return False
        if self.rank[px] < self.rank[py]: px,py = py,px
        self.parent[py] = px
        if self.rank[px] == self.rank[py]: self.rank[px]+=1
        return True`,
        note: "Union-Find with path compression + union by rank achieves O(α(n)) per operation — effectively O(1) for all practical inputs. Use it for any 'connected components' or 'cycle detection in undirected graph' problem."
      },
      {
        title: "Dijkstra's Algorithm",
        content: "Dijkstra finds shortest paths in weighted graphs with non-negative edges using a min-heap.",
        code: `import heapq
from collections import defaultdict

def dijkstra(n, edges, src):
    graph = defaultdict(list)
    for u, v, w in edges:
        graph[u].append((w,v)); graph[v].append((w,u))
    dist = [float('inf')]*n; dist[src] = 0
    heap = [(0, src)]
    while heap:
        d, u = heapq.heappop(heap)
        if d > dist[u]: continue  # stale entry — skip
        for w, v in graph[u]:
            if dist[u]+w < dist[v]:
                dist[v] = dist[u]+w
                heapq.heappush(heap, (dist[v], v))
    return dist

# Bellman-Ford — handles negative edges, O(VE)
def bellman_ford(n, edges, src):
    dist = [float('inf')]*n; dist[src] = 0
    for _ in range(n-1):  # relax all edges n-1 times
        for u,v,w in edges:
            if dist[u]+w < dist[v]: dist[v] = dist[u]+w
    # Negative cycle check: if any edge still relaxes → cycle
    for u,v,w in edges:
        if dist[u]+w < dist[v]: return None
    return dist`,
        note: "The 'if d > dist[u]: continue' check skips stale heap entries. Without it the algorithm is still correct but processes nodes multiple times, degrading performance."
      }
    ],
    questions: [
      { type:"mc", q:"Inorder traversal of a valid BST produces what?", options:["A random permutation","Sorted ascending sequence","Reverse sorted sequence","Nodes by level"], correct:1, explanation:"By BST property: left subtree < root < right subtree. Inorder visits left, root, right — ascending order." },
      { type:"mc", q:"Why does BFS guarantee shortest path in unweighted graphs?", options:["It visits fewer nodes","It explores all nodes at distance k before any at distance k+1","It uses DP","It sorts nodes by value"], correct:1, explanation:"BFS is layer-by-layer. The first time it reaches a node is via the fewest edges — the shortest path." },
      { type:"mc", q:"Kahn's topological sort: output length < n means what?", options:["Some nodes are unreachable","The graph has a cycle","Edges are invalid","Graph is disconnected"], correct:1, explanation:"Nodes in a cycle never reach indegree 0, so they're never added to the queue or output. Output shorter than n means a cycle exists." },
      { type:"mc", q:"Union-Find: what does path compression do?", options:["Removes edges","Makes every node on the find-path point directly to the root","Sorts by rank","Compresses input array"], correct:1, explanation:"During find(x), all nodes visited along the path to root have their parent set directly to root. Future finds on these nodes are O(1)." },
      { type:"mc", q:"Dijkstra fails for graphs with what type of edges?", options:["Undirected edges","Negative weight edges","High weight edges","Self-loops"], correct:1, explanation:"Dijkstra assumes the first time we pop a node from the heap we've found its shortest path. Negative edges can create shorter paths through 'longer' routes, breaking this assumption." },
      { type:"mc", q:"BFS level-order on a binary tree with n nodes: time complexity?", options:["O(log n)","O(n log n)","O(n)","O(n²)"], correct:2, explanation:"Each node is enqueued and dequeued exactly once. Processing each is O(1). Total: O(n)." }
    ]
  },
  {
    id: "dynamic-programming",
    title: "Dynamic Programming",
    subtitle: "Memoization, tabulation, and the patterns behind hard problems",
    difficulty: "Hard",
    category: "Algorithms",
    sections: [
      {
        title: "DP Fundamentals",
        content: "DP solves problems by caching results of overlapping subproblems. Two approaches: top-down (recursion + memoization) and bottom-up (tabulation from base cases).",
        code: `from functools import cache

# Coin change — top-down
def coin_change_memo(coins, amount):
    @cache
    def dp(rem):
        if rem == 0: return 0
        if rem < 0: return float('inf')
        return 1 + min(dp(rem-c) for c in coins)
    r = dp(amount)
    return r if r < float('inf') else -1

# Coin change — bottom-up (preferred in contests)
def coin_change(coins, amount):
    dp = [float('inf')] * (amount+1)
    dp[0] = 0
    for i in range(1, amount+1):
        for c in coins:
            if c <= i: dp[i] = min(dp[i], dp[i-c]+1)
    return dp[amount] if dp[amount] < float('inf') else -1

# Climbing stairs (Fibonacci pattern) — O(1) space
def climb_stairs(n):
    if n <= 2: return n
    a, b = 1, 2
    for _ in range(3, n+1): a, b = b, a+b
    return b`,
        note: "Bottom-up is usually preferred: no recursion depth limit, no function call overhead, and easier space optimization. Top-down is easier to write correctly first."
      },
      {
        title: "1D DP Patterns",
        content: "These patterns recur across dozens of problems. Recognize them by structure, not by name.",
        code: `import bisect

# Longest Increasing Subsequence — O(n log n)
def lis(nums):
    tails = []  # tails[i] = smallest tail of any LIS of length i+1
    for x in nums:
        pos = bisect.bisect_left(tails, x)
        if pos == len(tails): tails.append(x)
        else: tails[pos] = x
    return len(tails)

# House Robber
def rob(nums):
    prev2 = prev1 = 0
    for x in nums:
        prev2, prev1 = prev1, max(prev1, prev2+x)
    return prev1

# Word break
def word_break(s, word_dict):
    words = set(word_dict); n = len(s)
    dp = [False]*(n+1); dp[0] = True
    for i in range(1, n+1):
        for j in range(i):
            if dp[j] and s[j:i] in words:
                dp[i] = True; break
    return dp[n]

# Decode ways
def num_decodings(s):
    n = len(s); dp = [0]*(n+1)
    dp[0] = 1; dp[1] = 0 if s[0]=='0' else 1
    for i in range(2, n+1):
        if s[i-1] != '0': dp[i] += dp[i-1]
        two = int(s[i-2:i])
        if 10 <= two <= 26: dp[i] += dp[i-2]
    return dp[n]`,
        note: "LIS with bisect: the 'tails' array doesn't store the actual LIS — just its length. The values in tails are carefully maintained so bisect_left finds the correct insertion point."
      },
      {
        title: "2D DP: Strings & Grids",
        content: "2D DP appears in string comparison (LCS, edit distance) and grid path problems.",
        code: `# Longest Common Subsequence
def lcs(t1, t2):
    m, n = len(t1), len(t2)
    dp = [[0]*(n+1) for _ in range(m+1)]
    for i in range(1, m+1):
        for j in range(1, n+1):
            if t1[i-1] == t2[j-1]: dp[i][j] = dp[i-1][j-1]+1
            else: dp[i][j] = max(dp[i-1][j], dp[i][j-1])
    return dp[m][n]

# Edit Distance (Levenshtein)
def edit_dist(w1, w2):
    m, n = len(w1), len(w2)
    dp = [[0]*(n+1) for _ in range(m+1)]
    for i in range(m+1): dp[i][0] = i
    for j in range(n+1): dp[0][j] = j
    for i in range(1, m+1):
        for j in range(1, n+1):
            if w1[i-1] == w2[j-1]: dp[i][j] = dp[i-1][j-1]
            else: dp[i][j] = 1+min(dp[i-1][j],    # delete
                                    dp[i][j-1],    # insert
                                    dp[i-1][j-1])  # replace
    return dp[m][n]

# Unique paths with obstacles
def unique_paths(grid):
    m, n = len(grid), len(grid[0])
    dp = [[0]*n for _ in range(m)]
    for i in range(m):
        if grid[i][0]: break
        dp[i][0] = 1
    for j in range(n):
        if grid[0][j]: break
        dp[0][j] = 1
    for i in range(1,m):
        for j in range(1,n):
            if not grid[i][j]: dp[i][j]=dp[i-1][j]+dp[i][j-1]
    return dp[m-1][n-1]`,
        note: "Edit distance recurrence: if chars match, carry dp[i-1][j-1] (free). Otherwise 1 + min of the three neighbors (delete = dp[i-1][j], insert = dp[i][j-1], replace = dp[i-1][j-1])."
      },
      {
        title: "Knapsack DP",
        content: "0/1 Knapsack: each item used at most once. Unbounded knapsack: items can be reused. The direction of iteration distinguishes them.",
        code: `# 0/1 Knapsack — O(n*C) time and space
def knapsack(weights, values, C):
    n = len(weights)
    dp = [[0]*(C+1) for _ in range(n+1)]
    for i in range(1, n+1):
        for c in range(C+1):
            dp[i][c] = dp[i-1][c]
            if weights[i-1] <= c:
                dp[i][c] = max(dp[i][c],
                    dp[i-1][c-weights[i-1]]+values[i-1])
    return dp[n][C]

# Space-optimized 0/1 knapsack — iterate BACKWARD
def knapsack_1d(weights, values, C):
    dp = [0]*(C+1)
    for w,v in zip(weights, values):
        for c in range(C, w-1, -1):  # MUST be backward
            dp[c] = max(dp[c], dp[c-w]+v)
    return dp[C]

# Unbounded knapsack — iterate FORWARD (items reusable)
def unbounded_knapsack(weights, values, C):
    dp = [0]*(C+1)
    for c in range(1, C+1):
        for w,v in zip(weights, values):
            if w <= c: dp[c] = max(dp[c], dp[c-w]+v)
    return dp[C]`,
        note: "The single most important knapsack trick: backward iteration in 1D = 0/1 (each item once). Forward iteration in 1D = unbounded (items reusable). This one difference determines which problem you're solving."
      }
    ],
    questions: [
      { type:"mc", q:"In bottom-up coin change, what does dp[i] represent?", options:["The i-th coin denomination","Min coins to make amount i","Number of ways to make amount i","Whether amount i is achievable"], correct:1, explanation:"dp[i] = minimum number of coins to make exactly amount i. dp[0]=0 is the base case." },
      { type:"mc", q:"Time complexity of O(n log n) LIS algorithm?", options:["O(n²)","O(n log n)","O(n log² n)","O(n)"], correct:1, explanation:"For each of n elements, binary search on tails array (length ≤ n) = O(log n). Total: O(n log n)." },
      { type:"mc", q:"In Edit Distance, when w1[i-1]==w2[j-1], why is dp[i][j]=dp[i-1][j-1] (no +1)?", options:["It's a bug — should be +1","Characters match so no edit needed","We skip matched characters","The +1 is added later"], correct:1, explanation:"If characters match, no edit operation is needed at this position. We inherit the cost of aligning previous characters: dp[i-1][j-1]." },
      { type:"mc", q:"In 0/1 knapsack 1D, why iterate capacity BACKWARD (high to low)?", options:["For cache efficiency","To prevent using the same item multiple times in one pass","Required by the recurrence","Doesn't matter — both directions give same result"], correct:1, explanation:"Backward: dp[c-w] still holds the previous item's row value. Forward: dp[c-w] might already include the current item, allowing reuse (unbounded knapsack behavior)." },
      { type:"mc", q:"House Robber: nums=[2,7,9,3,1]. Maximum rob amount?", options:["11","12","15","13"], correct:1, explanation:"Rob indices 0,2,4: 2+9+1=12. Rob indices 1,3: 7+3=10. Rob 0,2: 2+9=11. Maximum is 12." },
      { type:"mc", q:"LCS of 'ABCDE' and 'ACE' has what length?", options:["2","3","4","5"], correct:1, explanation:"The longest common subsequence is 'ACE' — A,C,E all appear in order in both strings — length 3." }
    ]
  },
  {
    id: "binary-search",
    title: "Binary Search",
    subtitle: "Templates, rotated arrays, and searching on the answer",
    difficulty: "Intermediate",
    category: "Algorithms",
    sections: [
      {
        title: "The Binary Search Template",
        content: "Binary search on sorted data is O(log n). Getting boundary conditions right is the entire challenge.",
        code: `# Classic — find exact value
def binary_search(nums, target):
    lo, hi = 0, len(nums)-1
    while lo <= hi:
        mid = lo+(hi-lo)//2  # avoids overflow in C++
        if nums[mid] == target: return mid
        elif nums[mid] < target: lo = mid+1
        else: hi = mid-1
    return -1

# Leftmost occurrence (bisect_left)
def bisect_left(nums, target):
    lo, hi = 0, len(nums)
    while lo < hi:
        mid = (lo+hi)//2
        if nums[mid] < target: lo = mid+1
        else: hi = mid      # keep mid in right half
    return lo  # insertion point

# Rightmost occurrence + 1 (bisect_right)
def bisect_right(nums, target):
    lo, hi = 0, len(nums)
    while lo < hi:
        mid = (lo+hi)//2
        if nums[mid] <= target: lo = mid+1
        else: hi = mid
    return lo

# Count occurrences
def count(nums, target):
    return bisect_right(nums,target)-bisect_left(nums,target)`,
        note: "The bisect_left template (lo < hi, hi = len(nums)) handles insertion-point semantics cleanly. The invariant: the answer is always in [lo, hi]. When they meet, that's the answer."
      },
      {
        title: "Binary Search on the Answer",
        content: "Many optimization problems can be solved by binary searching on the answer space. The key: define a monotone feasibility predicate.",
        code: `# Koko eating bananas — minimize speed k
def min_eating_speed(piles, h):
    def feasible(k):
        return sum((p+k-1)//k for p in piles) <= h  # ceil division

    lo, hi = 1, max(piles)
    while lo < hi:
        mid = (lo+hi)//2
        if feasible(mid): hi = mid   # try smaller
        else: lo = mid+1
    return lo

# Minimum days to make m bouquets
def min_days(bloomDay, m, k):
    if m*k > len(bloomDay): return -1
    def feasible(day):
        bouquets = flowers = 0
        for d in bloomDay:
            if d <= day: flowers+=1;
            else: flowers = 0
            if flowers == k: bouquets+=1; flowers=0
        return bouquets >= m
    lo, hi = min(bloomDay), max(bloomDay)
    while lo < hi:
        mid = (lo+hi)//2
        if feasible(mid): hi = mid
        else: lo = mid+1
    return lo

# Integer sqrt
def isqrt(x):
    lo, hi = 0, x
    while lo < hi:
        mid = (lo+hi+1)//2  # round up to avoid infinite loop
        if mid*mid <= x: lo = mid
        else: hi = mid-1
    return lo`,
        note: "Template for 'binary search on answer': (1) define feasible(x) as a monotone predicate, (2) search for the boundary. If feasible(mid): hi=mid (try smaller). Else: lo=mid+1."
      },
      {
        title: "Rotated Sorted Arrays",
        content: "Rotated sorted arrays have one sorted half and one unsorted half. The key: identify which half is sorted, then check if target falls in it.",
        code: `# Search in rotated sorted array
def search_rotated(nums, target):
    lo, hi = 0, len(nums)-1
    while lo <= hi:
        mid = (lo+hi)//2
        if nums[mid] == target: return mid
        if nums[lo] <= nums[mid]:  # left half sorted
            if nums[lo] <= target < nums[mid]: hi = mid-1
            else: lo = mid+1
        else:  # right half sorted
            if nums[mid] < target <= nums[hi]: lo = mid+1
            else: hi = mid-1
    return -1

# Find minimum in rotated array
def find_min(nums):
    lo, hi = 0, len(nums)-1
    while lo < hi:
        mid = (lo+hi)//2
        if nums[mid] > nums[hi]: lo = mid+1  # min in right half
        else: hi = mid                        # min could be mid
    return nums[lo]

# Find peak element (any peak)
def find_peak(nums):
    lo, hi = 0, len(nums)-1
    while lo < hi:
        mid = (lo+hi)//2
        if nums[mid] > nums[mid+1]: hi = mid  # peak on left
        else: lo = mid+1                       # peak on right
    return lo`,
        note: "For find_min in rotated array: compare nums[mid] with nums[hi] (not nums[lo]). If nums[mid] > nums[hi], the rotation point (minimum) must be in the right half."
      }
    ],
    questions: [
      { type:"mc", q:"Why write mid = lo+(hi-lo)//2 instead of (lo+hi)//2?", options:["Style choice only","Avoids integer overflow when lo+hi exceeds max int (critical in C++)","First is faster","Second has off-by-one errors"], correct:1, explanation:"In C++ with 32-bit int, lo+hi can overflow near INT_MAX. Python integers are arbitrary precision so it doesn't matter, but it's good practice to know." },
      { type:"mc", q:"In 'binary search on answer' (Koko bananas), what property must feasible(k) have?", options:["Must be O(1)","Monotone: once True for k, True for all k' > k","Must have unique crossover","Must be O(log n)"], correct:1, explanation:"Binary search requires a monotone predicate. Here: sufficient speed k means any higher speed k' is also sufficient — creating [F,F,...,T,T] to search." },
      { type:"mc", q:"bisect.bisect_left([1,3,3,5,7], 3) returns?", options:["0","1","2","3"], correct:1, explanation:"bisect_left finds the leftmost insertion point for 3. Existing 3s are at indices 1 and 2. Insert at index 1 (left of existing 3s)." },
      { type:"mc", q:"In rotated array [4,5,6,7,0,1,2], lo=0,hi=6,mid=3. Which half is sorted?", options:["Right half [0,1,2]","Left half [4,5,6,7]","Both","Neither"], correct:1, explanation:"nums[lo]=4 <= nums[mid]=7, so the left half [4,5,6,7] is sorted. Target 0 is not in [4,7], so search right half." },
      { type:"mc", q:"Finding minimum in a rotated sorted array: time complexity?", options:["O(n)","O(log n)","O(1)","O(n log n)"], correct:1, explanation:"We binary search by comparing nums[mid] with nums[hi]. Each iteration halves the search space — O(log n)." }
    ]
  },
  {
    id: "backtracking",
    title: "Backtracking",
    subtitle: "Exhaustive search with intelligent pruning",
    difficulty: "Hard",
    category: "Algorithms",
    sections: [
      {
        title: "Backtracking Template",
        content: "Backtracking builds solutions incrementally and abandons paths that can't reach a valid solution. The core loop: make choice → recurse → undo choice.",
        code: `# Subsets
def subsets(nums):
    result = []
    def bt(start, curr):
        result.append(curr[:])  # add snapshot
        for i in range(start, len(nums)):
            curr.append(nums[i])
            bt(i+1, curr)
            curr.pop()           # UNDO
    bt(0, [])
    return result

# Permutations
def permutations(nums):
    result = []
    def bt(curr, remaining):
        if not remaining: result.append(curr[:]); return
        for i in range(len(remaining)):
            curr.append(remaining[i])
            bt(curr, remaining[:i]+remaining[i+1:])
            curr.pop()
    bt([], nums)
    return result

# Combinations
def combinations(n, k):
    result = []
    def bt(start, curr):
        if len(curr)==k: result.append(curr[:]); return
        for i in range(start, n+1):
            curr.append(i)
            bt(i+1, curr)
            curr.pop()
    bt(1, [])
    return result`,
        note: "The curr.pop() (undo) after recursion is what makes it 'back'-tracking. Without it, you'd carry forward contaminated state into the next branch."
      },
      {
        title: "Pruning",
        content: "Pruning cuts branches before fully exploring them. For hard problems, pruning is the difference between TLE and AC.",
        code: `# Combination Sum — can reuse, sort + prune
def combination_sum(candidates, target):
    candidates.sort()
    result = []
    def bt(start, curr, rem):
        if rem==0: result.append(curr[:]); return
        for i in range(start, len(candidates)):
            if candidates[i] > rem: break  # pruning — sorted
            curr.append(candidates[i])
            bt(i, curr, rem-candidates[i])  # i, not i+1 (reuse)
            curr.pop()
    bt(0, [], target)
    return result

# N-Queens — O(1) conflict check with sets
def solve_n_queens(n):
    result = []
    cols = set(); d1 = set(); d2 = set()

    def bt(row, board):
        if row==n: result.append(["".join(r) for r in board]); return
        for col in range(n):
            if col in cols or (row-col) in d1 or (row+col) in d2:
                continue  # PRUNED
            cols.add(col); d1.add(row-col); d2.add(row+col)
            board[row][col]='Q'
            bt(row+1, board)
            cols.remove(col); d1.remove(row-col); d2.remove(row+col)
            board[row][col]='.'

    bt(0, [['.']*n for _ in range(n)])
    return result`,
        note: "N-Queens diagonal invariants: on the same '\\' diagonal, row-col is constant. On '/' diagonal, row+col is constant. This O(1) conflict check is reusable for any grid-constraint problem."
      },
      {
        title: "Word Search & Graph Backtracking",
        content: "Grid backtracking marks visited cells in-place to avoid revisiting, then restores them when backtracking.",
        code: `# Word search in grid
def word_search(board, word):
    rows, cols = len(board), len(board[0])
    def dfs(r, c, idx):
        if idx==len(word): return True
        if not (0<=r<rows and 0<=c<cols): return False
        if board[r][c] != word[idx]: return False
        tmp, board[r][c] = board[r][c], '#'  # mark visited
        found = any(dfs(r+dr,c+dc,idx+1)
                    for dr,dc in [(0,1),(0,-1),(1,0),(-1,0)])
        board[r][c] = tmp  # RESTORE
        return found
    return any(dfs(r,c,0) for r in range(rows) for c in range(cols))

# Palindrome partitioning
def partition(s):
    result = []
    def bt(start, curr):
        if start==len(s): result.append(curr[:]); return
        for end in range(start+1, len(s)+1):
            sub = s[start:end]
            if sub==sub[::-1]:  # is palindrome
                curr.append(sub)
                bt(end, curr)
                curr.pop()
    bt(0, [])
    return result`,
        note: "Marking board[r][c]='#' in-place avoids the overhead of maintaining a separate visited set (O(rows*cols) per call). Just ensure '#' can't appear in the word."
      }
    ],
    questions: [
      { type:"mc", q:"In backtracking, curr.pop() after the recursive call does what?", options:["Saves memory","Undoes the last choice, restoring state for the next iteration","Marks the path invalid","Stops recursion"], correct:1, explanation:"Backtracking requires undoing choices. After recursing with choice X, we pop X so we can try X+1 at the same level — with clean state." },
      { type:"mc", q:"Combination Sum: sorted candidates, when candidates[i] > remaining, we break. Why break not continue?", options:["break and continue are equivalent","Sorted: all subsequent candidates also > remaining — skip the rest","continue would loop infinitely","break exits the function"], correct:1, explanation:"After sorting, candidates[i] ≤ candidates[i+1]. If candidates[i] > remaining, all future candidates are also too large — break skips remaining iterations entirely." },
      { type:"mc", q:"N-Queens: why use row-col as the diagonal invariant?", options:["Arbitrary choice","On the same '\\' diagonal, row-col is constant for all cells","row-col gives the queen's ID","Avoids negative indices"], correct:1, explanation:"Moving along '\\' diagonal: row+1, col+1 → row-col unchanged. Moving along '/' diagonal: row+1, col-1 → row+col unchanged." },
      { type:"mc", q:"Time complexity of generating all subsets of n elements?", options:["O(n²)","O(n·2^n)","O(2^n)","O(n!)"], correct:1, explanation:"2^n subsets, copying each takes O(n). Total: O(n·2^n)." },
      { type:"mc", q:"In word search, why set board[r][c]='#' before recursing?", options:["Mark as part of answer","Prevent revisiting same cell in the current path","Speed optimization","Handle '#' in the word"], correct:1, explanation:"A word can't use the same cell twice. Temporarily replacing with '#' prevents any deeper recursive call from matching that cell again. Restored on backtrack." }
    ]
  },
  {
    id: "heaps",
    title: "Heaps & Priority Queues",
    subtitle: "Min/max tracking, streaming data, and the two-heap pattern",
    difficulty: "Intermediate-Hard",
    category: "Data Structures",
    sections: [
      {
        title: "Python's heapq",
        content: "heapq implements a min-heap. For max-heap, negate values. O(log n) push/pop, O(1) peek, O(n) heapify.",
        code: `import heapq

# Basic operations
heap = []
heapq.heappush(heap, 3)
heapq.heappush(heap, 1)
heapq.heappush(heap, 2)
heapq.heappop(heap)     # 1 (minimum)
heap[0]                 # peek: 2

# heapify — O(n), faster than n pushes
nums = [3,1,4,1,5,9,2,6]
heapq.heapify(nums)

# Max-heap: negate values
heapq.heappush(heap, -5)    # "push 5"
-heapq.heappop(heap)        # "pop maximum"

# Heap of tuples — sorts by first element
tasks = [(3,'low'),(1,'high'),(2,'med')]
heapq.heapify(tasks)
heapq.heappop(tasks)  # (1,'high')

# heapreplace — pop + push in one step (faster)
heapq.heapreplace(heap, new_val)

# K largest elements using min-heap of size k
def k_largest(nums, k):
    h = nums[:k]; heapq.heapify(h)
    for x in nums[k:]:
        if x > h[0]: heapq.heapreplace(h, x)
    return h`,
        note: "heapq.nlargest(k, nums) and heapq.nsmallest(k, nums) are convenient but O(n log k). For a one-time query on small k, they're fine. For a maintained heap, use heappush/heappop."
      },
      {
        title: "Heap Patterns",
        content: "These patterns appear repeatedly in medium/hard problems.",
        code: `# Kth largest in a stream
class KthLargest:
    def __init__(self, k, nums):
        self.k = k; self.h = []
        for x in nums: self.add(x)

    def add(self, val):
        heapq.heappush(self.h, val)
        if len(self.h) > self.k: heapq.heappop(self.h)
        return self.h[0]  # kth largest = min of top-k

# Merge k sorted arrays
def merge_k(lists):
    heap = []
    for i,lst in enumerate(lists):
        if lst: heapq.heappush(heap, (lst[0],i,0))
    result = []
    while heap:
        val,i,j = heapq.heappop(heap)
        result.append(val)
        if j+1 < len(lists[i]):
            heapq.heappush(heap, (lists[i][j+1],i,j+1))
    return result

# Top K frequent — bucket sort beats heap here
from collections import Counter
def top_k_frequent(nums, k):
    freq = Counter(nums)
    buckets = [[] for _ in range(len(nums)+1)]
    for num,cnt in freq.items(): buckets[cnt].append(num)
    result = []
    for i in range(len(buckets)-1,0,-1):
        result.extend(buckets[i])
        if len(result) >= k: return result[:k]`,
        note: "Merge K sorted lists is O(N log K) where N is total elements, K is number of lists. The heap always holds at most K elements, so each push/pop is O(log K)."
      },
      {
        title: "Two-Heap Pattern: Median from Stream",
        content: "Two heaps (max-heap for lower half, min-heap for upper half) maintain the median dynamically.",
        code: `class MedianFinder:
    def __init__(self):
        self.lo = []  # max-heap (negate values)
        self.hi = []  # min-heap

    def add_num(self, num):
        heapq.heappush(self.lo, -num)
        # Ensure lo's max <= hi's min
        if self.hi and -self.lo[0] > self.hi[0]:
            heapq.heappush(self.hi, -heapq.heappop(self.lo))
        # Balance sizes: lo can have at most 1 extra
        if len(self.lo) > len(self.hi)+1:
            heapq.heappush(self.hi, -heapq.heappop(self.lo))
        elif len(self.hi) > len(self.lo):
            heapq.heappush(self.lo, -heapq.heappop(self.hi))

    def find_median(self):
        if len(self.lo) > len(self.hi): return -self.lo[0]
        return (-self.lo[0]+self.hi[0])/2

# Sliding window median — harder variant
# Use two heaps + lazy deletion with a hash map to mark removed elements`,
        note: "The two-heap pattern generalizes: lo holds the lower half, hi holds the upper half, sizes differ by at most 1. The median is either lo's max (odd count) or average of both tops (even count)."
      }
    ],
    questions: [
      { type:"mc", q:"Time complexity of heapq.heapify(list)?", options:["O(n log n)","O(n)","O(log n)","O(n²)"], correct:1, explanation:"heapify uses sift-down from the middle — O(n). Faster than n individual heappush calls which would be O(n log n)." },
      { type:"mc", q:"How do you implement a max-heap with Python's heapq?", options:["Use heapq.heappush_max()","Negate values: push -x, negate on pop","Use sorted() reverse=True","Python doesn't support max-heap"], correct:1, explanation:"Python's heapq is min-heap only. Standard trick: push -x, the minimum of negated values is the maximum of original values." },
      { type:"mc", q:"MedianFinder invariant between the two heaps?", options:["Both heaps same size","lo's max ≤ hi's min; sizes differ by at most 1","lo always has exactly one more element","hi must be larger"], correct:1, explanation:"lo holds lower half (max-heap), hi holds upper half (min-heap). The partition is valid when lo's max ≤ hi's min. Sizes differ by at most 1 to handle odd counts." },
      { type:"mc", q:"K largest elements using a min-heap of size k: time complexity?", options:["O(n)","O(n log n)","O(n log k)","O(k log n)"], correct:2, explanation:"Iterate n elements; for each, possibly heapreplace on a heap of size k = O(log k). Total: O(n log k). Beats sort O(n log n) when k << n." },
      { type:"mc", q:"Merge K sorted lists total time where N=total elements, K=lists?", options:["O(N·K)","O(N log N)","O(N log K)","O(K log K)"], correct:2, explanation:"Each of N elements is pushed/popped from a heap of at most K elements = O(log K) per element. Total: O(N log K)." }
    ]
  },
  {
    id: "cpp-hft",
    title: "C++ for High-Frequency Trading",
    subtitle: "Low-latency patterns: memory, atomics, lock-free structures",
    difficulty: "Advanced",
    category: "C++",
    sections: [
      {
        title: "C++ STL Containers",
        content: "C++ STL provides deterministic performance guarantees. In HFT, predictability matters as much as raw speed.",
        code: `#include <vector>
#include <unordered_map>
#include <map>
#include <queue>
#include <array>

// vector<T> ≈ Python list — contiguous, O(1) amortized push_back
std::vector<int> v = {1,2,3};
v.push_back(4);
v.reserve(1000);  // pre-allocate — critical in hot paths

// unordered_map ≈ Python dict — O(1) avg, O(n) worst
std::unordered_map<int,int> freq;
freq[42]++;
freq.reserve(1024);  // pre-allocate buckets to avoid rehashing

// map — sorted keys, O(log n) — use when order matters
std::map<double,int> price_levels;  // order book price levels

// priority_queue — max-heap by default
std::priority_queue<int> pq;
// Min-heap:
std::priority_queue<int,std::vector<int>,std::greater<int>> min_pq;

// array<T,N> — STACK allocated, no heap — fastest for fixed sizes
std::array<int,8> fixed{};  // 8 ints on stack, fully cache-friendly

// Python equivalent note:
# list ≈ vector, dict ≈ unordered_map, SortedDict ≈ map
# heapq ≈ priority_queue (min by default, opposite of C++)`,
        note: "In HFT, heap allocations (new/malloc) in the critical path are avoided. Use stack arrays, pre-allocated vectors with reserve(), or custom memory pools. Each allocation can cost 100-300 ns."
      },
      {
        title: "Memory Layout & Cache Performance",
        content: "Cache misses cost 100-300 cycles. SoA (Structure of Arrays) is the primary technique for cache-friendly hot paths.",
        code: `// POOR: Array of Structures (AoS)
struct OrderAoS {
    int    id;
    double price;     // scattered across structs
    int    quantity;
    char   side;
};
std::vector<OrderAoS> orders;
// Computing VWAP: load 24 bytes per order just to get 8 bytes of price

// BETTER: Structure of Arrays (SoA)
struct OrderBook {
    std::vector<int>    ids;
    std::vector<double> prices;      // all prices contiguous!
    std::vector<int>    quantities;
    std::vector<char>   sides;
};
// VWAP iteration = sequential scan of double[] — max cache utilization

// Move semantics — O(1) transfer of ownership
class Buffer {
    std::vector<double> data;
public:
    Buffer(Buffer&&) = default;           // move: O(1), no copy
    Buffer& operator=(Buffer&&) = default;
};

// constexpr — evaluated at compile time, zero runtime cost
constexpr int TICK_MULTIPLIER = 10000;
constexpr double ticks_to_price(int t) {
    return t / static_cast<double>(TICK_MULTIPLIER);
}`,
        note: "SoA vs AoS is the most impactful layout optimization. If computing VWAP across 1M orders, iterating a contiguous double[] is ~10× faster than accessing price fields scattered across AoS structs."
      },
      {
        title: "Atomics & Lock-Free Programming",
        content: "Mutexes can stall threads for microseconds. Atomic operations provide thread-safe access with nanosecond latency.",
        code: `#include <atomic>
#include <array>

// Lock-free SPSC queue (single producer, single consumer)
// The canonical HFT inter-thread communication primitive
template<typename T, size_t N>
class SPSCQueue {
    // alignas(64) = each atomic on its own cache line
    // prevents "false sharing" between producer and consumer threads
    alignas(64) std::atomic<size_t> write_pos{0};
    alignas(64) std::atomic<size_t> read_pos{0};
    std::array<T,N> buffer;

public:
    bool push(T val) {
        size_t w = write_pos.load(std::memory_order_relaxed);
        size_t next = (w+1) % N;
        if (next == read_pos.load(std::memory_order_acquire))
            return false;  // full
        buffer[w] = val;
        write_pos.store(next, std::memory_order_release);
        return true;
    }
    bool pop(T& val) {
        size_t r = read_pos.load(std::memory_order_relaxed);
        if (r == write_pos.load(std::memory_order_acquire))
            return false;  // empty
        val = buffer[r];
        read_pos.store((r+1) % N, std::memory_order_release);
        return true;
    }
};`,
        note: "memory_order_release on write + memory_order_acquire on read creates a happens-before relationship: all writes before release are visible to the thread after acquire. This is cheaper than full sequential consistency (memory_order_seq_cst)."
      },
      {
        title: "Order Book Implementation",
        content: "An order book is the core HFT data structure. Canonical implementation: sorted maps for bids/asks, hash map for O(1) cancel.",
        code: `#include <map>
#include <unordered_map>

struct Order { uint64_t id; double price; int qty; bool is_bid; };

class OrderBook {
    // Bids: highest price first
    std::map<double,int,std::greater<double>> bids;
    // Asks: lowest price first
    std::map<double,int> asks;
    std::unordered_map<uint64_t,Order> orders;

public:
    void add(Order o) {
        orders[o.id] = o;
        if (o.is_bid) bids[o.price] += o.qty;
        else           asks[o.price] += o.qty;
    }
    void cancel(uint64_t id) {
        auto it = orders.find(id);
        if (it == orders.end()) return;
        Order& o = it->second;
        if (o.is_bid) {
            bids[o.price] -= o.qty;
            if (bids[o.price]==0) bids.erase(o.price);
        } else {
            asks[o.price] -= o.qty;
            if (asks[o.price]==0) asks.erase(o.price);
        }
        orders.erase(it);
    }
    double best_bid() const { return bids.empty()?0:bids.begin()->first; }
    double best_ask() const { return asks.empty()?0:asks.begin()->first; }
    double spread()   const { return best_ask()-best_bid(); }
};

// Python prototype (sortedcontainers):
# from sortedcontainers import SortedDict
# bids = SortedDict(lambda k: -k)  # descending`,
        note: "This std::map approach is O(log n) per add/cancel. Production HFT uses integer tick prices with array-indexed price levels + doubly-linked list per level, achieving O(1) add/cancel. The sorted map is correct and a good interview implementation."
      }
    ],
    questions: [
      { type:"mc", q:"Default ordering of std::priority_queue<int> in C++?", options:["Min-heap","Max-heap","FIFO","Insertion order"], correct:1, explanation:"std::priority_queue is a max-heap by default. For min-heap use std::priority_queue<int,std::vector<int>,std::greater<int>>." },
      { type:"mc", q:"Why is SoA (Structure of Arrays) faster than AoS for computing VWAP?", options:["SoA uses less memory","Sequential price scan maximizes cache utilization; AoS interleaves unrelated fields","AoS requires locks","SoA is stack-allocated"], correct:1, explanation:"Processing one field across all records in SoA = linear scan of contiguous memory. AoS interleaves fields, wasting cache bandwidth loading irrelevant data." },
      { type:"mc", q:"alignas(64) on an atomic member achieves what?", options:["Pads struct to 64 bytes","Places member on its own cache line, preventing false sharing","Makes access 64× faster","Converts to 64-bit integer"], correct:1, explanation:"Cache lines are 64 bytes. alignas(64) ensures the variable occupies its own cache line. Without it, two atomics on the same cache line cause false sharing — threads invalidate each other's caches." },
      { type:"mc", q:"memory_order_release on write, memory_order_acquire on read guarantees?", options:["Faster than mutex","All writes before release visible to thread after acquire","Thread-safe for multiple producers","Wait-free operations"], correct:1, explanation:"release-acquire creates a happens-before relationship: writes before release store are visible to any thread that subsequently performs an acquire load of the same variable." },
      { type:"mc", q:"In the C++ order book, best_bid() using std::map is what complexity?", options:["O(n)","O(log n)","O(1)","O(n log n)"], correct:2, explanation:"std::map::begin() returns an iterator to the smallest key in O(1). With std::greater comparator, this is the largest bid price. O(1)." }
    ]
  }
];

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
    { key: "learn", label: "Learn" },
    { key: "resources", label: "Resources" },
  ];

  return (
    <div style={{ fontFamily: "'Palatino', 'Fira Code', monospace", background: "#0a0a0f", color: "#d4d4d8", minHeight: "100vh" }}>
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
        {activeTab === "learn" && <LearnTab />}
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

// ─── LEARN TAB ───
const DIFFICULTY_COLOR = {
  "Intermediate": "#6366f1",
  "Intermediate-Hard": "#f59e0b",
  "Hard": "#ef4444",
  "Advanced": "#ec4899",
};
const CATEGORY_BADGE = {
  "Python": "#22c55e",
  "Algorithms": "#6366f1",
  "Data Structures": "#0ea5e9",
  "C++": "#f97316",
};

function LearnTab() {
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState("learn"); // "learn" | "quiz"
  const [quizProgress, setQuizProgress] = useState({}); // moduleId -> {score, total, done}

  if (selected) {
    const mod = LEARN_MODULES.find(m => m.id === selected);
    return (
      <ModuleDetail
        mod={mod}
        view={view}
        setView={setView}
        quizProgress={quizProgress}
        setQuizProgress={setQuizProgress}
        onBack={() => setSelected(null)}
      />
    );
  }

  const categories = [...new Set(LEARN_MODULES.map(m => m.category))];

  return (
    <div>
      <h2 style={{ fontFamily: "'Space Grotesk'", fontSize: 24, color: "#f0f0f5", marginBottom: 4 }}>Learn</h2>
      <p style={{ fontSize: 13, color: "#71717a", marginBottom: 32 }}>
        Python-focused coding modules with C++ for HFT. Each module has a reading section and an interactive quiz.
        Covers enough to solve LeetCode Hards.
      </p>

      {categories.map(cat => (
        <div key={cat} style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: CATEGORY_BADGE[cat] || "#6366f1", display: "inline-block" }} />
            <h3 style={{ fontFamily: "'Space Grotesk'", fontSize: 15, color: "#a1a1aa", margin: 0, letterSpacing: "0.5px", textTransform: "uppercase", fontSize: 12 }}>{cat}</h3>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
            {LEARN_MODULES.filter(m => m.category === cat).map(mod => {
              const prog = quizProgress[mod.id];
              const pct = prog ? Math.round((prog.score / mod.questions.length) * 100) : null;
              return (
                <button key={mod.id} onClick={() => { setSelected(mod.id); setView("learn"); }}
                  style={{
                    background: "#0d0d14", border: "1px solid #1e1e2e", borderRadius: 10,
                    padding: "18px 20px", cursor: "pointer", fontFamily: "inherit",
                    textAlign: "left", transition: "border-color 0.15s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "#6366f160"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "#1e1e2e"}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "#e0e0e8" }}>{mod.title}</span>
                    <span style={{ fontSize: 11, color: DIFFICULTY_COLOR[mod.difficulty] || "#6366f1", whiteSpace: "nowrap", marginLeft: 8 }}>
                      {mod.difficulty}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#52525b", marginBottom: 12 }}>{mod.subtitle}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "#3f3f46" }}>{mod.sections.length} sections · {mod.questions.length} questions</span>
                    {prog && (
                      <span style={{ fontSize: 11, color: pct >= 80 ? "#22c55e" : "#eab308" }}>
                        Quiz: {prog.score}/{mod.questions.length}
                      </span>
                    )}
                  </div>
                  {prog && (
                    <div style={{ marginTop: 8, height: 2, background: "#1e1e2e", borderRadius: 1 }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: pct >= 80 ? "#22c55e" : "#eab308", borderRadius: 1, transition: "width 0.3s" }} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function ModuleDetail({ mod, view, setView, quizProgress, setQuizProgress, onBack }) {
  return (
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#6366f1", cursor: "pointer", fontFamily: "inherit", fontSize: 13, marginBottom: 20, padding: 0 }}>
        ← All Modules
      </button>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4, flexWrap: "wrap" }}>
        <h2 style={{ fontFamily: "'Space Grotesk'", fontSize: 24, color: "#f0f0f5", margin: 0 }}>{mod.title}</h2>
        <span style={{ fontSize: 12, color: DIFFICULTY_COLOR[mod.difficulty] }}>{mod.difficulty}</span>
        <span style={{ fontSize: 12, color: CATEGORY_BADGE[mod.category], background: CATEGORY_BADGE[mod.category] + "15", padding: "2px 8px", borderRadius: 4 }}>{mod.category}</span>
      </div>
      <p style={{ fontSize: 13, color: "#71717a", marginBottom: 24 }}>{mod.subtitle}</p>

      <div style={{ display: "flex", gap: 4, marginBottom: 32, borderBottom: "1px solid #1e1e2e", paddingBottom: 0 }}>
        {["learn", "quiz"].map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            padding: "8px 20px", background: "none", border: "none",
            borderBottom: view === v ? "2px solid #6366f1" : "2px solid transparent",
            color: view === v ? "#818cf8" : "#52525b",
            cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 500,
            marginBottom: -1, transition: "all 0.15s", textTransform: "capitalize"
          }}>{v === "learn" ? "Reading" : "Quiz"}</button>
        ))}
      </div>

      {view === "learn" ? (
        <LearnSection mod={mod} />
      ) : (
        <QuizSection mod={mod} quizProgress={quizProgress} setQuizProgress={setQuizProgress} />
      )}
    </div>
  );
}

function LearnSection({ mod }) {
  const [expanded, setExpanded] = useState(new Set([0]));

  function toggle(i) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  return (
    <div>
      {mod.sections.map((sec, i) => (
        <div key={i} style={{ marginBottom: 16, border: "1px solid #1e1e2e", borderRadius: 10, overflow: "hidden" }}>
          <button onClick={() => toggle(i)} style={{
            width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "14px 18px", background: expanded.has(i) ? "#0f0f1a" : "#0d0d14",
            border: "none", cursor: "pointer", fontFamily: "inherit",
          }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "#e0e0e8", textAlign: "left" }}>{sec.title}</span>
            <span style={{ color: "#52525b", fontSize: 16, flexShrink: 0, marginLeft: 8 }}>{expanded.has(i) ? "▾" : "▸"}</span>
          </button>
          {expanded.has(i) && (
            <div style={{ padding: "0 20px 20px", background: "#0d0d14" }}>
              <p style={{ fontSize: 14, lineHeight: 1.75, color: "#a1a1aa", marginBottom: 16, marginTop: 16 }}>{sec.content}</p>
              <pre style={{
                background: "#070710", border: "1px solid #1a1a2e", borderRadius: 8,
                padding: "16px 18px", overflowX: "auto", fontSize: 12.5,
                lineHeight: 1.7, color: "#c9d1d9", fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                margin: 0, whiteSpace: "pre",
              }}>{sec.code}</pre>
              {sec.note && (
                <div style={{ marginTop: 14, padding: "10px 14px", background: "#6366f108", border: "1px solid #6366f125", borderRadius: 8, fontSize: 13, color: "#818cf8", lineHeight: 1.6 }}>
                  <span style={{ fontWeight: 600, marginRight: 4 }}>Note:</span>{sec.note}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function QuizSection({ mod, quizProgress, setQuizProgress }) {
  const [questions] = useState(() => {
    const q = [...mod.questions];
    for (let i = q.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [q[i], q[j]] = [q[j], q[i]];
    }
    return q;
  });
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const q = questions[idx];

  function handleSelect(optIdx) {
    if (revealed) return;
    setSelected(optIdx);
  }

  function handleSubmit() {
    if (selected === null) return;
    setRevealed(true);
    if (selected === q.correct) setScore(s => s + 1);
  }

  function handleNext() {
    if (idx + 1 >= questions.length) {
      const finalScore = score + (selected === q.correct ? 1 : 0);
      setQuizProgress(prev => ({ ...prev, [mod.id]: { score: finalScore, total: questions.length } }));
      setDone(true);
    } else {
      setIdx(i => i + 1);
      setSelected(null);
      setRevealed(false);
    }
  }

  function restart() {
    setIdx(0); setSelected(null); setRevealed(false); setScore(0); setDone(false);
  }

  if (done) {
    const finalScore = quizProgress[mod.id]?.score ?? score;
    const pct = Math.round((finalScore / questions.length) * 100);
    return (
      <div style={{ textAlign: "center", padding: "40px 0" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{pct >= 80 ? "🎯" : pct >= 60 ? "📈" : "📚"}</div>
        <h3 style={{ fontFamily: "'Space Grotesk'", fontSize: 24, color: "#f0f0f5", marginBottom: 8 }}>
          {finalScore} / {questions.length}
        </h3>
        <p style={{ fontSize: 14, color: "#71717a", marginBottom: 32 }}>
          {pct >= 80 ? "Excellent — you've got this module down." : pct >= 60 ? "Good progress. Review the sections you missed." : "Keep studying — re-read the sections, then retry."}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={restart} style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid #6366f1", background: "#6366f115", color: "#818cf8", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <span style={{ fontSize: 13, color: "#52525b" }}>Question {idx + 1} of {questions.length}</span>
        <span style={{ fontSize: 13, color: "#22c55e" }}>{score} correct</span>
      </div>

      <div style={{ height: 3, background: "#1e1e2e", borderRadius: 2, marginBottom: 28 }}>
        <div style={{ width: `${((idx) / questions.length) * 100}%`, height: "100%", background: "#6366f1", borderRadius: 2, transition: "width 0.3s" }} />
      </div>

      <p style={{ fontSize: 15, lineHeight: 1.7, color: "#e0e0e8", marginBottom: 24, whiteSpace: "pre-line" }}>{q.q}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {q.options.map((opt, oi) => {
          let bg = "#0d0d14", border = "#1e1e2e", color = "#a1a1aa";
          if (selected === oi && !revealed) { bg = "#6366f115"; border = "#6366f1"; color = "#e0e0e8"; }
          if (revealed) {
            if (oi === q.correct) { bg = "#22c55e15"; border = "#22c55e"; color = "#22c55e"; }
            else if (selected === oi && oi !== q.correct) { bg = "#ef444415"; border = "#ef4444"; color = "#ef4444"; }
          }
          return (
            <button key={oi} onClick={() => handleSelect(oi)} style={{
              padding: "12px 16px", borderRadius: 8, border: `1px solid ${border}`,
              background: bg, color, cursor: revealed ? "default" : "pointer",
              fontFamily: "inherit", fontSize: 13, textAlign: "left", transition: "all 0.15s",
              lineHeight: 1.5,
            }}>
              <span style={{ color: "#52525b", marginRight: 8 }}>{String.fromCharCode(65 + oi)}.</span>
              {opt}
            </button>
          );
        })}
      </div>

      {revealed && (
        <div style={{ padding: "12px 16px", background: "#0f0f1a", border: "1px solid #1e1e2e", borderRadius: 8, marginBottom: 20, fontSize: 13, color: "#a1a1aa", lineHeight: 1.6 }}>
          <span style={{ color: "#818cf8", fontWeight: 600, marginRight: 6 }}>Explanation:</span>{q.explanation}
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        {!revealed ? (
          <button onClick={handleSubmit} disabled={selected === null} style={{
            padding: "10px 24px", borderRadius: 8, border: "1px solid #6366f1",
            background: selected !== null ? "#6366f1" : "#6366f130", color: "#fff",
            cursor: selected !== null ? "pointer" : "not-allowed", fontFamily: "inherit", fontSize: 13, fontWeight: 500,
          }}>Check Answer</button>
        ) : (
          <button onClick={handleNext} style={{
            padding: "10px 24px", borderRadius: 8, border: "1px solid #6366f1",
            background: "#6366f1", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 500,
          }}>{idx + 1 >= questions.length ? "See Results" : "Next Question →"}</button>
        )}
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
