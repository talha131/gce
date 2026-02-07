import os

# --- Global Parameters ---

# FINAL_SCALED_SCORE_MAX:
# This is the "Ceiling" or maximum possible grade a student can receive on their transcript.
# All raw weighted scores will be compressed or scaled into this range (e.g., 0-30).
FINAL_SCALED_SCORE_MAX = 30.0


# UNWEIGHTED_ACTIVITY_MODE:
# Determines how 'Unweighted' activities are treated.
# Options:
# "Additive": Points are added to the numerator (Raw Total) but NOT the denominator (Max Possible).
#             This acts as pure bonus points. 
#             Example: Max Possible = 100. Student gets 90 + 5 (Unweighted). Total = 95/100.
# "Ignore":   These columns are ignored in calculation.
UNWEIGHTED_ACTIVITY_MODE = "Additive"

# --- Column Mapping ---
# Maps internal IDs to CSV column headers.
# Users should edit the values on the right to match their specific CSV file.
COLUMN_MAPPING = {
    "student_id": "KU SEAT #",
    "name": "STUDENT",
    "father_name": "FATHER NAME",
    
    # Unweighted Activities:
    # Add as many as needed here. Keys (e.g., "activity_1") are internal labels.
    # Values (e.g., "Att_Sep4") are the exact CSV headers.
    "unweighted": { 
        "unweighted_1": "Attendance on 2025-09-04", 
        "unweighted_2": "Attendance on 2025-09-11",
        "unweighted_3": "Attendance on 2025-10-03 and 2025-10-04",
        "unweighted_4": "Attendance on 2025-10-24 and 2025-10-25",
    },
    
    # Quizzes:
    # Now a single consolidated column header.
    "quizzes": "Quiz", 
    
    # Assignments:
    # Mapped individually for specific weighting/mastery logic if needed.
    # You can add more here.
    "assignments": {
        "assign_1": "Assignment 1: Understanding & Explaining URLs",
        "assign_2": "Assignment 2: Your New University Email & Video Reflections",
        "assign_3": "Assignment 3: Email Discussion",
        "assign_4": "Assignment 4: Viruses and Human Behavior",
        "assign_5": "Assignment 5: NetAcad Course",
        "assign_6a_script": "Assignment 6a: Script",
        "assign_6a_video": "Assignment 6a: video",
        "assign_info": "Student Information Form",
    },
    
    # Internal Exam:
    # The major anchor assessment.
    "internal_exam": "Midterm Exam",
}

# --- Specific Weights / Max Scores ---
# Define maximum possible scores for each activity type to calculate percentages.
# IMPORTANT: 
# - For 'quizzes', define the max score for the CONSOLIDATED total.
# - For 'unweighted', these max scores are just for reference/stats, they don't affect the course denominator.
# - If an activity is not listed here, it defaults to a max score of 10.
MAX_SCORES = {
    "quizzes": 1560, # Max score for the consolidated quiz column
    "assign_1": 10,
    "assign_2": 10,
    "assign_3": 10,
    "assign_4": 10,
    "assign_5": 10,
    "assign_6a_script": 10,
    "assign_6a_video": 10,
    "assign_info": 10,
    "internal_exam": 100,
}

# --- Grading Rules Configuration ---

# Rule B: Quizzes (Hygiene Factor)
# Logic: If the consolidated quiz score is below this threshold, apply a heavy penalty.
# QUIZ_PASS_THRESHOLD: The raw score needed to avoid penalty.
QUIZ_PASS_THRESHOLD = 1350.0  
# QUIZ_PENALTY_MULTIPLIER: If score < Threshold, multiply by this (e.g., 0.5 = 50% reduction).
QUIZ_PENALTY_MULTIPLIER = 0.5

# --- Assignment Performance Spectrum ---

# ASSIGNMENT_MASTERY_THRESHOLD: 
# The percentage (1.0 = 100%) that a student's score must EXCEED to trigger the mastery reward.
# IMPORTANT: This allows for "Bonus" assignments where score > max possible (e.g., 22/20).
# Example: Max Score = 20. Threshold = 1.0.
#   - Student gets 18/20 (90%): No change.
#   - Student gets 22/20 (110%): Trigger! Multiplier applied.
ASSIGNMENT_MASTERY_THRESHOLD = 1.0 

# ASSIGNMENT_MASTERY_MULTIPLIER: 
# The factor by which the ENTIRE score is multiplied if the threshold is met.
# Example: Multiplier = 1.1.
#   - Student score was 22.
#   - Final Assignment Score = 22 * 1.1 = 24.2.
ASSIGNMENT_MASTERY_MULTIPLIER = 1.1 

# ASSIGNMENT_LAGGING_THRESHOLD: 
# The percentage (0.5 = 50%) below which a student receives a penalty.
# Example: Max Score = 20. Threshold = 0.5 (10 points).
#   - Student gets 12/20: Safe.
#   - Student gets 8/20: Trigger! Penalty applied.
ASSIGNMENT_LAGGING_THRESHOLD = 0.7

# ASSIGNMENT_LAGGING_PENALTY: 
# The factor by which the score is reduced.
# Example: Penalty = 0.8.
#   - Student score was 8.
#   - Final Assignment Score = 8 * 0.8 = 6.4.
ASSIGNMENT_LAGGING_PENALTY = 0.8

# --- Output ---
OUTPUT_FILENAME = "final_grades.csv"
