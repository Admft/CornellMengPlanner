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

## Schedule optimization

Whole-schedule search tries earlier completion horizons first, propagates recurring offerings, term capacity, and prerequisite ordering, and backtracks across alternative placements. Selected elective combinations are evaluated for schedulability before choosing a credit-efficient subset. Search is bounded (50,000 nodes; at most 256 elective subsets) to keep the browser responsive. A valid greedy schedule is retained as fallback; an unscheduled result is not a mathematical proof of infeasibility.

The user's completed Economics/Finance (4), Python (1), Residential I (1), Decision Framing (3), and Negotiations (3) total 12 credits. Starting Spring 2027, remaining Fall-only Analytics prevents capstone completion by Fall 2027 under the template's prerequisite rule. With two 3-credit electives and Residential II, extending to Spring 2028 schedules 30 credits. The exact elective choices remain user-selected. Both supplied templates list 5900, 5930, 5940, and 5980 as capstone prerequisites. No concurrent-enrollment exception has been assumed.

Regression checks include the user's 26-to-30-credit scenario, a greedy scheduling trap, calendar-aware elective selection, and 96 small schedules compared with independent exhaustive enumeration.

## Additional on-campus overview supplied by the user

The pasted Engineering Management degree overview identifies its format as In-Person and explicitly references the On-Campus Handbook. Its 32-credit two-semester / 42-credit three-semester requirements, ENMGT 6090/6091 seminars, and broad pre-approved elective lists do not establish Distance Learning requirements or remote course availability. They are not imported into the DL catalog.

Its 4-credit Data Analytics listing does not supersede the DL program email changing future ENMGT 5930 enrollment to 3 credits. Its capstone-in-final-semester statement is scoped to that overview; it neither waives the prerequisites in the supplied DL proposal forms nor authorizes concurrent Analytics/capstone enrollment. Apply additional DL restrictions or electives only when supported by a DL-specific source. This additional overview does not change the Spring 2028 conclusion for the user's Spring 2027 planning start.

## DL overview and final-semester capstone

The subsequently supplied Distance Learning overview confirms 30 credits, the two-elective minimum, Negotiations as an Organizational Behavior option, and the second-residential-or-two-workshops pathway. Its old Analytics credits, economics course and workshop numbers are superseded by the newer DL email. The explicit capstone-final-semester rule is applied to generated plans and all moves/swaps: no planned course may occur after the capstone. Automatic optimization may finish earlier than the target graduation deadline; the capstone must be in that last occupied semester. The overview's first-semester Analytics statement is not imposed retroactively on reported completions; the user should clarify that sequencing with the program.
