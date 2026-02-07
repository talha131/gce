# Hybrid Adaptive Grading System

A modular, configurable Python CLI tool for processing student grades using a hybrid of rule-based logic and statistical discrimination ("IRT-Lite").

## 🚀 Setup

### Prerequisites
- Python 3.10+
- `uv` (recommended) or `pip`

### Installation
1.  **Clone the repository** (or navigate to the folder).
2.  **Install dependencies**:
    ```bash
    # Using uv (Recommended)
    uv pip install -r requirements.txt
    
    # Using standard pip
    source .venv/bin/activate  # Or create one if missing
    pip install -r requirements.txt
    ```

## ⚙️ Configuration

The system is controlled entirely by `config.py`. You **must** edit this file to match your CSV structure.

### Key Configuration Areas
1.  **Global Parameters**: Set the final max scale (e.g., 30) and thresholds.
2.  **Column Mapping**: Map your CSV headers to internal categories:
    *   `unweighted`: List of columns (Attendance, Extra Credit).
    *   `quizzes`: The single column header for consolidated quiz marks.
    *   `assignments`: Individual assignment columns.
    *   `internal_exam`: The midterm/final exam column.
3.  **Variable thresholds**:
    *   Max possible scores for each item.
    *   Pass/Fail thresholds for Quizzes.
    *   Mastery/Lagging thresholds for Assignments.

## 🏃 Usage

### Option 1: Using the helper script (Recommended)
This script automatically activates the virtual environment for you.

```bash
./run.sh data/your_class_grades.csv
```

### Option 2: Manual execution
Activate the environment first, then run python.

```bash
# Activate first
source .venv/bin/activate

# Then Run
python main.py data/your_class_grades.csv
```

**Output**:
1.  **Terminal**: A statistical summary of the grade distribution.
2.  **File**: `final_grades.csv` generated in the project root.

---

## 📄 Interpreting Output (`final_grades.csv`)

The output CSV contains detailed transparency columns to show exactly how grades were calculated:

*   **`_raw` Columns** (e.g., `assign_1_raw`, `quizzes_raw`): The original score exactly as read from your input CSV.
*   **`_final` Columns** (e.g., `assign_1_final`, `quizzes_final`): The score *after* applying statistical weighting and grading rules (penalties, bonuses).
*   **`stats_weight_factor`**: The average statistical multiplier applied to this student's grades based on IRT-Lite analysis.
    *   **1.0**: Grades mostly unchanged by statistical weighting.
    *   **< 1.0** (e.g., 0.88): Grades slightly reduced because the student performed well on "Easy" items (low difficulty) or items that didn't discriminate well between high/low performers.
    *   **> 1.0**: Grades boosted because the student performed well on "Hard" items that discriminate well.
*   **`raw_total`**: Sum of all component scores after weighting and rules are applied.
*   **`final_scaled_grade`**: The final computed grade scaled to the maximum (e.g., out of 30.0).

---

## 🧠 Grading Logic & Categories

The system processes grades through four distinct "Rules" or categories, plus a Statistical Weighting Engine.

### 1. Unweighted Activities (Additive)
*   **What it is**: Attendance points, extra credit projects, or simple tasks.
*   **Logic**: These points are **Added directly** to the student's raw total.
*   **Impact**: They increase the Numerator (Student Score) but **DO NOT** increase the Denominator (Max Possible Score). They act as pure bonus points to improve the final grade without penalty for absence (if score is 0).

### 2. Quizzes (Hygiene Factor)
*   **What it is**: Verification that basic concepts are understood.
*   **Logic**: "Hygiene" means it is expected to be done.
*   **Rule**: If the Consolidated Quiz Score is **BELOW** the `QUIZ_PASS_THRESHOLD`, a heavy **Penalty Multiplier** (e.g., 0.5x) is applied. If above, the score is retained as-is (subject to statistical weighting).
*   **Goal**: Ensure students don't ignore small quizzes relying solely on exams.

### 3. Assignments (Performance Spectrum)
*   **What it is**: Homework or Projects.
*   **Logic**: Rewards outliers and penalizes lagging students.
*   **Mastery**: If a student scores **> 100%** (e.g., via internal bonus in the assignment), they get a **Mastery Multiplier** (e.g., 1.1x) applied to the *entire* assignment score.
*   **Lagging**: If a student scores **< 50%** (configurable), they get a **Lagging Penalty** (e.g., 0.8x) applied.

### 4. Internal Exam (Anchor)
*   **What it is**: The main exam (Midterm/Final).
*   **Logic**: This is the "Anchor" assessment. It is heavily weighted by the Statistical Engine.

---

## 📊 Statistical Inference (IRT-Lite)

The system applies a simplified **Item Response Theory (IRT)** logic to weight items dynamically based on class performance. It does not blindly sum up scores; it asks * "How good was this question?"*

For every graded column (Assignments, Quizzes, Exam), the system calculates:

### A. Difficulty Index ($p$)
$$ p = \frac{\text{Mean Score}}{\text{Max Possible Score}} $$
*   **Interpretation**:
    *   High $p$ (> 0.8): **Easy Item**.
    *   Low $p$ (< 0.3): **Hard Item**.
*   **Adjustment**:
    *   **Easy items** get a slight **Weight Reduction** (it's less impressive to solve them).
    *   **Hard items** get a **Weight Bonus** (rewarding students who crack difficult problems).

### B. Discrimination Index ($r$)
Calculated using **Point-Biserial Correlation** between the item score and the student's total raw score.
*   **Interpretation**: how well does this item predict the top students?
    *   High Correlation ($r > 0.4$): **Good Discriminator**. The top students got this right, bottom students got it wrong.
    *   Low Correlation ($r < 0.1$): **Poor Discriminator**. Random guessing or confusing question.
*   **Adjustment**:
    *   **High $r$ items** get a **Weight Bonus** (this is a high-quality signal of ability).
    *   **Low $r$ items** get a **Weight Reduction** (this is noise).

### Result
The final score for any item is:
$$ \text{FinalItemScore} = \text{RawScore} \times \text{WeightModifier}(\text{Difficulty}, \text{Discrimination}) \times \text{RuleMultipliers} $$

This ensures the final grade reflects true ability rather than just point accumulation.

---

## 🎯 Interpreting Results & Tuning Configuration

After running the system, you may wonder if you need to adjust the thresholds in \`config.py\`. Here's how to think about it:

### Understanding \`stats_weight_factor ≈ 1.0\`

**When you see most students with \`stats_weight_factor\` close to 1.0, this is CORRECT, not a problem.**

The statistical weighting (IRT-Lite) adjusts scores based on item difficulty and discrimination:
- **Upweights** hard items where top students excel
- **Downweights** easy items where everyone scores similarly

**\`stats_weight_factor ≈ 1.0\` means:** Your items have similar difficulty and discrimination. This happens when:
- Quizzes: Most students score 90-99% (uniformly high)
- Assignments: Most students get full or near-full marks
- Exams: Relatively consistent performance across the class

**This is expected and appropriate** - the statistical engine isn't finding much variation in item quality, so it's not applying heavy adjustments.

### When High Grades Are Normal (Not Grade Inflation)

If 75% of your students score ≥27/30, this doesn't automatically indicate a problem. It may simply reflect:
- ✅ Most students completed the quizzes
- ✅ Most students did assignments
- ✅ Most students passed exams
- ✅ A **successful class** with high engagement

**High grades reflect actual student performance when assessments are completed consistently.**

### Current Threshold Rationale

The default thresholds are designed to be strict but fair:

- **Quiz Threshold**: 1350/1560 (86.5%) with 50% penalty if failed
  - Ensures students don't ignore cumulative quizzes
  - Penalty is severe enough to discourage \"exam-only\" strategies
  
- **Assignment Lagging**: 70% threshold with 20% penalty
  - Reasonable for computer literacy courses
  - Flags students who are struggling but doesn't overly punish partial completion
  
- **Assignment Mastery**: Requires >100% to trigger 10% bonus
  - Only applies if assignments have extra credit opportunities
  - Rewards exceptional effort

### ⚠️ Only Consider Changing Thresholds If:

1. **Your assessments were too easy**
   - Solution: Redesign assessments, not the grading system
   - The grading system reflects what students earned

2. **You need a forced curve** (e.g., top 30% get A, next 40% get B)
   - This requires a fundamentally different grading philosophy
   - Current system rewards absolute performance, not relative ranking

3. **You want to penalize incomplete work more heavily**
   - Increase \`QUIZ_PENALTY_MULTIPLIER\` (e.g., from 0.5 to 0.3)
   - Decrease \`ASSIGNMENT_LAGGING_PENALTY\` (e.g., from 0.8 to 0.6)

4. **You want to raise the bar for \"passing\"**
   - Increase \`QUIZ_PASS_THRESHOLD\` (e.g., from 1350 to 1400)
   - Increase \`ASSIGNMENT_LAGGING_THRESHOLD\` (e.g., from 0.7 to 0.8)

### Recommendation

**Keep thresholds unchanged if:** Your grade distribution reflects genuine student performance. The system is working as designed - it rewards students who completed the work and performed well.

**Adjust thresholds if:** You have specific pedagogical goals (e.g., discouraging late submissions, emphasizing exam performance) that aren't currently reflected in the output.
---

## 📚 Pedagogical Philosophy & Best Fit Courses

### What Grading Philosophy Does This System Support?

This system implements a **Standards-Based / Criterion-Referenced** grading approach with elements of **Mastery-Based Learning**.

**Key Characteristics:**
- **Criterion-Referenced**: Students are measured against absolute standards (e.g., "complete 86% of quizzes"), not against each other
- **Competency-Based**: Emphasizes demonstrating mastery of learning objectives through consistent work completion
- **Effort-Rewarding**: Values sustained engagement (attendance, assignments, quizzes) as evidence of learning
- **Formative + Summative**: Combines ongoing assessments (quizzes, assignments) with anchor exams

### When Is This System Most Appropriate?

This grading system is **best suited for**:

#### 1. **Skill-Building Courses** (Not Pure Theory)
- Computer Literacy, Programming Fundamentals, Data Analysis
- Courses where practice and repetition build competency
- Learning objectives that can be demonstrated through concrete tasks

#### 2. **Courses with High Formative Assessment**
- Regular quizzes that check understanding incrementally
- Frequent assignments that reinforce concepts
- Continuous feedback opportunities

#### 3. **Courses Prioritizing Completion Over Competition**
- Where the goal is "everyone should be able to do X by the end"
- Not winnowing students for advanced tracks
- Focus on baseline competency for all

#### 4. **Blended Learning Environments**
- Online quizzes (e.g., LMS platforms with auto-grading)
- Lab assignments with clear rubrics
- Combination of self-paced and instructor-led components

### When This System May NOT Be Appropriate

❌ **Avoid this system if:**

1. **You need norm-referenced grading** (forced curve, ranking students)
   - Graduate school admissions pipelines
   - Competitive scholarship selections
   - Honors program cutoffs

2. **Your course is primarily subjective** (creative writing, art critique)
   - Where "right answers" don't exist
   - Where peer comparison is pedagogically valuable

3. **You want to heavily weight final exams**
   - Current system treats exams as one component among many
   - Better for courses where cumulative work matters more than single-event performance

### Alignment with Educational Best Practices

This system aligns with:
- **Backward Design** (Wiggins \& McTighe): Define competencies, then measure consistently
- **Transparency in Learning** (TILT Framework): Students see exactly how grades are calculated
- **Growth Mindset** (Dweck): Rewards sustained effort and iteration
- **Authentic Assessment**: Uses multiple measures, not just high-stakes exams

### Example Course Types That Fit Well

✅ **Computer Literacy** (as demonstrated in this project)
✅ **Introductory Programming** (CS 101)
✅ **Statistics for Social Sciences**
✅ **Digital Marketing Fundamentals**
✅ **Data Analysis with Excel/Python**
✅ **Information Systems Management**

### Bottom Line

Use this system when your course philosophy is: **"Students who consistently engage with the material and complete the work should succeed."**

Avoid this system when your philosophy is: **"Only the top X% should earn high grades."**
