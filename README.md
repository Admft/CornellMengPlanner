# Cornell Project

Cornell MEM M.Eng. Management course planner — build a personalized semester-by-semester plan and export it to the official proposal Excel template.

## Run locally

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

## Features

- 4-step wizard: timeline, courses taken, remaining choices, personalized plan
- Automatic semester scheduling with prerequisite and credit-limit rules
- **Export Excel** on the final step — fills `Cornellproposal.xlsx` with your name, NetID, advisor, start/graduation semesters, and course credits per semester column

## Export

The export uses the template at `public/Cornellproposal.xlsx` and preserves its formatting, writing your plan into the same cells as the official form.
