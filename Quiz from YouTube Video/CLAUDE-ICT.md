This lecture is for the "ICT in Education" subject. Apply the same quiz generation process.

# Quiz Generation Instructions for Lecture Videos

## Context

These instructions are for generating YouTube quiz questions from lecture recordings.
The lectures are delivered to **B.Ed. (Bachelor of Education) students** in **Karachi, Pakistan**.
The subject area may vary — examples include:

- ICT in Education
- Computer Literacy
- Applications of ICT
- Critical Thinking

The lectures are delivered in **Urdu**, but all quiz questions and options must be written in **English**.

---

## Input Files

Each project folder will contain two files:

1. **`captions.sbv`** — the YouTube transcript file with timestamps and Urdu text
2. **A PDF file** — the lecture slides used during the session

Read both files before generating questions. The PDF gives you the structure and key concepts. The transcript tells you *when* each topic is discussed so you can assign accurate timestamps.

---

## Task

Generate **10 quiz questions** based on the lecture content.

Each question will be shown to YouTube viewers as a pop-up at a specific timestamp in the video. The question must be relevant to what is being discussed at that exact moment in the video.

---

## Output Format

Generate a **CSV file** named `quiz.csv` in the same folder.

### Columns (in this order):

| Column | Description |
|--------|-------------|
| `timestamp` | YouTube timestamp in `MM:SS:00` format (e.g. `04:01:00`) — minutes, seconds, frames (always `00`) |
| `question` | The quiz question |
| `correct_option` | The one correct answer |
| `wrong_option_1` | First incorrect option |
| `wrong_option_2` | Second incorrect option |
| `wrong_option_3` | Third incorrect option |

### Example row:
```
"04:01:00","What is the basic meaning of lifelong learning?","Continuing to learn beyond formal schooling","Passing exams and scoring high final grades","Reading books that are assigned by teachers","Completing a degree at a recognized university"
```

> **Important:** Every field must be wrapped in double quotes. This ensures that commas inside a question or option are not mistaken for column separators when the file is opened in Google Sheets or any other CSV tool.

---

## Rules for Writing Questions

### Language
- Write in **simple, clear English**
- Keep questions **concise** — avoid long or complex sentences
- Do not translate the lecture; base questions on the *concepts* discussed

### Timestamps
- Each question's timestamp must match the part of the video where that topic is being discussed
- Spread the 10 questions across the full length of the video — do not cluster them all at the start or end
- Read the transcript carefully to find the correct timestamp for each concept
- **Timestamp format:** Use `MM:SS:00` (minutes:seconds:frames, frames always `00`). Example: 4 minutes 30 seconds → `04:30:00`
- **If the video is longer than 1 hour:** Do not guess the format — ask the user what timestamp format YouTube expects for videos over an hour before generating the CSV

### Options
- Each question has **4 options**: 1 correct + 3 incorrect
- **All four options must be roughly the same length** — this is critical
- Do not make the correct option noticeably longer or more detailed than the wrong ones, as students will notice the pattern
- Wrong options should be plausible but clearly incorrect on reflection — avoid obviously silly distractors
- All options for a given question should follow the same grammatical structure (e.g. all start with a verb, or all are noun phrases)
- **Do not use em dashes (—) anywhere in the CSV.** Use a colon or a hyphen instead. Em dashes can cause encoding issues and are unnecessary in this format.

### Question Quality
- Questions should test understanding, not just memorization
- Cover a range of topics from across the lecture — do not ask multiple questions on the same point
- Prioritize concepts that are emphasized or repeated in the lecture
- Where the lecturer makes a distinction (e.g. lifelong learning vs. everyday experience), that contrast is good quiz material

---

## Workflow

1. Read the PDF slides to understand the structure and key topics of the lecture
2. Read the `.sbv` transcript to map concepts to timestamps
3. Select 10 well-spaced moments in the video that correspond to key concepts
4. Write one question per moment, following the rules above
5. Write the output to `quiz.csv`

---

## Notes for Specific Subjects

### ICT in Education
- Focus on concepts like lifelong learning, information literacy, media literacy, 21st century skills, CPD
- The 21st Century Skills Framework (P21) is a recurring foundation — questions about it are always relevant

### Computer Literacy / Applications of ICT
- Focus on practical tool knowledge, digital citizenship, and safe use of technology

### Critical Thinking
- Focus on reasoning skills, evaluating sources, identifying assumptions, and logical fallacies
