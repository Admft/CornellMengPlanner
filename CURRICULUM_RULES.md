# Planning rules and verification

Reviewed 2026-09-29 against the user-supplied Summer 2026 and old January-start proposal forms and three program emails.

- Seasonal offerings recur in subsequent years as a planning assumption requested by the user, not a guarantee of future registration availability.
- Program email overrides the older workshop comments: ENMGT 6010 in Fall; ENMGT 6011 in Spring.
- Current Data Analytics is 3 credits. Completed legacy Analytics remains 4 credits.
- From Spring 2027, economics is ENMGT 5941 + 5942, 1.5 credits each. Completed ENMGT 5940 satisfies the requirement and retains its 4 credits.
- The new AI requirement applies to incoming Summer 2026+ students and early admits. Returning students can choose it as an elective. The email says 5404; both the supplied updated template and the current Cornell roster say 5405: https://classes.cornell.edu/browse/roster/FA26/class/ENMGT/5405
- ENMGT 6020 can fulfill Organizational Behavior or an elective, counted once. The program email identifies Kabeh Vaziri and synchronous DL instruction, time TBD. The public Fall 2026 roster page lists an in-person section with different instructor information, so it is not used to override the supplied DL email.
- AI Value Generation is Spring, including Spring 2027 per the supplied announcement. The course code and 1.5 credits come from the proposal form; no flyer was supplied.
- Preserve the minimum 30 credits, at least two elective courses, one 3-credit Organizational Behavior course, and either Residential II or both workshops.
- Capstone follows Project Management, Analytics, Economics, and Decision Framing. All moves and swaps validate the full resulting schedule, including courses dependent on the moved course.
- Known courses imported from the historical form are normalized to current planning requirements; legacy completions are entered separately. Additional course options are retained. Old-form exports use the updated template.

## Excel behavior

The exporter fills selected course rows in the appropriate section, retaining historical course labels and credit amounts. Actual semester codes replace SU1/FA1/SP1 labels. All used columns are visible. Section, semester and program totals use formulas with cached initial results and recalculate in Excel. Row allocation is section-based, not tied to the old template's row numbers. Export blocks missing requirements, duplicates, missing custom-course dates and courses outside the 12-column range. Completed courses without dates are assigned to an eligible past term with an explicit verification note in the workbook.

## Verification

`npm test` checks recurring seasons, change effective dates, prerequisite-preserving moves and swaps, duplicate categories, incoming/legacy/custom credit reconciliation, saved/reopened XLSX values and formulas, overflow rejection, seasonal cell styles, and historical-template import. `npm run build` checks TypeScript and the production bundle.

Browser QA confirmed a valid Spring-to-Spring swap, rejection of a Spring-to-Fall swap, visible empty semesters, and successful workbook generation from the export action. Browser automation could not capture the download event/path. Separately, files generated through the same workbook builder opened in Microsoft Excel; changing a test credit recalculated the total from 30.5 to 31.5. The edit was discarded. Final workbook review verified subtotal display and seasonal shading.

The linked Box handbook was inaccessible through the web tool. The supplied emails and templates are the basis for the DL rules above. No proposal was submitted and no deployment was performed.
